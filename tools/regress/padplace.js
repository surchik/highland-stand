// Every pad of every battlefield takes a tower, placed as a player places one: the tower's card pressed in the tray,
// then the pad itself pressed where it is drawn on the screen (the center of its paved ring, from the game's own
// projection), by mouse at 1600x900 and 2000x1250 and by touch on an iPad at 1194x834 (a first tap shows the reach,
// a second builds). A pad under a HUD element, a press that builds on another pad or on none, and any page error fail.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/padplace.js [index.html] [--quick] [--levels=0,ani] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const TYPES = ["archer", "ballista", "catapult", "fire", "drums"];
const CONFIGS = o.quick ? [R.SIZES.desk, R.SIZES.ipad] : [R.SIZES.desk, R.SIZES.big, R.SIZES.ipad];

(async () => {
  const browser = await R.launch();
  const fails = [];
  let placed = 0;
  const ids = await (async () => { const g = await R.openGame(browser, o.file, R.SIZES.desk); const v = await g.ev(() => LEVELS.map(L => L.id)); await g.close(); return v; })();
  const levels = R.parseLevels(o.levels || (o.quick ? "erebuni,ani,stepanakert23" : "all"), ids);
  await R.pool(CONFIGS, CONFIGS.length, async (C) => {
    const g = await R.openGame(browser, o.file, C);
    const fail = async (m) => { fails.push(C.name + " " + m); await g.shot(o.shots, "padplace " + C.name + " " + m.slice(0, 60)); };
    await g.toMap();
    for (const lv of levels) {
      const id = ids[lv];
      try {
        await g.enterBattle(lv);
        await g.ev(() => { gold = 1e6; syncHud(); });
        const n = await g.ev(() => PADS.length);
        for (let i = 0; i < n; i++) {
          const type = TYPES[(i + lv) % TYPES.length];
          if (await g.ev(() => placing) !== type) await g.press('#shop .card[data-type="' + type + '"]');
          if (await g.ev(() => placing) !== type) { await fail(id + " pad " + i + ": the " + type + " card did not choose its tower"); continue; }
          const pad = await g.ev(i => PADS[i], i);
          const pt = await g.worldToClient(pad[0], pad[1], 4);
          const hit = await g.hitName(pt.x, pt.y);
          if (hit !== "canvas#game") { await fail(id + " pad " + i + " at " + Math.round(pt.x) + "," + Math.round(pt.y) + " lies under " + hit); continue; }
          const before = await g.ev(() => towers.map(t => t.pad));
          if (g.touch) {
            await g.tapAt(pt.x, pt.y);
            await g.frames(1);
            const armed = await g.ev(() => touchArmedPad);
            if (armed !== i) { await fail(id + " pad " + i + ": the first tap armed " + (armed < 0 ? "no pad" : "pad " + armed)); continue; }
            if (await g.ev(() => towers.length) !== before.length) { await fail(id + " pad " + i + ": the first tap built at once"); continue; }
          }
          await g.tapAt(pt.x, pt.y);
          await g.frames(1);
          const after = await g.ev(() => towers.map(t => ({ pad: t.pad, type: t.type })));
          const added = after.filter(t => !before.includes(t.pad));
          if (added.length !== 1) { await fail(id + " pad " + i + ": " + added.length + " towers built"); continue; }
          if (added[0].pad !== i) { await fail(id + " pad " + i + ": the press built on pad " + added[0].pad); continue; }
          if (added[0].type !== type) { await fail(id + " pad " + i + ": built a " + added[0].type + ", not a " + type); continue; }
          placed++;
        }
        const left = await g.ev(() => PADS.map((_, i) => i).filter(i => !towerAt(i)));
        if (left.length) await fail(id + ": pads without a tower at the end: " + left.join(","));
        if (o.verbose) console.log(C.name + " " + id + " " + n + " pads");
      } catch (e) {
        await fail(id + ": " + e.message.split("\n")[0]);
      }
      const p = await g.problems();
      if (p.length) { await fail(id + ": " + p.join(" | ")); g.errs.length = 0; }
    }
    await g.close();
  });
  await browser.close();
  R.finish("padplace", fails, { placed, configs: CONFIGS.map(c => c.name), levels: levels.length }, t0);
})().catch(e => { console.error(e); process.exit(1); });
