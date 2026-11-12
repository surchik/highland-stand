// Every battlefield played to its victory through the game's own loop at 4x, with test gold (gameplay.final.md 8.2):
// the page in its real loop (requestAnimationFrame), the stand begun from its chronicle, Shift+G's test purse, a tower
// on every pad ranked to its top with the purse (so the stand holds whatever the battlefield brings), the secret 4x
// speed by Shift+click on the speed button and Send Wave pressed as soon as each wave is cleared. Checked on every battlefield: the HUD counts "Wave 1/N" to "Wave N/N" with N the battlefield's length
// (gameplay 1.2), every wave is sent once and in order, a commander's banner comes up on the table's waves and on
// no other, the wave button reads "Final Wave" on the last, and the victory page comes up after wave N with that
// count in its numbers. The script checks the count, not the balance: every foe on the field falls at each look (a
// quarter second apart, so a wave lasts about as long as it takes to come on), and the walls are manned again before
// they would fall. Fails on any page error or console error. By mouse at 1600x900, four battlefields at a time (--jobs).
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/waves.js [index.html] [--quick] [--levels=0,ani] [--jobs=3] [--shots=dir]
//   --quick   Erebuni, Avarayr and Mari (a coached first battle, its own table with an ambush road, a road that opens)
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
// gameplay 1.2: each battlefield's length and its commanders' waves
const LENGTHS = { erebuni: [10, 7], tushpa: [12, 7], avarayr: [14, 7], dvin: [11, 6], tashir: [12, 7], sevan: [15, 8], ani: [18, 9], mari: [12, 7], sis: [20, 10],
  gyumri: [13, 7], halidzor: [14, 8], van: [18, 9], musadagh: [16, 8], sardarapat: [20, 10], stepanakert92: [14, 8], shushi: [14, 8], stepanakert23: [12, 7] };
// every first-time card read, so none holds the battle (they have their own scripts)
const SEEN = { hs_tricks_seen: JSON.stringify(["ambush", "hunters", "hidden", "guards", "adapt"]) };

(async () => {
  const browser = await R.launch();
  const fails = [];
  const res = {};
  const ids = await (async () => { const g = await R.openGame(browser, o.file, R.SIZES.desk); const v = await g.ev(() => LEVELS.map(L => L.id)); await g.close(); return v; })();
  const levels = R.parseLevels(o.levels || (o.quick ? "erebuni,avarayr,mari" : "all"), ids);
  const queue = levels.slice();
  const workers = Math.max(1, Math.min(o.jobs || 4, queue.length));
  await Promise.all(Array.from({ length: workers }, async () => {
    const g = await R.openGame(browser, o.file, Object.assign({ storage: SEEN }, R.SIZES.desk));
    await g.toMap();
    while (queue.length) {
      const lv = queue.shift(), id = ids[lv], want = LENGTHS[id];
      const fail = async (m) => { fails.push(id + ": " + m); await g.shot(o.shots, "waves " + id + " " + m.slice(0, 60)); };
      const t1 = Date.now();
      try {
        if (!want) throw new Error("no length known for " + id);
        await g.enterBattle(lv);
        await g.page.keyboard.press("Shift+G");
        await g.frames(2);
        // every wave as the game sends it: the HUD's count, the banner and the wave button's words at its horn
        const built = await g.ev(() => {
          window.__waves = [];
          // the hook is laid once a page: the page plays several battlefields in turn
          if (!window.__wavesHooked) {
          window.__wavesHooked = true;
          const start = startWave;
          startWave = function () {
            const w0 = waveIdx, r = start.apply(this, arguments);
            if (waveIdx !== w0) window.__waves.push({ w: waveIdx, hud: waveNumEl.textContent, banner: waveBannerMain, boss: waveBannerMain === eraUnit("boss").name,
              btn: waveBtn.textContent });
            return r;
          };
          }
          // the purse buys a tower on every pad, each ranked to its top
          const kinds = ["archer", "ballista", "catapult", "fire", "archer", "ballista"];
          PADS.forEach((p, i) => { if (!towerAt(i) && gold >= towerCost(kinds[i % kinds.length])) placeTower(kinds[i % kinds.length], i); });
          for (const t of towers) while (t.level < TOWER_DEFS[t.type].levels.length - 1 && gold >= rankCost(t.type, t.level + 1)) upgradeTower(t);
          for (const t of towers) if (!t.spec && t.level === TOWER_DEFS[t.type].levels.length - 1 && gold >= specInfo(t.type, "a").cost) specializeTower(t, "a");
          setPlacing(null); hidePanel();
          return towers.length;
        });
        if (built < 5) await fail("only " + built + " towers were built");
        const sp = await g.reach("#speedBtn");
        if (sp.why) throw new Error("the speed button: " + sp.why);
        await g.clickAt(sp.x, sp.y, { shift: true });
        await g.frames(2);
        if (await g.ev(() => speedMult) !== 4) await fail("Shift+click on the speed button did not give 4x");
        // Send Wave as soon as the field is clear, until the battle ends; the test purse keeps the board whole
        const tEnd = Date.now() + 900000;
        let last = "";
        while (Date.now() < tEnd) {
          const st = await g.ev(() => ({ over: gameOver, w: waveIdx, phase, can: !waveBtn.disabled, txt: waveBtn.textContent, n: totalWaves() }));
          if (st.over) break;
          if (st.w >= st.n && st.txt.includes("Final Wave")) last = st.txt;
          if (st.can && st.phase === "idle") await g.press("#waveBtn");
          await g.ev(() => {
            for (const t of towers) if (t.wreck && gold >= rebuildCost(t)) rebuildTower(t);
            if (gold < 5000) gold += 20000;   // the test purse, refilled
            // this script checks the count of the waves, not the balance: the walls are manned again before they fall
            if (lives < 30) lives = 60;   // more than a commanders' pair can take at a stroke
            for (const e of enemies) e.hp = 0;   // the count, not the fight: the field is cleared as the foes come on
            for (const t of towers) if (!t.spec && !t.wreck && t.level === TOWER_DEFS[t.type].levels.length - 1 && gold >= specInfo(t.type, "a").cost) specializeTower(t, "a");
          });
          await g.wait(250);
        }
        // the dance (or Sis's parley) is cut short: the victory page under it
        await g.wait(300);
        const end = await g.ev(() => {
          const won = gameOver && lives > 0, facts = battleFacts(), n = totalWaves();
          if (won && (celebration || parley)) endCelebration();
          return { over: gameOver, lives, won, title: $("ovTitle").textContent, page: menuMode, waves: window.__waves, facts, n };
        });
        if (!end.over) throw new Error("the battle did not end in 15 minutes (wave " + end.facts.wave + ")");
        if (!end.won) await fail("the stand fell on wave " + end.facts.wave + " (" + end.title + ")");
        const N = want[0], ws = end.waves;
        if (end.n !== N) await fail("the battle was " + end.n + " waves, not " + N);
        if (ws.map(x => x.w).join() !== Array.from({ length: N }, (_, k) => k + 1).join()) await fail("the waves sent: " + ws.map(x => x.w).join());
        const huds = ws.filter(x => x.hud !== "Wave " + x.w + "/" + N);
        if (huds.length) await fail("the HUD read " + huds.map(x => x.hud).join(", "));
        const cmd = ws.filter(x => x.boss).map(x => x.w).join();
        if (cmd !== want[1] + "," + N) await fail("the commanders' banners came on waves " + cmd + ", not " + want[1] + "," + N);
        if (!last) await fail("the wave button never read Final Wave on the last wave");
        if (end.won && end.page !== "victory") await fail("no victory page: " + end.page + ", " + end.title);
        if (end.facts.wave !== N || end.facts.waves !== N || end.facts.script !== 20) await fail("the victory's numbers: wave " + end.facts.wave + " of " + end.facts.waves + ", script " + end.facts.script);
        res[id] = { s: Math.round((Date.now() - t1) / 1000), waves: N, cmd, lives: end.lives };
        if (o.verbose) console.log(id + " " + JSON.stringify(res[id]));
      } catch (e) {
        await fail(e.message.split("\n")[0]);
      }
      const p = await g.problems();
      if (p.length) { await fail(p.join(" | ")); g.errs.length = 0; }
      // the victory put away: the next battlefield is entered from the map
      try { await g.ev(() => { if (speedMult !== 1) setSpeed(1); if (typeof endCelebration === "function") endCelebration(); hideEndingCard(); }); } catch (e) {}
    }
    await g.close();
  }));
  await browser.close();
  R.finish("waves", fails, { levels: levels.length, played: res }, t0);
})().catch(e => { console.error(e); process.exit(1); });
