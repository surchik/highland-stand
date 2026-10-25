// The town must never break the campaign (spec 13.1, 14.1): loads the page with the town switched off (?notown)
// and with each town region told to throw (?towntest=throw:<region>, honored only under the harness, so those
// loads go through ?shot=menu and then let the real frame loop run), and asserts each time: the page boots, there
// is no Town door, a battle starts from the chronicle's Begin button and holds 3 waves at 4x, and the thrown error
// is counted exactly once (none with ?notown). A last load with nothing switched off checks the door is there.
// Usage: NODE_PATH=$(npm root -g) node tools/town-isolation.js [regions]      (GAME=path for another index.html)
//   regions: text,sim,art,sound,shell (default all five)
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
const file = path.resolve(process.env.GAME || path.join(__dirname, "..", "index.html"));
const regions = (process.argv[2] || "text,sim,art,sound,shell").split(",");
const cases = [{ name: "notown", q: "notown" }]
  .concat(regions.map(r => ({ name: "throw:" + r, q: "shot=menu&towntest=throw:" + r, region: r })))
  .concat([{ name: "control", q: "shot=menu", control: true }]);

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const C of cases) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    const r = { name: C.name, ok: false };
    try {
      await page.goto("file://" + file + "?" + C.q, { timeout: 180000 });
      if (/shot=/.test(C.q)) {
        await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
        await page.waitForTimeout(300);   // the guard's rethrow runs on a timer
        await page.evaluate(() => { photo = null; document.title = "Highland Stand"; });   // let the real loop run
      } else await page.waitForTimeout(1500);
      Object.assign(r, await page.evaluate(() => ({ door: !!document.getElementById("townBtn"), fail: TOWN_FAIL, off: Town === TOWN_OFF })));
      if (C.control) {
        r.ok = r.door && !r.fail && !r.off && errs.length === 0;
        r.errs = errs.slice(0, 3);
        results.push(r);
        console.log(JSON.stringify(r));
        await page.close();
        continue;
      }
      // a battle: begun from the chronicle, three towers, three waves at 4x
      Object.assign(r, await page.evaluate(() => {
        try { localStorage.setItem("hs_tutorial_done", "1"); } catch (e) {}
        testUnlockAll = true; curDiff = 1; curLevel = 1; curEra = LEVELS[1].era; applyEraLabels();
        showBrief();
        $("startBtn").click();
        for (let i = 0; i < 3; i++) placeTower("archer", i);
        setSpeed(4);
        return { started: overlayEl.classList.contains("hidden") && !gameOver, towers: towers.length };
      }));
      let waves = 0;
      for (let w = 1; w <= 3 && r.started; w++) {
        await page.evaluate(() => $("waveBtn").click());
        const t0 = Date.now();
        let st;
        for (;;) {
          await page.waitForTimeout(500);
          st = await page.evaluate(() => ({ waveIdx, phase, gameOver, lives }));
          if (st.gameOver || (st.phase === "idle" && st.waveIdx === w)) break;
          if (Date.now() - t0 > 120000) { st.timeout = true; break; }
        }
        if (st.gameOver || st.timeout) { r.stop = st; break; }
        waves++;
      }
      r.waves = waves;
      const thrown = errs.filter(m => /towntest/.test(m)).length, other = errs.filter(m => !/towntest/.test(m));
      r.thrown = thrown; r.otherErrors = other.slice(0, 3);
      r.ok = !r.door && r.off && waves === 3 && other.length === 0 &&
        (C.region ? thrown === 1 && r.fail.indexOf(C.region + ":") === 0 : thrown === 0 && r.fail === "");
    } catch (e) {
      r.error = String(e && e.message || e).slice(0, 300);
    }
    results.push(r);
    console.log(JSON.stringify(r));
    await page.close();
  }
  await browser.close();
  const bad = results.filter(r => !r.ok).map(r => r.name);
  console.log("TOWN_ISOLATION " + JSON.stringify({ pass: !bad.length, cases: results.length, bad }));
  process.exit(bad.length ? 1 : 0);
})();
