// script tables for N = 10..20 and the battle time each gives per battlefield, from the baseline's per-wave seconds
const fs = require("fs");
function table(N) {
  if (N === 20) return [...Array(20)].map((_, i) => i + 1);
  const t = [1, 2];
  for (let k = 3; k <= N; k++) t.push(Math.round(3 + (k - 3) * 17 / (N - 3)));
  // strictly increasing
  for (let i = 1; i < t.length; i++) if (t[i] <= t[i - 1]) t[i] = t[i - 1] + 1;
  // snap the nearest entry (not 1,2,3 or last) to 10 if absent
  if (!t.includes(10)) {
    let bi = -1, bd = 99;
    for (let i = 3; i < t.length - 1; i++) { const d = Math.abs(t[i] - 10); if (d < bd || (d === bd && t[i] > 10)) { bd = d; bi = i; } }
    t[bi] = 10;
  }
  t[t.length - 1] = 20;
  for (let i = 1; i < t.length; i++) if (t[i] <= t[i - 1]) throw new Error("not increasing " + N + ": " + t);
  return t;
}
const T = {};
for (let N = 10; N <= 20; N++) { T[N] = table(N); console.log(N, JSON.stringify(T[N]), "cmd at wave", T[N].indexOf(10) + 1); }
if (process.argv[2]) {
  const rows = fs.readFileSync(process.argv[2], "utf8").split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l));
  const ids = ["erebuni","tushpa","avarayr","dvin","tashir","sevan","ani","mari","sis","gyumri","halidzor","van","musadagh","sardarapat","stepanakert92","shushi","stepanakert23"];
  console.log("\nwave time at 1x in minutes for N waves (mean over winning runs of the baseline; one wave of the table = its script wave's seconds)");
  console.log("field".padEnd(15) + [10,11,12,13,14,15,16,17,18,19,20].map(n => String(n).padStart(6)).join(""));
  for (let lv = 0; lv < 17; lv++) {
    const rs = rows.filter(r => r.lv === lv && r.won && r.secs.length === 20);
    if (!rs.length) { console.log(ids[lv], "no full run"); continue; }
    const mean = Array.from({ length: 20 }, (_, i) => rs.reduce((s, r) => s + r.secs[i], 0) / rs.length);
    let line = ids[lv].padEnd(15);
    for (let N = 10; N <= 20; N++) line += (T[N].reduce((s, w) => s + mean[w - 1], 0) / 60).toFixed(1).padStart(6);
    console.log(line);
  }
}
