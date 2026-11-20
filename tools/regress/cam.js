// The battle camera (the page's Cam block; docs/specs/owner/battle-camera.md): the last blow, the fall's push-in,
// the shake of heavy hits, Settings' "Battle camera" switch. A browser driven by a test has no camera at all unless
// the test sets window.__hsCamTest, which this script does (and, once, does not).
// A battle is entered as a player enters it (lib.js enterBattle), then jumped to its last wave with one foe left on
// the road (the battle's clock, purse and walls set to fixed numbers), and that foe is felled through the game's own
// loop. What it holds the page to:
// - without the switch (a plain test-driven load): no camera; the winning kill declares the victory in the same step;
// - the last blow starts at the winning kill: the victory waits, the HUD stands back, the camera's zoom rises above
//   1.3, the game's time runs at under 0.4 of the player's, the battle's clock (`sec`, the player's own seconds) does
//   not move, the speed setting is left alone; after about 1.6 s victory() runs, once, and the zoom is back at 1;
// - the battle's numbers at that victory (stars, lives, held, the board's lives, sec, the player's seconds, purse,
//   earned, spent, wave) equal the same battle's with the camera switched off, and so does the record it saves;
// - a commander's last blow holds longer (about 2.2 s) and closer;
// - a click on a HUD button, a tap on the field and a key each end it at once and press nothing;
// - Settings' switch reads On, is in reach, turns Off at a press (kept in hs_settings as cam: false) and then there
//   is no blow, no shake and no pulse; pressed again it is On;
// - with the system's "reduce motion" the switch starts Off, the last blow is a 0.6 s pause with no zoom, and
//   nothing shakes;
// - a Powder Mine's blast, the wrath and four heavy hits at once shake the field by no more than 6 px, for under
//   half a second; an ordinary kill shakes nothing; the pointer's arithmetic (scale, offX, offY) never moves;
// - a defeat is settled at once (the saved run gone), then the push-in on the citadel (zoom above 1.15) holds the
//   bell and the beat back about 1.2 s; a tap ends it and the beat begins at once; the defeat page follows;
// - on a touch page the last blow asks navigator.vibrate for a pattern, and a browser without it throws nothing;
// - no page error, console error or crash card anywhere.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/cam.js [index.html] [--quick] [--shots=dir] [--verbose]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const SEEN = { hs_ios_tip: "1", hs_tutorial_done: "1" };
const camOn = [() => { window.__hsCamTest = {}; }];
// navigator.vibrate replaced by a recorder (headless Chromium would refuse a pulse before a tap anyway)
const vibeSpy = [() => { window.__vibes = []; try { Object.defineProperty(Navigator.prototype, "vibrate", { configurable: true, value: function (p) { window.__vibes.push(p); return true; } }); } catch (e) {} }];
const noVibe = [() => { try { Object.defineProperty(Navigator.prototype, "vibrate", { configurable: true, value: undefined }); } catch (e) {} }];

(async () => {
  const browser = await R.launch();
  const fails = [];
  let checks = 0;
  const say = (...a) => { if (o.verbose) console.log(...a); };

  // the battle at its last wave, one foe of `type` half way down its road; victory() counted
  const stage = (g, type, speed) => g.ev(([type, speed]) => {
    if (!window.__vicWrapped) {
      window.__vicWrapped = true; window.__vicN = 0;
      const v0 = victory;
      victory = function () { window.__vicN++; return v0.apply(this, arguments); };
    }
    window.__vicN = 0;
    towers.length = 0;
    waveIdx = totalWaves(); phase = "wave"; lastCleared = waveIdx - 1; waveTime = 50;
    spawnQueue = []; enemies = []; projectiles = [];
    spawnEnemy(type);
    const e = enemies[enemies.length - 1];
    e.dist = (e.fly ? e.fly.len : ROUTES[e.route || 0].len) * 0.5;
    e.bounty = 7;
    if (hero) { hero.x = FORT.x; hero.y = FORT.y; hero.rally = null; }
    lives = livesMax() - 3; gold = 500;
    battle.on = true; battle.started = true;
    battle.sec = 300; battle.realS = 280; battle.x1 = 280; battle.x2 = 0; battle.x4 = 0; battle.idleS = 40; battle.earned = 900; battle.spent = 400;
    setSpeed(speed || 1);
    for (const k in Cam.stat) Cam.stat[k] = k === "maxZoom" || k === "minSlow" ? 1 : k === "lastVibe" ? null : 0;
    syncHud();
  }, [type, speed]);
  const fell = g => g.ev(() => { battle.sec = 300; battle.realS = 280; battle.x1 = 280; enemies[0].hp = 0; window.__killAt = performance.now(); });
  const facts = g => g.ev(() => {
    const f = battleFacts(), keep = {};
    for (const k of ["lv", "diff", "mode", "wave", "waves", "lives", "lives_max", "held", "lives_board", "stars", "sec", "spent", "earned", "realS", "idleS", "left", "lost", "returned", "debt", "loadout"]) keep[k] = f[k];
    keep.speedS = JSON.stringify(f.speedS);
    keep.best = localStorage.getItem(bestKey(curLevel, curDiff));
    keep.run = localStorage.getItem("hs_run");
    return keep;
  });
  const waitFor = (g, fn, ms) => g.page.waitForFunction(fn, null, { timeout: ms, polling: 16 }).then(() => true, () => false);
  const lvOf = (g, id) => g.ev(id => levelIndexOf(id), id);

  // ---- 1. a plain test-driven load: no camera ----
  {
    const g = await R.openGame(browser, o.file, Object.assign({}, R.SIZES.desk, { storage: SEEN }));
    const fail = m => fails.push("plain load: " + m);
    try {
      await g.toMap();
      await g.enterBattle(await lvOf(g, "avarayr"));
      checks++;
      if (await g.ev(() => Cam.mode()) !== "off") fail("the camera is not off in a browser driven by a test: " + await g.ev(() => Cam.mode()));
      await stage(g, "spearman");
      await fell(g);
      await g.frames(3);
      const s = await g.ev(() => ({ over: gameOver, n: window.__vicN, cel: !!celebration, blows: Cam.stat.blows, view: Cam.view(), cls: document.body.className }));
      if (!s.over || s.n !== 1 || !s.cel) fail("the winning kill did not declare the victory at once: " + JSON.stringify(s));
      if (s.blows || s.view || /camBlow/.test(s.cls)) fail("a last blow began: " + JSON.stringify(s));
      await g.ev(() => { castSpell("wrath", 600, 400); Cam.shake(5, 300); });
      if (await g.ev(() => Cam.stat.shakes || Cam.view())) fail("a shake began");
      for (const p of await g.problems()) fail(p);
    } catch (e) { fail("stopped: " + e.message); await g.shot(o.shots, "plain"); }
    await g.close();
  }

  // ---- 2. the camera on, at 1600x900 by mouse ----
  let withCam = null, without = null;
  {
    const g = await R.openGame(browser, o.file, Object.assign({}, R.SIZES.desk, { storage: SEEN, init: [camOn, noVibe] }));
    const fail = m => fails.push("mouse 1600x900: " + m);
    try {
      await g.toMap();
      const lv = await lvOf(g, "avarayr");
      // -- the last blow, left to run --
      await g.enterBattle(lv);
      checks++;
      if (await g.ev(() => Cam.mode()) !== "full") fail("the camera's mode with the test switch: " + await g.ev(() => Cam.mode()));
      await stage(g, "spearman", 2);
      const base = await g.ev(() => ({ scale, offX, offY }));
      await fell(g);
      await g.frames(3);
      let s = await g.ev(() => ({ st: Cam.state(), over: gameOver, n: window.__vicN, phase, cls: document.body.className, sec: battle.sec, realS: battle.realS, wt: waveTime, at: performance.now(), sp: speedMult,
        op: getComputedStyle(document.getElementById("topbar")).opacity }));
      if (!s.st.blow || s.st.blow.over) fail("no last blow at the winning kill: " + JSON.stringify(s));
      if (s.over || s.n || s.phase !== "wave") fail("the victory did not wait for the last blow: " + JSON.stringify(s));
      if (!/camBlow/.test(s.cls)) fail("the HUD does not stand back (body." + s.cls + ")");
      if (s.st.blow && Math.abs(s.st.blow.dur - 1.6) > 0.01) fail("a foot soldier's last blow lasts " + s.st.blow.dur + " s, not 1.6");
      if (s.sp !== 2) fail("the speed setting was changed during the last blow: " + s.sp);
      await g.wait(700);
      const m = await g.ev(() => ({ sec: battle.sec, realS: battle.realS, wt: waveTime, at: performance.now(), v: Cam.view(), sp: speedMult, over: gameOver,
        op: getComputedStyle(document.getElementById("topbar")).opacity, corpses: corpses.length }));
      const rate = (m.wt - s.wt) / ((m.at - s.at) / 1000);
      say("  slow motion: game time at " + rate.toFixed(3) + " of real, zoom " + (m.v && m.v.z.toFixed(3)) + ", HUD opacity " + m.op);
      checks++;
      if (!(rate > 0.05 && rate < 0.4)) fail("the game's time ran at " + rate.toFixed(3) + " of the player's during the last blow (0.2 wanted)");
      // (the kill's own step is counted, as it is without the camera: under a tenth of a second)
      if (m.sec !== s.sec || m.realS !== s.realS || s.sec > 300.11) fail("the battle's clock moved during the last blow: sec " + m.sec + ", realS " + m.realS);
      if (!m.v || !(m.v.z > 1.3)) fail("the camera did not push in: " + JSON.stringify(m.v));
      if (m.v && (m.v.cx - 640 / m.v.z < -0.01 || m.v.cx + 640 / m.v.z > 1280.01 || m.v.cy - 360 / m.v.z < -0.01 || m.v.cy + 360 / m.v.z > 720.01)) fail("the camera's view leaves the field: " + JSON.stringify(m.v));
      if (!(+m.op < 0.6)) fail("the HUD's opacity in the last blow: " + m.op);
      if (!m.corpses) fail("the fallen foe is not on the field during the last blow");
      const now = await g.ev(() => ({ scale, offX, offY }));
      if (JSON.stringify(now) !== JSON.stringify(base)) fail("the pointer's arithmetic moved with the camera: " + JSON.stringify(now));
      if (!(await waitFor(g, () => gameOver, 4000))) fail("no victory after the last blow");
      const e = await g.ev(() => ({ n: window.__vicN, ms: performance.now() - window.__killAt, cel: !!celebration, sp: speedMult, maxZoom: Cam.stat.maxZoom, minSlow: Cam.stat.minSlow, blows: Cam.stat.blows }));
      say("  the last blow took " + Math.round(e.ms) + " ms; top zoom " + e.maxZoom.toFixed(3) + ", slowest " + e.minSlow.toFixed(2));
      checks++;
      if (e.n !== 1 || !e.cel) fail("victory() ran " + e.n + " times after the last blow");
      if (e.ms < 1300 || e.ms > 2600) fail("the last blow took " + Math.round(e.ms) + " ms (about 1600 wanted)");
      if (!(e.maxZoom > 1.5 && e.maxZoom < 1.7)) fail("the top zoom of a foot soldier's last blow: " + e.maxZoom);
      if (!(e.minSlow > 0.15 && e.minSlow < 0.25)) fail("the slowest the game's time ran: " + e.minSlow);
      if (e.blows !== 1) fail(e.blows + " last blows");
      withCam = await facts(g);
      await g.wait(1100);
      s = await g.ev(() => ({ v: Cam.view(), cls: document.body.className, n: window.__vicN, st: Cam.state() }));
      if (s.v) fail("the camera is not back at 1 a second after the victory: " + JSON.stringify(s.v));
      if (/camBlow|camOut/.test(s.cls)) fail("the HUD's class was left on: " + s.cls);
      if (s.n !== 1) fail("victory() ran " + s.n + " times");
      if (s.st.blow) fail("the last blow was not put away");

      // -- the same battle with the switch off: the same numbers --
      await g.ev(() => Cam.setPref(false));
      await g.enterBattle(lv);
      await stage(g, "spearman", 2);
      await fell(g);
      await g.frames(3);
      s = await g.ev(() => ({ over: gameOver, n: window.__vicN, blows: Cam.stat.blows, v: Cam.view() }));
      checks++;
      if (!s.over || s.n !== 1 || s.blows || s.v) fail("with the switch off the victory was not declared at once: " + JSON.stringify(s));
      without = await facts(g);
      say("  with the camera   " + JSON.stringify(withCam));
      say("  without           " + JSON.stringify(without));
      if (JSON.stringify(withCam) !== JSON.stringify(without)) fail("the victory's numbers differ with the camera: " + JSON.stringify(withCam) + " against " + JSON.stringify(without));
      if (!withCam || withCam.sec !== 300 || withCam.stars < 1 || withCam.run !== null) fail("the staged victory's numbers: " + JSON.stringify(withCam));
      await g.ev(() => Cam.setPref(null));

      // -- a commander's last blow --
      if (!o.quick) {
        await g.enterBattle(lv);
        await stage(g, "boss");
        await fell(g);
        await g.frames(3);
        const b = await g.ev(() => Cam.state().blow);
        checks++;
        if (!b || !b.boss || Math.abs(b.dur - 2.2) > 0.01 || !(b.z > 1.7)) fail("a commander's last blow: " + JSON.stringify(b));
        if (!(await waitFor(g, () => gameOver, 5000))) fail("no victory after a commander's last blow");
        const ms = await g.ev(() => performance.now() - window.__killAt);
        if (ms < 1900 || ms > 3300) fail("a commander's last blow took " + Math.round(ms) + " ms (about 2200 wanted)");
        if (await g.ev(() => window.__vicN) !== 1) fail("victory() did not run once after a commander's last blow");
      }

      // -- the skip: a click on a HUD button, then a key --
      for (const how of ["click", "key"]) {
        await g.enterBattle(lv);
        await stage(g, "spearman");
        await fell(g);
        await g.frames(3);
        await g.wait(250);
        if (!(await g.ev(() => Cam.state().busy))) { fail("no last blow to skip (" + how + ")"); continue; }
        const before = await g.ev(() => ({ auto, paused, placing: placing || null }));
        await g.ev(() => { window.__skipAt = performance.now(); });
        if (how === "click") { const q = await g.reach("#autoBtn"); if (q.why) fail("Auto is not in reach: " + q.why); else await g.clickAt(q.x, q.y); }
        else await g.page.keyboard.press("a");
        const ok = await waitFor(g, () => gameOver, 400);
        const a = await g.ev(() => ({ auto, paused, placing: placing || null, n: window.__vicN, ms: performance.now() - window.__skipAt, skips: Cam.stat.skips }));
        checks++;
        if (!ok || a.n !== 1) fail("a " + how + " did not skip the last blow to the victory: " + JSON.stringify(a));
        if (a.ms > 600) fail("a " + how + " ended the last blow only after " + Math.round(a.ms) + " ms");
        if (a.skips !== 1) fail("the skip was not counted (" + how + ")");
        if (a.auto !== before.auto || a.paused !== before.paused || a.placing !== before.placing) fail("the " + how + " that skipped the last blow also pressed something: " + JSON.stringify(a));
      }

      // -- the shake of heavy hits --
      await g.enterBattle(await lvOf(g, "gyumri"));
      await g.ev(() => {
        gold = 5000; waveIdx = 3; phase = "wave"; spawnQueue = [{ type: "spearman", t: 1e9 }];
        for (let i = 0; i < 6; i++) { spawnEnemy("spearman"); const e = enemies[enemies.length - 1]; e.dist = ROUTES[e.route || 0].len * (0.3 + i * 0.05); }
        for (const k in Cam.stat) Cam.stat[k] = k === "maxZoom" || k === "minSlow" ? 1 : k === "lastVibe" ? null : 0;
      });
      await g.frames(2);
      // an ordinary kill
      await g.ev(() => { enemies[0].hp = 0; });
      await g.frames(3);
      checks++;
      if (await g.ev(() => Cam.stat.shakes || Cam.view())) fail("an ordinary kill shook the field");
      // a Powder Mine's blast: a mine built on a pad that takes road, its charge fired by the game's own mineFire
      const mine = await g.ev(() => {
        const pad = PADS.map((p, i) => i).filter(i => !towerAt(i) && padTakesRoad(i, TOWER_DEFS.mine.levels[0].range))[0];
        if (pad === undefined) return { why: "no pad for a mine" };
        placeTower("mine", pad);
        const t = towerAt(pad);
        if (!t || t.type !== "mine" || !t.mines || !t.mines.length) return { why: "no mine built" };
        t.mines[0].armT = 0;
        const fired = mineFire(t, t.mines[0]);
        return { fired, shakes: Cam.stat.shakes, max: Cam.stat.maxShake, v: Cam.view() };
      });
      say("  a mine's blast: " + JSON.stringify(mine));
      if (mine.why || !mine.fired) fail("the Powder Mine's blast could not be staged: " + JSON.stringify(mine));
      else {
        if (mine.shakes !== 1 || !(mine.max >= 2 && mine.max <= 6)) fail("a Powder Mine's blast shakes by " + mine.max + " px (" + mine.shakes + " shakes)");
        if (!mine.v || Math.abs(mine.v.cx - 640) > 6.01 || Math.abs(mine.v.cy - 360) > 6.01 || mine.v.z !== 1) fail("the shaken view: " + JSON.stringify(mine.v));
      }
      // several at once never pass the cap, and the field is still again within half a second
      const many = await g.ev(() => { for (let i = 0; i < 4; i++) Cam.shake(5, 300); castSpell("wrath", 600, 400); const out = []; for (let i = 0; i < 1; i++) out.push(Cam.view()); return { max: Cam.stat.maxShake, v: out[0], shakes: Cam.stat.shakes }; });
      let worst = 0;
      for (let i = 0; i < 12; i++) { const v = await g.ev(() => Cam.view()); if (v) worst = Math.max(worst, Math.abs(v.cx - 640), Math.abs(v.cy - 360)); await g.frames(1); }
      say("  five heavy hits at once: " + JSON.stringify(many) + ", worst offset " + worst.toFixed(2) + " px");
      checks++;
      if (!(many.max <= 6) || worst > 6.01) fail("heavy hits at once shake past the cap: " + many.max + " px, offset " + worst.toFixed(2));
      if (many.shakes < 6) fail("the wrath did not shake the field (" + many.shakes + " shakes)");
      if (worst < 0.5) fail("the field did not move under five heavy hits");
      await g.wait(520);
      if (await g.ev(() => Cam.view())) fail("the field still shakes half a second on");
      const now2 = await g.ev(() => ({ scale, offX, offY }));
      if (JSON.stringify(now2) !== JSON.stringify(base)) fail("the pointer's arithmetic moved with the shake: " + JSON.stringify(now2));

      // -- Settings' switch --
      await g.press("#gearBtn");
      await g.wait(200);
      const sw = await g.reach("#setCamTgl");
      checks++;
      if (sw.why) fail("Settings' Battle camera switch is not in reach: " + sw.why);
      else {
        const lbl = await g.ev(() => ({ text: document.getElementById("setCamTgl").textContent, label: document.getElementById("setCamLbl").textContent, on: document.getElementById("setCamTgl").classList.contains("on") }));
        if (lbl.text !== "On" || !lbl.on || lbl.label !== "Battle camera") fail("the switch reads " + JSON.stringify(lbl));
        if (o.shots) await g.shot(o.shots, "settings-switch");
        await g.press("#setCamTgl");
        const off = await g.ev(() => ({ text: document.getElementById("setCamTgl").textContent, mode: Cam.mode(), saved: JSON.parse(localStorage.getItem("hs_settings") || "{}").cam }));
        if (off.text !== "Off" || off.mode !== "off" || off.saved !== false) fail("the switch pressed: " + JSON.stringify(off));
        await g.ev(() => { closeSettings(); paused = false; });
        const n0 = await g.ev(() => Cam.stat.shakes);
        await g.ev(() => { Cam.shake(5, 300); castSpell("frost", 600, 400); });
        if (await g.ev(n0 => Cam.stat.shakes !== n0 || !!Cam.view(), n0)) fail("the field shakes with the switch off");
        await g.enterBattle(lv);
        await stage(g, "spearman");
        await fell(g);
        await g.frames(3);
        if (!(await g.ev(() => gameOver && window.__vicN === 1 && !Cam.stat.blows))) fail("a last blow with the switch off");
        await g.enterBattle(lv);
        await g.press("#gearBtn");
        await g.wait(200);
        await g.press("#setCamTgl");
        const on = await g.ev(() => ({ text: document.getElementById("setCamTgl").textContent, mode: Cam.mode(), saved: JSON.parse(localStorage.getItem("hs_settings") || "{}").cam }));
        if (on.text !== "On" || on.mode !== "full" || on.saved !== true) fail("the switch pressed again: " + JSON.stringify(on));
        await g.ev(() => { closeSettings(); paused = false; Cam.setPref(null); saveSettings(); });
        if (await g.ev(() => "cam" in JSON.parse(localStorage.getItem("hs_settings") || "{}"))) fail("a switch never chosen is kept in hs_settings");
      }

      // -- reduce motion: the switch starts off, the last blow is a plain pause --
      await g.page.emulateMedia({ reducedMotion: "reduce" });
      await g.enterBattle(lv);
      await g.ev(() => syncSoundUi());
      const rm = await g.ev(() => ({ mode: Cam.mode(), on: Cam.on(), text: document.getElementById("setCamTgl").textContent }));
      checks++;
      if (rm.mode !== "hold" || rm.on || rm.text !== "Off") fail("under reduced motion: " + JSON.stringify(rm));
      await stage(g, "boss");
      await g.ev(() => { Cam.shake(5, 300); castSpell("wrath", 600, 400); });
      if (await g.ev(() => Cam.stat.shakes || Cam.view())) fail("the field shakes under reduced motion");
      await fell(g);
      await g.frames(3);
      const hb = await g.ev(() => ({ b: Cam.state().blow, v: Cam.view(), over: gameOver, cls: document.body.className }));
      if (!hb.b || Math.abs(hb.b.dur - 0.6) > 0.01 || hb.b.z !== 1 || hb.over) fail("the last blow under reduced motion is not a 0.6 s pause: " + JSON.stringify(hb));
      if (hb.v && (hb.v.z !== 1 || hb.v.cx !== 640 || hb.v.cy !== 360)) fail("the view moves under reduced motion: " + JSON.stringify(hb.v));
      if (!(await waitFor(g, () => gameOver, 3000))) fail("no victory after the pause under reduced motion");
      const rms = await g.ev(() => ({ ms: performance.now() - window.__killAt, n: window.__vicN, z: Cam.stat.maxZoom, vibes: Cam.stat.vibes }));
      if (rms.ms < 450 || rms.ms > 1500 || rms.n !== 1 || rms.z !== 1 || rms.vibes) fail("the pause under reduced motion: " + JSON.stringify(rms));
      await g.page.emulateMedia({ reducedMotion: "no-preference" });

      // -- the defeat: settled at once, then the push-in before the beat --
      for (const how of o.quick ? ["tap"] : ["wait", "tap"]) {
        await g.enterBattle(lv);
        await g.ev(() => {
          waveIdx = 3; phase = "wave"; battle.on = true; lives = 1;
          for (const k in Cam.stat) Cam.stat[k] = k === "maxZoom" || k === "minSlow" ? 1 : k === "lastVibe" ? null : 0;
          spawnEnemy("spearman");
          const e = enemies[enemies.length - 1];
          saveRun();
          window.__run0 = localStorage.getItem("hs_run");
          e.dead = true; leakFoe(e);
          window.__fellAt = performance.now();
        });
        const d = await g.ev(() => ({ over: gameOver, fallen: !!fallen, lead: fallen ? fallen.start - performance.now() : 0, run0: !!window.__run0, run: localStorage.getItem("hs_run"), st: Cam.state(), pushes: Cam.stat.pushes }));
        checks++;
        if (!d.over || !d.fallen) { fail("the defeat was not declared: " + JSON.stringify(d)); continue; }
        if (!d.run0 || d.run !== null) fail("the lost run was not settled at once (hs_run before " + d.run0 + ", after " + d.run + ")");
        if (!d.st.push || d.pushes !== 1 || d.lead < 1000 || d.lead > 1250) fail("no push-in on the citadel before the beat: " + JSON.stringify(d));
        if (how === "wait") {
          await g.wait(800);
          const v = await g.ev(() => Cam.view());
          if (!v || !(v.z > 1.15)) fail("the push-in's zoom 0.8 s in: " + JSON.stringify(v));
          if (!(await waitFor(g, () => !fallen && !overlayEl.classList.contains("hidden"), 4500))) fail("no defeat page after the push-in and the beat");
          const ms = await g.ev(() => performance.now() - window.__fellAt);
          say("  defeat: the page after " + Math.round(ms) + " ms");
          if (ms < 2400 || ms > 3800) fail("the defeat page came after " + Math.round(ms) + " ms (1200 of push-in and 1500 of the beat wanted)");
        } else {
          await g.wait(300);
          const c = await g.worldToClient(640, 400);
          await g.clickAt(c.x, c.y);
          const k = await g.ev(() => ({ st: Cam.state(), lead: fallen ? fallen.start - performance.now() : null, skips: Cam.stat.skips }));
          if (k.st.push || k.lead === null || k.lead > 20 || k.skips !== 1) fail("a click did not end the push-in: " + JSON.stringify(k));
          if (!(await waitFor(g, () => !fallen && !overlayEl.classList.contains("hidden"), 3000))) fail("no defeat page after a skipped push-in");
          const ms = await g.ev(() => performance.now() - window.__fellAt);
          if (ms > 2500) fail("the defeat page after a skipped push-in came after " + Math.round(ms) + " ms");
        }
        await g.wait(300);
        if (await g.ev(() => Cam.view())) fail("the camera is not back at 1 under the defeat page");
        if (await g.ev(() => menuMode) === undefined) fail("no menu after the defeat");
      }
      for (const p of await g.problems()) fail(p);
    } catch (e) { fail("stopped: " + e.message); await g.shot(o.shots, "desk"); }
    await g.close();
  }

  // ---- 3. by touch (an iPad's finger): a tap on the field skips; the phone's pulse ----
  {
    const g = await R.openGame(browser, o.file, Object.assign({}, R.SIZES.ipad, { storage: SEEN, init: [camOn, vibeSpy] }));
    const fail = m => fails.push("touch 1194x834: " + m);
    try {
      await g.toMap();
      const lv = await lvOf(g, "avarayr");
      await g.enterBattle(lv);
      await stage(g, "spearman");
      await g.ev(() => { window.__vibes.length = 0; });
      await fell(g);
      await g.frames(3);
      await g.wait(250);
      const v = await g.ev(() => ({ vibes: window.__vibes.slice(), coarse: matchMedia("(pointer: coarse)").matches, busy: Cam.state().busy }));
      checks++;
      if (!v.busy) fail("no last blow");
      if (v.coarse && !(v.vibes.length === 1 && Array.isArray(v.vibes[0]) && v.vibes[0].length >= 3)) fail("the last blow's pulse: " + JSON.stringify(v.vibes));
      // a tap on a tower's tile in the tray: it ends the blow and chooses nothing
      const q = await g.reach("#shop .card");
      await g.ev(() => { window.__skipAt = performance.now(); });
      if (q.why) fail("no tray tile in reach: " + q.why);
      else await g.tapAt(q.x, q.y);
      const ok = await waitFor(g, () => gameOver, 1200);
      const a = await g.ev(() => ({ n: window.__vicN, placing: placing || null, skips: Cam.stat.skips, ms: performance.now() - window.__skipAt }));
      // (a page of 2388 x 1668 pixels drawn without a graphics card: its frames are slow, and the victory is the next one's)
      if (!ok || a.n !== 1 || a.skips !== 1 || a.ms > 1500) fail("a tap did not skip the last blow: " + JSON.stringify(a));
      if (a.placing) fail("the tap that skipped the last blow chose a tower (" + a.placing + ")");
      // the victory's dance is not ended by that tap
      await g.wait(400);
      if (!(await g.ev(() => !!celebration || !!parley))) fail("the tap that skipped the last blow also ended the dance");
      // a heavy hit's pulse
      await g.enterBattle(lv);
      await g.ev(() => { window.__vibes.length = 0; waveIdx = 3; phase = "wave"; spawnQueue = [{ type: "spearman", t: 1e9 }]; castSpell("wrath", 600, 400); });
      const hv = await g.ev(() => window.__vibes.slice());
      if (v.coarse && !(hv.length === 1 && hv[0] >= 10 && hv[0] <= 30)) fail("the wrath's pulse: " + JSON.stringify(hv));
      for (const p of await g.problems()) fail(p);
    } catch (e) { fail("stopped: " + e.message); await g.shot(o.shots, "ipad"); }
    await g.close();
  }

  await browser.close();
  R.finish("cam", fails, { checks, sec: withCam && withCam.sec, stars: withCam && withCam.stars }, t0);
})();
