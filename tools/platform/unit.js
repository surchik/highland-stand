#!/usr/bin/env node
// The platform's pure checks in Node, no browser (docs/specs/platform.final.md 10.4). Under a second.
//
//   node tools/platform/unit.js [index.html]
//
// Two kinds of subject:
// 1. The page's pure code. PF-MAIN keeps it between two marker lines,
//      // ==== PLATFORM PURE BEGIN ====      and      // ==== PLATFORM PURE END ====
//    and ends that block with  const PF_PURE = { sha256, pkceChallenge, nameCheck, scoreOf, dailyOf, Cloud, EvQueue };
//    (only what exists yet). unit.js runs the block alone and holds each name it finds to the tables below:
//      sha256, pkceChallenge  (P2)  the FIPS 180-4 vectors and RFC 7636's own verifier and challenge
//      nameCheck              (P2)  ref.NAME_CASES, the same table sql-tests.js holds the server's rule to
//      scoreOf                (P5)  ref.SCORE_CASES and ref.LOST_CASES, the same table the server is held to
//      dailyOf                (P6)  ref.dailyOf for every day of a year, three pool sizes, skips included
//      Cloud.merge            (P3)  its own cases (written with P3: a key with no rule is carried through, a
//                                   document of a newer format is left alone, a bare removal of hs_run writes no
//                                   mark, "flag", the per-key "newer", the run rule's six)
//      EvQueue                (P4)  the queue's limits (written with P4)
//    A name the page does not have yet is listed as waiting for its package, not failed.
// 2. What exists today: the reference arithmetic both the page and the server are held to (ref.js), checked
//    against the spec's own numbers, and the stack's PKCE and JWT code (stack.js) checked against RFC 7636 and
//    against forgery and expiry.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const ref = require("./ref");
const stack = require("./stack");

let total = 0, failed = 0;
const ok = (c, what) => { total++; if (c !== true) { failed++; console.log("FAIL " + what); } };
const eq = (a, b, what) => { const x = JSON.stringify(a), y = JSON.stringify(b); ok(x === y, what + (x === y ? "" : " (got " + x + ", wanted " + y + ")")); };
const waiting = [];

// ---------------------------------------------------------------- the vectors
const SHA = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
  ["Արամ", null],   // non-ASCII: compared with Node's own
  ["x".repeat(1000), null],
];
const RFC7636 = { verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" };

// ---------------------------------------------------------------- 2. what exists today
// the reference arithmetic against the spec's own numbers
eq(ref.scoreOf({ won: true, lives: 20, waves: 10, sim_sec: 600, spent: 900, earned: 3000 }, { waves: 10, lives: 20, fast: 300, slow: 900 }), 8800,
  "5.1's example: 4000 + 3000 + 750 + 1050 = 8,800");
for (const c of ref.SCORE_CASES) {
  eq(ref.scoreOf(c.stats, ref.SCORE_BOUNDS), c.score, "reference score: " + c.what);
  eq(ref.starsOf(c.stats, ref.SCORE_BOUNDS), c.stars, "reference stars: " + c.what);
  ok(c.score >= 4000 && c.score <= 10000, "a win is worth 4,000 to 10,000: " + c.what);
}
for (const c of ref.LOST_CASES) eq(ref.scoreOf({ won: false, waves: c.cleared }, { waves: 12 }), c.score, "a lost daily with " + c.cleared + " of 12 cleared (RULINGS S3)");
ok(ref.scoreOf({ won: false, waves: 11 }, { waves: 12 }) < 4000, "a lost daily is under any win");
eq([ref.kOf(17), ref.jOf(6), ref.jOf(12), ref.kOf(10), ref.jOf(9)], [5, 5, 5, 7, 4], "5.6's steps: k for 17 is 5; j for 6 and 12 is 5");
for (const m of [6, 12]) {
  const d = { pool: Array.from({ length: 17 }, (_, i) => "b" + i), twists: Array.from({ length: m }, (_, i) => "t" + i) };
  const seen = new Set(); let rep = 0, prev = null;
  for (let day = 20000; day < 20000 + 2 * 17 * m; day++) {
    const p = ref.dailyOf(d, day);
    if (day < 20000 + 17 * m) seen.add(p.level + "/" + p.twist);
    if (prev && (prev.level === p.level || prev.twist === p.twist)) rep++;
    prev = p;
  }
  ok(seen.size === 17 * m, "the daily: 17 x " + m + " days meet every pair once");
  ok(rep === 0, "the daily: no battlefield or twist two days running (17 x " + m + ")");
}
{
  const d = { pool: ["a", "b"], twists: ["x", "y", "z"], skip: { a: ["x", "y"] } };
  let bad = 0; for (let day = 0; day < 365; day++) { const p = ref.dailyOf(d, day); if (p.level === "a" && p.twist !== "z") bad++; }
  ok(bad === 0, "the daily: a skipped twist is walked past");
}
for (const [n, want, what] of ref.NAME_CASES) { const r = ref.nameClean(n); eq(r.error || r.name, want, "reference name rule: " + what); }
eq([ref.nameFold("A r.a_m"), ref.nameFold("Ar4m"), ref.nameFold("$ystem")], ["aram", "aram", "system"], "folding: spaces, dots, dashes and the look-alike digits");
// the stack's PKCE: RFC 7636's own verifier and challenge, and the page's verifier shape (64 random bytes as hex)
eq(stack.challengeOf(RFC7636.verifier), RFC7636.challenge, "RFC 7636 appendix B: the S256 challenge of its verifier");
{
  const v = crypto.randomBytes(64).toString("hex");
  ok(v.length === 128 && /^[0-9a-f]+$/.test(v), "the page's verifier is 128 characters: inside the server's 43 to 128");
  ok(/^[A-Za-z0-9_-]{43}$/.test(stack.challengeOf(v)), "its challenge is 43 base64url characters");
}
// the stack's JWT: a forged signature and an expired token are refused
{
  const secret = crypto.randomBytes(32), t = stack.signJwt(secret, { sub: "x", role: "authenticated", exp: 2000 });
  ok(stack.verifyJwt(secret, t, 1000).claims.sub === "x", "a token signed with the stack's secret is read");
  eq(stack.verifyJwt(crypto.randomBytes(32), t, 1000).error, "invalid", "a token signed with another secret is refused");
  eq(stack.verifyJwt(secret, t, 2000).error, "expired", "an expired token is refused");
  const [h, b] = t.split(".");
  const forged = h + "." + Buffer.from(JSON.stringify({ sub: "x", role: "service_role", exp: 2000 })).toString("base64url") + "." + t.split(".")[2];
  eq(stack.verifyJwt(secret, forged, 1000).error, "invalid", "claims changed after signing are refused");
  eq(stack.verifyJwt(secret, "e30." + b + ".", 1000).error, "invalid", "an unsigned token is refused");
}
// gameplay's battle facts must stay under 3 KB as JSON (the server keeps 4,096 bytes as jsonb, RULINGS S8)
{
  const worst = { lv: "stepanakert", diff: 2, mode: "campaign", ruleset: "2", rev: 1, loadout: "std", wave: 20, waves: 20, lives: 999999, lives_max: 999999, held: 999999,
    lives_board: 999999, stars: 3, sec: 999999, spent: 999999, earned: 999999, twist: null, through: "cavalry:3,spearman:2,raider:1,shield:4,archer:9,siege:2,tank:1",
    road: 0, legacy: false, resumed: 0, build: "2026-11-09", kitset: 1, ch: "republic", script: 20, beyond: 0, lost: 999999, returned: 999999, debt: 999999 };
  ok(JSON.stringify(worst).length < 3000, "a battle's contract fields at six figures fit under 3 KB");
}

// ---------------------------------------------------------------- 1. the page's pure code
const page = path.resolve(process.argv[2] || path.join(__dirname, "..", "..", "index.html"));
const src = fs.readFileSync(page, "utf8");
const B = src.indexOf("// ==== PLATFORM PURE BEGIN ===="), E = src.indexOf("// ==== PLATFORM PURE END ====");
const SUBJECTS = [["sha256", "P2"], ["pkceChallenge", "P2"], ["nameCheck", "P2"], ["scoreOf", "P5"], ["dailyOf", "P6"], ["Cloud", "P3"], ["EvQueue", "P4"]];
let pure = null;
if (B < 0 || E < B) {
  for (const [n, p] of SUBJECTS) waiting.push(n + " (" + p + ")");
} else {
  const code = src.slice(B, E) + "\n;globalThis.__pure = (typeof PF_PURE === 'object' && PF_PURE) || null;";
  const ctx = vm.createContext({ console, TextEncoder, Uint8Array, Uint32Array, Math, JSON, Date });
  try { vm.runInContext(code, ctx, { filename: "PLATFORM PURE", timeout: 2000 }); pure = ctx.__pure; } catch (e) { ok(false, "the PLATFORM PURE block runs alone in Node: " + e.message); }
  if (pure === null) ok(false, "the PLATFORM PURE block ends with const PF_PURE = { ... }");
  for (const [n, p] of SUBJECTS) if (!pure || !(n in pure)) waiting.push(n + " (" + p + ")");
}
if (pure) {
  if (pure.sha256) for (const [m, want] of SHA) {
    const w = want || crypto.createHash("sha256").update(m, "utf8").digest("hex");
    eq(String(pure.sha256(m)).toLowerCase(), w, "the page's sha256 of " + JSON.stringify(m.slice(0, 20)));
  }
  if (pure.pkceChallenge) eq(pure.pkceChallenge(RFC7636.verifier), RFC7636.challenge, "the page's PKCE challenge of RFC 7636's verifier");
  if (pure.nameCheck) for (const [n, want, what] of ref.NAME_CASES) {
    const r = pure.nameCheck(n);
    const got = typeof r === "string" ? r : r && (r.error || r.name);
    eq(got, want, "the page's name rule agrees with the server's: " + what);
  }
  if (pure.scoreOf) {
    for (const c of ref.SCORE_CASES) eq(pure.scoreOf(c.stats, ref.SCORE_BOUNDS), c.score, "the page's scoreOf: " + c.what);
    for (const c of ref.LOST_CASES) eq(pure.scoreOf({ won: false, waves: c.cleared }, { waves: 12 }), c.score, "the page's scoreOf: a lost daily, " + c.cleared + " of 12");
  }
  if (pure.dailyOf) for (const d of [
    { pool: Array.from({ length: 17 }, (_, i) => "b" + i), twists: ["thin", "swift", "iron", "few", "quiet", "noballista"], skip: { b3: ["few"] } },
    { pool: Array.from({ length: 5 }, (_, i) => "b" + i), twists: Array.from({ length: 12 }, (_, i) => "t" + i), skip: {} },
    { pool: ["a", "b", "c"], twists: ["x", "y"], skip: {} }]) {
    d.k = ref.kOf(d.pool.length); d.j = ref.jOf(d.twists.length);
    let bad = 0; for (let day = 20400; day < 20765; day++) { const a = pure.dailyOf(d, day), b = ref.dailyOf(d, day); if (a.level !== b.level || a.twist !== b.twist) bad++; }
    ok(bad === 0, "the page's daily equals the server's for a year (" + d.pool.length + " x " + d.twists.length + ")");
  }
}

console.log("unit.js: " + (pure ? "the page's PLATFORM PURE block found" : "no PLATFORM PURE block in " + path.basename(page) + " yet"));
if (waiting.length) console.log("waiting for their packages: " + waiting.join(", "));
console.log("RESULT unit: " + total + " checks, " + failed + " failed" + (waiting.length ? ", " + waiting.length + " subjects not in the page yet" : ""));
process.exit(failed ? 1 : 0);
