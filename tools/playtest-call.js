// Playtest 4, the hero's half (gameplay 8.4, G3), played with the regression suite's touch helpers on an iPhone SE held
// sideways in Safari (667x320, touch, an iPhone's user agent): a battle on Tashir (the Call open), foes held on the hero,
// and ten rounds of the Call chosen and sounded by a finger on his medallion. Each round: a tap chooses him and must not
// sound it; on even rounds a second tap follows at once, as a quick double tap would (it must not sound it either);
// then, half a second on, a tap sounds it. Between rounds the Call's clock is set back to ready, so the ten rounds
// do not wait out its 60 s. Prints one line a round and a RESULT line; exits 1 on any slip.
// Usage: NODE_PATH=$(npm root -g) node tools/playtest-call.js [index.html] [--shots=dir]
"use strict";
const path = require("path");
const R = require("./regress/lib");
const { devices } = require(process.env.PW_PATH || "playwright");
(async () => {
  const args = process.argv.slice(2), shots = (args.find(a => a.startsWith("--shots=")) || "").slice(8) || null;
  const file = path.resolve(args.find(a => !a.startsWith("--")) || path.join(__dirname, "..", "index.html"));
  const browser = await R.launch();
  const g = await R.openGame(browser, file, { w: 667, h: 320, touch: true, ua: devices["iPhone 15"].userAgent, name: "SE Safari 667x320" });
  const slips = [];
  try {
    await g.ev(() => {
      const rec = {};
      for (let i = 0; i < 4; i++) { localStorage.setItem(bestKey(i, LEVELS[i].era), "21"); rec[levelId(i)] = { stars: [0, 2, 0], lives: [0, 14, 0], endless: [0, 0, 0] }; }
      localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
      localStorage.setItem("hs_tutorial_done", "1");
      localStorage.setItem("hs_towers_seen", '["council","call"]');
      localStorage.setItem("hs_chapters_seen", JSON.stringify(CHAPTERS.map(C => C.id)));
      const lv = levelIndexOf("tashir"); openCampaignMap(lv); selectMapLevel(lv); showBrief();
    });
    await g.frames(4);
    await g.press("#startBtn");
    await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
    if (!(await g.ev(() => kit.call))) throw new Error("the battle has no Call");
    await g.press("#waveBtn");
    for (let round = 1; round <= 10; round++) {
      // foes on the hero: four raiders held where he stands, too strong to fall during the round
      await g.ev(() => {
        callCd = 0; heroSelected = false; spellBtnCache.heroBtn = null;
        if (!hero.alive) heroSpawn();
        hero.hp = hero.maxHp;
        enemies = enemies.filter(e => !e.playtest);
        for (let k = 0; k < 4; k++) { spawnEnemy("raider"); const e = enemies[enemies.length - 1]; e.route = 0; e.playtest = true; e.hp = e.maxHp = 1e7; e.speed = 0; }
        const near = enemies.filter(e => e.playtest), d = ROUTES[0].len - 90;
        for (const e of near) e.dist = d;
        const p = routeAt(0, d); hero.x = p.x; hero.y = p.y; hero.rally = null;
        updateSpellBar();
      });
      await g.frames(2);
      const c0 = await g.ev(() => battle.calls);
      await g.press("#heroBtn");
      let s = await g.ev(() => ({ calls: battle.calls, sel: heroSelected, face: $("heroBtn").classList.contains("callFace"), held: hero.engaged.length }));
      if (s.calls !== c0 || !s.sel || !s.face) slips.push("round " + round + ": the choosing tap " + JSON.stringify(s));
      if (round % 2 === 0) {
        await g.press("#heroBtn");   // a double tap's second half, at once (two frames after the first)
        s = await g.ev(() => ({ calls: battle.calls, sel: heroSelected }));
        if (s.calls !== c0) slips.push("round " + round + ": a double tap sounded the Call " + JSON.stringify(s));
      }
      await g.wait(500);
      await g.press("#heroBtn");
      const e = await g.ev(() => ({ calls: battle.calls, callT, sel: heroSelected, held: hero.engaged.length }));
      if (e.calls !== c0 + 1 || !(e.callT > 0)) slips.push("round " + round + ": the later tap did not sound it " + JSON.stringify(e));
      console.log("round " + round + ": chosen, " + (round % 2 === 0 ? "double tapped, " : "") + "sounded: calls " + e.calls + ", Stand Fast " + e.callT.toFixed(1) + " s, " + e.held + " foes held");
      if (shots && round === 1) await g.page.screenshot({ path: path.join(shots, "playtest-call-round1.png") });
    }
    const p = await g.problems();
    if (p.length) slips.push(...p);
  } catch (e) { slips.push(e.message.split("\n")[0]); }
  await g.close(); await browser.close();
  for (const s of slips) console.log("SLIP " + s);
  console.log("RESULT playtest-call: " + (slips.length ? "FAIL, " + slips.length + " slips" : "PASS, 10 rounds, the Call never sounded by a choosing tap"));
  process.exit(slips.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
