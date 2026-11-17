// Playtest 3 of gameplay 8.4 for the Aid Post (G7d): Van by touch, as a player plays it, on an iPhone 15 (852x393), the
// iPad (1194x834) and an iPhone SE (667x320), both phones held sideways in Safari. Every press is a finger's
// (tools/regress/lib.js tapAt, press): the tray's tiles, the pads (a first tap shows the reach, a second builds), the
// Aid Post and its panel's buttons, Send Wave, the speed button and Auto. The board: archers, a ballista, a catapult and
// a fire on the pads that watch the most road, a Garrison Post on the free pad whose reach holds the most road, then the
// Aid Post from its tile on the free pad nearest the walls; a second Aid Post is tried from its tile on another pad and
// must be refused with its sentence. Its panel is opened by a tap on its body and Upgrade raises it a rank (three
// returns in a battle). The shooters are raised to their third rank by script, and the walls start four defenders short
// (as if four fell on earlier waves): the test is about the post, and its lives say nothing about balance. Then the
// waves at 2x with Auto. Watched at every look: a defender comes back only after a wave that lost none, with the toast
// "A defender returns from the aid post."; never past its cap nor past the defenders the battle began with; the
// defenders never lost (lives less those returned) never rise; a man of the post holding a foe never gains strength.
// It fails on a page error, a second Aid Post built, a panel not opened by a tap, fewer than two returns by wave 6, the stand lost before wave 6, or
// any watch above broken. It prints each return (the wave it followed, the walls after) and the lives at each horn.
// Usage:  NODE_PATH=$(npm root -g) node tools/playtest-aid.js [index.html] [--verbose]
"use strict";
const R = require("./regress/lib");
const o = R.cli();
const t0 = Date.now();
const PHONE = { name: "touch phone 667x320", w: 667, h: 320, touch: true, ua: require(process.env.PW_PATH || "playwright").devices["iPhone 15"].userAgent, phone: true };
const WANT = 2, UNTIL = 6;
(async () => {
  const browser = await R.launch();
  const fails = [], out = {};
  for (const C of [Object.assign({}, PHONE, { name: "touch iPhone 15 852x393", w: 852, h: 393 }), R.SIZES.ipad, PHONE]) {
    const g = await R.openGame(browser, o.file, C);
    const fail = m => fails.push(C.name + " " + m);
    try {
      await g.toMap();
      await g.enterBattle(await g.ev(() => levelIndexOf("van")));
      await g.ev(() => { gold = 2000; syncHud(); });
      const tray = await g.ev(() => trayTypes().join());
      if (!/,aid$/.test(tray)) fail("Van's tray: " + tray);
      // a tower from its tile on a pad: two taps on a touch screen
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
      const pp = await g.ev(() => PADS.map((p, i) => i).filter(i => !towerAt(i) && padTakesPost(i)).sort((a, b) => postRoadIn(PADS[b][0], PADS[b][1], 150).length - postRoadIn(PADS[a][0], PADS[a][1], 150).length)[0]);
      if (await build("post", pp) !== "post") fail("the Garrison Post was not built");
      const near = await g.ev(() => PADS.map((p, i) => i).filter(i => !towerAt(i)).sort((a, b) => aidPadGap(a) - aidPadGap(b)));
      const ap = near[0];
      if (await build("aid", ap) !== "aid") fail("the Aid Post was not built on pad " + ap);
      // a second one from its tile: refused with its sentence
      const second = await build("aid", near[1]);
      const said = await g.ev(() => $("toast").textContent);
      if (second === "aid" || !/One aid post serves this field/.test(said)) fail("a second Aid Post: " + second + ", the toast said " + JSON.stringify(said));
      await g.ev(() => setPlacing(null));
      // a tap on its body opens its panel; Upgrade raises it a rank
      const xy = await g.ev(i => PADS[i], ap), at = await g.worldToClient(xy[0], xy[1], -30);
      await g.tapAt(at.x, at.y); await g.wait(500);
      if (!(await g.ev(pad => !!selected && selected.pad === pad && panelEl.style.display === "block", ap))) fail("a tap on the Aid Post did not open its panel");
      else {
        await g.press("#pActions .up"); await g.frames(2);
        if (await g.ev(pad => towerAt(pad).level, ap) !== 1) fail("Upgrade did not raise the Aid Post");
      }
      await g.page.keyboard.press("Escape");
      await g.ev(() => hidePanel());
      const start = await g.ev(() => { for (const t of towers) if (TOWER_DEFS[t.type].proj || t.type === "fire") { t.level = 2; towerSyncHp(t); } lives = livesMax() - 4; gold = 300; syncHud(); return { lives, max: livesMax() }; });
      await g.press("#speedBtn");
      await g.press("#waveBtn");
      await g.press("#autoBtn");
      const returns = [], horns = [];
      let cards = 0, lastWave = 0, prev = null, toasted = 0;
      for (const until = Date.now() + 1500000; Date.now() < until;) {
        const st = await g.ev(pad => {
          const t = towerAt(pad), P = towers.find(u => u.type === "post");
          return { over: gameOver, wave: waveIdx, cleared: lastCleared, phase, lives, returned: battle.returned, cap: t ? getStats(t).restore : 0, max: livesMax(),
            hornLives: waveStart ? waveStart.lives : null, card: !!document.querySelector("#trickCard.on"), toast: toastEl.classList.contains("show") ? toastEl.textContent : "",
            men: P && P.men ? P.men.map(m => ({ hp: m.hp, fight: m.foes.length > 0 && !m.down })) : [] };
        }, ap);
        if (st.over) break;
        if (st.wave !== lastWave) { horns.push(st.wave + ":" + st.lives); lastWave = st.wave; }
        if (st.card) { await g.press("#tcBtn"); cards++; continue; }
        if (prev) {
          if (st.returned > prev.returned) {
            // the wave just cleared lost no defender: the walls at the clear (before the return) held what its horn had
            const before = st.lives - (st.returned - prev.returned);
            if (prev.hornLives != null && before < prev.hornLives) fail("a defender returned after wave " + st.cleared + ", which lost " + (prev.hornLives - before));
            returns.push({ after: st.cleared, lives: st.lives });
            if (/A defender returns from the aid post/.test(st.toast)) toasted++;
          }
          if (st.returned > st.cap) fail("the post returned " + st.returned + ", past its cap of " + st.cap);
          if (st.lives > st.max) fail("the walls hold " + st.lives + ", past the " + st.max + " the battle began with");
          if (st.lives - st.returned > prev.lives - prev.returned) fail("the defenders never lost rose on wave " + st.wave);
          st.men.forEach((m, i) => { const p = prev.men[i]; if (p && p.fight && m.fight && m.hp > p.hp + 1e-6) fail("a man holding a foe gained strength on wave " + st.wave); });
        }
        prev = st;
        if (st.cleared >= UNTIL) break;
        await g.wait(120);
      }
      if (returns.length < WANT) fail("only " + returns.length + " defenders returned by wave " + UNTIL);
      const end = await g.ev(() => ({ wave: waveIdx, lives, returned: battle.returned, held: battleFacts().held, gameOver }));
      if (end.gameOver && end.lives <= 0) fail("the stand fell on wave " + end.wave);
      out[C.name] = { start, returns, toasted, cards, horns: horns.join(" "), end };
      if (o.verbose) console.log(C.name + " " + JSON.stringify(out[C.name]));
    } catch (e) { fail(e.message.split("\n")[0]); }
    const p = await g.problems();
    if (p.length) fail(p.join(" | "));
    await g.close();
  }
  await browser.close();
  R.finish("playtest-aid", fails, out, t0);
})().catch(e => { console.error(e); process.exit(1); });
