// The heroes (gameplay 4.4, 4.6) photographed at the three sizes 8.1 names (1600x900 by mouse, 1194x834 by touch, and a
// phone held sideways at 667x320 by touch with an iPhone's user agent), on a staged save (Chapter I and Dvin won, the
// hero of Chapter II at level 2, the Call open): the chronicle's hero line and his card; in a battle on Tashir the
// Call's one-time bubble on the medallion, the medallion with the hero chosen and the Call ready (the horn, "Call" and
// the bright ring), the Call sounded (the ring of gold spreading, the thin arc cooling on the medallion); the
// captains' lines in the Council; the victory page's strip. Each shot's subject is measured: it must lie wholly on
// the screen. Prints one line per shot and exits 1 on any fault.
// Usage: NODE_PATH=$(npm root -g) node tools/hero-shots.js out-dir [path/to/index.html]
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium, devices } = require(process.env.PW_PATH || "playwright");
const SIZES = [
  { name: "desk-1600x900", w: 1600, h: 900 },
  { name: "ipad-1194x834", w: 1194, h: 834, touch: true },
  { name: "phone-667x320", w: 667, h: 320, touch: true, ua: devices["iPhone 15"].userAgent },
];
const SAVE = {
  hs_tutorial_done: "1", hs_heroes: JSON.stringify({ v: 1, xp: { kingdoms: 900, faith: 380 } }),
  hs_chapters_seen: '["kingdoms","faith","crowns","night","artsakh"]', hs_towers_seen: '["council"]',
};
(async () => {
  const out = path.resolve(process.argv[2] || ".");
  const file = path.resolve(process.argv[3] || path.join(__dirname, "..", "index.html"));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let bad = 0;
  for (const S of SIZES) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: 2, hasTouch: !!S.touch, isMobile: !!S.touch },
      S.ua ? { userAgent: S.ua } : {}));
    await ctx.addInitScript(save => {
      try {
        if (sessionStorage.getItem("hsShots")) return;
        sessionStorage.setItem("hsShots", "1");
        for (const k in save) localStorage.setItem(k, save[k]);
      } catch (e) {}
      window.__hsQuietCouncilCard = true;
    }, SAVE);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("file://" + file);
    await page.waitForFunction(() => typeof menuMode !== "undefined" && document.readyState === "complete", null, { timeout: 120000 });
    // the records: Chapter I and Dvin won once on Normal, two stars each
    await page.evaluate(() => {
      const rec = {};
      for (let i = 0; i < 4; i++) { localStorage.setItem(bestKey(i, LEVELS[i].era), "21"); rec[levelId(i)] = { stars: [0, 2, 0], lives: [0, 14, 0], endless: [0, 0, 0] }; }
      localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
    });
    const onScreen = sel => page.evaluate(sel => {
      const e = document.querySelector(sel);
      if (!e) return "missing " + sel;
      const r = e.getBoundingClientRect(), pad = sel === "#heroBtn" ? 5 : 0;
      if (!r.width) return sel + " not shown";
      return r.left - pad < -0.5 || r.top - pad < -0.5 || r.right + pad > innerWidth + 0.5 || r.bottom + pad > innerHeight + 0.5 ? sel + " runs off the screen " + [r.left, r.top, r.right, r.bottom].map(Math.round) : "";
    }, sel);
    const shot = async (tag, sel, extra) => {
      await page.waitForTimeout(350);
      const f = path.join(out, "hero-" + S.name + "-" + tag + ".png");
      await page.screenshot({ path: f });
      const faults = [].concat(errs.splice(0).map(e => "page error: " + e), sel ? [await onScreen(sel)].filter(Boolean) : [], extra || []);
      bad += faults.length;
      console.log((faults.length ? "FAIL " : "OK   ") + S.name + " " + tag + " -> " + f + (faults.length ? " | " + faults.join(" | ") : ""));
    };
    const press = async sel => {
      const r = await page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: "nearest" }); const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, sel);
      if (!r) throw new Error("no " + sel);
      if (S.touch) await page.touchscreen.tap(r.x, r.y); else await page.mouse.click(r.x, r.y);
      await page.waitForTimeout(120);
    };
    try {
      // the chronicle of Tashir: the hero's line and his card
      await page.evaluate(() => { const lv = levelIndexOf("tashir"); openCampaignMap(lv); selectMapLevel(lv); showBrief(); });
      await page.waitForTimeout(500);
      await press("#briefHero");
      await shot("card", "#foeCard", (await page.evaluate(() => heroCardOn())) ? [] : ["the hero's line did not open his card"]);
      await press("#foeCard .fcX");
      // a battle on Tashir: the Call's bubble, the hero chosen with the Call ready, the Call sounded
      await page.evaluate(() => { window.__hsQuietCallBubble = false; try { localStorage.setItem("hs_towers_seen", '["council"]'); } catch (e) {} });
      await press("#startBtn");
      await page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
      await page.waitForFunction(() => callBubble, null, { timeout: 5000 }).catch(() => {});
      await shot("bubble", "#coach", (await page.evaluate(() => callBubble)) ? [] : ["the Call's bubble did not come up"]);
      await page.evaluate(() => closeCallBubble());
      await page.evaluate(() => { gold = 2000; for (let i = 0; i < 4; i++) placeTower(["archer", "ballista", "catapult", "fire"][i], i); paused = false; });
      await press("#heroBtn");
      const face = await page.evaluate(() => $("heroBtn").classList.contains("callFace"));
      await shot("chosen", "#heroBtn", face ? [] : ["the medallion does not show the Call"]);
      await page.waitForTimeout(450);
      await press("#heroBtn");
      await page.waitForTimeout(150);
      await shot("call", "#heroBtn", (await page.evaluate(() => callCd > 0 && $("heroBtn").classList.contains("callCool"))) ? [] : ["the Call did not sound"]);
      await page.waitForTimeout(1500);
      await shot("cooling", "#heroBtn");
      // the victory page: the hero's strip
      await page.evaluate(() => { lastCleared = waveIdx = totalWaves(); enemies = []; lives = 17; victory(); endCelebration(); });
      await page.waitForTimeout(1600);
      await shot("victory", "#ovGrowth", (await page.evaluate(() => !!$("ovGrowth").textContent)) ? [] : ["no growth row"]);
      // the captains in the Council (held sideways on a phone: its Captains button)
      await page.evaluate(() => { leaveVictory(); openCouncil("map"); });
      await page.waitForTimeout(300);
      if (await page.evaluate(() => !!$("wcCapBtn"))) await press("#wcCapBtn");
      await page.evaluate(() => { const c = document.querySelector("#hallBody .wcCapts"); if (c) c.scrollIntoView({ block: "nearest" }); });
      await shot("captains", "#hallBody .wcCapts");
    } catch (e) {
      bad++;
      console.log("FAIL " + S.name + ": " + e.message.split("\n")[0]);
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
