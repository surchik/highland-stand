// Under Ararat (WP4 post-P): the source lines of the info panel's and the age sheet's history lines. Every cite that
// TWT's hist() uses is resolved through docs/history/town-history.json to the works the history file read for it, and
// printed as the shell's SRC table (works and cites) to paste into the TODO-TEXT block (or into TWT.source when WP6
// takes it over). A GAME item or a dossier-only item maps to the works its campaign check read (GAMEW, DOSS below).
// Usage: node tools/town-sources.js [index.html]      (exit 1 if a cite has no work)
const fs = require("fs");
const path = require("path");
const GAMEF = path.resolve(process.argv[2] || process.env.GAME || path.join(__dirname, "..", "index.html"));
const ex = require("./town-extract.js");
const { TW, TWT } = ex(GAMEF);
const H = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "docs", "history", "town-history.json"), "utf8"));
// the Armenian Wikipedia titles, in English (my translation of the title only)
const HYT = { "Էրեբունի ամրոց": "Erebuni Fortress", "Հայկական ճարտարապետություն": "Armenian architecture", "Երևան": "Yerevan",
  "Հայաստանը վաղ միջնադարում": "Armenia in the early Middle Ages", "Թեյշեբաինի": "Teishebaini" };
const WORK = { STRABO: "Strabo, Geography", JOS: "Josephus, The Jewish War", TAC: "Tacitus, Annals", PLUT: "Plutarch, Life of Lucullus",
  LYNCH1: "H. F. B. Lynch, Armenia (1901)", PREV: "Procopius, Wars", SUET: "Suetonius, Nero", AMM: "Ammianus Marcellinus" };
// GAME items rest on the campaign's checked texts; these are the works those checks read (scratchpad verified/*.json)
const GAMEW = { "GAME:dvin.constans": ["W:Theodore Rshtuni"], "GAME:dvin.pact": ["W:Arminiya"], "GAME:tushpa.sargon": ["SARGON"],
  "GAME:avarayr.nakharars": ["W:Nakharar"], "GAME:dvin.procopius": ["PREV"] };
const DOSS = { "age3.techs[9]": ["W:Arminiya"] };   // the pact of 652 or 653: the dossier's claim, checked against Wikipedia's "Arminiya"
function itemOf(c) {
  let m = /^age(\d)\.(.*)$/.exec(c), o;
  if (m) { o = H.ages[m[1] - 1]; c = m[2]; } else o = H;
  for (const part of c.split(".")) { const q = /^(\w+)(?:\[(\d+)\])?$/.exec(part); o = o[q[1]]; if (q[2] !== undefined) o = o[+q[2]]; }
  return o;
}
function refsOf(c) {
  if (c === "game") return [];
  if (GAMEW[c]) return GAMEW[c];
  if (c.startsWith("GAME:")) throw new Error("no work for " + c);
  const o = itemOf(c), src = (o && o.sources) || [];
  let r = src.map(s => (typeof s === "string" ? s : s.check && s.check !== "ok" ? null : s.ref)).filter(Boolean);
  r = r.map(x => x.replace(/^(OFF|TFDS):/, "W:")).map(x => (x.startsWith("HY:") ? "HY:" + (HYT[x.slice(3)] || (() => { throw new Error("no title " + x); })()) : x));
  const real = r.filter(x => !/^(GAME|DOSSIER|AUDIT|WS)/.test(x));
  if (!real.length && DOSS[c]) return DOSS[c];
  if (!real.length) throw new Error("no source for " + c + ": " + r.join(","));
  return real;
}
const cites = new Set();
const add = L => (L || []).forEach(l => [].concat(l.cite).forEach(c => cites.add(c)));
for (const k of Object.keys(TW.DATA.BLD).concat(["wonder"])) for (const a of [1, 2, 3]) add(TWT.hist("bld", k, a));
for (const k of Object.keys(TW.DATA.UNITS)) for (const a of [1, 2, 3]) add(TWT.hist("unit", k, a));
for (const k of ["etR", "etS", "alH", "alC", "arR", "arS", "arW", "arH"]) add(TWT.hist("raider", k, 1));
for (const k of Object.keys(TW.DATA.TECHS)) add(TWT.hist("tech", k, 1));
for (const k of Object.keys(TWT.nodes)) add(TWT.hist("node", k, 3));
const ids = new Map(), out = {};
const idOf = r => { if (!ids.has(r)) ids.set(r, ids.size.toString(36)); return ids.get(r); };
for (const c of [...cites].sort()) { const rs = [...new Set(refsOf(c))]; if (rs.length) out[c] = rs.map(idOf).join(" "); }
const label = r => (r.startsWith("W:") ? "Wikipedia, “" + r.slice(2) + "”" : r.startsWith("HY:") ? "Armenian Wikipedia, “" + r.slice(3) + "”"
  : r === "SARGON" ? "Sargon II, Letter to the god Ashur" : WORK[r] || (() => { throw new Error("no label " + r); })());
const W = {}; for (const [r, id] of ids) W[id] = label(r);
console.log("    works: " + JSON.stringify(W) + ",");
console.log("    cites: " + JSON.stringify(out) + ",");
console.error(cites.size + " cites, " + ids.size + " works, " + (JSON.stringify(W).length + JSON.stringify(out).length) + " bytes");
