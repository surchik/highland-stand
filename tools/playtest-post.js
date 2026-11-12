// Playtests 2 and 6 of docs/specs/gameplay.final.md 8.4 (G5), played by a finger on a phone held sideways (667 x 320,
// an iPhone's Safari user agent), every press the touch helper's of tools/regress/lib.js aimed at what the player sees.
//   2. Tushpa: the "new tower" card on its chronicle, a post built, the rally moved during the waves at 2x. No press
//      meant for the road opens a panel, buys land or moves the hero (at most 1 slip in 20 presses).
//   6. Sardarapat's 20 waves on a phone at 2x: the frame rate with four posts' men on the field stays where it is
//      today (the frame governor does not step in). Headless Chromium on a shared build machine is no iPhone, so the
//      battle is played twice, with four posts and with four archers on the same pads instead, and the two are
//      compared: the median frame, the share of frames over 22 ms, and the governor's density at the end.
// Usage: NODE_PATH=$(npm root -g) node tools/playtest-post.js [index.html] [--only=2|6] [--waves=n] [--verbose]
"use strict";
const R = require("./regress/lib.js");
const { devices } = require(process.env.PW_PATH || "playwright");
const o = R.cli();
const t0 = Date.now();
const UA = devices["iPhone 15"].userAgent;
const only = (o.rest.find(a => a.startsWith("--only=")) || "").slice(7);
const wavesOpt = +((o.rest.find(a => a.startsWith("--waves=")) || "--waves=0").slice(8));

(async () => {
  const browser = await R.launch();
  const fails = [], notes = {};
  const log = m => { if (o.verbose) console.log(m); };
  // Erebuni won once on Normal: Tushpa is open and the post is in its tray; the tutorial is done
  const STORE = { hs_tutorial_done: "1", hs_records: JSON.stringify({ erebuni: { stars: [0, 2, 0], lives: [0, 14, 0], endless: [0, 0, 0] } }),
    hs_towers_seen: null, hs_chapters_seen: JSON.stringify(["kingdoms"]), hs_unlocked_seen: JSON.stringify(["erebuni", "tushpa"]) };
  const open = (extra) => R.openGame(browser, o.file, Object.assign({ w: 667, h: 320, touch: true, dpr: 2, name: "SE Safari 667x320", ua: UA, standalone: false,
    storage: STORE, postCard: true, rallyBubble: true }, extra || {}));
  const tapWorld = async (g, x, y, dy) => { const p = await g.worldToClient(x, y, dy || 0); await g.tapAt(p.x, p.y); await g.frames(1); };

  // ---- playtest 2: Tushpa, the card, a post, its rally moved during the waves at 2x ----
  if (!only || only === "2") {
    const g = await open();
    try {
      await g.ev(() => { localStorage.setItem(bestKey(0, LEVELS[0].era), "21"); });
      await g.toMap();
      await g.ev(() => { openCampaignMap(1); selectMapLevel(1); showBrief(); });
      await g.page.waitForFunction(() => unlockCardOn === "post", null, { timeout: 5000 }).catch(() => fails.push("2: the post's card did not come up on Tushpa's chronicle"));
      const card = await g.ev(() => ({ on: unlockCardOn, title: $("tcTitle") && $("tcTitle").textContent, text: $("tcBody") && $("tcBody").innerText }));
      log("card: " + JSON.stringify(card));
      if (card.on === "post") await g.press("#tcBtn");
      if (await g.ev(() => !!unlockCardOn || !towersSeen().includes("post"))) fails.push("2: the card's Got it did not put it away and keep it");
      await g.wait(400);
      await g.press("#startBtn");
      await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
      const tray = await g.ev(() => trayTypes().join());
      if (!/post/.test(tray)) fails.push("2: Tushpa's tray has no post: " + tray);
      // the stand: an archer, a javelin bastion and stones on the best pads, then a post on the pad with most road
      await g.ev(() => { gold += 400; battleEarn(400, "gift"); syncHud(); });
      const build = async (kind, pad) => {
        await g.press('#shop .card[data-type="' + kind + '"]');
        const n0 = await g.ev(() => towers.length);
        await tapWorld(g, PADS_[pad][0], PADS_[pad][1], 4);
        if (await g.ev(() => towers.length) === n0) await tapWorld(g, PADS_[pad][0], PADS_[pad][1], 4);
        await g.ev(() => { if (placing) setPlacing(null); });
      };
      const PADS_ = await g.ev(() => PADS);
      const plan = await g.ev(() => {
        const pts = [];
        for (let ri = 0; ri < ROUTES.length; ri++) { if (ROUTES[ri].track) continue; for (let k = 0; k <= 60; k++) pts.push(routeAt(ri, ROUTES[ri].len * k / 60)); }
        const rank = PADS.map((p, i) => ({ i, n: pts.filter(q => inGroundRange(p[0], p[1], q.x, q.y, 160)).length })).sort((a, b) => b.n - a.n).map(x => x.i);
        const post = rank.filter(i => padTakesPost(i)).map(i => ({ i, n: postRoadIn(PADS[i][0], PADS[i][1], 150).length })).sort((a, b) => b.n - a.n)[0].i;
        return { shoot: rank.filter(i => i !== post).slice(0, 3), post };
      });
      for (const [k, kind] of ["archer", "ballista", "catapult"].entries()) await build(kind, plan.shoot[k]);
      await build("post", plan.post);
      if (!(await g.ev(i => towerAt(i) && towerAt(i).type === "post", plan.post))) fails.push("2: the post was not built by its tile and two taps");
      // the speed button to 2x, then the first wave
      await g.press("#speedBtn");
      if (await g.ev(() => speedMult) !== 2) fails.push("2: the speed button did not give 2x");
      await g.press("#waveBtn");
      // the rally moved during the waves: the post tapped, Rally point, the road in the ring; 20 presses on the road
      let moved = 0, slips = 0, presses = 0, bubble = false;
      const slipsSeen = [];
      for (let k = 0; k < 20; k++) {
        await g.ev(() => { if (phase === "idle" && !gameOver) startWave(); });
        const body = await g.ev(i => ({ x: towerAt(i).x, y: towerAt(i).y }), plan.post);
        await tapWorld(g, body.x, body.y, -30);
        await g.wait(450);
        if (await g.ev(() => !!rallyBubble)) { bubble = true; }
        if (!(await g.ev(i => !!selected && selected.pad === i && panelEl.style.display === "block", plan.post))) { slipsSeen.push("tap " + k + ": the post's tap opened no panel"); await g.ev(i => { setPlacing(null); heroSelected = false; showPanel(towerAt(i)); }, plan.post); await g.wait(450); }
        await g.press("#pRally");
        const to = await g.ev(([i, k]) => {
          const t = towerAt(i), r = canvas.getBoundingClientRect(), on = s => { const p = proj(s.x, s.y); return { x: r.left + offX + p.x * scale, y: r.top + offY + p.y * scale }; };
          const pts = postRoadIn(t.x, t.y, postReach(t)).filter(s => { const c = on(s), e = document.elementFromPoint(c.x, c.y); return e && e.id === "game"; });
          // alternately the two ends of the stretch in reach, a finger's tap a little off the road's middle
          pts.sort((a, b) => a.dist - b.dist);
          const s = pts[k % 2 ? Math.floor(pts.length * 0.85) : Math.floor(pts.length * 0.15)];
          const c = on(s);
          return { x: c.x + ((k * 7) % 9 - 4), y: c.y + ((k * 5) % 7 - 3), wx: s.x, wy: s.y, before: { sel: !!selected, hero: hero && hero.rally ? 1 : 0, plots: plotsBought, rally: [t.rally.x, t.rally.y] } };
        }, [plan.post, k]);
        presses++;
        await g.tapAt(to.x, to.y);
        await g.frames(2);
        const after = await g.ev(i => ({ rally: [towerAt(i).rally.x, towerAt(i).rally.y], armed: !!rallying, sel: panelEl.style.display === "block", hero: hero && hero.rally ? 1 : 0, plots: plotsBought }), plan.post);
        if (after.rally[0] !== to.before.rally[0] || after.rally[1] !== to.before.rally[1]) moved++;
        if (after.sel || after.hero > to.before.hero || after.plots !== to.before.plots) { slips++; slipsSeen.push("press " + k + ": " + JSON.stringify(after)); }
        if (after.armed) {
          const why = await g.ev(([x, y]) => { const e = document.elementFromPoint(x, y); return { hit: e ? e.id || e.className : "none", toast: toastEl.textContent }; }, [to.x, to.y]);
          slipsSeen.push("press " + k + ": still armed (" + why.toast + ", the press on " + why.hit + ")");
          await g.ev(() => { rallying = null; });
        }
        await g.wait(2500);   // the men walk there and fight a while (game time at 2x)
        if (await g.ev(() => gameOver)) break;
      }
      const end = await g.ev(() => ({ wave: waveIdx, lives, hold: Math.round(towers.find(t => t.type === "post").holdS || 0), kills: towers.find(t => t.type === "post").kills || 0 }));
      notes.p2 = { card: card.title, moved, presses, slips, bubble, wave: end.wave, lives: end.lives, holdS: end.hold, postKills: end.kills };
      if (moved < 5) fails.push("2: the rally moved only " + moved + " times");
      if (slips > presses / 20) fails.push("2: " + slips + " slips in " + presses + " presses: " + slipsSeen.join(" | "));
      if (slipsSeen.length) notes.p2.seen = slipsSeen;
      const p = await g.problems();
      if (p.length) fails.push("2: " + p.join(" | "));
    } catch (e) { fails.push("2: " + e.message.split("\n")[0]); }
    await g.close();
  }

  // ---- playtest 6: Sardarapat's 20 waves at 2x on a phone: four posts against four archers on the same pads ----
  if (!only || only === "6") {
    const runOnce = async (withPosts) => {
      const g = await open({ storage: Object.assign({}, STORE, { hs_towers_seen: JSON.stringify(["post", "rally", "council", "call"]) }) });
      try {
        const lv = await g.ev(() => levelIndexOf("sardarapat"));
        await g.toMap();
        await g.enterBattle(lv);
        await g.ev(([withPosts]) => {
          gold = 1e6; testAided = true;
          const pts = [];
          for (let ri = 0; ri < ROUTES.length; ri++) { if (ROUTES[ri].track) continue; for (let k = 0; k <= 60; k++) pts.push(routeAt(ri, ROUTES[ri].len * k / 60)); }
          const rank = PADS.map((p, i) => ({ i, n: pts.filter(q => inGroundRange(p[0], p[1], q.x, q.y, 170)).length })).sort((a, b) => b.n - a.n).map(x => x.i);
          const posts = rank.filter(i => padTakesPost(i)).slice(0, 4);
          const kinds = ["archer", "ballista", "catapult", "fire", "drums"];
          let n = 0;
          for (const i of rank) {
            if (posts.includes(i)) { placeTower(withPosts ? "post" : "archer", i); }
            else placeTower(kinds[n++ % 5], i);
            // every tower at its third rank with its first mastery, so the stand lasts the twenty waves being measured
            const t = towerAt(i); if (t) { t.level = 2; t.spec = "a"; if (t.type === "post") postSyncMen(t, true); towerSyncHp(t); }
          }
          setSpeed(2); auto = true; autoBtn.textContent = "Auto: On"; autoBtn.classList.add("on");
          window.__frames = []; let last = 0;
          const tick = ts => { if (last && !paused) window.__frames.push(ts - last); last = ts; if (!gameOver) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
          startWave();
        }, [withPosts]);
        const W = wavesOpt || 20;
        await g.page.waitForFunction(W => gameOver || waveIdx >= W && phase === "idle", W, { timeout: 90 * 60000, polling: 1000 });
        const r = await g.ev(() => {
          const f = window.__frames.slice().sort((a, b) => a - b), med = f[Math.floor(f.length / 2)] || 0;
          const men = towers.filter(t => t.type === "post").reduce((s, t) => s + t.men.length, 0);
          return { wave: waveIdx, over: gameOver, lives, frames: f.length, medianMs: +med.toFixed(1), over22: +(f.filter(x => x > 22).length / Math.max(1, f.length)).toFixed(3),
            p90: +(f[Math.floor(f.length * 0.9)] || 0).toFixed(1), dprCap, men };
        });
        const p = await g.problems();
        if (p.length) fails.push("6: " + p.join(" | "));
        await g.close();
        return r;
      } catch (e) { fails.push("6: " + e.message.split("\n")[0]); await g.close(); return null; }
    };
    // (the two battles side by side, each in its own page: on a shared machine the load is then the same for both)
    const [withPosts, without] = await Promise.all([runOnce(true), runOnce(false)]);
    notes.p6 = { withPosts, without };
    log("6: " + JSON.stringify(notes.p6));
    if (withPosts && without && withPosts.medianMs > without.medianMs * 1.15 + 1) fails.push("6: four posts' men slow the median frame from " + without.medianMs + " to " + withPosts.medianMs + " ms");
    if (withPosts && without && withPosts.dprCap < without.dprCap) fails.push("6: with the posts the frame governor stepped down to " + withPosts.dprCap + " (without: " + without.dprCap + ")");
  }
  await browser.close();
  console.log("NOTES " + JSON.stringify(notes));
  R.finish("playtest-post", fails, {}, t0);
})().catch(e => { console.error(e); process.exit(1); });
