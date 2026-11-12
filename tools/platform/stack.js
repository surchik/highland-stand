#!/usr/bin/env node
// The local stack (docs/specs/platform.final.md 10.1): everything the real Supabase gives the page, on this
// machine, so the page and its tests can be run against something that enforces the same rules.
//
//   node tools/platform/stack.js [--api-port=N] [--site-port=N] [--page=DIR] [--next=DIR] [--handoff] [--narrow] [--schemas=a,b]
//                                [--no-clock] [--verbose]
//
// or from a test:  const stack = await require("./stack").start({ page: dir });  ...  await stack.stop();
//
// What it runs:
// - PostgreSQL 16 (pgtemp.js: a throwaway cluster under /var/tmp/hs-stack, removed at the end) with the stand-ins
//   for Supabase's roles and auth schema (standins.sql), the migrations (deploy/supabase/migrations, applied by
//   migrate.js as postgres; deploy/supabase/optional/handoff.up.sql with --handoff), and the test clock
//   (test-clock.sql).
// - On the API port, the address the page calls (HS_SUPABASE_URL):
//   - a stand-in for PostgREST at POST /rest/v1/rpc/<function> and at /rest/v1/<table> (GET, POST, PATCH,
//     DELETE). Every call runs as PostgREST runs it: on a connection logged in as "authenticator", in one
//     transaction, after "set local role anon|authenticated|service_role" and the JWT's claims set as
//     request.jwt.claims, read-only for a stable function and for a GET, under the role's statement timeout (3 s
//     for a visitor, 8 s for a player) unless the function carries its own. So the database's grants and row
//     level security decide, as on the real service. Errors come back as PostgREST sends them:
//     { code, details, hint, message } with 400 for P0001, 401 or 403 for 42501, 429 for PT429.
//     The schemas it serves are PGRST_DB_SCHEMAS' (opts.schemas, --schemas, or the environment variable; by
//     default "public,graphql_public,reqstream,highland", as the shared server will have them once highland is
//     added). As PostgREST does, it reads the schema of a call from Accept-Profile (GET, HEAD) or Content-Profile
//     (POST, PATCH, PUT, DELETE), takes the first in the list (public) when there is none, and answers a schema
//     not in the list 406 with PGRST106. So a call without the page's two headers looks for the game in public,
//     and finds nothing there.
//   - a stand-in for Supabase Auth (GoTrue) at /auth/v1: settings, health, authorize (PKCE, and the implicit flow
//     when no challenge is given), callback, token (pkce, refresh_token with rotation), user, logout.
//     authorize and callback need no apikey, the others do, as on Supabase's gateway.
//   - CORS as the gateway answers it (the page's origin is the site port, so it is a real cross-origin call),
//     the preflight remembered for an hour as the Envoy gateway does. Like Supabase's Kong (its cors plugin has no
//     header list), it allows the headers a preflight asks for, so the page's Accept-Profile and Content-Profile
//     pass as they do on the real gateway.
//   - By default the port serves the whole API, as the shared server's gateway does (https://db.avunjian.com
//     exposes all of /rest/v1, /auth/v1 and the rest): /rest/v1/<table> is answered by the database itself, which
//     refuses the game's tables, and Auth's routes that make accounts or send mail (signup, otp, recover,
//     magiclink, token with a password, a write to user) answer 200 as an open GoTrue would, without doing
//     anything. --narrow (or opts.narrow, or the control "narrow") serves only what the old dedicated layout's
//     public name served (publicName below): the six Auth routes the page uses (settings, authorize, callback,
//     token for pkce and refresh_token, user to read, logout) plus health, and /rest/v1/rpc/hs_; everything else
//     404 (and a write to /auth/v1/user 403, as nginx's limit_except). So a test can show both walls. (--wide is
//     still accepted and changes nothing.)
//   - a fake OAuth provider at /provider/ (on the real thing this is Google, Facebook or Discord): a page of test
//     people, or an identity a test chooses beforehand, including one with no email, one with an unverified
//     email, a cancel, an error and one that never answers.
//   - controls for tests under /__test/ (see CONTROLS below).
// - On the site port, the game itself as the live web root holds it: index.html and og.jpg of the page directory
//   at / and at /next/ and nothing else of it (read from disk on every request, so a test always plays the file
//   as it is), with the paths read as nginx reads them: any other path is the page (try_files ... /index.html),
//   and a missing og.jpg is 404.
//
// The JWT secret is made at start from random bytes, lives in this process only and is never written to disk
// or to the log. The anon key printed at start is signed with it and is worth nothing once the stack stops.
// Nothing listens anywhere but 127.0.0.1.
"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pgtemp = require("./pgtemp");

const ROOT = path.resolve(__dirname, "..", "..");
const ACCESS_TTL = 3600;         // seconds an access token lives (Supabase's JWT_EXPIRY default)
const CODE_TTL = 300;            // a sign-in's code, and its flow state, last five minutes
const REUSE_WINDOW = 10;         // a used refresh token still works for 10 seconds
const BODY_MAX = 512 * 1024;     // the guide's proxy limit

// ------------------------------------------------------------------ small helpers
const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const b64uJson = (o) => b64u(JSON.stringify(o));
const fromB64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
function signJwt(secret, claims) {
  const head = b64uJson({ alg: "HS256", typ: "JWT" }), body = b64uJson(claims);
  const sig = b64u(crypto.createHmac("sha256", secret).update(head + "." + body).digest());
  return head + "." + body + "." + sig;
}
// { claims } or { error: "invalid" | "expired" }
function verifyJwt(secret, token, nowSec) {
  const p = String(token || "").split(".");
  if (p.length !== 3) return { error: "invalid" };
  let head, claims;
  try { head = JSON.parse(fromB64u(p[0])); claims = JSON.parse(fromB64u(p[1])); } catch (e) { return { error: "invalid" }; }
  if (!head || head.alg !== "HS256") return { error: "invalid" };
  const want = crypto.createHmac("sha256", secret).update(p[0] + "." + p[1]).digest();
  const got = fromB64u(p[2]);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { error: "invalid" };
  if (typeof claims.exp === "number" && claims.exp <= nowSec) return { error: "expired", claims };
  return { claims };
}
// RFC 7636: the S256 challenge of a verifier
const challengeOf = (verifier) => b64u(crypto.createHash("sha256").update(verifier, "ascii").digest());
const rand = (n) => b64u(crypto.randomBytes(n));

function sendJson(res, status, obj, headers) {
  const body = obj === undefined ? "" : JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...(headers || {}) });
  res.end(body);
}
function redirect(res, to) { res.writeHead(302, { location: to, "cache-control": "no-store" }); res.end(); }
// add query parameters to an address, keeping what it has (as GoTrue adds code= to the return address)
function withQuery(addr, params, alsoFragment) {
  const u = new URL(addr);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (alsoFragment) u.hash = new URLSearchParams(params).toString();
  return u.toString();
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    // over the limit the rest is read and thrown away, so the 413 answer reaches the caller as nginx's does
    // (a connection cut short would read as a network error instead)
    let over = false;
    const tooLarge = () => { over = true; chunks.length = 0; reject(Object.assign(new Error("too large"), { status: 413 })); };
    if (Number(req.headers["content-length"]) > BODY_MAX) tooLarge();
    req.on("data", c => { if (over) return; n += c.length; if (n > BODY_MAX) tooLarge(); else chunks.push(c); });
    req.on("end", () => { if (!over) resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ------------------------------------------------------------------ the fake provider's people
const PEOPLE = {
  aram: { label: "Aram (Google, a verified email)", provider_id: "g-1001", email: "aram@example.com", verified: true, name: "Aram" },
  bagrat: { label: "Bagrat (a verified email)", provider_id: "g-1002", email: "bagrat@example.com", verified: true, name: "Bagrat" },
  nune: { label: "Nune (a verified email)", provider_id: "g-1003", email: "nune@example.com", verified: true, name: "Nune" },
  "fb-noemail": { label: "A Facebook account with no email", provider_id: "fb-2001", email: null, verified: false, name: "No Email" },
  "discord-unverified": { label: "A Discord account with an unverified email", provider_id: "d-3001", email: "aram@example.com", verified: false, name: "Takeover" },
  cancel: { label: "Cancel (the player says no)", error: "access_denied", description: "The user denied the request" },
  error: { label: "Provider error", error: "server_error", description: "The provider failed" },
  hang: { label: "A provider that never answers", hang: true },
};

// ------------------------------------------------------------------ the stack
async function start(opts = {}) {
  const verbose = !!opts.verbose;
  const log = (...a) => { if (verbose) console.log("[stack]", ...a); };
  // opts.attach = { host, port, database }: a database already there (the restore rehearsal's restored copy, with the
  // stand-ins and the game's schema), served as it is and left in place at the end; else a throwaway one of our own
  let db, dbName = "hs";
  if (opts.attach) {
    const P = pgtemp.needPg();
    const a = opts.attach;
    dbName = a.database;
    db = { dir: a.host, port: a.port, attached: true,
      pool: (database, user, max) => new P.Pool({ host: a.host, port: a.port, user, database, max: max || 10 }),
      client: async (database, user) => { const c = new P.Client({ host: a.host, port: a.port, user: user || "supabase_admin", database: database || dbName }); await c.connect(); return c; },
      stop: async () => {} };
  } else {
    db = await pgtemp.start({ name: "stack" });
    try {
      await db.createDatabase("hs", { schema: true, handoff: !!opts.handoff, clock: opts.clock !== false });
    } catch (e) { await db.stop(); throw e; }
  }
  const api = db.pool(dbName, "authenticator", 12);
  const su = db.pool(dbName, "supabase_admin", 4);
  const secret = crypto.randomBytes(48);            // made here, kept here, never written
  const state = {
    auth: "up", rest: "up", narrow: opts.narrow === true,
    clock: "", authClock: 0,
    settings: { mailer_autoconfirm: false, external: { google: true, facebook: true, discord: true }, email_optional: { facebook: true, discord: true } },
    allow: [],                // ADDITIONAL_REDIRECT_URLS globs
    flows: new Map(),         // flow state id -> { provider, challenge, method, redirect_to, created }
    pcodes: new Map(),        // the provider's codes -> { person, flow }
    codes: new Map(),         // auth codes -> { user, provider, flow, created }
    sessions: new Map(),      // session id -> { user, provider, refresh, used: Map(token -> at), revoked, notBefore }
    refresh: new Map(),       // refresh token -> session id
    nextPerson: [],           // identities a test chose for the next sign-ins
    hanging: new Set(),
  };
  const nowSec = () => Math.floor(Date.now() / 1000) + state.authClock;
  const anonKey = signJwt(secret, { iss: "supabase", ref: "local-stack", role: "anon", iat: nowSec(), exp: nowSec() + 10 * 365 * 86400 });
  // the service key, as the gateway knows one: never printed, never given to the page; a test may use it (through
  // stack.serviceKey) to show the database refuses it the game's tables and functions too
  const serviceKey = signJwt(secret, { iss: "supabase", ref: "local-stack", role: "service_role", iat: nowSec(), exp: nowSec() + 10 * 365 * 86400 });
  // PostgREST's db-schemas: the first is the default when a call names none
  const SCHEMAS = String(opts.schemas || process.env.PGRST_DB_SCHEMAS || "public,graphql_public,reqstream,highland")
    .split(",").map(x => x.trim()).filter(Boolean);

  // ---------------------------------------------------------------- servers
  const apiServer = http.createServer((req, res) => handleApi(req, res).catch(e => {
    log("error", e.stack || e.message);
    if (!res.headersSent) sendJson(res, e.status || 500, { message: e.status === 413 ? "Request body too large" : "stack error: " + e.message });
  }));
  const siteServer = http.createServer((req, res) => handleSite(req, res));
  await new Promise((r, j) => { apiServer.once("error", j); apiServer.listen(opts.apiPort || 0, "127.0.0.1", r); });
  await new Promise((r, j) => { siteServer.once("error", j); siteServer.listen(opts.sitePort || 0, "127.0.0.1", r); });
  const url = "http://127.0.0.1:" + apiServer.address().port;
  const site = "http://127.0.0.1:" + siteServer.address().port;
  const SITE_URL = site;

  // ---------------------------------------------------------------- the page
  const pageDir = path.resolve(opts.page || ROOT), nextDir = path.resolve(opts.next || opts.page || ROOT);
  const TYPES = { ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".js": "text/javascript",
    ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
  function serveFile(res, file) {
    fs.readFile(file, (e, buf) => {
      if (e) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
      res.end(buf);
    });
  }
  function handleSite(req, res) {
    // as nginx reads a path: decoded, doubled slashes merged; then try_files $uri $uri/ /index.html
    let p;
    try { p = decodeURIComponent(new URL(req.url, site).pathname); } catch (e) { res.writeHead(400); res.end(); return; }
    p = p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    if (p.split("/").includes("..")) { res.writeHead(400); res.end(); return; }
    // the web root holds index.html and og.jpg, and next/ the same two: nothing else of the folder is served
    // (the repository's .git, tools and docs are not on the live server)
    let dir = pageDir, rel = p;
    if (/^\/next(\/|$)/.test(p)) { dir = nextDir; rel = p.slice(5) || "/"; }
    serveFile(res, path.join(dir, rel === "/og.jpg" ? "og.jpg" : "index.html"));
  }

  // ---------------------------------------------------------------- CORS, as the gateway answers it
  function cors(req, res) {
    const origin = req.headers.origin;
    res.setHeader("access-control-allow-origin", origin || "*");
    if (origin) res.setHeader("vary", "Origin");
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("access-control-expose-headers", "content-range, x-supabase-api-version");
  }

  // ---------------------------------------------------------------- the API port
  async function handleApi(req, res) {
    const u = new URL(req.url, url);
    const p = u.pathname.replace(/\/{2,}/g, "/");
    cors(req, res);
    if (verbose) log(req.method, p);
    if (p.startsWith("/__test/")) return control(req, res, p.slice(8));
    if (p.startsWith("/provider/")) return provider(req, res, u, p.slice(10));
    if (state.narrow) {
      const refused = publicName(req.method, p, u);
      if (refused) { res.writeHead(refused, { "content-type": "text/plain" }); res.end(refused === 403 ? "Forbidden" : "Not found"); return; }
    }
    if (req.method === "OPTIONS") {
      // Supabase's Kong runs its cors plugin with no header list, which allows the headers the preflight asks for:
      // the page's apikey, authorization, content-type and the two profile headers pass, as there
      res.writeHead(200, {
        "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
        "access-control-allow-headers": req.headers["access-control-request-headers"] || "*",
        "access-control-max-age": "3600",
      });
      res.end();
      return;
    }
    if (p.startsWith("/auth/v1/")) {
      if (state.auth === "hang") return hang(req, res);
      if (state.auth === "down") return sendJson(res, 503, { message: "An invalid response was received from the upstream server" });
      return auth(req, res, u, p.slice(8));
    }
    if (p.startsWith("/rest/v1/")) {
      if (state.rest === "hang") return hang(req, res);
      if (state.rest === "down") return sendJson(res, 503, { message: "An invalid response was received from the upstream server" });
      if (!keyOk(req, res)) return;
      const schema = profileOf(req, res);
      if (!schema) return;
      if (p.startsWith("/rest/v1/rpc/") && req.method === "POST") return rpc(req, res, schema, decodeURIComponent(p.slice(13)));
      if (p.startsWith("/rest/v1/rpc/")) return sendJson(res, 405, { code: "PGRST101", details: null, hint: null, message: "Only POST is used for functions here" });
      if (p === "/rest/v1/" || p === "/rest/v1") return sendJson(res, 200, { swagger: "2.0", info: { description: "the stack does not describe the schema" } });
      if (["GET", "HEAD", "POST", "PATCH", "DELETE"].includes(req.method)) return table(req, res, schema, decodeURIComponent(p.slice(9)), u);
      return sendJson(res, 405, { code: "PGRST117", details: null, hint: null, message: "Unsupported HTTP method" });
    }
    res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found");
  }
  // what the guide's public name lets through (deploy/supabase/README.md, step 1): 0, or the status it refuses with
  function publicName(method, p, u) {
    if (/^\/auth\/v1\/(settings|authorize|callback|logout|health)$/.test(p)) return 0;
    if (p === "/auth/v1/user") return ["GET", "HEAD", "OPTIONS"].includes(method) ? 0 : 403;
    if (p === "/auth/v1/token") return /^(pkce|refresh_token)$/.test(u.searchParams.get("grant_type") || "") ? 0 : 404;
    if (p.startsWith("/rest/v1/rpc/hs_")) return 0;
    return 404;
  }
  function hang(req, res) {
    state.hanging.add(res);
    res.on("close", () => state.hanging.delete(res));
  }
  // the gateway's key check: the anon key (or the service key) in the apikey header (or, as Kong also allows, ?apikey=)
  function keyOk(req, res) {
    const k = req.headers.apikey || new URL(req.url, url).searchParams.get("apikey");
    if (!k) { sendJson(res, 401, { message: "No API key found in request" }); return false; }
    if (k !== anonKey && k !== serviceKey) { sendJson(res, 401, { message: "Invalid authentication credentials" }); return false; }
    return true;
  }
  // PostgREST's schema for a call: Accept-Profile for GET and HEAD, Content-Profile for the others; none: the first
  // of db-schemas. One that is not served: 406, PGRST106. Returns the schema, or null with the answer sent
  function profileOf(req, res) {
    const h = ["GET", "HEAD"].includes(req.method) ? req.headers["accept-profile"] : req.headers["content-profile"];
    if (h === undefined || h === "") return SCHEMAS[0];
    if (!SCHEMAS.includes(h)) {
      sendJson(res, 406, { code: "PGRST106", details: null, hint: null, message: "The schema must be one of the following: " + SCHEMAS.join(", ") });
      return null;
    }
    return h;
  }
  // the caller as PostgREST sees him: { role, claims } or an answer already sent
  function caller(req, res, forRest) {
    const h = req.headers.authorization || "";
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) return { role: "anon", claims: { role: "anon" } };
    const v = verifyJwt(secret, m[1], nowSec());
    const fail = (status, code, message) => { sendJson(res, status, forRest ? { code, details: null, hint: null, message } : { code: status, error_code: "bad_jwt", msg: message }); return null; };
    if (v.error === "invalid") return fail(401, "PGRST301", "JWSError JWSInvalidSignature");
    if (v.error === "expired") return fail(401, "PGRST303", "JWT expired");
    const c = v.claims;
    if (c.session_id) {
      const s = state.sessions.get(c.session_id);
      if (s && s.notBefore && c.iat < s.notBefore) return fail(401, "PGRST303", "JWT expired");
    }
    if (!["anon", "authenticated", "service_role"].includes(c.role)) return fail(401, "PGRST301", "the stack knows the roles anon, authenticated and service_role only");
    return { role: c.role, claims: c };
  }

  // ---------------------------------------------------------------- PostgREST: functions
  async function functionsNamed(schema, fn) {
    const rows = (await su.query(`select p.oid, p.proname, p.proargnames as names, p.pronargs as nargs, p.pronargdefaults as ndef, p.provolatile as vol,
        array(select format_type(t, null) from unnest(p.proargtypes) t) as types, p.proconfig as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $2 and p.proname = $1`, [fn, schema])).rows;
    return rows;
  }
  async function rpc(req, res, schema, fn) {
    const who = caller(req, res, true);
    if (!who) return;
    let body;
    try { const t = await readBody(req); body = t.trim() ? JSON.parse(t) : {}; } catch (e) {
      if (e.status === 413) throw e;
      return sendJson(res, 400, { code: "PGRST102", details: null, hint: null, message: "Empty or invalid json" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return sendJson(res, 400, { code: "PGRST102", details: null, hint: null, message: "the arguments must be a JSON object" });
    const keys = Object.keys(body);
    const notFound = () => sendJson(res, 404, { code: "PGRST202", details: "Searched for the function " + schema + "." + fn + " with parameters " + keys.join(", ") + " or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
      hint: null, message: "Could not find the function " + schema + "." + fn + "(" + keys.join(", ") + ") in the schema cache" });
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(fn)) return notFound();
    const cands = await functionsNamed(schema, fn);
    const f = cands.find(c => {
      const names = c.names || [];
      if (!keys.every(k => names.includes(k))) return false;
      const required = names.slice(0, c.nargs - c.ndef);
      return required.every(k => keys.includes(k));
    });
    if (!f) return notFound();
    const vals = [], parts = [];
    keys.forEach((k, i) => {
      const t = f.types[f.names.indexOf(k)];
      let v = body[k];
      if (t === "jsonb" || t === "json") v = JSON.stringify(v);
      else if (t.endsWith("[]")) v = Array.isArray(v) ? v : v;
      else if (v !== null && typeof v === "object") v = JSON.stringify(v);
      else if (v !== null) v = String(v);
      vals.push(v);
      parts.push(pgtemp.quoteIdent(k) + " => $" + (i + 1) + "::" + t);
    });
    const readOnly = f.vol === "s" || f.vol === "i";
    const own = (f.config || []).find(x => x.startsWith("statement_timeout="));
    const timeout = own ? own.split("=")[1] : (who.role === "anon" ? "3s" : "8s");   // (service_role: Supabase sets none; 8 s here)
    const c = await api.connect();
    try {
      await c.query(readOnly ? "begin isolation level read committed read only" : "begin isolation level read committed");
      await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.method', 'POST', true), set_config('hs_test.clock', $2, true), set_config('statement_timeout', $3, true)",
        [JSON.stringify(who.claims), state.clock, timeout]);
      await c.query("set local role " + who.role);
      const r = await c.query("select " + pgtemp.quoteIdent(schema) + "." + pgtemp.quoteIdent(fn) + "(" + parts.join(", ") + ") as r", vals);
      await c.query("commit");
      const out = r.rows[0].r;
      return sendJson(res, 200, out === undefined ? null : out);
    } catch (e) {
      await c.query("rollback").catch(() => {});
      return pgError(res, e, who.role);
    } finally { c.release(); }
  }
  // PostgREST's error answer
  function pgError(res, e, role) {
    const code = e.code || "XX000";
    let status = 400;
    if (code === "42501") status = role === "anon" ? 401 : 403;
    else if (/^PT\d\d\d$/.test(code)) status = Number(code.slice(2));
    else if (code === "P0001") status = 400;
    else if (code === "25006") status = 405;
    else if (code === "57014") status = 500;
    else if (code === "42883" || code === "42P01") status = 404;
    else if (/^23/.test(code)) status = 409;
    else if (/^(22|42)/.test(code)) status = 400;
    else if (!e.code) status = 500;
    sendJson(res, status, { code, details: e.detail || null, hint: e.hint || null, message: e.message });
  }
  // ---------------------------------------------------------------- PostgREST: a table (GET, POST, PATCH, DELETE)
  // As PostgREST builds them: GET selects (?select=a,b and filters), POST inserts the body's object or list, PATCH
  // updates with the body's columns, DELETE deletes; filters are col=op.value with eq, neq, gt, gte, lt, lte, is.
  // A PATCH or DELETE with no filter is sent with no WHERE, as PostgREST sends it (pg-safeupdate refuses it where
  // it is loaded). The database's grants and policies decide, as on the real service.
  const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
  async function table(req, res, schema, name, u) {
    const who = caller(req, res, true);
    if (!who) return;
    const missing = () => sendJson(res, 404, { code: "PGRST205", details: null, hint: null, message: "Could not find the table '" + schema + "." + name + "' in the schema cache" });
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name)) return missing();
    const exists = (await su.query("select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = $1 and c.relname = $2 and c.relkind in ('r', 'v', 'm', 'p', 'f')", [schema, name])).rows.length;
    if (!exists) return missing();
    let body = null;
    if (["POST", "PATCH"].includes(req.method)) {
      try { const t = await readBody(req); body = t.trim() ? JSON.parse(t) : {}; } catch (e) {
        if (e.status === 413) throw e;
        return sendJson(res, 400, { code: "PGRST102", details: null, hint: null, message: "Empty or invalid json" });
      }
    }
    const q = pgtemp.quoteIdent, rel = q(schema) + "." + q(name), vals = [], where = [];
    const col = (c) => { if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(c)) throw Object.assign(new Error("bad column " + c), { code: "42703" }); return q(c); };
    let cols = "*";
    try {
      for (const [k, v] of u.searchParams) {
        if (k === "select") { cols = v === "*" ? "*" : v.split(",").map(col).join(", "); continue; }
        if (["limit", "offset", "order", "apikey", "columns", "on_conflict"].includes(k)) continue;
        const m = /^(eq|neq|gt|gte|lt|lte|is)\.(.*)$/.exec(v);
        if (!m) throw Object.assign(new Error("unknown filter " + v), { code: "PGRST100" });
        if (m[1] === "is") { where.push(col(k) + (m[2] === "null" ? " is null" : m[2] === "true" ? " is true" : " is false")); continue; }
        vals.push(m[2]); where.push(col(k) + "::text " + OPS[m[1]] + " $" + vals.length);
      }
      let sql;
      const w = where.length ? " where " + where.join(" and ") : "";
      if (req.method === "GET" || req.method === "HEAD") sql = "select " + cols + " from " + rel + w + " limit " + Math.min(Number(u.searchParams.get("limit")) || 1000, 1000);
      else if (req.method === "DELETE") sql = "delete from " + rel + w + " returning *";
      else {
        const rows = Array.isArray(body) ? body : [body];
        if (!rows.length || rows.some(r => !r || typeof r !== "object")) return sendJson(res, 400, { code: "PGRST102", details: null, hint: null, message: "the body must be an object or a list of objects" });
        const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
        if (req.method === "PATCH") {
          const set = keys.map(k => { vals.push(rows[0][k] !== null && typeof rows[0][k] === "object" ? JSON.stringify(rows[0][k]) : rows[0][k]); return col(k) + " = $" + vals.length; });
          if (!set.length) return sendJson(res, 400, { code: "PGRST102", details: null, hint: null, message: "nothing to update" });
          sql = "update " + rel + " set " + set.join(", ") + w + " returning *";
        } else {
          const tuples = rows.map(r => "(" + keys.map(k => { vals.push(r[k] !== null && typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k]); return "$" + vals.length; }).join(", ") + ")");
          sql = "insert into " + rel + (keys.length ? " (" + keys.map(col).join(", ") + ") values " + tuples.join(", ") : " default values") + " returning *";
        }
      }
      const c = await api.connect();
      try {
        const ro = req.method === "GET" || req.method === "HEAD";
        await c.query(ro ? "begin isolation level read committed read only" : "begin isolation level read committed");
        await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.method', $3, true), set_config('statement_timeout', $2, true)",
          [JSON.stringify(who.claims), who.role === "anon" ? "3s" : "8s", req.method]);
        await c.query("set local role " + who.role);
        const r = await c.query(sql, vals);
        await c.query("commit");
        const prefer = String(req.headers.prefer || "");
        if (req.method === "GET" || req.method === "HEAD") return sendJson(res, 200, r.rows);
        if (/return=representation/.test(prefer)) return sendJson(res, req.method === "POST" ? 201 : 200, r.rows);
        res.writeHead(req.method === "POST" ? 201 : 204); res.end(); return;
      } catch (e) {
        await c.query("rollback").catch(() => {});
        throw e;
      } finally { c.release(); }
    } catch (e) {
      if (e.code === "42P01") return missing();
      if (e.code === "PGRST100") return sendJson(res, 400, { code: "PGRST100", details: null, hint: null, message: e.message });
      return pgError(res, e, who.role);
    }
  }

  // ---------------------------------------------------------------- Auth (GoTrue)
  const authErr = (res, status, error_code, msg) => sendJson(res, status, { code: status, error_code, msg });
  async function auth(req, res, u, route) {
    const open = route === "/authorize" || route === "/callback";
    if (!open && !keyOk(req, res)) return;
    if (route === "/health") return sendJson(res, 200, { version: "stack", name: "GoTrue", description: "the local stack's stand-in for Supabase Auth" });
    if (route === "/settings" && req.method === "GET") {
      const ext = { anonymous_users: false, apple: false, azure: false, bitbucket: false, discord: !!state.settings.external.discord, email: false,
        facebook: !!state.settings.external.facebook, figma: false, github: false, gitlab: false, google: !!state.settings.external.google, keycloak: false,
        kakao: false, linkedin_oidc: false, notion: false, phone: false, slack_oidc: false, spotify: false, twitch: false, twitter: false, workos: false, zoom: false };
      return sendJson(res, 200, { external: ext, disable_signup: false, mailer_autoconfirm: !!state.settings.mailer_autoconfirm, phone_autoconfirm: false, sms_provider: "", saml_enabled: false });
    }
    if (route === "/authorize" && req.method === "GET") return authorize(req, res, u);
    if (route === "/callback" && req.method === "GET") return callback(req, res, u);
    if (route === "/token" && req.method === "POST") return token(req, res, u);
    if (route === "/user" && req.method === "GET") return user(req, res);
    if (route === "/logout" && req.method === "POST") return logout(req, res, u);
    // the routes an open GoTrue serves that the page never uses: they make accounts, sign in by password or send
    // mail and texts. The stand-in answers as an open one would and does nothing, so a test can show the public
    // name refuses them (the stack's narrow default, or the guide's nginx in front of --wide)
    if ((["/signup", "/otp", "/recover", "/magiclink"].includes(route) && req.method === "POST")
        || (route === "/user" && req.method === "PUT")) {
      return sendJson(res, 200, { stand_in: true, msg: "an open Supabase Auth would act on " + req.method + " " + route + " here" });
    }
    return authErr(res, 404, "not_found", "Not found");
  }
  function allowedRedirect(to) {
    try {
      const t = new URL(to), s = new URL(SITE_URL);
      if (t.protocol === s.protocol && t.host === s.host) return to;
      for (const g of state.allow) {
        const re = new RegExp("^" + g.split("**").map(x => x.split("*").map(y => y.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join(".*") + "$");
        if (re.test(to)) return to;
      }
    } catch (e) {}
    return SITE_URL;
  }
  function authorize(req, res, u) {
    const provider = u.searchParams.get("provider");
    if (!provider || !(provider in state.settings.external)) return authErr(res, 400, "validation_failed", "Unsupported provider: Provider " + provider + " could not be found");
    if (!state.settings.external[provider]) return authErr(res, 400, "validation_failed", "Unsupported provider: Provider is not enabled");
    const challenge = u.searchParams.get("code_challenge");
    const method = (u.searchParams.get("code_challenge_method") || "").toLowerCase();
    if (challenge !== null) {
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(challenge)) return authErr(res, 400, "validation_failed", "code challenge has to be between 43 and 128 characters");
      if (method !== "s256" && method !== "plain") return authErr(res, 400, "validation_failed", "code challenge method not supported");
    }
    const flow = rand(18);
    state.flows.set(flow, { provider, challenge, method, redirect_to: allowedRedirect(u.searchParams.get("redirect_to") || SITE_URL), created: nowSec() });
    redirect(res, url + "/provider/authorize?" + new URLSearchParams({ provider, state: flow, redirect_uri: url + "/auth/v1/callback" }));
  }
  // the provider sends the player back here; Auth then sends him to the game with ?code= (or with the error)
  async function callback(req, res, u) {
    const flowId = u.searchParams.get("state"), flow = flowId && state.flows.get(flowId);
    const fail = (to, error, error_code, description) => redirect(res, withQuery(to, { error, error_code, error_description: description }, true));
    if (!flow) return fail(SITE_URL, "invalid_request", "bad_oauth_state", "OAuth state parameter missing");
    state.flows.delete(flowId);
    if (nowSec() - flow.created > CODE_TTL) return fail(SITE_URL, "invalid_request", "bad_oauth_state", "OAuth state has expired");
    if (u.searchParams.get("error")) return fail(flow.redirect_to, u.searchParams.get("error"), u.searchParams.get("error"), u.searchParams.get("error_description") || "");
    const pc = state.pcodes.get(u.searchParams.get("code") || "");
    if (!pc || pc.flow !== flowId) return fail(flow.redirect_to, "server_error", "unexpected_failure", "Unable to exchange external code");
    state.pcodes.delete(u.searchParams.get("code"));
    const person = pc.person;
    const verified = !!person.verified || !!state.settings.mailer_autoconfirm;
    if (!person.email && !state.settings.email_optional[flow.provider]) return fail(flow.redirect_to, "server_error", "unexpected_failure", "Error getting user email from external provider");
    if (person.email && !verified) return fail(flow.redirect_to, "access_denied", "provider_email_needs_verification", "Unverified email with " + flow.provider);
    // find the person by this provider's id; else link to an account with the same verified email; else a new one
    let uid = (await su.query("select user_id from auth.identities where provider = $1 and provider_id = $2", [flow.provider, person.provider_id])).rows[0];
    uid = uid && uid.user_id;
    if (!uid && person.email) {
      const r = (await su.query("select id from auth.users where lower(email) = lower($1)", [person.email])).rows[0];
      uid = r && r.id;
    }
    if (!uid) {
      uid = (await su.query("insert into auth.users (email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values ($1, now(), $2, $3) returning id",
        [person.email || null, JSON.stringify({ provider: flow.provider, providers: [flow.provider] }), JSON.stringify({ name: person.name, full_name: person.name })])).rows[0].id;
    }
    await su.query(`insert into auth.identities (provider, provider_id, user_id, email, identity_data) values ($1, $2, $3, $4, $5)
      on conflict (provider_id, provider) do nothing`, [flow.provider, person.provider_id, uid, person.email || null, JSON.stringify({ sub: person.provider_id, name: person.name, email: person.email })]);
    await su.query(`update auth.users set last_sign_in_at = now(), raw_app_meta_data = jsonb_build_object('provider', coalesce(raw_app_meta_data->>'provider', $2::text),
      'providers', (select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = $1)) where id = $1`, [uid, flow.provider]);
    await su.query("insert into auth.audit_log_entries (payload, ip_address) values ($1, '127.0.0.1')",
      [JSON.stringify({ actor_id: uid, actor_username: person.email, action: "login", log_type: "account", traits: { provider: flow.provider } })]);
    if (!flow.challenge) {   // the implicit flow: the tokens in the fragment (the page never uses it)
      const s = newSession(uid, flow.provider);
      const t = tokensFor(s);
      return redirect(res, flow.redirect_to.split("#")[0] + "#" + new URLSearchParams({ access_token: t.access_token, expires_at: t.expires_at, expires_in: t.expires_in,
        refresh_token: t.refresh_token, token_type: "bearer", type: "" }).toString());
    }
    const code = crypto.randomUUID();
    state.codes.set(code, { user: uid, provider: flow.provider, challenge: flow.challenge, method: flow.method, created: nowSec() });
    redirect(res, withQuery(flow.redirect_to, { code }, false));
  }
  function newSession(uid, provider) {
    const id = crypto.randomUUID();
    const s = { id, user: uid, provider, refresh: null, used: new Map(), revoked: false, notBefore: 0 };
    state.sessions.set(id, s);
    return s;
  }
  function tokensFor(s) {
    const iat = nowSec(), exp = iat + ACCESS_TTL;
    const rt = rand(12);
    if (s.refresh) s.used.set(s.refresh, iat);
    s.refresh = rt; state.refresh.set(rt, s.id);
    s.access = signJwt(secret, { aud: "authenticated", exp, iat, iss: url + "/auth/v1", sub: s.user, role: "authenticated", aal: "aal1",
      amr: [{ method: "oauth", timestamp: iat }], session_id: s.id, is_anonymous: false, app_metadata: { provider: s.provider, providers: [s.provider] } });
    return { access_token: s.access, token_type: "bearer", expires_in: ACCESS_TTL, expires_at: exp, refresh_token: rt };
  }
  async function userJson(uid) {
    const u = (await su.query("select * from auth.users where id = $1", [uid])).rows[0];
    if (!u) return null;
    const ids = (await su.query("select provider, provider_id, identity_data, created_at from auth.identities where user_id = $1", [uid])).rows;
    return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email || "", email_confirmed_at: u.email_confirmed_at, phone: "",
      confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at, app_metadata: u.raw_app_meta_data, user_metadata: u.raw_user_meta_data,
      identities: ids.map(i => ({ identity_id: i.provider + ":" + i.provider_id, id: i.provider_id, user_id: u.id, identity_data: i.identity_data, provider: i.provider, created_at: i.created_at })),
      created_at: u.created_at, updated_at: u.updated_at, is_anonymous: false };
  }
  async function token(req, res, u) {
    const grant = u.searchParams.get("grant_type");
    // a password sign-in: an open GoTrue would answer it; the stand-in only says so (see auth() above)
    if (grant === "password") return sendJson(res, 200, { stand_in: true, msg: "an open Supabase Auth would sign in by password here" });
    let body;
    try { body = JSON.parse((await readBody(req)) || "{}"); } catch (e) { return authErr(res, 400, "bad_json", "Could not parse request body as JSON"); }
    if (grant === "pkce") {
      const { auth_code, code_verifier } = body || {};
      if (!auth_code || !code_verifier) return authErr(res, 400, "validation_failed", "invalid request: both auth code and code verifier should be non-empty");
      const c = state.codes.get(auth_code);
      if (!c) return authErr(res, 404, "flow_state_not_found", "invalid flow state, no valid flow state found");
      if (nowSec() - c.created > CODE_TTL) { state.codes.delete(auth_code); return authErr(res, 400, "flow_state_expired", "invalid flow state, flow state has expired"); }
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(code_verifier)) return authErr(res, 400, "validation_failed", "code verifier should be at least 43 characters and at most 128");
      const ok = c.method === "plain" ? code_verifier === c.challenge : challengeOf(code_verifier) === c.challenge;
      if (!ok) return authErr(res, 403, "bad_code_verifier", "code challenge does not match previously saved code verifier");
      state.codes.delete(auth_code);   // a code works once
      const uj = await userJson(c.user);
      if (!uj) return authErr(res, 404, "user_not_found", "User not found");
      const s = newSession(c.user, c.provider);
      return sendJson(res, 200, { ...tokensFor(s), user: uj, provider_token: "stack-provider-token-" + rand(8), provider_refresh_token: "stack-provider-refresh-" + rand(8) });
    }
    if (grant === "refresh_token") {
      const rt = body && body.refresh_token;
      if (!rt) return authErr(res, 400, "validation_failed", "refresh_token required");
      const sid = state.refresh.get(rt), s = sid && state.sessions.get(sid);
      if (!s || s.revoked) return authErr(res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      const uj = await userJson(s.user);
      if (!uj) return authErr(res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      if (rt !== s.refresh) {
        const usedAt = s.used.get(rt);
        if (usedAt !== undefined && nowSec() - usedAt <= REUSE_WINDOW) {
          // used again within ten seconds (another tab): the session's current pair
          return sendJson(res, 200, { ...currentTokens(s), user: uj });
        }
        s.revoked = true;   // used again later: the whole session ends
        return authErr(res, 400, "refresh_token_already_used", "Invalid Refresh Token: Already Used");
      }
      return sendJson(res, 200, { ...tokensFor(s), user: uj });
    }
    return authErr(res, 400, "unsupported_grant_type", "unsupported_grant_type");
  }
  function currentTokens(s) {
    const v = verifyJwt(secret, s.access, nowSec());
    const exp = v.claims ? v.claims.exp : nowSec();
    return { access_token: s.access, token_type: "bearer", expires_in: Math.max(0, exp - nowSec()), expires_at: exp, refresh_token: s.refresh };
  }
  async function user(req, res) {
    const who = caller(req, res, false);
    if (!who) return;
    if (who.role !== "authenticated") return authErr(res, 403, "bad_jwt", "invalid claim: missing sub claim");
    const s = state.sessions.get(who.claims.session_id);
    if (!s || s.revoked) return authErr(res, 403, "session_not_found", "Session from session_id claim in JWT does not exist");
    const uj = await userJson(who.claims.sub);
    if (!uj) return authErr(res, 403, "user_not_found", "User from sub claim in JWT does not exist");
    return sendJson(res, 200, uj);
  }
  async function logout(req, res, u) {
    const who = caller(req, res, false);
    if (!who) return;
    if (who.role !== "authenticated") return authErr(res, 403, "bad_jwt", "invalid claim: missing sub claim");
    const scope = u.searchParams.get("scope") || "global";
    for (const s of state.sessions.values()) {
      if (s.user !== who.claims.sub) continue;
      if (scope === "local" && s.id !== who.claims.session_id) continue;
      if (scope === "others" && s.id === who.claims.session_id) continue;
      s.revoked = true;
    }
    res.writeHead(204); res.end();
  }

  // ---------------------------------------------------------------- the fake provider
  function provider(req, res, u, route) {
    const flow = u.searchParams.get("state"), back = u.searchParams.get("redirect_uri");
    if (!flow || !back || !back.startsWith(url + "/auth/v1/callback")) { res.writeHead(400); res.end("bad request"); return; }
    let person = null;
    if (route === "authorize" && state.nextPerson.length) person = state.nextPerson.shift();
    else if (route === "pick") person = PEOPLE[u.searchParams.get("who")] || null;
    if (!person) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Test provider</title>" +
        "<h1>Sign in to " + esc(u.searchParams.get("provider") || "") + " (the stack's test provider)</h1><ul>" +
        Object.entries(PEOPLE).map(([k, v]) => "<li><a id='who-" + esc(k) + "' href='/provider/pick?" + esc(new URLSearchParams({ state: flow, redirect_uri: back, who: k }).toString()) + "'>" + esc(v.label) + "</a></li>").join("") +
        "</ul>");
      return;
    }
    if (person.hang) return hang(req, res);
    if (person.error) return redirect(res, withQuery(back, { state: flow, error: person.error, error_description: person.description || "" }));
    const code = rand(16);
    state.pcodes.set(code, { person, flow });
    redirect(res, withQuery(back, { state: flow, code }));
  }

  // ---------------------------------------------------------------- controls for tests
  // POST /__test/<name> with a JSON body; each answers the state that matters to it.
  const CONTROLS = {
    // Auth and PostgREST: "up", "down" (503) or "hang" (no answer at all)
    auth: async (b) => { state.auth = b.mode || "up"; return { auth: state.auth }; },
    rest: async (b) => { state.rest = b.mode || "up"; return { rest: state.rest }; },
    // the database's clock moved by an interval ("1 day", "-90 seconds"); "" for the real one
    clock: async (b) => { state.clock = typeof b.offset === "number" ? b.offset + " seconds" : (b.offset || ""); return { clock: state.clock }; },
    // the Auth service's clock moved by seconds (codes, flow states, token lifetimes)
    authclock: async (b) => { state.authClock = Number(b.seconds) || 0; return { authClock: state.authClock }; },
    // a user's sessions' access tokens taken as expired (all users without user_id)
    expire: async (b) => { let n = 0; for (const s of state.sessions.values()) if (!b.user_id || s.user === b.user_id) { s.notBefore = nowSec() + 1; n++; } return { sessions: n }; },
    // a run's start moved back by seconds (the SQL test's trick for a score's wall-clock check)
    runback: async (b) => {
      const r = await su.query(`update highland.hs_runs set started_at = started_at - make_interval(secs => $1)
        where ($2::uuid is null or id = $2::uuid) and ($3::uuid is null or user_id = $3::uuid) and finished_at is null`, [Number(b.seconds) || 600, b.run_id || null, b.user_id || null]);
      return { runs: r.rowCount };
    },
    // the database emptied: every player, visit, run, score and ruleset gone; the switches back to their start
    reset: async () => {
      await su.query(`truncate highland.hs_events, highland.hs_sessions, highland.hs_score_best, highland.hs_scores, highland.hs_runs, highland.hs_saves, highland.hs_profiles,
        highland.hs_admins, highland.hs_rulesets, highland.hs_rate cascade`);
      if (opts.handoff) await su.query("truncate highland.hs_handoff");
      await su.query("delete from highland.hs_config where key not in ('ev_cap_hour', 'ev_max_mb', 'ev_keep_days')");
      await su.query("update highland.hs_config set value = case key when 'ev_cap_hour' then '20000'::jsonb when 'ev_max_mb' then '1024'::jsonb else '180'::jsonb end where key in ('ev_cap_hour', 'ev_max_mb', 'ev_keep_days')");
      await su.query("delete from auth.audit_log_entries; delete from auth.users");
      for (const m of [state.flows, state.pcodes, state.codes, state.sessions, state.refresh]) m.clear();
      state.nextPerson.length = 0; state.clock = ""; state.authClock = 0;
      return { ok: true };
    },
    // what /settings answers: { mailer_autoconfirm, external: { google, facebook, discord }, email_optional: {...} }
    settings: async (b) => {
      if ("mailer_autoconfirm" in b) state.settings.mailer_autoconfirm = !!b.mailer_autoconfirm;
      if (b.external) Object.assign(state.settings.external, b.external);
      if (b.email_optional) Object.assign(state.settings.email_optional, b.email_optional);
      return state.settings;
    },
    // the next sign-in's person: { who: "aram" | "cancel" | ... } or { identity: { provider_id, email, verified, name } }
    provider: async (b) => {
      const p = b.identity ? { label: "custom", ...b.identity } : PEOPLE[b.who];
      if (!p) throw Object.assign(new Error("no such person: " + b.who), { status: 400 });
      state.nextPerson.push(p);
      return { queued: state.nextPerson.length };
    },
    // ADDITIONAL_REDIRECT_URLS
    redirects: async (b) => { state.allow = Array.isArray(b.allow) ? b.allow.slice() : []; return { allow: state.allow }; },
    // serve only the two prefixes (the guide's proxy), or the whole API
    narrow: async (b) => { state.narrow = b.on !== false; return { narrow: state.narrow }; },
    // make an account an admin (the guide's one line of SQL, step 6)
    admin: async (b) => { await su.query("insert into highland.hs_admins (user_id) values ($1) on conflict do nothing", [b.user_id]); return { ok: true }; },
    // read the database as its superuser, read-only (a test reads back what the page stored)
    query: async (b) => {
      const c = await su.connect();
      try {
        await c.query("begin read only");
        await c.query("select set_config('hs_test.clock', $1, true)", [state.clock]);
        const r = await c.query(b.sql, b.params || []);
        await c.query("commit");
        return { rows: r.rows };
      } catch (e) { await c.query("rollback").catch(() => {}); throw Object.assign(e, { status: 400 }); } finally { c.release(); }
    },
    state: async () => ({ auth: state.auth, rest: state.rest, narrow: state.narrow, clock: state.clock, authClock: state.authClock,
      sessions: [...state.sessions.values()].filter(s => !s.revoked).length, settings: state.settings }),
  };
  async function control(req, res, name) {
    if (req.method === "OPTIONS") { res.writeHead(200, { "access-control-allow-methods": "POST,GET,OPTIONS", "access-control-allow-headers": "*" }); res.end(); return; }
    const fn = CONTROLS[name];
    if (!fn) return sendJson(res, 404, { error: "no control " + name, controls: Object.keys(CONTROLS) });
    let b = {};
    try { const t = await readBody(req); b = t.trim() ? JSON.parse(t) : {}; } catch (e) { return sendJson(res, 400, { error: "bad json" }); }
    try { return sendJson(res, 200, await fn(b)); } catch (e) { return sendJson(res, e.status || 500, { error: e.message }); }
  }

  const stack = {
    url, site, anonKey, db, schemas: SCHEMAS,
    // for tests only: a token signed with the stack's secret (the secret itself never leaves this process), and the
    // service key a gateway would accept
    sign: (claims) => signJwt(secret, claims), serviceKey,
    // the same controls, from the test's own process
    control: (name, body) => CONTROLS[name](body || {}),
    query: async (sql, params) => (await CONTROLS.query({ sql, params })).rows,
    async stop() {
      for (const r of state.hanging) { try { r.destroy(); } catch (e) {} }
      await new Promise(r => apiServer.close(r)); await new Promise(r => siteServer.close(r));
      apiServer.closeAllConnections && apiServer.closeAllConnections();
      siteServer.closeAllConnections && siteServer.closeAllConnections();
      await api.end().catch(() => {}); await su.end().catch(() => {});
      await db.stop();
    },
  };
  return stack;
}

module.exports = { start, signJwt, verifyJwt, challengeOf, PEOPLE };

if (require.main === module) {
  const arg = (k) => { const a = process.argv.find(x => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : undefined; };
  const flag = (k) => process.argv.includes("--" + k);
  start({ apiPort: Number(arg("api-port")) || 0, sitePort: Number(arg("site-port")) || 0, page: arg("page"), next: arg("next"),
    handoff: flag("handoff"), narrow: flag("narrow"), schemas: arg("schemas"), clock: !flag("no-clock"), verbose: flag("verbose") }).then(stack => {
    console.log("STACK READY");
    console.log("  Supabase address (HS_SUPABASE_URL): " + stack.url);
    console.log("  anon key (HS_SUPABASE_ANON_KEY):    " + stack.anonKey);
    console.log("  the game:                           " + stack.site + "/  and  " + stack.site + "/next/");
    console.log("  PostgREST serves (db-schemas):      " + stack.schemas.join(",") + "  (the game: Accept-Profile / Content-Profile: highland)");
    console.log("  test provider and controls:         " + stack.url + "/provider/  " + stack.url + "/__test/<control>");
    console.log("  the database, as the migrating role: psql -h " + stack.db.dir + " -p " + stack.db.port + " -U postgres hs");
    console.log("  (a throwaway key: signed with a secret made at start that lives in this process only)");
    let stopping = false;
    const stop = () => { if (stopping) return; stopping = true; stack.stop().then(() => process.exit(0)); };
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
  }).catch(e => { console.error("the stack could not start: " + (e.stack || e.message)); process.exit(1); });
}
