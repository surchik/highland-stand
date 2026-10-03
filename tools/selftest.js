// Runs the game's built-in ?selftest=1 harness in headless Chromium and prints the result.
// Usage: node tools/selftest.js [path/to/index.html]
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
(async () => {
  const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "index.html"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on("pageerror", e => logs.push("pageerror: " + e.message));
  await page.goto("file://" + file + "?selftest=1");
  await page.waitForSelector("#selftest-result", { timeout: 180000 });
  const txt = await page.textContent("#selftest-result");
  console.log(txt.slice(0, 4000));
  if (logs.length) console.log(logs.join("\n"));
  await browser.close();
  process.exit(txt.includes('"pass":true') && !logs.length ? 0 : 1);
})();
