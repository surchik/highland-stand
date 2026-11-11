// Does a tower get built while the game is paused, by a real click (mouse) and a real tap (phone)?
const { launch, openGame, ROOT } = require("/home/user/highland-stand/tools/regress/lib.js");
const path = require("path");
(async () => {
  const browser = await launch();
  for (const o of [{ w: 1600, h: 900 }, { w: 667, h: 320, touch: true }]) {
    const g = await openGame(browser, path.join(ROOT, "index.html"), o);
    await g.enterBattle(1, {});
    await g.frames(5);
    const before = await g.ev(() => ({ towers: towers.length, paused, gold, phase }));
    await g.press("#hudPause");
    await g.frames(3);
    const mid = await g.ev(() => ({ paused }));
    // choose the archer tile, then press pad 0
    await g.press('#shop .card[data-type="archer"]');
    await g.frames(2);
    const pt = await g.worldToClient(...(await g.ev(() => PADS[0])));
    if (o.touch) { await g.tapAt(pt.x, pt.y); await g.frames(3); await g.tapAt(pt.x, pt.y); } else await g.clickAt(pt.x, pt.y);
    await g.frames(5);
    const after = await g.ev(() => ({ towers: towers.length, paused, gold }));
    const t0 = await g.ev(() => ({ cd: Object.assign({}, spellCd) }));
    console.log(g.name, JSON.stringify({ before, mid, after }), g.errs.join(" | "));
    await g.close();
  }
  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
