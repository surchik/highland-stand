// The owner's bands (gameplay.final.md 5.1) read off the balance bot's battles.
// Usage: node tools/balance-bands.js out.txt [more.txt ...], where each file holds JSON=1 lines of tools/balance.js.
// For each difficulty and battlefield: the best build and the defenders it kept on each seed ("L12": lost on wave 12),
// the mix's wins and seeds, the best build's wave time in minutes against 1.2's target, and a flag where a band is
// missed: BAND (Normal: 12-16 on every seed on the first six, 10-15 on two of three on the later eleven), MIX (the
// mix lost a seed where it must win), CMD (commanders reached the walls), TIME (more than 15% off 1.2's target),
// MIXBAND (Easy: the mix keeps about 22-27 of 30 on the first six), KEEP (Hard: a victory kept outside 2-8 of 14).
const fs = require("fs");
const rs = [];
for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f, "utf8").split("\n")) if (l.startsWith("{")) rs.push(JSON.parse(l));
const IDS = ["erebuni","tushpa","avarayr","dvin","tashir","sevan","ani","mari","sis","gyumri","halidzor","van","musadagh","sardarapat","stepanakert92","shushi","stepanakert23"];
const TGT = { erebuni: 17, tushpa: 19, avarayr: 30, dvin: 19, tashir: 17, sevan: 27, ani: 29, mari: 15, sis: 40, gyumri: 28, halidzor: 26, van: 35, musadagh: 23, sardarapat: 35, stepanakert92: 38, shushi: 20, stepanakert23: 15 };
const score = x => x.filter(r => r.won).length * 1000 + x.reduce((s, r) => s + r.lives + r.wave * 10 * !r.won, 0) / x.length;
for (const d of [...new Set(rs.map(r => r.diff))].sort()) {
  console.log("diff " + ["Easy","Normal","Hard"][d]);
  let mix2 = 0, mix0 = 0, later = 0, hardWins = 0;
  for (const lv of [...new Set(rs.filter(r => r.diff === d).map(r => r.lv))].sort((a, b) => a - b)) {
    const here = rs.filter(r => r.diff === d && r.lv === lv), builds = [...new Set(here.map(r => r.build))];
    let best = null;
    for (const b of builds) { const x = here.filter(r => r.build === b); if (!best || score(x) > score(best.x)) best = { b, x }; }
    const mix = here.filter(r => r.build === "mix");
    const mw = mix.filter(r => r.won).length;
    const lives = best.x.map(r => r.won ? r.lives : "L" + r.wave).join(" ");
    const cmd = best.x.reduce((s, r) => s + r.cmd, 0);
    const wt = best.x.filter(r => r.won).map(r => r.waveSec / 60);
    const wmin = wt.length ? wt.reduce((a, b) => a + b, 0) / wt.length : null;
    const tg = TGT[IDS[lv]];
    let flag = "";
    if (d === 1) {
      const n = best.x.length, inb = (lo, hi) => best.x.filter(r => r.won && r.lives >= lo && r.lives <= hi).length;
      if (lv <= 5) { if (inb(12, 16) < n) flag += " BAND(12-16)"; if (mw < n) flag += " MIX"; }
      else { later++; if (inb(10, 15) < Math.ceil(n * 2 / 3)) flag += " BAND(10-15)"; if (mw >= 2) mix2++; if (mw === 0) mix0++; }
      if (cmd) flag += " CMD" + cmd;
      if (wmin !== null && Math.abs(wmin / tg - 1) > 0.15) flag += " TIME";
    }
    if (d === 0) { if (mw < mix.length) flag += " MIX"; if (lv <= 5 && mix.some(r => r.lives < 22 || r.lives > 27)) flag += " MIXBAND(22-27)"; }
    if (d === 2) { const w = best.x.filter(r => r.won).length; if (w >= 2) hardWins++; if (best.x.some(r => r.won && (r.lives < 2 || r.lives > 8))) flag += " KEEP(2-8)"; }
    console.log("  " + String(lv).padStart(2) + " " + IDS[lv].padEnd(14) + (best.b + "").padEnd(10) + lives.padEnd(14) + " mix " + mw + "/" + mix.length + " " + mix.map(r => r.won ? r.lives : "L" + r.wave).join(" ").padEnd(12) +
      (wmin !== null ? " wave " + wmin.toFixed(1) + "/" + tg : "") + flag);
  }
  if (d === 1) console.log("  later eleven: mix wins 2+/3 on " + mix2 + " (need 8), 0/3 on " + mix0 + " (at most 1)");
  if (d === 2) {
    const all = rs.filter(r => r.diff === 2);
    console.log("  Hard: best wins 2+/3 on " + hardWins + " (need 12)");
  }
  // one-recipe builds on the first six
  for (const b of ["ballista", "archers"]) {
    const x = rs.filter(r => r.diff === d && r.lv <= 5 && r.build === b);
    if (x.length) console.log("  " + b + " loses " + x.filter(r => !r.won).length + " of " + x.length + " on the first six");
  }
  const adapt = b => { const x = rs.filter(r => r.diff === d && r.build === b); const w = x.reduce((s, r) => s + r.adaptW, 0); return w ? Math.round(100 * x.reduce((s, r) => s + r.adaptOn, 0) / w) + "%" : "-"; };
  console.log("  adapted: " + ["mix", "balldrum", "ballista", "archers", "archdrum", "catapults", "firemix"].map(b => b + " " + adapt(b)).join(" "));
}
