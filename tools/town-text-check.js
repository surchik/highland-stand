// The town's text checker (spec 12.1, 14.3): extracts TWT from index.html, loads docs/history/town-history.json
// and applies the text rules to every player-facing string, printing each failure with the string's key.
// Exit 1 on any failure (warnings do not fail). WP1-A's skeleton: the walk over TWT, the rules that need no
// history file, the names of every TW.DATA id, and a first resolver for cites; WP6 completes it (the numbers in
// history lines against their items, bar_numbers, GAME:<id> items, the Armenian list).
// Usage: node tools/town-text-check.js [index.html]      (GAME=path also works)
const fs = require("fs");
const path = require("path");
const townExtract = require("./town-extract.js");

const file = process.argv[2] || process.env.GAME;
const { TW, TWT } = townExtract(file);
const HIST = path.join(__dirname, "..", "docs", "history", "town-history.json");
let history = null;
try { history = JSON.parse(fs.readFileSync(HIST, "utf8")); } catch (e) { history = null; }

const fails = [], warns = [];
const fail = (key, msg, s) => fails.push(key + ": " + msg + (s ? "  \"" + s + "\"" : ""));
const warn = (key, msg, s) => warns.push(key + ": " + msg + (s ? "  \"" + s + "\"" : ""));

// ---- every string in TWT, with its key; functions are called with sample arguments so their words are seen ----
const strings = [];
const SAMPLE = [1, 2, "f", { res: "s", age: 2, need: "Temple" }];
function walk(v, key, depth) {
  if (depth > 8 || v === null || v === undefined) return;
  if (typeof v === "string") { strings.push({ key, text: v }); return; }
  if (typeof v === "function") {
    if (["name", "hy", "err", "next", "mmss"].includes(key.split(".").pop())) return;   // checked below with real ids
    try { const out = v.apply(null, SAMPLE); if (typeof out === "string") strings.push({ key: key + "()", text: out }); } catch (e) {}
    return;
  }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, key + "[" + i + "]", depth + 1)); return; }
  if (typeof v === "object") {
    if (typeof v.text === "string" && "cite" in v) strings.push({ key, text: v.text, cite: v.cite });
    for (const k of Object.keys(v)) if (!(k === "text" && "cite" in v)) walk(v[k], key + "." + k, depth + 1);
  }
}
walk(TWT, "TWT", 0);
// the names of every building, unit, raider, tech and wonder of TW.DATA, for every age each exists in
const D = TW.DATA;
for (let age = 1; age <= 3; age++) {
  for (const id of Object.keys(D.BLD).concat(["wonder"])) {
    if (D.BLD[id] && D.BLD[id].age && D.BLD[id].age > age) continue;
    const n = TWT.name("bld", id, age);
    if (!n) fail("name.bld." + id + "@" + age, "no name"); else strings.push({ key: "name.bld." + id + "@" + age, text: n });
  }
  for (const id of Object.keys(D.UNITS)) { const n = TWT.name("unit", id, age); if (!n) fail("name.unit." + id + "@" + age, "no name"); else strings.push({ key: "name.unit." + id + "@" + age, text: n }); }
  for (const id of Object.keys(D.RAIDERS)) if (D.RAIDERS[id].age === age) { const n = TWT.name("raider", id, age); if (!n) fail("name.raider." + id, "no name"); else strings.push({ key: "name.raider." + id, text: n }); }
  for (const id of Object.keys(D.TECHS)) if (D.TECHS[id].age === age) { const n = TWT.name("tech", id, age); if (!n) fail("name.tech." + id, "no name"); else strings.push({ key: "name.tech." + id, text: n }); }
  for (const r of ["f", "w", "s", "g"]) { const n = TWT.name("res", r, age); if (!n) fail("name.res." + r + "@" + age, "no name"); }
}
for (const code of ["bounds", "edge", "bank", "blocked", "fertile", "site", "cost", "age", "req", "pop", "units", "cap"]) {
  for (let age = 1; age <= 3; age++) strings.push({ key: "err." + code + "@" + age, text: TWT.err(code, { res: "s", age, need: "a Temple" }) });
}

// ---- the rules (12.1) ----
const BANNED = ["barbar", "horde", "infidel", "saracen", "savage", "heathen", "pagan", "primitive", "tribe of", "sparapet", "azerbaijan"];
const BRITISH = ["colour", "armour", "defence", "centre", "honour", "favour", "harbour", "metre", "theatre", "grey", "plough",
  "storey", "travelled", "kerb", "programme", "organise", "realise", "recognise", "civilise"];
const seen = new Set();
for (const s of strings) {
  const t = s.text, k = s.key;
  if (seen.has(k + "\u0000" + t)) continue;
  seen.add(k + "\u0000" + t);
  if (/[—–]/.test(t)) fail(k, "long dash", t);
  if (/ - /.test(t)) fail(k, "a hyphen used as a dash", t);
  const low = t.toLowerCase();
  for (const w of BANNED) if (low.includes(w)) fail(k, "banned word \"" + w + "\"", t);
  for (const w of BRITISH) if (new RegExp("\\b" + w).test(low)) fail(k, "British spelling \"" + w + "\"", t);
  if (/\bAD \d/.test(t)) fail(k, "the era goes after the number (\"66 AD\")", t);
  for (const sentence of t.split(/(?<=[.!?])\s+/)) {
    const n = sentence.split(/\s+/).filter(Boolean).length;
    if (n > 22) fail(k, "a sentence of " + n + " words (at most 22)", sentence);
    else if (n > 18) warn(k, "a sentence of " + n + " words", sentence);
  }
  if (/[Ա-֏]/.test(t) && !/^TWT\.(ages\[\d\]\.hy)/.test(k) && !/^name\./.test(k)) warn(k, "Armenian script outside the listed forms (12.3)", t);
  // a history line's cite (WP6 completes the resolver: numbers, bar_numbers, GAME items, confidence)
  if ("cite" in s) {
    const cites = [].concat(s.cite || []);
    if (!cites.length) fail(k, "a history line without a cite", t);
    for (const c of cites) if (c !== "game" && history && resolve(c) === undefined) fail(k, "the cite " + c + " is not in the history file", t);
  }
}
// "age1.safe_lines[3]" is ages[0].safe_lines[3]; setting.* and design_handoff.* are top level; GAME:<id> is an
// item the history file carries under that id (12.5)
function resolve(cite) {
  if (/^GAME:/.test(cite)) {
    let hit;
    const find = v => { if (hit || !v || typeof v !== "object") return; if (v.id === cite) { hit = v; return; } for (const k of Object.keys(v)) find(v[k]); };
    find(history);
    return hit;
  }
  const m = /^age([123])\.(.+)$/.exec(cite);
  let v = m ? history.ages[+m[1] - 1] : history, rest = m ? m[2] : cite;
  for (const part of rest.split(".")) {
    const q = /^(\w+)(?:\[(\d+)\])?$/.exec(part);
    if (!q || !v) return undefined;
    v = v[q[1]];
    if (q[2] !== undefined) v = v ? v[+q[2]] : undefined;
  }
  return v;
}

for (const w of warns) console.log("warning  " + w);
for (const f of fails) console.log("FAIL     " + f);
console.log((fails.length ? "town text: " + fails.length + " failures" : "town text: pass") + ", " + warns.length + " warnings, " +
  seen.size + " strings" + (history ? "" : " (no history file at docs/history/town-history.json: cites not resolved)"));
process.exit(fails.length ? 1 : 0);
