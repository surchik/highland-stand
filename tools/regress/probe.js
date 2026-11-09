// Tapping a tower selects it, on every battlefield: a tower of every kind and rank on every pad, and each one pressed
// on its drawn body (from the game's own projection), by mouse at 1600x900 (and 2000x1250) and by touch on an iPad
// at 1194x834. The press must open that tower's panel; a tower under a HUD element, a press that opens another
// tower's panel or none, and any page error fail.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/probe.js [index.html] [--quick] [--levels=0,ani] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const CONFIGS = o.quick ? [R.SIZES.desk, R.SIZES.ipad] : [R.SIZES.desk, R.SIZES.big, R.SIZES.ipad];
// the press lands on the tower's body: this far above its footing, in world units scaled with depth
const BODY = 30;

(async () => {
  const browser = await R.launch();
  const fails = [];
  let probed = 0;
  const ids = await (async () => { const g = await R.openGame(browser, o.file, R.SIZES.desk); const v = await g.ev(() => LEVELS.map(L => L.id)); await g.close(); return v; })();
  const levels = R.parseLevels(o.levels || (o.quick ? "tushpa,sis,stepanakert92" : "all"), ids);
  await R.pool(CONFIGS, CONFIGS.length, async (C) => {
    const g = await R.openGame(browser, o.file, C);
    const fail = async (m) => { fails.push(C.name + " " + m); await g.shot(o.shots, "probe " + C.name + " " + m.slice(0, 60)); };
    await g.toMap();
    for (const lv of levels) {
      const id = ids[lv];
      try {
        await g.enterBattle(lv);
        const n = await g.ev(lv => {
          gold = 1e6;
          const kinds = ["archer", "ballista", "catapult", "fire", "drums"];
          PADS.forEach((_, i) => { placeTower(kinds[(i + lv) % 5], i); const t = towerAt(i); if (t) t.level = (i + lv) % 3; });
          syncHud();
          return towers.length;
        }, lv);
        if (n !== await g.ev(() => PADS.length)) await fail(id + ": only " + n + " towers stand on " + (await g.ev(() => PADS.length)) + " pads");
        await g.frames(2);
        for (let k = 0; k < n; k++) {
          const t = await g.ev(k => ({ pad: towers[k].pad, x: towers[k].x, y: towers[k].y, type: towers[k].type, level: towers[k].level }), k);
          const tag = id + " " + t.type + " (rank " + (t.level + 1) + ") on pad " + t.pad;
          const pt = await g.worldToClient(t.x, t.y, -BODY);
          const hit = await g.hitName(pt.x, pt.y);
          if (hit !== "canvas#game") { await fail(tag + " at " + Math.round(pt.x) + "," + Math.round(pt.y) + " lies under " + hit); continue; }
          await g.tapAt(pt.x, pt.y);
          await g.frames(1);
          const s = await g.ev(() => ({ pad: selected ? selected.pad : -1, shown: panelEl.style.display === "block" }));
          if (s.pad !== t.pad || !s.shown) await fail(tag + ": the press " + (s.pad < 0 ? "selected nothing" : "selected the tower on pad " + s.pad) + (s.shown ? "" : ", no panel"));
          else probed++;
          await g.ev(() => hidePanel());
        }
        if (o.verbose) console.log(C.name + " " + id + " " + n + " towers");
      } catch (e) {
        await fail(id + ": " + e.message.split("\n")[0]);
      }
      const p = await g.problems();
      if (p.length) { await fail(id + ": " + p.join(" | ")); g.errs.length = 0; }
    }
    await g.close();
  });
  await browser.close();
  R.finish("probe", fails, { probed, configs: CONFIGS.map(c => c.name), levels: levels.length }, t0);
})().catch(e => { console.error(e); process.exit(1); });
