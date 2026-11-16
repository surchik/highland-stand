// Tapping a tower selects it, on every battlefield: a tower of every kind and rank on every pad, and each one pressed
// on its drawn body (from the game's own projection), by mouse at 1600x900 (and 2000x1250) and by touch on an iPad
// at 1194x834. The press must open that tower's panel; a tower under a HUD element, a press that opens another
// tower's panel or none, and any page error fail. The Garrison Post (G5) stands on every pad with road in its reach
// (by turns with the five, at every rank and both masteries); on one post of each battlefield Rally point is pressed,
// then the road inside its ring where it is drawn: the men's rally point must move there, the panel go, and nothing
// else (a panel, land, the hero) take the press. A phone pass (667x320, touch) does the same on three battlefields.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/probe.js [index.html] [--quick] [--levels=0,ani] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const PHONE = { name: "touch phone 667x320", w: 667, h: 320, touch: true, ua: require(process.env.PW_PATH || "playwright").devices["iPhone 15"].userAgent, phone: true };
const CONFIGS = o.quick ? [R.SIZES.desk, R.SIZES.ipad, PHONE] : [R.SIZES.desk, R.SIZES.big, R.SIZES.ipad, PHONE];
// the press lands on the tower's body: this far above its footing, in world units scaled with depth
const BODY = 30;

(async () => {
  const browser = await R.launch();
  const fails = [];
  let probed = 0, rallies = 0;
  const ids = await (async () => { const g = await R.openGame(browser, o.file, R.SIZES.desk); const v = await g.ev(() => LEVELS.map(L => L.id)); await g.close(); return v; })();
  const levels = R.parseLevels(o.levels || (o.quick ? "tushpa,sis,stepanakert92" : "all"), ids);
  await R.pool(CONFIGS, CONFIGS.length, async (C) => {
    const g = await R.openGame(browser, o.file, C);
    const fail = async (m) => { fails.push(C.name + " " + m); await g.shot(o.shots, "probe " + C.name + " " + m.slice(0, 60)); };
    await g.toMap();
    const mine = C.phone ? levels.filter((_, j) => j % Math.max(1, Math.ceil(levels.length / 3)) === 0) : levels;
    for (const lv of mine) {
      const id = ids[lv];
      try {
        await g.enterBattle(lv);
        const n = await g.ev(lv => {
          gold = 1e6;
          const kinds = ["archer", "ballista", "catapult", "fire", "drums", "post"];
          PADS.forEach((_, i) => {
            let k = kinds[(i + lv) % 6];
            if (k === "post" && !padTakesPost(i)) k = kinds[(i + lv + 1) % 6];
            placeTower(k, i);
            const t = towerAt(i);
            if (!t) return;
            t.level = (i + lv) % 3;
            // a post at its third rank takes a mastery by turns: every rank and both masteries are pressed
            if (k === "post" && t.level === 2 && i % 2) { t.spec = i % 4 === 1 ? "a" : "b"; }
            if (k === "post") postSyncMen(t, true);
          });
          syncHud();
          return towers.length;
        }, lv);
        if (n !== await g.ev(() => PADS.length)) await fail(id + ": only " + n + " towers stand on " + (await g.ev(() => PADS.length)) + " pads");
        await g.frames(2);
        let rallied = false;
        const rally = async (tag, pad) => {
          // a panel opened by a finger takes no press until the finger is up and a beat has passed (settlePanel)
          if (g.touch) await g.wait(450);
          await g.press("#pRally");
          await g.wait(120);
          const a = await g.ev(pad => {
            const t = towerAt(pad), pts = postRoadIn(t.x, t.y, postReach(t));
            // the road point of the ring furthest from the rally point now, on the screen and clear of the HUD
            const r = canvas.getBoundingClientRect(), on = s => { const p = proj(s.x, s.y); return { x: r.left + offX + p.x * scale, y: r.top + offY + p.y * scale }; };
            const ok = pts.filter(s => { const c = on(s), e = document.elementFromPoint(c.x, c.y); return e && e.id === "game" && !towers.some(u => Math.hypot(u.x - s.x, u.y - s.y) < 40) && !(hero && Math.hypot(hero.x - s.x, hero.y - s.y) < 40); });
            const s = ok.sort((a, b) => Math.hypot(b.x - t.rally.x, b.y - t.rally.y) - Math.hypot(a.x - t.rally.x, a.y - t.rally.y))[0];
            return { armed: rallying === t, panel: panelEl.style.display === "block", s, c: s && on(s), hero: hero && hero.rally, plots: plotsBought };
          }, pad);
          if (!a.armed || a.panel) { await fail(tag + ": Rally point did not arm (" + (a.panel ? "the panel stayed" : "not armed") + ")"); return; }
          if (!a.s) { await fail(tag + ": no road of the ring is clear to press"); return; }
          await g.tapAt(a.c.x, a.c.y);
          await g.frames(1);
          const b = await g.ev(([pad, s]) => { const t = towerAt(pad); return { d: Math.hypot(t.rally.x - s.x, t.rally.y - s.y), armed: !!rallying, sel: selected ? selected.pad : -1, hero: hero && hero.rally, plots: plotsBought }; }, [pad, a.s]);
          if (b.d > 12 || b.armed) await fail(tag + ": the press on the road left the rally " + Math.round(b.d) + " px off" + (b.armed ? ", still armed" : ""));
          if (b.sel >= 0 || b.hero || b.plots !== a.plots) await fail(tag + ": the press on the road also " + (b.sel >= 0 ? "opened a panel" : b.hero ? "moved the hero" : "bought land"));
          else rallies++;
        };
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
          // the first post of the battlefield: its rally moved by Rally point and a press on the road in the ring
          if (s.pad === t.pad && s.shown && t.type === "post" && !rallied) { rallied = true; await rally(tag, t.pad); }
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
  R.finish("probe", fails, { probed, rallies, configs: CONFIGS.map(c => c.name), levels: levels.length }, t0);
})().catch(e => { console.error(e); process.exit(1); });
