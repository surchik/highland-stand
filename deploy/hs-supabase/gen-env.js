#!/usr/bin/env node
// Makes or completes the stack's .env, and checks its keys. Used by install.sh; safe to run again.
//
//   node gen-env.js <path to .env>            adds every key that is missing; never changes one that is there
//   node gen-env.js --verify <path to .env>   checks the two API keys against the JWT secret
//
// It prints the NAMES of what it added and the public claims of the two keys. It never prints a value of a secret.
//
// Why not Supabase's own utils/generate-keys.sh: that script prints every secret it makes to the terminal (by
// design) and writes ten values this slim stack has no use for. This does the same signing with Node's crypto:
// HS256 over base64url(header).base64url(payload) with the JWT secret, claims role, iss "supabase", iat, exp.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const b64u = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const sign = (secret, payload) => {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + b64u(JSON.stringify(payload));
  return head + "." + b64u(crypto.createHmac("sha256", secret).update(head).digest());
};
// -> the payload when the token is an HS256 JWT signed with the secret, else null
const verify = (secret, token) => {
  const p = String(token).split(".");
  if (p.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(p[0], "base64url").toString("utf8"));
    if (header.alg !== "HS256") return null;
    const want = crypto.createHmac("sha256", secret).update(p[0] + "." + p[1]).digest();
    const got = Buffer.from(p[2], "base64url");
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    return JSON.parse(Buffer.from(p[1], "base64url").toString("utf8"));
  } catch (e) { return null; }
};
const unquote = (v) => (/^'.*'$/.test(v) || /^".*"$/.test(v)) ? v.slice(1, -1) : v;
function parse(text) {
  const m = new Map();
  for (const line of text.split(/\r?\n/)) {
    const x = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (x) m.set(x[1], unquote(x[2]));
  }
  return m;
}
const hex = (n) => crypto.randomBytes(n).toString("hex");   // hex: safe inside a postgres:// address and a .env
const YEARS = 10;
const label = (s) => s === "s" ? " (secret, made here)" : s === "p" ? " (made here; public by design)" : "";

// the keys in the order they are written. s: a secret made here; p: made here and public; the others are settings
function wanted(have) {
  const jwt = have.get("JWT_SECRET") || hex(32);
  // issued a minute ago, so a server whose clock is a little behind this one never sees a key "from the future"
  const iat = Math.floor(Date.now() / 1000) - 60, exp = iat + YEARS * 365 * 24 * 3600;
  return [
    ["#", "Highland Stand's own Supabase (the slim stack: db, auth, rest, gateway). Made by install.sh."],
    ["#", "SECRETS: never print, paste or commit this file. Only ANON_KEY and the address are public."],
    ["POSTGRES_PASSWORD", hex(32), "s"],
    ["JWT_SECRET", jwt, "s"],
    ["ANON_KEY", sign(jwt, { role: "anon", iss: "supabase", iat, exp }), "p"],
    ["SERVICE_ROLE_KEY", sign(jwt, { role: "service_role", iss: "supabase", iat, exp }), "s"],
    ["DASHBOARD_USERNAME", "supabase"],
    ["DASHBOARD_PASSWORD", hex(24), "s"],
    ["#", "Addresses"],
    ["SUPABASE_PUBLIC_URL", "https://hs-db.avunjian.com"],
    ["API_EXTERNAL_URL", "https://hs-db.avunjian.com/auth/v1"],
    ["SITE_URL", "https://highland.avunjian.com"],
    ["ADDITIONAL_REDIRECT_URLS", "https://highland.avunjian.com/**,https://highland.avunjian.com/next/**"],
    ["#", "Auth: providers only. No email, phone or anonymous sign-up, no mail, no hooks."],
    ["JWT_EXPIRY", "3600"],
    ["DISABLE_SIGNUP", "false"],
    ["ENABLE_EMAIL_SIGNUP", "false"],
    ["ENABLE_EMAIL_AUTOCONFIRM", "false"],
    ["ENABLE_ANONYMOUS_USERS", "false"],
    ["ENABLE_PHONE_SIGNUP", "false"],
    ["ENABLE_PHONE_AUTOCONFIRM", "false"],
    ["#", "The API"],
    ["PGRST_DB_SCHEMAS", "public,graphql_public,highland"],
    ["PGRST_DB_MAX_ROWS", "1000"],
    ["PGRST_DB_EXTRA_SEARCH_PATH", "public"],
    ["#", "Sign-in providers: set by providers.sh (never by hand on a command line)"],
    ["GOOGLE_ENABLED", "false"], ["GOOGLE_CLIENT_ID", ""], ["GOOGLE_SECRET", ""],
    ["FACEBOOK_ENABLED", "false"], ["FACEBOOK_CLIENT_ID", ""], ["FACEBOOK_SECRET", ""],
    ["DISCORD_ENABLED", "false"], ["DISCORD_CLIENT_ID", ""], ["DISCORD_SECRET", ""],
  ];
}

function check(have) {
  const jwt = have.get("JWT_SECRET");
  const out = [];
  if (!jwt || jwt.length < 32) return { ok: false, lines: ["JWT_SECRET is missing or shorter than 32 characters"] };
  let ok = true;
  for (const [name, role] of [["ANON_KEY", "anon"], ["SERVICE_ROLE_KEY", "service_role"]]) {
    const p = have.has(name) ? verify(jwt, have.get(name)) : null;
    if (!p) { ok = false; out.push(name + ": NOT signed with this JWT_SECRET (or missing)"); continue; }
    const good = p.role === role && p.iss === "supabase" && Number.isInteger(p.exp) && p.exp * 1000 > Date.now();
    if (!good) ok = false;
    out.push(name + ": signature ok, role " + JSON.stringify(p.role) + ", iss " + JSON.stringify(p.iss) + ", expires " +
      new Date(p.exp * 1000).toISOString().slice(0, 10) + (good ? "" : "  (NOT what is expected)"));
  }
  return { ok, lines: out };
}

function main() {
  const argv = process.argv.slice(2);
  const verifyOnly = argv[0] === "--verify";
  const file = verifyOnly ? argv[1] : argv[0];
  if (!file) { console.error("usage: node gen-env.js [--verify] <path to .env>"); process.exit(2); }
  const exists = fs.existsSync(file);
  const have = exists ? parse(fs.readFileSync(file, "utf8")) : new Map();
  if (verifyOnly) {
    if (!exists) { console.error("no such file: " + file); process.exit(1); }
    const r = check(have);
    r.lines.forEach(l => console.log("  " + l));
    process.exit(r.ok ? 0 : 1);
  }
  // an existing key pair that does not match the existing secret is never papered over
  if (have.has("JWT_SECRET") && (have.has("ANON_KEY") || have.has("SERVICE_ROLE_KEY"))) {
    const r = check(new Map([...have, ...["ANON_KEY", "SERVICE_ROLE_KEY"].filter(k => !have.has(k)).map(k => [k, ""])]));
    const bad = r.lines.filter((l, i) => have.has(["ANON_KEY", "SERVICE_ROLE_KEY"][i]) && /NOT/.test(l));
    if (bad.length) { console.error("the .env's keys do not match its JWT_SECRET; nothing was changed:"); bad.forEach(l => console.error("  " + l)); process.exit(1); }
  }
  if (!have.has("JWT_SECRET") && (have.has("ANON_KEY") || have.has("SERVICE_ROLE_KEY"))) {
    console.error("the .env has an API key but no JWT_SECRET; nothing was changed"); process.exit(1);
  }
  const rows = wanted(have);
  const added = [];
  let text;
  if (!exists) {
    text = rows.map(([k, v]) => k === "#" ? "\n# " + v : k + "=" + v).join("\n").replace(/^\n/, "") + "\n";
    rows.forEach(([k, , s]) => { if (k !== "#") added.push(k + label(s)); });
  } else {
    const missing = rows.filter(([k]) => k !== "#" && !have.has(k));
    if (!missing.length) { console.log("  the .env is complete: nothing added, nothing changed"); return; }
    const old = fs.readFileSync(file, "utf8");
    text = old + (old.endsWith("\n") ? "" : "\n") + "\n# added by install.sh on " + new Date().toISOString() + "\n" +
      missing.map(([k, v]) => k + "=" + v).join("\n") + "\n";
    missing.forEach(([k, , s]) => added.push(k + label(s)));
  }
  const tmp = path.join(path.dirname(file), ".env.new." + process.pid);
  fs.writeFileSync(tmp, text, { mode: 0o600, flag: "wx" });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
  console.log("  " + (exists ? "added to" : "wrote") + " " + file + " (mode 600): " + added.length + " keys");
  added.forEach(k => console.log("    " + k));
}
module.exports = { sign, verify, parse };
if (require.main === module) main();
