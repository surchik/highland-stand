const path = require("path");
const { chromium } = require("playwright");
(async () => {
  const [file, query, out, w, h, touch] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: !!touch, isMobile: !!touch });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file://" + path.resolve(file) + "?" + query);
  await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
  const info = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#shop .card")].map(c => { const r = c.getBoundingClientRect(), n = c.querySelector(".nm"), nr = n.getBoundingClientRect();
      return { type: c.dataset.type, w: Math.round(r.width*10)/10, h: Math.round(r.height*10)/10, name: n.textContent, nmW: Math.round(nr.width), scrollW: n.scrollWidth, clientW: n.clientWidth, font: getComputedStyle(n).fontSize, disp: getComputedStyle(n).display, ov: getComputedStyle(n).overflow + "/" + getComputedStyle(n).textOverflow }; });
    return { phone: typeof isPhone === "function" && isPhone(), cards };
  });
  console.log(await page.title(), JSON.stringify(info, null, 0), errs.join(" | "));
  await page.screenshot(/\.jpe?g$/i.test(out) ? { path: out, type: "jpeg", quality: 82 } : { path: out });
  await browser.close();
})();
