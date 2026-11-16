// Playtest 3 of gameplay 8.4 for the Stores (G7b): Tashir by touch, as a player plays it, on the iPad (1194x834) and an
// iPhone SE held sideways in Safari (667x320). Every press is a finger's (tools/regress/lib.js tapAt, press): the tray's
// tiles, the pads (a first tap shows the reach, a second builds), the tower and its panel's buttons, Send Wave and the
// speed button. The board: archers, a ballista, a catapult and a fire on the pads that watch the most road, then two
// Stores from their tile on the free pads that reach the least road; a third is pressed and must be refused with its
// sentence, and the tile must be dimmed though the purse could pay. One Stores is opened by a tap on its body (its panel
// says what it pays) and raised a rank by its Upgrade button; the shooters are raised to their third rank by script.
// Then six waves at 2x with Auto (a trick's first-time card is put away by its button when it comes). It fails on a
// page error, a refused third that builds, a tap on the Stores that opens nothing or another tower, Stores that paid
// nothing at the clears, or a stand lost in six waves, and prints what the Stores paid and the purse after each clear.
// Usage:  NODE_PATH=$(npm root -g) node tools/playtest-stores.js [index.html] [--verbose]
"use strict";
const R = require("./regress/lib");
const o = R.cli();
const t0 = Date.now();
const PHONE = { name: "touch phone 667x320", w: 667, h: 320, touch: true, ua: require(process.env.PW_PATH || "playwright").devices["iPhone 15"].userAgent, phone: true };
(async () => {
  const browser = await R.launch();
  const fails = [], out = {};
  for (const C of [R.SIZES.ipad, PHONE]) {
    const g = await R.openGame(browser, o.file, C);
    const fail = m => fails.push(C.name + " " + m);
    try {
      await g.toMap();
      await g.enterBattle(await g.ev(() => levelIndexOf("tashir")));
      await g.ev(() => { gold = 2000; syncHud(); });
      const tray = await g.ev(() => trayTypes().join());
      if (!/,stores$/.test(tray)) fail("Tashir's tray: " + tray);
      // a tower from its tile on a pad: two taps on a touch screen
      const build = async (type, pad) => {
        if (await g.ev(() => placing) !== type) await g.press('#shop .card[data-type="' + type + '"]');
        const p = await g.ev(i => PADS[i], pad);
        const pt = await g.worldToClient(p[0], p[1], 4);
        await g.tapAt(pt.x, pt.y); await g.frames(1);
        await g.tapAt(pt.x, pt.y); await g.frames(1);
        return g.ev(i => (towerAt(i) ? towerAt(i).type : null), pad);
      };
      const shooters = ["archer", "ballista", "catapult", "fire", "archer"];
      const roadPads = await g.ev(() => PADS.map((p, i) => i).sort((a, b) => postRoadIn(PADS[b][0], PADS[b][1], 170).length - postRoadIn(PADS[a][0], PADS[a][1], 170).length));
      let k = 0;
      for (const s of shooters) { const got = await build(s, roadPads[k++]); if (got !== s) fail("the " + s + " was not built: " + got); }
      // the Stores where a player who knows the trade would put them: the pads that reach the least road
      const horsePads = await g.ev(() => PADS.map((p, i) => i).filter(i => !towerAt(i))
        .sort((a, b) => postRoadIn(PADS[a][0], PADS[a][1], 150).length - postRoadIn(PADS[b][0], PADS[b][1], 150).length));
      for (const i of horsePads.slice(0, 2)) { const got = await build("stores", i); if (got !== "stores") fail("a Stores was not built on pad " + i + ": " + got); }
      // two built: the tile is dimmed though the purse could pay; a third: refused, with its sentence
      const dim = await g.ev(() => ({ poor: document.querySelector('#shop .card[data-type="stores"]').classList.contains("poor"), gold }));
      if (!dim.poor) fail("the stores tile is not dimmed with two built: " + JSON.stringify(dim));
      const n0 = await g.ev(() => towers.length);
      await build("stores", horsePads[2]);
      const third = await g.ev(() => ({ n: towers.length, t: $("toast").textContent }));
      if (third.n !== n0 || !/Two stores are all this road can feed/.test(third.t)) fail("a third Stores: " + JSON.stringify(third));
      await g.page.keyboard.press("Escape");
      await g.ev(() => setPlacing(null));
      // a tap on the first Stores' body opens its panel; Upgrade raises it a rank
      const hp = horsePads[0];
      const body = await g.ev(pad => __hsAudit ? __hsAudit.towerPoint(towerAt(pad)) : null, hp).catch(() => null);
      const at = body || await g.worldToClient((await g.ev(i => PADS[i], hp))[0], (await g.ev(i => PADS[i], hp))[1], -30);
      await g.tapAt(at.x, at.y); await g.wait(500);
      const sel = await g.ev(pad => ({ ok: !!selected && selected.pad === pad && panelEl.style.display === "block", name: $("pName").textContent, says: $("pStats").textContent }), hp);
      if (!sel.ok) fail("a tap on the Stores did not open their panel");
      else if (!/gold a wave/.test(sel.says)) fail("the Stores' panel does not say what they pay: " + sel.says);
      else {
        await g.press("#pActions .up");
        await g.frames(2);
        if (await g.ev(pad => towerAt(pad).level, hp) !== 1) fail("Upgrade did not raise the Stores");
      }
      await g.page.keyboard.press("Escape");
      // the shooters raised to their third rank (by script: the test is about the Stores, and five first-rank towers do
      // not hold Tashir's sixth wave); the purse after each clear is noted, with what the Stores paid
      await g.ev(() => { for (const t of towers) if (t.type !== "stores") { t.level = 2; towerSyncHp(t); } gold = 300; syncHud();
        window.__pt = []; const was = endWaveIfClear; endWaveIfClear = function () { const w = waveIdx, p = phase; was(); if (p === "wave" && phase !== "wave") __pt.push([w, Math.round(gold), battle.stores, $("toast").textContent]); }; });
      // six waves at 2x with Auto
      await g.press("#speedBtn");
      await g.press("#waveBtn");
      await g.press("#autoBtn");
      if (o.verbose) console.log(C.name + " sent: " + JSON.stringify(await g.ev(() => ({ waveIdx, phase, auto, speedMult, towers: towers.length }))));
      // a trick's first-time card (Avarayr's shields, its ambush road) holds the battle until its button is pressed, as a
      // player presses it
      let cards = 0;
      for (const until = Date.now() + 900000; Date.now() < until;) {
        if (await g.ev(() => gameOver || (waveIdx >= 6 && phase === "idle"))) break;
        if (await g.ev(() => !!document.querySelector("#trickCard.on"))) { await g.press("#tcBtn"); cards++; }
        await g.wait(1000);
      }
      const end = await g.ev(() => ({ wave: waveIdx, lives, gameOver, speed: speedMult,
        stores: towers.filter(t => t.type === "stores").map(t => ({ rank: t.level + 1, paid: t.yielded || 0 })), from: battleFacts().from.stores, clears: window.__pt }));
      if (end.gameOver) fail("the stand fell on wave " + end.wave);
      if (!(end.from > 0) || end.stores.some(s => !(s.paid > 0))) fail("the Stores paid nothing: " + JSON.stringify(end.stores));
      if (!end.clears.some(c => / stores/.test(c[3]))) fail("no clear's toast named the Stores' gold");
      out[C.name] = Object.assign({ panel: sel.name, refused: third.t, cards }, end);
      if (o.verbose) console.log(C.name + " " + JSON.stringify(out[C.name]));
    } catch (e) { fail(e.message.split("\n")[0]); }
    const p = await g.problems();
    if (p.length) fail(p.join(" | "));
    await g.close();
  }
  await browser.close();
  R.finish("playtest-stores", fails, out, t0);
})().catch(e => { console.error(e); process.exit(1); });
