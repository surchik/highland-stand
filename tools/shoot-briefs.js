// Screenshots the pre-battle chronicle page of every battlefield.
// Usage: node tools/shoot-briefs.js <outDir> [battle]
const path = require("path");
const { chromium } = require("playwright");
(async () => {
  const out = process.argv[2];
  const file = path.resolve(__dirname, "..", "index.html");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file://" + file + "?shot=brief");
  await page.waitForFunction(() => document.title === "PHOTO_READY" || document.title === "PHOTO_ERROR");
  const n = await page.evaluate(() => LEVELS.length);
  for (let i = 0; i < n; i++) {
    await page.evaluate(i => { curLevel = i; curEra = LEVELS[i].era; applyEraLabels(); showBrief(); draw(PHOTO_TIME); }, i);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, "brief-" + i + ".png") });
    const overflow = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll("#briefHost .nm, #ovSub, #ovTitle, #ovRubric").forEach(el => {
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) bad.push((el.id || el.className) + ": " + el.textContent.slice(0, 40));
      });
      return bad;
    });
    console.log(i, overflow.length ? "OVERFLOW " + overflow.join(" | ") : "ok");
  }
  if (process.argv[3] === "battle") {
    for (const lv of [3, 4]) {
      await page.goto("file://" + file + "?shot=battle&lv=" + lv + "&wave=8&banner");
      await page.waitForFunction(() => document.title === "PHOTO_READY" || document.title === "PHOTO_ERROR");
      await page.evaluate(() => { sandActive = true; draw(PHOTO_TIME); });
      await page.screenshot({ path: path.join(out, "fog-" + lv + ".png") });
    }
  }
  if (errs.length) console.log("ERRORS", errs);
  await browser.close();
})();
