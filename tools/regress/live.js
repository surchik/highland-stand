// Every battlefield played live for three waves at 4x, with sound: the page in its real loop (requestAnimationFrame,
// the Web Audio graph opened by the first click), the stand begun from its chronicle, test gold taken with Shift+G,
// six towers built from the tray on the pads that watch the most road, the secret 4x speed taken by Shift+click on
// the speed button, the first wave sent and Auto turned on, until the third wave is repelled. Fails on any page error,
// any console error, the game's crash card, an exception inside a sound (the sound engine swallows its own errors;
// here they are counted), a silent audio graph, or a stand lost in three waves. A trick's first-time card that is up
// when the stand is left is put away by its button (a fresh save meets each card once). By mouse at 1600x900.
// The Garrison Post (G5): a post is built from its tile on the best free pad with road in reach, its panel opened by a
// click on it, Rally point pressed and the road in its ring clicked: its rally must move, and its men fight the three
// waves. (The battlefield's special tower is built here too once one is in the game, G7.)
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/live.js [index.html] [--quick] [--levels=0,ani] [--jobs=3] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const WAVES = 3;
const TYPES = ["archer", "ballista", "catapult", "fire", "drums", "archer"];

(async () => {
  const browser = await R.launch({ audio: true });
  const fails = [];
  const res = {};
  const ids = await (async () => { const g = await R.openGame(browser, o.file, R.SIZES.desk); const v = await g.ev(() => LEVELS.map(L => L.id)); await g.close(); return v; })();
  const levels = R.parseLevels(o.levels || (o.quick ? "erebuni,sis,stepanakert23" : "all"), ids);
  // each worker keeps one page, as a player keeps one tab, and plays its battlefields one after another
  const queue = levels.slice();
  const workers = Math.max(1, Math.min(o.jobs || 3, queue.length));
  await Promise.all(Array.from({ length: workers }, async () => {
    const g = await R.openGame(browser, o.file, R.SIZES.desk);
    await g.ev(() => {
      // the sound engine catches whatever a sound throws (a sound must never break the game); count it here
      window.__sndErrs = [];
      const fire = Snd.fire;
      Snd.fire = function (name) { try { return fire.apply(this, arguments); } catch (e) { window.__sndErrs.push(name + ": " + (e && e.message || e)); throw e; } };
    });
    await g.toMap();
    while (queue.length) {
      const lv = queue.shift(), id = ids[lv];
      const fail = async (m) => { fails.push(id + ": " + m); await g.shot(o.shots, "live " + id + " " + m.slice(0, 60)); };
      const t1 = Date.now();
      try {
        await g.enterBattle(lv);
        await g.page.keyboard.press("Shift+G");
        await g.frames(2);
        if (await g.ev(() => gold) < 2000) await fail("Shift+G gave no test gold");
        // the pads that watch the most road, best first
        const pads = await g.ev(() => {
          const pts = [];
          for (let ri = 0; ri < ROUTES.length; ri++) for (let k = 0; k <= 80; k++) pts.push(routeAt(ri, ROUTES[ri].len * k / 80));
          return PADS.map((p, i) => ({ i, n: pts.filter(q => inGroundRange(p[0], p[1], q.x, q.y, 170)).length }))
            .sort((a, b) => b.n - a.n).slice(0, 6).map(x => x.i);
        });
        for (let k = 0; k < pads.length; k++) {
          const type = TYPES[k];
          if (await g.ev(() => placing) !== type) await g.press('#shop .card[data-type="' + type + '"]');
          const p = await g.ev(i => PADS[i], pads[k]);
          const pt = await g.worldToClient(p[0], p[1], 4);
          await g.tapAt(pt.x, pt.y);
          await g.frames(1);
        }
        // the Garrison Post, and its rally moved by a click on the road in its ring
        const pp = await g.ev(() => PADS.map((p, i) => i).filter(i => !towerAt(i) && padTakesPost(i))
          .map(i => ({ i, n: postRoadIn(PADS[i][0], PADS[i][1], TOWER_DEFS.post.levels[0].reach).length })).sort((a, b) => b.n - a.n).map(x => x.i)[0]);
        if (pp === undefined) await fail("no free pad takes a post");
        else {
          if (await g.ev(() => placing) !== "post") await g.press('#shop .card[data-type="post"]');
          const p = await g.ev(i => PADS[i], pp);
          const pt = await g.worldToClient(p[0], p[1], 4);
          await g.tapAt(pt.x, pt.y);
          await g.frames(1);
          await g.page.keyboard.press("Escape");
          const body = await g.worldToClient(p[0], p[1], -30);
          await g.tapAt(body.x, body.y);
          await g.frames(2);
          if (!(await g.ev(i => selected && selected.pad === i && selected.type === "post", pp))) await fail("a click on the post did not open its panel");
          else {
            await g.press("#pRally");
            const to = await g.ev(i => {
              const t = towerAt(i), pts = postRoadIn(t.x, t.y, postReach(t));
              const s = pts.sort((a, b) => Math.hypot(b.x - t.rally.x, b.y - t.rally.y) - Math.hypot(a.x - t.rally.x, a.y - t.rally.y))
                .find(s => !towers.some(u => Math.hypot(u.x - s.x, u.y - s.y) < 40) && !(hero && Math.hypot(hero.x - s.x, hero.y - s.y) < 40));
              return s && { x: s.x, y: s.y };
            }, pp);
            if (to) {
              const c = await g.worldToClient(to.x, to.y, 0);
              await g.tapAt(c.x, c.y);
              await g.frames(1);
              const d = await g.ev(([i, to]) => { const t = towerAt(i); return Math.hypot(t.rally.x - to.x, t.rally.y - to.y); }, [pp, to]);
              if (d > 12) await fail("the click on the road left the rally " + Math.round(d) + " px off");
            }
          }
        }
        await g.page.keyboard.press("Escape");
        const built = await g.ev(() => towers.length);
        if (built < pads.length + 1) await fail("only " + built + " of " + (pads.length + 1) + " towers were built");
        // the secret fourth gear, Send Wave, and Auto for the waves after
        const sp = await g.reach("#speedBtn");
        if (sp.why) throw new Error("the speed button: " + sp.why);
        await g.clickAt(sp.x, sp.y, { shift: true });
        await g.frames(2);
        if (await g.ev(() => speedMult) !== 4) await fail("Shift+click on the speed button did not give 4x");
        await g.press("#waveBtn");
        await g.press("#autoBtn");
        const snd = await g.ev(() => ({ ctx: !!Snd.ctx, state: Snd.ctx && Snd.ctx.state, music: Snd.musicOn, sfx: Snd.sfxOn }));
        if (!snd.ctx || snd.state !== "running" || !snd.sfx || !snd.music) await fail("the sound is not playing: " + JSON.stringify(snd));
        const v0 = await g.ev(() => Snd.stats.voices || 0);
        await g.page.waitForFunction(n => gameOver || (waveIdx >= n && phase === "idle"), WAVES, { timeout: 300000, polling: 250 });
        const end = await g.ev(() => ({ waveIdx, lives, gameOver, speedMult, voices: Snd.stats.voices || 0, state: Snd.ctx && Snd.ctx.state, sndErrs: window.__sndErrs.slice() }));
        if (end.gameOver) await fail("the stand fell by wave " + end.waveIdx);
        if (end.speedMult !== 4) await fail("the battle left 4x (" + end.speedMult + "x)");
        if (end.voices <= v0) await fail("no sound was played in " + WAVES + " waves");
        if (end.state !== "running") await fail("the audio context is " + end.state);
        if (end.sndErrs.length) { await fail("sounds threw: " + [...new Set(end.sndErrs)].slice(0, 5).join(" | ")); await g.ev(() => { window.__sndErrs.length = 0; }); }
        const post = await g.ev(() => { const t = towers.find(u => u.type === "post"); return t ? { dmg: Math.round(t.dmgDone || 0), hold: Math.round(t.holdS || 0) } : null; });
        res[id] = { s: Math.round((Date.now() - t1) / 1000), lives: end.lives, voices: end.voices - v0, post };
        if (o.verbose) console.log(id + " " + JSON.stringify(res[id]));
      } catch (e) {
        await fail(e.message.split("\n")[0]);
      }
      const p = await g.problems();
      if (p.length) { await fail(p.join(" | ")); g.errs.length = 0; }
      // the battle left as a player leaves it: a trick's first-time card that came up for the next wave (Tushpa's
      // shields come on wave 4, so the card shows once wave 3 is repelled) put away by its button, then Settings,
      // Abandon, and Abandon again to confirm
      try {
        await g.ev(() => { if (speedMult !== 1) setSpeed(1); auto = false; autoBtn.textContent = "Auto: Off"; autoBtn.classList.remove("on"); });
        if (await g.ev(() => !!document.querySelector("#trickCard.on"))) {
          await g.press("#tcBtn");
          await g.frames(2);
          if (await g.ev(() => !!document.querySelector("#trickCard.on"))) await fail("the trick card's button did not put it away");
          else if (res[id]) res[id].card = true;
        }
        if (!await g.ev(() => gameOver)) {
          await g.press("#gearBtn");
          await g.press("#menuBtn");
          await g.press("#menuBtn");
          await g.frames(2);
          if (!await g.ev(() => gameOver && !overlayEl.classList.contains("hidden"))) await fail("Abandon did not leave the battle");
        }
      } catch (e) { await fail("leaving: " + e.message.split("\n")[0]); }
    }
    await g.close();
  }));
  await browser.close();
  R.finish("live", fails, { levels: levels.length, played: res }, t0);
})().catch(e => { console.error(e); process.exit(1); });
