// Every plot of every battlefield is bought through its price sign, as a player buys one: a press on the signboard
// where it is drawn this frame (the game's own record of the board's box, plotSignRects), by mouse at 1600x900 and by
// touch on an iPad at 1194x834. Twice per battlefield: on an empty field, where each claimed plot then takes a tower
// by the tray and a press on the new pad; and on a field with a tower on every pad (where plots are bought in a
// real stand), whose towers must not catch the press. A sign off screen or under a HUD element, a press that buys
// another plot, none, or opens a tower's panel, and any page error fail.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/plots.js [index.html] [--quick] [--levels=0,ani] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const CONFIGS = [R.SIZES.desk, R.SIZES.ipad];
const TYPES = ["archer", "ballista", "catapult", "fire", "drums"];

(async () => {
  const browser = await R.launch();
  const fails = [];
  let bought = 0;
  const ids = await (async () => { const g = await R.openGame(browser, o.file, R.SIZES.desk); const v = await g.ev(() => LEVELS.map(L => L.id)); await g.close(); return v; })();
  const levels = R.parseLevels(o.levels || (o.quick ? "erebuni,mari,shushi" : "all"), ids);
  await R.pool(CONFIGS, CONFIGS.length, async (C) => {
    const g = await R.openGame(browser, o.file, C);
    const fail = async (m) => { fails.push(C.name + " " + m); await g.shot(o.shots, "plots " + C.name + " " + m.slice(0, 60)); };
    await g.toMap();
    // the client point of plot k's signboard, as drawn in the last frame
    const signOf = (k) => g.ev(k => {
      const p = plots[k], rc = p && plotSignRects.get(p);
      if (!rc) return null;
      const r = canvas.getBoundingClientRect();
      const cx = (rc[0] + rc[2]) / 2, cy = (rc[1] + rc[3]) / 2;
      return { plot: p.slice(), x: r.left + offX + cx * scale, y: r.top + offY + cy * scale, w: (rc[2] - rc[0]) * scale, h: (rc[3] - rc[1]) * scale };
    }, k);
    const buyAll = async (id, phase, buildOn) => {
      const n = await g.ev(() => plots.length);
      if (!n) { await fail(id + " " + phase + ": no plots"); return; }
      for (let j = 0; j < n; j++) {
        await g.frames(2);
        // the last plot, then the first, and so on: the signs left move as the field fills
        const k = j % 2 ? 0 : (await g.ev(() => plots.length)) - 1;
        const s = await signOf(k);
        if (!s) { await fail(id + " " + phase + ": plot " + k + " has no sign drawn"); return; }
        const tag = id + " " + phase + " plot [" + s.plot.map(Math.round) + "]";
        const hit = await g.hitName(s.x, s.y);
        if (hit !== "canvas#game") { await fail(tag + ": its sign at " + Math.round(s.x) + "," + Math.round(s.y) + " lies under " + hit); return; }
        const b = await g.ev(() => ({ plots: plots.length, pads: PADS.length, gold, price: plotPrice() }));
        await g.tapAt(s.x, s.y);
        await g.frames(1);
        const a = await g.ev(() => ({ plots: plots.length, pads: PADS.length, gold, last: PADS[PADS.length - 1], panel: panelEl.style.display === "block", sel: selected ? selected.pad : -1 }));
        if (a.panel) { await fail(tag + ": the press on its sign opened the panel of the tower on pad " + a.sel); await g.ev(() => hidePanel()); return; }
        if (a.plots !== b.plots - 1 || a.pads !== b.pads + 1) { await fail(tag + ": the press on its sign bought nothing"); return; }
        if (Math.round(a.last[0]) !== Math.round(s.plot[0]) || Math.round(a.last[1]) !== Math.round(s.plot[1])) { await fail(tag + ": the press bought the plot at [" + a.last.map(Math.round) + "]"); return; }
        if (Math.abs(b.gold - b.price - a.gold) > 0.5) { await fail(tag + ": paid " + (b.gold - a.gold) + " for a price of " + b.price); }
        bought++;
        if (!buildOn) continue;
        // the new ground takes a tower, from the tray, by a press on the pad where it is drawn
        const type = TYPES[j % TYPES.length], pi = a.pads - 1;
        await g.press('#shop .card[data-type="' + type + '"]');
        const pt = await g.worldToClient(a.last[0], a.last[1], 4);
        const ph = await g.hitName(pt.x, pt.y);
        if (ph !== "canvas#game") { await fail(tag + ": the claimed pad lies under " + ph); }
        else {
          await g.tapAt(pt.x, pt.y);
          if (g.touch) { await g.frames(1); await g.tapAt(pt.x, pt.y); }
          await g.frames(1);
          const t = await g.ev(pi => { const t = towerAt(pi); return t ? t.type : null; }, pi);
          if (t !== type) await fail(tag + ": the claimed pad took no " + type + " (" + t + ")");
        }
        // the card pressed again puts the tower away, so the next sign is pressed as a plain tap on the field
        if (await g.ev(() => placing)) await g.press('#shop .card[data-type="' + type + '"]');
        if (await g.ev(() => placing)) await fail(tag + ": a second press on the card did not put the tower away");
      }
      const left = await g.ev(() => plots.length);
      if (left) await fail(id + " " + phase + ": " + left + " plots left unbought");
    };
    for (const lv of levels) {
      const id = ids[lv];
      try {
        await g.enterBattle(lv);
        await g.ev(() => { gold = 1e6; syncHud(); });
        await buyAll(id, "empty field", true);
        await g.enterBattle(lv);
        await g.ev(() => {
          gold = 1e6;
          const kinds = ["archer", "ballista", "catapult", "fire", "drums"];
          PADS.forEach((_, i) => { placeTower(kinds[i % 5], i); const t = towerAt(i); if (t) t.level = i % 3; });
          gold = 1e6; syncHud();
        });
        await buyAll(id, "full field", false);
        if (o.verbose) console.log(C.name + " " + id + " ok");
      } catch (e) {
        await fail(id + ": " + e.message.split("\n")[0]);
      }
      const p = await g.problems();
      if (p.length) { await fail(id + ": " + p.join(" | ")); g.errs.length = 0; }
    }
    await g.close();
  });
  await browser.close();
  R.finish("plots", fails, { bought, configs: CONFIGS.map(c => c.name), levels: levels.length }, t0);
})().catch(e => { console.error(e); process.exit(1); });
