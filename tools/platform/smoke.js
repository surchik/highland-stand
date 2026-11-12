#!/usr/bin/env node
// The smoke test against the owner's own Supabase (docs/specs/platform.final.md 10.6).
//
//   node tools/platform/smoke.js <address> <anon key> [--origin=https://highland.avunjian.com]
//   HS_SMOKE_URL=<address> HS_SMOKE_ANON_KEY=<anon key> node tools/platform/smoke.js
//
// It needs only the two PUBLIC values the owner hands over: the Supabase's public https address and its anon key
// (deploy/supabase/README.md, step 5). It never asks for and never uses a secret. It stores nothing: the two values
// are read from the command line or the environment and are never written to a file or printed whole. On the
// server it changes nothing but one analytics event, marked channel "smoke" (the stats leave that channel out).
//
// Thirteen checks, one line each, with what to do when one fails:
//   1  the anon key is not Supabase's published demo key (and is an anon key, not the service key)
//   2  /auth/v1/settings answers within 4 s; which of the three providers are on
//   3  mailer_autoconfirm is false
//   4  the preflight from the game's origin is answered with access-control-allow-origin (and whether it is remembered)
//   5  /auth/v1/authorize without a key sends the browser on to the provider
//   6  hs_config answers with "now": the schema is installed and PostgREST has seen it
//   7  the tables hs_saves and hs_events are refused or not served
//   8  hs_save_get and hs_stats are refused to a visitor
//   9  hs_track takes one event, and not one of 5 KB
//  10  hs_board for a board that does not exist answers an empty list within 3 s
//  11  the public name serves nothing but the Auth routes the page uses and /rest/v1/rpc/hs_: no other path, and none
//      of Auth's routes that make accounts or send mail (signup, otp, recover, magiclink, a password sign-in, a
//      write to the user)
//  12  the gateway's own ports do not answer from outside: 8000 (Envoy or Kong over http) and 8443 (Kong's https);
//      5432 and 6543 (the database's pooler, behind its password) are named when they answer. When this machine
//      cannot open a direct connection at all (its own outbound firewall, or no DNS of its own behind a proxy), a
//      silence would prove nothing: the check then says it cannot be answered from here, and neither passes nor fails
//  13  the address is https and its certificate is valid
// Against the local stack (an address on 127.0.0.1 or localhost) checks 12 and 13 cannot say anything about the
// owner's server: they are run and reported as "only the real Supabase answers this", and do not fail the run.
//
// Prints "RESULT smoke: P passed, F failed, L only on the real Supabase" (and ", U not answerable from this machine"
// when there are such) and exits 1 when any check failed.
"use strict";
const http = require("http");
const net = require("net");
const https = require("https");
const tls = require("tls");
const crypto = require("crypto");

const argv = process.argv.slice(2);
const pos = argv.filter(a => !a.startsWith("--"));
const opt = (k) => { const a = argv.find(x => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : undefined; };
const BASE = String(pos[0] || process.env.HS_SMOKE_URL || "").replace(/\/+$/, "");
const KEY = String(pos[1] || process.env.HS_SMOKE_ANON_KEY || "");
const ORIGIN = opt("origin") || "https://highland.avunjian.com";
if (!BASE || !KEY) {
  console.log("usage: node tools/platform/smoke.js <the Supabase's public https address> <its anon key>");
  console.log("   or: HS_SMOKE_URL=... HS_SMOKE_ANON_KEY=... node tools/platform/smoke.js");
  process.exit(2);
}
let base;
try { base = new URL(BASE); } catch (e) { console.log("FAIL the address is not an address: " + BASE); process.exit(1); }
const LOCAL = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])$/.test(base.hostname);
const PROXY = !LOCAL && (process.env.HTTPS_PROXY || process.env.https_proxy || "");

// ------------------------------------------------------------------ one request, with a time limit
// -> { status, headers, body } or { error: "timeout" | "refused" | <message>, code }
function request(method, url, o = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const isHttps = u.protocol === "https:";
    const headers = { ...(o.headers || {}) };
    // the game's calls name its schema in PostgREST's two profile headers, as the page does (RULINGS S9)
    if (u.pathname.startsWith("/rest/v1/") && o.profile !== false) { headers["accept-profile"] = "highland"; headers["content-profile"] = "highland"; }
    let body = o.body;
    if (body !== undefined && typeof body !== "string") { body = JSON.stringify(body); headers["content-type"] = "application/json"; }
    if (body !== undefined) headers["content-length"] = Buffer.byteLength(body);
    let done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { finish({ error: "timeout" }); try { req && req.destroy(); } catch (e) {} }, o.timeout || 8000);
    let req;
    const go = (socket) => {
      const lib = isHttps ? https : http;
      req = lib.request({ method, hostname: u.hostname, port: u.port || (isHttps ? 443 : 80), path: u.pathname + u.search, headers,
        ...(socket ? { createConnection: () => socket } : {}), servername: u.hostname, agent: false }, (res) => {
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("end", () => finish({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", e => finish({ error: e.message, code: e.code }));
      });
      req.on("error", e => finish({ error: e.code === "ECONNREFUSED" ? "refused" : e.message, code: e.code }));
      if (body !== undefined) req.write(body);
      req.end();
    };
    if (PROXY && isHttps) {
      // through the machine's HTTPS proxy: a CONNECT tunnel, then TLS to the host itself
      const p = new URL(PROXY);
      const c = http.request({ method: "CONNECT", hostname: p.hostname, port: p.port || 80, path: u.hostname + ":" + (u.port || 443), agent: false,
        headers: p.username ? { "proxy-authorization": "Basic " + Buffer.from(decodeURIComponent(p.username) + ":" + decodeURIComponent(p.password)).toString("base64") } : {} });
      c.on("connect", (res, sock) => {
        // the tunnel's socket may be reset by the proxy at any moment: an error on it ends this request, never the run
        sock.on("error", e => finish({ error: "proxy: " + e.message, code: e.code }));
        if (res.statusCode !== 200) { sock.destroy(); return finish({ error: "the proxy refused the tunnel (" + res.statusCode + ")" }); }
        const t = tls.connect({ socket: sock, servername: u.hostname }, () => go(t));
        t.on("error", e => finish({ error: e.message, code: e.code }));
      });
      c.on("error", e => finish({ error: "proxy: " + e.message }));
      c.end();
    } else go(null);
  });
}
const json = (r) => { try { return JSON.parse(r.body); } catch (e) { return null; } };
const keyHeaders = () => ({ apikey: KEY, authorization: "Bearer " + KEY });
const describe = (r) => r.error ? r.error : r.status + " " + String(r.body || "").replace(/\s+/g, " ").slice(0, 100);

// a plain TCP connection to a port, never through the proxy: "open", "closed" (refused or reset), "silent" (no answer
// in time), or "unknown: <why>" when the name cannot be looked up here at all
function probe(host, port, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const s = net.connect({ host, port });
    const end = (r) => { if (!done) { done = true; clearTimeout(t); s.destroy(); resolve(r); } };
    const t = setTimeout(() => end("silent"), timeout || 5000);
    s.on("connect", () => end("open"));
    s.on("error", (e) => end(["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"].includes(e.code) ? "closed" : "unknown: " + (e.code || e.message)));
  });
}

// ------------------------------------------------------------------ the checks
const results = [];
function report(n, status, what, help) {
  results.push(status);
  const tag = { pass: "PASS", fail: "FAIL", local: "ONLY ON THE REAL SUPABASE", here: "NOT ANSWERABLE FROM THIS MACHINE" }[status];
  console.log(tag + "  " + String(n).padStart(2) + ". " + what);
  if (status === "fail" && help) console.log("        what to do: " + help);
}

(async () => {
  console.log("Smoke test of " + base.origin + (LOCAL ? " (the local stack: checks 12 and 13 cannot speak for the owner's server)" : ""));
  if (PROXY) console.log("(through this machine's HTTPS proxy: the certificate of check 13 is the proxy's view; check 12 tries direct connections, which a machine behind a proxy may not be able to make; run it from another machine to be sure)");
  // 1. the key
  {
    let payload = null;
    const parts = KEY.split(".");
    if (parts.length === 3) { try { payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch (e) {} }
    if (/^sb_secret_/.test(KEY)) report(1, "fail", "this is a SECRET key (sb_secret_...), not the anon key", "never put it in the page or a chat; give the publishable (anon) key instead, and rotate this one in the Studio");
    else if (/^sb_publishable_/.test(KEY)) report(1, "pass", "a publishable key (sb_publishable_...): not the demo key; the gateway turns it into an anon token");
    else if (!payload) report(1, "fail", "the key is not a JWT and not a publishable key", "copy ANON_KEY from the Supabase folder's .env again (step 5 of deploy/supabase/README.md)");
    else if (payload.role === "service_role") report(1, "fail", "this is the SERVICE ROLE key, not the anon key", "it must never be in the page or a chat: give ANON_KEY instead, and make new keys (step 0 of the guide)");
    else if (payload.iss === "supabase-demo") report(1, "fail", "this is Supabase's published demo key (iss supabase-demo): anyone can make an all-powerful key for this install", "do step 0 of the guide: a new JWT secret and new keys");
    else if (payload.role !== "anon") report(1, "fail", "the key's role is " + JSON.stringify(payload.role) + ", not anon", "give ANON_KEY from the Supabase folder's .env");
    else report(1, "pass", "the anon key is the install's own (role anon, issuer " + JSON.stringify(payload.iss || "") + ")");
    // a key that may do everything is not sent anywhere, not even to its own server
    if (/^sb_secret_/.test(KEY) || (payload && payload.role === "service_role")) {
      console.log("Stopped here: the other checks are not run with a key that may do everything.");
      console.log("RESULT smoke: 0 passed, 1 failed, 0 only on the real Supabase");
      process.exit(1);
    }
  }
  // 2 and 3. /auth/v1/settings
  let providers = [];
  {
    const t0 = Date.now();
    const r = await request("GET", base.origin + "/auth/v1/settings", { headers: keyHeaders(), timeout: 4000 });
    const j = !r.error && r.status === 200 ? json(r) : null;
    if (!j || !j.external) {
      report(2, "fail", "/auth/v1/settings did not answer within 4 s (" + describe(r) + ")", "the public name must pass /auth/v1/ to the gateway (step 1); the Auth service must be running");
      report(3, "fail", "mailer_autoconfirm could not be read", "fix check 2 first");
    } else {
      providers = ["google", "facebook", "discord"].filter(p => j.external[p]);
      report(2, "pass", "/auth/v1/settings answered in " + (Date.now() - t0) + " ms; providers on: " + (providers.join(", ") || "none") +
        (providers.length < 3 ? " (off: " + ["google", "facebook", "discord"].filter(p => !j.external[p]).join(", ") + ")" : ""));
      if (j.mailer_autoconfirm === false) report(3, "pass", "mailer_autoconfirm is false");
      else report(3, "fail", "mailer_autoconfirm is " + JSON.stringify(j.mailer_autoconfirm) + ": the page holds Discord back while it is on",
        "step 3 of the guide: set ENABLE_EMAIL_AUTOCONFIRM=false (other projects' email sign-ups then need a mail server), or leave Discord off");
    }
  }
  // 4. the preflight
  {
    const r = await request("OPTIONS", base.origin + "/rest/v1/rpc/hs_config", { headers: { origin: ORIGIN, "access-control-request-method": "POST",
      "access-control-request-headers": "apikey, authorization, content-type, accept-profile, content-profile" }, timeout: 4000 });
    const ao = !r.error && r.headers["access-control-allow-origin"];
    if (ao && (ao === "*" || ao === ORIGIN)) {
      const ma = r.headers["access-control-max-age"];
      report(4, "pass", "the preflight from " + ORIGIN + " is allowed (allow-origin " + ao + "); " + (ma ? "remembered for " + ma + " s" : "no max-age: every call costs a preflight (harmless)"));
    } else report(4, "fail", "the preflight from " + ORIGIN + " was not allowed (" + describe(r) + ")", "the proxy must pass OPTIONS on /rest/v1/rpc/hs_ to the gateway, which answers CORS itself (step 1)");
  }
  // 5. /auth/v1/authorize, no key
  {
    const p = providers[0] || "google";
    const r = await request("GET", base.origin + "/auth/v1/authorize?provider=" + p + "&redirect_to=" + encodeURIComponent(ORIGIN + "/"), { timeout: 5000 });
    const loc = !r.error && r.headers.location;
    if (loc && r.status >= 301 && r.status <= 303) {
      let host = ""; try { host = new URL(loc, base.origin).host; } catch (e) {}
      report(5, "pass", "/auth/v1/authorize?provider=" + p + " without a key sends the browser on (" + r.status + " to " + host + ")");
    } else report(5, "fail", "/auth/v1/authorize?provider=" + p + " did not redirect (" + describe(r) + ")",
      r.status === 401 ? "the gateway asks for a key on this route: an older gateway; tell the builder" : "switch the provider on (step 3) and check its client id");
  }
  // 6. hs_config
  {
    const r = await request("POST", base.origin + "/rest/v1/rpc/hs_config", { headers: keyHeaders(), body: {}, timeout: 4000 });
    const j = !r.error && r.status === 200 ? json(r) : null;
    if (j && j.now) report(6, "pass", "hs_config answers (the server's clock: " + j.now + ")");
    else report(6, "fail", "hs_config did not answer (" + describe(r) + ")", r.status === 404 ? "apply the migrations (node tools/platform/migrate.js up) and add highland to PGRST_DB_SCHEMAS (deploy/supabase/README.md); then wait a minute for PostgREST to see it" : "see the answer above");
  }
  // 7. no table is readable
  {
    const bad = [];
    for (const t of ["hs_saves", "hs_events"]) {
      const r = await request("GET", base.origin + "/rest/v1/" + t + "?select=*&limit=1", { headers: keyHeaders(), timeout: 4000 });
      if (r.error || ![401, 403, 404].includes(r.status)) bad.push(t + ": " + describe(r));
    }
    if (!bad.length) report(7, "pass", "the tables hs_saves and hs_events are refused or not served");
    else report(7, "fail", "a table answered: " + bad.join("; "), "do not hand over the key; run node tools/platform/migrate.js regrant (it takes every grant away but 003's) and tell the builder");
  }
  // 8. a signed-in function and the stats are refused to a visitor
  {
    const bad = [];
    for (const f of ["hs_save_get", "hs_stats"]) {
      const r = await request("POST", base.origin + "/rest/v1/rpc/" + f, { headers: keyHeaders(), body: {}, timeout: 4000 });
      if (r.error || ![401, 403].includes(r.status)) bad.push(f + ": " + describe(r));
    }
    if (!bad.length) report(8, "pass", "hs_save_get and hs_stats are refused to a visitor");
    else report(8, "fail", "a visitor was not refused: " + bad.join("; "), "run node tools/platform/migrate.js regrant and tell the builder");
  }
  // 9. one event in, and not one of 5 KB
  {
    const ctx = { aid: crypto.randomUUID(), sid: "smoke-" + crypto.randomBytes(8).toString("hex"), build: "smoke", channel: "smoke", dev: "desktop", os: "other", browser: "other" };
    const r1 = await request("POST", base.origin + "/rest/v1/rpc/hs_track", { headers: keyHeaders(), timeout: 4000,
      body: { p_ctx: ctx, p_events: [{ n: "smoke_test", q: 1, t: Date.now(), p: { check: 9 } }] } });
    const r2 = await request("POST", base.origin + "/rest/v1/rpc/hs_track", { headers: keyHeaders(), timeout: 4000,
      body: { p_ctx: ctx, p_events: [{ n: "smoke_test", q: 2, t: Date.now(), p: { pad: "x".repeat(5000) } }] } });
    const a = json(r1), b = json(r2);
    if (a && a.accepted === 1 && b && b.accepted === 0) report(9, "pass", "hs_track took one event (channel smoke) and refused one of 5 KB");
    else report(9, "fail", "hs_track: " + describe(r1) + " / " + describe(r2), "run node tools/platform/migrate.js regrant; if it says accepted 0 for the small one, the events table may be over its ceiling (the stats page says)");
  }
  // 10. an empty board
  {
    const t0 = Date.now();
    const r = await request("POST", base.origin + "/rest/v1/rpc/hs_board", { headers: keyHeaders(), body: { p_mode: "daily", p_day: "2000-01-01" }, timeout: 3000 });
    const j = !r.error && r.status === 200 ? json(r) : null;
    if (j && Array.isArray(j.rows) && j.rows.length === 0) report(10, "pass", "hs_board for a board that does not exist answered an empty list in " + (Date.now() - t0) + " ms");
    else report(10, "fail", "hs_board: " + describe(r), "run node tools/platform/migrate.js regrant; a slow answer means the database is overloaded");
  }
  // 11. nothing but the two prefixes
  {
    const bad = [];
    // (the Auth routes are sent empty bodies: were one served after all, an empty body makes nothing and sends nothing)
    const PATHS = [["GET", "/"], ["GET", "/pg/"], ["GET", "/storage/v1/"], ["GET", "/realtime/v1/"], ["GET", "/graphql/v1"], ["GET", "/rest/v1/"],
      ["POST", "/rest/v1/rpc/pg_sleep"], ["POST", "/rest/v1/rpc/not_the_game"],
      ["POST", "/auth/v1/signup"], ["POST", "/auth/v1/otp"], ["POST", "/auth/v1/recover"], ["POST", "/auth/v1/magiclink"],
      ["POST", "/auth/v1/token?grant_type=password"], ["POST", "/auth/v1/token?grant_type=id_token"], ["PUT", "/auth/v1/user"], ["GET", "/auth/v1/admin/users"]];
    for (const [m, p] of PATHS) {
      const r = await request(m, base.origin + p, { headers: keyHeaders(), body: m === "GET" ? undefined : {}, timeout: 4000 });
      // a 404 from PostgREST or Auth itself (its answer names a PGRST code or an error_code) means the proxy passed
      // the path on; a write to the user may be refused 403 (nginx's limit_except)
      const refused = (r.status === 404 || (r.status === 403 && p === "/auth/v1/user")) && !/PGRST|error_code/.test(r.body || "");
      if (r.error || !refused) bad.push(m + " " + p + " -> " + describe(r));
    }
    if (!bad.length) report(11, "pass", "the public name serves nothing but the page's Auth routes and /rest/v1/rpc/hs_ (" + PATHS.length + " other paths refused, Auth's signup, otp, recover, magiclink and password sign-in among them)");
    else report(11, "fail", "served beyond what the page uses: " + bad.join("; "), "use the guide's nginx or Caddy block for this name (step 1), which answers 404 to everything else");
  }
  // 12. the gateway's own ports
  {
    const host = base.hostname.replace(/^\[|\]$/g, "");
    // first a port that must answer (the public name's own): if even that cannot be reached directly, this machine
    // cannot open direct connections and a silence below would prove nothing
    const control = await probe(host, Number(base.port) || (base.protocol === "https:" ? 443 : 80), 5000);
    const gw = {}, db = {};
    for (const p of [8000, 8443]) gw[p] = await probe(host, p, 5000);
    for (const p of [5432, 6543]) db[p] = await probe(host, p, 3000);
    const list = (o) => Object.entries(o).map(([p, v]) => p + " " + v).join(", ");
    const open = Object.keys(gw).filter(p => gw[p] === "open");
    const what = "the gateway's own ports: " + list(gw) + (Object.values(db).includes("open") ? "; the database's pooler answers on " + Object.keys(db).filter(p => db[p] === "open").join(" and ") + " (behind its password)" : "");
    if (LOCAL) report(12, "local", what + "; on this machine that says nothing about the owner's server");
    else if (control !== "open") report(12, "here", "a direct connection to the address's own port gives \"" + control + "\", so a silence of 8000 and 8443 would prove nothing (" + what + "); run this from a computer that can reach the server directly");
    else if (open.length) report(12, "fail", what, "step 0 of the guide: in the Supabase folder's .env bind " + open.map(p => p === "8443" ? "KONG_HTTPS_PORT=127.0.0.1:8443" : "the gateway's http port to 127.0.0.1:8000").join(" and ") + ", then docker compose up -d");
    else if (Object.values(gw).some(v => v.startsWith("unknown"))) report(12, "here", what + ": cannot be answered from this machine");
    else report(12, "pass", what);
  }
  // 13. https and a valid certificate
  {
    if (base.protocol !== "https:") {
      if (LOCAL) report(13, "local", "the address is http on this machine; the real one must be https with a valid certificate");
      else report(13, "fail", "the address is not https", "step 1 of the guide: a certificate for the name (certbot, or Caddy's own)");
    } else {
      const r = await request("GET", base.origin + "/auth/v1/health", { headers: keyHeaders(), timeout: 5000 });
      if (!r.error) report(13, "pass", "https with a certificate the system trusts" + (PROXY ? " (as seen through this machine's proxy)" : ""));
      else report(13, "fail", "https failed: " + r.error, "renew or fix the certificate (step 1)");
    }
  }
  const P = results.filter(x => x === "pass").length, F = results.filter(x => x === "fail").length, L = results.filter(x => x === "local").length;
  const H = results.filter(x => x === "here").length;
  console.log("RESULT smoke: " + P + " passed, " + F + " failed, " + L + " only on the real Supabase" + (H ? ", " + H + " not answerable from this machine" : ""));
  process.exit(F ? 1 : 0);
})().catch(e => { console.log("FAIL the smoke test stopped: " + (e.stack || e.message)); process.exit(1); });
