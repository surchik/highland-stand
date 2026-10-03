// Photo harness capture: node tools/shot.js "<query>" out.png [width height]
// e.g. node tools/shot.js "shot=towers&lv=3" /tmp/t.png
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
(async () => {
  const [query, out, w, h] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +(w || 1600), height: +(h || 900) } });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html") + "?" + query);
  await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
  const title = await page.title();
  await page.screenshot({ path: out });
  console.log(title, errs.length ? "ERRORS: " + errs.join(" | ") : "");
  await browser.close();
  process.exit(title === "PHOTO_READY" && !errs.length ? 0 : 1);
})();
