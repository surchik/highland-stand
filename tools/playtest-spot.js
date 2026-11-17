// Playtest 3 of gameplay 8.4 for the Observation Post (G7e): Stepanakert 1992 by touch, as a player plays it, on an
// iPhone 15 (852x393), the iPad (1194x834) and an iPhone SE (667x320), both phones held sideways in Safari. Every press
// is a finger's (tools/regress/lib.js tapAt, press): the tray's tiles, the pads (a first tap shows the reach, a second
// builds), the post and its panel's buttons, Send Wave, the speed button and Auto. The board: archers, a ballista, a
// catapult and a fire on the pads that watch the most road, then the Lookout post from its tile on the free pad whose
// reach holds the most road; a second is tried from its tile on another pad and must be refused with its sentence. Its
// panel is opened by a tap on its body and Upgrade raises it a rank. The shooters are raised to their third rank by script
// (the test is about the post, and its lives say nothing about balance). Then the waves at 2x with Auto, and while foes
// are in its reach the post is retargeted by a finger: a tap on its body, then Target, five times over the battle.
// Watched at every look: it marks at most its marks, only foes in its reach, each with the post's amp; after each
// retarget the mark is the first foe of the new order among those in reach; a marked hidden foe is seen.
// It fails on a page error, a second post built, a panel not opened by a tap, a retarget that did not move the order or
// the mark, no mark seen by wave 6, the stand lost before wave 6, or any watch above broken.
// Usage:  NODE_PATH=$(npm root -g) node tools/playtest-spot.js [index.html] [--verbose]
"use strict";
const R = require("./regress/lib");
const o = R.cli();
const t0 = Date.now();
const PHONE = { name: "touch phone 667x320", w: 667, h: 320, touch: true, ua: require(process.env.PW_PATH || "playwright").devices["iPhone 15"].userAgent, phone: true };
const RETARGETS = 5, UNTIL = 6;
(async () => {
  const browser = await R.launch();
  const fails = [], out = {};
  for (const C of [Object.assign({}, PHONE, { name: "touch iPhone 15 852x393", w: 852, h: 393 }), R.SIZES.ipad, PHONE]) {
    const g = await R.openGame(browser, o.file, C);
    const fail = m => fails.push(C.name + " " + m);
    try {
      await g.toMap();
      await g.enterBattle(await g.ev(() => levelIndexOf("stepanakert92")));
      await g.ev(() => { gold = 2000; syncHud(); });
      const tray = await g.ev(() => trayTypes().join());
      if (!/,spotter$/.test(tray)) fail("Stepanakert 1992's tray: " + tray);
      const build = async (type, pad) => {
        if (await g.ev(() => placing) !== type) await g.press('#shop .card[data-type="' + type + '"]');
        const p = await g.ev(i => PADS[i], pad);
        const pt = await g.worldToClient(p[0], p[1], 4);
        await g.tapAt(pt.x, pt.y); await g.frames(1);
        await g.tapAt(pt.x, pt.y); await g.frames(1);
        return g.ev(i => (towerAt(i) ? towerAt(i).type : null), pad);
      };
      const roadPads = await g.ev(() => PADS.map((p, i) => i).sort((a, b) => postRoadIn(PADS[b][0], PADS[b][1], 170).length - postRoadIn(PADS[a][0], PADS[a][1], 170).length));
      let k = 0;
      for (const s of ["archer", "ballista", "catapult", "fire", "archer"]) { const got = await build(s, roadPads[k++]); if (got !== s) fail("the " + s + " was not built: " + got); }
      const free = await g.ev(() => PADS.map((p, i) => i).filter(i => !towerAt(i)).sort((a, b) => postRoadIn(PADS[b][0], PADS[b][1], 230).length - postRoadIn(PADS[a][0], PADS[a][1], 230).length));
      const sp = free[0];
      if (await build("spotter", sp) !== "spotter") fail("the Lookout post was not built on pad " + sp);
      const second = await build("spotter", free[1]);
      const said = await g.ev(() => $("toast").textContent);
      if (second === "spotter" || !/One observation post serves this field/.test(said)) fail("a second post: " + second + ", the toast said " + JSON.stringify(said));
      await g.ev(() => setPlacing(null));
      const xy = await g.ev(i => PADS[i], sp), at = await g.worldToClient(xy[0], xy[1], -30);
      const open = async () => {
        await g.tapAt(at.x, at.y); await g.wait(500);
        return g.ev(pad => !!selected && selected.pad === pad && panelEl.style.display === "block", sp);
      };
      if (!(await open())) fail("a tap on the Lookout post did not open its panel");
      else {
        await g.press("#pActions .up"); await g.frames(2);
        if (await g.ev(pad => towerAt(pad).level, sp) !== 1) fail("Upgrade did not raise the post");
      }
      await g.page.keyboard.press("Escape");
      await g.ev(() => hidePanel());
      await g.ev(() => { for (const t of towers) if (TOWER_DEFS[t.type].proj || t.type === "fire") { t.level = 2; towerSyncHp(t); } gold = 300; syncHud(); });
      await g.press("#speedBtn");
      await g.press("#waveBtn");
      await g.press("#autoBtn");
      const orders = [];
      let cards = 0, marksSeen = 0, retargets = 0, lastTry = 0, hiddenMarked = 0;
      for (const until = Date.now() + 1500000; Date.now() < until;) {
        const st = await g.ev(pad => {
          // (the marks as the tick leaves them: foes walk on after the post's tick in the same frame, so the watch first
          // lets the post settle its marks on where they stand now, as its next tick would)
          const t = towerAt(pad);
          spotTick(0);
          const s = getStats(t), inR = enemies.filter(e => spotReach(t, e, s.range));
          return { over: gameOver, cleared: lastCleared, card: !!document.querySelector("#trickCard.on"), n: t.marks.length, max: s.marks, inR: inR.length,
            bad: t.marks.filter(e => !inR.includes(e) || Math.abs(e.spotAmp - s.amp) > 1e-9).length, hid: t.marks.filter(e => e.hid).map(e => !foeUnseen(e)), prio: t.prio };
        }, sp);
        if (st.over) break;
        if (st.card) { await g.press("#tcBtn"); cards++; continue; }
        if (st.n > st.max) fail("the post marks " + st.n + ", past its " + st.max);
        if (st.bad) fail("a mark on a foe out of reach or at the wrong amp, after wave " + st.cleared);
        if (st.hid.some(v => !v)) fail("a marked hidden foe is unseen");
        hiddenMarked += st.hid.length;
        if (st.n) marksSeen++;
        // retarget by finger while foes stand in its reach
        if (retargets < RETARGETS && st.inR >= 2 && Date.now() - lastTry > 6000) {
          lastTry = Date.now();
          // the game is paused for the retarget (a player may press Target paused or not): the new mark is then taken on
          // the foes as they stand, and the watch compares it with the order on those same foes
          await g.ev(() => { paused = true; });
          if (!(await open())) { fail("a tap on the post during the battle did not open its panel"); await g.ev(() => { hidePanel(); paused = false; }); continue; }
          await g.wait(450);
          await g.press("#pTarget");
          await g.frames(1);
          const r = await g.ev(pad => {
            const t = towerAt(pad), s = getStats(t), inR = enemies.filter(e => spotReach(t, e, s.range));
            spotTick(0);
            const want = inR.slice(); sortByPrio(want, t.prio);
            return { prio: t.prio, ok: !inR.length || t.marks[0] === want[0], panel: panelEl.style.display === "block" };
          }, sp);
          const was = st.prio, next = { first: "last", last: "strong", strong: "weak", weak: "first" }[was];
          if (r.prio !== next) fail("Target moved the order from " + was + " to " + r.prio);
          else if (!r.ok) fail("after Target (" + r.prio + ") the mark is not the first of that order");
          else { retargets++; orders.push(r.prio); }
          await g.page.keyboard.press("Escape");
          await g.ev(() => { hidePanel(); paused = false; });
        }
        if (st.cleared >= UNTIL) break;
        await g.wait(150);
      }
      if (!marksSeen) fail("no mark seen by wave " + UNTIL);
      if (retargets < RETARGETS) fail("only " + retargets + " retargets by wave " + UNTIL);
      const end = await g.ev(() => ({ wave: waveIdx, lives, gameOver, marked: (towers.find(t => t.type === "spotter") || {}).markN || 0 }));
      if (end.gameOver && end.lives <= 0) fail("the stand fell on wave " + end.wave);
      out[C.name] = { retargets, orders: orders.join(" "), looksMarked: marksSeen, hiddenMarked, cards, end };
      if (o.verbose) console.log(C.name + " " + JSON.stringify(out[C.name]));
    } catch (e) { fail(e.message.split("\n")[0]); }
    const p = await g.problems();
    if (p.length) fail(p.join(" | "));
    await g.close();
  }
  await browser.close();
  R.finish("playtest-spot", fails, out, t0);
})().catch(e => { console.error(e); process.exit(1); });
