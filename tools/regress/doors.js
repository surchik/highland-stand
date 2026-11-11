// The campaign map's doors open and close by the player's own input at three sizes (1600x900 by mouse, an iPad at
// 1194x834 and 834x1194 by touch), and then a battle starts from the same map. Two loads of the page at each size:
// - a plain load, as a player opens the game: Under Ararat (the town) is hidden (owner, a27052d), so the map has no
//   Town door, the page loads none of the town's regions, and a town gift won earlier (hs_town_bless) is not paid
//   but waits. Nardi's door opens the board (on screen, the map out of reach under it); its rules card opens and
//   goes back; its close button asks to leave a game under way, Keep playing stays, Leave the board puts it away;
//   opened again, it closes again. Then a battlefield is chosen by a tap on its map node, its chronicle begun, the
//   first wave sent, and its foes must take the field; the waiting gift must still wait.
// - a ?town load (the tester's door to the hidden town): the Town door opens the town on its start card, which
//   closes before any town stands (by Escape, or by the back swipe on a touch screen: the card covers the top bar's
//   leave button); opened again, Begin and the age card's Continue start a town, its leave asks, Keep stays, and
//   Leave closes it. Then a battle from the map, as above, which pays the waiting gift.
// After each closing the map is back in reach with its doors (Nardi always, the town's only under ?town).
// The War Council (gameplay 4.6, a plain load): the campaign's tally opens the Hall on the Council, on a fresh save
// and on one with stars to spend; a tier is chosen and taken there by the player's own presses; the Hall's close
// gives the map back. On the chronicle (#briefKit) the chip "Council · N to spend" opens the Council and the Hall's
// close gives the chronicle back; the Standard switch (shown once a tier is owned) turns on by a press, 44 px to a
// finger, and the battle begun then is fought with no Council tier.
// Known fault of the game (3d4bb2a, a27052d), printed as a KNOWN line and failed only under --strict: the town's
// start card has no on-screen way back to the map (it covers the leave button and offers only Begin).
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/doors.js [index.html] [--quick] [--strict] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const CONFIGS = o.quick ? [R.SIZES.desk, R.SIZES.ipad] : [R.SIZES.desk, R.SIZES.ipad, R.SIZES.ipadTall];
const GIFT = "40";   // a town gift waiting from an earlier win (the most it can be)

(async () => {
  const browser = await R.launch();
  const fails = [], knowns = new Set();
  const strict = o.rest.includes("--strict");
  // a known fault of the game, reported once on its own line; --strict counts it as a failure
  const known = (m) => { if (knowns.has(m)) return; knowns.add(m); console.log("KNOWN " + m); if (strict) fails.push("(known) " + m); };
  let doors = 0, battles = 0;

  // one load of the page at one size; town: loaded with ?town (else a plain load, the town hidden)
  const visit = async (C, town) => {
    const tag = C.name + (town ? " ?town" : " plain");
    const g = await R.openGame(browser, o.file, Object.assign({}, C, town ? { query: "town" } : {}));
    const fail = async (m) => { fails.push(tag + " " + m); await g.shot(o.shots, "doors " + tag + " " + m.slice(0, 60)); };
    const log = (m) => { if (o.verbose) console.log(tag + " " + m); };
    const mapBack = async (what) => {
      await g.frames(3);
      const s = await g.ev(() => ({ nardi: Nardi.isOpen(), town: Town.isOpen(), inert: overlayEl.hasAttribute("inert"), mode: menuMode, up: !overlayEl.classList.contains("hidden"),
        ndHidden: !document.getElementById("nardi") || document.getElementById("nardi").classList.contains("ndHidden"),
        twHidden: !document.getElementById("town") || document.getElementById("town").classList.contains("twHidden") }));
      if (s.nardi || s.town || s.inert || s.mode !== "map" || !s.up || !s.ndHidden || !s.twHidden) await fail(what + ": the map is not back " + JSON.stringify(s));
      for (const d of town ? ["#nardiBtn", "#townBtn"] : ["#nardiBtn"]) { const q = await g.reach(d); if (q.why) await fail(what + ": then " + d + ": " + q.why); }
      if (!town) await noTown(what);
    };
    // a plain load: no Town door on the map (by id, label or title), no town region loaded
    const noTown = async (what) => {
      const s = await g.ev(() => ({
        btn: !!document.getElementById("townBtn"),
        room: !!document.getElementById("town"),
        stub: Town === TOWN_OFF, regions: [TWT, TW, TWA, TWS].filter(x => x !== null).length, hidden: TOWN_KILL, fail: TOWN_FAIL,
        // anything on the map that reads as a door to the town
        like: [...overlayEl.querySelectorAll("button, a, [role=button]")].filter(e => {
          const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
          if (!r.width || !r.height || cs.display === "none" || cs.visibility === "hidden") return false;
          return /^\s*town\s*$/i.test(e.textContent) || /\btown\b|ararat plain/i.test(e.title || "") || /\btown\b/i.test(e.getAttribute("aria-label") || "");
        }).map(e => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + " " + JSON.stringify(e.textContent.trim().slice(0, 30))),
      }));
      if (s.btn || s.like.length) await fail(what + ": a plain load shows a Town door " + JSON.stringify(s));
      if (s.room || !s.stub || s.regions || !s.hidden) await fail(what + ": a plain load loaded the town " + JSON.stringify(s));
    };
    const fits = (sel) => g.ev(sel => { const e = document.querySelector(sel); if (!e) return "missing"; const r = e.getBoundingClientRect(); return r.width >= 300 && r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 ? "" : "at " + [r.left, r.top, r.right, r.bottom].map(Math.round); }, sel);

    const nardiRounds = async () => {
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
    };

    // the tally opens the Council: a tier taken by presses, the Hall closed, the map back
    const hallUp = async (what) => {
      await g.page.waitForFunction(() => hallOpen && !hallEl.classList.contains("hlSettling"), null, { timeout: 5000 }).catch(() => {});
      const h = await g.ev(() => { const w = document.querySelector("#hallBody .wc"), r = w && w.getBoundingClientRect(), b = $("hallBody").getBoundingClientRect();
        return { open: hallOpen, tab: hallTab, panel: !!w, inside: !!r && r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.top >= b.top - 0.5 }; });
      if (!h.open || h.tab !== "council" || !h.panel || !h.inside) { await fail(what + ": the Hall did not open on the Council " + JSON.stringify(h)); return false; }
      return true;
    };
    const councilRounds = async () => {
      // a fresh save: the tally is the door all the same, and the Council says it has nothing to spend yet
      await g.press("#ovStars");
      if (await hallUp("Council, fresh")) {
        const c = await g.ev(() => document.querySelector("#hallBody .wcCount").textContent);
        if (!/^0 stars to spend of 0$/.test(c)) await fail("Council, fresh: " + c);
        await g.press("#hallClose");
      }
      await mapBack("Council, fresh");
      // Erebuni won with three stars: the tally's words count them, its door opens the Council, a tier is taken
      await g.ev(() => {
        localStorage.setItem(bestKey(0, LEVELS[0].era), "21");
        localStorage.setItem(RECORDS_KEY, JSON.stringify({ [levelId(0)]: { stars: [0, 3, 0], lives: [0, 18, 0], endless: [0, 0, 0] } }));
        openCampaignMap(0);
      });
      await g.frames(3);
      const title = await g.ev(() => $("ovStars").title);
      if (!/^War Council: 3 stars to spend\. Stars won across the campaign: 3 of 68/.test(title)) await fail("the tally's words: " + title);
      await g.press("#ovStars");
      if (await hallUp("Council, three stars")) {
        await g.press('.wcMed[data-b="stewards"][data-t="1"]');
        await g.press("#wcTake");
        const own = await g.ev(() => councilOwn());
        if (own.stewards !== 1) await fail("Council: Take it did not take the Stewards' first tier " + JSON.stringify(own));
        await g.press("#hallClose");
      }
      await mapBack("Council, three stars");
      doors += 2;
      log("council ok");
    };

    const townRounds = async () => {
      await g.ev(() => { try { for (const k of ["hs_town", "hs_town_run", "hs_town_bless"]) localStorage.removeItem(k); } catch (e) {} });
      await g.press("#townBtn");
      await g.wait(400);
      let s = await g.ev(() => ({ open: Town.isOpen(), card: Town.test.card(), inert: overlayEl.hasAttribute("inert") }));
      if (!s.open || s.card !== "start" || !s.inert) await fail("town: the door did not open its start card " + JSON.stringify(s));
      else {
        const f = await fits("#twMap");
        if (f) await fail("town: its map does not fit on screen: " + f);
        // No town stands yet. The start card covers the top bar's leave button (as in 3d4bb2a and a27052d) and offers
        // only Begin: a keyboard leaves by Escape, a finger by the browser's back swipe (the town pushes a history
        // entry for it). Should an on-screen way out come, it is taken instead.
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
    };

    // a battle chosen on the map; a town gift waits (hs_town_bless): a ?town load pays it, a plain load keeps it
    const battle = async () => {
      await g.ev(gift => { try { localStorage.setItem("hs_town_bless", gift); localStorage.removeItem("hs_nardi_bless"); } catch (e) {} }, GIFT);
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
      if (!town) {
        // the chronicle's row of the battle: the Council's chip opens it, the Hall's close gives the chronicle back
        if ((await g.reach("#bkCouncil")).why) await fail("the chronicle has no Council chip: " + (await g.reach("#bkCouncil")).why);
        else {
          await g.press("#bkCouncil");
          if (await hallUp("the chronicle's chip")) await g.press("#hallClose");
          await g.frames(3);
          const s = await g.ev(() => ({ mode: menuMode, open: hallOpen, inert: overlayEl.hasAttribute("inert") }));
          if (s.mode !== "brief" || s.open || s.inert) await fail("the chronicle is not back after the Council " + JSON.stringify(s));
        }
        // the Standard switch: a tier is owned, so it is there; a press turns it on
        const q = await g.reach("#bkStd");
        if (q.why) await fail("the Standard switch: " + q.why);
        else {
          if (C.touch && q.h < 44) await fail("the Standard switch is " + Math.round(q.h) + " px tall");
          await g.press("#bkStd");
          if (await g.ev(() => $("bkStd").getAttribute("aria-checked")) !== "true") await fail("the Standard switch did not turn on");
        }
      }
      await g.press("#startBtn");
      await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
      const gift = await g.ev(() => ({ key: localStorage.getItem("hs_town_bless"), toast: toastEl.classList.contains("show") ? toastEl.textContent : "" }));
      if (town && (gift.key !== null || !/gift from the town: \+40/.test(gift.toast))) await fail("?town: the waiting town gift was not paid " + JSON.stringify(gift));
      if (!town && (gift.key !== GIFT || /gift from the town/i.test(gift.toast))) await fail("a plain load paid the hidden town's gift " + JSON.stringify(gift));
      // the Standard battle is fought with no Council tier
      if (!town && await g.ev(() => !kitEmpty(kit) || battleLoadout() !== "std")) await fail("the Standard battle has a kit " + JSON.stringify(await g.ev(() => kit)));
      // an iPad held upright: the plaque asks to turn it, and Play in portrait goes on
      if (!(await g.reach("#rotateHint button")).why) await g.press("#rotateHint button");
      await g.press("#waveBtn");
      await g.page.waitForFunction(() => waveIdx === 1 && enemies.length > 0, null, { timeout: 15000 }).then(() => { battles++; }, async () => {
        await fail("the first wave did not take the field " + JSON.stringify(await g.ev(() => ({ waveIdx, foes: enemies.length, paused, phase }))));
      });
      log("battle ok");
    };

    try {
      await g.toMap();
      await g.ev(() => { try { localStorage.setItem("hs_tutorial_done", "1"); } catch (e) {} });
      if (await g.ev(() => menuMode) !== "map") throw new Error("no map after the chapter's story");
      if (town) {
        const s = await g.ev(() => ({ btn: !!document.getElementById("townBtn"), fail: TOWN_FAIL }));
        if (!s.btn) throw new Error("?town: the map has no Town door " + JSON.stringify(s));
        await townRounds();
      } else {
        await noTown("the map");
        await nardiRounds();
        await councilRounds();
      }
      await battle();
    } catch (e) {
      await fail(e.message.split("\n")[0]);
    }
    const p = await g.problems();
    if (p.length) await fail(p.join(" | "));
    await g.close();
  };

  await R.pool(CONFIGS, CONFIGS.length, async (C) => { await visit(C, false); await visit(C, true); });
  await browser.close();
  R.finish("doors", fails, { doors, battles, configs: CONFIGS.map(c => c.name), known: knowns.size }, t0);
})().catch(e => { console.error(e); process.exit(1); });
