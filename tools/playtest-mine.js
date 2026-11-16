// Playtest 3 of gameplay 8.4 for the Powder Mine (G7c): Gyumri Road by touch, as a player plays it, on the iPad
// (1194x834), an iPhone 15 (852x393) and an iPhone SE (667x320), both held sideways in Safari. Every press is a finger's (tools/regress/lib.js tapAt,
// press): the tray's tiles, the pads (a first tap shows the reach, a second builds), the mine and its panel's buttons,
// the road, the charge's marker, Send Wave, the speed button and Auto. The board: archers, a ballista, a catapult and a
// fire on the pads that watch the most road, then a Powder Mine from its tile on the free pad whose reach holds the most
// road. Its panel is opened by a tap on its body; Lay the charge is pressed and the road point of its ring that the
// most of those towers reach is tapped (the charge must lie there); the trigger is pressed round to "by hand"; Upgrade
// raises it a rank. The shooters are raised to their third rank by script (the test is about the mine). Then the waves
// at 2x with Auto, and each time the armed charge has a crowd over it (3 seen ground foes or more in its blast) its
// marker is tapped by a finger: five such blasts are asked for. It fails on a page error, a charge that does not lie
// where the road was tapped, a trigger that fires by itself while set by hand, a tap on the marker that does not fire
// or opens a panel, fewer than five blasts on a crowd before the battle ends, or a stand lost before them. It prints
// each blast (the wave, the foes caught, the damage) and the lives at each wave's horn.
// Usage:  NODE_PATH=$(npm root -g) node tools/playtest-mine.js [index.html] [--verbose]
"use strict";
const R = require("./regress/lib");
const o = R.cli();
const t0 = Date.now();
const PHONE = { name: "touch phone 667x320", w: 667, h: 320, touch: true, ua: require(process.env.PW_PATH || "playwright").devices["iPhone 15"].userAgent, phone: true };
const WANT = 5;
(async () => {
  const browser = await R.launch();
  const fails = [], out = {};
  for (const C of [Object.assign({}, PHONE, { name: "touch iPhone 15 852x393", w: 852, h: 393 }), R.SIZES.ipad, PHONE]) {
    const g = await R.openGame(browser, o.file, C);
    const fail = m => fails.push(C.name + " " + m);
    try {
      await g.toMap();
      await g.enterBattle(await g.ev(() => levelIndexOf("gyumri")));
      await g.ev(() => { gold = 2000; syncHud(); });
      const tray = await g.ev(() => trayTypes().join());
      if (!/,mine$/.test(tray)) fail("Gyumri Road's tray: " + tray);
      // a tower from its tile on a pad: two taps on a touch screen
      const build = async (type, pad) => {
        if (await g.ev(() => placing) !== type) await g.press('#shop .card[data-type="' + type + '"]');
        const p = await g.ev(i => PADS[i], pad);
        const pt = await g.worldToClient(p[0], p[1], 4);
        await g.tapAt(pt.x, pt.y); await g.frames(1);
        await g.tapAt(pt.x, pt.y); await g.frames(1);
        return g.ev(i => (towerAt(i) ? towerAt(i).type : null), pad);
      };
      const shooters = ["archer", "ballista", "catapult", "fire", "archer"];
      const roadPads = await g.ev(() => PADS.map((p, i) => i).sort((a, b) => postRoadIn(PADS[b][0], PADS[b][1], 170).length - postRoadIn(PADS[a][0], PADS[a][1], 170).length));
      let k = 0;
      for (const s of shooters) { const got = await build(s, roadPads[k++]); if (got !== s) fail("the " + s + " was not built: " + got); }
      const mp = await g.ev(() => PADS.map((p, i) => i).filter(i => !towerAt(i) && padTakesRoad(i, TOWER_DEFS.mine.levels[0].range))
        .sort((a, b) => postRoadIn(PADS[b][0], PADS[b][1], 180).length - postRoadIn(PADS[a][0], PADS[a][1], 180).length)[0]);
      const got = await build("mine", mp);
      if (got !== "mine") fail("the Powder Mine was not built on pad " + mp + ": " + got);
      await g.ev(() => setPlacing(null));
      // a tap on the mine's body opens its panel
      const openPanel = async () => {
        const xy = await g.ev(i => PADS[i], mp), at = await g.worldToClient(xy[0], xy[1], -30);
        await g.tapAt(at.x, at.y); await g.wait(500);
        return g.ev(pad => !!selected && selected.pad === pad && panelEl.style.display === "block", mp);
      };
      if (!(await openPanel())) fail("a tap on the Powder Mine did not open its panel");
      // Lay the charge: the road point of the ring the most standing shooters reach, clear on the screen
      await g.press("#pLay"); await g.wait(200);
      const spot = await g.ev(pad => {
        const t = towerAt(pad), r = canvas.getBoundingClientRect();
        const on = s => { const p = proj(s.x, s.y); return { x: r.left + offX + p.x * scale, y: r.top + offY + p.y * scale }; };
        const sh = towers.filter(u => TOWER_DEFS[u.type].proj || u.type === "fire");
        const cand = postRoadIn(t.x, t.y, mineReach(t)).filter(s => { const c = on(s), e = document.elementFromPoint(c.x, c.y); return e && e.id === "game" && !towers.some(u => Math.hypot(u.x - s.x, u.y - s.y) < 40) && !(hero && Math.hypot(hero.x - s.x, hero.y - s.y) < 40); });
        let best = null, bv = -1;
        for (const s of cand) { const v = sh.filter(u => inGroundRange(u.x, u.y, s.x, s.y, getStats(u).range)).length; if (v > bv || (v === bv && s.left > best.left)) { bv = v; best = s; } }
        return best && Object.assign({ wx: best.x, wy: best.y, cover: bv, armed: rallying === t }, on(best));
      }, mp);
      if (!spot || !spot.armed) fail("Lay the charge did not arm, or no road of its ring is clear: " + JSON.stringify(spot));
      else {
        await g.tapAt(spot.x, spot.y); await g.frames(2);
        const laid = await g.ev(([pad, s]) => { const m = towerAt(pad).mines[0]; return { d: Math.hypot(m.x - s.wx, m.y - s.wy), armed: !!rallying, sel: !!selected }; }, [mp, spot]);
        if (laid.d > 12 || laid.armed || laid.sel) fail("the tap on the road did not lay the charge there: " + JSON.stringify(laid));
      }
      // the trigger pressed round to "by hand", and a rank up
      if (!(await openPanel())) fail("a second tap on the Powder Mine did not open its panel");
      for (let i = 0; i < 3 && (await g.ev(pad => towerAt(pad).trigger, mp)) !== 0; i++) { await g.press("#pTrigger"); await g.wait(150); }
      if ((await g.ev(pad => towerAt(pad).trigger, mp)) !== 0) fail("the trigger did not come round to by hand");
      await g.press("#pActions .up"); await g.frames(2);
      if (await g.ev(pad => towerAt(pad).level, mp) !== 1) fail("Upgrade did not raise the Powder Mine");
      await g.page.keyboard.press("Escape");
      await g.ev(() => hidePanel());
      await g.ev(() => { for (const t of towers) if (t.type !== "mine") { t.level = 2; towerSyncHp(t); } gold = 300; syncHud(); });
      // the waves at 2x with Auto; a crowd over the armed charge is fired on by a finger on its marker
      await g.press("#speedBtn");
      await g.press("#waveBtn");
      await g.press("#autoBtn");
      const blasts = [], horns = [];
      let cards = 0, selfFired = false, missed = 0, lastWave = 0;
      for (const until = Date.now() + 1500000; Date.now() < until;) {
        const st = await g.ev(pad => {
          const t = towerAt(pad), m = t && t.mines[0];
          if (!m) return { gone: true };
          const r = canvas.getBoundingClientRect(), q = proj(m.x, m.y);
          return { over: gameOver, wave: waveIdx, lives, armed: mineArmed(m), n: mineCount(t, m), blasts: t.blasts || 0, card: !!document.querySelector("#trickCard.on"),
            x: r.left + offX + q.x * scale, y: r.top + offY + (q.y - 4 * q.s) * scale, dmg: Math.round(t.dmgDone || 0) };
        }, mp);
        if (st.gone || st.over) break;
        if (st.wave !== lastWave) { horns.push(st.wave + ":" + st.lives); lastWave = st.wave; }
        if (st.card) { await g.press("#tcBtn"); cards++; continue; }
        if (st.blasts > blasts.length) selfFired = true;
        if (st.armed && st.n >= 3) {
          const hp0 = await g.ev(() => enemies.reduce((s, e) => s + Math.max(0, e.hp), 0));
          await g.tapAt(st.x, st.y);
          await g.frames(1);
          const after = await g.ev(([pad, hp0]) => { const t = towerAt(pad); return { blasts: t.blasts || 0, sel: !!selected && panelEl.style.display === "block", hits: t.blastHits || 0, dmg: Math.round(hp0 - enemies.reduce((s, e) => s + Math.max(0, e.hp), 0)) }; }, [mp, hp0]);
          if (after.blasts === blasts.length + 1) blasts.push({ wave: st.wave, crowd: st.n, caught: after.hits - blasts.reduce((s, b) => s + b.caught, 0), dmg: after.dmg });
          else missed++;
          if (after.sel) fail("a tap on the marker opened a panel");
          if (blasts.length >= WANT) break;
          continue;
        }
        await g.wait(150);
      }
      if (selfFired) fail("the charge fired by itself with its trigger by hand");
      if (blasts.length < WANT) fail("only " + blasts.length + " blasts on a crowd" + (missed ? " (" + missed + " taps on the marker fired nothing)" : ""));
      const end = await g.ev(() => ({ wave: waveIdx, lives, gameOver }));
      if (end.gameOver && lives <= 0) fail("the stand fell on wave " + end.wave);
      out[C.name] = { blasts, missed, cards, horns: horns.join(" "), end };
      if (o.verbose) console.log(C.name + " " + JSON.stringify(out[C.name]));
    } catch (e) { fail(e.message.split("\n")[0]); }
    const p = await g.problems();
    if (p.length) fail(p.join(" | "));
    await g.close();
  }
  await browser.close();
  R.finish("playtest-mine", fails, out, t0);
})().catch(e => { console.error(e); process.exit(1); });
