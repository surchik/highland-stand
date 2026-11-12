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
//      inAppUA, providersOf,  (P2)  the sign-in card's own rules: which user agents are another app's browser (1.6),
//      signinLine                   which provider buttons show for what Auth's /settings answers (3.3, RULINGS D3,
//                                   D6), and the line after a sign-in that did not finish, by the server's code (1.2)
//      errWord                (P2)  signin_error's error: the server's kind of word kept, free text sent as "other"
//      scoreOf                (P5)  ref.SCORE_CASES and ref.LOST_CASES, the same table the server is held to
//      dailyOf                (P6)  ref.dailyOf for every day of a year, three pool sizes, skips included
//      Cloud.merge            (P3)  its own cases (written with P3: a key with no rule is carried through, a
//                                   document of a newer format is left alone, a bare removal of hs_run writes no
//                                   mark, "flag", the per-key "newer", the run rule's six)
//      EvQueue, evBytes,      (P4)  the events' queue: sizes as the server counts them, the limits of 7.4, batches
//      evDevice, EV_BOT_UA          filled by bytes, the waits after a failure, three refusals; p_ctx's words; robots
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
const SUBJECTS = [["sha256", "P2"], ["pkceChallenge", "P2"], ["nameCheck", "P2"], ["inAppUA", "P2"], ["providersOf", "P2"], ["signinLine", "P2"], ["errWord", "P2"], ["scoreOf", "P5"], ["dailyOf", "P6"], ["Cloud", "P3"], ["EvQueue", "P4"]];
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
  // the page's own SHA-256 against Node's on random verifiers of the page's own shape (and, below, against the Web
  // Crypto API's crypto.subtle, which a secure page also has)
  if (pure.pkceChallenge) {
    let bad = 0;
    for (let i = 0; i < 50; i++) {
      const v = crypto.randomBytes(64).toString("hex");
      if (pure.pkceChallenge(v) !== stack.challengeOf(v)) bad++;
    }
    ok(bad === 0, "the page's PKCE challenge equals Node's for 50 random verifiers");
  }
  if (pure.b64url) for (const n of [0, 1, 2, 3, 31, 32, 33, 64]) {
    const b = crypto.randomBytes(n);
    eq(pure.b64url(new Uint8Array(b)), b.toString("base64url"), "the page's base64url of " + n + " bytes");
  }
  if (pure.inAppUA) {
    const IN = ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.18.110",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36 musical_ly_2023",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/290.0 Mobile/15E148 Safari/604.1"];
    const OUT = ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", ""];
    for (const u of IN) ok(pure.inAppUA(u) === true, "an in-app browser is seen: " + u.slice(-40));
    for (const u of OUT) ok(pure.inAppUA(u) === false, "a browser of its own is not taken for an in-app one: " + (u.slice(-40) || "(empty)"));
  }
  if (pure.providersOf) {
    const all = { external: { google: true, facebook: true, discord: true, email: false }, mailer_autoconfirm: false };
    eq(pure.providersOf(all, false), { list: ["google", "facebook", "discord"], held: "" }, "the three buttons, in order, when the server has all three on");
    eq(pure.providersOf({ ...all, mailer_autoconfirm: true }, false), { list: ["google", "facebook"], held: "d" }, "Discord held back while the server confirms emails itself (RULINGS D3)");
    eq(pure.providersOf({ external: { google: false, facebook: true, discord: true } }, false), { list: ["facebook", "discord"], held: "" }, "a provider switched off has no button (RULINGS D6)");
    eq(pure.providersOf(all, true), { list: ["facebook", "discord"], held: "" }, "no Google in an in-app browser");
    eq(pure.providersOf({ external: { discord: true }, mailer_autoconfirm: true }, false), { list: [], held: "d" }, "only Discord, held back: no button");
    eq(pure.providersOf({ external: { google: "true" } }, false), { list: [], held: "" }, "only a true switch counts");
    eq(pure.providersOf(null, false), { list: [], held: "" }, "no answer, no button");
  }
  if (pure.signinLine) {
    eq(pure.signinLine("provider_email_needs_verification", "discord"), "Discord says your email is not verified. Verify it there, then try again.", "the line for an unverified email names the provider");
    for (const c of ["bad_oauth_state", "flow_state_expired", "flow_state_not_found"]) eq(pure.signinLine(c, "google"), "Sign-in took too long. Try again.", "the line for " + c);
    eq(pure.signinLine("access_denied", "google", false), "Sign-in was canceled.", "the line for a cancel");
    eq(pure.signinLine("access_denied", "google", true), "Sign-in did not finish. Try again, or use another account.", "access_denied after a code is no cancel");
    eq(pure.signinLine("no_verifier"), "Sign-in did not finish here. Try again.", "the line for a return in another window");
    for (const c of ["server_error", "abandoned", "unexpected_failure", "", null]) eq(pure.signinLine(c, "facebook"), "Sign-in did not finish. Try again, or use another account.", "the line for " + JSON.stringify(c));
    ok(!/[\u2013\u2014]/.test(Object.values(PURE_LINES(pure)).join("")), "no long dash in the lines");
  }
  if (pure.errWord) {
    for (const w of ["access_denied", "provider_email_needs_verification", "exchange_403", "exchange_0", "no_verifier", "abandoned", "bad_oauth_state"]) eq(pure.errWord(w), w, "signin_error keeps the word " + w);
    for (const w of ["", null, undefined, "Hello World!", "<img src=x>", "a b", "Access_Denied", "x".repeat(41), "user@example.com"]) eq(pure.errWord(w), "other", "signin_error sends free text as other: " + JSON.stringify(w));
  }
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

// the events' queue (7.3, 7.4): sizes as the server counts them, the limits on the page, batching by bytes, the
// waits after a failure and the stop after three refusals
if (pure && pure.EvQueue) {
  const { EvQueue, EVQ, evBytes, evFlat, evShare, evDevice, EV_BOT_UA } = pure;
  // sizes: jsonb's text has a space after each comma and colon between values (none inside a string)
  eq(evBytes('{"a":1,"b":"x,y:z"}'), '{"a": 1, "b": "x,y:z"}'.length, "an event's size counts the spaces the database adds, not those inside a string");
  eq(evBytes('{"n":"Արամ"}'), Buffer.byteLength('{"n": "Արամ"}'), "an event's size counts UTF-8 bytes");
  eq(evBytes('{"e":"\\"a,b\\""}'), Buffer.byteLength('{"e": "\\"a,b\\""}'), "an escaped quote does not end a string");
  eq(evBytes(JSON.stringify({ x: "😀" })), Buffer.byteLength('{"x": "😀"}'), "a picture outside the first plane is 4 bytes");
  ok(evFlat({ a: 1, b: { c: 2 }, d: [1, 2] }) === true && evFlat({ a: { b: { c: 1 } } }) === false && evFlat({ a: [{ b: 1 }] }) === false, "one level of nesting, not two");
  const q = EvQueue({ sid: "visit-0001-aaaa" });
  eq([q.add("Bad Name", {}, 1), q.add("x", {}, 1), q.add("a".repeat(41), {}, 1)], ["name", "name", "name"], "a name the server would refuse is not kept");
  const cyc = {}; cyc.me = cyc;
  eq([q.add("victory", [1, 2], 1), q.add("victory", "text", 1), q.add("victory", cyc, 1)], ["type", "type", "type"], "props that are a list, a text or a cycle are not kept");
  eq(q.add("victory", { a: { b: { c: 1 } } }, 1), "deep", "props nested two levels are not kept (RULINGS S8)");
  const pad = (n) => ({ pad: "x".repeat(n - '{"pad": ""}'.length) });
  eq(evBytes(JSON.stringify(pad(4096))), 4096, "(a pad of 4,096 bytes as the server counts it)");
  eq([q.add("victory", pad(4096), 1), q.add("victory", pad(4097), 1)], ["ok", "size"], "props of 4,096 bytes kept, of 4,097 not (the server's limit)");
  eq(q.add("defeat", null, 2), "ok", "null props are kept, as an empty object (gameplay's trackFacts after a fault)");
  eq(q.list.map(e => e.q), [1, 2], "kept events are numbered 1, 2, ... in the visit");
  eq(q.list[1].p, {}, "null props are sent as {}");
  // the visit's 600, the battle's 40 tower events, the sample
  const v = EvQueue({ sid: "visit-0002-aaaa" });
  let kept = 0; for (let i = 0; i < 650; i++) if (v.add("map_open", { i }, i) === "ok") kept++;
  eq(kept, EVQ.visit, "600 events a visit");
  eq([v.add("hall_open", {}, 1), v.add("wave_end", {}, 1), v.add("victory", {}, 1), v.add("defeat", {}, 1), v.add("gate_shown", {}, 1), v.add("signed_in", {}, 1)],
    ["visit", "ok", "ok", "ok", "ok", "ok"], "past 600, wave_end, the battle's ends and the gate's events still kept");
  ok(v.list.length === EVQ.keep, "the queue holds 200 at most (" + v.list.length + ")");
  ok(v.list[v.list.length - 1].n === "signed_in" && v.list[0].q === v.seq - EVQ.keep + 1, "full: the oldest went first");
  const t = EvQueue({ sid: "visit-0003-aaaa" });
  const res = []; for (let i = 0; i < 45; i++) res.push(t.add(i % 2 ? "tower_built" : "tower_upgraded", { i }, i));
  eq(res.filter(x => x === "ok").length, 40, "40 tower events a battle");
  eq([t.add("plot_bought", {}, 1), t.add("tower_sold", {}, 1), t.add("wave_end", {}, 1)], ["battle", "battle", "ok"], "plots and sales count among them; a wave's end does not");
  t.add("battle_start", {}, 1);
  eq(t.add("tower_built", {}, 1), "ok", "a new battle has its own 40");
  t.sampleOut = true;
  eq([t.add("tower_built", {}, 1), t.add("wave_end", {}, 1), t.add("battle_start", {}, 1), t.add("gate_shown", {}, 1)], ["sample", "ok", "ok", "ok"],
    "outside the owner's sample: no tower events; battle and gate events still go");
  // the store's 60 KB
  const big = EvQueue({ sid: "visit-0004-aaaa" });
  for (let i = 0; i < 40; i++) big.add("victory", pad(3000), i);
  ok(big.bytes <= EVQ.keepBytes && big.list.length === Math.floor(EVQ.keepBytes / big.list[0].b), "the queue keeps 60 KB at most (" + big.list.length + " events of 3 KB, " + big.bytes + " bytes)");
  // batches: by count, by bytes, one visit each
  const bt = EvQueue({ sid: "visit-0005-aaaa" });
  for (let i = 0; i < 70; i++) bt.add("map_open", { i }, 1000);
  let b = bt.take(1000);
  eq([b.events.length, b.sid, b.events[0].q], [50, "visit-0005-aaaa", 1], "a batch takes 50 events at most, the oldest first");
  b = bt.take(1000);
  eq(b.events.length, 20, "the next batch takes the rest, not those still on their way");
  eq(bt.take(1000), null, "nothing left to take while both are on their way");
  const bb = EvQueue({ sid: "visit-0006-aaaa" });
  for (let i = 0; i < 40; i++) bb.add("victory", pad(1500), 1000);
  b = bb.take(1000);
  const body = JSON.stringify(b.events.map(e => ({ n: e.n, q: e.q, t: e.t, p: e.p })));
  ok(b.events.length < 40 && b.bytes <= EVQ.batchBytes && evBytes(body) <= 61440 - 1024, "a batch is filled by bytes: " + b.events.length + " events, " + evBytes(body) + " bytes as the server counts them (under 60 KB, room for p_ctx)");
  const left = EvQueue({ sid: "visit-0008-bbbb", from: [{ n: "page_load", q: 1, t: 5, p: {}, s: "visit-0007-aaaa" }, { n: "page_hide", q: 2, t: 9, p: { where: "map" }, s: "visit-0007-aaaa" }] });
  left.add("page_load", {}, 100000);
  b = left.take(100000);
  eq([b.sid, b.events.map(e => e.q)], ["visit-0007-aaaa", [1, 2]], "a batch is of one visit: an earlier visit's events go in their own");
  eq(left.take(100000).sid, "visit-0008-bbbb", "then this visit's");
  // when a batch is due
  const d = EvQueue({ sid: "visit-0009-aaaa" });
  eq(d.due(1000), Infinity, "nothing waiting: no batch due");
  d.add("page_load", {}, 1000);
  eq(d.due(1000), EVQ.wait, "20 s after the first unsent event");
  eq(d.due(15000), 6000, "(counted from that event)");
  for (let i = 0; i < 19; i++) d.add("map_open", {}, 2000);
  eq(d.due(2000), 0, "at once when 20 wait");
  eq(EvQueue({ sid: "visit-0010-aaaa", from: [{ n: "page_load", q: 1, t: 5, p: {}, s: "visit-0007-aaaa" }] }).due(1e12), 0, "an earlier visit's events: at once");
  // a failure waits 30 s, doubling to 10 minutes; a 2xx clears it
  const f = EvQueue({ sid: "visit-0011-aaaa" });
  f.add("page_load", {}, 0);
  const waits = [];
  let now = 1e9;
  for (let i = 0; i < 7; i++) { const x = f.take(now, true); f.done(x, i % 2 ? 503 : 0, now); waits.push((f.notBefore - now) / 1000); now += 1000; }
  eq(waits, [30, 60, 120, 240, 480, 600, 600], "offline or the service down: the next try after 30 s, doubling to 10 minutes");
  ok(f.list.length === 1 && f.take(now) === null && f.due(now) > 0, "the event is kept, and not tried again before its time");
  ok(!!f.take(now, true), "but it goes at once when the page leaves (force)");
  f.release(f.list.length ? { events: f.list } : { events: [] });
  const x = f.take(now, true); f.done(x, 200, now);
  ok(f.list.length === 0 && f.fails === 0 && f.notBefore === 0, "kept by the server: gone from the queue, and the wait cleared");
  // 429 and 408 (a busy gateway) are waited out like the network's failure: the batch is kept, never a refusal
  const g = EvQueue({ sid: "visit-0015-aaaa" });
  g.add("page_load", {}, 0);
  const gw = [];
  for (const st of [429, 408, 429, 429]) { const y = g.take(now, true); g.done(y, st, now); gw.push((g.notBefore - now) / 1000); }
  ok(g.list.length === 1 && g.unsent().length === 1 && !g.stopped && g.refused === 0, "429 and 408 keep the batch and never stop the sending");
  eq(gw, [30, 60, 120, 240], "and back off as a failure does");
  // three refusals in a row stop sending for the visit; one success between them resets the count
  const r = EvQueue({ sid: "visit-0012-aaaa" });
  for (let i = 0; i < 6; i++) r.add("page_load", { i }, 0);
  const one = () => { const y = r.take(now, true); y.events.splice(1); for (const e of r.list) if (!y.events.includes(e)) delete e.f; return y; };
  r.done(one(), 400, now); r.done(one(), 403, now); r.done(one(), 200, now); r.done(one(), 401, now); r.done(one(), 404, now);
  ok(!r.stopped && r.list.length === 1, "two refusals, a success, two refusals: still sending (refused batches are not sent again)");
  r.done(one(), 400, now);
  ok(r.stopped && r.due(now) === Infinity && r.take(now, true) === null, "the third refusal in a row: no more sending this visit");
  eq(r.add("page_load", {}, 1), "ok", "events are still queued (the next load sends them)");
  // the store: what dump() writes, from() reads back; what does not pass is left out
  const st = EvQueue({ sid: "visit-0013-aaaa" });
  st.add("victory", { lv: "erebuni", towers: { archer: 2 } }, 7);
  const back = EvQueue({ sid: "visit-0014-aaaa", from: st.dump().concat([{ n: "Bad", q: 1, t: 1, p: {}, s: "visit-0013-aaaa" }, { n: "page_load", q: 1, t: 1, p: {}, s: "<b>" },
    { n: "page_load", q: 1, t: 1, p: { a: { b: { c: 1 } } }, s: "visit-0013-aaaa" }, { n: "page_load", q: 1, t: 1, p: pad(5000), s: "visit-0013-aaaa" }, null, "x",
    { n: "page_load", q: 1, t: 1, p: [1], s: "visit-0013-aaaa" }]) });
  eq(back.dump(), st.dump(), "the store's events read back as written; a bad name, visit id, props too deep or too large, or not an object, are left out");
  // the device's words for p_ctx
  const UA = {
    iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    win: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ff: "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
    crios: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1",
  };
  eq(evDevice({ ua: UA.iphone, touch: 5, phone: true, w: 390, h: 844 }), { dev: "phone", os: "ios", browser: "safari" }, "an iPhone in Safari");
  eq(evDevice({ ua: UA.ipad, touch: 5, phone: false, w: 834, h: 1194 }), { dev: "tablet", os: "ios", browser: "safari" }, "an iPad (it says Macintosh, and has touch)");
  eq(evDevice({ ua: UA.ipad, touch: 0, phone: false, w: 1600, h: 900 }), { dev: "desktop", os: "mac", browser: "safari" }, "a Mac");
  eq(evDevice({ ua: UA.win, touch: 0, w: 1920, h: 1080 }), { dev: "desktop", os: "windows", browser: "chrome" }, "Chrome on Windows");
  eq(evDevice({ ua: UA.edge, touch: 0, w: 1920, h: 1080 }).browser, "edge", "Edge");
  eq(evDevice({ ua: UA.ff, touch: 0, w: 1920, h: 1080 }), { dev: "desktop", os: "linux", browser: "firefox" }, "Firefox on Linux");
  eq(evDevice({ ua: UA.android, touch: 5, phone: false, w: 412, h: 915 }), { dev: "phone", os: "android", browser: "chrome" }, "an Android phone (a short side under 500 px)");
  eq(evDevice({ ua: UA.crios, touch: 5, phone: true, w: 390, h: 844 }).browser, "chrome", "Chrome on an iPhone");
  eq(evDevice({ ua: UA.iphone, touch: 5, phone: true, w: 390, h: 844, inapp: true }).browser, "inapp", "another app's browser");
  for (const u of ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11) Chrome/120 Mobile Safari/537.36 Chrome-Lighthouse", "facebookexternalhit/1.1 Facebot", "Slurp", "Mozilla/5.0 Discordbot/2.0", "Twitterbot/1.0 Preview"])
    ok(EV_BOT_UA.test(u), "a robot's user agent counts nothing: " + u.slice(0, 50));
  for (const u of Object.values(UA)) ok(!EV_BOT_UA.test(u), "a browser is not taken for a robot: " + u.slice(-30));
  // the sample: the same share for an id every time, and spread evenly
  const ids = Array.from({ length: 2000 }, () => crypto.randomUUID());
  ok(ids.every(a => evShare(a) === evShare(a) && evShare(a) >= 0 && evShare(a) < 1), "a device's place in the sample is fixed, from 0 to 1");
  const under = ids.filter(a => evShare(a) < 0.25).length;
  ok(under > 400 && under < 600, "a sample of 0.25 keeps about a quarter of devices (" + under + " of 2000)");
}

// ---------------------------------------------------------------- Cloud.merge (P3: 4.2, 4.4, 4.5, 10.4)
if (pure && pure.Cloud) {
  const C = pure.Cloud;
  // the page's own list of rules, as PF-0 has it, and two of gameplay's kind (a function of the two raw strings)
  const fnMax = (a, b) => (a == null ? b : b == null ? a : String(Math.max(Number(a), Number(b))));
  const RULES = [
    { key: "hs_records", merge: "records" }, { prefix: "hs_best_", merge: "max" }, { key: "hs_open_kept", merge: "union" },
    { key: "hs_unlocked_seen", merge: "union" }, { key: "hs_chapters_seen", merge: "union" }, { key: "hs_tricks_seen", merge: "union" },
    { key: "hs_tutorial_done", merge: "flag" }, { key: "hs_nardi", merge: "newer" }, { key: "hs_run", merge: "run" },
    { key: "hs_council", merge: fnMax }, { key: "hs_towers_seen", merge: "union" },
  ];
  const NOW = 1794000000000, H = 3600000;
  const o = (x) => Object.assign({ rules: RULES, now: NOW, dev: "aaaa", label: "iPhone", live: false, ask: false }, x || {});
  const doc = (keys, x) => Object.assign({ v: 1, at: NOW - H, dev: "bbbb", label: "iPad", keys: keys || {}, keysAt: {}, run: null }, x || {});
  const K = (m) => m.doc.keys;
  // the rules one by one
  eq(C.ruleOf(RULES, "hs_best_erebuni_0"), "max", "ruleOf: the hs_best_ prefix");
  eq(C.ruleOf(RULES, "hs_settings"), null, "ruleOf: a key that is not synced");
  let m = C.merge(doc({ hs_best_erebuni_0: "7" }), doc({ hs_best_erebuni_0: "21" }), o());
  eq([K(m).hs_best_erebuni_0, m.local], ["21", { hs_best_erebuni_0: "21" }], "max: the larger number, and it is written here");
  m = C.merge(doc({ hs_best_erebuni_0: "21" }), doc({ hs_best_erebuni_0: "7" }), o());
  eq([K(m).hs_best_erebuni_0, m.local, m.changed], ["21", {}, true], "max: this device's larger number stands, nothing written here, the cloud must change");
  eq(K(C.merge(doc({ hs_best_tushpa_1: "x" }), doc({ hs_best_tushpa_1: "3" }), o())).hs_best_tushpa_1, "3", "max: a number beats a non-number");
  eq(K(C.merge(doc({}), doc({ hs_best_tushpa_1: "3" }), o())).hs_best_tushpa_1, "3", "max: one side missing, the other");
  eq(K(C.merge(doc({ hs_tutorial_done: "1" }), doc({}), o())).hs_tutorial_done, "1", "flag: one side has it");
  m = C.merge(doc({ hs_tutorial_done: "0" }), doc({ hs_tutorial_done: "1" }), o());
  eq([K(m).hs_tutorial_done, m.local], ["1", {}], "flag: this device's \"0\" (the tutorial again) is left as it is, the document keeps \"1\"");
  m = C.merge(doc({}), doc({ hs_tutorial_done: "1" }), o());
  eq(m.local, { hs_tutorial_done: "1" }, "flag: a fresh device takes the cloud's \"1\"");
  eq(K(C.merge(doc({ hs_chapters_seen: '["kingdoms","faith"]' }), doc({ hs_chapters_seen: '["faith","night"]' }), o())).hs_chapters_seen, '["kingdoms","faith","night"]',
    "union: joined, this device's first, no item twice");
  eq(K(C.merge(doc({ hs_open_kept: "oops" }), doc({ hs_open_kept: "[1,2]" }), o())).hs_open_kept, "[1,2]", "union: a side that is not a list counts as empty");
  const recA = { erebuni: { stars: [3, 1, 0], lives: [20, 9, 0], endless: [0, 0, 0], beyond: [0, 0, 0] }, tushpa: { stars: [2, 0, 0], lives: [11, 0, 0] } };
  const recB = { erebuni: { stars: [2, 2, 0], lives: [18, 12, 0], endless: [24, 0, 0], beyond: [4, 0, 7] }, avarayr: { stars: [1, 0, 0], lives: [3, 0, 0] } };
  eq(JSON.parse(K(C.merge(doc({ hs_records: JSON.stringify(recA) }), doc({ hs_records: JSON.stringify(recB) }), o())).hs_records),
    { erebuni: { stars: [3, 2, 0], lives: [20, 12, 0], endless: [24, 0, 0], beyond: [4, 0, 7] }, tushpa: { stars: [2, 0, 0], lives: [11, 0, 0] }, avarayr: { stars: [1, 0, 0], lives: [3, 0, 0] } },
    "records: per battlefield, field and difficulty the larger (beyond needs no rule of its own); a battlefield one side has is kept");
  eq(JSON.parse(K(C.merge(doc({ hs_records: '{"erebuni":{"stars":[9,1,0],"lives":[-4,2,0]}}' }), doc({ hs_records: '{"erebuni":{"stars":[1,1,0],"lives":[1,1,0]}}' }), o())).hs_records),
    { erebuni: { stars: [3, 1, 0], lives: [1, 2, 0] } }, "records: clamped as levelRecord clamps them (stars at most 3, lives not below 0)");
  eq(JSON.parse(K(C.merge(doc({ hs_records: '{"erebuni":{"stars":[1,0,0],"later":[5,1]}}' }), doc({ hs_records: '{"erebuni":{"stars":[0,0,1],"later":[2,8]}}' }), o())).hs_records),
    { erebuni: { stars: [1, 0, 1], later: [5, 8] } }, "records: a field this build does not know is joined by the larger number too");
  // newer: by each key's own time of last change, never the document's
  m = C.merge(doc({ hs_nardi: "mine" }, { keysAt: { hs_nardi: NOW - 2 * H }, at: NOW }), doc({ hs_nardi: "theirs" }, { keysAt: { hs_nardi: NOW - H }, at: NOW - 3 * H }), o());
  eq([K(m).hs_nardi, m.doc.keysAt.hs_nardi, m.local], ["theirs", NOW - H, { hs_nardi: "theirs" }], "newer: the value changed later wins, whatever the documents' own times");
  eq(K(C.merge(doc({ hs_nardi: "mine" }, { keysAt: { hs_nardi: NOW - H } }), doc({ hs_nardi: "theirs" }, { keysAt: { hs_nardi: NOW - 2 * H }, at: NOW }), o())).hs_nardi, "mine",
    "newer: this device's later change stands against a document pushed since");
  // a function of gameplay's
  m = C.merge(doc({ hs_council: "3" }), doc({ hs_council: "5" }), o());
  eq([K(m).hs_council, m.local], ["5", { hs_council: "5" }], "a function rule: its answer for the two raw strings");
  let seen = null;
  C.merge(doc({}), doc({ hs_council: "2" }), o({ rules: [{ key: "hs_council", merge: (a, b) => { seen = [a, b]; return b; } }] }));
  eq(seen, [null, "2"], "a function rule gets null for the side that has none");
  // the document as a whole
  m = C.merge(doc({ hs_best_erebuni_0: "3" }), doc({ hs_later_key: '{"x":1}', hs_best_erebuni_0: "2" }, { keysAt: { hs_later_key: 5 } }), o());
  eq([K(m).hs_later_key, m.doc.keysAt.hs_later_key, "hs_later_key" in m.local], ['{"x":1}', 5, false], "a key with no rule in this build is carried through untouched and never written here");
  eq(K(C.merge(doc({ hs_later_key: "mine" }), doc({ hs_later_key: "theirs" }), o())).hs_later_key, "theirs", "a key with no rule: the cloud's value, else this device's");
  eq(C.merge(doc({ hs_best_erebuni_0: "3" }), doc({ hs_best_erebuni_0: "9" }, { v: 2 }), o()), { newer: true }, "a document of a newer format is neither applied nor overwritten");
  ok(C.merge(doc({ a: "1" }), null, o()).changed === true, "no save in the cloud: the merge must be sent");
  m = C.merge(doc({ hs_best_erebuni_0: "3" }), doc({ hs_best_erebuni_0: "3" }), o());
  ok(m.changed === false && Object.keys(m.local).length === 0, "the same progress on both sides: nothing to send, nothing to write");
  m = C.merge(doc({ hs_records: JSON.stringify(recA), hs_chapters_seen: '["kingdoms"]', hs_best_erebuni_0: "21" }), doc({}), o());
  ok(Object.keys(m.local).length === 0 && K(m).hs_best_erebuni_0 === "21" && /tushpa/.test(K(m).hs_records), "nothing a player has won is lost by a merge with an empty save");
  ok(C.has(doc({ hs_tutorial_done: "1" })) && !C.has(doc({})) && C.has(doc({}, { run: { at: 1, val: "{}" } })) && !C.has(doc({}, { run: { at: 1, val: null } })), "has: any synced key, or a battle");
  const FRESH = { hs_records: "{}", hs_chapters_seen: '["kingdoms"]', hs_unlocked_seen: '["erebuni"]' };
  ok(!C.has(doc({ hs_records: "{}", hs_chapters_seen: '["kingdoms"]', hs_unlocked_seen: '["erebuni"]', hs_open_kept: "[]" }), FRESH), "has: what a first visit writes by itself is not progress");
  ok(C.has(doc({ hs_records: "{}", hs_unlocked_seen: '["erebuni","tushpa"]' }), FRESH), "has: a second road seen is");
  // a battle the player chose to drop stays dropped on the device that still holds it (4.5: the choice wins everywhere)
  {
    const A = { at: NOW - H, dev: "aaaa", label: "iPhone", val: "OLD", tok: null }, B = { at: NOW - 2 * H, dev: "bbbb", label: "iPad", val: "KEPT", tok: null, drop: [C.tag("OLD")] };
    const m2 = C.merge(doc({}, { run: A }), doc({}, { run: B }), o({ ask: true }));
    eq([m2.run, m2.runVal], ["theirs", "KEPT"], "a dropped battle: the battle kept wins without a question, even against a later save");
    const m3 = C.merge(doc({}, { run: B }), doc({}, { run: A }), o({ ask: true }));
    eq([m3.run, m3.runVal], ["mine", undefined], "and from the other side, the battle kept stands");
    const st2 = C.touched({ run: { at: 1, drop: ["x"] } }, "hs_run", "set", 5, "run");
    eq(st2.run, { at: 5, drop: ["x"] }, "the hook keeps the dropped list with a new save of the battle");
  }
  // the hook's bookkeeping (4.2): a bare removal of hs_run writes no mark; a battle's end does
  let st = C.touched({ owner: "u" }, "hs_run", "set", NOW, "run");
  eq(st.run, { at: NOW }, "the hook: hs_run written stamps the battle");
  ok(st.dirty === true && st.owner === "u", "the hook: a change waits to be sent; the rest of the state is kept");
  st = C.touched(st, "hs_run", "remove", NOW + 5, "run");
  eq(st.run, null, "the hook: a removal of hs_run that no battle's end caused leaves no claim, and no mark");
  eq(C.local((k) => null, ["hs_run"], st, { now: NOW, dev: "aaaa", label: "iPhone" }).run, null, "and this device's document then has no run part");
  st = C.ended(st, NOW + 9);
  eq(C.local((k) => null, ["hs_run"], st, { now: NOW + 10, dev: "aaaa", label: "iPhone" }).run, { at: NOW + 9, dev: "aaaa", label: "iPhone", val: null, tok: null }, "a battle's end writes the mark \"no battle as of now\"");
  eq(C.touched({}, "hs_nardi", "set", NOW, "newer").kat, { hs_nardi: NOW }, "the hook notes the time of a key with the newer rule");
  // the local document: hs_run is never among the keys
  const L = C.local((k) => ({ hs_run: '{"lvl":"erebuni"}', hs_records: "{}" })[k] || null, ["hs_records", "hs_run", "hs_best_erebuni_0"], { run: { at: 5 } }, { now: NOW, dev: "aaaa", label: "iPhone" });
  eq([L.keys, L.run.val, L.run.at], [{ hs_records: "{}" }, '{"lvl":"erebuni"}', 5], "this device's document: its keys, and its battle in the run part with the time it was saved");
  // the run rule's six (4.5)
  const R = (val, at, dev, label) => ({ at, dev: dev || "bbbb", label: label || "iPad", val, tok: null });
  const run = (a, b, x) => C.merge(doc({}, { run: a }), doc({}, { run: b }), o(x));
  m = run(R("B1", NOW - H, "aaaa"), R("B1", NOW - 2 * H));
  eq([m.run, m.runVal], ["same", undefined], "run 1: the same battle on both sides, nothing to do");
  m = run(R("MINE", NOW - 5 * H, "aaaa"), R("THEIRS", NOW - H), { live: true });
  eq([m.run, m.doc.run.val, m.runVal, m.doc.run.at >= NOW], ["mine", "MINE", undefined, true], "run 2: a battle live here stands, stamped now");
  m = run(R(null, NOW - H, "bbbb"), R("THEIRS", NOW - 2 * H, "bbbb"));
  eq([m.run, m.doc.run.val], ["mine", null], "run 3: a mark later than the cloud's battle wins");
  m = run(R("MINE", NOW - 2 * H, "aaaa"), R(null, NOW - H));
  eq([m.run, m.runVal], ["theirs", null], "run 3: a battle finished on the iPad after this device saved it is dropped here");
  m = run(R("MINE", NOW - H, "aaaa"), R(null, NOW - 2 * H));
  eq([m.run, m.doc.run.val, m.runVal], ["mine", "MINE", undefined], "run 3: a battle begun after the mark is kept");
  m = run(null, R("THEIRS", NOW - 30 * H));
  eq([m.run, m.runVal], ["theirs", "THEIRS"], "run 3: a device whose battle is simply gone (no mark) takes the cloud's battle");
  m = run(R("MINE", NOW - 10 * 60000, "aaaa"), R("THEIRS", NOW - 2 * H), { ask: true });
  eq([m.run, !!m.ask, m.runVal, m.doc.run.val], ["asked", true, undefined, "THEIRS"], "run 4: two battles of the last day on two devices: ask (nothing changes until the answer)");
  m = run(R("MINE", NOW - 10 * 60000, "aaaa"), R("THEIRS", NOW - 2 * H), { ask: false });
  eq([m.run, m.runVal, m.doc.run.val], ["held", undefined, "THEIRS"], "run 4: with nobody to ask now, neither battle is replaced (the question waits for the welcome card)");
  m = run(R("MINE", NOW - 30 * H, "aaaa"), R("THEIRS", NOW - 2 * H), { ask: true });
  eq([m.run, m.runVal], ["theirs", "THEIRS"], "run 5: a battle older than a day is not asked about: the later wins");
  m = run(R("MINE", NOW - 3 * H, "aaaa"), R("THEIRS", NOW - 2 * H, "aaaa"), { ask: true });
  eq([m.run, m.runVal], ["theirs", "THEIRS"], "run 5: two battles of the same device: the later wins, no question");
  // run 6 (a battle this build cannot fight is not adopted) needs the page's getSavedRun: tools/regress/platform.js, flow 5
  // words
  eq([C.ago(30000), C.ago(5 * 60000), C.ago(60000), C.ago(2 * H), C.ago(H), C.ago(30 * H), C.ago(72 * H)],
    ["just now", "5 minutes ago", "1 minute ago", "2 hours ago", "1 hour ago", "yesterday", "3 days ago"], "times as words");
}

// every line the sign-in card can show after a failure, for the dash check
function PURE_LINES(p) { const o = {}; for (const c of ["provider_email_needs_verification", "bad_oauth_state", "access_denied", "no_verifier", "x"]) o[c] = p.signinLine(c, "google"); return o; }
(async () => {
if (pure && pure.pkceChallenge && globalThis.crypto && crypto.webcrypto && crypto.webcrypto.subtle) {
  let bad = 0;
  for (let i = 0; i < 20; i++) {
    const v = crypto.randomBytes(64).toString("hex");
    const d = Buffer.from(await crypto.webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(v))).toString("base64url");
    if (d !== pure.pkceChallenge(v)) bad++;
  }
  ok(bad === 0, "the page's PKCE challenge equals crypto.subtle's for 20 random verifiers");
}
console.log("unit.js: " + (pure ? "the page's PLATFORM PURE block found" : "no PLATFORM PURE block in " + path.basename(page) + " yet"));
if (waiting.length) console.log("waiting for their packages: " + waiting.join(", "));
console.log("RESULT unit: " + total + " checks, " + failed + " failed" + (waiting.length ? ", " + waiting.length + " subjects not in the page yet" : ""));
process.exit(failed ? 1 : 0);
})();
