// Under Ararat (WP4 post-P): the 44 px audit over every card, panel and sheet (shot=town photo pages), at every size of
// spec 14.4 and each iPad size with Safari's toolbar (70 px less): each visible button 44 x 44 CSS px or more, inside
// the viewport (a button scrolled out of its panel is skipped), no two buttons of one layer overlapping (a panel, the
// sheet or a card lies over the HUD on purpose), no card cut off.
// Usage: NODE_PATH=$(npm root -g) node tools/town-audit44.js [WxH,...]     (GAME=path/index.html)
const { chromium } = require(process.env.PW_PATH || "playwright");
const path = require("path");
const FILE = path.resolve(process.env.GAME || path.join(__dirname, "..", "index.html"));
const L = [[1600, 900], [1366, 768], [1194, 834], [1180, 820], [1133, 744], [1080, 810], [1024, 768]];
const P = [[834, 1194], [820, 1180], [810, 1080], [768, 1024], [744, 1133]];
let sizes = [];
for (const [w, h] of L) { sizes.push([w, h]); if (w < 1300) sizes.push([w, h - 70]); }
for (const [w, h] of P) { sizes.push([w, h]); sizes.push([w, h - 70]); }
if (process.argv[2]) sizes = process.argv[2].split(",").map(s => s.split("x").map(Number));
const ST = ["stage=start&card=start", "stage=age1&card=pause", "stage=age1&card=help", "stage=age1&card=leave", "stage=age2&card=resume",
  "stage=age3&card=win3", "stage=age1&card=lose1", "stage=age1&card=error", "stage=age2&card=age2", "stage=age2&card=tech-i", "stage=age3&card=tech-i",
  "stage=age2&card=sel-tc-i", "stage=age2&card=sel-market", "stage=age2&card=sel-barracks-i", "stage=age1raid&card=sel-raider-i", "stage=age1&card=sel-vil",
  "stage=age3&card=sel-gar-i", "stage=age1&card=sel-tree", "stage=plan", "stage=age1wall", "stage=age3wonder"];
(async () => {
  const b = await chromium.launch();
  let bad = 0;
  for (const [W, H] of sizes) {
    const page = await b.newPage({ viewport: { width: W, height: H }, hasTouch: W < 1300, isMobile: W < 1300 });
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    const probs = [];
    for (const q of ST) {
      await page.goto("file://" + FILE + "?shot=town&" + q);
      await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 }).catch(() => {});
      const r = await page.evaluate(() => {
        const out = [], vis = [];
        const nm = b => b.id || (b.dataset.act && "card:" + b.dataset.act) || (b.dataset.a && "a:" + b.dataset.a) || (b.dataset.b && "b:" + b.dataset.b) || (b.dataset.dock && "dock" + b.dataset.dock + b.dataset.d) || b.className;
        for (const bt of document.querySelectorAll("#town button")) {
          if (bt.closest("[inert]")) continue;
          const r = bt.getBoundingClientRect();
          if (!r.width || !r.height || bt.offsetParent === null) continue;
          // a button scrolled out of its panel, sheet, card body or build bar is not on screen
          let p = bt.parentElement, clip = null;
          while (p && p.id !== "town") { const cs = getComputedStyle(p); if (/auto|scroll|hidden/.test(cs.overflowY + cs.overflowX)) { const pr = p.getBoundingClientRect(); if (!clip) clip = pr; } p = p.parentElement; }
          if (clip && (r.bottom <= clip.top + 1 || r.top >= clip.bottom - 1 || r.right <= clip.left + 1 || r.left >= clip.right - 1)) continue;
          const partly = clip && (r.top < clip.top - 1 || r.bottom > clip.bottom + 1);
          if (r.width < 43.5 || r.height < 43.5) out.push("small " + nm(bt) + " " + Math.round(r.width) + "x" + Math.round(r.height));
          if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push("out " + nm(bt));
          if (!partly) vis.push([nm(bt), r, bt]);
        }
        for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
          const [a, ra, ea] = vis[i], [c, rc, ec] = vis[j];
          if (ea.contains(ec) || ec.contains(ea)) continue;
          // a panel, the sheet or a card lies over the HUD on purpose (a higher layer): only the same layer counts
          const lay = e => (e.closest(".twSheet,.twPanel,#twCardWrap,.twGB,.twAgain") || { id: "hud" });
          if (lay(ea) !== lay(ec)) { const top = document.elementFromPoint((Math.max(ra.left, rc.left) + Math.min(ra.right, rc.right)) / 2, (Math.max(ra.top, rc.top) + Math.min(ra.bottom, rc.bottom)) / 2); if (top && (lay(ea).contains ? lay(ea).contains(top) : false) !== (lay(ec).contains ? lay(ec).contains(top) : false)) continue; }
          const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
          if (ox > 2 && oy > 2) out.push("overlap " + a + " / " + c);
        }
        const c = document.querySelector("#twCard");
        if (c && c.offsetParent && c.scrollHeight > c.clientHeight + 2) out.push("card clipped");
        return out;
      });
      for (const x of r) probs.push(q.replace(/stage=|card=/g, "") + ": " + x);
    }
    bad += probs.length + errs.length;
    console.log(W + "x" + H + (probs.length || errs.length ? " PROBLEMS\n  " + probs.concat(errs).join("\n  ") : " ok"));
    await page.close();
  }
  console.log(bad ? "RESULT FAIL " + bad : "RESULT PASS");
  await b.close();
})();
