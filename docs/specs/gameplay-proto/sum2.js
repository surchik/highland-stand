const fs = require("fs");
const load = f => fs.readFileSync(f, "utf8").split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l));
const A = load(process.argv[2]), B = load(process.argv[3]);
const ids = ["erebuni","tushpa","avarayr","dvin","tashir","sevan","ani","mari","sis","gyumri","halidzor","van","musadagh","sardarapat","stepanakert92","shushi","stepanakert23"];
const stat = (rows, lv) => {
  const rs = rows.filter(r => r.lv === lv && r.won);
  if (!rs.length) return null;
  const m = f => rs.reduce((s, r) => s + f(r), 0) / rs.length;
  return { n: rs.length, min: m(r => r.secs.reduce((a, b) => a + b, 0)) / 60, inv: m(r => r.invested), lives: m(r => r.lives), waves: rs[0].secs.length,
    masteries: m(r => (r.trace.split(" ").pop().split(":")[3].match(/[ab](?![0-9])/g) || []).length) };
};
console.log("field           | 20 waves: wins min@1x invested lives | new: N wins min@1x invested lives");
let ta = 0, tb = 0;
for (let lv = 0; lv < 17; lv++) {
  const a = stat(A, lv), b = stat(B, lv);
  ta += a ? a.min : 0; tb += b ? b.min : 0;
  console.log(ids[lv].padEnd(15), "|", a ? `${a.n}/7 ${a.min.toFixed(1).padStart(5)} ${Math.round(a.inv).toString().padStart(6)} ${a.lives.toFixed(1).padStart(5)}` : "none", "|",
    b ? `${String(b.waves).padStart(2)} ${b.n}/7 ${b.min.toFixed(1).padStart(5)} ${Math.round(b.inv).toString().padStart(6)} ${b.lives.toFixed(1).padStart(5)}` : "none");
}
console.log("campaign total minutes at 1x (wave time, winning runs):", ta.toFixed(0), "->", tb.toFixed(0));
const r = B.find(r => r.lv === 0 && r.build === "mix");
console.log("erebuni mix new secs:", r.secs.join(" "));
console.log("erebuni mix new trace:", r.trace);
