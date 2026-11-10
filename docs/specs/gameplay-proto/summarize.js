// reads JSON lines of balance-time.js, prints per battlefield (winning runs): total sim time, per-wave secs, gold trace
const fs = require("fs");
const rows = fs.readFileSync(process.argv[2], "utf8").split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l));
const ids = ["erebuni","tushpa","avarayr","dvin","tashir","sevan","ani","mari","sis","gyumri","halidzor","van","musadagh","sardarapat","stepanakert92","shushi","stepanakert23"];
const only = process.argv[3] || "mix";
for (let lv = 0; lv < 17; lv++) {
  const rs = rows.filter(r => r.lv === lv && r.won);
  if (!rs.length) { console.log(lv, ids[lv], "no wins"); continue; }
  const tot = rs.map(r => r.secs.reduce((a, b) => a + b, 0));
  const mean = tot.reduce((a, b) => a + b, 0) / tot.length;
  const r = rows.find(r => r.lv === lv && r.build === only) || rs[0];
  const s = r.secs;
  const cum = k => s.slice(0, k).reduce((a, b) => a + b, 0);
  console.log(String(lv).padStart(2), ids[lv].padEnd(14), "wins", rs.length, "mean battle s", Math.round(mean), "(" + (mean / 60).toFixed(1) + " min)",
    "| " + r.build + ": w1-5", Math.round(cum(5)), "w1-10", Math.round(cum(10)), "w1-15", Math.round(cum(15)), "w1-20", Math.round(cum(20)), "invested", r.invested, "left", r.goldLeft);
}
const r0 = rows.find(r => r.lv === 0 && r.build === only);
console.log("erebuni " + only + " secs:", r0.secs.join(" "));
console.log("erebuni " + only + " trace:", r0.trace);
