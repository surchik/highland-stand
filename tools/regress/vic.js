// The victory page's buttons, at 2000x1250 and 1440x900 by mouse and 1194x834 by touch, on every battlefield: the
// victory won in the game's own loop (the last wave's field cleared), the dance ended by a tap on the field once it
// may be, and a battlefield's ending card (Ani's Summons, Sis's Terms) put away by its own button. Then every button
// the page offers (Next battle, Replay, Hold Forever, Campaign Map) must lie wholly on screen, uncovered at its center
// and its corners, apart from the others, with its label whole (and 44 px tall or more to a finger), and each must do
// its job when pressed: Next battle leads (through a new chapter's nardi invitation and story) to the next chronicle,
// Replay to this one, Hold Forever back into the battle, the Campaign Map to the map.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/vic.js [index.html] [--quick] [--levels=0,ani] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const CONFIGS = [
  { name: "mouse 2000x1250", w: 2000, h: 1250 },
  { name: "mouse 1440x900", w: 1440, h: 900 },
  { name: "touch 1194x834", w: 1194, h: 834, touch: true },
];
const BTNS = ["#nextBtn", "#startBtn", "#endlessBtn", "#mapBtn"];

(async () => {
  const browser = await R.launch();
  const fails = [];
  let pressed = 0;
  const ids = await (async () => { const g = await R.openGame(browser, o.file, R.SIZES.desk); const v = await g.ev(() => LEVELS.map(L => L.id)); await g.close(); return v; })();
  // the quick sample: the first field, a chapter's last (Sevan, into Chapter III), Ani (the Summons), Sis (the Terms,
  // no endless stand) and the last battlefield
  const levels = R.parseLevels(o.levels || (o.quick ? "erebuni,sevan,ani,sis,stepanakert23" : "all"), ids);
  await R.pool(CONFIGS, CONFIGS.length, async (C) => {
    const g = await R.openGame(browser, o.file, C);
    const fail = async (m) => { fails.push(C.name + " " + m); await g.shot(o.shots, "vic " + C.name + " " + m.slice(0, 60)); };
    await g.toMap();
    // the victory page up and settled, its ending card put away by its own button
    const settle = async (tag) => {
      await g.page.waitForFunction(() => menuMode === "victory" && !overlayEl.classList.contains("hidden"), null, { timeout: 30000 });
      await g.page.waitForFunction(() => !overlayEl.classList.contains("settling"), null, { timeout: 5000 });
      await g.wait(380);   // the overlay's fade (opacity .35s)
      if (await g.ev(() => endingCardUp())) {
        const q = await g.reach("#ecBtn");
        if (q.why) { await fail(tag + ": the ending card's button: " + q.why); await g.ev(() => closeEndingCard()); }
        else {
          if (C.touch && q.h < 44) await fail(tag + ": the ending card's button is " + Math.round(q.h) + " px tall");
          await g.tapAt(q.x, q.y);
          await g.frames(2);
          if (await g.ev(() => endingCardUp())) await fail(tag + ": the ending card's button did not put it away");
        }
        await g.wait(200);
      }
    };
    // a victory as the game wins one: the last wave's field cleared in its own loop, the dance cut short by a tap
    const winReal = async (lv) => {
      await g.enterBattle(lv);
      await g.ev(() => { lives = 17; waveIdx = TOTAL_WAVES; phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
      await g.page.waitForFunction(() => gameOver && (celebration || parley || menuMode === "victory"), null, { timeout: 10000 });
      if (await g.ev(() => !!celebration)) {
        await g.ev(() => { celebration.start = performance.now() - DANCE_MIN_MS - 50; });
        const c = await g.ev(() => { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 }; });
        await g.tapAt(c.x, c.y);
      }
    };
    // the same page, staged at once (for the second and later presses)
    const winStaged = async (lv) => {
      await g.ev(lv => {
        if (Nardi.isOpen()) Nardi.close();
        curLevel = lv; curEra = LEVELS[lv].era; curDiff = 1; resetGame(); overlayEl.classList.add("hidden");
        waveIdx = TOTAL_WAVES; lives = 17; victory(); endCelebration();
      }, lv);
    };
    for (const lv of levels) {
      const id = ids[lv];
      try {
        await winReal(lv);
        await settle(id);
        const L = await g.ev(() => ({ next: victoryNext, noEndless: !!LEVELS[curLevel].noEndless, lv: curLevel }));
        if (L.lv !== lv) await fail(id + ": the victory page is " + ids[L.lv] + "'s");
        const want = { "#nextBtn": L.next >= 0, "#startBtn": true, "#endlessBtn": !L.noEndless, "#mapBtn": true };
        const boxes = {};
        for (const sel of BTNS) {
          const shown = await g.ev(sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== "none"; }, sel);
          if (shown !== want[sel]) { await fail(id + " " + sel + ": " + (shown ? "shown, though not wanted" : "missing")); continue; }
          if (!shown) continue;
          const q = await g.reach(sel);
          if (q.why) { await fail(id + " " + sel + ": " + q.why); continue; }
          const geo = await g.ev(sel => {
            const e = document.querySelector(sel), r = e.getBoundingClientRect(), inset = 5;
            const pts = [[r.left + inset, r.top + inset], [r.right - inset, r.top + inset], [r.left + inset, r.bottom - inset], [r.right - inset, r.bottom - inset]];
            const covered = pts.filter(([x, y]) => { const h = document.elementFromPoint(x, y); return !h || !(h === e || e.contains(h)); })
              .map(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? h.tagName.toLowerCase() + (h.id ? "#" + h.id : "") : "nothing"; });
            const cut = [...e.querySelectorAll("span")].concat([e]).some(s => s.scrollWidth > s.clientWidth + 1 && getComputedStyle(s).overflow !== "visible");
            return { l: r.left, t: r.top, r: r.right, b: r.bottom, vw: innerWidth, vh: innerHeight, covered, cut, text: e.textContent.trim() };
          }, sel);
          if (geo.l < -0.5 || geo.t < -0.5 || geo.r > geo.vw + 0.5 || geo.b > geo.vh + 0.5) await fail(id + " " + sel + ": not wholly on screen " + JSON.stringify([geo.l, geo.t, geo.r, geo.b].map(Math.round)));
          if (geo.covered.length) await fail(id + " " + sel + ": a corner lies under " + geo.covered.join(", "));
          if (geo.cut) await fail(id + " " + sel + ": its label \"" + geo.text + "\" is cut");
          if (C.touch && q.h < 44) await fail(id + " " + sel + ": " + Math.round(q.h) + " px tall, under a finger's 44");
          boxes[sel] = geo;
        }
        const ks = Object.keys(boxes);
        for (let a = 0; a < ks.length; a++) for (let b = a + 1; b < ks.length; b++) {
          const A = boxes[ks[a]], B = boxes[ks[b]];
          if (A.l < B.r - 0.5 && B.l < A.r - 0.5 && A.t < B.b - 0.5 && B.t < A.b - 0.5) await fail(id + ": " + ks[a] + " and " + ks[b] + " overlap");
        }
        // each button pressed on its own victory page
        let first = true;
        for (const sel of ["#mapBtn", "#endlessBtn", "#startBtn", "#nextBtn"]) {
          if (!boxes[sel]) continue;
          if (!first) { await winStaged(lv); await settle(id); }
          first = false;
          const tag = id + " " + sel;
          // a new chapter not yet seen leads through its story (and the elder's board) to the next chronicle
          if (sel === "#nextBtn") await g.ev(n => {
            const c = chapterOf(n);
            if (c !== chapterOf(curLevel)) localStorage.setItem("hs_chapters_seen", JSON.stringify(CHAPTERS.filter((C, k) => k !== c).map(C => C.id)));
          }, L.next);
          await g.press(sel);
          await g.wait(150);
          if (sel === "#mapBtn") {
            const s = await g.ev(() => ({ mode: menuMode, map: $("worldMap").style.display !== "none", vic: overlayEl.classList.contains("victory"), up: !overlayEl.classList.contains("hidden") }));
            if (s.mode !== "map" || !s.map || s.vic || !s.up) await fail(tag + ": the Campaign Map did not open the map " + JSON.stringify(s));
          } else if (sel === "#endlessBtn") {
            await g.frames(3);
            const s = await g.ev(() => ({ endless, gameOver, hidden: overlayEl.classList.contains("hidden"), waveIdx }));
            if (!s.endless || s.gameOver || !s.hidden || s.waveIdx !== 20) await fail(tag + ": Hold Forever did not go back into the battle " + JSON.stringify(s));
            await g.ev(() => { gameOver = true; endless = false; clearRun(); });
          } else if (sel === "#startBtn") {
            const s = await g.ev(() => ({ mode: menuMode, lv: curLevel }));
            if (s.mode !== "brief" || s.lv !== lv) await fail(tag + ": Replay did not open this battlefield's chronicle " + JSON.stringify(s));
            else {
              // and the chronicle's Begin starts it again
              await g.press("#startBtn");
              await g.frames(3);
              const b = await g.ev(() => ({ hidden: overlayEl.classList.contains("hidden"), gameOver, waveIdx, lv: curLevel }));
              if (!b.hidden || b.gameOver || b.waveIdx !== 0 || b.lv !== lv) await fail(tag + ": Begin after Replay did not start the battle " + JSON.stringify(b));
              await g.ev(() => { gameOver = true; clearRun(); });
            }
          } else if (sel === "#nextBtn") {
            const path = [];
            for (let k = 0; k < 6; k++) {
              const s = await g.ev(() => ({ mode: menuMode, nardi: Nardi.isOpen(), invite: Nardi.isOpen() && !!document.getElementById("ndNo") }));
              if (s.nardi && s.invite) { path.push("nardi invitation"); await g.press("#ndNo"); await g.wait(150); continue; }
              if (s.mode === "chapter") { path.push("chapter story"); await g.press("#startBtn"); await g.wait(150); continue; }
              break;
            }
            const s = await g.ev(() => ({ mode: menuMode, lv: curLevel }));
            if (s.mode !== "brief" || s.lv !== L.next) await fail(tag + ": Next battle led to " + JSON.stringify(s) + " by " + (path.join(", ") || "no step") + ", not to " + ids[L.next] + "'s chronicle");
            else if (o.verbose && path.length) console.log(C.name + " " + id + " next: " + path.join(", "));
          }
          pressed++;
        }
        if (o.verbose) console.log(C.name + " " + id + " buttons " + Object.keys(boxes).join(" "));
      } catch (e) {
        await fail(id + ": " + e.message.split("\n")[0]);
      }
      const p = await g.problems();
      if (p.length) { await fail(id + ": " + p.join(" | ")); g.errs.length = 0; }
    }
    await g.close();
  });
  await browser.close();
  R.finish("vic", fails, { pressed, configs: CONFIGS.map(c => c.name), levels: levels.length }, t0);
})().catch(e => { console.error(e); process.exit(1); });
