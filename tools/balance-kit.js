// The kit's bounds (gameplay.final.md 5.2, 4.8) read off the balance bot's battles on Normal.
// Usage: node tools/balance-kit.js none=a.txt par-off=b.txt par-hold=c.txt cap-off=d.txt cap-hold=e.txt [none-hold=f.txt]
// Each file holds JSON=1 lines of tools/balance.js run with that KIT= and HERO= (SEEDS=3, all 17, one difficulty).
// For each battlefield: the best build's defenders kept (the mean over its seeds, a loss counting 0) with no kit and
// with each kit, and the difference. The bounds: with the best build, par keeps at most 2 more than none on the mean
// over the battlefields, cap at most 4, and on no battlefield more than 6; each read as the worse of HERO=off and
// HERO=hold (the base is KIT=none, which is the same battle with either: no Call to sound). Prints PASS or FAIL.
"use strict";
const fs = require("fs");
const IDS = ["erebuni","tushpa","avarayr","dvin","tashir","sevan","ani","mari","sis","gyumri","halidzor","van","musadagh","sardarapat","stepanakert92","shushi","stepanakert23"];
const sets = {};
for (const a of process.argv.slice(2)) {
  const [k, f] = a.split("=");
  sets[k] = [];
  for (const file of f.split(",")) for (const l of fs.readFileSync(file, "utf8").split("\n")) if (l.startsWith("{")) sets[k].push(JSON.parse(l));
}
if (!sets.none) { console.error("usage: node tools/balance-kit.js none=a.txt par-off=b.txt ..."); process.exit(2); }
// the best build: most wins, then the most defenders kept (as tools/balance-bands.js reads it)
const score = x => x.filter(r => r.won).length * 1000 + x.reduce((s, r) => s + r.lives + r.wave * 10 * !r.won, 0) / x.length;
const best = (rs, lv) => {
  const here = rs.filter(r => r.lv === lv);
  let b = null;
  for (const n of [...new Set(here.map(r => r.build))]) { const x = here.filter(r => r.build === n); if (!b || score(x) > score(b.x)) b = { n, x }; }
  return b && { build: b.n, kept: b.x.reduce((s, r) => s + (r.won ? r.lives : 0), 0) / b.x.length };
};
const lvs = [...new Set(sets.none.map(r => r.lv))].sort((a, b) => a - b);
const kits = Object.keys(sets).filter(k => k !== "none" && k !== "none-hold");
let fail = false;
console.log("  battlefield   none            " + kits.map(k => k.padEnd(18)).join(""));
const diffs = {};
for (const k of kits) diffs[k] = [];
for (const lv of lvs) {
  const n = best(sets.none, lv);
  let line = "  " + IDS[lv].padEnd(14) + (n.kept.toFixed(1) + " " + n.build).padEnd(16);
  for (const k of kits) {
    const b = best(sets[k], lv);
    if (!b) { line += "-".padEnd(18); continue; }
    const d = b.kept - n.kept;
    diffs[k].push(d);
    line += ((d >= 0 ? "+" : "") + d.toFixed(1) + " " + b.build).padEnd(18) + " ";
  }
  console.log(line);
}
const out = {};
for (const k of kits) {
  const x = diffs[k], mean = x.reduce((a, b) => a + b, 0) / x.length, top = Math.max(...x);
  const kind = k.split("-")[0], bound = kind === "par" ? 2 : kind === "cap" ? 4 : null;
  out[k] = { mean: +mean.toFixed(2), most: +top.toFixed(1) };
  const bad = bound != null && (mean > bound || top > 6);
  if (bad) fail = true;
  console.log("  " + k + ": mean " + (mean >= 0 ? "+" : "") + mean.toFixed(2) + " (bound " + (bound == null ? "none" : bound) + "), most " + top.toFixed(1) +
    " (bound 6) over " + x.length + " battlefields" + (bad ? "  OVER" : ""));
}
console.log("RESULT balance-kit " + (fail ? "FAIL" : "PASS") + " " + JSON.stringify(out));
process.exit(fail ? 1 : 0);
