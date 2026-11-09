// The victory dance has the field for at least 10 s, and taps before then are ignored: a victory won in the game's own
// loop (the last wave's field cleared), then taps on the field at about 0.5, 3, 6 and 9.4 s, each of which must leave
// the dance going, and one after 10 s, which must end it and bring the victory page without pressing the button that
// comes up under the finger (the tap lands where the page's Next battle button will be). Left alone, the dance must
// still be going at 10.5 s and end by itself with its tune (DANCE_MAX_MS). Sis ends in terms, with no dance: its horn
// call takes no tap and gives way to the page by itself. By mouse at 1600x900 and by touch on an iPad at 1194x834.
// Known fault of the live game (3d4bb2a), printed as a KNOWN line and failed only under --strict: the page that comes up
// takes no press for 450 ms from the touch that ended the dance, so a slow tap (the finger down 600 ms, tried here
// once by touch) or a click delayed past that window presses the button under the finger (Next battle).
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/dance10.js [index.html] [--quick] [--strict] [--levels=0,ani] [--shots=dir]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const CONFIGS = [R.SIZES.desk, R.SIZES.ipad];
const EARLY = [500, 3000, 6000, 9400];
const strict = o.rest.includes("--strict");

(async () => {
  const browser = await R.launch();
  const fails = [], knowns = [];
  // a known fault of the live game (3d4bb2a), reported on its own line; --strict counts it as a failure
  const known = (m) => { knowns.push(m); console.log("KNOWN " + m); if (strict) fails.push("(known) " + m); };
  const ids = await (async () => { const g = await R.openGame(browser, o.file, R.SIZES.desk); const v = await g.ev(() => LEVELS.map(L => L.id)); await g.close(); return v; })();
  const levels = R.parseLevels(o.levels || (o.quick ? "erebuni,sis" : "erebuni,avarayr,ani,sis,gyumri,stepanakert23"), ids);
  const jobs = [];
  for (const C of CONFIGS) {
    for (const lv of levels) jobs.push({ C, lv, mode: "taps" });
    // left alone: once per size (on the first battlefield with a dance)
    const alone = levels.find(lv => ids[lv] !== "sis");
    if (alone !== undefined && (!o.quick || C === CONFIGS[0])) jobs.push({ C, lv: alone, mode: "alone" });
    // a slow tap ends the dance: a finger held 600 ms (the dance wound on past its 10 s first)
    if (alone !== undefined && C.touch) jobs.push({ C, lv: alone, mode: "slow" });
  }
  let ran = 0;
  await R.pool(jobs, o.jobs || 2, async ({ C, lv, mode }) => {
    const id = ids[lv], tag = C.name + " " + id + " (" + mode + ")";
    const g = await R.openGame(browser, o.file, C);
    const fail = async (m) => { fails.push(tag + ": " + m); await g.shot(o.shots, "dance " + tag + " " + m.slice(0, 50)); };
    const since = () => g.ev(() => { const s = celebration || parley; return s ? performance.now() - s.start : -1; });
    const waitUntil = (ms) => g.page.waitForFunction(ms => { const s = celebration || parley; return !s || performance.now() - s.start >= ms; }, ms, { timeout: 40000, polling: 20 });
    try {
      await g.toMap();
      // where the victory page's lead button comes up at this size, from a page staged at once
      await g.enterBattle(lv);
      const spot = await g.ev(lv => {
        waveIdx = TOTAL_WAVES; lives = 17; victory(); endCelebration(); hideEndingCard();
        const b = [$("nextBtn"), $("mapBtn")].find(e => e && getComputedStyle(e).display !== "none");
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: b.id };
      }, lv);
      // the real victory
      await g.enterBattle(lv);
      await g.ev(() => { lives = 17; waveIdx = TOTAL_WAVES; phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
      await g.page.waitForFunction(() => gameOver && (celebration || parley), null, { timeout: 10000 });
      const kind = await g.ev(() => (celebration ? "dance" : "terms"));
      if (kind === "terms") {
        // the herald's horn: no tap ends it, and the page comes by itself
        for (const at of [300, 1200]) {
          await waitUntil(at);
          await g.tapAt(spot.x, spot.y);
          await g.frames(1);
          if (!await g.ev(() => !!parley)) { await fail("a tap at " + Math.round(await since()) + " ms ended the horn call"); break; }
        }
        await g.page.waitForFunction(() => !parley && menuMode === "victory", null, { timeout: 15000 });
      } else if (mode === "slow") {
        await g.ev(() => { celebration.start = performance.now() - DANCE_MIN_MS - 100; });
        await g.touchAt(spot.x, spot.y, 600);
        await g.wait(700);
        const p = await g.ev(() => ({ on: !!celebration, mode: menuMode, lv: curLevel }));
        if (p.on) await fail("a slow tap after 10 s did not end the dance");
        else if (p.mode !== "victory" || p.lv !== lv) known("a slow tap (the finger down 600 ms) that ends the dance presses the #" + spot.id + " that comes up under it: the victory page takes no press for only 450 ms from the touch's start");
        else console.log("NOTE " + tag + ": the slow tap no longer presses the page's button (the known fault is gone)");
      } else if (mode === "taps") {
        const start = await g.ev(() => celebration.start);
        for (const at of EARLY) {
          await waitUntil(at);
          const t = await since();
          await g.tapAt(spot.x, spot.y);
          await g.frames(2);
          const s = await g.ev(() => ({ on: !!celebration, start: celebration && celebration.start, mode: menuMode, hidden: overlayEl.classList.contains("hidden") }));
          if (!s.on || s.start !== start || !s.hidden) { await fail("a tap at " + Math.round(t) + " ms ended the dance " + JSON.stringify(s)); break; }
        }
        if (await g.ev(() => !!celebration)) {
          await waitUntil(10150);
          const t = await since();
          // when the tap's own click comes, and whether the page was still settling (taking no press) then
          await g.ev(() => {
            window.__tap = {};
            document.addEventListener("pointerdown", () => { if (!window.__tap.down) window.__tap.down = performance.now(); }, true);
            document.addEventListener("click", (e) => { if (!window.__tap.click) window.__tap.click = { at: performance.now(), settling: overlayEl.classList.contains("settling"), on: e.target.closest("button") ? e.target.closest("button").id : "" }; }, true);
          });
          await g.tapAt(spot.x, spot.y);
          await g.frames(2);
          const s = await g.ev(() => ({ on: !!celebration, mode: menuMode }));
          if (s.on) await fail("a tap at " + Math.round(t) + " ms did not end the dance");
          else if (t < 10000) await fail("the dance ended at " + Math.round(t) + " ms");
          // the tap that ended the dance pressed nothing on the page that came up under it
          await g.wait(700);
          const p = await g.ev(() => ({ mode: menuMode, up: !overlayEl.classList.contains("hidden"), lv: curLevel, nardi: Nardi.isOpen(), tap: window.__tap }));
          if (p.mode !== "victory" || !p.up || p.lv !== lv || p.nardi) {
            const c = p.tap.click, late = c ? Math.round(c.at - p.tap.down) : -1;
            // the page takes no press for 450 ms after the tap that ends the dance; a click later than that (a finger
            // held down, or a slow frame between the touch's start and end) is the known slow tap below, not a regression
            if (c && !c.settling) known("the tap that ended the dance pressed #" + (c.on || spot.id) + ": its click came " + late + " ms after the touch, past the page's 450 ms settle");
            else await fail("the tap that ended the dance went on to press #" + spot.id + (c ? " (its click " + late + " ms after the touch, the page still settling)" : "") + " " + JSON.stringify({ mode: p.mode, lv: p.lv }));
          }
        }
      } else {
        await waitUntil(10500);
        if (!await g.ev(() => !!celebration)) await fail("the dance was over before 10.5 s");
        const max = await g.ev(() => DANCE_MAX_MS);
        let endedAt = -1;
        const startWall = await g.ev(() => celebration && celebration.start);
        await g.page.waitForFunction(() => !celebration, null, { timeout: max + 6000, polling: 50 });
        endedAt = await g.ev(s => performance.now() - s, startWall);
        if (endedAt < Math.max(10000, max - 200) || endedAt > max + 2500) await fail("left alone, the dance ended at " + Math.round(endedAt) + " ms (its tune runs " + Math.round(max) + ")");
        if (await g.ev(() => menuMode) !== "victory") await fail("no victory page after the dance");
      }
      ran++;
      if (o.verbose) console.log(tag + " ok (" + kind + ")");
    } catch (e) {
      await fail(e.message.split("\n")[0]);
    }
    const p = await g.problems();
    if (p.length) await fail(p.join(" | "));
    await g.close();
  });
  await browser.close();
  R.finish("dance10", fails, { ran, jobs: jobs.length, known: knowns.length }, t0);
})().catch(e => { console.error(e); process.exit(1); });
