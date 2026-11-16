// for every pad and plot of every battlefield: the least ground-range radius at which some road point is in reach
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("file://" + process.argv[2] + "?shot=battle&lv=0&wave=1");
  await p.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 180000 });
  const out = await p.evaluate(() => LEVELS.map((L, i) => {
    curLevel = i; resetGame();
    const need = (x, y) => {
      let best = 1e9;
      ROUTES.forEach((R, ri) => { for (let d = 0; d <= R.len; d += 6) { const q = routeAt(ri, d); if (q.x < 0 || q.x > VW) continue; const r = Math.hypot(q.x - x, (q.y - y) / ELLIPSE); if (r < best) best = r; } });
      return Math.round(best);
    };
    const pads = PADS.map(q => need(q[0], q[1])), pl = (L.plots || []).map(q => need(q[0], q[1]));
    return { id: L.id, padMax: Math.max(...pads), padsOver115: pads.filter(v => v > 115).length, pads: pads.join(","), plotMax: pl.length ? Math.max(...pl) : 0, plotsOver115: pl.filter(v => v > 115).length };
  }));
  for (const o of out) console.log(o.id.padEnd(14), "pad max", o.padMax, "over115:", o.padsOver115, "| plot max", o.plotMax, "over115:", o.plotsOver115, "|", o.pads);
  await b.close();
})();
