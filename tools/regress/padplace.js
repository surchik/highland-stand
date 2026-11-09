// Every pad of every battlefield takes a tower, placed as a player places one: the tower's card pressed in the tray,
// then the pad itself pressed where it is drawn on the screen (the center of its paved ring, from the game's own
// projection), by mouse and by touch at 1600x900 and 2000x1250 and by touch on an iPad at 1194x834 (a first tap shows
// the reach, a second builds). A pad under a HUD element, a press that builds on another pad or on none, and any page error fail.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/padplace.js [index.html] [--quick] [--levels=0,ani] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const TYPES = ["archer", "ballista", "catapult", "fire", "drums"];
// by mouse and by touch at 1600x900 and 2000x1250 (a touch laptop or a large tablet), and by touch on the iPad
const CONFIGS = o.quick ? [R.SIZES.desk, R.SIZES.ipad] : [R.SIZES.desk, R.SIZES.big, R.SIZES.ipad,
  Object.assign({}, R.SIZES.desk, { name: "touch 1600x900", touch: true, dpr: 1 }), Object.assign({}, R.SIZES.big, { name: "touch 2000x1250", touch: true, dpr: 1 })];

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
          // the pad's paved ring on the screen, what lies over it, and the field before the press
          const q = await g.ev(([i, type]) => {
            const r = canvas.getBoundingClientRect(), p = proj(PADS[i][0], PADS[i][1]);
            const x = r.left + offX + p.x * scale, y = r.top + offY + (p.y + 4 * p.s) * scale, e = document.elementFromPoint(x, y);
            return { x, y, placing, hit: e ? e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).join(".") : "") : "nothing",
              before: towers.map(t => t.pad) };
          }, [i, type]);
          const at = id + " pad " + i + " (" + Math.round(q.x) + "," + Math.round(q.y) + ")";
          if (q.placing !== type) { await fail(at + ": the " + type + " card did not choose its tower"); continue; }
          if (q.hit !== "canvas#game") { await fail(at + " lies under " + q.hit); continue; }
          if (g.touch) {
            await g.tapAt(q.x, q.y);
            await g.frames(1);
            const a = await g.ev(() => ({ armed: touchArmedPad, n: towers.length }));
            if (a.armed !== i) { await fail(at + ": the first tap armed " + (a.armed < 0 ? "no pad" : "pad " + a.armed)); continue; }
            if (a.n !== q.before.length) { await fail(at + ": the first tap built at once"); continue; }
          }
          await g.tapAt(q.x, q.y);
          await g.frames(1);
          const added = await g.ev(before => towers.filter(t => !before.includes(t.pad)).map(t => ({ pad: t.pad, type: t.type })), q.before);
          if (added.length !== 1) { await fail(at + ": " + added.length + " towers built"); continue; }
          if (added[0].pad !== i) { await fail(at + ": the press built on pad " + added[0].pad); continue; }
          if (added[0].type !== type) { await fail(at + ": built a " + added[0].type + ", not a " + type); continue; }
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
