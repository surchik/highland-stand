// The town's text checker (spec 12.1, 14.3): extracts TWT (and TW for its ids) from index.html, loads
// docs/history/town-history.json and applies the text rules to every player-facing string, printing each failure
// with the string's key. Exit 1 on any failure (warnings do not fail). The selftest's "town text" check repeats
// the rules that need no history file.
//   - no long dashes (U+2013, U+2014) and no " - " used as a dash; the banned words (with the town's "sparapet"
//     and "Azerbaijan"); no British spellings; the date style "66 AD" (the era after the number);
//     sentences of at most 22 words (a warning above 18)
//   - every building, unit, raider and tech id of TW.DATA has a name (and a role line, a history line or an
//     effect line where it has one) for every age it exists in
//   - every history line ({ text, cite }) has a cite of a known form; each cite resolves in the history file
//     ("age1.x[3]" is ages[0].x[3]; setting.* and design_handoff.* are top level; GAME:<id> is one of its
//     game_items); no item of low confidence and none resting on WebSearch summaries alone; every number of
//     the line (digits with commas removed, and spelled-out numbers such as "six thousand") appears in the text
//     of one of its items (claim, text, quotes, glosses, date, note ...) and in none of their bar_numbers
//   - every GAME item's sentence still stands word for word in index.html
//   - the Armenian forms: only the terms of 12.3, each matching its cited item, and HY_NAMES where both name it;
//     no Armenian letters in any other string
//   - the owner's decisions: "Alan Lasso Riders" (no "Cord Throwers"), Zvartnots' consecration hedged (no
//     single attribution), no Etiuni "Armenian-speaking" line
// Usage: node tools/town-text-check.js [index.html]      (GAME=path also works; the history file is looked for
//        beside that index.html first, then beside this tool)   -v lists every history line with its cites
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const townExtract = require("./town-extract.js");

const args = process.argv.slice(2), VERBOSE = args.includes("-v");
const file = path.resolve(args.find(a => !a.startsWith("-")) || process.env.GAME || path.join(__dirname, "..", "index.html"));
const html = fs.readFileSync(file, "utf8");
const { TW, TWT } = townExtract(file);
const D = TW.DATA;
const HIST = [path.join(path.dirname(file), "docs", "history", "town-history.json"), path.join(__dirname, "..", "docs", "history", "town-history.json")].find(p => fs.existsSync(p));
let history = null;
try { history = JSON.parse(fs.readFileSync(HIST, "utf8")); } catch (e) { history = null; }

const fails = [], warns = [];
const fail = (key, msg, s) => fails.push(key + ": " + msg + (s ? "  \"" + s + "\"" : ""));
const warn = (key, msg, s) => warns.push(key + ": " + msg + (s ? "  \"" + s + "\"" : ""));

// ---- every string of TWT, with its key; history lines keep their cite ----
const strings = [];
const add = (key, text, cite) => strings.push(cite === undefined ? { key, text } : { key, text, cite });
const SKIP = new Set(["TWT.HY"]);                          // the Armenian forms: checked on their own below
function walk(v, key, depth) {
  if (depth > 9 || v === null || v === undefined || SKIP.has(key)) return;
  if (typeof v === "string") { add(key, v); return; }
  if (typeof v !== "object") return;                       // numbers, booleans; functions are called below
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, key + "[" + i + "]", depth + 1)); return; }
  if ("text" in v) {
    if (!("cite" in v)) fail(key, "a line with text and no cite", v.text);
    else add(key, v.text, v.cite);
  }
  for (const k of Object.keys(v)) {
    if (k === "text" || k === "cite") continue;
    if (/^TWT\.ages\[\d\]$/.test(key) && (k === "hy" || k === "hyClassical")) continue;
    walk(v[k], key + "." + k, depth + 1);
  }
}
walk(TWT, "TWT", 0);

// names, roles, history lines and effects for every id of TW.DATA in every age it exists in
const need = (ok, key) => { if (!ok) fail(key, "missing"); };
const AGE_IDS = age => ({
  bld: Object.keys(D.BLD).concat(["wonder"]).filter(id => !(D.BLD[id] && D.BLD[id].age > age)),
  unit: Object.keys(D.UNITS),
  raider: Object.keys(D.RAIDERS).filter(id => D.RAIDERS[id].age === age),
  tech: Object.keys(D.TECHS).filter(id => D.TECHS[id].age <= age),
});
for (let age = 1; age <= 3; age++) {
  const I = AGE_IDS(age);
  for (const kind of ["bld", "unit", "raider"]) for (const id of I[kind]) {
    const n = TWT.name(kind, id, age), r = TWT.role(kind, id, age);
    need(n, "name." + kind + "." + id + "@" + age); need(r, "role." + kind + "." + id);
    if (n) add("name." + kind + "." + id + "@" + age, n);
    if (r) add("role." + kind + "." + id + "@" + age, r);
    TWT.hist(kind, id, age).forEach((x, i) => add("hist." + kind + "." + id + "@" + age + "[" + i + "]", x.text, x.cite));
  }
  for (const id of I.raider) need(TWT.hist("raider", id, age).length, "hist.raider." + id);
  for (const id of I.tech) {
    const n = TWT.name("tech", id, age), e = TWT.effect(id, D, age), hl = TWT.hist("tech", id, age);
    need(n, "name.tech." + id); need(e, "effect." + id + "@" + age); need(hl.length, "hist.tech." + id);
    if (e) add("effect." + id + "@" + age, e);
    if (D.TECHS[id].age === age) hl.forEach((x, i) => add("hist.tech." + id + "[" + i + "]", x.text, x.cite));
  }
  for (const r of ["f", "w", "s", "g"]) {
    const n = TWT.name("res", r, age), tip = TWT.hist("res", r, age);
    need(n, "name.res." + r + "@" + age); need(tip.length, "resTip." + r + "@" + age);
    tip.forEach((x, i) => add("resTip." + r + "@" + age + "[" + i + "]", x.text, x.cite));
  }
  for (const code of ["bounds", "edge", "bank", "blocked", "fertile", "site", "cost", "age", "req", "pop", "units", "cap", "bad", "busy", "done", "wonder"]) {
    add("err." + code + "@" + age, TWT.err(code, { res: "g", age, need: ["temple", "clamped_masonry"] }));
  }
  add("err.req.one@" + age, TWT.err("req", { need: "horse_breeding", age }));
  for (const g of [{ k: "build", type: "barracks", age }, { k: "res", res: "g", have: 240, need: 1350, age }, { k: "advance", to: Math.min(3, age + 1) },
    { k: "aging", left: 32 }, { k: "wonder", age }, { k: "wonderPct", age, pct: 46 }, { k: "tech", tech: "clamped_masonry" }]) add("next." + g.k + "@" + age, TWT.next(g));
}
for (const s of ["house", "field", "store", "move"]) add("next.open." + s, TWT.next({ k: "open", step: s }));
for (const W of D.WONDERS) { need(TWT.name("wonder", W.id) === TWT.name("bld", "wonder", W.age), "name.wonder." + W.id); need(TWT.hist("wonder", W.id).length, "hist.wonder." + W.id); }
add("name.bld.tower@1+beacons", TWT.name("bld", "tower", 1, { fire_beacons: true }));
add("costWords", TWT.costWords({ f: 50, w: 25, s: 100, g: 10 }, 2));

// every ui function, with sample arguments of its kind (an unknown function gets (2, 3))
const NAMES = [TWT.name("bld", "store", 1), TWT.name("bld", "barracks", 1), TWT.name("bld", "stable", 2), TWT.name("bld", "wonder", 3), TWT.name("unit", "spear", 1)];
const AG = [1, 2, 3];
const CALLS = { mapAgain: [[4821]], map: [[4821]], best: [[1, "17:42"], [3, "16:05"]], bestScore: [[2340]], score: [[12345]],
  resumeLine: [["Age of Artashat", "11:32", "Normal"]], resumeCrash: [["11:30"]], demolishAsk: NAMES.map(x => [x]), errorSaved: [["11:30"]],
  winHead: AG.map(x => [x]), loseHead: AG.map(x => [x]), stars: [[1], [3]], blessNew: [[20], [40]], blessToast: [[30]],
  resCount: [["f", 340, 1], ["g", 80, 2]], pop: [[18, 25]], popShort: [[18, 25]], raidIn: [["0:42"]], raidChip: AG.map(a => [a, "0:30"]),
  raidChipAria: [[1, "0:30", false, false], [2, "", true, false], [3, "", false, true]], dockLess: [["f", 1], ["g", 2]], dockMore: [["w", 1], ["g", 3]],
  dockInfo: [["s", 1]], labor: [["f", 8, { flock: 3, field: 5 }, 1], ["g", 3, { ore: 2, dye: 1 }, 3], ["w", 0, {}, 1]], idle: [[2]], idleAria: [[1], [2]],
  shield: [[5]], shieldAria: [[5]], buildAria: [["House", "15 wood, 20 stone"]], wallHint: [[{ s: 5 }, 1]], wallBuild: [[12, { s: 60 }, 1], [1, { s: 5 }, 2], [0, {}, 1]],
  wallRun: [[12, { s: 60 }, 1], [1, { s: 5 }, 2], [0, {}, 3]],
  wallCap: [[64, 70]], wallShort: [[12, "s", 1]], siteHint: AG.map(x => [x]), hp: [[340, 1500]], task: [["Cutting wood", 6, 10], ["", 0, 0]],
  carrying: [["s", 1]], train: [["Erebuni Spearmen"]], sell: [["f", 100, 35, 1]], buy: [["s", 100, 90, 2]], builders: [[3]], repair: [[{ s: 3 }, 1]],
  nodeLeft: [[120, "s", 1]], nodeWorkers: [[2]], advanceTo: [["Age of Artashat"]], secs: [[45]], wonderNeeds: [[2, ["temple", "clamped_masonry"]], [3, ["temple", "stone_domes"]]],
  techsAt: [["Smithy"]], raidComing: [[1, false], [2, false], [3, false], [3, true]], idleCall: [[1], [2]], depleted: [["flock"], ["orchard"], ["stone"], ["ore"], ["dye"]],
  built: NAMES.map(x => [x]), destroyed: NAMES.map(x => [x]), researched: [["Iron Tools"]], advancing: [["Age of Artashat"]],
  repairStop: [["s", 1]], wonderPct: [[3, 46]], stage: [[25, 1], [50, 2], [75, 2], [75, 3]], underAttack: NAMES.map(x => [x]),
  tcHurt: [[1, 50], [2, 25], [3, 50]], cartArrive: [[24, 1], [30, 2]], sold: [["f", 100, 35, 1]], bought: [["w", 100, 80, 3]], unitFell: [["Nakharar Bowmen"]] };
for (const k of Object.keys(TWT.ui)) {
  const v = TWT.ui[k];
  if (typeof v !== "function") continue;
  if (!CALLS[k]) warn("ui." + k, "no sample arguments in this checker: called with (2, 3)");
  (CALLS[k] || [[2, 3]]).forEach((a, i) => {
    let out;
    try { out = v.apply(null, a); } catch (e) { fail("ui." + k + "()", "threw " + e.message); return; }
    if (typeof out !== "string" || !out) fail("ui." + k + "(" + a.join(", ") + ")", "no text"); else add("ui." + k + "()" + (i || ""), out);
  });
}

// ---- the rules of 12.1 on every string ----
const BANNED = ["barbar", "horde", "infidel", "saracen", "savage", "heathen", "pagan", "primitive", "tribe of", "sparapet", "azerbaijan"];
const BRITISH = ["colour", "armour", "defence", "centre", "honour", "favour", "harbour", "metre", "theatre", "grey", "plough",
  "storey", "travelled", "kerb", "programme", "organise", "realise", "recognise", "civilise"];
const CITE = /^(game|(age[123]|setting|design_handoff)(\.[a-z_]+(\[\d+\])?)+|GAME:[a-z0-9]+\.[a-z0-9]+)$/;
const HY_CHAR = /[Ա-֏]/;
const seen = new Set();
const hlines = [];
for (const s of strings) {
  const t = s.text, k = s.key;
  if (typeof t !== "string") { fail(k, "not a string"); continue; }
  if (!t.trim()) { if (!/\.gone$/.test(k)) fail(k, "an empty string"); continue; }
  const id = k + "\u0000" + t;
  if (seen.has(id)) continue;
  seen.add(id);
  if (/[–—]/.test(t)) fail(k, "a long dash", t);
  if (/ - /.test(t)) fail(k, "a hyphen used as a dash", t);
  const lt = t.toLowerCase();
  for (const w of BANNED) if (lt.includes(w)) fail(k, "the banned word \"" + w + "\"", t);
  for (const w of BRITISH) if (new RegExp("\\b" + w).test(lt)) fail(k, "the British spelling \"" + w + "\"", t);
  if (/\bAD \d/.test(t)) fail(k, "the era goes after the number (\"66 AD\")", t);
  if (/\b(BCE|CE)\b|\bA\.D\.|\bB\.C\./.test(t)) fail(k, "the campaign writes BC and AD", t);
  if (HY_CHAR.test(t)) fail(k, "Armenian letters outside the forms of 12.3 (TWT.HY)", t);
  for (const sen of t.split(/(?<=[.!?])\s+/)) {
    const n = sen.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
    if (n > 22) fail(k, "a sentence of " + n + " words (at most 22)", sen);
    else if (n > 18) warn(k, "a sentence of " + n + " words", sen);
  }
  // the owner's decisions (owner-decisions.md 7, 8, 10)
  if (/cord thrower/i.test(t)) fail(k, "the unit is \"Alan Lasso Riders\" now (owner decision 10)", t);
  if (/consecrated/i.test(t) && !/usually said to have been consecrated/i.test(t)) fail(k, "Zvartnots' consecration is hedged: \"usually said to have been consecrated in 652\" (owner decision 8)", t);
  if (/armenian-speaking/i.test(t)) fail(k, "the Etiuni Armenian-speaking line is left out (owner decision 7)", t);
  if ("cite" in s) {
    const cites = [].concat(s.cite);
    if (!cites.length) fail(k, "a history line without a cite", t);
    for (const c of cites) if (typeof c !== "string" || !CITE.test(c)) fail(k, "the cite \"" + c + "\" is not of a known form", t);
    hlines.push({ key: k, text: t, cites });
  }
}

// ---- the history file: resolve each cite, check confidence, sources and every number ----
// "age1.safe_lines[3]" is ages[0].safe_lines[3]; returns { v, owner } (owner: the nearest object holding confidence)
function resolve(cite) {
  if (/^GAME:/.test(cite)) { const v = (history.game_items || []).find(x => x.id === cite); return v ? { v, owner: v } : null; }
  const m = /^age([123])\.(.+)$/.exec(cite);
  let v = m ? history.ages[+m[1] - 1] : history, owner = null;
  for (const part of (m ? m[2] : cite).split(".")) {
    const q = /^(\w+)(?:\[(\d+)\])?$/.exec(part);
    if (!q || !v || typeof v !== "object") return null;
    v = v[q[1]];
    if (q[2] !== undefined) v = Array.isArray(v) ? v[+q[2]] : undefined;
    if (v && typeof v === "object" && !Array.isArray(v) && "confidence" in v) owner = v;
  }
  return v === undefined ? null : { v, owner };
}
// the words of an item that count as its text (not the historian's design notes, refs or check marks)
const TEXT_KEYS = new Set(["text", "claim", "name", "function", "description", "event", "date", "note", "quote", "gloss", "term",
  "meaning_or_use", "armenian_script", "classical", "location", "builder", "period_name", "do_not_claim", "why", "dateline", "summary"]);
function itemText(v) {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(itemText).join(" \u0001 ");
  if (!v || typeof v !== "object") return "";
  const out = [];
  for (const k of Object.keys(v)) {
    if (k === "sources") { for (const s of v.sources) if (s && typeof s === "object") { if (s.quote) out.push(s.quote); if (s.gloss) out.push(s.gloss); } continue; }
    if (TEXT_KEYS.has(k) && typeof v[k] === "string") out.push(v[k]);
  }
  return out.join(" \u0001 ");
}
const WORD = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20 };
const SCALE = { hundred: 100, thousand: 1000, million: 1000000 };
// every number of a text: digits (commas removed, decimals kept, "8th" is 8, "640s" is 640) and spelled-out
// numbers ("six thousand" is 6000, "twenty-four" is 24). "one", "first" and "second" are not counted: they are
// mostly not numbers ("one of", "the first Arab raids")
function numbers(t) {
  const out = new Set();
  t = t.replace(/(\d),(?=\d{3}\b)/g, "$1");
  for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) out.add(String(Number(m[0])));
  let cur = null;
  for (const w of t.toLowerCase().split(/[^a-z]+/).concat([""])) {
    if (w in WORD) { const v = WORD[w]; if (cur !== null && cur >= 20 && cur % 10 === 0 && v < 10) cur += v; else { if (cur !== null) out.add(String(cur)); cur = v; } }
    else if (w in SCALE && cur !== null) cur *= SCALE[w];
    else { if (cur !== null) out.add(String(cur)); cur = null; }
  }
  return out;
}
let resolved = 0, gameLines = 0;
const itemsUsed = new Set();
if (!history) fail("history", "no history file at docs/history/town-history.json: cites cannot be resolved");
else {
  for (const L of hlines) {
    const paths = L.cites.filter(c => c !== "game");
    if (!paths.length) { gameLines++; continue; }
    let text = "", bar = new Set();
    for (const c of paths) {
      const r = resolve(c);
      if (!r) { fail(L.key, "the cite " + c + " is not in the history file", L.text); continue; }
      resolved++; itemsUsed.add(c);
      const own = r.owner || (r.v && typeof r.v === "object" ? r.v : null);
      if (own && /^low\b/.test(String(own.confidence || ""))) fail(L.key, "the cite " + c + " is of low confidence", L.text);
      const srcs = (r.v && typeof r.v === "object" && Array.isArray(r.v.sources)) ? r.v.sources.map(s => (typeof s === "string" ? s : s.ref)) : [];
      if (srcs.length && srcs.every(s => /^WS\b/.test(String(s)))) fail(L.key, "the cite " + c + " rests on WebSearch summaries alone", L.text);
      text += " \u0001 " + itemText(r.v);
      for (const b of [].concat((r.v && r.v.bar_numbers) || [], (own && own.bar_numbers) || [])) bar.add(String(b));
    }
    const have = numbers(text);
    for (const n of numbers(L.text)) {
      if (bar.has(n)) fail(L.key, "the number " + n + " is one the history file marks as unsourced (bar_numbers)", L.text);
      else if (!have.has(n)) fail(L.key, "the number " + n + " is not in its cited items (" + paths.join(", ") + ")", L.text);
    }
    if (VERBOSE) console.log("line  " + L.key + "  [" + L.cites.join(", ") + "]  " + L.text);
  }
  // every campaign sentence the history file carries still stands in index.html, word for word
  for (const g of history.game_items || []) {
    if (!/^GAME:[a-z0-9]+\.[a-z0-9]+$/.test(g.id)) fail("history." + g.id, "a GAME item id of an unknown form");
    if (!g.sources || !g.sources[0] || g.sources[0].quote !== g.claim) fail("history." + g.id, "its quote is not its claim");
    if (!html.includes(g.claim)) fail("history." + g.id, "the sentence is no longer in index.html", g.claim);
  }
}

// ---- the Armenian forms (12.3): only these terms, each as its cited item gives it, and as HY_NAMES gives it ----
const HY_LIST = ["Erebuni", "Artashat", "Dvin", "Haldi", "Garni", "Zvartnots", "karas", "nakharar", "catholicos"];
const forms = new Set();
const hyNames = (() => {
  const a = html.indexOf("const HY_NAMES = {"), b = html.indexOf("\n};", a);
  if (a < 0 || b < 0) return null;
  try { return vm.runInNewContext("(" + html.slice(a + "const HY_NAMES = ".length, b + 2) + ")"); } catch (e) { return null; }
})();
if (!hyNames) fail("HY_NAMES", "could not read HY_NAMES from index.html");
const ens = (TWT.HY || []).map(r => r.en);
if (ens.slice().sort().join() !== HY_LIST.slice().sort().join()) fail("TWT.HY", "the forms shown must be exactly those of 12.3: " + HY_LIST.join(", ") + "; TWT has " + ens.join(", "));
for (const r of TWT.HY || []) {
  const k = "TWT.HY." + r.en;
  forms.add(r.hy); if (r.classical) forms.add(r.classical);
  for (const f of [r.hy, r.classical || ""]) if (f && !/^[Ա-֏]+$/.test(f)) fail(k, "not one Armenian word", f);
  if (!CITE.test(r.cite)) fail(k, "the cite " + r.cite + " is not of a known form");
  if (history) {
    const it = resolve(r.cite);
    const script = it && it.v && it.v.armenian_script || "";
    if (!it) fail(k, "the cite " + r.cite + " is not in the history file");
    else if (!script.split(/[\s(),]+/).includes(r.hy)) fail(k, "the cited item gives \"" + script + "\", not " + r.hy);
    else if (r.classical && !(it.v.classical === r.classical || script.includes("classical " + r.classical))) fail(k, "the cited item has no classical " + r.classical);
    else if (r.byRule && !it.v.byRule) fail(k, "the cited item does not mark its classical form byRule");
    if (it) itemsUsed.add(r.cite);
  }
  if (r.same && hyNames) {
    const row = hyNames.field[r.same];
    if (!row || row.hy !== r.hy || (row.classical || "") !== (r.classical || "")) fail(k, "does not agree with HY_NAMES.field[\"" + r.same + "\"]");
  }
}
TWT.ages.forEach((A, i) => {
  const r = (TWT.HY || []).find(x => x.en === A.town);
  if (!r || A.hy !== r.hy || (A.hyClassical || "") !== (r.classical || "")) fail("TWT.ages[" + i + "].hy", "not the form of " + A.town + " in TWT.HY");
});
for (let age = 1; age <= 3; age++) for (const kind of ["bld", "unit", "tech", "wonder"]) {
  const ids = kind === "bld" ? Object.keys(D.BLD).concat(["wonder"]) : kind === "unit" ? Object.keys(D.UNITS) : kind === "tech" ? Object.keys(D.TECHS) : D.WONDERS.map(w => w.id);
  for (const id of ids) for (const f of [TWT.hy(kind, id, age), TWT.hyc(kind, id, age)]) if (f && !forms.has(f)) fail("hy." + kind + "." + id + "@" + age, "a form not in TWT.HY", f);
}

for (const w of warns) console.log("warning  " + w);
for (const f of fails) console.log("FAIL     " + f);
const nh = hlines.length;
console.log((fails.length ? "town text: " + fails.length + " failures" : "town text: pass") + ", " + warns.length + " warnings; " +
  seen.size + " strings, " + nh + " history lines (" + (nh - gameLines) + " cited, " + gameLines + " game), " + resolved + " cites resolved to " +
  itemsUsed.size + " items, " + (history ? (history.game_items || []).length + " GAME items" : "no history file"));
process.exit(fails.length ? 1 : 0);
