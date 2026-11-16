// Reference arithmetic of the platform, written straight from the spec (docs/specs/platform.final.md 5.1 and
// 5.6, with docs/specs/RULINGS.md S3 to S5). sql-tests.js holds the database's functions to it, and unit.js
// holds the page's own scoreOf and dailyOf to it once they exist (P5 and P6). One table of score cases
// (SCORE_CASES) serves both, so the page and the server are checked against the same numbers.
"use strict";

const clamp01 = x => Math.max(0, Math.min(1, x));

// the bounds of a battle, as highland._bounds reads them from a ruleset
function boundsOf(rules, level, diff, twist, daily) {
  const lv = rules.levels[level];
  if (!lv) throw new Error("level_unknown");
  const d = lv.d[diff];
  if (!d) throw new Error("diff_unknown");
  const c = daily ? rules.daily.levels[level] : d;
  const t = (daily && rules.daily.t && rules.daily.t[twist]) || {};
  const m = (k) => (t[k] == null ? 1 : t[k]);
  return {
    waves: daily ? rules.daily.waves : lv.waves,
    lives: t.livesSet != null ? t.livesSet : Math.round(d.lives * m("lives")),
    fast: Math.round(c.fast * m("fast")),
    slow: Math.round(c.slow * m("slow")),
    min: Math.round((c.min != null ? c.min : c.fast) * m("fast")),
    earnMax: Math.round(c.earnMax * m("earn")),
    rev: lv.rev,
  };
}

// the score of a result (5.1): a win is 4000 plus three capped shares; a lost daily is under any win, by the
// waves it cleared out of the daily's length (RULINGS S3)
function scoreOf(stats, b, w) {
  w = w || { win: 4000, lives: 3000, speed: 1500, thrift: 1500, lostMax: 3999 };
  if (!stats.won) return Math.min(Math.floor(4000 * stats.waves / b.waves), w.lostMax == null ? 3999 : w.lostMax, 3999);
  const L = stats.lives / b.lives;
  const S = clamp01((b.slow - stats.sim_sec) / Math.max(1, b.slow - b.fast));
  const T = clamp01(1 - stats.spent / Math.max(1, stats.earned));
  return w.win + Math.round(w.lives * L + w.speed * S + w.thrift * T);
}

function starsOf(stats, b) {
  if (!stats.won) return 0;
  return stats.lives >= b.lives * 0.85 ? 3 : stats.lives >= b.lives * 0.5 ? 2 : 1;
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
// k: the smallest whole number >= 5 that shares no factor with n; j: the smallest >= 3 that shares none with m
function kOf(n) { let k = 5; while (gcd(k, n) !== 1) k++; return k; }
function jOf(m) { let j = 3; while (gcd(j, m) !== 1) j++; return j; }

// the daily of a UTC day (day = whole days since 1 January 1970), 5.6
function dailyOf(daily, day) {
  const n = daily.pool.length, m = daily.twists.length;
  const k = daily.k != null ? daily.k : kOf(n), j = daily.j != null ? daily.j : jOf(m);
  const level = daily.pool[(day * k) % n];
  const i = ((day % n) * j + Math.floor(day / n)) % m;
  const skip = (daily.skip && daily.skip[level]) || [];
  let twist = daily.twists[i];
  for (let s = 0; s < m; s++) {
    twist = daily.twists[(i + s) % m];
    if (!skip.includes(twist)) break;
  }
  return { level, twist };
}

// The table of score cases: Normal on a battlefield whose bounds are lives 20, fast 300, slow 900, earnMax 5500
// (the spec's own example is the first). "flags" is what the server must mark.
const SCORE_BOUNDS = { waves: 10, lives: 20, fast: 300, slow: 900, min: 200, earnMax: 5500 };
const SCORE_CASES = [
  { what: "the spec's example: 20 of 20 kept, 600 s between 300 and 900, 900 of 3,000 spent", stats: { won: true, lives: 20, waves: 10, sim_sec: 600, spent: 900, earned: 3000 }, score: 8800, stars: 3, flags: [] },
  { what: "17 of 20 kept, at fast exactly, all gold spent", stats: { won: true, lives: 17, waves: 10, sim_sec: 300, spent: 3000, earned: 3000 }, score: 4000 + 2550 + 1500 + 0, stars: 3, flags: [] },
  { what: "slower than slow: no speed share", stats: { won: true, lives: 10, waves: 10, sim_sec: 1200, spent: 1500, earned: 3000 }, score: 4000 + 1500 + 0 + 750, stars: 2, flags: [] },
  { what: "under fast and over min: the full speed share, and flagged", stats: { won: true, lives: 20, waves: 10, sim_sec: 250, spent: 900, earned: 3000 }, score: 4000 + 3000 + 1500 + 1050, stars: 3, flags: ["fast"] },
  { what: "a perfect battle: flagged for the admin", stats: { won: true, lives: 20, waves: 10, sim_sec: 280, spent: 200, earned: 5000 }, score: 4000 + 3000 + 1500 + 1440, stars: 3, flags: ["fast", "perfect"] },
  { what: "a resumed battle whose worse attempts took every defender off the boards' count (RULINGS S2)", stats: { won: true, lives: 0, waves: 10, sim_sec: 700, spent: 2000, earned: 4000 }, score: 4000 + 0 + 500 + 750, stars: 1, flags: [] },
  { what: "one defender left, a slow and thrifty battle", stats: { won: true, lives: 1, waves: 10, sim_sec: 899, spent: 1, earned: 4000 }, score: 5652, stars: 1, flags: [] },
  { what: "eleven of twenty: two stars", stats: { won: true, lives: 11, waves: 10, sim_sec: 450, spent: 2500, earned: 5000 }, score: 4000 + 1650 + 1125 + 750, stars: 2, flags: [] },
];
// lost dailies on a 12-wave daily (RULINGS S3): floor(4000 * cleared / 12)
const LOST_CASES = [
  { cleared: 0, score: 0 }, { cleared: 1, score: 333 }, { cleared: 5, score: 1666 }, { cleared: 6, score: 2000 }, { cleared: 11, score: 3666 },
];

// The name rule (5.5), as highland._name_clean judges it: the cleaned name, or the refusal's word. The page's
// own check (P2) must agree with it on NAME_CASES, which sql-tests.js also holds the server to.
const BLOCKLIST = [["admin", "contains"], ["moderator", "contains"], ["highlandstand", "contains"], ["support", "exact"], ["owner", "exact"],
  ["official", "contains"], ["system", "exact"], ["null", "exact"], ["undefined", "exact"], ["\u5350", "contains"], ["\u534d", "contains"]];
const nameFold = (n) => n.normalize("NFKC").replace(/[\s._-]+/g, "").toLowerCase().replace(/[013457@$]/g, c => "oieastas"["013457@$".indexOf(c)]);
function nameClean(p) {
  const n = String(p == null ? "" : p).normalize("NFKC").replace(/\s+/g, " ").trim();
  const len = [...n].length;
  if (len < 3 || len > 16) return { error: "name_length" };
  if (/\p{Cc}/u.test(n) || /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/.test(n) || /[!-,/:-@[-^`{-~]/.test(n) || !/^[\p{L}\p{N} ._-]+$/u.test(n)) return { error: "name_chars" };
  const f = nameFold(n);
  if ([...f].length < 3) return { error: "name_length" };
  if (BLOCKLIST.some(([b, k]) => (k === "contains" ? f.includes(b) : f === b))) return { error: "name_blocked" };
  return { name: n, key: f };
}
const NAME_CASES = [
  ["ab", "name_length", "two letters"], ["Aaaaaaaaaaaaaaaaa", "name_length", "seventeen letters"], ["  a  ", "name_length", "one letter in spaces"],
  ["<b>Aram</b>", "name_chars", "markup"], ["Ar\u202Eam", "name_chars", "a direction override"], ["Ar\u200Bam", "name_chars", "a zero-width space"],
  ["Ar\u0007am", "name_chars", "a control character"], ["\u2605\u2605\u2605", "name_chars", "symbols"], ["Aram\u{1F600}", "name_chars", "a picture"],
  ["Za\u0334l\u0335go", "name_chars", "stacked marks"], ["Aram!", "name_chars", "punctuation"], ["Aram@home", "name_chars", "an at sign"],
  ["\u5350\u5350\u5350", "name_blocked", "a sign on the blocklist"], ["The Adm1n", "name_blocked", "a reserved word, digits swapped"],
  ["Mod_erator", "name_blocked", "a reserved word with an underscore"], ["support", "name_blocked", "an exact reserved word"],
  ["Highland.Stand", "name_blocked", "the game's own name"], ["._-", "name_length", "nothing left once folded"],
  ["  \u0531\u0580\u0561\u0574   Aram ", "\u0531\u0580\u0561\u0574 Aram", "Armenian letters, spaces trimmed and made one"],
  ["\u041d\u0430\u0440\u0435\u043a", "\u041d\u0430\u0440\u0435\u043a", "Cyrillic"], ["\u5c71\u7530\u592a\u90ce", "\u5c71\u7530\u592a\u90ce", "CJK"],
  ["Zo\u00eb 7", "Zo\u00eb 7", "accented Latin and a digit"], ["\uff21\uff52\uff41\uff4d", "Aram", "full-width letters folded to plain ones (NFKC)"],
  ["Supporters", "Supporters", "an exact reserved word inside a longer name"], ["Ar4m", "Ar4m", "digits that imitate letters are allowed"],
];

module.exports = { nameClean, nameFold, NAME_CASES, BLOCKLIST, boundsOf, scoreOf, starsOf, dailyOf, kOf, jOf, gcd, SCORE_BOUNDS, SCORE_CASES, LOST_CASES };
