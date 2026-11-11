#!/usr/bin/env node
// The platform's flows in a real browser against the local stack (docs/specs/platform.final.md 10.3): the page is
// served by tools/platform/stack.js from a copy of its own whose two public constants are filled with the stack's
// address and its throwaway anon key (the committed page keeps both empty), and played as a player plays it:
// buttons pressed where they are drawn (each press first checked with elementFromPoint), by mouse at 1600x900 and by
// touch at 1194x834 and on iPhones held sideways (667x320 in Safari; 852x393 from the Home Screen with the safe-area
// insets) and upright (393x659), with an iPhone's user agent on the phones.
//
//   NODE_PATH=$(npm root -g) node tools/regress/platform.js [index.html] [--quick] [--flows=1,2,3,10,11]
//       [--sizes=desk,ipad,ses,i15h,i15u] [--photos=dir] [--shots=dir] [--verbose]
//
// The flows built so far (work package P2: sign-in and the gate; P4: analytics and the stats page):
//   1  the gate: a fresh visitor gets the sign-in card and nothing of the game answers a tap or a key; the three
//      buttons in order; the privacy link and back; a provider the server switched off has no button; Discord held
//      back while the server confirms emails by itself; an in-app browser's user agent hides Google and shows the
//      note with its two ways out; a framed page (on the desktop) opens the game in a tab of its own, and has a real
//      link and Play now as well; Tab and Shift+Tab stay inside the card (the desktop)
//   2  sign-in: Google, Facebook (an account with no email) and Discord through the stack's test provider; after
//      every return the address holds no code, no sign-in id and no fragment; the name card refuses a bad name on
//      the page and a taken name from the server; the welcome card leads with "Begin: Erebuni Rise, 782 BC"; the
//      Account tab shows who is signed in, and signs out; a returning player goes straight to his welcome card;
//      the session is refreshed before it ends and when the page is seen again; a session the server refuses
//      brings the sign-in card back; a sign-in begun on the Account tab comes back to it (the last four on the
//      desktop only)
//   3  errors: the provider cancels, fails, hangs; an unverified Discord email; a wrong verifier; no verifier; a
//      code used twice; the browser's Back button (by a reload, and from the back-forward cache); a sign-in that
//      took over five minutes; a code left in the address; after two failures "Play now", which plays; a sign-in
//      that works counts the failures down to none; a return whose sign-in id is not the stored one; free text as
//      the error is sent as "other"; a device whose clock runs 15 minutes fast signs in; on the desktop: a verifier
//      the store would not keep (the page does not leave), and a second tab opened during a sign-in leaves it alone
//   11 Auth down (it answers 503), hanging, or the device offline: "Play now", and the visitor plays a battle; on a
//      later visit with Auth up he signs in and keeps what he won; a signed-in player with Auth and the database
//      both down goes straight to his welcome card and plays; his token ended (over an hour away) with Auth down or
//      the device offline: the session stays, and is refreshed once Auth is back; signed in with the service
//      hanging: the checking card 4 s at most; storage blocked: the no-site-data card, never a provider's button,
//      and a battle played
//   10 analytics and the stats page (the events counted only with the test's own switch, __HS_PLATFORM_TEST.events,
//      since a Playwright page is a webdriver): a scripted first visit for each kind of device (two new devices, a
//      returning player of before, an arrival in another app's browser) and the funnel the server counts and the
//      stats page shows, step by step and kind by kind; p_ctx's device words; every R1 card drawn; ?stats for a
//      visitor (the sign-in line, and its return to ?stats) and for a player ("This page is for the game's owner.");
//      hostile events straight to hs_track (markup and text where numbers belong, over 4,096 bytes, nested too deep,
//      wrong types, a forged user id and a forged token, a borrowed visit id, a flood from one device): the server's
//      answers, and the owner's page still answers with nothing of theirs made into markup; the period switch; Discord
//      held back with the Health card's line; the gate switched to optional from the page (a fresh visitor gets Play
//      as a guest), the owner's line, back to required; Remove old events. Then nothing is sent from a webdriver
//      without the switch, on file://, or by the page as committed (its constants empty), each with its request log
//      (requests-quiet.json with --photos), and the server's count of events does not move. The owner's part from
//      the visitor's ?stats on runs on the desktop only
// At every size the sign-in, name, welcome and Account cards are held to the iPhone suite's audit (every control
// on screen, out of the safe areas, 44 px to a finger, text at least 11 px, nothing covered) and, with --photos,
// photographed. Every request must go to the stack's two ports; any page error or console error fails.
// --quick: flows 1, 2, 3, 10 and 11 at 1600x900 and 667x320. A RESULT line ends it; it exits 1 on any failure.
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const R = require("./lib");
const AU = require("./iphone-audit");
const { devices } = require(process.env.PW_PATH || "playwright");
const stackMod = require("../platform/stack");

const o = R.cli();
const t0 = Date.now();
const opt = (k, d) => { const a = o.rest.find(x => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
const PHOTOS = opt("photos", null) ? path.resolve(opt("photos")) : null;
if (PHOTOS) fs.mkdirSync(PHOTOS, { recursive: true });
const FLOWS = (opt("flows", "1,2,3,10,11")).split(",");
const UA = devices["iPhone 15"].userAgent;
const SIZES = [
  { key: "desk", name: "mouse 1600x900", w: 1600, h: 900 },
  { key: "ipad", name: "touch 1194x834", w: 1194, h: 834, touch: true },
  { key: "ses", name: "iPhone SE Safari 667x320", w: 667, h: 320, touch: true, ua: UA },
  { key: "i15h", name: "iPhone 15 Home Screen 852x393", w: 852, h: 393, touch: true, ua: UA, standalone: true, insets: { l: 59, r: 59, b: 21, t: 0 } },
  { key: "i15u", name: "iPhone 15 upright 393x659", w: 393, h: 659, touch: true, ua: UA },
];
const pick = opt("sizes", null);
const RUN = pick ? SIZES.filter(s => pick.split(",").includes(s.key)) : o.quick ? SIZES.filter(s => ["desk", "ses"].includes(s.key)) : SIZES;

const fails = [], notes = { addresses: [], states: 0, flows: {} };
const fail = (where, m) => { fails.push(where + ": " + m); console.log("  FAIL " + where + ": " + m); };
const log = (m) => { if (o.verbose) console.log(m); };

(async () => {
  const browser = await R.launch();
  // the page under test, served by the stack from a folder of its own with the two constants filled
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-platform-page-"));
  const S = await stackMod.start({ page: dir });
  const src = fs.readFileSync(o.file, "utf8");
  const filled = src.replace('const HS_SUPABASE_URL = "";', 'const HS_SUPABASE_URL = "' + S.url + '";').replace('const HS_SUPABASE_ANON_KEY = "";', 'const HS_SUPABASE_ANON_KEY = "' + S.anonKey + '";');
  if (filled === src || !filled.includes(S.anonKey)) { console.log("FAIL the page's two constants were not found empty"); process.exit(1); }
  fs.writeFileSync(path.join(dir, "index.html"), filled);
  const SITE = S.site, API = S.url;
  log("stack: " + API + " site " + SITE);

  // ---------------------------------------------------------------- a page of the game from the stack
  // C: a size; x: { ua, init: [[fn, arg]], storage: {k: v} (set before the page loads), blocked: true (storage
  // that throws), offline: true (navigator.onLine false), path }
  const open = async (C, x = {}) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: C.w, height: C.h }, deviceScaleFactor: 1, hasTouch: !!C.touch, isMobile: !!C.touch },
      x.ua || C.ua ? { userAgent: x.ua || C.ua } : {}));
    await ctx.addInitScript(() => { window.__hsQuietCouncilCard = true; });
    if (C.standalone) await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => true }); } catch (e) {} });
    if (C.insets) await ctx.addInitScript(ins => {
      const set = () => { const st = document.documentElement.style; st.setProperty("--sat", (ins.t || 0) + "px"); st.setProperty("--sab", (ins.b || 0) + "px"); st.setProperty("--sal", (ins.l || 0) + "px"); st.setProperty("--sar", (ins.r || 0) + "px"); };
      if (document.documentElement) set();
      else new MutationObserver((m, ob) => { if (document.documentElement) { ob.disconnect(); set(); } }).observe(document, { childList: true });
    }, C.insets);
    if (x.blocked) await ctx.addInitScript(() => {
      // a browser that keeps no site data: touching localStorage throws, as Safari's and Chrome's do when it is blocked
      Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });
    });
    if (x.offline) await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false }); });
    if (x.storage) await ctx.addInitScript(st => { try { for (const k in st) localStorage.setItem(k, st[k]); } catch (e) {} }, x.storage);
    for (const [fn, arg] of x.init || []) await ctx.addInitScript(fn, arg);
    const page = await ctx.newPage();
    const g = new R.Game(page, ctx, { w: C.w, h: C.h, touch: !!C.touch, name: C.name });
    g.reqs = [];
    page.on("request", r => { const u = r.url(); if (!/^(data|blob|about):/.test(u)) g.reqs.push(u); });
    page.on("pageerror", e => g.errs.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error" && !/Failed to load resource: the server responded with a status of (400|401|403|404|503)|net::ERR_ABORTED|ERR_CONNECTION/.test(m.text())) g.errs.push("console.error: " + m.text()); });
    page.on("crash", () => g.errs.push("the page crashed"));
    g.cdp = await ctx.newCDPSession(page);
    await page.goto(SITE + (x.path || "/"), { timeout: 120000 });
    return g;
  };
  // the page's gate in a state ("" for no gate), waited for across navigations
  const gate = async (g, st, ms = 30000) => {
    const end = Date.now() + ms;
    for (;;) {
      try {
        await g.page.waitForFunction(st => typeof gateState !== "undefined" && document.readyState === "complete" && typeof Platform !== "undefined" &&
          (st === "" ? !gateUp : gateUp && gateState === st), st, { timeout: Math.max(500, end - Date.now()) });
        await g.frames(2);
        return true;
      } catch (e) {
        if (Date.now() >= end || !/context|navigat|Target/.test(e.message)) {
          const now = await g.ev(() => (typeof gateState === "undefined" ? "no page" : gateUp ? gateState : "none")).catch(() => "?");
          throw new Error("the gate did not reach " + (st || "none") + " (it is " + now + ")");
        }
      }
    }
  };
  const cardText = (g) => g.ev(() => gateCardEl.innerText.replace(/\s+/g, " ").trim());
  const buttons = (g) => g.ev(() => Array.from(gateCardEl.querySelectorAll(".gateBtn")).map(b => b.dataset.p));
  const evs = (g, name) => g.ev(n => (window.__hsEv || []).filter(e => e[0] === n).map(e => e[1]), name);
  const store = (g, k) => g.ev(k => localStorage.getItem(k), k);
  // press as the player does, where a navigation may follow: the point checked first, then the tap or click
  const pressGo = async (g, sel) => {
    const q = await g.reach(sel);
    if (q.why) throw new Error("cannot press " + sel + ": " + q.why);
    await g.tapAt(q.x, q.y);
  };
  // the address after a return: no code, no sign-in id, no error, no fragment
  const clean = async (g, where) => {
    const u = new URL(g.page.url());
    notes.addresses.push(u.pathname + u.search + u.hash);
    for (const k of ["code", "hsh", "error", "error_code", "error_description", "state"]) if (u.searchParams.has(k)) fail(where, "the address still holds " + k + ": " + g.page.url());
    if (u.hash) fail(where, "the address still holds a fragment: " + g.page.url());
    const hist = await g.ev(() => location.href);
    if (/[?&](code|hsh)=/.test(hist)) fail(where, "location still holds the code: " + hist);
  };
  // the card held to the iPhone suite's audit, and photographed
  const audit = async (g, where, spec, photo) => {
    await g.ev(AU.install);
    const res = await g.ev(spec => __hsAudit.check(spec), spec);
    notes.states++;
    for (const f of res.fails) fail(where, f);
    if (PHOTOS && photo) await g.page.screenshot({ path: path.join(PHOTOS, photo + ".png") });
  };
  const cardSpec = (primary) => ({ root: "#gateCard", primary: primary || ["#gateCard button"], primaryRequired: true, scroll: "inside" });
  const done = async (g, where) => {
    const bad = g.reqs.filter(u => !u.startsWith(SITE) && !u.startsWith(API));
    if (bad.length) fail(where, "requests outside the stack: " + [...new Set(bad)].slice(0, 4).join(", "));
    const probs = await g.problems().catch(() => g.errs);
    for (const p of probs) fail(where, p);
    if (o.shots && fails.length) await g.shot(o.shots, where);
    await g.close();
  };
  // a sign-in through the test provider: who is queued, the provider's button pressed, the return waited for
  const signIn = async (g, who, prov, until) => {
    if (who) await S.control("provider", { who });
    await pressGo(g, '#gate .gateBtn[data-p="' + prov + '"]');
    await gate(g, until);
  };
  // a menu page's button pressed as the player does, scrolled to first where the page scrolls (an upright phone)
  const pressIn = async (g, sel) => {
    await g.ev(sel => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "nearest" }); }, sel);
    await g.frames(2);
    await g.press(sel);
  };
  // past the first visit's chapter story to the map ("To the Map")
  const toMap = async (g) => {
    for (let k = 0; k < 4; k++) {
      if ((await g.ev(() => menuMode)) !== "chapter") break;
      await pressIn(g, "#startBtn");
      await g.wait(150);
    }
  };
  // The game itself in reach and playing: the map's battlefield entered through its chronicle, its first wave sent.
  // A phone held upright is turned sideways first, as the game asks of a player there
  const plays = async (g, where) => {
    await gate(g, "");
    const C = g.o, upright = C.w < C.h && C.w <= 500;
    await toMap(g);
    const inReach = await g.ev(() => !overlayEl.hasAttribute("inert") && !gateUp && !Platform.blocking());
    if (!inReach) fail(where, "the map is not in reach after the gate");
    if (upright) await g.page.setViewportSize({ width: C.h, height: C.w });
    await g.enterBattle(0);
    const live = await g.ev(() => ({ live: battleLive(), gate: gateUp, over: gameOver }));
    if (!live.live || live.gate) fail(where, "no battle is being played: " + JSON.stringify(live));
    if (upright) await g.page.setViewportSize({ width: C.w, height: C.h });
    return live.live;
  };
  const resetStack = async () => {
    await S.control("reset");
    await S.control("auth", { mode: "up" }); await S.control("rest", { mode: "up" });
    await S.control("settings", { mailer_autoconfirm: false, external: { google: true, facebook: true, discord: true } });
    await S.control("authclock", { seconds: 0 });
  };

  // ================================================================ flow 1: the gate
  const flow1 = async (C) => {
    const W = "flow 1 " + C.name;
    await resetStack();
    let g = await open(C);
    await gate(g, "signin");
    const order = await buttons(g);
    if (order.join() !== "google,facebook,discord") fail(W, "the buttons are " + order.join());
    const txt = await cardText(g);
    for (const want of ["Sign in to take command.", "Your progress is saved to your account. Pick up where you left off on any device.", "For players 13 and older.", "Privacy"])
      if (!txt.includes(want)) fail(W, "the card lacks: " + want);
    await audit(g, W + " sign-in card", cardSpec(['#gate .gateBtn[data-p="google"]']), "signin-" + C.key);
    // nothing of the game answers: the March button's place is the gate's, and the game's keys do nothing
    const under = await g.ev(() => {
      // the March button's place (on an upright phone it lies below the fold: the middle of the screen then)
      const r = $("startBtn").getBoundingClientRect();
      let x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (y > innerHeight || x > innerWidth) { const t = $("ovStars").getBoundingClientRect(); x = t.left + t.width / 2; y = t.top + t.height / 2; }   // (else the campaign's tally)
      const e = document.elementFromPoint(x, y);
      return { x, y, inGate: !!e && gateEl.contains(e), inert: overlayEl.hasAttribute("inert"), blocking: Platform.blocking(), mode: menuMode, wave: waveIdx, sel: curLevel };
    });
    if (!under.inGate || !under.inert || !under.blocking) fail(W, "the game is in reach under the gate: " + JSON.stringify(under));
    await g.tapAt(under.x, under.y);
    for (const k of ["Space", "Enter", "KeyP", "Digit1", "Escape", "KeyU"]) await g.page.keyboard.press(k);
    const after = await g.ev(() => ({ mode: menuMode, gate: gateUp, st: gateState, live: battleLive(), hall: hallOpen, wave: waveIdx, sel: curLevel, settings: settingsEl.style.display }));
    if (after.mode !== under.mode || !after.gate || after.st !== "signin" || after.live || after.hall || after.wave !== under.wave || after.sel !== under.sel || after.settings === "block") fail(W, "a tap or a key reached the game: " + JSON.stringify(after));
    // Tab and Shift+Tab go round inside the card and never out to the page (3.3)
    if (C.key === "desk") {
      const out = [];
      for (const k of ["Tab", "Tab", "Tab", "Tab", "Tab", "Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
        await g.page.keyboard.press(k);
        if (!(await g.ev(() => gateCardEl.contains(document.activeElement)))) out.push(k + " to " + await g.ev(() => document.activeElement && document.activeElement.tagName));
      }
      if (out.length) fail(W, "the focus left the card: " + out.join(", "));
      if ((await g.ev(() => ({ st: gateState, up: gateUp }))).st !== "signin") fail(W, "Tab changed the card");
    }
    await g.wait(1200);
    const shown = await evs(g, "gate_shown");
    if (!shown.length || shown[0].providers !== "gfd" || shown[0].state !== "signin" || shown[0].mode !== "required") fail(W, "gate_shown: " + JSON.stringify(shown));
    const pl = await evs(g, "page_load");
    if (!pl.length || pl[0].gate !== "required" || pl[0].signed !== false) fail(W, "page_load: " + JSON.stringify(pl));
    // the privacy link and back
    await pressGo(g, "#gate .gtPrivacy");
    await g.page.waitForFunction(() => typeof Platform !== "undefined" && document.readyState === "complete" && !$("privacyPage").hidden, null, { timeout: 30000 });
    const pv = await g.ev(() => ({ gate: gateUp, search: location.search, text: $("privacyPage").innerText }));
    if (pv.gate || !/Privacy/.test(pv.text)) fail(W, "the privacy page: " + JSON.stringify(pv).slice(0, 200));
    await audit(g, W + " privacy page", { root: "#privacyPage", parts: ["#privacyPage .kit"], primary: ["#privacyBack"], primaryRequired: true, scroll: "page" }, C.key === "desk" || C.key === "ses" ? "privacy-" + C.key : null);
    await pressGo(g, "#privacyBack");
    await gate(g, "signin");
    if (new URL(g.page.url()).search) fail(W, "back from the privacy page the address is " + g.page.url());
    // a provider the server switched off has no button
    await S.control("settings", { external: { facebook: false } });
    await g.page.reload(); await gate(g, "signin");
    if ((await buttons(g)).join() !== "google,discord") fail(W, "with Facebook off the buttons are " + (await buttons(g)).join());
    await S.control("settings", { external: { facebook: true } });
    // Discord held back while the server confirms emails by itself (RULINGS D3)
    await S.control("settings", { mailer_autoconfirm: true });
    await g.page.reload(); await gate(g, "signin");
    if ((await buttons(g)).join() !== "google,facebook") fail(W, "with mailer_autoconfirm on the buttons are " + (await buttons(g)).join());
    await g.wait(1200);
    const held = await evs(g, "gate_shown");
    if (!held.length || held[0].held !== "d" || held[0].providers !== "gf") fail(W, "gate_shown with Discord held: " + JSON.stringify(held));
    await S.control("settings", { mailer_autoconfirm: false });
    // every provider off: Sign-in is not answering, Play now
    await S.control("settings", { external: { google: false, facebook: false, discord: false } });
    await g.page.reload(); await gate(g, "down");
    await S.control("settings", { external: { google: true, facebook: true, discord: true } });
    await done(g, W);
    // an in-app browser: no Google, the note, Copy link and Open in browser
    g = await open(C, { ua: (C.ua || UA) + " Instagram 300.0.0.18.110 (iPhone15,4; iOS 17_0; en_US)" });
    await gate(g, "signin");
    if ((await buttons(g)).join() !== "facebook,discord") fail(W, "in an in-app browser the buttons are " + (await buttons(g)).join());
    const ia = await cardText(g);
    if (!ia.includes("This app's browser can block sign-in. For Google, open") || !ia.includes("Copy link") || !ia.includes("Open in browser")) fail(W, "the in-app note: " + ia.slice(0, 300));
    await audit(g, W + " in-app card", cardSpec(['#gate .gateBtn[data-p="facebook"]']), "inapp-" + C.key);
    await g.wait(1200);
    const sh = await evs(g, "gate_shown");
    if (!sh.length || sh[0].state !== "inapp") fail(W, "gate_shown in an in-app browser: " + JSON.stringify(sh));
    const link = await g.ev(() => Array.from(gateCardEl.querySelectorAll("a")).map(a => a.getAttribute("href")).find(h => /^x-safari-/.test(h)) || "");
    if (link !== "x-safari-" + SITE + "/") fail(W, "Open in browser leads to " + link);
    await done(g, W + " in-app");
    // a framed page: the provider's button opens the game in a tab of its own
    if (C.key === "desk") {
      const ctx = await browser.newContext({ viewport: { width: C.w, height: C.h } });
      await ctx.addInitScript(() => { window.__hsQuietCouncilCard = true; });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", e => errs.push(e.message));
      await page.goto(SITE + "/frame-host-is-the-page-itself");
      await page.setContent('<iframe id="f" src="' + SITE + '/" style="width:1200px;height:800px;border:0"></iframe>');
      const fr = await (await page.waitForSelector("#f")).contentFrame();
      await fr.waitForFunction(() => typeof gateState !== "undefined" && gateState === "signin", null, { timeout: 60000 });
      const ft = await fr.evaluate(() => gateCardEl.innerText);
      if (!ft.includes("Sign-in opens the game in its own tab.")) fail(W, "a framed page lacks its line");
      // a frame whose sandbox forbids new tabs is told nothing: a real link and Play now are there as well
      const fl = await fr.evaluate(() => ({ link: Array.from(gateCardEl.querySelectorAll("a[target=_blank]")).map(a => a.href), play: Array.from(gateCardEl.querySelectorAll("button")).some(b => b.textContent === "Play now") }));
      if (fl.link.length !== 1 || !fl.link[0].startsWith(SITE) || !fl.play) fail(W, "a framed page's ways out: " + JSON.stringify(fl));
      const [pop] = await Promise.all([ctx.waitForEvent("page", { timeout: 15000 }).catch(() => null), fr.click('#gate .gateBtn[data-p="google"]')]);
      if (!pop) fail(W, "a framed page's button opened no tab");
      else if (!pop.url().startsWith(SITE)) fail(W, "a framed page's button opened " + pop.url());
      if (errs.length) fail(W, "framed: " + errs.join("; "));
      // Play now in the frame plays
      await fr.click("#gate button >> text=Play now");
      await fr.waitForFunction(() => !gateUp, null, { timeout: 15000 });
      const fb = await fr.evaluate(() => (window.__hsEv || []).filter(e => e[0] === "gate_bypass").map(e => e[1].why));
      if (fb.join() !== "framed") fail(W, "a framed page's Play now: gate_bypass " + fb.join());
      await ctx.close();
    }
  };

  // ================================================================ flow 2: sign-in
  const flow2 = async (C) => {
    const W = "flow 2 " + C.name;
    await resetStack();
    let g = await open(C);
    await gate(g, "signin");
    // Google
    await signIn(g, "aram", "google", "name");
    await clean(g, W + " Google");
    if (await store(g, "hs_pf_pkce")) fail(W, "hs_pf_pkce is left after the sign-in");
    const ses = JSON.parse(await store(g, "hs_pf_auth") || "null");
    if (!ses || ses.prov !== "google" || !ses.uid) fail(W, "the session: " + JSON.stringify(ses && { prov: ses.prov, uid: !!ses.uid }));
    for (const k of ["provider_token", "provider_refresh_token"]) if ((await store(g, "hs_pf_auth") || "").includes(k)) fail(W, "the provider's token is stored");
    const si = await evs(g, "signed_in");
    if (!si.length || si[0].provider !== "google" || si[0].new !== true || si[0].same !== true) fail(W, "signed_in: " + JSON.stringify(si));
    const nt = await cardText(g);
    if (!nt.includes("Choose your player name") || !nt.includes("Do not use your real name.")) fail(W, "the name card: " + nt.slice(0, 200));
    const sug = await g.ev(() => gateCardEl.querySelector(".gtField").value);
    if (!/^Defender\d{6}$/.test(sug)) fail(W, "the suggested name is " + sug);
    await audit(g, W + " name card", cardSpec(["#gate .gtGo"]), "name-" + C.key);
    // refused on the page as it is typed
    for (const [v, want] of [["<b>x</b>", "Use letters, numbers, spaces, dots, dashes and underscores."], ["ab", "Use 3 to 16 characters."], ["The Adm1n", "That name is not allowed. Try another."]]) {
      await g.page.fill("#gate .gtField", v);
      const e = await g.ev(() => gateCardEl.querySelector(".gtErr").textContent);
      if (e !== want) fail(W, "the name " + JSON.stringify(v) + " is told " + JSON.stringify(e));
    }
    await g.page.fill("#gate .gtField", "Aram");
    await pressGo(g, "#gate .gtGo");
    await gate(g, "welcome");
    let wt = await cardText(g);
    if (!wt.startsWith("Welcome, Aram.") || !wt.includes("0 of 51 stars. 0 of 17 battlefields held.") || !wt.includes("Begin: Erebuni Rise, 782 BC")) fail(W, "the welcome card: " + wt);
    await audit(g, W + " welcome card", cardSpec(["#gate .gtGo"]), "welcome-" + C.key);
    // the Account tab, from Settings' row on the map
    await pressGo(g, "#gate .gtQuiet:not(.gtGo)");   // Campaign Map
    await gate(g, "");
    await toMap(g);
    await pressIn(g, "#ovGear");
    await pressIn(g, "#setAcct");
    await g.page.waitForFunction(() => hallOpen && hallTab === "account" && !hallEl.classList.contains("hlSettling"), null, { timeout: 5000 });
    const at = await g.ev(() => hallBodyEl.innerText.replace(/\s+/g, " "));
    if (!at.includes("Aram") || !at.includes("Signed in with Google.") || !at.includes("Sign out")) fail(W, "the Account tab: " + at);
    const tabs = await g.ev(() => Array.from(hallTabsEl.children).map(b => b.dataset.tab).join());
    if (tabs !== "council,account") fail(W, "the Hall's tabs are " + tabs);
    await audit(g, W + " Account tab", { root: "#hall", parts: ["#hallBody", "#hallTabs", "#hallClose"], primary: [".acTab .btn"], primaryRequired: true, scroll: "inside" }, "account-" + C.key);
    // sign out: asked, then done; the page comes back to the gate, Google marked "Last used"
    await g.press(() => Array.from(document.querySelectorAll(".acTab .btn")).find(b => b.textContent === "Sign out"));
    const ask = await g.ev(() => hallBodyEl.innerText);
    if (!ask.includes("Sign out? Your progress stays on this device.")) fail(W, "sign-out asks: " + ask);
    const before = (await S.control("state")).sessions;
    await pressGo(g, () => Array.from(document.querySelectorAll(".acTab .btn")).find(b => b.textContent === "Sign out"));
    await gate(g, "signin");
    if ((await S.control("state")).sessions !== before - 1) fail(W, "sign-out left the server's session open");
    if (await store(g, "hs_pf_auth")) fail(W, "sign-out left the session on the device");
    const last = await g.ev(() => Array.from(gateCardEl.querySelectorAll(".gtLast")).map(e => e.parentNode.dataset.p).join());
    if (last !== "google") fail(W, "Last used is on " + last);
    // Facebook: an account with no email; "Aram" is taken; a new account on a device that held another
    await signIn(g, "fb-noemail", "facebook", "name");
    await clean(g, W + " Facebook");
    const nt2 = await cardText(g);
    if (!nt2.includes("This is a new account. If you played before, you may have used another button.") || !nt2.includes("Back to sign-in")) fail(W, "the name card of a second account: " + nt2);
    await g.page.fill("#gate .gtField", "A r 4 m");
    await pressGo(g, "#gate .gtGo");
    await g.page.waitForFunction(() => gateCardEl.querySelector(".gtErr") && gateCardEl.querySelector(".gtErr").textContent !== "", null, { timeout: 10000 });
    const taken = await g.ev(() => gateCardEl.querySelector(".gtErr").textContent);
    if (taken !== "That name is taken. Try another.") fail(W, "a taken name is told " + JSON.stringify(taken));
    await g.page.fill("#gate .gtField", "Bagrat");
    await pressGo(g, "#gate .gtGo");
    await gate(g, "welcome");
    if (!(await cardText(g)).startsWith("Welcome, Bagrat.")) fail(W, "Facebook's welcome: " + await cardText(g));
    // signed out from the name card's own button next time round is flow 3's; here through the Account tab again
    await pressGo(g, "#gate .gtQuiet:not(.gtGo)");
    await gate(g, "");
    await g.ev(() => openHall("account"));
    await g.page.waitForFunction(() => hallOpen && !hallEl.classList.contains("hlSettling"), null, { timeout: 5000 });
    await g.press(() => Array.from(document.querySelectorAll(".acTab .btn")).find(b => b.textContent === "Sign out"));
    await pressGo(g, () => Array.from(document.querySelectorAll(".acTab .btn")).find(b => b.textContent === "Sign out"));
    await gate(g, "signin");
    // Discord: the suggested name kept as it is
    await signIn(g, "nune", "discord", "name");
    await clean(g, W + " Discord");
    const sug2 = await g.ev(() => gateCardEl.querySelector(".gtField").value);
    await pressGo(g, "#gate .gtGo");
    await gate(g, "welcome");
    if (!(await cardText(g)).startsWith("Welcome, " + sug2 + ".")) fail(W, "Discord's welcome: " + await cardText(g));
    const names = (await S.query("select name from public.hs_profiles order by created_at")).map(r => r.name);
    if (names.join() !== ["Aram", "Bagrat", sug2].join()) fail(W, "the server's names: " + names.join());
    // a returning player: straight to his welcome card
    await g.page.reload();
    await gate(g, "welcome");
    if (!(await cardText(g)).startsWith("Welcome back, " + sug2 + ".")) fail(W, "a returning player's card: " + await cardText(g));
    await pressGo(g, "#gate .gtGo");
    await gate(g, "");
    const gp = await evs(g, "gate_passed"), wtp = await evs(g, "welcome_tap");
    if (!gp.length || gp[0].how !== "session" || !wtp.length || wtp[0].choice !== "begin") fail(W, "gate_passed " + JSON.stringify(gp) + ", welcome_tap " + JSON.stringify(wtp));
    if (C.key === "desk") {
      // refreshed before the session ends: a load with under 90 s left
      const a0 = JSON.parse(await store(g, "hs_pf_auth"));
      await g.ev(() => { const s = JSON.parse(localStorage.getItem("hs_pf_auth")); s.exp = Math.floor(Date.now() / 1000) + 30; localStorage.setItem("hs_pf_auth", JSON.stringify(s)); });
      await g.page.reload();
      await gate(g, "welcome");
      const a1 = JSON.parse(await store(g, "hs_pf_auth"));
      if (a1.at === a0.at || a1.rt === a0.rt || a1.exp - Math.floor(Date.now() / 1000) < 3000) fail(W, "a session near its end was not refreshed at load");
      // and when the page is seen again
      await g.ev(() => { const s = JSON.parse(localStorage.getItem("hs_pf_auth")); s.exp = Math.floor(Date.now() / 1000) + 30; localStorage.setItem("hs_pf_auth", JSON.stringify(s)); document.dispatchEvent(new Event("visibilitychange")); });
      await g.page.waitForFunction(rt => JSON.parse(localStorage.getItem("hs_pf_auth")).rt !== rt, a1.rt, { timeout: 10000 }).catch(() => fail(W, "the session was not refreshed when the page was seen again"));
      // a session the server refuses (its access token ended there and its refresh token unknown): the gate again
      await S.control("expire", {});
      await g.ev(() => { const s = JSON.parse(localStorage.getItem("hs_pf_auth")); s.rt = "not-a-refresh-token"; localStorage.setItem("hs_pf_auth", JSON.stringify(s)); });
      await g.page.reload();
      await gate(g, "signin");
      if (await store(g, "hs_pf_auth")) fail(W, "a refused session was kept");
      // the staging page signs in to /next/ and keeps its session under next: (9.3); the live page sees none of it
      // (Nune's Google account has her Discord account's email: the server joins them, so she has her name already)
      await S.control("provider", { who: "nune" });
      await g.page.goto(SITE + "/next/");
      await gate(g, "signin");
      await pressGo(g, '#gate .gateBtn[data-p="google"]');
      await gate(g, "welcome");
      await clean(g, W + " /next/");
      if (new URL(g.page.url()).pathname !== "/next/") fail(W, "a sign-in begun on /next/ came back to " + g.page.url());
      await g.page.goto(SITE + "/");
      await gate(g, "signin");
      const raw = await g.ev(() => ({ next: !!localStorage.getItem("next:hs_pf_auth"), live: !!localStorage.getItem("hs_pf_auth") }));
      if (!raw.next || raw.live) fail(W, "the staging page's session is not kept apart: " + JSON.stringify(raw));
      // a sign-in begun on the Account tab (a guest who played on) comes back to the Account tab, not the welcome card
      await g.ev(() => localStorage.setItem("hs_pf_gate", JSON.stringify({ fails: 2, guest: false })));
      await g.page.reload(); await gate(g, "signin");
      await pressGo(g, () => Array.from(gateCardEl.querySelectorAll("button")).find(b => b.textContent === "Play now"));
      await gate(g, "");
      await toMap(g);
      await g.ev(() => openHall("account"));
      await g.page.waitForFunction(() => hallOpen && hallTab === "account" && !hallEl.classList.contains("hlSettling"), null, { timeout: 5000 });
      await S.control("provider", { who: "aram" });
      await pressGo(g, '.acTab .gateBtn[data-p="google"]');
      await gate(g, "");
      await g.page.waitForFunction(() => hallOpen && hallTab === "account", null, { timeout: 10000 }).catch(() => {});
      const hb = await g.ev(() => ({ hall: hallOpen, tab: hallTab, text: hallBodyEl.innerText.replace(/\s+/g, " ") }));
      if (!hb.hall || hb.tab !== "account" || !hb.text.includes("Aram") || !hb.text.includes("Signed in with Google.")) fail(W, "a sign-in from the Account tab came back to " + JSON.stringify(hb).slice(0, 200));
      await clean(g, W + " from the Account tab");
    }
    await done(g, W);
  };

  // ================================================================ flow 3: errors
  const flow3 = async (C) => {
    const W = "flow 3 " + C.name;
    await resetStack();
    const g = await open(C);
    await gate(g, "signin");
    const line = async (want, error, where) => {
      const t = await cardText(g);
      if (!t.includes(want)) fail(W, where + ": the card says " + t.slice(0, 260));
      await clean(g, W + " " + where);
      if (await store(g, "hs_pf_pkce")) fail(W, where + ": hs_pf_pkce is left");
      if (error) {
        const e = await evs(g, "signin_error");
        if (!e.some(x => x.error === error)) fail(W, where + ": signin_error " + JSON.stringify(e));
      }
    };
    const fails0 = () => g.ev(() => localStorage.setItem("hs_pf_gate", JSON.stringify({ fails: 0, guest: false })));
    const hasPlay = () => g.ev(() => Array.from(gateCardEl.querySelectorAll("button")).some(b => b.textContent === "Play now"));
    // the player cancels at the provider
    await signIn(g, "cancel", "google", "signin");
    await line("Sign-in was canceled.", "access_denied", "cancel");
    if (await hasPlay()) fail(W, "Play now after one failure");
    // the provider fails: the second in a row brings Play now
    await signIn(g, "error", "facebook", "signin");
    await line("Sign-in did not finish. Try again, or use another account.", "server_error", "provider error");
    if (!(await hasPlay()) || !(await cardText(g)).includes("Sign-in is giving trouble. You can play now and sign in later.")) fail(W, "no Play now after two failures");
    await audit(g, W + " card after two failures", cardSpec(['#gate .gateBtn[data-p="google"]']), C.key === "desk" || C.key === "ses" ? "trouble-" + C.key : null);
    await fails0();
    // an unverified email at Discord
    await signIn(g, "discord-unverified", "discord", "signin");
    await line("Discord says your email is not verified. Verify it there, then try again.", "provider_email_needs_verification", "unverified email");
    await fails0();
    // a wrong verifier: the exchange is refused
    await S.control("provider", { who: "aram" });
    await g.ev(() => { pfSignIn("google", ""); const p = JSON.parse(localStorage.getItem("hs_pf_pkce")); p.v = "f".repeat(128); localStorage.setItem("hs_pf_pkce", JSON.stringify(p)); });
    await gate(g, "signin");
    await line("Sign-in did not finish. Try again, or use another account.", "exchange_403", "wrong verifier");
    if ((await S.control("state")).sessions !== 0) fail(W, "a wrong verifier made a session");
    // no verifier: a return this window cannot finish
    await S.control("provider", { who: "aram" });
    await g.ev(() => { pfSignIn("google", ""); localStorage.removeItem("hs_pf_pkce"); });
    await gate(g, "signin");
    await line("Sign-in did not finish here. Try again.", "no_verifier", "no verifier");
    await fails0();
    // a return whose sign-in id is not the one stored (the hsh check): refused before any exchange, no session made
    await S.control("provider", { who: "aram" });
    const s0 = (await S.control("state")).sessions;
    await g.ev(() => { pfSignIn("google", ""); const p = JSON.parse(localStorage.getItem("hs_pf_pkce")); p.h = "another-sign-in"; localStorage.setItem("hs_pf_pkce", JSON.stringify(p)); });
    await gate(g, "signin");
    await line("Sign-in did not finish here. Try again.", "no_verifier", "a sign-in id not the one stored");
    if ((await S.control("state")).sessions !== s0 || await store(g, "hs_pf_auth")) fail(W, "a return with another sign-in id made a session");
    await fails0();
    // an error word from the address that is not the server's kind of word goes into the event as "other" (7.2)
    await g.page.goto(SITE + "/?error=" + encodeURIComponent("Look at <this> 123") + "&error_code=" + encodeURIComponent("Hello World!"));
    await gate(g, "signin");
    await line("Sign-in did not finish. Try again, or use another account.", "other", "free text as the error");
    const ew = await evs(g, "signin_error");
    if (ew.some(x => x.error !== "other")) fail(W, "free text reached signin_error: " + JSON.stringify(ew));
    await fails0();
    if (C.key === "desk") {
      // the verifier cannot be written (a full store): the browser does not leave, the no-site-data card says why
      await g.ev(() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/hs_pf_pkce/.test(k)) throw new DOMException("full", "QuotaExceededError"); return window.__realSet.call(this, k, v); }; });
      await pressGo(g, '#gate .gateBtn[data-p="google"]');
      await gate(g, "nostore");
      await g.wait(500);
      if (!new URL(g.page.url()).href.startsWith(SITE) || await store(g, "hs_pf_pkce")) fail(W, "a verifier that was not kept: the page left for " + g.page.url());
      await g.ev(() => { Storage.prototype.setItem = window.__realSet; });
      await g.page.reload(); await gate(g, "signin");
      // a second tab of the game opened while the first waits at the provider leaves that sign-in alone
      // (nobody queued: the provider's page of test people waits for a choice)
      await pressGo(g, '#gate .gateBtn[data-p="google"]');
      await g.page.waitForURL(u => String(u).startsWith(API + "/provider/"), { timeout: 15000 });
      const p2 = await g.ctx.newPage();
      await p2.goto(SITE + "/", { timeout: 120000 });
      await p2.waitForFunction(() => typeof gateState !== "undefined" && gateUp && gateState === "signin", null, { timeout: 30000 });
      const e2 = await p2.evaluate(() => (window.__hsEv || []).filter(e => e[0] === "signin_error").length);
      if (e2) fail(W, "a second tab counted the first tab's sign-in as abandoned");
      await p2.close();
      await g.page.click("#who-bagrat");
      await gate(g, "name");
      await clean(g, W + " a second tab");
      await g.ev(() => { localStorage.removeItem("hs_pf_auth"); localStorage.removeItem("hs_pf_me"); });
      await g.page.goto(SITE + "/"); await gate(g, "signin");
      await fails0();
    }
    // a code used twice: a sign-in that works, its return address kept, then that address loaded again with the
    // same verifier
    let back = null;
    const seen = (r) => { if (r.url().startsWith(SITE) && /[?&]code=/.test(r.url())) back = r.url(); };
    g.page.on("request", seen);
    await S.control("provider", { who: "bagrat" });
    const pk = await g.ev(() => { pfSignIn("google", ""); return localStorage.getItem("hs_pf_pkce"); });
    await gate(g, "name");
    g.page.off("request", seen);
    if (!back) fail(W, "the return address was not seen");
    else {
      await g.ev(pk => { localStorage.removeItem("hs_pf_auth"); localStorage.removeItem("hs_pf_me"); const p = JSON.parse(pk); p.t = Date.now(); localStorage.setItem("hs_pf_pkce", JSON.stringify(p)); }, pk);
      await g.page.goto(back);
      await gate(g, "signin");
      await line("Sign-in took too long. Try again.", "exchange_404", "code used twice");
      if (await store(g, "hs_pf_auth")) fail(W, "a code used twice made a session");
    }
    await fails0();
    // the browser's Back button from the provider's page (a reload of the page)
    await pressGo(g, '#gate .gateBtn[data-p="facebook"]');
    await g.page.waitForURL(u => String(u).startsWith(API + "/provider/"), { timeout: 15000 });
    await g.page.goBack();
    await gate(g, "signin");
    await line("Sign-in did not finish. Try again, or use another account.", "abandoned", "Back button");
    // ... and from the back-forward cache (the page shown again with no load: its pageshow event)
    // (the sign-in as this tab began it: its verifier, and this tab's own mark that it began it)
    await g.ev(() => { localStorage.setItem("hs_pf_pkce", JSON.stringify({ v: "a".repeat(128), h: "x", p: "discord", t: Date.now(), sa: false, back: "" })); sessionStorage.setItem("hs_pf_mine", "x"); window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })); });
    await g.frames(2);
    const bf = await evs(g, "signin_error");
    if (!bf.some(x => x.error === "abandoned" && x.provider === "discord")) fail(W, "a return from the back-forward cache was not counted: " + JSON.stringify(bf));
    if (await store(g, "hs_pf_pkce")) fail(W, "the back-forward return left hs_pf_pkce");
    await fails0();
    // a provider that never answers: the player gives up and opens the game again
    await S.control("provider", { who: "hang" });
    await pressGo(g, '#gate .gateBtn[data-p="google"]');
    await g.wait(1500);
    await g.page.goto(SITE + "/");
    await gate(g, "signin");
    await line("Sign-in did not finish. Try again, or use another account.", "abandoned", "hanging provider");
    await fails0();
    // a sign-in that took over five minutes at the provider
    await pressGo(g, '#gate .gateBtn[data-p="google"]');
    await g.page.waitForURL(u => String(u).startsWith(API + "/provider/"), { timeout: 15000 });
    await S.control("authclock", { seconds: 400 });
    await g.page.click("#who-aram");
    await gate(g, "signin");
    await S.control("authclock", { seconds: 0 });
    await line("Sign-in took too long. Try again.", "bad_oauth_state", "over five minutes");
    await fails0();
    // a code left in the address with nothing under way, and an error after the #
    await g.page.goto(SITE + "/?code=00000000-0000-0000-0000-000000000000&hsh=nothing");
    await gate(g, "signin");
    await line("Sign-in did not finish here. Try again.", "no_verifier", "a code left in the address");
    await g.page.goto("about:blank");
    await g.page.goto(SITE + "/#error=server_error&error_code=unexpected_failure&error_description=x");
    await gate(g, "signin");
    await line("Sign-in did not finish. Try again, or use another account.", "unexpected_failure", "an error after the #");
    // two failures in a row: Play now, which plays
    if (!(await hasPlay())) fail(W, "no Play now after two failures in a row");
    await pressGo(g, () => Array.from(gateCardEl.querySelectorAll("button")).find(b => b.textContent === "Play now"));
    await plays(g, W + " Play now");
    const by = await evs(g, "gate_bypass");
    if (!by.some(x => x.why === "errors")) fail(W, "gate_bypass: " + JSON.stringify(by));
    // asked again on the next load; a sign-in that works counts the failures down to none
    await g.page.goto(SITE + "/");
    await gate(g, "signin");
    await signIn(g, "aram", "google", "name");
    await clean(g, W + " after the failures");
    const gm = JSON.parse(await store(g, "hs_pf_gate"));
    if (gm.fails !== 0) fail(W, "the failures were not counted down: " + JSON.stringify(gm));
    await done(g, W);
    // a device whose clock runs 15 minutes fast signs in (the verifier's age is read on the device's own clock)
    const gf = await open(C, { init: [[() => { const n = Date.now.bind(Date); Date.now = () => n() + 15 * 60000; }, null]] });
    await gate(gf, "signin");
    await signIn(gf, "nune", "google", "name");
    await clean(gf, W + " a fast clock");
    const ef = await evs(gf, "signin_error");
    if (ef.length || !(await store(gf, "hs_pf_auth"))) fail(W, "a clock 15 minutes fast cannot sign in: " + JSON.stringify(ef));
    await done(gf, W + " a fast clock");
  };

  // ================================================================ flow 11: Auth down, offline, storage blocked
  const flow11 = async (C) => {
    const W = "flow 11 " + C.name;
    await resetStack();
    // Auth answers 503: Sign-in is not answering; Play now; a battle; a battlefield won meanwhile
    await S.control("auth", { mode: "down" });
    let g = await open(C);
    await gate(g, "down");
    const dt = await cardText(g);
    if (!dt.includes("Sign-in is not answering. You can play now. Your progress stays on this device and joins your account the next time you sign in.")) fail(W, "the down card: " + dt);
    await audit(g, W + " down card", cardSpec(["#gate .gtGo"]), C.key === "desk" || C.key === "ses" || C.key === "i15u" ? "down-" + C.key : null);
    const gd = await evs(g, "gate_down");
    if (!gd.length || gd[0].why !== "http") fail(W, "gate_down: " + JSON.stringify(gd));
    await pressGo(g, "#gate .gtGo");
    if (await plays(g, W + " Auth down")) {
      if (PHOTOS && (C.key === "desk" || C.key === "ses")) await g.page.screenshot({ path: path.join(PHOTOS, "plays-auth-down-" + C.key + ".png") });
      // the battlefield won (as the game records a victory: its best wave and its record)
      await g.ev(() => { gameOver = true; localStorage.setItem(bestKey(0, LEVELS[0].era), "21"); storeRecord(0, { stars: [0, 2, 0], lives: [0, 15, 0], endless: [0, 0, 0] }); clearRun(); });
    }
    // a later visit with Auth up: sign in, and what he won is still his
    await S.control("auth", { mode: "up" });
    await g.page.goto(SITE + "/");
    await gate(g, "signin");
    await signIn(g, "aram", "google", "name");
    await g.page.fill("#gate .gtField", "Aram");
    await pressGo(g, "#gate .gtGo");
    await gate(g, "welcome");
    const kw = await cardText(g);
    if (!kw.includes("2 of 51 stars. 1 of 17 battlefields held.") || !/Continue: Vale of Tushpa/.test(kw)) fail(W, "after Auth came back: " + kw);
    // a signed-in player with Auth and the database both down: straight to his welcome card, and plays
    await S.control("auth", { mode: "down" }); await S.control("rest", { mode: "down" });
    await g.page.reload();
    await gate(g, "welcome", 15000);
    if (!(await cardText(g)).startsWith("Welcome back, Aram.")) fail(W, "signed in with the service down: " + await cardText(g));
    await pressGo(g, "#gate .gtQuiet:not(.gtGo)");
    await plays(g, W + " signed in, service down");
    // a player back after his access token ended (more than an hour), with Auth down: the session stays (1.4, 3.6's
    // fourth row), the welcome card, and the next load with Auth up refreshes it
    const expire = () => g.ev(() => { const s = JSON.parse(localStorage.getItem("hs_pf_auth")); s.exp = Math.floor(Date.now() / 1000) - 60; localStorage.setItem("hs_pf_auth", JSON.stringify(s)); });
    await expire();
    await g.page.reload();
    await gate(g, "welcome", 15000);
    if (!(await cardText(g)).startsWith("Welcome back, Aram.") || !(await store(g, "hs_pf_auth"))) fail(W, "an ended token with Auth down: " + await cardText(g));
    await S.control("auth", { mode: "up" }); await S.control("rest", { mode: "up" });
    await g.page.reload();
    await gate(g, "welcome");
    const rs = JSON.parse(await store(g, "hs_pf_auth") || "null");
    if (!rs || rs.exp - Math.floor(Date.now() / 1000) < 3000) fail(W, "the session kept through Auth down was not refreshed once Auth came back");
    // signed in, the token near its end, Auth and the database both hanging: the checking card is up 4 s at most
    // (3.1), then the welcome card from what the device remembers
    await g.ev(() => { const s = JSON.parse(localStorage.getItem("hs_pf_auth")); s.exp = Math.floor(Date.now() / 1000) + 30; localStorage.setItem("hs_pf_auth", JSON.stringify(s)); });
    await S.control("auth", { mode: "hang" }); await S.control("rest", { mode: "hang" });
    await g.page.reload();
    const tc = await g.ev(() => performance.now());
    await gate(g, "welcome", 20000);
    const tw = await g.ev(() => performance.now()), tb = await g.ev(() => pfT0);
    if (tw - tb > 5500) fail(W, "signed in with the service hanging, the checking card stayed " + ((tw - tb) / 1000).toFixed(1) + " s");
    log("  checking card with the service hanging: " + ((tw - tb) / 1000).toFixed(1) + " s (" + ((tw - tc) / 1000).toFixed(1) + " s after the load was seen)");
    await S.control("auth", { mode: "up" }); await S.control("rest", { mode: "up" });
    // and offline, the token ended: the session stays as well
    await expire();
    await S.control("auth", { mode: "down" }); await S.control("rest", { mode: "down" });
    await g.page.addInitScript(() => { Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false }); });
    await g.page.reload();
    await gate(g, "welcome", 15000);
    if (!(await cardText(g)).startsWith("Welcome back, Aram.") || !(await store(g, "hs_pf_auth"))) fail(W, "an ended token offline: " + await cardText(g));
    await S.control("auth", { mode: "up" }); await S.control("rest", { mode: "up" });
    await done(g, W + " Auth down");
    // Auth that never answers: the checking card for at most about 4 s, then down
    await S.control("auth", { mode: "hang" });
    g = await open(C);
    const tq = Date.now();
    await gate(g, "down", 20000);
    const waited = (Date.now() - tq) / 1000;
    if (waited > 8) fail(W, "a hanging Auth held the checking card " + waited.toFixed(1) + " s");
    const gd2 = await evs(g, "gate_down");
    if (!gd2.length || gd2[0].why !== "timeout") fail(W, "gate_down for a hanging Auth: " + JSON.stringify(gd2));
    await pressGo(g, "#gate .gtGo");
    await plays(g, W + " Auth hanging");
    await S.control("auth", { mode: "up" });
    await done(g, W + " Auth hanging");
    // offline
    g = await open(C, { offline: true });
    await gate(g, "down");
    if (!(await cardText(g)).includes("You are offline. You can play now.")) fail(W, "the offline card: " + await cardText(g));
    await pressGo(g, "#gate .gtGo");
    await plays(g, W + " offline");
    if (PHOTOS && (C.key === "desk" || C.key === "ses")) await g.page.screenshot({ path: path.join(PHOTOS, "plays-offline-" + C.key + ".png") });
    const by = await evs(g, "gate_bypass");
    if (!by.some(x => x.why === "offline")) fail(W, "gate_bypass offline: " + JSON.stringify(by));
    await done(g, W + " offline");
    // storage blocked: the no-site-data card, never a provider's button; Play now plays
    g = await open(C, { blocked: true });
    await gate(g, "nostore");
    const nt = await cardText(g);
    if (!nt.includes("This browser is not keeping this site's data, so a sign-in cannot be remembered here.") || (await buttons(g)).length) fail(W, "the nostore card: " + nt);
    await audit(g, W + " nostore card", cardSpec(["#gate .gtGo"]), "nostore-" + C.key);
    await pressGo(g, "#gate .gtGo");
    await gate(g, "");
    await toMap(g);
    await g.ev(() => openHall("account"));
    await g.page.waitForFunction(() => hallOpen, null, { timeout: 5000 });
    const acc = await g.ev(() => ({ text: hallBodyEl.innerText, btns: document.querySelectorAll(".gateBtn").length }));
    if (acc.btns || !acc.text.includes("This browser is not keeping this site's data")) fail(W, "the Account tab without site data: " + JSON.stringify(acc));
    await g.ev(() => closeHall());
    await plays(g, W + " storage blocked");
    if (PHOTOS && (C.key === "desk" || C.key === "ses")) await g.page.screenshot({ path: path.join(PHOTOS, "plays-nostore-" + C.key + ".png") });
    await done(g, W + " storage blocked");
  };

  // ================================================================ flow 10: analytics and the stats page
  // The events are counted only with the test's own switch (window.__HS_PLATFORM_TEST.events): a Playwright page is a
  // webdriver, and a webdriver counts nothing (7.3)
  const EVON = [[() => { window.__HS_PLATFORM_TEST = Object.assign(window.__HS_PLATFORM_TEST || {}, { events: true }); }, null]];
  // a page closed as a player closes it (its pagehide runs, so its last batch leaves with it), its errors read first
  const leave = async (g, where) => {
    const probs = await g.problems().catch(() => g.errs);
    for (const p of probs) fail(where, p);
    try { await g.page.close({ runBeforeUnload: true }); } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
    const bad = g.reqs.filter(u => !u.startsWith(SITE) && !u.startsWith(API));
    if (bad.length) fail(where, "requests outside the stack: " + [...new Set(bad)].slice(0, 4).join(", "));
    await g.close();
  };
  const who = (key, n) => ({ identity: { provider_id: "p4-" + key + "-" + n, email: "p4-" + key + "-" + n + "@example.com", verified: true, name: "P4 " + n } });
  const pressStats = async (g, sel) => { await g.ev(sel => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "center" }); }, sel); await g.frames(2); await pressGo(g, sel); };
  const statsUp = (g, ms = 40000) => g.page.waitForFunction(() => typeof stShell !== "undefined" && !$("statsPage").hidden && !stBusy && !/Counting/.test($("statsBody").innerText), null, { timeout: ms });
  // into the battle from the welcome card's Begin, through the chapter's story and the chronicle, as a player goes
  const toField = async (g, W) => {
    for (let k = 0; k < 8; k++) {
      if (await g.ev(() => battleLive())) return true;
      await g.ev(() => { const e = $("startBtn"); if (e) e.scrollIntoView({ block: "nearest" }); });
      await g.frames(2);
      const q = await g.reach("#startBtn");
      if (q.why) { await g.wait(250); continue; }
      await g.tapAt(q.x, q.y);
      await g.wait(400);
    }
    if (!(await g.ev(() => battleLive()))) { fail(W, "the battle did not begin from the welcome card: " + await g.ev(() => menuMode)); return false; }
    return true;
  };
  // the coach's Skip, as a player presses it (twice on a phone), the first wave sent and its field cleared, then the
  // last wave's field cleared as vic.js stages a victory
  const firstBattle = async (g, W) => {
    await g.page.waitForFunction(() => !!document.querySelector("#coach .cSkip") && document.querySelector("#coach .cSkip").getClientRects().length > 0, null, { timeout: 15000 });
    for (let k = 0; k < 2 && (await g.ev(() => !!tut)); k++) { await g.frames(4); const q = await g.reach("#coach .cSkip"); if (!q.why) await g.tapAt(q.x, q.y); await g.wait(300); }
    if (await g.ev(() => !!tut)) fail(W, "the coach's Skip did not end the tutorial");
    await g.ev(() => { if (!battle.started) startWave(); });
    await g.page.waitForFunction(() => battle.started, null, { timeout: 10000 });
    await g.ev(() => { spawnQueue = []; enemies = []; });
    await g.page.waitForFunction(() => (window.__hsEv || []).some(e => e[0] === "wave_end"), null, { timeout: 20000 });
    await g.ev(() => { lives = 17; waveIdx = TOTAL_WAVES; phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
    await g.page.waitForFunction(() => gameOver && (celebration || parley || menuMode === "victory"), null, { timeout: 15000 });
    if (await g.ev(() => !!celebration)) await g.ev(() => { celebration.start = performance.now() - DANCE_MAX_MS - 50; });
    await g.page.waitForFunction(() => menuMode === "victory", null, { timeout: 15000 });
  };
  const flow10 = async (C) => {
    const W = "flow 10 " + C.name;
    await resetStack();
    // --- a scripted first visit for each kind of device (3.2): two new devices, a returning player, an arrival in
    // another app's browser. What each does is known, so the funnel's every step has a known count
    const inUA = (C.ua || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36") + " Instagram 300.0.0.18.110";
    // A, new: signs in with Google, takes a name, begins Erebuni from the welcome card, skips the coach, clears a wave
    // and wins (as vic.js stages the win)
    const A = await open(C, { init: EVON });
    await gate(A, "signin");
    await A.wait(1100);
    await S.control("provider", who(C.key, "a"));
    await signIn(A, null, "google", "name");
    await A.page.fill("#gate .gtField", "Stats" + C.key + "A");
    await pressGo(A, "#gate .gtGo");
    await gate(A, "welcome");
    const begin = await cardText(A);
    if (!/Begin: Erebuni Rise/.test(begin)) fail(W, "A's welcome card: " + begin);
    await pressGo(A, "#gate .gtGo");
    await gate(A, "");
    const upright = C.w < C.h && C.w <= 500;
    if (upright) await A.page.setViewportSize({ width: C.h, height: C.w });
    if (await toField(A, W)) await firstBattle(A, W);
    if (upright) await A.page.setViewportSize({ width: C.w, height: C.h });
    const aEv = await A.ev(() => (window.__hsEv || []).map(e => e[0]));
    // (this load is the one back from the provider: the gate's first events were the load before, and the server
    // counts those below)
    for (const n of ["page_load", "signed_in", "name_set", "gate_passed", "welcome_tap", "chapter_story", "brief_open", "battle_start", "tutorial_step", "tutorial_done", "wave_end", "victory"])
      if (!aEv.includes(n)) fail(W, "A's visit lacks " + n + ": " + aEv.join(","));
    const aUid = await A.ev(() => JSON.parse(localStorage.getItem("hs_pf_auth")).uid);
    // B, new: sees the sign-in card and leaves
    const B = await open(C, { init: EVON });
    await gate(B, "signin");
    await B.wait(1300);
    // R, returning: a player of before (Erebuni won on this device) signs in with Discord and takes a name
    const Rt = await open(C, { init: EVON, storage: { hs_best_erebuni_0: "21" } });
    await gate(Rt, "signin");
    await Rt.wait(1100);
    await S.control("provider", who(C.key, "r"));
    await signIn(Rt, null, "discord", "name");
    await Rt.page.fill("#gate .gtField", "Stats" + C.key + "R");
    await pressGo(Rt, "#gate .gtGo");
    await gate(Rt, "welcome");
    // I, another app's browser: signs in with Facebook and leaves at the name card
    const I = await open(C, { init: EVON, ua: inUA });
    await gate(I, "signin");
    await I.wait(1100);
    if ((await buttons(I)).includes("google")) fail(W, "the in-app browser shows Google");
    await S.control("provider", who(C.key, "i"));
    await signIn(I, null, "facebook", "name");
    // every page leaves (its queue goes with it, keepalive)
    for (const g of [B, I]) await leave(g, W + " funnel visit");
    const want = { page_load: [4, 2, 1, 1], gate_shown: [4, 2, 1, 1], provider_tapped: [3, 1, 1, 1], signed_in: [3, 1, 1, 1], name_set: [2, 1, 1, 0],
      battle_start: [1, 1, 0, 0], tutorial_done: [1, 1, 0, 0], wave_end: [1, 1, 0, 0], victory: [1, 1, 0, 0] };
    // A is made the owner, and opens ?stats in the same browser (no new device)
    await S.control("admin", { user_id: aUid });
    await A.page.goto(SITE + "/?stats");
    // the server holds them all once the pages' last batches are in (A's leave with its page, Rt's on its timer or now)
    await Rt.ev(() => pfEvNow());
    let s = null;
    for (let k = 0; k < 60; k++) {
      const rows = await S.query(`select count(*)::int n from public.hs_events where name = 'page_hide'`);
      if (rows[0].n >= 3) break;
      await new Promise(r => setTimeout(r, 500));
    }
    await statsUp(A);
    await A.wait(300);
    const seen = await A.ev(() => {
      const o = {};
      for (const k of document.querySelectorAll("#statsPage .stKind")) for (const b of k.querySelectorAll(".stBar[data-step]")) (o[b.dataset.step] = o[b.dataset.step] || {})[k.dataset.kind] = Number(b.dataset.n);
      return o;
    });
    s = await A.ev(() => stData && stData.funnel);
    const got = {};
    for (const x of s || []) got[x.step] = [x.n, x.new, x.returning, x.inapp];
    if (JSON.stringify(got) !== JSON.stringify(want)) fail(W, "the funnel the server counts: " + JSON.stringify(got) + ", not " + JSON.stringify(want));
    const shown = {};
    for (const k in want) shown[k] = [want[k][0], ...(["new", "returning", "inapp"].map(kind => seen[k] ? seen[k][kind] : null))];
    if (JSON.stringify(shown) !== JSON.stringify(want)) fail(W, "the funnel the page shows: " + JSON.stringify(seen));
    notes.flows["funnel@" + C.key] = got.page_load ? got.page_load.join("/") + " .. " + (got.victory || []).join("/") : "none";
    // what each visit said of its device (p_ctx)
    const ctxs = await S.query("select distinct dev_class, os, browser, standalone, channel from public.hs_sessions where channel = 'live'");
    const dev = C.key === "desk" ? "desktop" : C.key === "ipad" ? "tablet" : "phone";
    if (!ctxs.some(r => r.dev_class === dev)) fail(W, "no visit was counted as a " + dev + ": " + JSON.stringify(ctxs));
    if (!ctxs.some(r => r.browser === "inapp")) fail(W, "the in-app visit was not counted as one: " + JSON.stringify(ctxs));
    if (C.standalone && !ctxs.some(r => r.standalone === true)) fail(W, "the Home Screen app was not counted as one");
    // the stats page's cards, every one there and drawn as text
    const cards = await A.ev(() => Array.from(document.querySelectorAll("#statsPage .stCard h2")).map(h => h.textContent));
    for (const t of ["Health", "Totals", "First visit funnel", "The gate", "Coming back", "Where players quit", "Battlefields", "Devices", "Switches"])
      if (!cards.includes(t)) fail(W, "the stats page lacks its card " + t + ": " + cards.join(", "));
    await audit(A, W + " stats page", { root: "#statsPage", parts: ["#statsPage .stWrap"], primary: ["#statsBack"], primaryRequired: true, scroll: "page" }, null);
    if (PHOTOS) await A.page.screenshot({ path: path.join(PHOTOS, "stats-" + C.key + "-1-top.png") });
    if (PHOTOS && (C.key === "desk" || C.key === "ipad")) {
      for (const [i, h] of [[2, "First visit funnel"], [3, "The gate"], [4, "Battlefields"], [5, "Switches"]]) {
        await A.ev(h => { const c = Array.from(document.querySelectorAll("#statsPage .stCard")).find(x => x.querySelector("h2").textContent === h); if (c) c.scrollIntoView({ block: "start" }); }, h);
        await A.frames(2);
        await A.page.screenshot({ path: path.join(PHOTOS, "stats-" + C.key + "-" + i + "-" + h.toLowerCase().replace(/\W+/g, "-") + ".png") });
      }
    }
    await leave(Rt, W + " returning");
    if (C.key !== "desk") { await done(A, W + " owner"); return; }
    // --- (the desktop only from here) a player is refused; a visitor gets the sign-in line, and the sign-in comes back to ?stats
    const P = await open(C, { init: EVON });
    await gate(P, "signin");
    await P.page.goto(SITE + "/?stats");
    await statsUp(P);
    const ps = await P.ev(() => ({ text: $("statsBody").innerText, btns: Array.from(document.querySelectorAll("#statsPage .gateBtn")).map(b => b.dataset.p), gate: gateUp }));
    if (!/Sign in with the owner's account/.test(ps.text) || ps.btns.join() !== "google,facebook,discord" || ps.gate) fail(W, "?stats for a visitor: " + JSON.stringify(ps));
    if (PHOTOS) await P.page.screenshot({ path: path.join(PHOTOS, "stats-desk-signin.png") });
    await S.control("provider", who(C.key, "p"));
    await pressStats(P, '#statsPage .gateBtn[data-p="google"]');
    await P.page.waitForFunction(() => typeof stShell !== "undefined" && document.readyState === "complete" && !$("statsPage").hidden && /owner/.test($("statsBody").innerText), null, { timeout: 30000 });
    await clean(P, W + " stats sign-in");
    const pr = await P.ev(() => ({ text: $("statsBody").innerText, search: location.search, gate: gateUp }));
    if (!/This page is for the game's owner\./.test(pr.text) || !/^\?stats=?$/.test(pr.search) || pr.gate) fail(W, "?stats for a player: " + JSON.stringify(pr));
    if (PHOTOS) await P.page.screenshot({ path: path.join(PHOTOS, "stats-desk-player.png") });
    await leave(P, W + " player");
    // --- hostile events, sent as a stranger can: straight to hs_track with the public key
    const post = async (body, bearer) => {
      const r = await fetch(API + "/rest/v1/rpc/hs_track", { method: "POST", headers: { apikey: S.anonKey, Authorization: "Bearer " + (bearer || S.anonKey), "Content-Type": "application/json" }, body: JSON.stringify(body) });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, body: j };
    };
    const HX = "<img src=x onerror=\"window.__xss=1\">", hctx = (aid, sid, more) => Object.assign({ aid, sid, channel: "live", dev: "<b>phone</b>", os: HX, browser: "\"><script>window.__xss=2</script>", vw: "wide", standalone: "yes" }, more || {});
    const H1 = "f1000000-0000-4000-8000-000000000001", H2 = "f1000000-0000-4000-8000-000000000002", H3 = "f1000000-0000-4000-8000-000000000003";
    const hostile = [];
    hostile.push(["markup and text where numbers belong", await post({ p_ctx: hctx(H1, "evil-0001-aaaa"), p_events: [
      { n: "page_load", q: 1, t: "now", p: { progress: "lots", gate: HX } }, { n: "gate_shown", q: 2, p: { state: HX, providers: HX } },
      { n: "provider_tapped", q: 3, p: { provider: HX } }, { n: "signin_error", q: 4, p: { provider: "google", error: HX } },
      { n: "gate_bypass", q: 5, p: { why: "<svg onload=window.__xss=3>" } },
      { n: "victory", q: 6, p: { lv: HX, diff: "hard", mode: HX, lives: "many", lives_max: {}, wave: [1], waves: "x" } },
      { n: "defeat", q: 7, p: { lv: "erebuni", diff: "1; drop table hs_events", wave: "1e9", lives: -5, lives_max: 0 } },
      { n: "battle_quit", q: 8, p: { lv: "javascript:alert(1)", diff: 1, wave: 2 } }] })]);
    hostile.push(["an event over 4,096 bytes", await post({ p_ctx: hctx(H1, "evil-0001-aaaa"), p_events: [{ n: "victory", q: 9, p: { lv: "erebuni", pad: "x".repeat(5000) } }] })]);
    hostile.push(["props nested two levels and deeper", await post({ p_ctx: hctx(H1, "evil-0001-aaaa"), p_events: [{ n: "victory", q: 10, p: { a: { b: { c: { d: 1 } } } } },
      { n: "victory", q: 11, p: { l: [[[[1]]]] } }] })]);
    hostile.push(["wrong types", await post({ p_ctx: hctx(H1, "evil-0001-aaaa"), p_events: [{ n: 42, q: 12 }, "page_load", null, [1, 2], { n: "wave_end", q: "twelve", t: { x: 1 }, p: "props" },
      { n: "wave_end", q: 13, p: [1, 2, 3] }, { n: "WAVE END", q: 14 }, { n: "wave_end", q: 15, p: true }] })]);
    hostile.push(["p_events that is not a list", await post({ p_ctx: hctx(H1, "evil-0001-aaaa"), p_events: { n: "page_load" } })]);
    hostile.push(["a forged user id in p_ctx", await post({ p_ctx: hctx(H2, "evil-0002-aaaa", { uid: aUid, user_id: aUid }), p_events: [{ n: "signed_in", q: 1, p: { provider: "google", user_id: aUid } }] })]);
    hostile.push(["a forged token", await post({ p_ctx: hctx(H2, "evil-0003-aaaa"), p_events: [{ n: "page_load", q: 1 }] },
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: aUid, role: "authenticated", exp: 4102444800 })).toString("base64url") + ".forged")]);
    hostile.push(["another device's visit id", await post({ p_ctx: hctx(H3, "evil-0001-aaaa"), p_events: [{ n: "page_load", q: 99 }] })]);
    let flood = 0;
    for (let i = 0; i < 24; i++) { const r = await post({ p_ctx: hctx(H3, "evil-0004-flood"), p_events: Array.from({ length: 50 }, (_, j) => ({ n: "tower_built", q: i * 50 + j + 1 })) }); flood += (r.body && r.body.accepted) || 0; }
    hostile.push(["a flood of 1,200 events from one device", { status: 200, body: { accepted: flood } }]);
    const hres = Object.fromEntries(hostile.map(([k, r]) => [k, r.status + " " + JSON.stringify(r.body).slice(0, 80)]));
    log("  hostile: " + JSON.stringify(hres));
    notes.hostile = hres;
    const H = (k) => hostile.find(x => x[0] === k)[1];
    if (H("markup and text where numbers belong").body.accepted !== 8) fail(W, "the hostile batch: " + hres["markup and text where numbers belong"]);
    if (H("an event over 4,096 bytes").body.accepted !== 0 || H("props nested two levels and deeper").body.accepted !== 0) fail(W, "an oversize or deep event was kept");
    if (H("wrong types").body.accepted !== 0) fail(W, "events of the wrong types were kept: " + hres["wrong types"]);
    if (H("p_events that is not a list").status !== 400) fail(W, "p_events not a list: " + hres["p_events that is not a list"]);
    if (H("a forged token").status !== 401) fail(W, "a forged token was taken: " + hres["a forged token"]);
    if (H("another device's visit id").status !== 400) fail(W, "a borrowed visit id was taken: " + hres["another device's visit id"]);
    if (flood !== 900) fail(W, "one device's flood: " + flood + " kept, not 900");
    const forged = await S.query("select sid, uid::text from public.hs_sessions where sid in ('evil-0002-aaaa', 'evil-0003-aaaa')");
    if (forged.some(r => r.uid !== null)) fail(W, "a forged user id joined a visit to an account: " + JSON.stringify(forged));
    // the owner's page with them in the table: it still answers, nothing of theirs is markup, and they show as "other"
    await A.ev(() => pfStatsLoad());
    await statsUp(A);
    const safe = await A.ev(() => {
      const root = $("statsPage"), bad = [];
      for (const e of root.querySelectorAll("*")) {
        if (/^(IMG|SCRIPT|SVG|IFRAME|OBJECT|EMBED|U|I|B)$/i.test(e.tagName)) bad.push(e.tagName);
        for (const a of e.attributes) if (/^on/i.test(a.name) || /javascript:/i.test(a.value)) bad.push(e.tagName + " " + a.name);
      }
      return { bad, xss: window.__xss || 0, other: /other/.test(root.innerText), cards: root.querySelectorAll(".stCard").length, text: root.innerText.includes("<img") };
    });
    if (safe.bad.length || safe.xss || !safe.other || safe.cards < 9) fail(W, "the stats with hostile events in the table: " + JSON.stringify(safe));
    if (PHOTOS) {
      await A.ev(() => { const c = Array.from(document.querySelectorAll("#statsPage .stCard")).find(x => x.querySelector("h2").textContent === "The gate"); if (c) c.scrollIntoView({ block: "start" }); });
      await A.frames(2);
      await A.page.screenshot({ path: path.join(PHOTOS, "stats-desk-hostile-gate.png") });
    }
    // the period switch asks again for 7 days
    await pressStats(A, "#statsTools .stDay");
    await statsUp(A);
    if ((await A.ev(() => stDays)) !== 7) fail(W, "the period switch did not take 7 days");
    // --- Discord held back while the sign-in service confirms emails by itself: the Health card says why, and a
    // fresh visitor has no Discord button
    await S.control("settings", { mailer_autoconfirm: true });
    await A.ev(() => pfStatsLoad());
    await statsUp(A);
    const hl = await A.ev(() => Array.from(document.querySelectorAll("#statsPage .stCard")).find(x => x.querySelector("h2").textContent === "Health").innerText);
    if (!/Discord sign-in is held back: the sign-in service confirms emails by itself\. See the guide, step 3\./.test(hl)) fail(W, "the Health card with autoconfirm on: " + hl);
    if (PHOTOS) { await A.ev(() => $("statsPage").scrollTo(0, 0)); await A.frames(2); await A.page.screenshot({ path: path.join(PHOTOS, "stats-desk-health-autoconfirm.png") }); }
    const D = await open(C, { init: EVON });
    await gate(D, "signin");
    if ((await buttons(D)).includes("discord")) fail(W, "a Discord button with autoconfirm on");
    await leave(D, W + " autoconfirm");
    await S.control("settings", { mailer_autoconfirm: false });
    // --- the switches: the gate set to optional from the page; a fresh visitor then has Play as a guest
    await A.ev(() => pfStatsLoad());
    await statsUp(A);
    await pressStats(A, '#statsPage .stGate[data-mode="optional"]');
    await A.page.waitForFunction(() => !stBusy && stData && stData.config && stData.config.gate === "optional", null, { timeout: 20000 });
    const G = await open(C, { init: EVON });
    await gate(G, "signin");
    const gt = await cardText(G);
    if (!/Play as a guest/.test(gt)) fail(W, "the gate set to optional: a fresh visitor's card is " + gt);
    await pressGo(G, "#gate .gtQuiet:not(.gtGo)");
    await gate(G, "");
    await leave(G, W + " optional");
    // the owner's line, and back to required
    await A.page.fill('#statsPage .stField[data-key="notice"]', "Back at six.");
    await pressStats(A, '#statsPage .stField[data-key="notice"] + .btn');
    await A.page.waitForFunction(() => !stBusy && stData && stData.config && stData.config.notice === "Back at six.", null, { timeout: 20000 });
    await pressStats(A, '#statsPage .stGate[data-mode="required"]');
    await A.page.waitForFunction(() => !stBusy && stData && stData.config && stData.config.gate === "required", null, { timeout: 20000 });
    // Remove old events
    await pressStats(A, "#statsPage .stPurge");
    await A.page.waitForFunction(() => /Removed \d+ visits\./.test($("statsBody").innerText), null, { timeout: 20000 }).catch(() => fail(W, "Remove old events said nothing"));
    await done(A, W + " owner");
    // --- nothing is sent from a webdriver without the switch, on file://, or with the constants empty
    const before = (await S.query("select count(*)::int n from public.hs_events"))[0].n;
    const logs = {};
    const Q = await open(C);
    await gate(Q, "signin");
    await Q.wait(1500);
    await Q.ev(() => { track("tower_built", {}); for (let i = 0; i < 25; i++) track("map_open", { i }); });
    await Q.wait(500);
    logs.webdriver = Q.reqs.slice();
    if (Q.reqs.some(u => /hs_track/.test(u))) fail(W, "a webdriver without the switch sent events");
    const qState = await Q.ev(() => ({ queue: !!pfEvQ, kick: typeof window.__hsEvKick, barred: pfEvBarred(), store: localStorage.getItem("hs_pf_evq") }));
    if (qState.queue || qState.kick !== "undefined" || qState.store) fail(W, "a webdriver's queue: " + JSON.stringify(qState));
    await leave(Q, W + " webdriver");
    await new Promise(r => setTimeout(r, 800));
    const afterQ = (await S.query("select count(*)::int n from public.hs_events"))[0].n;
    if (afterQ !== before) fail(W, "events reached the server from a webdriver without the switch (" + before + " to " + afterQ + ")");
    // a prerender (the switch on): no queue while it is one; it begins once the page is shown
    const PR = await open(C, { init: EVON.concat([[() => { window.__pre = true; Object.defineProperty(Document.prototype, "prerendering", { configurable: true, get: () => window.__pre === true }); }, null]]) });
    await gate(PR, "signin");
    await PR.wait(1200);
    const pr0 = await PR.ev(() => ({ q: !!pfEvQ, kick: typeof window.__hsEvKick }));
    await PR.ev(() => { window.__pre = false; document.dispatchEvent(new Event("prerenderingchange")); });
    await PR.wait(300);
    const pr1 = await PR.ev(() => ({ q: !!pfEvQ, n: pfEvQ ? pfEvQ.list.map(e => e.n) : [] }));
    if (pr0.q || pr0.kick !== "undefined" || !pr1.q || !pr1.n.includes("page_load") || !pr1.n.includes("gate_shown")) fail(W, "a prerender: " + JSON.stringify({ pr0, pr1 }));
    logs.prerender = PR.reqs.slice();
    await leave(PR, W + " prerender");
    const before2 = (await S.query("select count(*)::int n from public.hs_events"))[0].n;
    // file:// with the constants filled and the switch on: the platform is off there
    const fctx = await browser.newContext({ viewport: { width: C.w, height: C.h } });
    await fctx.addInitScript(EVON[0][0]);
    const fp = await fctx.newPage();
    const freqs = [];
    fp.on("request", r => freqs.push(r.url()));
    await fp.goto("file://" + path.join(dir, "index.html"), { timeout: 120000 });
    await fp.waitForTimeout(2500);
    await fp.evaluate(() => { for (let i = 0; i < 25; i++) track("map_open", { i }); });
    await fp.waitForTimeout(500);
    const fst = await fp.evaluate(() => ({ on: PF_ON, gate: gateUp, kick: typeof window.__hsEvKick, q: (window.__hsEv || []).length }));
    await fp.close({ runBeforeUnload: true }).catch(() => {});
    await fctx.close();
    logs.file = freqs.slice();
    if (freqs.some(u => !u.startsWith("file:") && !/^(data|blob):/.test(u)) || fst.on || fst.gate || fst.kick !== "undefined") fail(W, "file:// sent or started something: " + JSON.stringify({ fst, freqs: freqs.filter(u => !u.startsWith("file:")) }));
    // the page as committed (both constants empty), served over http, the switch on
    const http = require("http");
    const plain = http.createServer((q, s2) => { s2.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); s2.end(src); });
    await new Promise(r => plain.listen(0, "127.0.0.1", r));
    const PLAIN = "http://127.0.0.1:" + plain.address().port;
    const ectx = await browser.newContext({ viewport: { width: C.w, height: C.h } });
    await ectx.addInitScript(EVON[0][0]);
    const ep = await ectx.newPage();
    const ereqs = [];
    ep.on("request", r => ereqs.push(r.url()));
    await ep.goto(PLAIN + "/?stats", { timeout: 120000 });
    await ep.waitForTimeout(2500);
    const est = await ep.evaluate(() => ({ on: PF_ON, gate: gateUp, kick: typeof window.__hsEvKick, stats: $("statsPage").hidden ? "" : $("statsBody").innerText.replace(/\s+/g, " ") }));
    if (PHOTOS) await ep.screenshot({ path: path.join(PHOTOS, "stats-desk-off.png") });
    await ep.goto(PLAIN + "/", { timeout: 120000 });
    await ep.waitForTimeout(2500);
    await ep.evaluate(() => { for (let i = 0; i < 25; i++) track("map_open", { i }); });
    await ep.waitForTimeout(500);
    await ep.close({ runBeforeUnload: true }).catch(() => {});
    await ectx.close();
    await new Promise(r => plain.close(r));
    logs.empty = ereqs.slice();
    if (ereqs.some(u => !u.startsWith(PLAIN + "/") && !/^(data|blob):/.test(u)) || est.on || est.gate || est.kick !== "undefined") fail(W, "the page with its constants empty sent or started something: " + JSON.stringify({ est, reqs: ereqs.filter(u => !u.startsWith(PLAIN)) }));
    if (!/the platform is off/.test(est.stats) || !/Supabase address and its public key are not set/.test(est.stats)) fail(W, "?stats with the platform off: " + est.stats);
    await new Promise(r => setTimeout(r, 1000));
    const after = (await S.query("select count(*)::int n from public.hs_events"))[0].n;
    if (after !== before2) fail(W, "events reached the server from a page that should send none (" + before2 + " to " + after + ")");
    const strip = (l) => l.map(u => u.replace(SITE, "SITE").replace(API, "API").replace(PLAIN, "PLAIN").replace(/^file:\/\/.*index\.html/, "file://.../index.html"));
    notes.quiet = { webdriver: strip(logs.webdriver), prerender: strip(logs.prerender), file: strip(logs.file), empty: strip(logs.empty), webdriverEventsBefore: before, webdriverEventsAfter: afterQ, eventsBefore: before2, eventsAfter: after };
    if (PHOTOS) fs.writeFileSync(path.join(PHOTOS, "requests-quiet.json"), JSON.stringify(notes.quiet, null, 2));
  };

  const FLOW = { 1: flow1, 2: flow2, 3: flow3, 10: flow10, 11: flow11 };
  try {
    for (const C of RUN) {
      for (const f of FLOWS) {
        if (!FLOW[f]) { fail("flows", "no flow " + f); continue; }
        const t = Date.now(), n = fails.length;
        console.log("flow " + f + " at " + C.name + " ...");
        try { await FLOW[f](C); } catch (e) { fail("flow " + f + " " + C.name, "stopped: " + (e && e.message || e).split("\n")[0]); }
        notes.flows[f + "@" + C.key] = (fails.length === n ? "pass" : "fail") + " " + ((Date.now() - t) / 1000).toFixed(0) + "s";
        console.log("  " + (fails.length === n ? "pass" : "FAIL") + " in " + ((Date.now() - t) / 1000).toFixed(0) + " s");
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await S.stop().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
  notes.addresses = [...new Set(notes.addresses)];
  R.finish("platform", fails, notes, t0);
})().catch(e => { console.log("FAIL platform: " + (e && e.stack || e)); process.exit(1); });
