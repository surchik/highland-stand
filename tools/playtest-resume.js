// Playtest 7 of docs/specs/gameplay.final.md 8.4, played by a finger on a phone held sideways (667 x 320, an
// iPhone's Safari): a battle is left in the middle of a wave (the app switched away), the tab is dropped, and the
// run is resumed from the map. The wave must be fought again, the battle clock must have kept its time, and the
// victory page must say the one line about the worse attempt only if a defender was lost before leaving.
// Usage: NODE_PATH=$(npm root -g) node tools/playtest-resume.js [path/to/index.html] [--shots=dir] [--verbose]
//
// Played twice on Erebuni, Normal: once with a defender lost before leaving, once with none. Every press is the
// touch helper's of tools/regress/lib.js (a real finger's touch at what the player sees): the map's March
// button, Begin the Stand, the towers' tile and their pads, Send Wave, the speed button, Resume, the tap that
// ends the dance. Three things are staged through the page instead, and only these: the one foe that reaches the
// walls before leaving (a foot soldier already on the road is put at its end), the app switched away (the
// page's own visibilitychange, with the document reported hidden), and the last wave (the battle is taken from
// its second wave to its twentieth and that wave's foes fall as they come on, so a victory page is reached in
// minutes; test gold is not used, for a test-mode battle is never ranked and says nothing of the boards).
// The tab dropped: the page is closed and a new one opened with the same device's storage. The five minutes away
// are not waited out: a closed page has no clock to run.
"use strict";
const R = require("./regress/lib.js");
const { devices } = require(process.env.PW_PATH || "playwright");
const o = R.cli();
const t0 = Date.now();
const UA = devices["iPhone 15"].userAgent;
const LINE = "A wave fought again counts its worse attempt on the boards.";
const DEVICE = { hs_tutorial_done: "1", hs_mig_7lv: "1", hs_mig_ids: "1", hs_mig_rec: "1",
  hs_tricks_seen: JSON.stringify(["ambush", "hunters", "hidden", "guards", "adapt"]) };

(async () => {
  const browser = await R.launch();
  const fails = [], notes = {};
  const open = storage => R.openGame(browser, o.file, { w: 667, h: 320, touch: true, dpr: 2, name: "SE Safari 667x320", ua: UA, standalone: false, storage });
  for (const lose of [1, 0]) {
    const tag = lose ? "a defender lost before leaving" : "no defender lost before leaving";
    const fail = m => { fails.push(tag + ": " + m); };
    const log = m => { if (o.verbose) console.log(tag + ": " + m); };
    let g = null;
    try {
      g = await open(DEVICE);
      if (!await g.ev(() => isPhone())) fail("the page is not in its phone layout");
      await g.toMap();
      await g.press("#startBtn");                                  // March on Erebuni
      await g.page.waitForFunction(() => menuMode === "brief", null, { timeout: 5000 });
      await g.press("#startBtn");                                  // Begin the Stand
      await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
      await g.frames(3);
      // two archers on the two pads that watch the most road, by the tile and the pad
      const pads = await g.ev(() => {
        const pts = [];
        for (let ri = 0; ri < ROUTES.length; ri++) for (let k = 0; k <= 80; k++) pts.push(routeAt(ri, ROUTES[ri].len * k / 80));
        return PADS.map((p, i) => ({ i, n: pts.filter(q => inGroundRange(p[0], p[1], q.x, q.y, 140)).length })).sort((a, b) => b.n - a.n).map(x => x.i);
      });
      // (on a phone the first tap on a pad aims the tower and the second builds it; a pad under the HUD is passed over)
      let built = 0;
      for (const i of pads) {
        if (built >= 2) break;
        if (await g.ev(() => placing) !== "archer") await g.press('#shop .card[data-type="archer"]');
        const p = await g.ev(i => PADS[i], i), pt = await g.worldToClient(p[0], p[1], 4);
        if (await g.hitName(pt.x, pt.y) !== "canvas#game") continue;
        await g.tapAt(pt.x, pt.y); await g.frames(1);
        if (!await g.ev(i => !!towerAt(i), i)) { await g.tapAt(pt.x, pt.y); await g.frames(2); }
        if (await g.ev(i => !!towerAt(i), i)) built++;
      }
      if (await g.ev(() => placing)) await g.press('#shop .card[data-type="archer"]');
      if (await g.ev(() => towers.length) !== 2) fail("the finger built " + await g.ev(() => towers.length) + " towers, not 2");
      await g.press("#speedBtn");
      if (await g.ev(() => speedMult) !== 2) fail("the speed button did not give 2x");
      await g.press("#waveBtn");
      await g.page.waitForFunction(() => gameOver || (waveIdx === 1 && phase === "idle"), null, { timeout: 120000, polling: 100 });
      const horn = await g.ev(() => lives);   // the defenders as the second wave is sent
      await g.press("#waveBtn");
      await g.page.waitForFunction(() => waveIdx === 2 && enemies.length >= 3, null, { timeout: 60000, polling: 50 });
      if (lose) {
        await g.ev(() => { const e = enemies.find(x => !x.fly && x.dmg === 1); e.dist = ROUTES[e.route || 0].len; });
        await g.page.waitForFunction(h => lives < h, horn, { timeout: 20000, polling: 50 });
      }
      await g.wait(700);
      // the app is switched away: the page hears it is hidden
      const left = await g.ev(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
        return { sec: battle.sec, lives, paused, phase, waveIdx, run: JSON.parse(localStorage.getItem("hs_run") || "null") };
      });
      const lostBefore = horn - left.lives;
      log("left wave " + left.waveIdx + " at " + left.sec.toFixed(2) + " s, " + lostBefore + " lost");
      if (left.phase !== "wave" || left.waveIdx !== 2) fail("the battle was not in its second wave when it was left: " + left.phase + " " + left.waveIdx);
      if (!left.paused) fail("the battle did not pause as the app was left");
      if (lose && lostBefore < 1) fail("no defender was lost before leaving");
      if (!lose && lostBefore !== 0) notes["lost by itself before leaving"] = lostBefore;
      const run = left.run;
      if (!run || run.cleared !== 1 || run.lives !== horn || !run.redo || run.redo.w !== 2 || run.redo.lost !== lostBefore ||
          Math.abs(run.facts.sec + run.redo.sec - left.sec) > 0.05) fail("the run saved as the app was left: " + JSON.stringify(run && { cleared: run.cleared, lives: run.lives, redo: run.redo, sec: run.facts && run.facts.sec }));
      await g.wait(400);
      if (await g.ev(() => battle.sec) !== left.sec) fail("the clock ran while the app was away");
      // the tab is dropped: the device's storage is all that is left
      const device = await g.ev(() => { const st = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); st[k] = localStorage.getItem(k); } return st; });
      await g.close();
      g = await open(device);
      await g.toMap();
      const offer = await g.ev(() => ($("resumeBtn").style.display === "none" ? "" : $("resumeBtn").textContent));
      if (!/Resume: Erebuni.*Wave 2/.test(offer)) fail("the map offers \"" + offer + "\"");
      await g.press("#resumeBtn");
      await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
      await g.frames(3);
      const back = await g.ev(() => ({ waveIdx, phase, lives, sec: battle.sec, dropped: battle.dropped, redoW: battle.redoW, resumed: battle.resumed,
        hud: waveNumEl.textContent, towers: towers.length, start: (window.__hsEv || []).filter(e => e[0] === "battle_start").map(e => e[1]) }));
      log("resumed: " + JSON.stringify(back));
      if (back.waveIdx !== 1 || back.phase !== "idle" || !/Wave 1\/20/.test(back.hud)) fail("the wave is not to be fought again: " + back.hud + ", " + back.phase);
      if (back.lives !== horn) fail("the resume did not give the wave's defenders back: " + back.lives + " of the " + horn + " at its horn");
      if (back.sec < left.sec - 0.05 || back.sec > left.sec + 1.5) fail("the clock did not keep its time: " + left.sec.toFixed(2) + " s at leaving, " + back.sec.toFixed(2) + " s at the resume");
      if (back.dropped !== lostBefore || back.redoW !== 2 || back.resumed !== 1 || back.towers !== 2) fail("resumed with " + JSON.stringify(back));
      if (back.start.length !== 1 || back.start[0].resumed !== true || back.start[0].ranked !== true) fail("the resumed battle's start: " + JSON.stringify(back.start));
      // the wave again, by the finger
      await g.press("#speedBtn");
      await g.press("#waveBtn");
      await g.page.waitForFunction(() => gameOver || (waveIdx === 2 && phase === "idle"), null, { timeout: 120000, polling: 100 });
      const again = await g.ev(() => ({ gameOver, lives, debt: battle.debt, redoW: battle.redoW }));
      const lostAgain = horn - again.lives, owed = Math.max(0, lostBefore - lostAgain);
      log("fought again: " + lostAgain + " lost, debt " + again.debt);
      if (again.gameOver) fail("the stand fell in the wave fought again");
      if (again.debt !== owed || again.redoW !== 0) fail("the wave fought again lost " + lostAgain + " after " + lostBefore + ": debt " + again.debt + ", not " + owed);
      // the last wave, staged; then the dance, ended by a tap once the dancers have had their ten seconds
      await g.ev(() => { waveIdx = lastCleared = TOTAL_WAVES - 1; syncHud(); });
      await g.press("#waveBtn");
      const t1 = Date.now();
      while (!(await g.ev(() => { for (const e of enemies) e.hp = 0; return gameOver; }))) {
        if (Date.now() - t1 > 150000) throw new Error("the staged last wave did not end");
        await g.wait(50);
      }
      await g.page.waitForFunction(() => !!celebration && performance.now() - celebration.start > DANCE_MIN_MS + 200, null, { timeout: 30000, polling: 200 });
      await g.tapAt(333, 170);
      await g.page.waitForFunction(() => menuMode === "victory" && !overlayEl.classList.contains("hidden"), null, { timeout: 10000 });
      await g.wait(900);   // the page takes no press until the tap that ended the dance has lifted
      const page = await g.ev(() => {
        const sub = $("ovSub"), r = sub.getBoundingClientRect(), v = (window.__hsEv || []).filter(e => e[0] === "victory").pop()[1];
        return { text: sub.textContent, top: r.top, bottom: r.bottom, vh: innerHeight, scroll: overlayEl.scrollHeight - overlayEl.clientHeight, v,
          stars: document.querySelectorAll("#ovRecord .ic.won, #ovRecord svg.won").length };
      });
      await g.shot(o.shots, "playtest7 victory " + (lose ? "debt" : "clean"));
      const said = page.text.includes(LINE);
      if (said !== (owed > 0)) fail("the victory page " + (said ? "says" : "does not say") + " the line with a debt of " + owed + ": \"" + page.text.slice(-140) + "\"");
      if (page.v.debt !== owed || page.v.lives_board !== page.v.held - owed || page.v.resumed !== 1 || page.v.loadout !== "std" || page.v.legacy || page.v.aided) fail("the victory's numbers: " + JSON.stringify(page.v).slice(0, 400));
      if (page.v.stars !== page.stars) notes[tag + ": stars shown"] = page.stars + " of the event's " + page.v.stars;
      // the page still works under the finger: its buttons are reached, and its text is on the screen or scrolls to it
      for (const sel of ["#nextBtn", "#startBtn", "#mapBtn", "#endlessBtn"]) {
        const q = await g.reach(sel);
        if (q.why) {
          await g.ev(sel => document.querySelector(sel).scrollIntoView({ block: "center" }), sel);
          await g.frames(2);
          const q2 = await g.reach(sel);
          if (q2.why) fail("the victory page's " + sel + " cannot be tapped: " + q2.why);
        }
      }
      notes[tag] = { lostBefore, lostAgain, debt: again.debt, line: said, secLeft: +left.sec.toFixed(1), secBack: +back.sec.toFixed(1), pageScroll: page.scroll, lives_board: page.v.lives_board, lives: page.v.lives };
      await g.ev(() => overlayEl.scrollTo(0, 0));
      await g.press("#mapBtn");
      await g.page.waitForFunction(() => menuMode === "map", null, { timeout: 5000 });
    } catch (e) {
      fail(e.message.split("\n")[0]);
      if (g) await g.shot(o.shots, "playtest7 failure " + (lose ? "debt" : "clean"));
    }
    if (g) {
      const p = await g.problems();
      if (p.length) fail(p.join(" | "));
      await g.close();
    }
  }
  await browser.close();
  R.finish("playtest-resume", fails, notes, t0);
})().catch(e => { console.error(e); process.exit(1); });
