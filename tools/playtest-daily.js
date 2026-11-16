// The daily played by a finger on a phone held sideways (667 x 320, an iPhone's Safari user agent), every press the touch
// helper's of tools/regress/lib.js aimed at what the player sees (G6, gameplay 6.4 and 8.4):
//   a campaign battle on Tushpa is left in the middle (its saved run, hs_run, and the campaign's records are kept aside);
//   on the map the daily's door (#dailyBtn) opens today's chronicle (the device's day: the platform is off), whose card
//   names the twist; Begin the Stand begins it; towers are built and ranked by taps on the tiles, the pads and the
//   panel, every wave sent by the wave button, at 4x (the game's own secret speed, Shift+F); between the presses the
//   field is run on by the page's own update() (FF= game seconds a look, default 8), for headless Chromium draws a
//   phone's page at a few frames a second and a 12-wave stand would take an hour;
//   the end page offers Fight again and the campaign map; the map then still offers the campaign battle, and hs_run,
//   hs_records and every hs_best_* are as they were.
// Usage: NODE_PATH=$(npm root -g) node tools/playtest-daily.js [index.html] [--shots=dir] [--verbose] [--day=n] [--lv=id --twist=id]
"use strict";
const R = require("./regress/lib.js");
const { devices } = require(process.env.PW_PATH || "playwright");
const o = R.cli();
const t0 = Date.now();
const UA = devices["iPhone 15"].userAgent;
const arg = k => (o.rest.find(a => a.startsWith("--" + k + "=")) || "").slice(k.length + 3);

(async () => {
  const browser = await R.launch();
  const fails = [], notes = {};
  const log = m => { if (o.verbose) console.log(m); };
  const STORE = { hs_tutorial_done: "1", hs_records: JSON.stringify({ erebuni: { stars: [0, 2, 0], lives: [0, 14, 0], endless: [0, 0, 0] } }),
    hs_chapters_seen: JSON.stringify(["kingdoms"]), hs_unlocked_seen: JSON.stringify(["erebuni", "tushpa"]), hs_towers_seen: JSON.stringify(["post"]) };
  const g = await R.openGame(browser, o.file, { w: 667, h: 320, touch: true, dpr: 2, name: "SE Safari 667x320", ua: UA, standalone: false, storage: STORE });
  const tapWorld = async (x, y, dy) => { const p = await g.worldToClient(x, y, dy || 0); await g.tapAt(p.x, p.y); await g.frames(1); };
  try {
    // a campaign battle on Tushpa, left in the middle of its first wave: its run is saved
    await g.ev(() => { localStorage.setItem(bestKey(0, LEVELS[0].era), "21"); });
    await g.toMap();
    await g.ev(() => { openCampaignMap(1); selectMapLevel(1); showBrief(); });
    await g.wait(400);
    await g.press("#startBtn");
    await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
    await g.ev(() => { placeTower("archer", 0); startWave(); });
    await g.wait(300);
    await g.ev(() => { saveRun(); gameOver = true; openCampaignMap(); });
    const kept = await g.ev(() => ({ run: localStorage.getItem("hs_run"), rec: localStorage.getItem("hs_records"),
      best: LEVELS.map((L, i) => localStorage.getItem(bestKey(i, L.era))).join() }));
    if (!kept.run) fails.push("no campaign run was saved to keep");
    // the map's door to the daily: a finger on it
    const day = arg("day");
    if (day || arg("lv")) {
      // a chosen day or battle: the door's own pick is set aside for it (for a repeatable playtest)
      await g.ev(([d, lv, tw]) => { const T = dailyPick(d ? +d : dailyToday().day); window.__pick = lv ? { levelIndex: levelIndexOf(lv), twist: tw, day: T.day } : T;
        dailyToday = () => window.__pick; buildMenu(); }, [day, arg("lv"), arg("twist")]);
    }
    const door = await g.reach("#dailyBtn");
    if (door.why) throw new Error("the daily's door on the map: " + door.why);
    notes.door = Math.round(door.w) + "x" + Math.round(door.h);
    if (door.w < 44 || door.h < 44) fails.push("the daily's door is " + notes.door + ", under 44 px");
    await g.shot(o.shots, "daily-map-667x320");
    await g.press("#dailyBtn");
    await g.wait(500);
    const brief = await g.ev(() => ({ mode: menuMode, daily: dailyRun && { lv: dailyRun.lv, twist: dailyRun.twist, date: dailyRun.date }, card: $("ovDaily").innerText.replace(/\s+/g, " "),
      tray: trayTypes().join(), waves: totalWaves() }));
    log("chronicle: " + JSON.stringify(brief));
    notes.daily = brief.daily; notes.card = brief.card;
    if (brief.mode !== "brief" || !brief.daily || !/Today's challenge/.test(brief.card)) fails.push("the door did not open the daily's chronicle with its card: " + JSON.stringify(brief));
    const card = await g.reach("#ovDaily .dlyCard");
    if (card.why) fails.push("the twist's card is not in view: " + card.why);
    await g.shot(o.shots, "daily-brief-667x320");
    await g.press("#startBtn");
    await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
    if (await g.ev(() => localStorage.getItem("hs_run")) !== kept.run) fails.push("beginning the daily touched the campaign's run");
    // the stand: the pads that reach the most road, the tray's kinds in turn; each wave: build, then rank, then send
    const PADS_ = await g.ev(() => PADS);
    const rank = await g.ev(() => {
      const pts = [];
      for (let ri = 0; ri < ROUTES.length; ri++) { if (ROUTES[ri].track) continue; for (let k = 0; k <= 60; k++) pts.push(routeAt(ri, ROUTES[ri].len * k / 60)); }
      return PADS.map((p, i) => ({ i, n: pts.filter(q => inGroundRange(p[0], p[1], q.x, q.y, 160)).length })).sort((a, b) => b.n - a.n).map(x => x.i);
    });
    const order = ["archer", "ballista", "catapult", "fire", "archer", "drums", "ballista", "catapult", "archer", "fire"];
    let built = 0, ranked = 0, taps = 0, misses = 0, waves = 0, cards = 0, casts = 0;
    // a card the battle lays over the field (a trick's one-time card) is read and put away, as a player does
    const cardsAway = async () => {
      for (let k = 0; k < 3; k++) {
        const q = await g.reach("#tcBtn");
        if (q.why) return;
        await g.tapAt(q.x, q.y); taps++; cards++;
        await g.wait(350);
      }
    };
    const build = async () => {
      for (let guard = 0; guard < 12; guard++) {
        await cardsAway();
        const st = await g.ev(() => ({ gold, tray: trayTypes(), n: towers.length, free: PADS.map((p, i) => i).filter(i => !towerAt(i)), cost: Object.fromEntries(trayTypes().map(k => [k, towerCost(k)])) }));
        const kind = order.filter(k => st.tray.includes(k))[st.n % order.filter(k => st.tray.includes(k)).length];
        const pad = rank.find(i => st.free.includes(i));
        if (pad === undefined || st.gold < st.cost[kind] || (st.n >= 6 && st.gold < 350 && await g.ev(() => towers.some(t => !t.wreck && t.level < 2)))) return;
        await g.press('#shop .card[data-type="' + kind + '"]'); taps++;
        await tapWorld(PADS_[pad][0], PADS_[pad][1], 4); taps++;
        if (await g.ev(() => towers.length) === st.n) { await tapWorld(PADS_[pad][0], PADS_[pad][1], 4); taps++; misses++; }
        await g.ev(() => { if (placing) setPlacing(null); });
        if (await g.ev(() => towers.length) > st.n) built++;
        else return;
      }
    };
    const rankUp = async () => {
      for (let guard = 0; guard < 10; guard++) {
        const t = await g.ev(() => {
          const up = towers.filter(t => !t.wreck && !t.spec && t.level < TOWER_DEFS[t.type].levels.length - 1).sort((a, b) => a.level - b.level)[0];
          return up && gold >= rankCost(up.type, up.level + 1) ? { x: up.x, y: up.y, pad: up.pad, level: up.level } : null;
        });
        if (!t) return;
        await tapWorld(t.x, t.y, -30); taps++;
        await g.wait(250);
        const q = await g.reach("#pActions .up");
        if (q.why) { misses++; log("rank: " + q.why + " " + JSON.stringify(await g.ev(() => ({ sel: !!selected, panel: panelEl.style.display, acts: $("pActions").innerHTML.slice(0, 300) })))); await g.ev(() => { hidePanel(); }); return; }
        await g.tapAt(q.x, q.y); taps++;
        await g.frames(2);
        if (await g.ev(p => towerAt(p).level, t.pad) > t.level) ranked++;
        await g.ev(() => hidePanel());
      }
    };
    await g.ev(() => setSpeed(4));
    const ff = +(process.env.FF || 8);
    for (let k = 0; k < 2000 && !(await g.ev(() => gameOver)); k++) {
      await cardsAway();
      const st = await g.ev(() => ({ phase, wave: waveIdx, of: totalWaves() }));
      const phaseNow = "wave";
      if (st.phase === "idle") {
        // six towers first, then ranks before more towers (the bot's own rule, roughly)
        if (await g.ev(() => towers.length) < 6) { await build(); await rankUp(); } else { await rankUp(); await build(); }
        const wb = await g.reach("#waveBtn");
        if (!wb.why) { await g.tapAt(wb.x, wb.y); taps++; waves++; await g.frames(2); }
        else { log("the wave button: " + wb.why); await g.ev(() => startWave()); }
        log("wave " + (st.wave + 1) + " of " + st.of + " sent: " + JSON.stringify(await g.ev(() => ({ lives, gold, towers: towers.length }))));
      }
      // a spell that is ready goes on the thickest knot of foes: its button, then a finger on the knot
      if (st.phase === "wave") {
        const sp = await g.ev(() => {
          if (spellsOff()) return null;
          const k = Object.keys(SPELLS).find(k => spellCd[k] <= 0);
          if (!k || enemies.length < 4) return null;
          const ps = enemies.filter(e => !e.fly && !e.dead).map(e => enemyPos(e));
          let best = null, bv = 0;
          for (const p of ps) { const v = ps.filter(q => Math.hypot(p.x - q.x, p.y - q.y) < SPELLS[k].radius).length; if (v > bv) { bv = v; best = p; } }
          return best && bv >= 3 ? { k, x: best.x, y: best.y } : null;
        });
        if (sp) {
          const q = await g.reach('#spellbar .spell[data-spell="' + sp.k + '"]');
          if (!q.why) { await g.tapAt(q.x, q.y); taps++; await g.frames(1); await tapWorld(sp.x, sp.y); taps++; if (await g.ev(k => spellCd[k] > 0, sp.k)) casts++; else { misses++; await g.ev(() => { castingSpell = null; }); } }
        }
      }
      // the field runs on (the page's own update at the battle's speed), then the next look
      await g.ev(s => { for (let n = Math.round(s / 0.05); n > 0 && !gameOver && phase === "wave"; n--) update(0.05); }, phaseNow === "wave" ? ff : 0);
      await g.frames(2);
    }
    await g.page.waitForFunction(() => gameOver, null, { timeout: 120000 });
    // the dance or the fall's beat ends by itself or by a tap; the end page comes up
    for (let k = 0; k < 40; k++) {
      const st = await g.ev(() => ({ c: !!celebration, p: !!parley, f: !!fallen, hidden: overlayEl.classList.contains("hidden") }));
      if (!st.c && !st.p && !st.f && !st.hidden) break;
      if (st.c || st.p) await g.ev(() => endCelebration());
      await g.wait(400);
    }
    const end = await g.ev(() => ({ mode: menuMode, title: $("ovTitle").textContent, sub: $("ovSub").innerText.replace(/\s+/g, " ").slice(0, 200), again: $("startBtn").innerText,
      facts: (() => { const f = battleFacts(); return { mode: f.mode, twist: f.twist, wave: f.wave, waves: f.waves, lives: f.lives, lives_max: f.lives_max, sec: f.sec, earned: f.earned, spent: f.spent }; })() }));
    log("end: " + JSON.stringify(end));
    notes.end = end; notes.built = built; notes.ranked = ranked; notes.taps = taps; notes.misses = misses; notes.waves = waves; notes.cards = cards; notes.casts = casts;
    await g.shot(o.shots, "daily-end-667x320");
    if (end.mode !== "victory" || !/Fight again/.test(end.again) || end.facts.mode !== "daily" || end.facts.waves !== 12) fails.push("the daily's end page: " + JSON.stringify(end));
    // (the page fades in over the field: its buttons are reached once it is up)
    for (const s of ["#startBtn", "#mapBtn"]) {
      let q = await g.reach(s);
      for (let k = 0; k < 25 && q.why; k++) { await g.wait(200); q = await g.reach(s); }
      if (q.why) fails.push("the end page's " + s + ": " + q.why);
    }
    // the campaign map: the campaign's battle is still there to resume, and nothing of the campaign was written
    await g.wait(900);
    await g.press("#mapBtn");
    await g.wait(400);
    const after = await g.ev(() => ({ run: localStorage.getItem("hs_run"), rec: localStorage.getItem("hs_records"), best: LEVELS.map((L, i) => localStorage.getItem(bestKey(i, L.era))).join(),
      resume: $("resumeBtn").style.display !== "none", mode: menuMode, daily: !!dailyRun, diff: curDiff }));
    if (after.run !== kept.run || after.rec !== kept.rec || after.best !== kept.best) fails.push("the daily wrote the campaign's saves");
    if (!after.resume || after.mode !== "map" || after.daily) fails.push("the map after the daily: " + JSON.stringify(after));
    const pr = await g.problems();
    if (pr.length) fails.push(...pr);
  } catch (e) { fails.push(String(e && e.stack || e)); await g.shot(o.shots, "daily-fail"); }
  await g.close(); await browser.close();
  R.finish("playtest-daily", fails, notes, t0);
})();
