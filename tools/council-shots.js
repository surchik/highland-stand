// The War Council's panel photographed in the Hall at the three sizes gameplay 8.1 names (1600x900, 1194x834 by
// touch, and a phone held sideways at 667x320 by touch), on a staged save (?shot=council: nine battlefields won,
// tiers owned in every state), and every element of the panel measured against the Hall's box: none may lie outside
// it (held sideways the box does not scroll either). Prints one line per size and exits 1 on any fault.
// Usage: NODE_PATH=$(npm root -g) node tools/council-shots.js out-dir [path/to/index.html]
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium, devices } = require(process.env.PW_PATH || "playwright");
const SIZES = [
  { name: "desk-1600x900", w: 1600, h: 900 },
  { name: "ipad-1194x834", w: 1194, h: 834, touch: true },
  { name: "phone-667x320", w: 667, h: 320, touch: true, ua: devices["iPhone 15"].userAgent },
];
(async () => {
  const out = path.resolve(process.argv[2] || ".");
  const file = path.resolve(process.argv[3] || path.join(__dirname, "..", "index.html"));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let bad = 0;
  for (const S of SIZES) {
    for (const [tag, q] of [["", "won=9&own=3,2,1,2,1&sel=bows:4"], ["-full", "won=17&hard&own=5,5,2,4,5&sel=captains:3"]]) {
      const ctx = await browser.newContext(Object.assign({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: S.touch ? 2 : 1, hasTouch: !!S.touch, isMobile: !!S.touch }, S.ua ? { userAgent: S.ua } : {}));
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", e => errs.push(e.message));
      await page.goto("file://" + file + "?shot=council&" + q);
      await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const B = document.getElementById("hallBody"), b = B.getBoundingClientRect(), outside = [];
        for (const e of B.querySelectorAll(".wc *")) {
          const r = e.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          if (r.left < b.left - 0.5 || r.right > b.right + 0.5 || r.top < b.top - 0.5 || (phoneWide() && r.bottom > b.bottom + 0.5)) outside.push((e.id || e.className || e.tagName) + " " + [r.left, r.top, r.right, r.bottom].map(Math.round));
        }
        const v = document.documentElement.getBoundingClientRect();
        return { box: [Math.round(b.width), Math.round(b.height)], layout: hallLayout(), outside, scrolls: B.scrollHeight > B.clientHeight + 1,
          offScreen: b.left < 0 || b.top < 0 || b.right > innerWidth + 0.5 || (phoneWide() && b.bottom > innerHeight + 0.5), meds: B.querySelectorAll(".wcMed").length };
      });
      const f = path.join(out, "council-" + S.name + tag + ".png");
      await page.screenshot({ path: f });
      const faults = [].concat(errs.map(e => "page error: " + e), m.outside.length ? ["outside the box: " + m.outside.slice(0, 4).join("; ")] : [],
        m.layout === "side" && m.scrolls ? ["the box scrolls held sideways"] : [], m.offScreen ? ["the box runs off the screen"] : [], m.meds !== 25 ? ["medallions: " + m.meds] : []);
      bad += faults.length;
      console.log((faults.length ? "FAIL " : "OK   ") + S.name + tag + ": " + m.layout + " box " + m.box.join("x") + (m.scrolls ? " (scrolls)" : "") + " -> " + f + (faults.length ? " | " + faults.join(" | ") : ""));
      await ctx.close();
    }
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
