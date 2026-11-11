// Work package P0 of the platform (docs/specs/platform.final.md, 11.2): the seam, held to its "done when".
// The page is served by a small static server of this script's own (at /, at /next/ and at /nextish/), so the
// staging channel's path can be tried; nothing here needs a Supabase. What is checked:
// - the Hall with a test tab (the harness's own: &testtab) at 1600 x 900 by mouse, 1194 x 834 by touch, on an
//   iPhone held sideways (667 x 320 in Safari, 852 x 393 from the Home Screen with its safe areas) and held upright
//   (375 x 553): it opens from the campaign's tally, its three layouts are as the spec draws them, the tab's box is
//   at least 560 x 280 px held sideways, nothing of it lies outside the visible area minus the safe areas (the
//   iPhone suite's own audit, tools/regress/iphone-audit.js), every control is 44 px to a finger, a tab's badge and
//   the tally's pip follow the tab, a toast shows over it, it closes by its button and by Escape, and the map is
//   back in reach; a page that changes layout under it has the tab drawn again;
// - no hotkey of the game's acts while the Hall is open, and typing in a tab's field types;
// - with no tab the tally is the plaque it was (no door, no action) and nothing else offers the Hall;
// - on a plain page (no harness) tabs pushed as gameplay pushes them open in the order of 0.3 (the Council while
//   its badge is up, else the Daily, else the first tab), a tab that throws does not take the Hall down, the
//   Hall does not open over a battle or the nardi board and goes when the menu page under it goes;
// - Platform has boot, blocking, victoryPage and defeatPage and nothing else; the victory and defeat pages call
//   theirs once; the crash card queues an "error" event; Settings' account row is in the page and hidden;
// - track() queues, keeps the last 400, calls the kick and never throws;
// - with the constants empty the page asks the network for nothing but its own document;
// - under /next/ every key the page reads or writes begins "next:" (the storage check's own key and a browser
//   that refuses writes included), a page at / neither sees nor touches those keys, and the other way around;
//   /next/index.html and /next are the channel too, /nextish/ is not; under the harness no real key is touched;
// - the harness's photo of the Hall (?shot=hall) works over http and on file://, and says so when it has no tab.
// Usage:  NODE_PATH=$(npm root -g) node tools/platform/p0.js [index.html] [--shots=dir] [--verbose] [--only=hall,plain,...]
//   --only  some of the parts: hall, notab, plain, track, next, photo
// Prints one line per failure (FAIL <where>: ...), a RESULT line, and exits 1 on any failure.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const R = require("../regress/lib");
const AU = require("../regress/iphone-audit");
const { devices } = require(process.env.PW_PATH || "playwright");
const o = R.cli();
const t0 = Date.now();
const opt = (k, d) => { const a = o.rest.find(x => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
const ONLY = opt("only", null) ? opt("only").split(",") : null;
const want = (k) => !ONLY || ONLY.includes(k);
const UA = devices["iPhone 15"].userAgent;

// ---- the server: the page at /, /next/ and /nextish/ (with or without index.html), the share picture, nothing else ----
function serve(file) {
  const hits = [];
  const srv = http.createServer((req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    hits.push(p);
    if (/^\/((next|nextish)(\/|$))?(index\.html)?$/.test(p)) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    } else { res.writeHead(404, { "content-type": "text/plain" }); res.end("not found"); }
  });
  return new Promise(ok => srv.listen(0, "127.0.0.1", () => ok({ srv, hits, base: "http://127.0.0.1:" + srv.address().port })));
}

// what an init script records of the page's use of the browser's own storage: [store, method, key]
function rawStorageLog() {
  const log = window.__rawLog = [];
  // (the browser's own storage object, kept before the page puts its wrapper in its place)
  try { window.__realLS = window.localStorage; } catch (e) {}
  const SP = Storage.prototype;
  for (const m of ["getItem", "setItem", "removeItem"]) {
    const orig = SP[m];
    SP[m] = function (k) {
      if (!window.__rawQuiet) { try { log.push([this === window.sessionStorage ? "session" : "local", m, String(k)]); } catch (e) {} }
      return orig.apply(this, arguments);
    };
  }
}
// a browser that refuses every write (Safari's older Private mode): the page's storage falls back to memory
function refuseWrites() {
  const SP = Storage.prototype, log = window.__rawLog;
  SP.setItem = function (k) { if (log) log.push([this === window.sessionStorage ? "session" : "local", "setItem", String(k)]); throw new DOMException("no room", "QuotaExceededError"); };
}

(async () => {
  const browser = await R.launch();
  const S = await serve(o.file);
  const fails = [], notes = {};
  const fail = (where, m) => { fails.push(where + ": " + m); if (o.verbose) console.log("  fail " + where + ": " + m); };
  const log = (m) => { if (o.verbose) console.log(m); };

  // a page of the game from the server. C: { w, h, touch, ua, insets, standalone, name }; opts: { ctx, init: [[fn, arg]] }
  const openAt = async (pathq, C, opts = {}) => {
    const ctx = opts.ctx || await browser.newContext(Object.assign({
      viewport: { width: C.w, height: C.h }, deviceScaleFactor: 1, hasTouch: !!C.touch, isMobile: !!C.touch,
    }, C.ua ? { userAgent: C.ua } : {}));
    if (!opts.ctx) {
      if (C.standalone !== undefined) await ctx.addInitScript(sa => { try { Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => sa }); } catch (e) {} }, !!C.standalone);
      if (C.insets) await ctx.addInitScript(ins => {
        const set = () => { const st = document.documentElement.style; st.setProperty("--sat", (ins.t || 0) + "px"); st.setProperty("--sab", (ins.b || 0) + "px"); st.setProperty("--sal", (ins.l || 0) + "px"); st.setProperty("--sar", (ins.r || 0) + "px"); };
        if (document.documentElement) set();
        else new MutationObserver((m, ob) => { if (document.documentElement) { ob.disconnect(); set(); } }).observe(document, { childList: true });
      }, C.insets);
      for (const [fn, arg] of opts.init || []) await ctx.addInitScript(fn, arg);
    }
    const page = await ctx.newPage();
    const g = new R.Game(page, ctx, { w: C.w, h: C.h, touch: !!C.touch, name: C.name });
    g.reqs = [];
    page.on("request", r => { if (!/^(data|blob):/.test(r.url())) g.reqs.push(r.url()); });
    page.on("websocket", ws => g.reqs.push("websocket " + ws.url()));
    page.on("pageerror", e => g.errs.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error") g.errs.push("console.error: " + m.text()); });
    page.on("crash", () => g.errs.push("the page crashed"));
    await page.goto(pathq.startsWith("file:") ? pathq : S.base + pathq, { timeout: 120000 });
    if (/[?&]shot=/.test(pathq)) await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
    else await page.waitForFunction(() => typeof menuMode !== "undefined" && typeof Platform !== "undefined" && document.readyState === "complete", null, { timeout: 120000 });
    g.cdp = await ctx.newCDPSession(page);
    await g.frames(3);
    await g.ev(AU.install);
    return g;
  };
  const hallState = (g) => g.ev(() => ({
    open: !hallEl.classList.contains("hlHidden") && getComputedStyle(hallEl).display !== "none",
    blocking: Platform.blocking(), inert: overlayEl.hasAttribute("inert"), tab: hallBodyEl.dataset.tab || "",
    focusIn: hallEl.contains(document.activeElement), focus: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : "",
    sel: [...hallTabsEl.children].filter(b => b.getAttribute("aria-selected") === "true").map(b => b.dataset.tab).join(","),
    tabs: [...hallTabsEl.children].map(b => b.dataset.tab).join(","),
    body: (hallBodyEl.innerText || "").replace(/\s+/g, " ").trim().slice(0, 120),
  }));
  // what the game's hotkeys would change
  const gameState = (g) => g.ev(() => JSON.stringify({
    placing, music: Snd.musicOn, sfx: Snd.sfxOn, chapter: mapChapter(), unlock: testUnlockAll, paused, speed: speedMult, auto,
    mode: menuMode, settings: settingsEl.style.display, casting: castingSpell, hero: heroSelected, gameOver, level: curLevel,
    wave: waveIdx, aided: testAided, toast: toastEl.classList.contains("show") ? toastEl.textContent : "",
  }));
  const KEYS = ["1", "2", "3", "4", "5", "Space", "p", "f", "a", "m", "s", "q", "w", "e", "r", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "Enter", "Shift+U", "Shift+G", "Shift+F"];
  const problems = async (g, where, allow) => {
    for (const e of await g.problems()) if (!(allow && allow.test(e))) fail(where, e);
  };

  // ================= the Hall, with the harness's test tabs, at every layout =================
  const WALK = [
    { name: "mouse 1600x900", w: 1600, h: 900, layout: "wide" },
    { name: "touch 1194x834", w: 1194, h: 834, touch: true, layout: "wide" },
    { name: "touch 667x320 (iPhone SE sideways, Safari)", w: 667, h: 320, touch: true, ua: UA, standalone: false, layout: "side" },
    { name: "touch 852x393 (iPhone 15 sideways, Home Screen, safe areas)", w: 852, h: 393, touch: true, ua: UA, standalone: true, insets: { l: 59, r: 59, b: 21, t: 0 }, layout: "side" },
    { name: "touch 375x553 (iPhone SE upright)", w: 375, h: 553, touch: true, ua: UA, standalone: false, layout: "tall" },
  ];
  const hallWalk = async (C) => {
    const tag = "hall " + C.name;
    const g = await openAt("/?shot=menu&unlock&testtab=4", C);
    try {
      // ---- the door ----
      const door = await g.ev(() => {
        const e = $("ovStars"), cs = getComputedStyle(e);
        return { tag: e.tagName, type: e.type, door: e.classList.contains("door"), pip: e.classList.contains("pip"), role: e.getAttribute("role"), ti: e.getAttribute("tabindex"),
          cursor: cs.cursor, pipBox: getComputedStyle(e, "::after").width, text: e.textContent };
      });
      if (door.tag !== "BUTTON" || door.type !== "button") fail(tag, "the tally is a " + door.tag + " type " + door.type + ", not a button");
      if (!door.door || door.cursor !== "pointer" || door.role || door.ti !== null) fail(tag, "the tally is not a door though the Hall has tabs: " + JSON.stringify(door));
      if (!door.pip || door.pipBox !== "12px") fail(tag, "the tally wears no pip though a tab's badge is up: " + JSON.stringify(door));
      if (!/\d+\/\d+/.test(door.text)) fail(tag, "the tally lost its count: " + door.text);
      const st0 = await hallState(g);
      if (st0.open || st0.blocking || st0.inert) fail(tag, "the Hall is up before it was opened: " + JSON.stringify(st0));
      // (the tally itself, as a control of the map page, is held to the iPhone suite's bar by iphone.js)
      await g.press("#ovStars");
      let st = await hallState(g);
      if (!st.open) { fail(tag, "a " + (C.touch ? "tap" : "click") + " on the tally did not open the Hall"); return; }
      if (!st.blocking) fail(tag, "Platform.blocking() is false while the Hall is open");
      if (!st.inert) fail(tag, "the map is not inert under the Hall");
      if (st.tab !== "test1" || st.sel !== "test1") fail(tag, "the Hall opened on " + st.tab + " (selected " + st.sel + "), not on its first tab");
      if (st.tabs !== "test1,test2,test3,test4") fail(tag, "the tab row is " + st.tabs);
      if (!st.focusIn) fail(tag, "the focus is not inside the Hall (" + st.focus + ")");
      // ---- the layout ----
      const L = await g.ev(() => {
        const r = (e) => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }; };
        const card = hallEl.querySelector(".hlCard"), top = hallEl.querySelector(".hlTop");
        return { W: innerWidth, H: innerHeight, safe: __hsAudit.safe(), layout: hallLayout(), card: r(card), top: r(top), tabs: r(hallTabsEl), x: r($("hallClose")), body: r(hallBodyEl),
          box: { w: hallBodyEl.clientWidth, h: hallBodyEl.clientHeight }, tab: [...hallTabsEl.children].map(r), z: getComputedStyle(hallEl).zIndex,
          role: hallEl.getAttribute("role"), modal: hallEl.getAttribute("aria-modal"), size: $("hallTestSize").textContent };
      });
      log(tag + ": box " + L.box.w + " x " + L.box.h + ", layout " + L.layout);
      notes["box " + C.w + "x" + C.h] = L.box.w + "x" + L.box.h;
      if (L.layout !== C.layout) fail(tag, "the layout is " + L.layout + ", not " + C.layout);
      if (L.z !== "50") fail(tag, "the Hall's z-index is " + L.z);
      if (L.role !== "dialog" || L.modal !== "true") fail(tag, "the Hall is not a modal dialog to a screen reader");
      if (!L.size.includes(L.box.w + " x " + L.box.h)) fail(tag, "the tab was handed a box other than the one shown: " + L.size);
      if (C.layout === "wide") {
        if (Math.abs(L.card.w - 720) > 0.5) fail(tag, "the card is " + L.card.w + " px wide (720)");
        if (Math.abs((L.card.l + L.card.r) / 2 - L.W / 2) > 1) fail(tag, "the card is not centered");
        if (L.box.w !== 680) fail(tag, "the tab's box is " + L.box.w + " px wide (680)");
        if (L.box.h < 320) fail(tag, "the tab's box is " + L.box.h + " px tall (320 at the least)");
        if (L.tabs.b > L.body.t + 0.5) fail(tag, "the tabs are not above the tab's box");
        if (L.card.b > L.H - 20 + 0.5 || L.card.t < 16 - 0.5) fail(tag, "the card runs to the window's edge");
      } else if (C.layout === "side") {
        if (L.box.w < 560 || L.box.h < 280) fail(tag, "the tab's box is " + L.box.w + " x " + L.box.h + " px (560 x 280 at the least)");
        if (Math.abs(L.top.w - 64) > 0.5) fail(tag, "the tabs' column is " + L.top.w + " px wide (64)");
        if (L.top.r > L.body.l + 0.5) fail(tag, "the tabs' column is not left of the tab's box");
        if (L.tab.some(t => Math.abs(t.w - 64) > 0.5)) fail(tag, "a tab is not 64 px wide: " + L.tab.map(t => t.w).join(", "));
        if (L.tab.some((t, i) => i && t.t < L.tab[i - 1].b - 0.5)) fail(tag, "the tabs are not a column");
        if (L.x.b > L.tab[0].t + 0.5) fail(tag, "the close button is not at the head of the tabs' column");
        if (Math.abs(L.body.r - (L.safe.r - 8)) > 0.5 || Math.abs(L.body.b - (L.safe.b - 8)) > 0.5 || Math.abs(L.body.t - (L.safe.t + 8)) > 0.5) fail(tag, "the tab's box does not take the rest of the safe area: " + JSON.stringify(L.body));
      } else {
        if (L.tabs.b > L.body.t + 0.5) fail(tag, "the tabs are not across the top");
        if (L.tab.some((t, i) => i && t.l < L.tab[i - 1].r - 0.5)) fail(tag, "the tabs are not a row");
        if (L.box.w < L.W - 20) fail(tag, "the tab's box is " + L.box.w + " px wide of " + L.W);
        if (L.tab[3].r > L.x.l + 0.5) fail(tag, "four tabs do not fit beside the close button");
      }
      // ---- the quality bar: inside the visible area minus the safe areas, 44 px to a finger, text 11 px ----
      const spec = { root: "#hall", parts: ["#hall .hlCard", "#hall .hlTop", "#hallBody", "#hallClose", "#hallTabs .hlTab"],
        primary: ["#hallClose", "#hallTabs .hlTab", "#hallTestSpend", "#hallTestToast"], primaryRequired: true, scroll: "inside" };
      const res = await g.ev(spec => __hsAudit.check(spec), spec);
      for (const f of res.fails) fail(tag, "the quality bar: " + f);
      // every box of the Hall, one by one, against the safe area (what scrolls inside the tab's box may run past it)
      const out = await g.ev(() => {
        const S = __hsAudit.safe(), bad = [];
        for (const e of hallEl.querySelectorAll("*")) {
          if (!__hsAudit.visible(e) || e.closest("svg") && e.tagName !== "svg") continue;
          const r = e.getBoundingClientRect(), b = __hsAudit.inBands(r, S);
          if (b.length && !(hallBodyEl.contains(e) && e !== hallBodyEl && __hsAudit.scrolls(e))) bad.push(__hsAudit.name(e) + " (" + b.join(", ") + ")");
        }
        return bad;
      });
      if (out.length) fail(tag, "outside the visible area minus the safe areas: " + out.slice(0, 5).join("; "));
      // ---- a tab pressed, a badge, a toast ----
      await g.press('#hallTabs .hlTab[data-tab="test2"]');
      st = await hallState(g);
      if (st.tab !== "test2" || st.sel !== "test2" || !/Test tab 2/.test(st.body)) fail(tag, "a press on the second tab did not show it: " + JSON.stringify(st));
      await g.press('#hallTabs .hlTab[data-tab="test1"]');
      const badge = () => g.ev(() => { const b = hallTabsEl.children[0].querySelector(".hlBadge"); return b.hidden ? "" : b.textContent; });
      if (await badge() !== "3") fail(tag, "the first tab's badge reads \"" + await badge() + "\", not 3");
      await g.press("#hallTestSpend");
      await g.frames(3);
      if (await badge() !== "2") fail(tag, "the badge did not follow a press inside the tab: \"" + await badge() + "\"");
      await g.press("#hallTestToast");
      const toast = await g.ev(() => { const cs = getComputedStyle(toastEl), r = toastEl.getBoundingClientRect(); return { show: toastEl.classList.contains("show"), z: cs.zIndex, op: cs.opacity, text: toastEl.textContent, in: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; });
      if (!toast.show || toast.z !== "51" || toast.op !== "1" || !/test tab 1/.test(toast.text) || !toast.in) fail(tag, "a tab's toast does not show over the Hall: " + JSON.stringify(toast));
      await g.ev(() => toastEl.classList.remove("show"));
      // ---- no hotkey of the game's while the Hall is open; a field in a tab takes the letters ----
      // (the focus on the tab shown: Space and Enter then press that tab again, which does nothing, and the four
      // arrows walk the tab row there and back)
      await g.press('#hallTabs .hlTab[data-tab="test1"]');
      const before = await gameState(g);
      for (const k of KEYS) await g.page.keyboard.press(k);
      await g.frames(2);
      let after = await gameState(g);
      if (after !== before) fail(tag, "a hotkey reached the game under the Hall: " + before + " became " + after);
      st = await hallState(g);
      if (!st.open) fail(tag, "a key closed the Hall");
      await g.press("#hallTestInput");
      await g.page.keyboard.type("msp 15");
      const typed = await g.ev(() => $("hallTestInput").value);
      after = await gameState(g);
      if (typed !== "msp 15") fail(tag, "typing in a tab's field gave \"" + typed + "\"");
      if (after !== before) fail(tag, "typing in a tab's field reached the game: " + after);
      await g.shot(o.shots && fails.some(f => f.startsWith(tag)) ? o.shots : null, tag);
      // ---- closed by its button: the map is back in reach ----
      await g.press("#hallClose");
      st = await hallState(g);
      if (st.open || st.blocking || st.inert) fail(tag, "the close button left the Hall up or the map out of reach: " + JSON.stringify(st));
      if (st.focus !== "ovStars") fail(tag, "the focus did not go back to the tally (" + st.focus + ")");
      const back = async (how) => {
        // the map answers again: its gear opens Settings, and the march button is in reach
        // (held upright the map page scrolls: the march button is brought into view as a finger would)
        if (C.layout === "tall") { await g.ev(() => $("startBtn").scrollIntoView({ block: "nearest" })); await g.frames(2); }
        const q = await g.reach("#startBtn");
        if (q.why) fail(tag, "after " + how + " the march button is not in reach: " + q.why);
        if (C.layout === "tall") { await g.ev(() => { overlayEl.scrollTop = 0; }); await g.frames(3); }
        await g.press("#ovGear");
        if (await g.ev(() => settingsEl.style.display) !== "block") fail(tag, "after " + how + " the gear does not open Settings");
        await g.ev(() => closeSettings());
        const ch0 = await g.ev(() => mapChapter());
        await g.page.keyboard.press("ArrowRight");
        await g.frames(2);
        const ch1 = await g.ev(() => mapChapter());
        if (ch1 === ch0) fail(tag, "after " + how + " the map does not take its keys again");
        await g.page.keyboard.press("ArrowLeft");
        await g.frames(2);
      };
      await back("the close button");
      // the pip went with the badge's count? (two tabs still hold one: it stays)
      if (!(await g.ev(() => $("ovStars").classList.contains("pip")))) fail(tag, "the tally lost its pip while a badge is still up");
      // ---- closed by Escape ----
      await g.press("#ovStars");
      if (!(await hallState(g)).open) fail(tag, "the Hall did not open a second time");
      await g.page.keyboard.press("Escape");
      await g.frames(2);
      st = await hallState(g);
      if (st.open || st.blocking || st.inert) fail(tag, "Escape left the Hall up or the map out of reach: " + JSON.stringify(st));
      await back("Escape");
      // ---- by keyboard alone: Enter on the tally, the arrows along the tabs ----
      await g.ev(() => $("ovStars").focus());
      await g.page.keyboard.press("Enter");
      await g.frames(2);
      st = await hallState(g);
      if (!st.open || st.focus !== "hlTab") fail(tag, "Enter on the tally did not open the Hall with the focus on its tab: " + JSON.stringify(st));
      await g.page.keyboard.press(C.layout === "side" ? "ArrowDown" : "ArrowRight");
      st = await hallState(g);
      if (st.tab !== "test2" || !st.focusIn) fail(tag, "an arrow on the tab row did not turn to the next tab: " + JSON.stringify(st));
      await g.page.keyboard.press("End");
      if ((await hallState(g)).tab !== "test4") fail(tag, "End did not turn to the last tab");
      await g.page.keyboard.press("Escape");
      // ---- openHall by name; a tab it does not have ----
      const byName = await g.ev(() => { const a = openHall("test3"), t1 = hallBodyEl.dataset.tab; const b = openHall(), t2 = hallBodyEl.dataset.tab; const c = openHall("nope"), t3 = hallBodyEl.dataset.tab; closeHall(); return [a, t1, b, t2, c, t3].join(","); });
      if (byName !== "true,test3,true,test3,true,test1") fail(tag, "openHall by name: " + byName);
      // ---- the page changes layout under an open tab: the tab is drawn again for its new box ----
      if (C.layout === "wide" && !C.touch) {
        await g.ev(() => openHall("test1"));
        await g.page.setViewportSize({ width: 667, height: 320 });
        await g.frames(4);
        const re = await g.ev(() => ({ layout: hallLayout(), size: $("hallTestSize").textContent, w: hallBodyEl.clientWidth, h: hallBodyEl.clientHeight }));
        if (re.layout !== "side" || !re.size.includes(re.w + " x " + re.h) || re.w < 560 || re.h < 280) fail(tag, "after the window shrank to 667 x 320 the tab was not drawn again for its box: " + JSON.stringify(re));
        await g.page.setViewportSize({ width: C.w, height: C.h });
        await g.frames(4);
        await g.ev(() => closeHall());
      }
      await problems(g, tag);
    } catch (e) {
      fail(tag, "the walk stopped: " + e.message.split("\n")[0]);
      await g.shot(o.shots, tag + " stopped");
    } finally { await g.close(); }
  };
  if (want("hall")) for (const C of WALK) await hallWalk(C);

  // ================= no tab: no door, and nothing offers the Hall =================
  const noTab = async (C, pathq) => {
    const tag = "no tab " + C.name + (pathq.includes("shot") ? " (harness)" : "");
    const g = await openAt(pathq, C);
    try {
      await g.toMap();
      const d = await g.ev(() => {
        const e = $("ovStars"), cs = getComputedStyle(e);
        return { tag: e.tagName, door: e.classList.contains("door"), pip: e.classList.contains("pip"), role: e.getAttribute("role"), ti: e.getAttribute("tabindex"), cursor: cs.cursor,
          shown: __hsAudit.visible(e), label: e.getAttribute("aria-label"), tabs: HALL_TABS.length, acct: getComputedStyle($("setAcct")).display, hall: getComputedStyle(hallEl).display };
      });
      if (d.tabs !== 0) fail(tag, "HALL_TABS holds " + d.tabs + " tabs on a page that should have none");
      if (d.tag !== "BUTTON" || d.door || d.pip || d.role !== "img" || d.ti !== "-1" || d.cursor !== "default") fail(tag, "the tally is not the plain plaque: " + JSON.stringify(d));
      if (!d.shown) fail(tag, "the tally is not shown on the map");
      if (!/Stars won across the campaign/.test(d.label || "")) fail(tag, "the tally lost its label: " + d.label);
      if (d.hall !== "none") fail(tag, "the Hall is shown");
      const q = await g.reach("#ovStars");
      if (q.why) fail(tag, "the tally cannot be pressed to see that it does nothing: " + q.why);
      else { await g.tapAt(q.x, q.y); await g.frames(2); }
      await g.ev(() => $("ovStars").click());
      const st = await hallState(g);
      if (st.open || st.blocking || st.inert) fail(tag, "a press on the tally did something: " + JSON.stringify(st));
      if (await g.ev(() => openHall()) !== false) fail(tag, "openHall() did not answer false with no tab");
      if ((await hallState(g)).open) fail(tag, "openHall() opened a Hall with no tab");
      // Settings on the map: the account's row is in the page and not shown
      await g.press("#ovGear");
      const acct = await g.ev(() => ({ open: settingsEl.style.display, there: !!$("setAcct"), shown: __hsAudit.visible($("setAcct")), text: $("setAcct").textContent }));
      if (acct.open !== "block" || !acct.there || acct.shown || acct.text !== "Account and boards") fail(tag, "Settings' account row: " + JSON.stringify(acct));
      await g.ev(() => closeSettings());
      // the Tab key never stops on the plaque
      const stops = await g.ev(() => [...overlayEl.querySelectorAll("button")].filter(b => b.tabIndex >= 0 && __hsAudit.visible(b)).map(b => b.id));
      if (stops.includes("ovStars")) fail(tag, "the plaque is a Tab stop");
      await problems(g, tag);
    } catch (e) { fail(tag, "the walk stopped: " + e.message.split("\n")[0]); await g.shot(o.shots, tag + " stopped"); }
    finally { await g.close(); }
  };
  if (want("notab")) {
    await noTab({ name: "mouse 1600x900", w: 1600, h: 900 }, "/");
    await noTab({ name: "touch 667x320", w: 667, h: 320, touch: true, ua: UA, standalone: true }, "/");
    await noTab({ name: "touch 1194x834", w: 1194, h: 834, touch: true }, "/?shot=menu&unlock");
  }

  // ================= a plain page (no harness): tabs pushed as gameplay pushes them, the Platform's calls =================
  const plain = async (C) => {
    const tag = "plain page " + C.name;
    const g = await openAt("/", C);
    const expected = /tab broke|p0 test crash/;   // the two errors this walk makes on purpose
    try {
      const first = await g.ev(() => ({ mode: menuMode, keys: Object.keys(Platform).sort().join(","), fns: ["boot", "blocking", "victoryPage", "defeatPage"].every(k => typeof Platform[k] === "function"),
        ch: HS_CHANNEL, url: HS_SUPABASE_URL, key: HS_SUPABASE_ANON_KEY, gate: HS_GATE, mem: HS_STORE_MEM, pf: document.body.classList.contains("pfOn") }));
      if (first.keys !== "blocking,boot,defeatPage,victoryPage" || !first.fns) fail(tag, "Platform holds " + first.keys);
      if (first.mode !== "chapter") fail(tag, "a first visit does not open on Chapter I's story (boot did not hand the page back): " + first.mode);
      if (first.ch !== "live" || first.url !== "" || first.key !== "" || first.gate !== "required" || first.mem || first.pf) fail(tag, "the platform's constants: " + JSON.stringify(first));
      const boot = await g.ev(() => { let n = 0; Platform.boot(() => { n++; }); return n; });
      if (boot !== 1) fail(tag, "Platform.boot(cb) called cb " + boot + " times at once");
      await g.toMap();
      // ---- tabs as gameplay registers them ----
      await g.ev(() => {
        window.__stars = 2; window.__daily = 1;
        HALL_TABS.push({ id: "boards", label: "Leaderboards", short: "Boards", icon: "trophy", render(el) { el.innerHTML = '<p style="padding:12px">The boards</p>'; } });
        HALL_TABS.push({ id: "daily", label: "Daily", icon: "flag", badge: () => window.__daily, render(el) { el.innerHTML = '<p style="padding:12px">The daily</p>'; } });
        HALL_TABS.push({ id: "council", label: "War Council", short: "Council", icon: "star", badge: () => window.__stars,
          render(el) {
            el.innerHTML = '<div style="padding:12px"><p>The council</p><input id="tIn" type="text" style="min-height:44px"><button id="tSpend" type="button" class="btn" style="min-height:44px">Spend</button></div>';
            el.querySelector("#tSpend").addEventListener("click", () => { window.__stars--; });
            // a field of the tab's own that keeps Escape for itself
            el.querySelector("#tIn").addEventListener("keydown", (e) => { if (e.code === "Escape") { e.preventDefault(); window.__esc = (window.__esc || 0) + 1; } });
          } });
        HALL_TABS.push({ id: "bad", label: "Broken", icon: "flag", render() { throw new Error("tab broke"); } });
        HALL_TABS.push({ id: "", label: "No id", render() {} }, null, { id: "norender", label: "No render" });   // rows that are not tabs
        syncHallDoors();
      });
      const d = await g.ev(() => ({ door: $("ovStars").classList.contains("door"), pip: $("ovStars").classList.contains("pip"), role: $("ovStars").getAttribute("role") }));
      if (!d.door || !d.pip || d.role) fail(tag, "the tally did not become a door when tabs were pushed: " + JSON.stringify(d));
      // ---- the order of 0.3 ----
      const opens = async (wantTab, why) => {
        await g.press("#ovStars");
        const st = await hallState(g);
        if (!st.open || st.tab !== wantTab) fail(tag, "openHall() with " + why + " opened " + (st.open ? st.tab : "nothing") + ", not " + wantTab);
        if (st.tabs !== "boards,daily,council,bad") fail(tag, "the tab row is " + st.tabs);
        return st;
      };
      await opens("council", "stars to spend");
      // a press inside the tab spends: the badge and, once the Hall is closed, the pip follow
      await g.press("#tSpend"); await g.press("#tSpend");
      await g.frames(3);
      const b0 = await g.ev(() => { const b = hallTabsEl.querySelector('[data-tab="council"] .hlBadge'); return b.hidden ? "" : b.textContent; });
      if (b0 !== "") fail(tag, "the Council's badge still reads " + b0 + " with nothing left to spend");
      // a tab's own Escape is the tab's; the Hall's Escape still closes it
      await g.press("#tIn");
      await g.page.keyboard.press("Escape");
      let st = await hallState(g);
      if (!st.open || await g.ev(() => window.__esc) !== 1) fail(tag, "Escape taken by a tab's field (preventDefault) closed the Hall or never reached the field");
      // the game's keys, with the Hall open on a plain page
      const before = await gameState(g);
      await g.press("#hallTabs .hlTab[data-tab=\"council\"]");
      for (const k of KEYS) await g.page.keyboard.press(k);
      await g.frames(2);
      st = await hallState(g);
      const after = await gameState(g);
      if (after !== before) fail(tag, "a hotkey reached the game under the Hall: " + before + " became " + after);
      if (!st.open) fail(tag, "a key other than Escape closed the Hall");
      await g.ev(() => openHall("council"));
      await g.press("#hallClose");
      if (await g.ev(() => $("ovStars").classList.contains("pip")) !== true) fail(tag, "the pip went though the Daily's badge is still up");
      await opens("daily", "no stars and the daily unplayed");
      await g.ev(() => { window.__daily = 0; });
      await g.page.keyboard.press("Escape");
      await g.frames(2);
      if (await g.ev(() => $("ovStars").classList.contains("pip"))) fail(tag, "the pip stayed with no badge up");
      await opens("boards", "no badge up");
      await g.press("#hallClose");
      // the keys do reach the game once the Hall is closed (so the check above proves something)
      const m0 = await g.ev(() => Snd.musicOn);
      await g.page.keyboard.press("m");
      const m1 = await g.ev(() => Snd.musicOn);
      await g.page.keyboard.press("m");
      if (m1 === m0) fail(tag, "with the Hall closed M does not toggle the music: the hotkey check proves nothing");
      // ---- a tab that throws ----
      await g.ev(() => { window.__hsEv = []; openHall("bad"); });
      st = await hallState(g);
      const ev = await g.ev(() => JSON.stringify(window.__hsEv.map(e => [e[0], e[1]])));
      if (!st.open || !/could not be shown/.test(st.body)) fail(tag, "a tab that throws took the Hall with it: " + JSON.stringify(st));
      if (!/\["error",\{"msg":"tab broke","at":"hall:bad"\}\]/.test(ev)) fail(tag, "a tab that throws queued no error event: " + ev);
      await g.press("#hallClose");
      if ((await hallState(g)).open) fail(tag, "the Hall with a broken tab does not close");
      // ---- Settings' account row, as a later package will show it ----
      await g.ev(() => { HALL_TABS.push({ id: "account", label: "Account", icon: "crest", render(el) { el.innerHTML = '<p style="padding:12px">The account</p>'; } }); document.body.classList.add("pfOn"); });
      await g.press("#ovGear");
      if (C.touch) {
        // to a finger: the iPhone suite's bar for Settings over the map, with the row in it
        const row = await g.ev(() => __hsAudit.check({ root: "#settings", primary: ["#setAcct"], primaryRequired: true, scroll: "inside" }));
        for (const f of row.fails) fail(tag, "Settings with the account's row: " + f);
      }
      const rowBox = await g.ev(() => { const a = $("setAcct").getBoundingClientRect(), t = $("tutBtn").getBoundingClientRect(), s = settingsEl.getBoundingClientRect();
        return { shown: __hsAudit.visible($("setAcct")), same: Math.abs(a.width - t.width) < 0.5 && Math.abs(a.height - t.height) < 0.5, inside: a.left >= s.left && a.right <= s.right && a.top >= s.top && a.bottom <= s.bottom,
          apart: a.bottom <= t.top + 0.5 || t.bottom <= a.top + 0.5 || a.right <= t.left + 0.5 || t.right <= a.left + 0.5, pause: getComputedStyle($("pauseBtn")).display }; });
      if (!rowBox.shown || !rowBox.same || !rowBox.inside || !rowBox.apart || rowBox.pause !== "none") fail(tag, "Settings' account row, shown: " + JSON.stringify(rowBox));
      await g.press("#setAcct");
      st = await hallState(g);
      if (!st.open || st.tab !== "account" || await g.ev(() => settingsEl.style.display) === "block") fail(tag, "Settings' account row did not open the Hall on Account and put Settings away: " + JSON.stringify(st));
      await g.page.keyboard.press("Escape");
      await g.ev(() => document.body.classList.remove("pfOn"));
      // ---- the Hall goes when the menu page under it goes; it does not open over the nardi board or a battle ----
      await g.ev(() => openHall());
      await g.ev(() => overlayEl.classList.add("hidden"));
      await g.frames(3);
      st = await hallState(g);
      if (st.open || st.blocking) fail(tag, "the Hall stayed up when the menu page under it went");
      await g.ev(() => overlayEl.classList.remove("hidden"));
      await g.frames(3);
      if ((await hallState(g)).inert) fail(tag, "the map stayed out of reach after the Hall went with its page");
      const overNardi = await g.ev(() => { Nardi.play(); const a = openHall(); Nardi.close(); return a; });
      if (overNardi !== false) fail(tag, "the Hall opened over the nardi board");
      // ---- a battle: no Hall, the game's keys act, the victory page calls Platform.victoryPage once ----
      await g.ev(() => { window.__vp = 0; window.__dp = 0; Platform.victoryPage = () => { window.__vp++; }; Platform.defeatPage = () => { window.__dp++; }; });
      await g.enterBattle(0);
      const inBattle = await g.ev(() => [openHall(), Platform.blocking(), $("ovStars").closest("[inert]") !== null].join(","));
      if (inBattle !== "false,false,true") fail(tag, "in a battle (openHall, blocking, the tally inert): " + inBattle);
      await g.page.keyboard.press("p");
      if (await g.ev(() => paused) !== true) fail(tag, "the keydown guard holds the game's keys back in battle (P did not pause)");
      await g.page.keyboard.press("p");
      // the crash card queues an error event (its console line is expected)
      await g.ev(() => { window.__hsEv = []; showCrashCard(new Error("p0 test crash")); });
      const cev = await g.ev(() => JSON.stringify(window.__hsEv.map(e => [e[0], e[1]])));
      if (cev !== '[["error",{"msg":"p0 test crash"}]]') fail(tag, "the crash card queued " + cev);
      await g.ev(() => $("crashCard").classList.remove("on"));
      await g.ev(() => { lives = 17; waveIdx = TOTAL_WAVES; phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
      await g.page.waitForFunction(() => gameOver && (celebration || parley), null, { timeout: 15000 });
      await g.ev(() => endCelebration());
      await g.page.waitForFunction(() => menuMode === "victory" && !overlayEl.classList.contains("hidden"), null, { timeout: 15000 });
      const vp = await g.ev(() => [window.__vp, window.__dp].join(","));
      if (vp !== "1,0") fail(tag, "the victory page called victoryPage, defeatPage " + vp + " times (1,0)");
      // ---- a defeat: Platform.defeatPage once ----
      await g.enterBattle(0);
      await g.ev(() => { while (!gameOver) { spawnEnemy("spearman"); const e = enemies[enemies.length - 1]; e.dead = true; leakFoe(e); } enemies = enemies.filter(e => !e.dead); endFall(); });
      await g.page.waitForFunction(() => !overlayEl.classList.contains("hidden"), null, { timeout: 15000 });
      const dp = await g.ev(() => [window.__vp, window.__dp, $("ovTitle").textContent].join(","));
      if (dp !== "1,1,The Citadel Falls") fail(tag, "the defeat page: victoryPage, defeatPage, title " + dp);
      // ---- with the constants empty: nothing asked of the network but the page itself ----
      await g.ev(() => { for (let i = 0; i < 30; i++) track("p0_probe", { i }); });
      await g.wait(1500);
      if (g.reqs.length !== 1 || g.reqs[0] !== S.base + "/") fail(tag, "the page asked the network for more than its own document: " + g.reqs.join(" , "));
      await problems(g, tag, expected);
    } catch (e) { fail(tag, "the walk stopped: " + e.message.split("\n")[0]); await g.shot(o.shots, tag + " stopped"); }
    finally { await g.close(); }
  };
  if (want("plain")) {
    await plain({ name: "mouse 1600x900", w: 1600, h: 900 });
    await plain({ name: "touch 667x320", w: 667, h: 320, touch: true, ua: UA, standalone: true });
  }

  // ================= track(): it queues, keeps the last 400, calls the kick, never throws =================
  if (want("track")) {
    const tag = "track()";
    const g = await openAt("/", { name: "mouse 1600x900", w: 1600, h: 900 });
    try {
      const r = await g.ev(() => {
        const out = {};
        window.__hsEv = undefined;
        const t = Date.now();
        out.ret = track("one", { a: 1 });
        const q = window.__hsEv;
        out.first = Array.isArray(q) && q.length === 1 && q[0][0] === "one" && q[0][1].a === 1 && q[0][2] >= t && q[0][2] <= Date.now();
        track("bare");
        out.bare = q.length === 2 && q[1][0] === "bare" && q[1][1] === null;
        for (let i = 0; i < 500; i++) track("n" + i, { i });
        out.cap = q.length; out.oldest = q[0][0]; out.newest = q[q.length - 1][0];
        let kicks = 0;
        window.__hsEvKick = () => { kicks++; };
        track("kicked");
        out.kicks = kicks; out.capAfter = q.length;
        // never throws: a kick that throws, a queue that is not a list or cannot grow, names and props of every kind
        const tries = [];
        const go = (name, fn) => { try { fn(); tries.push(name + ":ok"); } catch (e) { tries.push(name + ":THREW"); } };
        window.__hsEvKick = () => { throw new Error("kick broke"); };
        go("kick throws", () => track("x"));
        window.__hsEvKick = undefined;
        const loop = {}; loop.self = loop;
        go("no name", () => track());
        go("null", () => track(null, null));
        go("object name", () => track({}, 5));
        go("no toString", () => track(Object.create(null)));
        go("symbol", () => track(Symbol("s")));
        go("loop", () => track("loop", loop));
        go("big", () => track("big", { s: "x".repeat(200000) }));
        window.__hsEv = 5;
        go("queue is a number", () => track("x"));
        window.__hsEv = Object.freeze([]);
        go("queue is frozen", () => track("x"));
        window.__hsEv = { push() { throw new Error("no"); }, length: 0 };
        go("queue throws", () => track("x"));
        window.__hsEv = [];
        go("after", () => track("after"));
        out.tries = tries.join(" ");
        out.after = window.__hsEv.length;
        out.net = typeof track === "function" && !/fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage/.test(track.toString());
        return out;
      });
      if (r.ret !== undefined || !r.first || !r.bare) fail(tag, "it does not queue [name, props, time]: " + JSON.stringify(r));
      if (r.cap !== 400 || r.oldest !== "n100" || r.newest !== "n499") fail(tag, "the queue is not the last 400: " + r.cap + " from " + r.oldest + " to " + r.newest);
      if (r.kicks !== 1 || r.capAfter !== 400) fail(tag, "the kick was called " + r.kicks + " times; the queue holds " + r.capAfter);
      if (/THREW/.test(r.tries)) fail(tag, "it threw: " + r.tries);
      if (r.after !== 1) fail(tag, "it did not queue again after the hostile cases");
      if (!r.net) fail(tag, "track() itself touches the network or storage");
      await g.wait(600);
      if (g.reqs.length !== 1) fail(tag, "the page asked the network for more than its own document: " + g.reqs.join(" , "));
      await problems(g, tag);
    } catch (e) { fail(tag, "the walk stopped: " + e.message.split("\n")[0]); }
    finally { await g.close(); }
  }

  // ================= the staging channel: /next/ keeps every key under "next:" =================
  if (want("next")) {
    const tag = "staging namespace";
    const C = { name: "mouse 1600x900", w: 1600, h: 900 };
    const ctx = await browser.newContext({ viewport: { width: C.w, height: C.h }, deviceScaleFactor: 1 });
    await ctx.addInitScript(rawStorageLog);
    const opened = [];
    // the browser's own storage, whole, read behind the page's back (and not logged)
    const dump = (g) => g.ev(() => {
      window.__rawQuiet = true;
      const real = window.__realLS, out = {};
      for (let i = 0; i < real.length; i++) { const k = real.key(i); out[k] = real.getItem(k); }
      window.__rawQuiet = false;
      return out;
    });
    const rawLog = (g) => g.ev(() => window.__rawLog.slice());
    const split = (d) => { const next = {}, live = {}; for (const k in d) (k.startsWith("next:") ? next : live)[k] = d[k]; return { next, live }; };
    const same = (a, b) => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));
    // a battle won as the game wins one, so the page writes what a player's progress writes
    const win = async (g) => {
      await g.toMap();
      await g.enterBattle(0);
      await g.ev(() => { lives = 17; waveIdx = TOTAL_WAVES; phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
      await g.page.waitForFunction(() => gameOver && (celebration || parley), null, { timeout: 15000 });
      await g.ev(() => endCelebration());
      await g.page.waitForFunction(() => menuMode === "victory" && !overlayEl.classList.contains("hidden"), null, { timeout: 15000 });
      await g.ev(() => { hideEndingCard(); saveSettings(); });
    };
    try {
      // ---- 1: a first visit to /next/ that plays and wins ----
      const g1 = await openAt("/next/", C, { ctx }); opened.push(g1);
      const c1 = await g1.ev(() => ({ ch: HS_CHANNEL, pre: HS_KEY_PREFIX, mode: menuMode, mem: HS_STORE_MEM }));
      if (c1.ch !== "next" || c1.pre !== "next:" || c1.mem) fail(tag, "a page at /next/ reads its channel as " + JSON.stringify(c1));
      if (c1.mode !== "chapter") fail(tag, "a first visit to /next/ does not open on the story: " + c1.mode);
      await win(g1);
      const l1 = (await rawLog(g1)).filter(e => e[0] === "local"), s1 = (await rawLog(g1)).filter(e => e[0] === "session");
      const bad1 = [...new Set(l1.filter(e => !e[2].startsWith("next:")).map(e => e[1] + " " + e[2]))];
      const wrote1 = [...new Set(l1.filter(e => e[1] === "setItem").map(e => e[2]))];
      notes.nextKeysWritten = wrote1.length;
      if (bad1.length) fail(tag, "a page at /next/ touched keys without the prefix: " + bad1.slice(0, 8).join(", "));
      if (wrote1.length < 8) fail(tag, "a played visit to /next/ wrote only " + wrote1.length + " keys: the check proves little (" + wrote1.join(", ") + ")");
      for (const k of ["next:hs_probe", "next:hs_records", "next:hs_mig_7lv", "next:hs_chapters_seen", "next:hs_best_erebuni_0"]) if (!wrote1.includes(k)) fail(tag, "a played visit to /next/ did not write " + k);
      if (s1.length) notes.sessionKeys = [...new Set(s1.map(e => e[2]))].join(",");
      const d1 = await dump(g1), p1 = split(d1);
      if (Object.keys(p1.live).length) fail(tag, "after a visit to /next/ the storage holds keys without the prefix: " + Object.keys(p1.live).join(", "));
      if (!p1.next["next:hs_records"]) fail(tag, "the victory's record is not under next:hs_records");
      // the page's own view of its storage: its keys, without the prefix
      const view = await g1.ev(() => { const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); return { n: localStorage.length, ks, past: localStorage.key(localStorage.length), rec: localStorage.getItem("hs_records") !== null, raw: localStorage.getItem("next:hs_records") }; });
      if (view.n !== Object.keys(p1.next).length || view.ks.some(k => k.startsWith("next:")) || !view.ks.includes("hs_records") || view.past !== null || !view.rec || view.raw !== null) fail(tag, "the page's own view of its storage: " + JSON.stringify(view).slice(0, 300));
      const stars1 = await g1.ev(() => starTally(LEVELS.map((_, i) => i)).won);
      if (!(stars1 > 0)) fail(tag, "the victory at /next/ won no star");
      await g1.page.close();

      // ---- 2: the live page, same browser: it neither sees nor touches them ----
      const g2 = await openAt("/", C, { ctx }); opened.push(g2);
      const c2 = await g2.ev(() => ({ ch: HS_CHANNEL, pre: HS_KEY_PREFIX, mode: menuMode, stars: starTally(LEVELS.map((_, i) => i)).won, rec: localStorage.getItem("hs_records"), far: furthestOpen(), run: !!getSavedRun(),
        key: typeof localStorage.key === "function" && localStorage instanceof Storage }));
      if (c2.ch !== "live" || c2.pre !== "" || !c2.key) fail(tag, "a page at / reads its channel as " + JSON.stringify(c2));
      if (c2.mode !== "chapter" || c2.stars !== 0 || c2.far !== 0 || c2.run) fail(tag, "the live page sees the staging page's progress: " + JSON.stringify(c2));
      await g2.toMap();
      await g2.enterBattle(0);
      await g2.ev(() => { saveSettings(); });
      await g2.ev(() => { $("gearBtn").click(); });
      await g2.ev(() => { abandonConfirm.arm(); $("menuBtn").click(); });   // Abandon: back to the map, the run cleared
      await g2.frames(3);
      const l2 = (await rawLog(g2)).filter(e => e[0] === "local");
      const bad2 = [...new Set(l2.filter(e => e[2].startsWith("next:")).map(e => e[1] + " " + e[2]))];
      if (bad2.length) fail(tag, "the live page touched the staging page's keys: " + bad2.slice(0, 8).join(", "));
      if (l2.filter(e => e[1] === "setItem").length < 5) fail(tag, "the live page wrote too little for the check to prove anything");
      const d2 = await dump(g2), p2 = split(d2);
      if (!same(p2.next, p1.next)) fail(tag, "a visit to the live page changed the staging page's keys");
      if (!Object.keys(p2.live).length) fail(tag, "the live page wrote no key of its own");
      if (Object.keys(p2.live).some(k => !k.startsWith("hs_"))) fail(tag, "the live page wrote keys that are not hs_ keys: " + Object.keys(p2.live).filter(k => !k.startsWith("hs_")).join(", "));
      // the live page turns its music off, to be told apart below
      await g2.ev(() => { if (Snd.musicOn) toggleMusic(); saveSettings(); });
      const d2b = await dump(g2), p2b = split(d2b);
      await g2.page.close();

      // ---- 3: back at /next/: its own progress is there, the live page's is not, and it leaves the live keys alone ----
      const g3 = await openAt("/next/index.html", C, { ctx }); opened.push(g3);
      const c3 = await g3.ev(() => ({ ch: HS_CHANNEL, mode: menuMode, stars: starTally(LEVELS.map((_, i) => i)).won, music: Snd.musicOn, live: localStorage.getItem("hs_settings") === null }));
      if (c3.ch !== "next") fail(tag, "/next/index.html is not the staging channel: " + c3.ch);
      if (c3.stars !== stars1 || c3.mode === "chapter") fail(tag, "back at /next/ the staging page lost its progress: " + JSON.stringify(c3));
      if (!c3.music) fail(tag, "the staging page took the live page's settings (its music is off)");
      await g3.toMap();
      await g3.enterBattle(0);
      await g3.ev(() => { abandonConfirm.arm(); $("menuBtn").click(); });
      await g3.frames(3);
      const l3 = (await rawLog(g3)).filter(e => e[0] === "local");
      const bad3 = [...new Set(l3.filter(e => !e[2].startsWith("next:")).map(e => e[1] + " " + e[2]))];
      if (bad3.length) fail(tag, "back at /next/ the page touched keys without the prefix: " + bad3.slice(0, 8).join(", "));
      const d3 = await dump(g3), p3 = split(d3);
      if (!same(p3.live, p2b.live)) fail(tag, "a visit to /next/ changed the live page's keys");
      await g3.page.close();

      // ---- 4: the harness at /next/: memory only, under the same wrapper; no real key touched ----
      const g4 = await openAt("/next/?shot=menu&unlock", C, { ctx }); opened.push(g4);
      const c4 = await g4.ev(() => ({ ch: HS_CHANNEL, key: typeof localStorage.key, len: localStorage.length, real: localStorage instanceof Storage, rec: localStorage.getItem("hs_records") !== null, title: document.title }));
      if (c4.ch !== "next" || c4.key !== "function" || c4.real || !c4.rec || c4.title !== "PHOTO_READY") fail(tag, "the harness at /next/: " + JSON.stringify(c4));
      const l4 = (await rawLog(g4)).filter(e => e[0] === "local");
      if (l4.length) fail(tag, "the harness at /next/ touched the browser's storage: " + [...new Set(l4.map(e => e[1] + " " + e[2]))].slice(0, 6).join(", "));
      if (!same(await dump(g4), d3)) fail(tag, "the harness at /next/ changed the browser's storage");
      await g4.page.close();
      // and the harness at /: its memory has no wrapper (as before)
      const g5 = await openAt("/?shot=menu", C, { ctx }); opened.push(g5);
      const c5 = await g5.ev(() => ({ ch: HS_CHANNEL, key: typeof localStorage.key }));
      if (c5.ch !== "live" || c5.key !== "undefined") fail(tag, "the harness at /: " + JSON.stringify(c5));
      if ((await rawLog(g5)).filter(e => e[0] === "local").length) fail(tag, "the harness at / touched the browser's storage");
      await g5.page.close();

      // ---- 5: other paths ----
      for (const [p, wantCh] of [["/next", "next"], ["/nextish/", "live"], ["/index.html", "live"]]) {
        const g = await openAt(p, C, { ctx }); opened.push(g);
        const ch = await g.ev(() => HS_CHANNEL);
        if (ch !== wantCh) fail(tag, "a page at " + p + " reads its channel as " + ch + ", not " + wantCh);
        await g.page.close();
      }
      await ctx.close();

      // ---- 6: a browser that refuses every write, at /next/: memory, and the one key it tried wears the prefix ----
      const g6 = await openAt("/next/", C, { init: [[rawStorageLog], [refuseWrites]] }); opened.push(g6);
      const c6 = await g6.ev(() => ({ ch: HS_CHANNEL, mem: HS_STORE_MEM, key: typeof localStorage.key, mode: menuMode }));
      if (c6.ch !== "next" || !c6.mem || c6.key !== "function" || c6.mode !== "chapter") fail(tag, "a browser that refuses writes, at /next/: " + JSON.stringify(c6));
      await g6.toMap();
      const l6 = (await rawLog(g6)).filter(e => e[0] === "local");
      const bad6 = [...new Set(l6.filter(e => !e[2].startsWith("next:")).map(e => e[1] + " " + e[2]))];
      if (bad6.length) fail(tag, "on memory at /next/ the page still touched keys without the prefix: " + bad6.join(", "));
      if (!l6.some(e => e[1] === "setItem" && e[2] === "next:hs_probe")) fail(tag, "the storage check at /next/ did not try its key under the prefix");
      const kept = await g6.ev(() => { localStorage.setItem("hs_p0", "1"); return localStorage.getItem("hs_p0"); });
      if (kept !== "1") fail(tag, "the page's memory store does not keep a key at /next/");
      await problems(g6, tag);
      await g6.close();
      // the same browser at /: memory too, and its one try is the plain key
      const g7 = await openAt("/", C, { init: [[rawStorageLog], [refuseWrites]] }); opened.push(g7);
      const l7 = (await rawLog(g7)).filter(e => e[0] === "local");
      if (!(await g7.ev(() => HS_STORE_MEM)) || l7.some(e => e[2].startsWith("next:")) || !l7.some(e => e[2] === "hs_probe")) fail(tag, "a browser that refuses writes, at /: " + JSON.stringify(l7.slice(0, 6)));
      await g7.close();
    } catch (e) { fail(tag, "the walk stopped: " + e.message.split("\n")[0]); }
    finally { for (const g of opened) await g.close(); try { await ctx.close(); } catch (e) {} }   // (closing twice is harmless)
  }

  // ================= the harness's photo of the Hall =================
  if (want("photo")) {
    const tag = "photo of the Hall";
    const C = { name: "mouse 1600x900", w: 1600, h: 900 };
    const fileUrl = "file://" + o.file;
    for (const [where, url] of [["http", "/?shot=hall&testtab=2&tab=test2"], ["file", fileUrl + "?shot=hall&testtab=2&tab=test2"]]) {
      const g = await openAt(url, C);
      try {
        const st = await hallState(g), title = await g.page.title();
        if (title !== "PHOTO_READY" || !st.open || st.tab !== "test2" || st.tabs !== "test1,test2") fail(tag, "?shot=hall&testtab=2&tab=test2 over " + where + ": " + title + " " + JSON.stringify(st));
        if (where === "file" && g.reqs.length !== 1) fail(tag, "on file:// the page asked for more than itself: " + g.reqs.join(" , "));
        await problems(g, tag + " (" + where + ")");
      } finally { await g.close(); }
    }
    // with no tab the photo says so instead of showing an empty Hall
    const g = await openAt("/?shot=hall", C);
    try {
      const title = await g.page.title(), text = await g.ev(() => document.body.innerText);
      if (title !== "PHOTO_ERROR" || !/the Hall has no tab to show/.test(text)) fail(tag, "?shot=hall with no tab: " + title);
    } finally { await g.close(); }
    // a test tab exists only under the harness and only when asked for
    for (const [url, n] of [["/?testtab=3", 0], ["/?shot=menu", 0], ["/?shot=menu&testtab", 1], ["/?shot=menu&testtab=9", 6]]) {
      const g2 = await openAt(url, C);
      try { const k = await g2.ev(() => HALL_TABS.length); if (k !== n) fail(tag, url + " gives the Hall " + k + " tabs, not " + n); }
      finally { await g2.close(); }
    }
  }

  await browser.close();
  S.srv.close();
  const strange = S.hits.filter(p => !/^\/((next|nextish)(\/|$))?(index\.html)?$/.test(p));
  if (strange.length) fail("server", "the page asked the server for " + [...new Set(strange)].join(", "));
  R.finish("p0", fails, notes, t0);
})();
