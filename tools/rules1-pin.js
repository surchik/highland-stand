// The pins of a 20-wave run's rules (RULES1_PIN in index.html's second self-test suite): rules1Digest() of the page
// under test, run in an older page, for every battlefield on Easy, Normal and Hard. A run saved before the lengths
// finishes under the rules it began with (gameplay.final.md 1.7); the suite resumes such a run on every battlefield and
// difficulty and asks for these digests.
// Usage: NODE_PATH=$(npm root -g) node tools/rules1-pin.js <older index.html> [index.html]
//   The older page is the page before the lengths (the G3 close, a3163de, or master: both give the same pins). The
//   function's source is taken from the page under test (default: the repo's index.html), so the two pages are hashed
//   by one and the same code. Prints the RULES1_PIN table to paste into the suite.
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require(process.env.PW_PATH || "playwright");
const older = process.argv[2], cur = path.resolve(process.argv[3] || path.join(__dirname, "..", "index.html"));
if (!older || !fs.existsSync(older)) { console.error("usage: node tools/rules1-pin.js <older index.html> [index.html]"); process.exit(2); }
const src = fs.readFileSync(cur, "utf8"), at = src.indexOf("function rules1Digest() {");
if (at < 0) { console.error("no rules1Digest in " + cur); process.exit(2); }
const body = src.slice(at, src.indexOf("\n}\n", at) + 2);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { for (const k of ["hs_tutorial_done", "hs_mig_7lv", "hs_mig_ids", "hs_mig_rec"]) localStorage.setItem(k, "1"); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file://" + path.resolve(older), { timeout: 120000 });
  await page.waitForFunction(() => typeof menuMode !== "undefined" && document.readyState === "complete", null, { timeout: 120000 });
  const pins = await page.evaluate(body => {
    const digest = (0, eval)("(" + body + ")");
    const out = {};
    LEVELS.forEach((L, i) => {
      out[L.id] = [0, 1, 2].map(d => { curLevel = i; curDiff = d; resetGame(); return digest(); });
    });
    gameOver = true;
    return out;
  }, body);
  await browser.close();
  if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
  console.log("const RULES1_PIN = {");
  for (const id in pins) console.log("  " + id + ": " + JSON.stringify(pins[id]).replace(/,/g, ", ") + ",");
  console.log("};");
})().catch(e => { console.error(e); process.exit(1); });
