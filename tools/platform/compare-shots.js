// The pages a platform package must leave as they were, photographed from two copies of the game and compared
// pixel for pixel: the map, Settings (over the map and over a battle), the chronicle, the victory page and the
// defeat page, each staged by the photo harness (?shot=...), at 1600 x 900 by mouse, 1194 x 834 by touch,
// 667 x 320 by touch (an iPhone held sideways) and 375 x 553 by touch (held upright).
// Usage:  NODE_PATH=$(npm root -g) node tools/platform/compare-shots.js <base index.html> [new index.html] [--out=dir]
//   base   the page before the change (the integration branch's worktree: /home/user/hs-wt/next/index.html)
//   new    the page after it (default: this worktree's index.html)
//   --out  keep both photos of every pair that differs there, and a picture of where they differ
// Prints one line per pair (SAME, or DIFF with the count of pixels that differ and the box that holds them) and a
// RESULT line; exits 1 when any pair differs. A pair is compared twice over when it differs (a second photo of
// each side), so a page that is not the same from one load to the next is told apart from a real difference.
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium, devices } = require(process.env.PW_PATH || "playwright");

const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith("--"));
const outArg = args.find(a => a.startsWith("--out="));
const OUT = outArg ? path.resolve(outArg.slice(6)) : null;
if (!files[0]) { console.error("usage: compare-shots.js <base index.html> [new index.html] [--out=dir]"); process.exit(2); }
const BASE = path.resolve(files[0]), NEW = path.resolve(files[1] || path.join(__dirname, "..", "..", "index.html"));
for (const f of [BASE, NEW]) if (!fs.existsSync(f)) { console.error("no such page: " + f); process.exit(2); }
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: "1600x900 mouse", w: 1600, h: 900 },
  { name: "1194x834 touch", w: 1194, h: 834, touch: true },
  { name: "667x320 touch", w: 667, h: 320, touch: true, ua: devices["iPhone 15"].userAgent },
  { name: "375x553 touch", w: 375, h: 553, touch: true, ua: devices["iPhone 15"].userAgent },
];
// a scene: the harness's query, and what is done to the page before the photo
const SCENES = [
  { name: "map", q: "shot=menu" },
  { name: "map, every road open", q: "shot=menu&unlock" },
  { name: "map, last chapter", q: "shot=menu&unlock&lv=16" },
  { name: "Settings over the map", q: "shot=menu&unlock", act: () => openSettings() },
  { name: "Settings over a battle", q: "shot=battle&lv=3&wave=5", act: () => openSettings() },
  { name: "chronicle", q: "shot=brief&lv=3" },
  { name: "victory", q: "shot=victory&lv=3" },
  { name: "victory, its card put away", q: "shot=victory&lv=ani&card=0" },
  { name: "victory, the campaign's last", q: "shot=victory&lv=16" },
  { name: "defeat", q: "shot=defeat&lv=3&wave=8" },
];

(async () => {
  const browser = await chromium.launch();
  const shoot = async (file, S, C) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: 1, hasTouch: !!S.touch, isMobile: !!S.touch },
      S.ua ? { userAgent: S.ua } : {}));
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("file://" + file + "?" + C.q);
    await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
    const title = await page.title();
    if (title !== "PHOTO_READY" || errs.length) throw new Error(file + " " + C.q + ": " + title + " " + errs.join(" | "));
    if (C.act) await page.evaluate(C.act);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const buf = await page.screenshot();
    await ctx.close();
    return buf;
  };
  // the pixels of two photos that differ: their count and the box that holds them, and a picture of them
  const differ = await browser.newPage();
  const diff = (a, b) => differ.evaluate(async ([a, b]) => {
    const load = async (b64) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); return im; };
    const [A, B] = await Promise.all([load(a), load(b)]);
    if (A.width !== B.width || A.height !== B.height) return { n: -1, box: "sizes differ: " + A.width + "x" + A.height + " and " + B.width + "x" + B.height };
    const cv = document.createElement("canvas"); cv.width = A.width; cv.height = A.height;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(A, 0, 0); const da = cx.getImageData(0, 0, cv.width, cv.height);
    cx.clearRect(0, 0, cv.width, cv.height);
    cx.drawImage(B, 0, 0); const db = cx.getImageData(0, 0, cv.width, cv.height);
    let n = 0, l = 1e9, t = 1e9, r = -1, bt = -1;
    const out = cx.createImageData(cv.width, cv.height);
    for (let i = 0; i < da.data.length; i += 4) {
      const same = da.data[i] === db.data[i] && da.data[i + 1] === db.data[i + 1] && da.data[i + 2] === db.data[i + 2] && da.data[i + 3] === db.data[i + 3];
      const g = Math.round((db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3 * 0.35);
      out.data[i] = same ? g : 255; out.data[i + 1] = same ? g : 0; out.data[i + 2] = same ? g : 60; out.data[i + 3] = 255;
      if (same) continue;
      n++;
      const p = i / 4, x = p % cv.width, y = (p - x) / cv.width;
      if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > bt) bt = y;
    }
    cx.putImageData(out, 0, 0);
    return { n, box: n ? "x " + l + " to " + r + ", y " + t + " to " + bt : "", pic: n ? cv.toDataURL("image/png").split(",")[1] : "" };
  }, [a.toString("base64"), b.toString("base64")]);

  let pairs = 0, bad = 0;
  for (const S of SIZES) for (const C of SCENES) {
    pairs++;
    const tag = S.name + " " + C.name;
    try {
      let a = await shoot(BASE, S, C), b = await shoot(NEW, S, C);
      if (a.equals(b)) { console.log("SAME " + tag); continue; }
      let d = await diff(a, b);
      if (d.n) {
        // once more: is either side unlike itself from one load to the next?
        const a2 = await shoot(BASE, S, C), b2 = await shoot(NEW, S, C);
        const da = (await diff(a, a2)).n, dbn = (await diff(b, b2)).n;
        if (da || dbn) console.log("NOTE " + tag + ": the page is not the same from one load to the next (base " + da + " px, new " + dbn + " px)");
        d = await diff(a2, b2); a = a2; b = b2;
      }
      if (!d.n) { console.log("SAME " + tag + " (the files differ, the pixels do not)"); continue; }
      bad++;
      console.log("DIFF " + tag + ": " + (d.n < 0 ? d.box : d.n + " px differ, " + d.box));
      if (OUT) {
        const stem = path.join(OUT, tag.replace(/[^\w.-]+/g, "_"));
        fs.writeFileSync(stem + ".base.png", a); fs.writeFileSync(stem + ".new.png", b);
        if (d.pic) fs.writeFileSync(stem + ".diff.png", Buffer.from(d.pic, "base64"));
      }
    } catch (e) { bad++; console.log("FAIL " + tag + ": " + e.message.split("\n")[0]); }
  }
  await browser.close();
  console.log("RESULT compare-shots: " + pairs + " pairs, " + (bad ? bad + " differ" : "all the same"));
  process.exit(bad ? 1 : 0);
})();
