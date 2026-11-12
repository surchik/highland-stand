// Playtests 1 and 5 of docs/specs/gameplay.final.md 8.4 (G4), played by a finger on a phone held sideways (667 x 320,
// an iPhone's Safari), every press the touch helper's of tools/regress/lib.js aimed at what the player sees.
//   1. A fresh save: the coached stand to Erebuni's victory. Ten waves, no new tile, the same coach, new kinds of foe
//      no more than two a wave. Under 25 minutes at 1x with the reading.
//   5. A family run on Easy that never opens the Council or builds a new tower: it wins the first six.
// Usage: NODE_PATH=$(npm root -g) node tools/playtest-lengths.js [index.html] [--only=1|5] [--speed=1|2|4] [--verbose]
//
// The finger plays as a careful newcomer: before each wave it builds the next tower of a mixed order (archers,
// javelins, stones, fire, archers, drums, ...) on the free pad that watches the most road, by pressing the tile and
// then the pad; with the rest of its gold it opens a tower's panel and presses Upgrade, the cheapest first; once
// every pad is built it takes the first mastery. During a wave it casts a ready spell on the thickest knot of foes
// by pressing the medallion and then the road. It never opens the Council (playtest 5), never sells, never moves
// the hero. The battle runs at --speed (default 2: a person at 1x is measured by the battle clock, which the speed
// does not change). For each battle the script prints the battle clock (game minutes: the time at 1x), the real
// minutes, the defenders kept, the new kinds of foe each wave brought, and how many presses it took.
"use strict";
const R = require("./regress/lib.js");
const { devices } = require(process.env.PW_PATH || "playwright");
const o = R.cli();
const t0 = Date.now();
const UA = devices["iPhone 15"].userAgent;
const only = (o.rest.find(a => a.startsWith("--only=")) || "").slice(7);
const speed = +((o.rest.find(a => a.startsWith("--speed=")) || "--speed=2").slice(8));
const ORDER = ["archer", "ballista", "catapult", "fire", "archer", "drums", "ballista", "catapult", "archer", "fire", "ballista", "drums", "catapult", "archer"];

(async () => {
  const browser = await R.launch();
  const fails = [], notes = {};
  const log = m => { if (o.verbose) console.log(m); };
  const open = storage => R.openGame(browser, o.file, { w: 667, h: 320, touch: true, dpr: 2, name: "SE Safari 667x320", ua: UA, standalone: false, storage });

  // one battle played by the finger from its first horn to its end; returns what it saw
  async function play(g, tag) {
    let presses = 0, fresh = [];
    const press = async sel => { presses++; await g.press(sel); };
    const tapWorld = async (x, y, dy) => { presses++; const p = await g.worldToClient(x, y, dy || 0); await g.tapAt(p.x, p.y); await g.frames(1); };
    await g.ev(() => { window.__seenKinds = new Set(); window.__fresh = []; });
    await g.ev(s => setSpeed(s), speed);   // the battle's pace (the battle clock is the same at every speed)
    const spend = async () => {
      for (let guard = 0; guard < 12; guard++) {
        const plan = await g.ev(ORDER => {
          const pts = [];
          for (let ri = 0; ri < ROUTES.length; ri++) { if (ROUTES[ri].track) continue; for (let k = 0; k <= 60; k++) pts.push(routeAt(ri, ROUTES[ri].len * k / 60)); }
          const free = PADS.map((p, i) => i).filter(i => !towerAt(i));
          const kind = ORDER[towers.length % ORDER.length];
          const up = towers.filter(t => !t.wreck && !t.spec && t.level < TOWER_DEFS[t.type].levels.length - 1).sort((a, b) => a.level - b.level)[0];
          if (free.length && (towers.length < 5 || !up) && gold >= towerCost(kind)) {
            const best = free.map(i => ({ i, n: pts.filter(q => inGroundRange(PADS[i][0], PADS[i][1], q.x, q.y, 160)).length })).sort((a, b) => b.n - a.n)[0];
            return { build: kind, pad: PADS[best.i] };
          }
          if (up && gold >= rankCost(up.type, up.level + 1)) return { up: [up.x, up.y] };
          const sp = towers.find(t => !t.spec && !t.wreck && t.level === TOWER_DEFS[t.type].levels.length - 1);
          if (!free.length && sp && gold >= specInfo(sp.type, "a").cost) return { spec: [sp.x, sp.y] };
          return null;
        }, ORDER);
        if (!plan) return;
        if (plan.build) {
          const n0 = await g.ev(() => towers.length);
          await press('#shop .card[data-type="' + plan.build + '"]');
          await tapWorld(plan.pad[0], plan.pad[1], 4);
          // a finger's first tap on a pad shows the tower there; the second builds it
          if (await g.ev(() => towers.length) === n0) await tapWorld(plan.pad[0], plan.pad[1], 4);
          await g.ev(() => { if (placing) setPlacing(null); });
        } else {
          await tapWorld(plan.up ? plan.up[0] : plan.spec[0], (plan.up || plan.spec)[1], -30);
          const sel = plan.up ? "#pActions .up" : "#pActions .spec";
          await g.wait(500);   // the sheet slides up
          const lv0 = await g.ev(p => { const t = towers.find(t => t.x === p[0] && t.y === p[1]); return t ? t.level + (t.spec ? 9 : 0) : -1; }, plan.up || plan.spec);
          if (await g.ev(s => !!document.querySelector(s) && panelEl.style.display === "block", sel)) await press(sel);
          const lv1 = await g.ev(p => { const t = towers.find(t => t.x === p[0] && t.y === p[1]); return t ? t.level + (t.spec ? 9 : 0) : -1; }, plan.up || plan.spec);
          if (lv1 === lv0 && await g.ev(s => !!document.querySelector(s) && panelEl.style.display === "block", sel)) await press(sel);   // a sheet's button armed by the first tap
          await g.ev(() => hidePanel());
        }
        await g.frames(1);
      }
    };
    const cast = async () => {
      const t = await g.ev(() => {
        const k = Object.keys(SPELLS).find(k => spellCd[k] <= 0);
        if (!k || enemies.length < 5) return null;
        const ps = enemies.filter(e => !e.fly).map(e => enemyPos(e));
        let best = null, bv = 0;
        for (const p of ps) { const v = ps.filter(q => Math.hypot(p.x - q.x, p.y - q.y) < SPELLS[k].radius).length; if (v > bv) { bv = v; best = p; } }
        return best && bv >= 4 ? { k, x: best.x, y: best.y } : null;
      });
      if (!t) return;
      await press('#spellbar .spell[data-spell="' + t.k + '"]');
      await tapWorld(t.x, t.y);
    };
    const realStart = Date.now();
    for (let guard = 0; guard < 20000; guard++) {
      const st = await g.ev(() => ({ over: gameOver, phase, w: waveIdx, n: (typeof totalWaves === "function" ? totalWaves() : TOTAL_WAVES), card: !!document.querySelector("#trickCard.on"), coach: !!(coachEl && coachEl.classList.contains("on")), can: !waveBtn.disabled }));
      if (st.over) break;
      if (st.card) { await press("#tcBtn"); continue; }
      if (st.coach) { if (await g.ev(() => !!document.querySelector("#coach .cNext"))) await press("#coach .cNext"); else await g.wait(200); continue; }
      if (st.phase === "idle") {
        await spend();
        if (st.can) {
          await press("#waveBtn");
          const kinds = await g.ev(() => { const k = new Set(spawnQueue.map(q => q.trick || q.type)), nw = [...k].filter(x => !window.__seenKinds.has(x)); nw.forEach(x => window.__seenKinds.add(x)); return nw; });
          fresh.push(st.w + 1 + ":" + kinds.join("+"));
        }
      } else { await cast(); await g.wait(700); if (await g.ev(() => phase === "wave" && !spawnQueue.length)) await spend(); }
    }
    const end = await g.ev(() => ({ won: gameOver && lives > 0, f: battleFacts(), n: (typeof totalWaves === "function" ? totalWaves() : TOTAL_WAVES), board: towers.map(t => t.type[0] + (t.spec || t.level + 1)).join("") }));
    const r = { won: end.won, waves: end.f.wave + "/" + end.n, kept: end.f.lives + "/" + end.f.lives_max, clockMin: +(end.f.sec / 60).toFixed(1),
      realMin: +((Date.now() - realStart) / 60000).toFixed(1), presses, board: end.board, spent: end.f.spent, left: end.f.left, fresh: fresh.join(" ") };
    log(tag + " " + JSON.stringify(r));
    return r;
  }

  // ---- playtest 1: a fresh save, the coached stand to Erebuni's victory ----
  if (!only || only === "1") {
    const g = await open({});
    try {
      if (!await g.ev(() => isPhone())) fails.push("1: the page is not in its phone layout");
      await g.toMap();
      await g.press("#startBtn");                      // March on Erebuni: its chronicle
      await g.page.waitForFunction(() => menuMode === "brief");
      const brief = await g.ev(() => ({ begin: $("startBtn").textContent, len: $("briefLen") ? $("briefLen").textContent : "(none)", tiles: [...document.querySelectorAll("#shop .card")].filter(c => c.offsetParent !== null || getComputedStyle(c).display !== "none").length }));
      if (!/Tutorial/.test(brief.begin)) fails.push("1: the chronicle does not offer the tutorial: " + brief.begin);
      if (brief.len !== "10 waves. A commander leads wave 7 and wave 10.") fails.push("1: the chronicle's line: " + brief.len);
      await g.wait(400);
      await g.press("#startBtn");
      await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
      // the coach, as a player follows it: the steps nag.js walks, by touch
      const steps = [];
      const waitStep = async (id, ms = 60000) => { await g.page.waitForFunction(id => tut && TUT_STEPS[tut.i].id === id && coachEl.classList.contains("on"), id, { timeout: ms }); await g.frames(2); steps.push(id); };
      await waitStep("welcome"); await g.wait(1500); await g.press("#coach .cNext");
      await waitStep("gold"); await g.wait(1500); await g.press("#coach .cNext");
      await waitStep("shop"); await g.press('#shop .card[data-type="archer"]');
      await waitStep("pad");
      const pad = await g.ev(() => PADS[tut.pad]);
      const pp = await g.worldToClient(pad[0], pad[1], 4);
      await g.tapAt(pp.x, pp.y); await g.frames(1); await g.tapAt(pp.x, pp.y);
      await waitStep("wave"); await g.wait(1500); await g.press("#waveBtn");
      await waitStep("fight", 5000);
      await waitStep("select");
      const tw = await g.ev(() => ({ x: towers[0].x, y: towers[0].y }));
      const tp = await g.worldToClient(tw.x, tw.y, -30); await g.tapAt(tp.x, tp.y);
      await waitStep("upgrade"); await g.wait(600); await g.press("#pActions .up");
      await waitStep("kinds"); await g.wait(1500); await g.press("#coach .cNext");
      await waitStep("spells"); await g.press('#spellbar .spell[data-spell="arrows"]');
      const road = await g.ev(() => { const p = routeAt(0, ROUTES[0].len * 0.5); return [p.x, p.y]; });
      const rp = await g.worldToClient(road[0], road[1]); await g.tapAt(rp.x, rp.y);
      await waitStep("hero");
      if (await g.ev(() => !!(hero && hero.alive))) { await g.press("#heroBtn"); const hp = await g.worldToClient(road[0], road[1] + 30); await g.tapAt(hp.x, hp.y); }
      else await g.press("#coach .cNext");
      await waitStep("speed"); await g.press("#speedBtn");
      if (await g.ev(() => tut && TUT_STEPS[tut.i].id === "speed")) await g.press("#coach .cNext");
      await waitStep("auto"); await g.press("#autoBtn"); await g.press("#autoBtn");   // on, then off again: the finger sends its own waves
      await waitStep("plots"); await g.wait(1500); await g.press("#coach .cNext");
      await waitStep("mastery"); await g.wait(1500); await g.press("#coach .cNext");
      await waitStep("ready");
      const last = await g.ev(() => coachEl.querySelector(".cText").textContent);
      if (!/through all ten waves/.test(last)) fails.push("1: the coach's last words: " + last);
      await g.press("#coach .cNext");
      const tray = await g.ev(() => [...document.querySelectorAll("#shop .card")].filter(c => getComputedStyle(c).display !== "none").map(c => c.dataset.type).join());
      if (tray !== "archer,ballista,catapult,fire,drums") fails.push("1: the tray: " + tray);
      const r = await play(g, "playtest 1");
      r.coach = steps.length + " steps";
      notes.playtest1 = r;
      if (!r.won) fails.push("1: Erebuni was lost: " + r.waves);
      if (!r.waves.endsWith("/10")) fails.push("1: the battle was " + r.waves + " waves");
      for (const f of r.fresh.split(" ")) { const k = f.split(":")[1]; if (k && k.split("+").length > 2) fails.push("1: wave " + f + " brought more than two new kinds"); }
      if (r.clockMin > 25) fails.push("1: the battle clock ran " + r.clockMin + " minutes");
    } catch (e) { fails.push("1: " + e.message.split("\n")[0]); }
    const p = await g.problems(); if (p.length) fails.push("1: " + p.join(" | "));
    await g.close();
  }

  // ---- playtest 5: a family run on Easy, the first six, no Council, no new tower ----
  if (!only || only === "5") {
    const g = await open({ hs_tutorial_done: "1", hs_mig_7lv: "1", hs_mig_ids: "1", hs_mig_rec: "1" });
    notes.playtest5 = {};
    try {
      await g.toMap();
      for (let lv = +(process.env.PT5_FROM || 0); lv < 6; lv++) {
        // from the victory page (or the map) to the next battlefield's chronicle on Easy, as the map's buttons take it
        await g.ev(lv => { if (typeof leaveVictory === "function") leaveVictory(); hideEndingCard(); gameOver = true; curDiff = prefDiff = 0;
          openCampaignMap(lv); selectMapLevel(lv); showBrief(); }, lv);
        await g.frames(2);
        for (let k = 0; k < 20; k++) { const q = await g.reach("#startBtn"); if (!q.why) break; await g.wait(150); }
        await g.press("#startBtn");                          // Begin the Stand
        await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
        const id = await g.ev(() => levelId(curLevel) + ":" + DIFFS[curDiff].name);
        const r = await play(g, "playtest 5 " + id);
        notes.playtest5[id] = r;
        if (!r.won) { fails.push("5: " + id + " was lost on wave " + r.waves); break; }   // the road after it stays shut
        if (await g.ev(() => kitPower(kit)) !== 0) fails.push("5: a Council tier was in force on " + id);
        await g.ev(() => { if (celebration || parley) endCelebration(); hideEndingCard(); });
      }
    } catch (e) { fails.push("5: " + e.message.split("\n")[0]); }
    const p = await g.problems(); if (p.length) fails.push("5: " + p.join(" | "));
    await g.close();
  }
  await browser.close();
  R.finish("playtest-lengths", fails, notes, t0);
})().catch(e => { console.error(e); process.exit(1); });
