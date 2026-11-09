// The campaign map's two doors, Nardi and Under Ararat (the town), open and close by the player's own input at three
// sizes (1600x900 by mouse, an iPad at 1194x834 and 834x1194 by touch), and then a battle starts from the same map.
// Nardi: the door opens the board (on screen, the map out of reach under it); its rules card opens and goes back; its
// close button asks to leave a game under way, Keep playing stays, Leave the board puts it away; opened again, it
// closes again. The town: the door opens it on its start card, which closes before any town stands (by Escape, or by
// the back swipe on a touch screen: the card covers the top bar's leave button); opened again, Begin and the age card's Continue start a town, its leave asks, Keep stays, and Leave closes
// it. After each closing the map is back in reach with both doors. Then a battlefield is chosen by a tap on its map
// node, its chronicle opened and begun, the first wave sent, and its foes must take the field.
// Known fault of the live game (3d4bb2a), printed as a KNOWN line and failed only under --strict: the town's start card
// has no on-screen way back to the map (it covers the leave button and offers only Begin).
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/doors.js [index.html] [--quick] [--strict] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const CONFIGS = o.quick ? [R.SIZES.desk, R.SIZES.ipad] : [R.SIZES.desk, R.SIZES.ipad, R.SIZES.ipadTall];

(async () => {
  const browser = await R.launch();
  const fails = [], knowns = new Set();
  const strict = o.rest.includes("--strict");
  // a known fault of the live game (3d4bb2a), reported once on its own line; --strict counts it as a failure
  const known = (m) => { if (knowns.has(m)) return; knowns.add(m); console.log("KNOWN " + m); if (strict) fails.push("(known) " + m); };
  let doors = 0;
  await R.pool(CONFIGS, CONFIGS.length, async (C) => {
    const g = await R.openGame(browser, o.file, C);
    const fail = async (m) => { fails.push(C.name + " " + m); await g.shot(o.shots, "doors " + C.name + " " + m.slice(0, 60)); };
    const log = (m) => { if (o.verbose) console.log(C.name + " " + m); };
    const mapBack = async (what) => {
      await g.frames(3);
      const s = await g.ev(() => ({ nardi: Nardi.isOpen(), town: Town.isOpen(), inert: overlayEl.hasAttribute("inert"), mode: menuMode, up: !overlayEl.classList.contains("hidden"),
        ndHidden: !document.getElementById("nardi") || document.getElementById("nardi").classList.contains("ndHidden"),
        twHidden: !document.getElementById("town") || document.getElementById("town").classList.contains("twHidden") }));
      if (s.nardi || s.town || s.inert || s.mode !== "map" || !s.up || !s.ndHidden || !s.twHidden) await fail(what + ": the map is not back " + JSON.stringify(s));
      for (const d of ["#nardiBtn", "#townBtn"]) { const q = await g.reach(d); if (q.why) await fail(what + ": then " + d + ": " + q.why); }
    };
    const fits = (sel) => g.ev(sel => { const e = document.querySelector(sel); if (!e) return "missing"; const r = e.getBoundingClientRect(); return r.width >= 300 && r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 ? "" : "at " + [r.left, r.top, r.right, r.bottom].map(Math.round); }, sel);
    try {
      await g.toMap();
      await g.ev(() => { try { localStorage.setItem("hs_tutorial_done", "1"); } catch (e) {} });
      if (await g.ev(() => menuMode) !== "map") throw new Error("no map after the chapter's story");

      // ---- Nardi ----
      for (let round = 1; round <= 2; round++) {
        await g.press("#nardiBtn");
        await g.wait(300);
        const s = await g.ev(() => ({ open: Nardi.isOpen(), hidden: document.getElementById("nardi").classList.contains("ndHidden"), inert: overlayEl.hasAttribute("inert") }));
        if (!s.open || s.hidden || !s.inert) { await fail("Nardi " + round + ": the door did not open the board " + JSON.stringify(s)); break; }
        const f = await fits("#ndBoard");
        if (f) await fail("Nardi " + round + ": the board does not fit on screen: " + f);
        if (round === 1) {
          await g.press("#ndRules");
          if (!await g.ev(() => !!document.getElementById("ndBack"))) await fail("Nardi: the ? button opened no rules");
          else await g.press("#ndBack");
          await g.wait(1200);   // the opening throw goes on
        }
        await g.press("#ndClose");
        if (await g.ev(() => !!document.getElementById("ndLeave"))) {
          if (round === 1) {
            await g.press("#ndStay");
            if (!await g.ev(() => Nardi.isOpen() && !document.getElementById("ndLeave"))) await fail("Nardi: Keep playing did not go back to the board");
            await g.press("#ndClose");
          }
          await g.press("#ndLeave");
        }
        await mapBack("Nardi " + round);
        doors++;
      }
      log("nardi ok");

      // ---- the town ----
      await g.ev(() => { try { for (const k of ["hs_town", "hs_town_run", "hs_town_bless"]) localStorage.removeItem(k); } catch (e) {} });
      await g.press("#townBtn");
      await g.wait(400);
      let s = await g.ev(() => ({ open: Town.isOpen(), card: Town.test.card(), inert: overlayEl.hasAttribute("inert") }));
      if (!s.open || s.card !== "start" || !s.inert) await fail("town: the door did not open its start card " + JSON.stringify(s));
      else {
        const f = await fits("#twMap");
        if (f) await fail("town: its map does not fit on screen: " + f);
        // No town stands yet. The start card covers the top bar's leave button (as live, 3d4bb2a) and offers only
        // Begin: a keyboard leaves by Escape, a finger by the browser's back swipe (the town pushes a history entry
        // for it). Should an on-screen way out come, it is taken instead.
        const q = await g.reach("@leave");
        if (!q.why) await g.tapAt(q.x, q.y);
        else {
          known("the town's start card has no on-screen way back to the map: it covers the top bar's leave button (" + q.why + ") and offers only Begin");
          if (!g.touch) { log("town start card: Escape"); await g.page.keyboard.press("Escape"); }
          else {
            log("town start card: the back swipe");
            if (await g.ev(() => !!(history.state && history.state.hsTown))) await g.ev(() => history.back());
            else await fail("town: a finger has no way back from the start card (no history entry for the back swipe)");
            await g.wait(300);
          }
        }
        await mapBack("town before a town");
        doors++;
      }
      await g.press("#townBtn");
      await g.wait(400);
      await g.press("@card:begin");
      await g.wait(200);
      if (await g.ev(() => Town.test.card()) === "age") await g.press("@card:cont");
      await g.wait(600);
      s = await g.ev(() => ({ open: Town.isOpen(), card: Town.test.card(), g: !!Town.test.G, raf: Town.test.rafOn() }));
      if (!s.open || s.card || !s.g || !s.raf) await fail("town: Begin did not start a town " + JSON.stringify(s));
      await g.press("@leave");
      if (await g.ev(() => Town.test.card()) !== "leave") await fail("town: leave did not ask (" + await g.ev(() => Town.test.card()) + ")");
      else {
        await g.press("@card:keep");
        if (await g.ev(() => !Town.isOpen() || Town.test.card() !== "")) await fail("town: Keep did not go back to the town");
        await g.press("@leave");
        await g.press("@card:leave");
      }
      await mapBack("town after a town");
      doors++;
      log("town ok");

      // ---- then a battle, chosen on the map ----
      const lv = await g.ev(() => CHAPTERS[mapChapter()].levels.find(i => levelUnlocked(i)));
      const node = await g.ev(i => { const cv = $("worldMap"), r = cv.getBoundingClientRect(); return { x: r.left + MAP_NODES[i].x * r.width / MAP_W, y: r.top + MAP_NODES[i].y * r.height / MAP_H }; }, lv);
      const hit = await g.hitName(node.x, node.y);
      if (hit !== "canvas#worldMap") await fail("the map node of " + lv + " lies under " + hit);
      // a first tap chooses the battlefield, a second opens its chronicle
      await g.tapAt(node.x, node.y); await g.frames(2);
      if (await g.ev(() => menuMode) === "map") { await g.tapAt(node.x, node.y); await g.frames(2); }
      if (await g.ev(() => menuMode) !== "brief") { await g.press("#startBtn"); await g.frames(2); }
      if (await g.ev(() => menuMode) !== "brief" || await g.ev(() => curLevel) !== lv) await fail("the map did not lead to the chronicle of " + lv);
      await g.wait(400);
      await g.press("#startBtn");
      await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
      // an iPad held upright: the plaque asks to turn it, and Play in portrait goes on
      if (!(await g.reach("#rotateHint button")).why) await g.press("#rotateHint button");
      await g.press("#waveBtn");
      await g.page.waitForFunction(() => waveIdx === 1 && enemies.length > 0, null, { timeout: 15000 }).catch(async () => {
        await fail("the first wave did not take the field " + JSON.stringify(await g.ev(() => ({ waveIdx, foes: enemies.length, paused, phase }))));
      });
      log("battle ok");
    } catch (e) {
      await fail(e.message.split("\n")[0]);
    }
    const p = await g.problems();
    if (p.length) await fail(p.join(" | "));
    await g.close();
  });
  await browser.close();
  R.finish("doors", fails, { doors, configs: CONFIGS.map(c => c.name), known: knowns.size }, t0);
})().catch(e => { console.error(e); process.exit(1); });
