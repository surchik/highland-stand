// The tutorial's Send Wave reminders and its Auto lesson, played through by the player's own input on a fresh save, by
// mouse at 1600x900 and by touch on an iPad at 1194x834. Erebuni's chronicle offers the tutorial; the coach is
// followed step by step (its Next, the archers' card, the glowing pad, Send Wave, the tower, Upgrade, a spell, the
// hero, the speed button, Auto, To battle!). On the Send Wave step the field waits for the player: the bubble says it
// again more plainly at 8 s and again at 18 s (naming Space to a keyboard and not to a finger), the button shaking
// each time, and no wave comes by itself. The Auto step points at the Auto button, and Auto turned on there then sends
// the next wave by itself; turned off, a cleared field waits, and the reminder toast comes at 15 s, then every 25 s,
// three times in all (the later waits are wound forward, as is the 8 and 18 s wait under --quick).
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/nag.js [index.html] [--quick] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const CONFIGS = [R.SIZES.desk, R.SIZES.ipad];

(async () => {
  const browser = await R.launch();
  const fails = [];
  let steps = 0;
  await R.pool(CONFIGS, CONFIGS.length, async (C) => {
    const g = await R.openGame(browser, o.file, C);
    const fail = async (m) => { fails.push(C.name + " " + m); await g.shot(o.shots, "nag " + C.name + " " + m.slice(0, 60)); };
    const log = (m) => { if (o.verbose) console.log(C.name + " " + m); };
    const step = () => g.ev(() => (tut ? TUT_STEPS[tut.i].id : null));
    const text = () => g.ev(() => (coachEl ? coachEl.querySelector(".cText").textContent : ""));
    const waitStep = async (id, ms = 15000) => {
      try { await g.page.waitForFunction(id => tut && TUT_STEPS[tut.i].id === id && coachEl.classList.contains("on"), id, { timeout: ms }); }
      catch (e) { throw new Error("the coach did not reach the " + id + " step (it stands at " + await step() + ")"); }
      await g.frames(2);
      steps++;
    };
    const nudged = () => g.ev(() => waveBtn.classList.contains("nudge"));
    try {
      await g.toMap();
      await g.ev(() => { try { localStorage.removeItem("hs_tutorial_done"); } catch (e) {} });
      await g.ev(() => {
        localStorage.setItem("hs_chapters_seen", JSON.stringify(CHAPTERS.map(C => C.id)));
        curDiff = prefDiff = 1; openCampaignMap(0); selectMapLevel(0); showBrief();
      });
      await g.frames(2);
      const begin = await g.ev(() => $("startBtn").textContent);
      if (!/Tutorial/.test(begin)) await fail("Erebuni's chronicle does not offer the tutorial: \"" + begin + "\"");
      await g.wait(400);
      await g.press("#startBtn");
      await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });

      await waitStep("welcome"); await g.press("#coach .cNext");
      await waitStep("gold"); await g.press("#coach .cNext");
      await waitStep("shop"); await g.press('#shop .card[data-type="archer"]');
      await waitStep("pad");
      const pad = await g.ev(() => PADS[tut.pad]);
      const pp = await g.worldToClient(pad[0], pad[1], 4);
      await g.tapAt(pp.x, pp.y);
      if (g.touch) { await g.frames(1); await g.tapAt(pp.x, pp.y); }

      // ---- Send Wave: the reminders ----
      await waitStep("wave");
      const w0 = await text();
      if (!/Send Wave/.test(w0) || !/^Ready!/.test(w0)) await fail("the Send Wave step's first words: " + w0);
      const halo = await g.ev(() => { const h = coachHalos.find(h => h.style.display === "block"), r = waveBtn.getBoundingClientRect(); return h ? Math.abs(h.getBoundingClientRect().left - (r.left - 5)) < 2 : false; });
      if (!halo) await fail("the Send Wave step does not outline the Send Wave button");
      const wind = async (s) => { if (o.quick) await g.ev(s => { tut.t0 -= s * 1000; }, s); };
      // the first reminder at 8 s
      await wind(8.2);
      await g.page.waitForFunction(() => tutNagLevel() >= 1, null, { timeout: 12000 });
      await g.frames(3);
      const w1 = await text();
      if (!/waits for your signal/.test(w1)) await fail("at 8 s the bubble says: " + w1);
      if (!await nudged()) await fail("at 8 s the Send Wave button does not shake");
      // the second at 18 s
      await wind(10);
      await g.page.waitForFunction(() => tutNagLevel() >= 2, null, { timeout: 14000 });
      await g.frames(3);
      const w2 = await text();
      if (!/Nothing happens until you send the wave/.test(w2)) await fail("at 18 s the bubble says: " + w2);
      if (/Space/.test(w2) === g.touch) await fail("at 18 s the bubble " + (g.touch ? "names Space to a finger" : "does not name Space to a keyboard") + ": " + w2);
      if (!await nudged()) await fail("at 18 s the Send Wave button does not shake");
      const held = await g.ev(() => ({ waveIdx, phase, auto, foes: enemies.length }));
      if (held.waveIdx !== 0 || held.phase !== "idle" || held.auto || held.foes) await fail("the field did not wait for Send Wave: " + JSON.stringify(held));
      log("send wave reminders ok");
      await g.press("#waveBtn");

      // ---- the battle's first lessons ----
      await waitStep("fight", 5000);
      await waitStep("select", 60000);
      const tw = await g.ev(() => ({ x: towers[0].x, y: towers[0].y }));
      const tp = await g.worldToClient(tw.x, tw.y, -30);
      await g.tapAt(tp.x, tp.y);
      await waitStep("upgrade");
      await g.press("#pActions .up");
      await waitStep("kinds"); await g.press("#coach .cNext");
      await waitStep("spells");
      await g.press('#spellbar .spell[data-spell="arrows"]');
      const road = await g.ev(() => { const p = routeAt(0, ROUTES[0].len * 0.5); return [p.x, p.y]; });
      const rp = await g.worldToClient(road[0], road[1]);
      await g.tapAt(rp.x, rp.y);
      await waitStep("hero");
      if (await g.ev(() => !!(hero && hero.alive))) {
        await g.press("#heroBtn");
        const hp = await g.worldToClient(road[0], road[1] + 30);
        await g.tapAt(hp.x, hp.y);
      } else await g.press("#coach .cNext");
      await waitStep("speed");
      await g.press("#speedBtn");
      if (await g.ev(() => speedMult) !== 2) await fail("the speed button did not run the battle at 2x");
      if (await step() === "speed") await g.press("#coach .cNext");

      // ---- Auto: the lesson ----
      await waitStep("auto");
      const a0 = await text();
      if (!/Auto/.test(a0) || !/sends each new wave by itself/.test(a0)) await fail("the Auto step says: " + a0);
      const aHalo = await g.ev(() => { const r = autoBtn.getBoundingClientRect(); return coachHalos.some(h => h.style.display === "block" && Math.abs(h.getBoundingClientRect().left - (r.left - 5)) < 2 && Math.abs(h.getBoundingClientRect().top - (r.top - 5)) < 2); });
      if (!aHalo) await fail("the Auto step does not outline the Auto button");
      await g.press("#autoBtn");
      const on = await g.ev(() => ({ auto, label: autoBtn.textContent, lit: autoBtn.classList.contains("on") }));
      if (!on.auto || on.label !== "Auto: On" || !on.lit) await fail("Auto did not turn on: " + JSON.stringify(on));
      await waitStep("plots"); await g.press("#coach .cNext");
      await waitStep("mastery"); await g.press("#coach .cNext");
      await waitStep("ready"); await g.press("#coach .cNext");
      await g.frames(2);
      if (await g.ev(() => tut !== null || localStorage.getItem("hs_tutorial_done") !== "1")) await fail("To battle! did not end the tutorial and mark it done");
      log("tutorial walked");

      // Auto on: once the field is clear the next wave comes by itself
      await g.ev(() => { towers.forEach(t => { t.level = 2; }); });   // the first waves must not cost the stand
      const w = await g.ev(() => waveIdx);
      await g.page.waitForFunction(w => waveIdx > w || /Next in/.test(waveBtn.textContent), w, { timeout: 90000 });
      const auto1 = await g.ev(() => ({ waveIdx, phase, autoT, btn: waveBtn.textContent }));
      if (!/Next in/.test(auto1.btn)) await fail("under Auto the Send Wave button did not count down to the next wave: " + JSON.stringify(auto1));
      await g.page.waitForFunction(w => waveIdx > w, w, { timeout: 20000 }).catch(async () => { await fail("under Auto no wave came by itself after wave " + w); });
      log("auto sent wave " + await g.ev(() => waveIdx));

      // Auto off: the field waits, and the reminders come at 15 s, then every 25 s, three in all
      await g.press("#autoBtn");
      if (await g.ev(() => auto)) await fail("a second press did not turn Auto off");
      await g.page.waitForFunction(() => phase === "idle" && enemies.length === 0, null, { timeout: 90000 });
      const idleW = await g.ev(() => waveIdx);
      const toasts = [];
      await g.ev(() => { window.__toasts = []; const t0 = toast; toast = function (m) { window.__toasts.push(m); return t0.apply(this, arguments); }; });
      for (let k = 0; k < 4; k++) {
        if (k > 0 || o.quick) await g.ev(k => { tutIdle.t -= (k ? 25000 : 15000) - 300; }, k);
        const got = await g.page.waitForFunction(n => (window.__toasts || []).filter(m => /The field is clear/.test(m)).length > n, toasts.length, { timeout: k === 3 ? 2500 : 17000 }).then(() => true, () => false);
        if (k < 3 && !got) { await fail("reminder " + (k + 1) + " did not come"); break; }
        if (k === 3 && got) await fail("a fourth reminder came");
        if (got) {
          toasts.push(1);
          const m = (await g.ev(() => window.__toasts.filter(m => /The field is clear/.test(m)).pop()));
          if (!new RegExp("Send Wave for wave " + (idleW + 1) + ",.*Auto").test(m)) await fail("reminder " + (k + 1) + " says: " + m);
          if (!await nudged()) await fail("reminder " + (k + 1) + " does not shake the Send Wave button");
        }
      }
      if (await g.ev(() => waveIdx) !== idleW) await fail("with Auto off a wave came by itself");
      log("idle reminders " + toasts.length);
    } catch (e) {
      await fail(e.message.split("\n")[0]);
    }
    const p = await g.problems();
    if (p.length) await fail(p.join(" | "));
    await g.close();
  });
  await browser.close();
  R.finish("nag", fails, { steps }, t0);
})().catch(e => { console.error(e); process.exit(1); });
