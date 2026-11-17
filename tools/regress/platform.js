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
// The flows built so far (work package P2: sign-in and the gate; P3: cloud saves; P4: analytics and the stats page;
// P5: scores and boards; P6: the daily challenge; P7: the share card; P8: privacy, deletion and staging; P10: the
// superadmin's Players view):
//   1  the gate: a fresh visitor gets the sign-in card and nothing of the game answers a tap or a key; the three
//      buttons in order; the privacy link and back (the page's every part, its #delete part, no long dash, no sound;
//      ?privacy#delete opens at that part, and its second way back at the end); a provider the server switched off has no button; Discord held
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
//      stats page shows, step by step and kind by kind; the sign-in's events on the server within 8 s of it, from a
//      visit that carries the account while the visit before stays a visitor's, one sign-in per provider on the gate
//      card; a hidden page's batch sent with keepalive; p_ctx's device words; every R1 card drawn; ?stats for a
//      visitor (the sign-in line, and its return to ?stats) and for a player ("This page is for the game's owner."),
//      and neither that sign-in on ?stats nor a privacy page's reader moves the funnel or the gate card;
//      hostile events straight to hs_track (markup and text where numbers belong, over 4,096 bytes, nested too deep,
//      wrong types, a forged user id and a forged token, a borrowed visit id, a flood from one device): the server's
//      answers, and the owner's page still answers with nothing of theirs made into markup; the period switch; Discord
//      held back with the Health card's line; the gate switched to optional from the page (a fresh visitor gets Play
//      as a guest), the owner's line, back to required, the daily's switch Off and On again (the server holding each),
//      each switch answering on its own line (a value the page or the
//      server refuses, and a failed save, put the field back); Remove old events. Then nothing is sent from a
//      webdriver with an ordinary browser's user agent, from a robot's user agent, without the switch (and neither
//      keeps an anonymous id, nor does a prerender until shown), on file://, or by the page as committed (its constants empty), each with its request log
//      (requests-quiet.json with --photos), and the server's count of events does not move. The owner's part from
//      the visitor's ?stats on runs on the desktop only
//   4  play and save: a new player begins Erebuni from the welcome card, skips the coach and holds the first wave: the
//      server's save holds that battle at once (its device and time); a change in battle, then the page closed:
//      the change goes with the page (keepalive), as one write (a change waits to be sent at the close, a write
//      reaches the stack after it, and a run where every close fell back to the next load fails). On the desktop
//      and at 667x320 also: the close's write sent while another write is out, after another device wrote the
//      version that write expects, does not take that device's place (the stack holds the first write a while)
//   5  a second device: the same person signs in elsewhere, "Resume: Erebuni Rise, Wave 3", and resumes it there.
//      Both play other battles with the database down and come back: the second to come back is asked ("Two
//      battles in progress", both battles in words, the two buttons, "The other one is dropped."); "Keep this
//      device's battle" keeps it, and the other device then takes it without a question (the choice wins
//      everywhere); a battle played offline and still on the field goes up when the device is online again, and
//      the other device, asked, takes it ("Take the other device's battle"); a battle this build cannot fight is
//      not adopted by a device with none, and the cloud keeps it for the device that can. On the desktop and at
//      667x320 also: a battle's end on one device ends that battle only (the mark names it): the other device's
//      own battle stays with no word of a battle finished, and goes back up; the same battle finished elsewhere
//      still ends there, with its words; two battles with no welcome card to ask (the gate off, the profile's or
//      the save's answer late): nobody is asked, the battle stays, and the saves go on
//   6  a guest's progress: the keys of a player of the live game who has won five battlefields, with a battle in
//      progress from tools/fixtures, signed in to a new account: "now saved to your account", the server's save is
//      the device's synced keys whole and the battle as the live game saved it, nothing unsynced uploaded; a second
//      device signing in gets every key back exactly; a third device with progress of its own joins: "joined with
//      your account", the best of both (records, best waves, chapters), a Council tier taken on the first device and
//      a hero's experience on the third both kept, and the first device seen again has the third's progress too
//   13 sign out: the sync line "Saved to your account just now.", and "Waiting for a connection..." while the
//      database is down; sign-out then asks "Your latest progress could not be saved yet. Sign out anyway?"; "Sign out
//      anyway" clears the device and keeps the unsent progress in hs_pf_stash for that account, which joins his save
//      at his next sign-in here; sign-out with a connection ends the server's session and clears the device, and the
//      account keeps everything ("Delete my account" is work package P8's). On the desktop and at 667x320 also:
//      the stash, when this account signs in again and a battle begins before it joins, waits for the battle's
//      end and loses nothing; sign-out after a load that could not reach the save takes the account's progress off
//      the device (asked first), the unsent part kept in the stash. Then "Delete my account" (P8, 1.5, RULINGS S10): the
//      question's words and its focus on Keep my account; Keep changes nothing; with the database down nothing is
//      deleted and the tab says so (desktop and 667x320); Delete everything removes every row of that player in
//      highland (an admin's row too) and none of another player's, leaves auth.users and its identities, clears the
//      device (progress, session, stash, the account in hs_pf_cfg), replaces the anonymous id, returns to the gate
//      with its line; account_deleted reaches the server as a visitor's on the new id, nothing of the account comes
//      back, and the same person signing in again is asked for a name. With the call cut off (desktop and 667x320)
//      the words say there is no connection; with the server's answer lost after it deleted (desktop) they say it may
//      be done, and the retry is safe. Deleted elsewhere (desktop and 667x320): another device still signed in, and a
//      second tab of the same browser, forget the account too, say so on the gate, and bring none of it back
//   7  scores and boards (P5): a player with five battlefields, made an admin; the map's door (#hallBtn) 10 px right of
//      the tally, uncovered (held sideways the tally is the door); a ranked battle before the ruleset is published
//      ("The boards for this version open soon", the page's score equal to ref.js's) and the admin's toast on the map;
//      Publish ruleset 2 on the stats page's Rulesets card (the server then has it); ranked battles won as vic.js wins
//      one, their clock and gold set as a real battle's would stand and the run's start moved back by the stack's
//      control: the server's score equal to the page's and ref.js's, "#1 of 1 this week", score_posted, the tooltip;
//      Leaderboard opens the Hall on that battlefield, Normal, This week, Standard, the player's row tinted with
//      "17/20" and the clock, the words under it; All time, Open, Hard and the battlefield's arrows; a second player's
//      lower score "#2 of 2", an open battle (a gift of gold) "· Open" and on the Open board only; a best beaten
//      ("· your best"); the server down at the battle's end ("It posts when you are back online", the outbox, sent on
//      online); a battle begun with the server down ("Not ranked: this battle began offline"); a result the server
//      refuses ("Not ranked", score_rejected); test mode (no strip); a guest under the optional gate ("Sign in to post
//      it", the Account tab; the board to read with the three buttons; no connection and Try again); Scores to look
//      at (a fast result listed, Remove); the boards switched off (no strip, no run begun). The strip and the tab held
//      to the iPhone suite's audit on the phones; photos of each state (--photos: a folder p5)
//   8  the daily challenge (P6): a player with five battlefields and the page's ruleset published; the page's pick
//      (gameplay's dailyPick and the platform's dailyOf) equal to the server's _daily_pick for 366 days from today,
//      skip lists included, and Platform.daily() to hs_daily_status; the welcome card's "Today's challenge" opens the
//      Hall on the Daily tab (hall_open from "welcome"), the tab's words (the day, the battlefield, the twist, the rules,
//      the attempts, Play, the time to the next, one sitting, the empty board), its badge and the map's dot, gameplay's
//      map door leading to the tab; three attempts, each told at its first wave: won and posted (the server's score the
//      page's and ref.js's, "#1 of 1 today", no stars on the event, Share and the card's words of 5.6, daily_played),
//      lost and scored by the waves held (the strip on the daily's end page, no Share), a third by Fight again; the
//      fourth practice ("Practice: not ranked", nothing spent on the server); the tab with no attempt left (Practice);
//      a second player's lower score "#2 of 2 today" (desktop and 667x320); the day changed by the stack's clock set
//      to 8 s before midnight UTC, the tab left open and turned by the page's own timer: the next challenge, the
//      attempts back, the board empty, "Yesterday: 1. ..." and yesterday's battle. Then (desktop and 667x320) the
//      owner's daily switch off (the server's daily_off at the first wave makes it practice; the tab's Practice and its
//      note, no badge), a newer ruleset published under the chronicle (daily_mismatch: practice; the tab's "Reload"),
//      the database down (Platform.daily() still today's from the page's own lines, the board's "needs a connection",
//      a daily begun is practice, "no connection"), a guest under the optional gate (Practice beside the sign-in
//      buttons, said once, no "One sitting", his first wave's word, no run, daily_played not ranked, his page's turn of
//      the day) and a player with no name ("Later" after two failed saves: the tab's note, no badge, practice), none of
//      them spending an attempt. The tab and the pages held to the iPhone suite's audit; photos in p6 (--photos)
//   9  the share card (P7): a player wins Ani (a short name) and Sis (the longest title, after its Terms card), a guest
//      under the optional gate Erebuni Rise; each picture read back (a JPEG of 1200 x 630, the field copied, its words:
//      title, Armenian name, stars, defenders, rank, name; the guest's with neither name nor rank); with navigator.share
//      and canShare stubbed the tap shares that file (highland-stand-<id>.jpg) with words carrying the score, a cancel
//      is no error, a refusal opens the sheet; without them the sheet (#shareSheet): Save picture a real download of
//      the same bytes, Copy picture a PNG, Copy text the words, each with its toast over the sheet and its event; Share
//      link where navigator.share takes no file; Escape or its X closes it; held sideways the round #shareBtn at the
//      top right (or Settings' row when a long title hides it); no request for the picture; the card gone with its
//      page. The victory page and the sheet held to the iPhone suite's audit; photos and the pictures themselves in
//      p7 (--photos); at 1600x900 also a daily's card, staged
//   14 staging: the page at /next/ signs in and comes back to /next/, saves on the channel "next" only, keeps its keys
//      under "next:"; the page at / in the same browser has no session and none of that progress, and signed in
//      there has its own save; /next/ again has its session and its progress
//   15 the superadmin's Players view (P10): thirty players made through the game's own functions and an outsider of
//      another app; the owner signs in on ?stats (closed to him), is made superadmin by the owner's command run as
//      postgres on the stack's own connection, and gets the tabs Numbers and Players; the list shows 25 of the 30
//      with every column (the time columns' help says where each comes from), each player's email and the
//      provider's name, and neither the outsider nor the owner (no player); sorted by name both ways and by battle
//      clock; searched by email, by the provider's name, and for the outsider (nothing); the second page and back;
//      a player's page with its seven parts; one audit row a read, all the superadmin's, the grant there too, no
//      address or search words in it; nothing of it in the device's storage; after the revoke the page is closed
//      again, and as an admin who is not super there is no tab, no email, and the list by hand answers not_superadmin
// At every size the sign-in, name, welcome and Account cards are held to the iPhone suite's audit (every control
// on screen, out of the safe areas, 44 px to a finger, text at least 11 px, nothing covered) and, with --photos,
// photographed (and the privacy page, ?privacy#delete, and the deletion's question, failure and end). Every request
// must go to the stack's two ports; any page error or console error fails. Flow 10 also opens ?privacy#delete on the
// page as committed (the platform off): shown from the page itself, with no request.
// --quick: flows 1, 2, 4, 5, 7 and 11 (spec 10.5) at 1600x900 and 667x320, about 15 minutes alone (--flows= picks
// others). A RESULT line ends it; it exits 1 on any failure. The extra parts
// alone: --flows=4more,5more,13more,13del,13gone.
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
const FLOWS = (opt("flows", o.quick ? "1,2,4,5,7,11" : "1,2,3,4,5,6,7,8,9,10,11,13,14,15")).split(",");
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
    await ctx.addInitScript(() => { window.__hsQuietCouncilCard = true; window.__hsQuietPostCard = true; window.__hsQuietRallyBubble = true; });   // (G5: and the Garrison Post's card and bubble)
    if (x.quietCall) await ctx.addInitScript(() => { window.__hsQuietCallBubble = true; });   // (flow 7: the hero's Call bubble, as lib.js quiets it)
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
    const g = new R.Game(page, ctx, { w: C.w, h: C.h, touch: !!C.touch, name: C.name, key: C.key });
    g.reqs = [];
    page.on("request", r => { const u = r.url(); if (!/^(data|blob|about):/.test(u)) g.reqs.push(u); });
    page.on("pageerror", e => g.errs.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error" && !/Failed to load resource: the server responded with a status of (400|401|403|404|503)|net::ERR_ABORTED|ERR_CONNECTION|ERR_INTERNET_DISCONNECTED/.test(m.text())) g.errs.push("console.error: " + m.text()); });
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
          // (the welcome card counts once its buttons are live: they are dimmed while the save is pulled, 3.4)
          (st === "" ? !gateUp : gateUp && gateState === st && (st !== "welcome" || !gateCardEl.querySelector("button:disabled"))), st, { timeout: Math.max(500, end - Date.now()) });
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
    const pv = await g.ev(() => ({ gate: gateUp, search: location.search, text: $("privacyPage").innerText, del: !!document.querySelector("#privacyPage section#delete"),
      backs: ["privacyBack", "privacyBack2"].map(id => ($(id) || {}).getAttribute && $(id).getAttribute("href")), sound: typeof Snd !== "undefined" && Snd.ctx ? Snd.ctx.state : "none" }));
    if (pv.gate || !/Privacy/.test(pv.text)) fail(W, "the privacy page: " + JSON.stringify(pv).slice(0, 200));
    // (P8) the whole page of 8.1: each of its parts, and the deletion part the providers link to
    for (const h of ["What we keep when you sign in", "What the game's owner can see", "each player it shows the email address", "What we count", "What the sign-in service and the web server record", "What we do not do", "Where it is kept", "How long",
      "How to delete your data", "Children", "Changes", "Delete my account", "kept by the sign-in service", "13 and older", "Authorized Apps"]) if (!pv.text.includes(h)) fail(W, "the privacy page has no \"" + h + "\"");
    if (!pv.del) fail(W, "the privacy page has no #delete part");
    if (pv.backs.some(h => h !== "/")) fail(W, "the privacy page's ways back go to " + pv.backs.join(", "));
    if (/\u2014|\u2013/.test(pv.text)) fail(W, "a long dash on the privacy page");
    if (pv.sound === "running") fail(W, "the privacy page started the game's sound");
    await audit(g, W + " privacy page", { root: "#privacyPage", parts: ["#privacyPage .kit"], primary: ["#privacyBack"], primaryRequired: true, scroll: "page" }, "privacy-" + C.key);
    await pressGo(g, "#privacyBack");
    await gate(g, "signin");
    if (new URL(g.page.url()).search) fail(W, "back from the privacy page the address is " + g.page.url());
    // ?privacy#delete, the address in the providers' consoles: the deletion part in view, and the way back at its end
    await g.page.goto(SITE + "/?privacy#delete");
    await g.page.waitForFunction(() => typeof Platform !== "undefined" && document.readyState === "complete" && !$("privacyPage").hidden, null, { timeout: 30000 });
    await g.frames(3);
    const dt = await g.ev(() => Math.round(document.getElementById("delete").getBoundingClientRect().top));
    if (dt < -2 || dt > g.o.h / 2) fail(W, "?privacy#delete does not show the deletion part (its top at " + dt + ")");
    if (PHOTOS) await g.page.screenshot({ path: path.join(PHOTOS, "privacy-delete-" + C.key + ".png") });
    await g.ev(() => document.getElementById("privacyBack2").scrollIntoView({ block: "center" }));
    await g.frames(2);
    await audit(g, W + " privacy page's end", { root: "#privacyPage", parts: ["#privacyPage .kit"], primary: ["#privacyBack2"], primaryRequired: true, scroll: "page" }, null);
    await pressGo(g, "#privacyBack2");
    await gate(g, "signin");
    if (new URL(g.page.url()).search || new URL(g.page.url()).hash) fail(W, "back from the privacy page's end the address is " + g.page.url());
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
      await ctx.addInitScript(() => { window.__hsQuietCouncilCard = true; window.__hsQuietPostCard = true; window.__hsQuietRallyBubble = true; });   // (G5: and the Garrison Post's card and bubble)
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
    if (tabs !== "council,daily,boards,account") fail(W, "the Hall's tabs are " + tabs);
    await audit(g, W + " Account tab", { root: "#hall", parts: ["#hallBody", "#hallTabs", "#hallClose"], primary: [".acTab .btn"], primaryRequired: true, scroll: "inside" }, "account-" + C.key);
    // sign out: asked, then done; the page comes back to the gate, Google marked "Last used"
    await g.press(() => Array.from(document.querySelectorAll(".acTab .btn")).find(b => b.textContent === "Sign out"));
    const ask = await g.ev(() => hallBodyEl.innerText);
    // (the account's progress leaves the device with the session: work package P3, 1.5)
    if (!ask.includes("Sign out? Your progress stays in your account. This device starts fresh.")) fail(W, "sign-out asks: " + ask);
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
    const names = (await S.query("select name from highland.hs_profiles order by created_at")).map(r => r.name);
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
  const EVON = [[() => { window.__HS_PLATFORM_TEST = Object.assign(window.__HS_PLATFORM_TEST || {}, { events: true }); }, null],
    // each call to hs_track says whether it went with keepalive (window.__hsKa, read by the test)
    [() => {
      const f0 = window.fetch;
      window.fetch = function (u, o) { try { if (/hs_track/.test(String(u)) && window.__hsKa) window.__hsKa.push(!!(o && o.keepalive)); } catch (e) {} return f0.apply(this, arguments); };
    }, null]];
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
    await g.ev(() => { lives = 17; waveIdx = totalWaves(); phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
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
    // (P4 review 4) the sign-in's events go soon after it, not on the queue's 20 s, even with the visit before's
    // batch still out as the page comes back from the provider; and that earlier visit stays a visitor's
    const iSid = await I.ev(() => pfEvQ && pfEvQ.sid), iT0 = Date.now();
    let iMs = -1;
    for (let k = 0; k < 60; k++) {
      const r = await S.query("select count(*)::int n from highland.hs_events e join highland.hs_sessions s on s.sid = e.sid where e.sid = $1 and e.name = 'signed_in' and s.uid is not null", [iSid]);
      if (r[0].n > 0) { iMs = Date.now() - iT0; break; }
      await new Promise(r2 => setTimeout(r2, 250));
    }
    notes.flows["signed_in sent after@" + C.key] = iMs;
    if (iMs < 0 || iMs > 8000) fail(W, "I's signed_in reached the server " + (iMs < 0 ? "not in 15 s" : "after " + iMs + " ms") + ", not soon after the sign-in: " +
      JSON.stringify(await I.ev(() => ({ busy: pfEvBusy, soon: typeof pfEvSoon === "undefined" ? null : pfEvSoon, anon: pfEvAnon, sid: pfEvQ && pfEvQ.sid, fails: pfEvQ && pfEvQ.fails, wait: pfEvQ && pfEvQ.notBefore - Date.now(),
        list: pfEvQ && pfEvQ.list.map(e => e.n + "/" + e.s.slice(0, 4) + (e.f ? "*" : "")), ev: (window.__hsEv || []).map(e => e[0] + (e[3] ? "" : "!")) }))));
    // (B review 10's keepalive) the batch a hidden page sends goes with keepalive, which Safari needs to send it at all
    await B.ev(() => { window.__hsKa = []; Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await B.wait(300);
    const ka = await B.ev(() => { delete document.visibilityState; return window.__hsKa; });
    if (!ka.length || !ka.every(x => x === true)) fail(W, "the batch of a hidden page went without keepalive: " + JSON.stringify(ka));
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
      const rows = await S.query(`select count(*)::int n from highland.hs_events where name = 'page_hide'`);
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
    // the gate card: one sign-in for each provider (P4 review 4: Discord was missing when its batch came late)
    const gRows = await A.ev(() => (stData.gate || []).filter(r => r.event === "signed_in").map(r => r.provider + ":" + r.n).sort());
    if (JSON.stringify(gRows) !== JSON.stringify(["discord:1", "facebook:1", "google:1"])) fail(W, "the gate card's sign-ins: " + JSON.stringify(gRows));
    // a visit before a sign-in (it tapped a provider and left for it) is a visitor's, not the account's
    const early = await S.query(`select count(*)::int n from highland.hs_sessions s where s.uid is not null
      and exists (select 1 from highland.hs_events e where e.sid = s.sid and e.name = 'provider_tapped')
      and not exists (select 1 from highland.hs_events e where e.sid = s.sid and e.name = 'signed_in')`);
    if (early[0].n) fail(W, early[0].n + " visits before a sign-in were joined to the account");
    // what each visit said of its device (p_ctx)
    const ctxs = await S.query("select distinct dev_class, os, browser, standalone, channel from highland.hs_sessions where channel = 'live'");
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
    await P.wait(1300);   // (the sign-in card counted: gate_shown is sent after a second on screen)
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
    const pSid = await P.ev(() => pfEvQ && pfEvQ.sid);
    await P.ev(() => pfEvNow());
    await leave(P, W + " player");
    // (P4 review 2) a reader of the privacy page on a new device
    const PV = await open(C, { init: EVON, path: "/?privacy" });
    await PV.page.waitForFunction(() => !$("privacyPage").hidden, null, { timeout: 20000 });
    const pvSid = await PV.ev(() => pfEvQ && pfEvQ.sid);
    await leave(PV, W + " privacy");
    for (let k = 0; k < 60; k++) {
      const r = await S.query("select count(distinct e.sid)::int n from highland.hs_events e where (e.sid = $1 and e.name = 'signed_in') or (e.sid = $2 and e.name = 'page_load')", [pSid, pvSid]);
      if (r[0].n >= 2) break;
      await new Promise(r2 => setTimeout(r2, 500));
    }
    // P's game visit (page_load, gate_shown) is a new device's; its sign-in on ?stats and the privacy reader are not
    await A.ev(() => pfStatsLoad());
    await statsUp(A);
    const got2 = {};
    for (const x of (await A.ev(() => stData && stData.funnel)) || []) got2[x.step] = [x.n, x.new, x.returning, x.inapp];
    const want2 = Object.assign({}, want, { page_load: [5, 3, 1, 1], gate_shown: [5, 3, 1, 1] });
    if (JSON.stringify(got2) !== JSON.stringify(want2)) fail(W, "the funnel after a ?stats sign-in and a privacy reader: " + JSON.stringify(got2) + ", not " + JSON.stringify(want2));
    const g2 = await A.ev(() => (stData.gate || []).filter(r => r.event === "signed_in").map(r => r.provider + ":" + r.n).sort());
    if (JSON.stringify(g2) !== JSON.stringify(["discord:1", "facebook:1", "google:1"])) fail(W, "the gate card after a ?stats sign-in: " + JSON.stringify(g2));
    // --- hostile events, sent as a stranger can: straight to hs_track with the public key
    const post = async (body, bearer) => {
      const r = await fetch(API + "/rest/v1/rpc/hs_track", { method: "POST", headers: { apikey: S.anonKey, Authorization: "Bearer " + (bearer || S.anonKey), "Content-Type": "application/json", "Content-Profile": "highland", "Accept-Profile": "highland" }, body: JSON.stringify(body) });
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
    const forged = await S.query("select sid, uid::text from highland.hs_sessions where sid in ('evil-0002-aaaa', 'evil-0003-aaaa')");
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
    // (P4 review 1) the switches answer on the page itself: "Saved." under the gate, and a refused value says so,
    // over everything, with the field put back to the value in force
    const said = await A.ev(() => { const e = document.querySelector('#statsPage .stAnswer[data-key="gate"]'); return e ? e.textContent : null; });
    if (said !== "Saved.") fail(W, "the gate's switch said " + JSON.stringify(said) + " after a save");
    // (P6 review 8) the daily's switch: Off saved and held by the server, then On again
    for (const v of [false, true]) {
      await pressStats(A, '#statsPage .stDaily[data-on="' + v + '"]');
      await A.page.waitForFunction(v => !stBusy && stData && stData.config && (stData.config.daily !== false) === v, v, { timeout: 20000 }).catch(() => fail(W, "the daily's switch " + v + " was not saved"));
      const held = (await S.query("select value from highland.hs_config where key = 'daily'"))[0];
      const pressed = await A.ev(() => { const b = document.querySelector('#statsPage .stDaily[aria-pressed="true"]'); return b ? b.dataset.on : null; });
      if (!held || held.value !== v || pressed !== String(v)) fail(W, "the daily's switch " + v + ": the server holds " + JSON.stringify(held) + ", pressed " + pressed);
    }
    await A.page.fill('#statsPage .stField[data-key="ev_keep_days"]', "3");
    await pressStats(A, '#statsPage .stField[data-key="ev_keep_days"] + .btn');
    await A.wait(200);
    const refused = await A.ev(() => {
      const out = document.querySelector('#statsPage .stAnswer[data-key="ev_keep_days"]'), r = out.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2);
      return { text: out.textContent, field: document.querySelector('#statsPage .stField[data-key="ev_keep_days"]').value, onTop: top === out || out.contains(top) };
    });
    if (refused.text !== "That value is not allowed." || refused.field !== "180" || !refused.onTop) fail(W, "a refused value on the switches: " + JSON.stringify(refused));
    // the server's own refusal (a value the page lets through and the server does not; made here by answering the
    // call as the server would) and a failed save answer the same way, the field put back each time
    for (const [code, words] of [["value_invalid", "That value is not allowed."], ["network", "Not saved. Try again."]]) {
      const route = (r) => code === "network" ? r.abort("connectionrefused") : r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: code }) });
      await A.page.route("**/rest/v1/rpc/hs_admin_set_config", route);
      await A.page.fill('#statsPage .stField[data-key="ev_keep_days"]', "200");
      await pressStats(A, '#statsPage .stField[data-key="ev_keep_days"] + .btn');
      await A.page.waitForFunction(() => !/Saving/.test(document.querySelector('#statsPage .stAnswer[data-key="ev_keep_days"]').textContent), null, { timeout: 10000 }).catch(() => {});
      const sv = await A.ev(() => ({ text: document.querySelector('#statsPage .stAnswer[data-key="ev_keep_days"]').textContent, field: document.querySelector('#statsPage .stField[data-key="ev_keep_days"]').value }));
      await A.page.unroute("**/rest/v1/rpc/hs_admin_set_config", route);
      if (sv.text !== words || sv.field !== "180") fail(W, "the server's " + code + " on the switches: " + JSON.stringify(sv));
    }
    if (PHOTOS) {
      await A.ev(() => document.querySelector('#statsPage .stAnswer[data-key="ev_keep_days"]').scrollIntoView({ block: "center" }));
      await A.frames(2);
      await A.page.screenshot({ path: path.join(PHOTOS, "stats-desk-refused-value.png") });
    }
    // Remove old events
    await pressStats(A, "#statsPage .stPurge");
    await A.page.waitForFunction(() => /Removed \d+ visits\./.test($("statsBody").innerText), null, { timeout: 20000 }).catch(() => fail(W, "Remove old events said nothing"));
    await done(A, W + " owner");
    // --- nothing is sent from a webdriver without the switch, on file://, or with the constants empty
    const before = (await S.query("select count(*)::int n from highland.hs_events"))[0].n;
    const logs = {};
    // (P4 review 3) a webdriver with an ordinary browser's user agent (Selenium driving Chrome), so only
    // navigator.webdriver stands between it and the server; then a robot's user agent with webdriver false, so only
    // the user agent does. Neither leaves an anonymous id behind (P4 review 8)
    const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const quiet = [["webdriver", { ua: desktopUA }, "webdriver"],
      ["robot", { init: [[() => { Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => false }); }, null]] }, "robot"]];
    for (const [k, x, why] of quiet) {
      const Q = await open(C, x);
      await gate(Q, "signin");
      await Q.wait(1500);
      await Q.ev(() => { track("tower_built", {}); for (let i = 0; i < 25; i++) track("map_open", { i }); });
      await Q.wait(500);
      logs[k] = Q.reqs.slice();
      if (Q.reqs.some(u => /hs_track/.test(u))) fail(W, "a " + k + " without the switch sent events");
      const qState = await Q.ev(() => ({ queue: !!pfEvQ, kick: typeof window.__hsEvKick, barred: pfEvBarred(), store: localStorage.getItem("hs_pf_evq"), aid: localStorage.getItem("hs_pf_aid"), ua: navigator.userAgent, wd: navigator.webdriver }));
      if (qState.queue || qState.kick !== "undefined" || qState.store || qState.aid || qState.barred !== why) fail(W, "a " + k + "'s queue: " + JSON.stringify(qState));
      if (k === "webdriver" && (/headless/i.test(qState.ua) || qState.wd !== true)) fail(W, "the webdriver page is not as meant: " + JSON.stringify(qState));
      if (k === "robot" && (!/HeadlessChrome/.test(qState.ua) || qState.wd !== false)) fail(W, "the robot page is not as meant: " + JSON.stringify(qState));
      await leave(Q, W + " " + k);
    }
    await new Promise(r => setTimeout(r, 800));
    const afterQ = (await S.query("select count(*)::int n from highland.hs_events"))[0].n;
    if (afterQ !== before) fail(W, "events reached the server from a webdriver without the switch (" + before + " to " + afterQ + ")");
    // a prerender (the switch on): no queue while it is one; it begins once the page is shown
    const PR = await open(C, { init: EVON.concat([[() => { window.__pre = true; Object.defineProperty(Document.prototype, "prerendering", { configurable: true, get: () => window.__pre === true }); }, null]]) });
    await gate(PR, "signin");
    await PR.wait(1200);
    const pr0 = await PR.ev(() => ({ q: !!pfEvQ, kick: typeof window.__hsEvKick, aid: localStorage.getItem("hs_pf_aid") }));
    await PR.ev(() => { window.__pre = false; document.dispatchEvent(new Event("prerenderingchange")); });
    await PR.wait(300);
    const pr1 = await PR.ev(() => ({ q: !!pfEvQ, n: pfEvQ ? pfEvQ.list.map(e => e.n) : [], aid: localStorage.getItem("hs_pf_aid"), now: pfAidNow }));
    if (pr0.q || pr0.kick !== "undefined" || pr0.aid || !pr1.q || !pr1.n.includes("page_load") || !pr1.n.includes("gate_shown") || !pr1.aid || JSON.parse(pr1.aid) !== pr1.now)
      fail(W, "a prerender: " + JSON.stringify({ pr0, pr1 }));
    logs.prerender = PR.reqs.slice();
    await leave(PR, W + " prerender");
    const before2 = (await S.query("select count(*)::int n from highland.hs_events"))[0].n;
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
    // (P8) the privacy page with the platform off: read from the page itself, no request, no gate
    await ep.goto(PLAIN + "/?privacy#delete", { timeout: 120000 });
    await ep.waitForTimeout(1500);
    const epv = await ep.evaluate(() => ({ shown: !$("privacyPage").hidden, gate: gateUp, del: !!document.querySelector("#privacyPage #delete"),
      top: Math.round(document.getElementById("delete").getBoundingClientRect().top) }));
    if (!epv.shown || epv.gate || !epv.del || epv.top < -2 || epv.top > C.h / 2) fail(W, "?privacy#delete with the platform off: " + JSON.stringify(epv));
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
    const after = (await S.query("select count(*)::int n from highland.hs_events"))[0].n;
    if (after !== before2) fail(W, "events reached the server from a page that should send none (" + before2 + " to " + after + ")");
    const strip = (l) => l.map(u => u.replace(SITE, "SITE").replace(API, "API").replace(PLAIN, "PLAIN").replace(/^file:\/\/.*index\.html/, "file://.../index.html"));
    notes.quiet = { webdriver: strip(logs.webdriver), robot: strip(logs.robot), prerender: strip(logs.prerender), file: strip(logs.file), empty: strip(logs.empty), webdriverEventsBefore: before, webdriverEventsAfter: afterQ, eventsBefore: before2, eventsAfter: after };
    if (PHOTOS) fs.writeFileSync(path.join(PHOTOS, "requests-quiet.json"), JSON.stringify(notes.quiet, null, 2));
  };

  // ================================================================ cloud saves (work package P3: flows 4, 5, 6, 13)
  // the welcome card with its buttons live (gate() waits for that), after a new player's name or a returning one's sign-in
  const newPlayer = async (g, who, name, prov) => {
    await gate(g, "signin");
    await signIn(g, who, prov || "google", "name");
    await g.page.fill("#gate .gtField", name);
    await pressGo(g, "#gate .gtGo");
    await gate(g, "welcome");
  };
  const returning = async (g, who) => { await gate(g, "signin"); await signIn(g, who, "google", "welcome"); };
  const uidOf = async (g) => JSON.parse(await store(g, "hs_pf_auth")).uid;
  const saveOf = async (uid) => (await S.query("select version, data from highland.hs_saves where user_id = $1 and channel = 'live'", [uid]))[0] || null;
  const until = async (fn, ms, what) => {
    const end = Date.now() + ms;
    for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error("timed out: " + what); await new Promise(r => setTimeout(r, 250)); }
  };
  // every synced key on the device, as the page names them (hs_run among them)
  const synced = (g) => g.ev(() => { const o = {}; for (const k of csNames().concat(["hs_run"])) { const v = localStorage.getItem(k); if (v != null) o[k] = v; } return o; });
  const runOf = (val) => { try { const r = JSON.parse(val); return r ? { lvl: r.lvl, cleared: r.cleared, gold: r.gold } : null; } catch (e) { return null; } };
  // (a press's target is a function the page runs without its closure: the words are written into it)
  const welcomeBtn = (words) => (0, eval)("() => Array.from(gateCardEl.querySelectorAll(\"button\")).find(b => b.textContent.startsWith(" + JSON.stringify(words) + "))");
  const pressWelcome = async (g, words) => { await pressGo(g, welcomeBtn(words)); };
  // waves cleared on the field now (the field emptied as each wave comes; the game's own loop clears it)
  const clearWaves = async (g, n) => {
    for (let k = 0; k < n; k++) {
      const was = await g.ev(() => lastCleared);
      await g.ev(() => { if (phase !== "wave") startWave(); });
      await g.page.waitForFunction(() => phase === "wave", null, { timeout: 10000 });
      await g.ev(() => { spawnQueue = []; enemies = []; });
      await g.page.waitForFunction(w => lastCleared > w, was, { timeout: 20000 });
    }
  };
  // a battle on battlefield lv from the map (an upright phone is turned sideways for it, as the game asks), n waves cleared
  const fight = async (g, lv, n) => {
    const C = g.o, upright = C.w < C.h && C.w <= 500;
    if (upright) await g.page.setViewportSize({ width: C.h, height: C.w });
    await g.enterBattle(lv);
    await clearWaves(g, n);
    if (upright) await g.page.setViewportSize({ width: C.w, height: C.h });
  };
  // the page left (a navigation away: pagehide, so the save goes with keepalive) and the server's save read until it holds what is wanted
  const away = async (g) => { await g.page.goto("about:blank"); };
  // The page closed with a change waiting: the change goes with the page (keepalive). That write is the browser's to
  // deliver as the page dies, and is not certain; when it does not land, the next load sends the save (4.3). Both
  // are tried here: the close first, then, only if it was lost, a load of the page (counted in notes.closeLost)
  // (the close is checked itself: a change waits to be sent as the page goes, and a write begins with the page's
  // close. A run where every close fell back to the next load fails at its end)
  const closeSends = async (g, uid, want, what) => {
    const dirty = await g.ev(() => !!csState().dirty);
    if (!dirty) fail(g.o.name, what + ": no change waits to be sent as the page closes, so the close is not tried");
    // (counted where they arrive, at the stack: a keepalive write of a page that is going is not one Playwright's page
    // lists. Only this page writes now: the other pages of a flow are quiet, and none of its changes waits)
    const puts = async () => ((await S.control("state")).calls || {}).hs_save_put || 0, n0 = await puts();
    notes.closeTried = (notes.closeTried || 0) + 1;
    await away(g);
    if (!(await until(async () => (await puts()) > n0, 5000, "").catch(() => false))) fail(g.o.name, what + ": no write went with the closing page");
    const sv = await serverRun(uid, want, what, 10000).catch(() => null);
    if (sv) return sv;
    notes.closeLost = (notes.closeLost || 0) + 1;
    console.log("  note: " + what + ": the write with the closing page did not land; the next load sends it");
    await g.page.goto(SITE + "/");
    await gate(g, "welcome");
    const again = await serverRun(uid, want, what + " (sent by the next load)").catch(e => { fail(g.o.name, e.message); return null; });
    await away(g);
    return again;
  };
  const serverRun = async (uid, want, what, ms) => until(async () => { const sv = await saveOf(uid); const r = sv && sv.data && sv.data.run && runOf(sv.data.run.val); return r && want(r, sv) ? sv : null; }, ms || 15000, what);
  const accountTab = async (g) => {
    await g.ev(() => openHall("account"));
    await g.page.waitForFunction(() => hallOpen && hallTab === "account" && !hallEl.classList.contains("hlSettling"), null, { timeout: 5000 });
  };
  const acBtn = (words) => (0, eval)("() => Array.from(document.querySelectorAll(\".acTab .btn\")).find(b => b.textContent === " + JSON.stringify(words) + ")");

  // flow 4: play and save. The tutorial's first wave, then the page closed: the server holds the battle
  const flow4 = async (C) => {
    const W = "flow 4 " + C.name;
    await resetStack();
    const g = await open(C);
    await newPlayer(g, "aram", "Aram");
    const uid = await uidOf(g);
    if ((await cardText(g)).includes("saved to your account")) fail(W, "a new device with nothing on it has no line about its progress: " + await cardText(g));
    // (an upright phone is turned sideways for the battle, as the game asks)
    const upright = C.w < C.h && C.w <= 500;
    if (upright) await g.page.setViewportSize({ width: C.h, height: C.w });
    await pressWelcome(g, "Begin: ");
    if (!(await toField(g, W))) { await done(g, W); return; }
    // the coach's Skip, as the player presses it, then the first wave sent and held
    await g.page.waitForFunction(() => !!document.querySelector("#coach .cSkip") && document.querySelector("#coach .cSkip").getClientRects().length > 0, null, { timeout: 15000 });
    for (let k = 0; k < 2 && (await g.ev(() => !!tut)); k++) { await g.frames(4); const q = await g.reach("#coach .cSkip"); if (!q.why) await g.tapAt(q.x, q.y); await g.wait(300); }
    await clearWaves(g, 1);
    // a wave cleared goes at once
    const sv = await serverRun(uid, r => r.lvl === "erebuni" && r.cleared === 1, "the first wave's save on the server").catch(e => { fail(W, e.message); return null; });
    if (sv) {
      if (sv.data.v !== 1 || sv.data.keys.hs_tutorial_done !== "1") fail(W, "the save document: " + JSON.stringify({ v: sv.data.v, keys: Object.keys(sv.data.keys) }));
      const dev = JSON.parse(await store(g, "hs_pf_dev"));
      if (sv.data.run.dev !== dev.id || sv.data.dev !== dev.id || !(sv.data.run.at > 0)) fail(W, "the save's device and time: " + JSON.stringify({ dev: sv.data.dev, run: sv.data.run.dev, at: sv.data.run.at }));
    }
    // a change in battle waits 25 s; the page closed sends it at once, with the page
    const gold = await g.ev(() => { gold += 7; saveRun(); return JSON.parse(localStorage.getItem("hs_run")).gold; });
    await g.page.waitForFunction(() => !CS.putting && !CS.busy, null, { timeout: 15000 }).catch(() => {});
    const v0 = (await saveOf(uid)).version;
    const late = await closeSends(g, uid, r => r.gold === gold, "the save sent as the page closed");
    if (late && !notes.closeLost && late.version !== v0 + 1) fail(W, "the page's close wrote " + (late.version - v0) + " versions");
    await done(g, W);
    if (C.key === "desk" || C.key === "ses") await flow4more(C);
  };
  // flow 4, more (the P3 review's finding 4): the write that goes with a closing page, sent while another write is
  // still out and another device has written the version after the one that write expects. It must not take that
  // device's place: it expects the version this page last saw, is turned away, and the change waits for the next
  // load. (The close's write is called here as csHide calls it, with the page kept: a browser cancels the write
  // out as the page goes, and the race is the server's, not the page's)
  const flow4more = async (C) => {
    const W = "flow 4 (the close's write while a write is out) " + C.name;
    await resetStack();
    const A = await open(C);
    await newPlayer(A, "aram", "Aram");
    const uid = await uidOf(A);
    await pressWelcome(A, "Campaign Map"); await gate(A, ""); await toMap(A);
    const B = await open(C);
    await returning(B, "aram");
    await pressWelcome(B, "Campaign Map"); await gate(B, ""); await toMap(B);
    for (const g of [A, B]) await g.page.waitForFunction(() => !CS.busy && !CS.timer && !csState().dirty, null, { timeout: 15000 }).catch(() => {});
    await A.ev(() => csPull());
    const vs = await saveOf(uid);
    if ((await A.ev(() => csState().ver)) !== vs.version || (await B.ev(() => csState().ver)) !== vs.version) fail(W, "the two devices are not at the server's version " + vs.version);
    // A's next write is held 5 s at the server, under the page's own 8 s
    await S.control("hold", { rpc: "hs_save_put", ms: 5000 });
    await A.ev(() => { localStorage.setItem("hs_tricks_seen", JSON.stringify(["fromA"])); clearTimeout(CS.timer); CS.timer = 0; csPush(); });
    await A.page.waitForFunction(() => CS.putting, null, { timeout: 5000 }).catch(() => fail(W, "A's write did not go"));
    // meanwhile B saves: the version after the one A's write expects (one write: its change's timer is not left to write again)
    await B.ev(() => { localStorage.setItem("hs_open_kept", JSON.stringify(["fromB"])); clearTimeout(CS.timer); CS.timer = 0; return csPush(); });
    const sB = await saveOf(uid);
    if (sB.version !== vs.version + 1 || !/fromB/.test(sB.data.keys.hs_open_kept || "")) fail(W, "B's save is not the version after: " + sB.version);
    // A changes again, and its page's close sends the save, its first write still out
    const r = await A.ev(() => { localStorage.setItem("hs_tricks_seen", JSON.stringify(["fromA", "fromA2"])); clearTimeout(CS.timer); CS.timer = 0; const out = CS.putting; return csPush(true).then(ok => ({ ok, out })); });
    if (!r.out) fail(W, "A's first write was no longer out at the close");
    const s1 = await saveOf(uid);
    if (!/fromB/.test(s1.data.keys.hs_open_kept || "")) fail(W, "the close's write took the other device's place, and its progress is gone: " + JSON.stringify(s1.data.keys).slice(0, 200));
    // (turned away, the write merges what the server sent back and goes again while the page is there to do it)
    // the write out is answered (turned away), merges B's, and goes again: both devices' progress is on the server
    const s2 = await until(async () => { const s = await saveOf(uid); return s && /fromA2/.test(s.data.keys.hs_tricks_seen || "") ? s : null; }, 20000, "A's change on the server").catch(e => { fail(W, e.message); return null; });
    if (s2 && !/fromB/.test(s2.data.keys.hs_open_kept || "")) fail(W, "the merge lost B's progress");
    await done(A, W); await done(B, W + " second device");
  };

  // flow 5: a second device. The battle resumed there; then both play other battles offline and come back
  const flow5 = async (C) => {
    const W = "flow 5 " + C.name;
    await resetStack();
    const A = await open(C);
    await newPlayer(A, "aram", "Aram");
    const uid = await uidOf(A);
    await pressWelcome(A, "Campaign Map");
    await gate(A, "");
    await toMap(A);
    await fight(A, 0, 2);
    const aRun = await store(A, "hs_run");
    // (a write still out when the page goes is a race the page cannot win for sure: the close's save counts on that
    // one being taken first, and else the next load sends it. The test waits for it, so the close is what is tried)
    await A.page.waitForFunction(() => !CS.putting && !CS.busy, null, { timeout: 15000 }).catch(() => {});
    await closeSends(A, uid, r => r.lvl === "erebuni" && r.cleared === 2, "device A's battle on the server");
    // device B: the same person signs in and is offered A's battle
    const B = await open(C);
    await returning(B, "aram");
    const bt = await cardText(B);
    if (!bt.includes("Resume: Erebuni Rise, Wave 3")) fail(W, "the second device's welcome card: " + bt);
    if ((await store(B, "hs_run")) !== aRun) fail(W, "the second device does not hold the first's battle as it was saved");
    await pressWelcome(B, "Resume: ");
    await B.page.waitForFunction(() => battleLive(), null, { timeout: 10000 }).catch(() => {});
    const rb = await B.ev(() => ({ live: battleLive(), cleared: lastCleared, lvl: levelId(curLevel) }));
    if (!rb.live || rb.cleared !== 2 || rb.lvl !== "erebuni") fail(W, "resumed on the second device: " + JSON.stringify(rb));
    // both offline (the database not answering), each in a battle of its own
    await S.control("rest", { mode: "down" });
    await B.ev(() => { if (battleLive()) { gameOver = true; } });
    await fight(B, 1, 1);                                  // Tushpa on B
    const bTushpa = await store(B, "hs_run");
    // B closed while offline, so it comes back after A (its tries to send the battle would else race A's)
    await away(B);
    await A.page.goto(SITE + "/");
    await gate(A, "welcome");
    await pressWelcome(A, "Campaign Map");
    await gate(A, "");
    await toMap(A);
    await fight(A, 2, 1);                                  // Avarayr on A
    await S.control("rest", { mode: "up" });
    // A back first: its battle is the later of the two it can know of (or, if the cloud's was B's, it is asked: kept)
    await A.page.reload();
    await gate(A, "welcome");
    if ((await cardText(A)).includes("Two battles in progress")) await pressWelcome(A, "Keep this device's battle");
    await serverRun(uid, r => r.lvl === "avarayr", "A's Avarayr battle on the server").catch(e => fail(W, e.message));
    // B back: two fresh battles on two devices, the question
    await B.page.goto(SITE + "/");
    await gate(B, "welcome");
    const q = await cardText(B);
    const other = C.ua ? "Your other iPhone" : "Another device";
    for (const want of ["Two battles in progress", "This device: Vale of Tushpa, wave 2, just now.", other + ": Avarayr Plain, wave 2, ", "Keep this device's battle",
      C.ua ? "Take the other iPhone's battle" : "Take the other device's battle", "The other one is dropped."])
      if (!q.includes(want)) fail(W, "the question lacks " + JSON.stringify(want) + ": " + q);
    if (/\bResume: |Continue: /.test(q)) fail(W, "the question stands beside a lead button: " + q);
    await audit(B, W + " two battles", cardSpec(["#gate .gtGo"]), "prompt-" + C.key);
    await pressWelcome(B, "Keep this device's battle");
    await gate(B, "welcome");
    const after = await cardText(B);
    if (!after.includes("Resume: Vale of Tushpa, Wave 2") || after.includes("Two battles")) fail(W, "after keeping this device's battle: " + after);
    if ((await store(B, "hs_run")) !== bTushpa) fail(W, "keeping this device's battle changed it");
    const ch = await evs(B, "save_conflict_choice");
    if (!ch.length || ch[0].keep !== "mine") fail(W, "save_conflict_choice: " + JSON.stringify(ch));
    await serverRun(uid, r => r.lvl === "tushpa", "the battle kept on the server").catch(e => fail(W, e.message));
    // the choice wins everywhere: A takes B's battle without being asked
    await A.page.reload();
    await gate(A, "welcome");
    const at = await cardText(A);
    if (at.includes("Two battles") || !at.includes("Resume: Vale of Tushpa, Wave 2")) fail(W, "the first device after the choice: " + at);
    if ((await store(A, "hs_run")) !== bTushpa) fail(W, "the first device does not hold the battle kept");
    // the other answer: A plays Dvin offline and comes back with it still on the field (a battle in play is never
    // replaced under the player: it goes up); B, seen next, is asked, and takes the other device's battle
    await pressWelcome(A, "Campaign Map");
    await gate(A, "");
    await S.control("rest", { mode: "down" });
    await toMap(A);
    await fight(A, 3, 1);
    const aDvin = await store(A, "hs_run");
    await S.control("rest", { mode: "up" });
    await A.ev(() => window.dispatchEvent(new Event("online")));
    await serverRun(uid, r => r.lvl === "dvin", "A's Dvin battle on the server once it is online").catch(e => fail(W, e.message));
    await B.page.reload();
    await gate(B, "welcome");
    const q2 = await cardText(B);
    if (!q2.includes("Two battles in progress") || !q2.includes("This device: Vale of Tushpa, wave 2, ") || !q2.includes(": Dvin Gates, wave 2, just now.")) fail(W, "the second question: " + q2);
    await pressWelcome(B, "Take the ");
    await gate(B, "welcome");
    if (!(await cardText(B)).includes("Resume: Dvin Gates, Wave 2")) fail(W, "after taking the other device's battle: " + await cardText(B));
    if ((await store(B, "hs_run")) !== aDvin) fail(W, "taking the other device's battle did not bring it here");
    const ch2 = await evs(B, "save_conflict_choice");
    if (!ch2.length || ch2[0].keep !== "theirs") fail(W, "save_conflict_choice: " + JSON.stringify(ch2));
    await serverRun(uid, r => r.lvl === "dvin", "the battle taken, on the server").catch(e => fail(W, e.message));
    // a battle this build cannot fight is not adopted (4.5, rule 6): the device keeps what it had, the cloud's stays
    await away(B);   // (B out of the way)
    // (written as another device of a later build would write it: through hs_save_put, as the player)
    const bad = JSON.stringify({ v: 1, lvl: "no-such-field", era: 0, cleared: 4 });
    // (A may be writing at the same moment: the write is tried again on the version that won, as a device would)
    await A.page.waitForFunction(() => !CS.busy && !CS.timer, null, { timeout: 30000 }).catch(() => {});
    const put = await A.ev(async (bad) => {
      let r = null;
      for (let k = 0; k < 4 && !(r && r.ok); k++) {
        const g = await pfRpc("hs_save_get", {}, { auth: true });
        const d = g.data.data;
        d.run = Object.assign({}, d.run, { val: bad, at: pfNow() + 60000, dev: "zzzz", label: "iPad" });
        r = (await pfRpc("hs_save_put", { p_expected: g.data.version, p_data: d, p_device: "iPad" }, { auth: true })).data;
      }
      return r;
    }, bad);
    if (!put || put.ok !== true) fail(W, "the later build's save could not be written: " + JSON.stringify(put));
    // a third device, with no battle of its own, signs in: the cloud's battle is one it cannot fight
    const D = await open(C);
    await returning(D, "aram");
    await D.page.waitForFunction(() => !CS.busy, null, { timeout: 10000 }).catch(() => {});
    const dt = await cardText(D);
    if ((await store(D, "hs_run")) !== null || /Resume: /.test(dt)) fail(W, "a battle this build cannot fight was adopted: " + dt);
    const kept = await saveOf(uid);
    if (kept.data.run.val !== bad) fail(W, "the cloud's battle that this build cannot fight was not left for the device that can");
    await done(D, W + " third device");
    await done(A, W);
    await done(B, W + " second device");
    if (C.key === "desk" || C.key === "ses") await flow5more(C);
  };

  // flow 5, more (the P3 review's findings 2 and 3), on the desktop and the small iPhone: the faults are in rules
  // that have no size. (1) A battle's end on one device ends that battle only: B's own battle, never played on A,
  // stays when A ends a different one, and goes back up. (2) Two battles' question with no welcome card to ask it
  // (the gate off; the answers in either order): nobody is asked, and the saves go on.
  const abandon = async (g) => {
    for (let k = 0; k < 3; k++) {
      await g.ev(() => { if (battleLive()) { abandonConfirm.arm(); document.getElementById("menuBtn").click(); } });
      if (await g.page.waitForFunction(() => !battleLive() && localStorage.getItem("hs_run") == null, null, { timeout: 5000 }).then(() => true, () => false)) return;
    }
    fail(g.o.name, "the battle could not be abandoned: " + JSON.stringify(await g.ev(() => ({ live: battleLive(), menu: menuMode, over: gameOver }))));
  };
  const toasts = async (g) => { await g.ev(() => { if (window.__hsToasts) return; window.__hsToasts = []; const t = window.toast; window.toast = function (m) { window.__hsToasts.push(String(m)); return t.apply(this, arguments); }; }); };
  // two devices of one player on the map, B holding a Tushpa battle it saved (and the cloud holding it too)
  const twoOnMap = async (C) => {
    await resetStack();
    const A = await open(C);
    await newPlayer(A, "aram", "Aram");
    const uid = await uidOf(A);
    await pressWelcome(A, "Campaign Map"); await gate(A, ""); await toMap(A);
    const B = await open(C);
    await returning(B, "aram");
    await pressWelcome(B, "Campaign Map"); await gate(B, ""); await toMap(B);
    return { A, B, uid };
  };
  const flow5more = async (C) => {
    let W = "flow 5 (a mark ends its own battle) " + C.name;
    {
      const { A, B, uid } = await twoOnMap(C);
      await fight(B, 1, 1);
      const bRun = await store(B, "hs_run");
      await serverRun(uid, r => r.lvl === "tushpa", "B's Tushpa on the server").catch(e => fail(W, e.message));
      // B leaves its battle saved, and comes back to the map with it
      await B.ev(() => { gameOver = true; });
      await B.page.reload(); await gate(B, "welcome");
      await pressWelcome(B, "Campaign Map"); await gate(B, ""); await toMap(B);
      if ((await store(B, "hs_run")) !== bRun) fail(W, "B's battle did not stay through its welcome card");
      await toasts(B);
      // A fights Avarayr (live, so it goes up over B's battle: rule 2), then abandons it: the mark
      await fight(A, 2, 1);
      await serverRun(uid, r => r.lvl === "avarayr", "A's Avarayr on the server").catch(e => fail(W, e.message));
      const aBid = await A.ev(() => csState().run && csState().run.bid);
      await abandon(A);
      log("  A after abandon: " + JSON.stringify(await A.ev(() => ({ live: battleLive(), run: localStorage.getItem("hs_run") && 1, st: csState(), menu: menuMode, over: gameOver, ev: (window.__hsEv || []).slice(-4).map(e => e[0]) }))));
      const mk = await until(async () => { const s = await saveOf(uid); return s && s.data.run && s.data.run.val === null ? s.data.run : null; }, 15000, "the mark on the server").catch(e => { fail(W, e.message); return null; });
      if (mk && (!aBid || mk.end !== aBid)) fail(W, "the mark does not name the battle it ended: " + JSON.stringify(mk) + " (A's battle " + aBid + ")");
      // B's page seen again: its own battle stays, with no word of a battle finished elsewhere, and goes back up
      await B.ev(() => csPull());
      await B.wait(500);
      if ((await store(B, "hs_run")) !== bRun) fail(W, "B's own battle was dropped by A's end of another battle");
      const said = await B.ev(() => window.__hsToasts.join(" | "));
      if (/was finished on/.test(said)) fail(W, "B was told a battle was finished: " + said);
      await serverRun(uid, r => r.lvl === "tushpa", "B's battle back on the server").catch(e => fail(W, e.message));
      // and the same battle finished on the other device still ends here, with its words: B's Tushpa, taken by A
      await A.page.reload(); await gate(A, "welcome");
      if (!(await cardText(A)).includes("Resume: Vale of Tushpa, Wave 2")) fail(W, "A is not offered B's battle: " + await cardText(A));
      await pressWelcome(A, "Resume: ");
      await A.page.waitForFunction(() => battleLive(), null, { timeout: 10000 }).catch(() => {});
      await clearWaves(A, 1);
      await serverRun(uid, r => r.lvl === "tushpa" && r.cleared === 2, "A's save of the battle it took").catch(e => fail(W, e.message));
      await abandon(A);
      await until(async () => { const s = await saveOf(uid); return s && s.data.run && s.data.run.val === null ? s : null; }, 15000, "A's end of the battle on the server").catch(e => fail(W, e.message));
      await B.ev(() => csPull());
      await B.wait(500);
      if ((await store(B, "hs_run")) !== null) fail(W, "the battle finished on the other device stayed here");
      const said2 = await B.ev(() => window.__hsToasts.join(" | "));
      if (!/That battle was finished on /.test(said2)) fail(W, "no word of the battle finished elsewhere: " + said2);
      await done(A, W); await done(B, W + " second device");
    }
    for (const late of ["hs_profile_get", "hs_save_get"]) {
      W = "flow 5 (the question with no welcome card, " + late + " late) " + C.name;
      const { A, B, uid } = await twoOnMap(C);
      // two fresh battles: B's offline, then A's up
      await B.ctx.setOffline(true);
      await fight(B, 1, 1);
      await B.ev(() => { gameOver = true; });
      await fight(A, 2, 1);
      await serverRun(uid, r => r.lvl === "avarayr", "A's battle up").catch(e => fail(W, e.message));
      await A.ev(() => { gameOver = true; });
      await done(A, W);
      // B back with the gate off (no welcome card), one of the two answers held back so they come in either order
      await B.ctx.addInitScript(() => { window.__HS_PLATFORM_TEST = Object.assign({}, window.__HS_PLATFORM_TEST || {}, { gate: "off" }); });
      await B.page.route("**/rpc/" + late, async (r) => { await new Promise(ok => setTimeout(ok, 2500)); r.continue().catch(() => {}); });
      await B.ctx.setOffline(false);
      await B.page.reload();
      await gate(B, "", 20000);
      await B.page.waitForFunction(() => CS.ready && !CS.busy, null, { timeout: 15000 }).catch(() => {});
      await B.wait(1500);
      const st = await B.ev(() => ({ ask: !!CS.ask, ready: CS.ready, line: csLine(), run: localStorage.getItem("hs_run") && JSON.parse(localStorage.getItem("hs_run")).lvl }));
      if (st.ask || !st.ready) fail(W, "the question is still pending with no card to ask it: " + JSON.stringify(st));
      if (st.run !== "tushpa") fail(W, "B's battle was replaced with nobody asked: " + JSON.stringify(st));
      // a change on the map goes up
      const v0 = (await saveOf(uid)).version;
      await B.ev(() => { localStorage.setItem("hs_tricks_seen", JSON.stringify(["review"])); });
      await until(async () => { const s = await saveOf(uid); return s && s.version > v0 && /review/.test(s.data.keys.hs_tricks_seen || "") ? s : null; }, 15000, "B's change on the server").catch(e => fail(W, e.message));
      await done(B, W + " second device");
    }
  };

  // flow 6: a guest's progress. Today's saves upload whole, come back whole on a second device, and join another's
  const flow6 = async (C) => {
    const W = "flow 6 " + C.name;
    await resetStack();
    const run = fs.readFileSync(path.join(__dirname, "..", "fixtures", "run-master-between.json"), "utf8").trim();
    const won = ["erebuni", "tushpa", "avarayr", "dvin", "tashir"];
    const rec = {};
    won.forEach((id, i) => { rec[id] = { stars: [0, 3 - (i % 2), 0], lives: [0, 20 - i, 0], endless: [0, 0, 0] }; });
    // the keys of a player of the live game who has won five battlefields, with a battle in progress (tools/fixtures)
    const today = {
      hs_records: JSON.stringify(rec), hs_tutorial_done: "1", hs_mig_ids: "1", hs_mig_rec: "1",
      hs_chapters_seen: JSON.stringify(["kingdoms"]), hs_unlocked_seen: JSON.stringify(won.concat(["sevan"])), hs_open_kept: JSON.stringify(["sevan"]),
      hs_tricks_seen: JSON.stringify(["guard", "scout"]), hs_nardi: JSON.stringify({ wins: 3, losses: 1 }), hs_run: run, hs_settings: JSON.stringify({ music: 0.2 }),
    };
    const eraOf = { erebuni: 0, tushpa: 0, avarayr: 1, dvin: 2, tashir: 2 };
    won.forEach(id => { today["hs_best_" + id + "_" + eraOf[id]] = "21"; });
    const A = await open(C, { storage: today });
    await A.page.waitForFunction(() => typeof gateState !== "undefined" && document.readyState === "complete");
    // the page's own start (its migrations) may tidy the keys: what is uploaded is what the device holds then
    await newPlayer(A, "aram", "Aram");
    const uid = await uidOf(A);
    const wt = await cardText(A);
    if (!wt.includes("Your progress on this device is now saved to your account.") || !wt.includes("Resume: Erebuni Rise, Wave 4")) fail(W, "the welcome card after the upload: " + wt);
    const mine = await synced(A);
    for (const k of Object.keys(today)) if (k !== "hs_settings" && !k.startsWith("hs_mig") && mine[k] == null) fail(W, "the device lost " + k + " at its first sign-in");
    const up = await until(() => saveOf(uid), 10000, "the first save").catch(e => { fail(W, e.message); return null; });
    if (up) {
      const keys = Object.assign({}, mine); delete keys.hs_run;
      if (JSON.stringify(Object.keys(up.data.keys).sort().map(k => [k, up.data.keys[k]])) !== JSON.stringify(Object.keys(keys).sort().map(k => [k, keys[k]])))
        fail(W, "the upload is not the device's synced keys whole: " + JSON.stringify({ server: Object.keys(up.data.keys).sort(), device: Object.keys(keys).sort() }));
      if (!up.data.run || up.data.run.val !== mine.hs_run || mine.hs_run !== run) fail(W, "the battle in progress was not uploaded as the live game saved it");
      if ("hs_settings" in up.data.keys || Object.keys(up.data.keys).some(k => /^hs_(pf_|mig_|town)/.test(k))) fail(W, "a key that is not synced was uploaded: " + Object.keys(up.data.keys).join());
    }
    // P10 review 6: the progress summary the page itself adds to each save (csSum), read back from the server: its
    // arithmetic against this test's own count, and every part there (a game function renamed would empty a part)
    if (up) {
      const sum = up.data.sum || {}, ids = await A.ev(() => LEVELS.map(L => L.id));
      const far = Math.max(...won.map(id => ids.indexOf(id))) + 1;
      const want = { won: [0, won.length, 0], held: won.length, farN: far, far: ids[far - 1], stars: await A.ev(() => starsEarned()) };
      for (const k of Object.keys(want)) if (JSON.stringify(sum[k]) !== JSON.stringify(want[k])) fail(W, "the save's summary: " + k + " is " + JSON.stringify(sum[k]) + ", not " + JSON.stringify(want[k]));
      if (!(want.stars > 0)) fail(W, "the save's summary: no stars for five battlefields won");
      if (!sum.heroes || Object.keys(sum.heroes).length !== await A.ev(() => CHAPTERS.length) || !sum.council || typeof sum.council !== "object" || Array.isArray(sum.council))
        fail(W, "the save's summary lacks the heroes or the Council: " + JSON.stringify(sum));
    }
    // and a returning player's device (P10 review 5): three battlefields won, the third before star records began (its
    // records already migrated, so the page's start does not make one for it); it counts as held, on no difficulty
    const G0 = await open(C, { storage: { hs_records: JSON.stringify({ erebuni: rec.erebuni, tushpa: rec.tushpa }), hs_best_erebuni_0: "21", hs_best_tushpa_0: "21",
      hs_best_avarayr_1: "21", hs_tutorial_done: "1", hs_mig_ids: "1", hs_mig_rec: "1" } });
    await G0.page.waitForFunction(() => typeof csSum === "function" && document.readyState === "complete");
    const s0 = await G0.ev(() => csSum());
    if (JSON.stringify([s0.won, s0.held, s0.farN, s0.far]) !== JSON.stringify([[0, 2, 0], 3, 3, "avarayr"])) fail(W, "a returning player's summary: " + JSON.stringify(s0));
    await done(G0, W + " returning player's summary");
    const sm = await evs(A, "save_merge");
    if (!sm.length || sm[0].case !== "upload") fail(W, "save_merge: " + JSON.stringify(sm));
    // the second device: everything comes back whole
    const B = await open(C);
    await returning(B, "aram");
    const back = await synced(B);
    if (JSON.stringify(Object.keys(back).sort().map(k => [k, back[k]])) !== JSON.stringify(Object.keys(mine).sort().map(k => [k, mine[k]])))
      fail(W, "the second device's keys are not the first's: " + JSON.stringify({ missing: Object.keys(mine).filter(k => back[k] !== mine[k]), extra: Object.keys(back).filter(k => !(k in mine)) }));
    const bt = await cardText(B);
    if (!bt.includes("Resume: Erebuni Rise, Wave 4") || !bt.includes(" of 17 battlefields held.") || bt.includes("saved to your account")) fail(W, "the second device's welcome card: " + bt);
    if ((await store(B, "hs_settings")) === today.hs_settings) fail(W, "a device's own settings followed the account");
    await done(B, W + " second device");
    // a third device with a guest's progress of its own joins the account: the best of both
    const council = await A.ev(() => JSON.stringify({ v: 1, own: Object.fromEntries(COUNCIL_IDS.map((id, i) => [id, i === 0 ? 2 : 0])), n: 2 }));
    await A.ev(c => { localStorage.setItem("hs_council", c); }, council);   // a Council tier taken on A (synced: it goes up)
    await until(async () => { const s = await saveOf(uid); return s && s.data.keys.hs_council === council; }, 10000, "A's Council tier on the server").catch(e => fail(W, e.message));
    const rec3 = { tushpa: { stars: [0, 3, 0], lives: [0, 19, 0], endless: [0, 0, 0] }, sevan: { stars: [2, 0, 0], lives: [12, 0, 0], endless: [0, 0, 0] } };
    const heroes = JSON.stringify({ v: 1, xp: { kingdoms: 900 }, daily: { day: "", xp: 0 } });
    const G3 = await open(C, { storage: { hs_records: JSON.stringify(rec3), hs_best_sevan_2: "21", hs_chapters_seen: JSON.stringify(["kingdoms", "faith"]), hs_tutorial_done: "1", hs_heroes: heroes } });
    await returning(G3, "aram");
    const jt = await cardText(G3);
    if (!jt.includes("Your progress on this device was joined with your account.")) fail(W, "the welcome card of a join: " + jt);
    const j = await synced(G3);
    const R = JSON.parse(j.hs_records || "{}");
    for (const id of won) if (!R[id] || Math.max(...R[id].stars) < 2) fail(W, "the joined records lost " + id + ": " + JSON.stringify(R[id]));
    if (!R.sevan || R.sevan.stars[0] !== 2 || !R.tushpa || R.tushpa.stars[1] !== 3) fail(W, "the joined records lost this device's own: " + JSON.stringify({ sevan: R.sevan, tushpa: R.tushpa }));
    if (JSON.stringify(JSON.parse(j.hs_chapters_seen || "[]").sort()) !== JSON.stringify(["faith", "kingdoms"])) fail(W, "chapters seen: " + j.hs_chapters_seen);
    if (j.hs_best_sevan_2 !== "21" || j.hs_best_dvin_2 !== "21") fail(W, "the best waves: " + JSON.stringify([j.hs_best_sevan_2, j.hs_best_dvin_2]));
    const cj = JSON.parse(j.hs_council || "null"), hj = JSON.parse(j.hs_heroes || "null");
    if (!cj || cj.n !== 2 || cj.own[await A.ev(() => COUNCIL_IDS[0])] !== 2) fail(W, "the Council tier taken on another device was lost: " + j.hs_council);
    if (!hj || hj.xp.kingdoms !== 900) fail(W, "this device's hero was lost: " + j.hs_heroes);
    const sm3 = await evs(G3, "save_merge");
    if (!sm3.length || sm3[0].case !== "merge") fail(W, "save_merge of a join: " + JSON.stringify(sm3));
    // and A, seen again, has the third device's progress too: two devices playing in turn lose nothing
    await A.page.reload();
    await gate(A, "welcome");
    const a2 = await synced(A), RA = JSON.parse(a2.hs_records || "{}");
    if (!RA.sevan || RA.sevan.stars[0] !== 2 || JSON.parse(a2.hs_heroes || "{}").xp.kingdoms !== 900 || JSON.parse(a2.hs_council || "{}").n !== 2) fail(W, "the first device did not take the join's progress: " + JSON.stringify({ sevan: RA.sevan, heroes: a2.hs_heroes, council: a2.hs_council }));
    await done(G3, W + " third device");
    await done(A, W);
  };

  // flow 13: sign out. The save goes first and the device starts fresh; with no connection the player is asked
  const flow13 = async (C) => {
    const W = "flow 13 " + C.name;
    await resetStack();
    const g = await open(C);
    await newPlayer(g, "aram", "Aram");
    const uid = await uidOf(g);
    await pressWelcome(g, "Campaign Map");
    await gate(g, "");
    await toMap(g);
    await g.ev(() => { localStorage.setItem(bestKey(0, LEVELS[0].era), "21"); storeRecord(0, { stars: [0, 2, 0], lives: [0, 15, 0], endless: [0, 0, 0] }); });
    await until(async () => { const s = await saveOf(uid); return s && /erebuni/.test(s.data.keys.hs_records || ""); }, 10000, "the victory's record on the server").catch(e => fail(W, e.message));
    await accountTab(g);
    const line = await g.ev(() => (document.querySelector(".acTab .acSync") || {}).textContent || "");
    if (line !== "Saved to your account just now.") fail(W, "the sync line: " + JSON.stringify(line));
    await audit(g, W + " Account tab", { root: "#hall", parts: ["#hallBody", "#hallTabs", "#hallClose"], primary: [".acTab .btn"], primaryRequired: true, scroll: "inside" }, "sync-" + C.key);
    // the line while the save cannot go
    await S.control("rest", { mode: "down" });
    await g.ev(() => storeRecord(1, { stars: [0, 1, 0], lives: [0, 5, 0], endless: [0, 0, 0] }));
    await g.page.waitForFunction(() => /Waiting for a connection/.test((document.querySelector(".acTab .acSync") || {}).textContent || ""), null, { timeout: 30000 })
      .catch(async () => fail(W, "the sync line while the save cannot go: " + await g.ev(() => (document.querySelector(".acTab .acSync") || {}).textContent)));
    if (C.key === "desk" || C.key === "ipad" || C.key === "ses") await audit(g, W + " Account tab waiting", { root: "#hall", parts: ["#hallBody"], primary: [".acTab .btn"], primaryRequired: true, scroll: "inside" }, "sync-wait-" + C.key);
    // sign out with no connection: asked, and "Sign out anyway" keeps the unsent progress for this account
    await g.press(acBtn("Sign out"));
    if (!(await g.ev(() => hallBodyEl.innerText)).includes("Sign out? Your progress stays in your account. This device starts fresh.")) fail(W, "sign-out's words: " + await g.ev(() => hallBodyEl.innerText));
    await g.press(acBtn("Sign out"));
    await g.page.waitForFunction(() => /could not be saved yet/.test(hallBodyEl.innerText), null, { timeout: 30000 }).catch(() => {});
    const ask = await g.ev(() => hallBodyEl.innerText.replace(/\s+/g, " "));
    if (!ask.includes("Your latest progress could not be saved yet. Sign out anyway?") || !ask.includes("Stay signed in") || !ask.includes("Sign out anyway")) fail(W, "sign-out with no connection: " + ask);
    await pressGo(g, acBtn("Sign out anyway"));
    await gate(g, "signin");
    // (the fresh page writes what a first visit writes, and only that: its first road and its first chapter seen)
    const left = await g.ev(() => ({ keys: csNames().concat(["hs_run"]).filter(k => localStorage.getItem(k) != null && localStorage.getItem(k) !== csFresh()[k]), pf: ["hs_pf_auth", "hs_pf_me", "hs_pf_run"].filter(k => localStorage.getItem(k) != null),
      sync: JSON.parse(localStorage.getItem("hs_pf_sync") || "{}"), stash: JSON.parse(localStorage.getItem("hs_pf_stash") || "null") }));
    if (left.keys.length || left.pf.length) fail(W, "sign-out left on the device: " + left.keys.concat(left.pf).join());
    if (left.sync.owner !== "" || left.sync.ver || left.sync.run) fail(W, "the sync state after sign-out: " + JSON.stringify(left.sync));
    if (!left.stash || left.stash.uid !== uid || !/tushpa/.test(left.stash.doc.keys.hs_records || "")) fail(W, "the unsent progress is not waiting in the stash: " + JSON.stringify(left.stash).slice(0, 200));
    await S.control("rest", { mode: "up" });
    // the same player back: the stash joins his save
    await returning(g, "aram");
    const sv = await until(async () => { const s = await saveOf(uid); return s && /tushpa/.test(s.data.keys.hs_records || "") ? s : null; }, 10000, "the stash on the server").catch(e => { fail(W, e.message); return null; });
    if (await store(g, "hs_pf_stash")) fail(W, "the stash was kept after it joined the save");
    if (!/tushpa/.test((await synced(g)).hs_records || "")) fail(W, "the stash's progress is not on the device");
    // sign out with a connection: the save goes, the device starts fresh, the account keeps everything
    await pressWelcome(g, "Campaign Map");
    await gate(g, "");
    await toMap(g);
    await accountTab(g);
    await g.press(acBtn("Sign out"));
    const before = (await S.control("state")).sessions;
    await pressGo(g, acBtn("Sign out"));
    await gate(g, "signin");
    if ((await S.control("state")).sessions !== before - 1) fail(W, "sign-out left the server's session open");
    const gone = await g.ev(() => csNames().concat(["hs_run", "hs_pf_auth", "hs_pf_me", "hs_pf_stash"]).filter(k => localStorage.getItem(k) != null && localStorage.getItem(k) !== csFresh()[k]));
    if (gone.length) fail(W, "sign-out left " + gone.join());
    const kept = await saveOf(uid);
    if (!kept || !/erebuni/.test(kept.data.keys.hs_records) || !/tushpa/.test(kept.data.keys.hs_records)) fail(W, "the account lost progress at sign-out");
    // a fresh start for the next person: a guest here sees an empty campaign
    const wt = await g.ev(() => ({ held: LEVELS.filter((L, i) => levelConquered(i)).length }));
    if (wt.held !== 0) fail(W, "the next person on this device sees " + wt.held + " battlefields held");
    await done(g, W);
    await flow13del(C);
    if (C.key === "desk" || C.key === "ses") { await flow13more(C); await flow13gone(C); }
  };

  // flow 13, the deletion (work package P8; 1.5, RULINGS S10). The question names what goes and leads with Keep my
  // account; Keep changes nothing; with no connection nothing is deleted and the tab says so (desktop and 667x320);
  // Delete everything removes every row of that player in highland and none of another player's, leaves the shared
  // sign-in (auth.users, its identities) alone, clears the device (the account's progress, its session, its
  // stash, its traces in hs_pf_cfg, the events not sent), gives the device a new anonymous id, and returns to the
  // gate, which says it is done; the next visit's account_deleted count is a visitor's. The same person signing in
  // again is a new player (the name card).
  const rowsOf = async (uid) => (await S.query(`select (select count(*) from highland.hs_profiles where user_id = $1)::int as profile, (select count(*) from highland.hs_saves where user_id = $1)::int as saves,
    (select count(*) from highland.hs_runs where user_id = $1)::int as runs, (select count(*) from highland.hs_scores where user_id = $1)::int as scores,
    (select count(*) from highland.hs_score_best where user_id = $1)::int as boards, (select count(*) from highland.hs_sessions where uid = $1)::int as visits,
    (select count(*) from highland.hs_admins where user_id = $1)::int as admin, (select count(*) from highland.hs_rate where key = $1::text)::int as rate,
    (select count(*) from auth.users where id = $1)::int as auth_user, (select count(*) from auth.identities where user_id = $1)::int as auth_ids`, [uid]))[0];
  // an Account tab's button pressed as the player does, scrolled to first (the Hall scrolls inside on a phone)
  const pressAc = async (g, words, go) => {
    await g.ev(w => { const b = Array.from(document.querySelectorAll(".acTab .btn")).find(x => x.textContent === w); if (b) b.scrollIntoView({ block: "nearest" }); }, words);
    await g.frames(2);
    if (go) await pressGo(g, acBtn(words)); else await g.press(acBtn(words));
  };
  const flow13del = async (C) => {
    const W = "flow 13 (Delete my account) " + C.name;
    await resetStack();
    // another player, whose rows must not move
    const B = await open(C, { init: EVON });
    await newPlayer(B, "bagrat", "Bagrat");
    const ub = await uidOf(B);
    await pressWelcome(B, "Campaign Map"); await gate(B, ""); await toMap(B);
    await B.ev(() => storeRecord(0, { stars: [0, 1, 0], lives: [0, 9, 0], endless: [0, 0, 0] }));
    await until(async () => { const sv = await saveOf(ub); return sv && /erebuni/.test(sv.data.keys.hs_records || ""); }, 10000, "Bagrat's save").catch(e => fail(W, e.message));
    await done(B, W + " (Bagrat)");
    const bBefore = await rowsOf(ub);
    // the player who deletes: signed in, playing, his counts and save on the server
    const g = await open(C, { init: EVON });
    await newPlayer(g, "aram", "Aram");
    const uid = await uidOf(g);
    await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
    await g.ev(() => { storeRecord(0, { stars: [0, 3, 0], lives: [0, 20, 0], endless: [0, 0, 0] }); storeRecord(1, { stars: [0, 2, 0], lives: [0, 11, 0], endless: [0, 0, 0] }); });
    await until(async () => { const sv = await saveOf(uid); return sv && /tushpa/.test(sv.data.keys.hs_records || ""); }, 10000, "Aram's save").catch(e => fail(W, e.message));
    await g.ev(() => window.__hsEvKick && window.__hsEvKick());
    await until(async () => (await rowsOf(uid)).visits > 0, 15000, "Aram's visit on the server").catch(e => fail(W, e.message));
    await S.control("admin", { user_id: uid });
    const before = await rowsOf(uid);
    if (!(before.profile && before.saves && before.visits && before.admin && before.auth_user && before.auth_ids)) fail(W, "Aram's rows before: " + JSON.stringify(before));
    const aid0 = JSON.parse(await store(g, "hs_pf_aid"));
    // the question
    await accountTab(g);
    await pressAc(g, "Delete my account");
    const ask = await g.ev(() => hallBodyEl.innerText.replace(/\s+/g, " "));
    for (const w of ["Delete your account? Your player name, your progress, your scores and the counts of your play are removed from our server and from this device. This cannot be undone.",
      "Your sign-in with Google itself stays with our server's sign-in service", "Keep my account", "Delete everything", "Privacy"]) if (!ask.includes(w)) fail(W, "the question lacks \"" + w + "\": " + ask);
    const focus = await g.ev(() => document.activeElement && document.activeElement.textContent);
    if (focus !== "Keep my account") fail(W, "the question's focus is on " + JSON.stringify(focus) + ", not Keep my account");
    const pvl = await g.ev(() => (Array.from(document.querySelectorAll(".acTab a")).find(a => a.textContent === "Privacy") || {}).getAttribute("href"));
    if (pvl !== "?privacy#delete") fail(W, "the question's privacy link goes to " + pvl);
    await audit(g, W + " the question", { root: "#hall", parts: ["#hallBody", "#hallTabs", "#hallClose"], primary: [".acTab .btn"], primaryRequired: true, scroll: "inside" }, "delete-ask-" + C.key);
    // Keep my account: nothing changes
    await pressAc(g, "Keep my account");
    if (!(await g.ev(() => !!Array.from(document.querySelectorAll(".acTab .btn")).find(b => b.textContent === "Delete my account")))) fail(W, "Keep my account did not bring the tab back");
    if (JSON.stringify(await rowsOf(uid)) !== JSON.stringify(before)) fail(W, "Keep my account changed the server's rows");
    // no connection: nothing deleted, the tab says so, the player stays signed in
    if (C.key === "desk" || C.key === "ses") {
      await S.control("rest", { mode: "down" });
      await pressAc(g, "Delete my account");
      await pressAc(g, "Delete everything");
      await g.page.waitForFunction(() => /could not be deleted/.test((document.querySelector(".acTab .acErr") || {}).textContent || ""), null, { timeout: 40000 })
        .catch(async () => fail(W, "no word when the deletion could not go: " + await g.ev(() => hallBodyEl.innerText)));
      const e = await g.ev(() => ({ line: document.querySelector(".acTab .acErr").textContent, auth: !!localStorage.getItem("hs_pf_auth"), btns: Array.from(document.querySelectorAll(".acTab .btn")).map(b => b.textContent + (b.disabled ? "(off)" : "")) }));
      if (!/Nothing was deleted/.test(e.line) || !e.auth || !e.btns.includes("Delete everything")) fail(W, "after a deletion that could not go: " + JSON.stringify(e));
      if (PHOTOS) await g.page.screenshot({ path: path.join(PHOTOS, "delete-fail-" + C.key + ".png") });
      await S.control("rest", { mode: "up" });
      if (JSON.stringify(await rowsOf(uid)) !== JSON.stringify(before)) fail(W, "the failed deletion changed the server's rows");
      await pressAc(g, "Keep my account");
      // no connection at all (the call never leaves the browser): the "no connection" words, nothing deleted
      await g.page.route("**/rest/v1/rpc/hs_delete_account", r => r.abort("internetdisconnected"));
      await pressAc(g, "Delete my account");
      await pressAc(g, "Delete everything");
      await g.page.waitForFunction(() => /could not be deleted/.test((document.querySelector(".acTab .acErr") || {}).textContent || ""), null, { timeout: 20000 }).catch(() => {});
      const e2 = await g.ev(() => ({ line: (document.querySelector(".acTab .acErr") || {}).textContent || "", auth: !!localStorage.getItem("hs_pf_auth") }));
      if (e2.line !== "Your account could not be deleted: there is no connection. Nothing was deleted. Try again when you are online." || !e2.auth) fail(W, "offline, the deletion said: " + JSON.stringify(e2));
      await g.page.unroute("**/rest/v1/rpc/hs_delete_account");
      if (JSON.stringify(await rowsOf(uid)) !== JSON.stringify(before)) fail(W, "the deletion that never left changed the server's rows");
      await pressAc(g, "Keep my account");
    }
    if (C.key === "desk") {
      // the call reached the server, which deleted, but its answer did not come back in time (the page waits 40 s):
      // the words cannot say that nothing was deleted, and trying again (below) is safe and clears the device
      await g.page.route("**/rest/v1/rpc/hs_delete_account", async (r) => {
        let res = null;
        try { res = await r.fetch(); } catch (e) {}
        await new Promise(ok => setTimeout(ok, 45000));
        try { if (res) await r.fulfill({ response: res }); else await r.abort(); } catch (e) {}
      });
      await pressAc(g, "Delete my account");
      await pressAc(g, "Delete everything");
      await g.page.waitForFunction(() => /answer in time/.test((document.querySelector(".acTab .acErr") || {}).textContent || ""), null, { timeout: 60000 }).catch(() => {});
      const e3 = await g.ev(() => (document.querySelector(".acTab .acErr") || {}).textContent || "");
      if (e3 !== "The server did not answer in time. Your account may be deleted already. It is safe to try again.") fail(W, "a deletion whose answer was lost said: " + JSON.stringify(e3));
      await g.page.unroute("**/rest/v1/rpc/hs_delete_account");
      const mid = await rowsOf(uid);
      if (mid.profile !== 0 || mid.auth_user !== 1) fail(W, "the server did not delete behind the lost answer: " + JSON.stringify(mid));
      await pressAc(g, "Keep my account");
    }
    // Delete everything
    await pressAc(g, "Delete my account");
    await pressAc(g, "Delete everything", true);
    await gate(g, "signin");
    const after = await rowsOf(uid);
    for (const k of ["profile", "saves", "runs", "scores", "boards", "visits", "admin", "rate"]) if (after[k] !== 0) fail(W, "after the deletion Aram still has " + after[k] + " " + k);
    if (after.auth_user !== 1 || after.auth_ids !== before.auth_ids) fail(W, "the shared sign-in account was touched: " + JSON.stringify(after));
    const bAfter = await rowsOf(ub);
    if (JSON.stringify(bAfter) !== JSON.stringify(bBefore)) fail(W, "Bagrat's rows moved: " + JSON.stringify(bBefore) + " to " + JSON.stringify(bAfter));
    const line = await g.ev(() => (gateCardEl.querySelector(".gtLine") || {}).textContent || "");
    if (line !== "Your account is deleted. Its name, progress and scores are gone from our server and from this device.") fail(W, "the gate's line after the deletion: " + JSON.stringify(line));
    if (PHOTOS) await g.page.screenshot({ path: path.join(PHOTOS, "delete-done-" + C.key + ".png") });
    const dev = await g.ev(() => ({ keys: csNames().concat(["hs_run"]).filter(k => localStorage.getItem(k) != null && localStorage.getItem(k) !== csFresh()[k]),
      pf: ["hs_pf_auth", "hs_pf_me", "hs_pf_run", "hs_pf_stash", "hs_pf_pkce", "hs_pf_out", "hs_pf_daily", "hs_pf_gone"].filter(k => localStorage.getItem(k) != null), aid: JSON.parse(localStorage.getItem("hs_pf_aid") || "null"),
      // (the new visit may have written its own queue by now: none of it may be the old id's)
      evq: Object.values((JSON.parse(localStorage.getItem("hs_pf_evq") || "{}") || {}).ctx || {}).map(c => c && c.aid),
      cfg: JSON.parse(localStorage.getItem("hs_pf_cfg") || "{}"), sync: JSON.parse(localStorage.getItem("hs_pf_sync") || "{}"),
      held: LEVELS.filter((L, i) => levelConquered(i)).length, ev: (window.__hsEv || []).filter(e => e[0] === "account_deleted").length }));
    if (dev.keys.length || dev.pf.length) fail(W, "the deletion left on the device: " + dev.keys.concat(dev.pf).join());
    if (!dev.aid || dev.aid === aid0) fail(W, "the anonymous id was not replaced (" + aid0 + " then " + dev.aid + ")");
    if (dev.evq.includes(aid0)) fail(W, "hs_pf_evq still holds events of the old anonymous id");
    if (dev.cfg.lastUid === uid || (dev.cfg.seen || []).includes(uid)) fail(W, "hs_pf_cfg still names the account: " + JSON.stringify(dev.cfg));
    if (dev.sync.owner !== "" || dev.sync.ver) fail(W, "the sync state after the deletion: " + JSON.stringify(dev.sync));
    if (dev.held) fail(W, "the device still shows " + dev.held + " battlefields held");
    if (dev.ev !== 1) fail(W, "account_deleted queued " + dev.ev + " times on the next load");
    // the count reaches the server as a visitor's, on the new id, and nothing of the account's is made again
    await g.ev(() => pfEvNow());
    const ad = await until(async () => (await S.query("select s.aid::text, s.uid::text from highland.hs_events e join highland.hs_sessions s on s.sid = e.sid where e.name = 'account_deleted'"))[0], 15000, "account_deleted on the server").catch(e => { fail(W, e.message); return null; });
    if (ad && (ad.uid !== null || ad.aid !== dev.aid)) fail(W, "account_deleted came as " + JSON.stringify(ad));
    await g.wait(1500);
    const again = await rowsOf(uid);
    if (again.visits || again.saves || again.profile) fail(W, "something of the account came back after the deletion: " + JSON.stringify(again));
    if ((await S.query("select count(*)::int n from highland.hs_sessions where aid = $1", [aid0]))[0].n) fail(W, "a visit of the old anonymous id is on the server");
    // the same person again: a new player, asked for a name
    await signIn(g, "aram", "google", "name");
    await done(g, W);
  };

  // flow 13, the deletion seen elsewhere (the P8 review's findings 1 and 2), on the desktop and at 667x320.
  // (1) Another device of the same account, still signed in with the progress on it, loads again after the
  // deletion: it forgets the account too, signs out, the gate says why, and the same person named again on it has
  // none of the old progress on the server. (2) A second tab of the same browser, open on the map: it stops at once
  // (a battle it wins right then is not written), reloads to the gate with the same line, and the same person signing
  // in again has none of the old progress on the server or the device.
  const goneLine = "Your account was deleted in another tab or on another device. Its progress is gone from here too.";
  const flow13gone = async (C) => {
    let W = "flow 13 (deleted on another device) " + C.name;
    {
      await resetStack();
      const g = await open(C);
      await newPlayer(g, "aram", "Aram");
      const uid = await uidOf(g);
      await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
      await g.ev(() => storeRecord(0, { stars: [0, 3, 0], lives: [0, 20, 0], endless: [0, 0, 0] }));
      await until(async () => { const sv = await saveOf(uid); return sv && /erebuni/.test(sv.data.keys.hs_records || ""); }, 10000, "Aram's save").catch(e => fail(W, e.message));
      const h = await open(C);
      await returning(h, "aram");
      await pressWelcome(h, "Campaign Map"); await gate(h, ""); await toMap(h);
      await h.page.waitForFunction(() => /erebuni/.test(localStorage.getItem("hs_records") || "") && csState().owner && !csState().dirty, null, { timeout: 15000 }).catch(() => fail(W, "the second device did not get the progress"));
      const aidH = JSON.parse(await store(h, "hs_pf_aid"));
      await accountTab(g);
      await pressAc(g, "Delete my account");
      await pressAc(g, "Delete everything", true);
      await gate(g, "signin");
      await done(g, W + " (device 1)");
      await h.page.reload();
      await gate(h, "signin");
      const line = await h.ev(() => (gateCardEl.querySelector(".gtLine") || {}).textContent || "");
      if (line !== goneLine) fail(W, "the second device's gate says " + JSON.stringify(line));
      const dev = await h.ev(() => ({ keys: csNames().concat(["hs_run"]).filter(k => localStorage.getItem(k) != null && localStorage.getItem(k) !== csFresh()[k]),
        pf: ["hs_pf_auth", "hs_pf_me", "hs_pf_run", "hs_pf_stash", "hs_pf_gone"].filter(k => localStorage.getItem(k) != null),
        sync: JSON.parse(localStorage.getItem("hs_pf_sync") || "{}"), aid: JSON.parse(localStorage.getItem("hs_pf_aid") || "null"), ev: (window.__hsEv || []).filter(e => e[0] === "account_deleted").length }));
      if (dev.keys.length || dev.pf.length) fail(W, "the second device kept " + dev.keys.concat(dev.pf).join());
      if (dev.sync.owner !== "") fail(W, "the second device's sync state: " + JSON.stringify(dev.sync));
      if (!dev.aid || dev.aid === aidH) fail(W, "the second device's anonymous id was not replaced");
      if (dev.ev) fail(W, "the second device counted account_deleted again");
      await signIn(h, "aram", "google", "name");
      await h.page.fill("#gate .gtField", "Aram Two");
      await pressGo(h, "#gate .gtGo");
      await gate(h, "welcome");
      await h.wait(4000);
      const sv = await saveOf(uid);
      if (sv && /erebuni/.test(sv.data.keys.hs_records || "")) fail(W, "the deleted progress came back to the server from the second device");
      await done(h, W + " (device 2)");
    }
    W = "flow 13 (deleted in another tab) " + C.name;
    {
      await resetStack();
      const g = await open(C);
      await newPlayer(g, "aram", "Aram");
      const uid = await uidOf(g);
      await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
      await g.ev(() => storeRecord(0, { stars: [0, 3, 0], lives: [0, 20, 0], endless: [0, 0, 0] }));
      await until(async () => { const sv = await saveOf(uid); return sv && /erebuni/.test(sv.data.keys.hs_records || ""); }, 10000, "Aram's save").catch(e => fail(W, e.message));
      const p2 = await g.ctx.newPage();
      const errs2 = [];
      p2.on("pageerror", e => errs2.push(e.message));
      await p2.goto(SITE + "/");
      await p2.waitForFunction(() => typeof gateState !== "undefined" && typeof Platform !== "undefined" && document.readyState === "complete" && gateUp && gateState === "welcome" && !gateCardEl.querySelector("button:disabled"), null, { timeout: 30000 });
      await p2.evaluate(() => { const b = Array.from(gateCardEl.querySelectorAll("button")).find(b => b.textContent.startsWith("Campaign Map")); b.click(); });
      await p2.waitForFunction(() => !gateUp, null, { timeout: 15000 });
      // the second tab wins a battle while the first is clearing the device (as its session goes)
      await p2.evaluate(() => window.addEventListener("storage", (e) => {
        if (e.key === "hs_pf_auth" && !e.newValue) { try { storeRecord(1, { stars: [0, 2, 0], lives: [0, 11, 0], endless: [0, 0, 0] }); window.__wonAfter = 1; } catch (x) { window.__wonAfter = String(x); } }
      }));
      await accountTab(g);
      await pressAc(g, "Delete my account");
      await pressAc(g, "Delete everything", true);
      await gate(g, "signin");
      // the second tab reloads to the gate by itself
      const t2 = Date.now();
      let st2 = null;
      for (;;) {
        st2 = await p2.evaluate(() => typeof gateState === "undefined" || document.readyState !== "complete" ? null : { up: gateUp, st: gateState, line: (gateCardEl.querySelector(".gtLine") || {}).textContent || "", won: window.__wonAfter || 0 }).catch(() => null);
        if (st2 && st2.up && st2.st === "signin" && !st2.won) break;
        if (Date.now() - t2 > 20000) break;
        await new Promise(r => setTimeout(r, 300));
      }
      if (!st2 || !st2.up || st2.st !== "signin" || st2.won) fail(W, "the second tab did not reload to the gate: " + JSON.stringify(st2));
      else if (st2.line !== goneLine) fail(W, "the second tab's gate says " + JSON.stringify(st2.line));
      for (const e of errs2) fail(W, "second tab: " + e);
      await p2.close();
      const left = await g.ev(() => ({ keys: csNames().concat(["hs_run"]).filter(k => localStorage.getItem(k) != null && localStorage.getItem(k) !== csFresh()[k]),
        sync: JSON.parse(localStorage.getItem("hs_pf_sync") || "{}"), gone: localStorage.getItem("hs_pf_gone") }));
      if (left.keys.length) fail(W, "the device holds " + left.keys.join() + " after the second tab");
      if (left.sync.owner !== "" || left.gone != null) fail(W, "the device's sync state or mark after the second tab: " + JSON.stringify(left));
      await signIn(g, "aram", "google", "name");
      await g.page.fill("#gate .gtField", "Aram Again");
      await pressGo(g, "#gate .gtGo");
      await gate(g, "welcome");
      await g.wait(4000);
      const sv = await saveOf(uid);
      if (sv && /erebuni|tushpa/.test(sv.data.keys.hs_records || "")) fail(W, "the deleted progress came back to the server from the second tab");
      if (/erebuni|tushpa/.test((await store(g, "hs_records")) || "")) fail(W, "the device shows the deleted progress again");
      await done(g, W);
    }
  };

  // flow 13, more (the P3 review's findings 1 and 5), on the desktop and the small iPhone. (1) This account's stash
  // that would join while a battle is on the field waits for the battle's end, and loses nothing. (2) A load that
  // could not reach the save: sign-out still takes the account's progress off the device (asked first, as it
  // cannot be saved), and keeps the unsent part in the stash.
  const flow13more = async (C) => {
    let W = "flow 13 (a stash and a battle) " + C.name;
    {
      await resetStack();
      const g = await open(C);
      await newPlayer(g, "aram", "Aram");
      const uid = await uidOf(g);
      await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
      await g.ev(() => { storeRecord(0, { stars: [0, 2, 0], lives: [0, 15, 0], endless: [0, 0, 0] }); });
      await until(async () => { const s = await saveOf(uid); return s && /erebuni/.test(s.data.keys.hs_records || ""); }, 10000, "erebuni on the server").catch(e => fail(W, e.message));
      await S.control("rest", { mode: "down" });
      await g.ev(() => storeRecord(1, { stars: [0, 3, 0], lives: [0, 5, 0], endless: [0, 0, 0] }));   // Tushpa won offline: unsent
      await accountTab(g);
      await g.press(acBtn("Sign out"));
      await g.press(acBtn("Sign out"));
      await g.page.waitForFunction(() => /could not be saved yet/.test(hallBodyEl.innerText), null, { timeout: 30000 }).catch(() => {});
      await pressGo(g, acBtn("Sign out anyway"));
      await gate(g, "signin");
      if (!(await store(g, "hs_pf_stash"))) fail(W, "no stash after Sign out anyway");
      // back, with Auth up and the database still down: the join fails and waits; a battle begins; the database is back
      await returning(g, "aram");
      await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
      const upright = C.w < C.h && C.w <= 500;
      if (upright) await g.page.setViewportSize({ width: C.h, height: C.w });
      await g.enterBattle(2);
      await S.control("rest", { mode: "up" });
      await g.ev(() => window.dispatchEvent(new Event("online")));
      await g.wait(8000);
      const r = await g.ev(() => ({ live: battleLive(), stash: !!localStorage.getItem("hs_pf_stash") }));
      if (r.live && !r.stash) fail(W, "the stash was taken while a battle was on the field");
      await abandon(g);
      if (upright) await g.page.setViewportSize({ width: C.w, height: C.h });
      const sv = await until(async () => { const s = await saveOf(uid); return s && /tushpa/.test(s.data.keys.hs_records || "") ? s : null; }, 30000, "the stash's Tushpa on the server after the battle").catch(e => { fail(W, e.message); return null; });
      if (sv && !/erebuni/.test(sv.data.keys.hs_records || "")) fail(W, "the save lost Erebuni");
      if (!/tushpa/.test((await synced(g)).hs_records || "")) fail(W, "the stash's progress is not on the device after the battle");
      if (await store(g, "hs_pf_stash")) fail(W, "the stash was kept after it joined the save");
      await done(g, W);
    }
    W = "flow 13 (sign-out after a load that could not reach the save) " + C.name;
    {
      await resetStack();
      const g = await open(C);
      await newPlayer(g, "aram", "Aram");
      const uid = await uidOf(g);
      await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
      await g.ev(() => { storeRecord(0, { stars: [0, 2, 0], lives: [0, 15, 0], endless: [0, 0, 0] }); });
      await until(async () => { const s = await saveOf(uid); return s && /erebuni/.test(s.data.keys.hs_records || ""); }, 10000, "erebuni on the server").catch(e => fail(W, e.message));
      await S.control("rest", { mode: "down" });
      await g.page.reload();
      await gate(g, "welcome");
      await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
      // progress made on this load, unsent
      await g.ev(() => storeRecord(1, { stars: [0, 1, 0], lives: [0, 4, 0], endless: [0, 0, 0] }));
      await accountTab(g);
      const line = await g.ev(() => (document.querySelector(".acTab .acSync") || {}).textContent || "");
      if (!/^Waiting for a connection/.test(line)) fail(W, "the sync line on a load that could not reach the save: " + line);
      await g.press(acBtn("Sign out"));
      const words = await g.ev(() => hallBodyEl.innerText.replace(/\s+/g, " "));
      if (!words.includes("Sign out? Your progress stays in your account. This device starts fresh.")) fail(W, "sign-out's words: " + words);
      await g.press(acBtn("Sign out"));
      await g.page.waitForFunction(() => /could not be saved yet/.test(hallBodyEl.innerText), null, { timeout: 30000 }).catch(async () => fail(W, "not asked before signing out unsaved: " + await g.ev(() => hallBodyEl.innerText)));
      await pressGo(g, acBtn("Sign out anyway"));
      await gate(g, "signin");
      const left = await g.ev(() => ({ keys: csNames().concat(["hs_run"]).filter(k => localStorage.getItem(k) != null && localStorage.getItem(k) !== csFresh()[k]), owner: JSON.parse(localStorage.getItem("hs_pf_sync") || "{}").owner, stash: JSON.parse(localStorage.getItem("hs_pf_stash") || "null") }));
      if (left.keys.length || left.owner !== "") fail(W, "sign-out left the account's progress on the device: " + JSON.stringify(left).slice(0, 200));
      if (!left.stash || left.stash.uid !== uid || !/tushpa/.test(left.stash.doc.keys.hs_records || "")) fail(W, "the unsent progress is not in the stash");
      await S.control("rest", { mode: "up" });
      await done(g, W);
    }
  };

  // flow 14: staging (9.3). The page at /next/ signs in, plays and saves on the channel "next", keeps every key on the
  // device under "next:", and a page at / in the same browser sees none of it: no session, no progress, its own
  // save; then /next/ again has all of it
  const flow14 = async (C) => {
    const W = "flow 14 " + C.name;
    await resetStack();
    const g = await open(C, { path: "/next/" });
    await newPlayer(g, "aram", "Aram");
    if (!new URL(g.page.url()).pathname.startsWith("/next/")) fail(W, "the sign-in came back to " + g.page.url() + ", not /next/");
    await clean(g, W);
    const uid = await uidOf(g);
    await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
    await g.ev(() => storeRecord(0, { stars: [0, 3, 0], lives: [0, 20, 0], endless: [0, 0, 0] }));
    const ch = async (c) => (await S.query("select version, data from highland.hs_saves where user_id = $1 and channel = $2", [uid, c]))[0] || null;
    await until(async () => { const sv = await ch("next"); return sv && /erebuni/.test(sv.data.keys.hs_records || ""); }, 10000, "the save on the channel next").catch(e => fail(W, e.message));
    if (await ch("live")) fail(W, "a page at /next/ wrote the live channel's save");
    // the same browser at /: the real storage, read from there
    await g.page.goto(SITE + "/");
    await gate(g, "signin");
    const raw = await g.ev(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    const live = Object.keys(raw).filter(k => !k.startsWith("next:"));
    for (const k of ["hs_pf_auth", "hs_pf_me", "hs_pf_stash"]) if (k in raw) fail(W, "the live channel holds " + k + " after a sign-in at /next/");
    if (/erebuni/.test(raw.hs_records || "")) fail(W, "the live channel's records hold the battle won at /next/");
    for (const k of ["next:hs_pf_auth", "next:hs_pf_me", "next:hs_pf_sync"]) if (!(k in raw)) fail(W, "no " + k + " on the device");
    if (!/erebuni/.test(raw["next:hs_records"] || "")) fail(W, "the records of /next/ are not under next:");
    log("  live keys at /: " + live.join(","));
    // signed in at / too: the live channel's own save, empty of what /next/ won
    await signIn(g, "aram", "google", "welcome");
    await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
    if (await g.ev(() => (localStorage.getItem(RECORDS_KEY) || "").includes(LEVELS[0].id))) fail(W, "signed in at /, the page shows what /next/ won");
    const third = await g.ev(() => LEVELS[2].id);
    await g.ev(() => storeRecord(2, { stars: [0, 1, 0], lives: [0, 3, 0], endless: [0, 0, 0] }));
    await until(async () => { const sv = await ch("live"); return sv && (sv.data.keys.hs_records || "").includes(third); }, 10000, "the live save").catch(e => fail(W, e.message));
    const lv = await ch("live"), nx = await ch("next");
    if (lv && /erebuni/.test(lv.data.keys.hs_records || "")) fail(W, "the live save holds the battle won at /next/");
    if (!nx || (nx.data.keys.hs_records || "").includes(third)) fail(W, "the next save took the live channel's battle: " + JSON.stringify(nx && nx.data.keys.hs_records));
    // and /next/ again: its session and its progress, as left
    await g.page.goto(SITE + "/next/");
    await gate(g, "welcome");
    await pressWelcome(g, "Campaign Map"); await gate(g, ""); await toMap(g);
    const rec = await g.ev(() => localStorage.getItem(RECORDS_KEY) || "");
    if (!rec.includes(await g.ev(() => LEVELS[0].id)) || rec.includes(third)) fail(W, "back at /next/ the records are " + rec);
    await done(g, W);
  };

  // ================================================================ flow 15: the superadmin's Players view (P10)
  const flow15 = async (C) => {
    const W = "flow 15 " + C.name;
    await resetStack();
    // thirty players, made through the game's own functions with tokens as the stack's sign-in signs them (a game
    // session), each with a save carrying the page's summary and a signed-in visit; and an outsider (another app's
    // email account, no profile). Every address is a made-up one on example.com
    const NAMES = ["Aram", "Ani", "Arpi", "Ashot", "Bagrat", "Davit", "Erato", "Gor", "Hayk", "Hrant", "Karen", "Lilit", "Mane", "Mher", "Narek", "Nare", "Oshin",
      "Rafi", "Saro", "Sona", "Tigran", "Vahe", "Vard", "Zara", "Arev", "Anahit", "Artak", "Garnik", "Levon", "Mariam"];
    const N = NAMES.length, sec = () => Math.floor(Date.now() / 1000);
    const tok = (uid) => S.sign({ aud: "authenticated", sub: uid, role: "authenticated", iat: sec(), exp: sec() + 3600, is_anonymous: false, amr: [{ method: "oauth", timestamp: sec() }] });
    const rpcAs = async (uid, fn, body) => {
      const r = await fetch(API + "/rest/v1/rpc/" + fn, { method: "POST", body: JSON.stringify(body), headers: { apikey: S.anonKey, Authorization: "Bearer " + (uid ? tok(uid) : S.anonKey),
        "Content-Type": "application/json", "Accept-Profile": "highland", "Content-Profile": "highland" } });
      return { status: r.status, body: await r.json().catch(() => null) };
    };
    const su = await S.db.client("hs", "supabase_admin");
    const uidOf = (i) => "5f000000-0000-4000-8000-" + String(i + 1).padStart(12, "0");
    const mailOf = (i) => "p10-player-" + (i + 1) + "@example.com";
    let g;
    try {
      g = await open(C, { path: "/?stats" });
      const ids = await g.ev(() => LEVELS.map(L => L.id));
      for (let i = 0; i < N; i++) {
        const prov = ["google", "facebook", "discord"][i % 3];
        await su.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [uidOf(i), mailOf(i)]);
        await su.query("insert into auth.identities (provider, provider_id, user_id, email, identity_data) values ($1, $2, $3, $4, $5)",
          [prov, "p10-" + i, uidOf(i), mailOf(i), JSON.stringify({ full_name: NAMES[i] + " Person" })]);
        const nm = await rpcAs(uidOf(i), "hs_profile_set_name", { p_name: NAMES[i] });
        if (nm.status !== 200) throw new Error("the name of player " + i + ": " + JSON.stringify(nm.body));
        await rpcAs(uidOf(i), "hs_save_put", { p_expected: 0, p_device: "iPhone", p_data: { v: 1, keys: {}, sum: { v: 1, won: [i % 5, i % 4, i % 2], stars: i, farN: 1 + (i % 17),
          far: ids[i % 17], heroes: { kingdoms: 1 + (i % 5) }, council: { bows: i % 3 } } } });
        const aid = "5e000000-0000-4000-8000-" + String(i + 1).padStart(12, "0");
        await rpcAs(uidOf(i), "hs_track", { p_ctx: { aid, sid: "p10-visit-" + i, dev: i % 2 ? "desktop" : "phone", os: i % 2 ? "windows" : "ios", browser: i % 2 ? "chrome" : "safari", channel: "live" },
          p_events: [{ n: "page_load", q: 1 }, { n: "victory", q: 2, p: { lv: ids[i % 17], diff: 1, mode: "campaign", lives: 15, lives_max: 20, waves: 10, stars: 2, sec: 60 * (i + 1) } },
            { n: "page_hide", q: 3, p: { where: "victory", sec: 120 * (i + 1) } }] });
      }
      await su.query("insert into auth.users (id, email, email_confirmed_at) values ('5f000000-0000-4000-8000-0000000000ff', 'p10-outsider@example.com', now())");
      await su.query("insert into auth.identities (provider, provider_id, user_id, email) values ('email', '5f000000-0000-4000-8000-0000000000ff', '5f000000-0000-4000-8000-0000000000ff', 'p10-outsider@example.com')");
      // the owner signs in on ?stats with Google: not yet an admin, the page is closed to him
      await g.page.waitForFunction(() => typeof stShell !== "undefined" && document.readyState === "complete" && !!document.querySelector('#statsPage .gateBtn[data-p="google"]'), null, { timeout: 30000 });
      await S.control("provider", { identity: { provider_id: "p10-owner-" + C.key, email: "p10-owner@example.com", verified: true, name: "Owner Person" } });
      await pressStats(g, '#statsPage .gateBtn[data-p="google"]');
      await g.page.waitForFunction(() => typeof stShell !== "undefined" && document.readyState === "complete" && !$("statsPage").hidden && /owner/.test($("statsBody").innerText), null, { timeout: 30000 });
      if (!/This page is for the game's owner\./.test(await g.ev(() => $("statsBody").innerText))) fail(W, "before the grant: " + await g.ev(() => $("statsBody").innerText.slice(0, 120)));
      const owner = (await S.query("select id::text from auth.users where email = 'p10-owner@example.com'"))[0].id;
      // the grant, as the owner runs it: as postgres, on the database itself (here the stack's own connection)
      const said = (await S.control("superadmin", { email: "P10-Owner@example.com" })).said;
      if (!said.includes(owner) || /@/.test(said)) fail(W, "the grant's answer: " + said);
      await g.page.goto(SITE + "/?stats");
      await statsUp(g);
      const tabs = await g.ev(() => Array.from(document.querySelectorAll("#statsPage .stTab")).map(b => b.dataset.tab + ":" + b.getAttribute("aria-pressed")));
      if (tabs.join() !== "numbers:true,players:false") fail(W, "the superadmin's tabs: " + tabs.join());
      // the Players tab
      const listUp = () => g.page.waitForFunction(() => typeof stP !== "undefined" && !stP.busy && !!document.querySelector("#statsPage .stCount"), null, { timeout: 40000 });
      const rows = () => g.ev(() => Array.from(document.querySelectorAll("#statsPage .stPlayers tbody tr")).map(tr => Array.from(tr.children).map(td => td.innerText.replace(/\s+/g, " ").trim())));
      const count = () => g.ev(() => document.querySelector("#statsPage .stCount").textContent);
      const pages = () => g.ev(() => { const e = document.querySelector("#statsPage .stPageWords"); return e ? e.textContent : ""; });
      await pressStats(g, '#statsPage .stTab[data-tab="players"]');
      await listUp();
      let r = await rows();
      if (r.length !== 25 || !/Every player: 30\./.test(await count())) fail(W, "the list: " + r.length + " rows, " + await count());
      const heads = await g.ev(() => Array.from(document.querySelectorAll("#statsPage .stPlayers thead th")).map(th => th.innerText.replace(/[▲▼]/g, "").trim()));
      for (const h of ["Name", "Email", "Sign-in", "First seen", "Last seen", "Visits", "Time on page", "Battle clock", "Won E / N / H", "Stars", "Furthest", "Heroes", "Council", "Devices"])
        if (!heads.includes(h)) fail(W, "no column " + h + ": " + heads.join(", "));
      const helps = await g.ev(() => Array.from(document.querySelectorAll("#statsPage .stPlayers thead th")).map(th => th.title));
      if (!/page_hide|hidden or closed/.test(helps[6]) || !/battle clock/.test(helps[7]) || !/events/.test(helps[7]) || !/visits/.test(helps[6])) fail(W, "the time columns' help: " + helps.slice(6, 8).join(" | "));
      const emailCol = r.map(x => x[1]);
      if (!emailCol.every(e => /^p10-player-\d+@example\.com$/.test(e))) fail(W, "the email column: " + emailCol.slice(0, 3).join(", "));
      const text0 = await g.ev(() => $("statsPage").innerText);
      if (/p10-outsider|p10-owner/.test(text0)) fail(W, "another app's account, or the owner who is no player, is in the list");
      if (!/Person/.test(r[0][0])) fail(W, "the name column lacks the provider's name: " + r[0][0]);
      await audit(g, W + " players", { root: "#statsPage", parts: ["#statsPage .stWrap"], primary: ["#statsBack"], primaryRequired: true, scroll: "page" }, "p10-players-" + C.key);
      // sorted by name, A to Z, and again Z to A
      await pressStats(g, '#statsPage .stSort[data-sort="name"]');
      await listUp();
      const lower = (a) => a.map(x => x[0].split(" ")[0].toLowerCase());
      let nm = lower(await rows());
      if (nm.join() !== NAMES.map(x => x.toLowerCase()).sort().slice(0, 25).join()) fail(W, "sorted by name: " + nm.slice(0, 5).join(", "));
      await pressStats(g, '#statsPage .stSort[data-sort="name"]');
      await listUp();
      nm = lower(await rows());
      if (nm.join() !== NAMES.map(x => x.toLowerCase()).sort().reverse().slice(0, 25).join()) fail(W, "sorted by name, Z to A: " + nm.slice(0, 5).join(", "));
      // by battle clock, the most first
      await pressStats(g, '#statsPage .stSort[data-sort="battle"]');
      await listUp();
      r = await rows();
      if (r[0][0].split(" ")[0] !== NAMES[N - 1] || r[0][7] !== "30 min") fail(W, "sorted by battle clock: " + r[0].slice(0, 8).join(" | "));
      // a search by email, by the provider's name; then cleared
      await g.page.fill("#statsPage .stSearch", "PLAYER-17@example");
      await pressStats(g, "#statsPage .stFind");
      await listUp();
      r = await rows();
      if (r.length !== 1 || r[0][1] !== mailOf(16)) fail(W, "a search by email: " + JSON.stringify(r.map(x => x[1])));
      await g.page.fill("#statsPage .stSearch", "lilit person");
      await pressStats(g, "#statsPage .stFind");
      await listUp();
      r = await rows();
      if (r.length !== 1 || !/^Lilit/.test(r[0][0])) fail(W, "a search by the provider's name: " + JSON.stringify(r.map(x => x[0])));
      await g.page.fill("#statsPage .stSearch", "p10-outsider");
      await pressStats(g, "#statsPage .stFind");
      await listUp();
      if ((await rows()).length !== 0 || !/No player matches/.test(await g.ev(() => $("statsBody").innerText))) fail(W, "a search for another app's account found someone");
      await pressStats(g, "#statsPage .stClear");
      await listUp();
      // the pages, sorted by name
      await pressStats(g, '#statsPage .stSort[data-sort="name"]');
      await listUp();
      if (await g.ev(() => stP.desc)) { await pressStats(g, '#statsPage .stSort[data-sort="name"]'); await listUp(); }
      if ((await pages()) !== "Showing 1 to 25 of 30") fail(W, "the first page: " + await pages());
      await pressStats(g, "#statsPage .stNext");
      await listUp();
      r = await rows();
      if ((await pages()) !== "Showing 26 to 30 of 30" || r.length !== 5 || lower(r).join() !== NAMES.map(x => x.toLowerCase()).sort().slice(25).join()) fail(W, "the second page: " + await pages() + " " + lower(r).join());
      if (!(await g.ev(() => document.querySelector("#statsPage .stNext").disabled))) fail(W, "Next is still on, on the last page");
      await pressStats(g, "#statsPage .stPrev");
      await listUp();
      if ((await pages()) !== "Showing 1 to 25 of 30") fail(W, "back to the first page: " + await pages());
      // a player's page
      const first = (await rows())[0][0].split(" ")[0], fi = NAMES.indexOf(first);
      await pressStats(g, "#statsPage .stPlayers tbody tr:first-child .stLink");
      await g.page.waitForFunction(() => !stP.busy && /^Player: /.test($("statsTitle").textContent), null, { timeout: 40000 });
      const pp = await g.ev(() => ({ title: $("statsTitle").textContent, cards: Array.from(document.querySelectorAll("#statsPage .stCard h2")).map(h => h.textContent), text: $("statsBody").innerText }));
      if (pp.title !== "Player: " + first) fail(W, "the player's page title: " + pp.title);
      for (const h of ["Who", "Play time", "Progress", "Battles", "Ranked runs", "Recent visits", "Devices"]) if (!pp.cards.includes(h)) fail(W, "the player's page lacks " + h + ": " + pp.cards.join(", "));
      if (!pp.text.includes(mailOf(fi)) || !pp.text.includes(first + " Person") || !/Won/.test(pp.text) || !pp.text.includes((fi + 1) * 2 + " min")) fail(W, "the player's page: " + pp.text.slice(0, 300));
      await audit(g, W + " player", { root: "#statsPage", parts: ["#statsPage .stWrap"], primary: ["#statsBack"], primaryRequired: true, scroll: "page" }, "p10-player-" + C.key);
      await pressStats(g, "#statsPage .stBackList");
      await listUp();
      // the audit: one row a read, the superadmin's, never an address or a search's words
      const reads = g.reqs.filter(u => /\/rpc\/hs_super_player(s)?$/.test(u)).length;
      const au = await S.query("select who::text, what, player::text, args from highland.hs_super_audit order by id");
      const mine = au.filter(x => x.what === "players" || x.what === "player");
      if (mine.length !== reads || !mine.every(x => x.who === owner)) fail(W, "the audit: " + mine.length + " rows for " + reads + " reads (" + JSON.stringify(mine.slice(-2)) + ")");
      if (!mine.some(x => x.what === "player" && x.player === uidOf(fi))) fail(W, "the audit has no row for the player's page");
      if (!mine.some(x => x.args && x.args.searched === true)) fail(W, "the audit does not say a search was made");
      if (/@|lilit|player-17|outsider/i.test(JSON.stringify(au.map(x => x.args)))) fail(W, "the audit keeps a search's words or an address");
      if (!au.some(x => x.what === "grant" && x.player === owner && x.who === null)) fail(W, "the grant is not in the audit");
      notes.flows["p10 reads@" + C.key] = reads;
      // nothing of it on the device
      const kept = await g.ev(() => { let t = ""; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); t += k + "=" + localStorage.getItem(k) + "\n"; } return t; });
      if (/p10-player|Person/.test(kept)) fail(W, "the device's storage holds a player's email or name");
      // absent for every other role: revoked (the admin row given with it goes too), then an admin who is not super
      const rv = (await S.control("superadmin", { email: "p10-owner@example.com", revoke: true })).said;
      if (!rv.includes(owner)) fail(W, "the revoke's answer: " + rv);
      await g.page.goto(SITE + "/?stats");
      await g.page.waitForFunction(() => typeof stShell !== "undefined" && document.readyState === "complete" && !$("statsPage").hidden && /owner/.test($("statsBody").innerText), null, { timeout: 30000 });
      await S.control("admin", { user_id: owner });
      await g.page.goto(SITE + "/?stats");
      await statsUp(g);
      const plain = await g.ev(() => ({ tabs: document.querySelectorAll("#statsPage .stTab").length, text: $("statsPage").innerText, cards: Array.from(document.querySelectorAll("#statsPage .stCard h2")).map(h => h.textContent) }));
      if (plain.tabs || /@example\.com|Person/.test(plain.text) || !plain.cards.includes("Health")) fail(W, "an admin who is not super: " + JSON.stringify({ tabs: plain.tabs, cards: plain.cards }));
      const forged = await g.ev(async () => { const x = await pfRpc("hs_super_players", {}, { auth: true, timeout: 8000 }); return x.status + " " + x.code; });
      if (forged !== "403 not_superadmin") fail(W, "an admin who is not super calling the list by hand: " + forged);
    } finally { await su.end(); }
    await done(g, W);
  };

  // ================================================================ flow 7: scores and boards (work package P5)
  // The page's own ruleset published from the stats page; ranked battles won as vic.js wins one (the last wave's field
  // cleared in the game's own loop), their clock and gold set as a real battle's would stand and the run's start moved
  // back through the stack's control by as long; the strip in each of its states; the Hall's board, its controls and
  // its layouts; the map's door. Every score the page shows is the server's, and is held to ref.js's arithmetic.
  const refm = require("../platform/ref");
  const f7who = (key, n) => ({ identity: { provider_id: "p5-" + key + "-" + n, email: "p5-" + key + "-" + n + "@example.com", verified: true, name: "P5 " + n } });
  // a player of the live game who has won five battlefields (as flow 6's), with no battle in progress
  const f7prog = (() => {
    const won = ["erebuni", "tushpa", "avarayr", "dvin", "tashir"], rec = {}, eraOf = { erebuni: 0, tushpa: 0, avarayr: 1, dvin: 2, tashir: 2 };
    // (Erebuni held with 16 of 20 before: the first ranked win there with 17 brings the "New best" ribbon into the record row)
    won.forEach((id, i) => { rec[id] = { stars: [0, 3 - (i % 2), 0], lives: [0, i ? 20 - i : 16, 0], endless: [0, 0, 0] }; });
    const o = { hs_records: JSON.stringify(rec), hs_tutorial_done: "1", hs_chapters_seen: JSON.stringify(["kingdoms", "faith", "crowns", "night", "artsakh"]),
      hs_unlocked_seen: JSON.stringify(won.concat(["sevan"])), hs_open_kept: JSON.stringify(["sevan"]), hs_tricks_seen: JSON.stringify(["guard", "scout"]) };
    won.forEach(id => { o["hs_best_" + id + "_" + eraOf[id]] = "21"; });
    return o;
  })();
  const F7SHOTS = PHOTOS ? path.join(PHOTOS, "p5") : null;
  if (F7SHOTS) fs.mkdirSync(F7SHOTS, { recursive: true });
  const f7photo = async (g, name) => { if (F7SHOTS && ["desk", "ipad", "ses"].includes(g.o.key)) await g.page.screenshot({ path: path.join(F7SHOTS, name + "-" + g.o.key + ".png") }); };
  const upr = (C) => C.w < C.h && C.w <= 500;
  // the strip as the page shows it: the row under #ovGrowth, or held sideways the words in the record row and the round button
  const strip = (g) => g.ev(() => {
    const s = $("ovScore"), r = $("pfRecScore"), b = $("boardBtn"), vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0;
    // (held sideways the record row's words must lie on the screen, whole, on one line)
    const rr = r ? r.getBoundingClientRect() : null, recOut = !!rr && (rr.left < -0.5 || rr.right > innerWidth + 0.5 || (r.tagName === "SPAN" && rr.height > 30) || r.scrollWidth > r.clientWidth + 1 || $("ovRecord").scrollWidth > $("ovRecord").clientWidth + 1);
    return { recOut, full: r ? r.dataset.full : null, row: vis(s), words: s ? s.querySelector(".scWords").textContent : "", rec: r ? r.textContent : null, board: vis(b) && getComputedStyle(b).visibility !== "hidden",
      side: phoneWide(), boardRow: !!(s && s.querySelector(".scBoard") && vis(s.querySelector(".scBoard"))), state: SC.page ? SC.page.state : null, score: SC.page ? SC.page.score : null };
  });
  // the strip's words as they read at this size: "Score 7,750 · #1 this week" on the row; "· 7,750 · #1 this week" in the record row
  // (held sideways beside a "New best" ribbon the row's words may be the short form, "· 9,076 · #1": what the strip says
  // is then its full words, kept on the element, and the short form must begin as they do)
  const stripSays = (st) => (st.side ? st.full || "" : st.words);
  // a ranked battle from the map as a player goes (the battlefield's chronicle, its button), won as vic.js wins one.
  // o: { lv, diff, sec, spent, lives, gift, runback (seconds; false: none), token (wait for it; default true), before (async,
  // before the first horn), last (async, before the last wave is cleared) }. An upright phone is turned sideways for
  // the battle as the game asks of a player there, and back for the victory page
  const f7win = async (g, W, o) => {
    const C = g.o, up = upr(C);
    if (up) await g.page.setViewportSize({ width: C.h, height: C.w });
    await g.ev(([lv, diff]) => { if (Nardi.isOpen()) Nardi.close(); curDiff = prefDiff = diff; openCampaignMap(lv); selectMapLevel(lv); showBrief(); }, [o.lv || 0, o.diff == null ? 1 : o.diff]);
    await g.frames(3);
    for (let k = 0; k < 6 && !(await g.ev(() => battleLive())); k++) {
      await g.ev(() => { const e = $("startBtn"); if (e) e.scrollIntoView({ block: "nearest" }); });
      await g.frames(2);
      const q = await g.reach("#startBtn");
      if (q.why) { await g.wait(200); continue; }
      await g.tapAt(q.x, q.y);
      await g.wait(300);
    }
    if (!(await g.ev(() => battleLive()))) throw new Error("the battle did not begin from its chronicle (" + await g.ev(() => menuMode) + ")");
    if (o.before) await o.before();
    // (a first-time card or bubble over the field holds the horn: put away, as a player reads and closes it)
    await g.ev(() => { for (let k = 0; k < 6 && trickHold(); k++) dropTrickCards(); });
    await g.ev(() => { if (!battle.started) startWave(); });
    await g.page.waitForFunction(() => battle.started, null, { timeout: 10000 }).catch(async () => { throw new Error("no horn: " + JSON.stringify(await g.ev(() => ({ phase, live: battleLive(), tut: !!tut, mode: menuMode, wave: waveIdx, paused, hold: trickHold(), over: gameOver, cards: document.querySelector(".trickCard.on, #trickCard.on") ? 1 : 0 })))); });
    const ranked = await g.ev(() => battleRanked());
    if (!ranked && o.ranked !== false) fail(W, "the battle is not ranked");
    // (this page's own token: the shared key may hold another tab's)
    if (o.token !== false) await until(() => g.ev(() => SC.why === "held" && !!SC.tok), 15000, "the run token").catch(e => fail(W, e.message));
    const uid = JSON.parse(await store(g, "hs_pf_auth") || "null");
    if (o.runback !== false && uid) await S.control("runback", { user_id: uid.uid, seconds: (o.sec || 900) + 60 });
    if (o.last) await o.last();
    await g.ev(o => {
      battle.sec = o.sec == null ? 900 : o.sec; battle.spent = o.spent == null ? 400 : o.spent; battle.build = battle.spent;
      // (gold paid in as a battle's waves would pay it: no wave of this one was fought for its bounties)
      battle.earned = Math.max(battle.earned, o.earned == null ? 2400 : o.earned); battle.bounty = battle.earned - battle.start;
      if (o.gift) battle.gift += o.gift;
      lives = o.lives == null ? 17 : o.lives; waveIdx = totalWaves(); phase = "wave"; spawnQueue = []; enemies = []; syncHud();
    }, { sec: o.sec, spent: o.spent, lives: o.lives, gift: o.gift || 0, earned: o.earned });
    await g.page.waitForFunction(() => gameOver && (celebration || parley || menuMode === "victory"), null, { timeout: 15000 });
    if (await g.ev(() => !!celebration)) await g.ev(() => { celebration.start = performance.now() - DANCE_MAX_MS - 50; });
    await g.page.waitForFunction(() => menuMode === "victory" && !overlayEl.classList.contains("hidden"), null, { timeout: 20000 });
    if (up) await g.page.setViewportSize({ width: C.w, height: C.h });
    await g.page.waitForFunction(() => !overlayEl.classList.contains("settling"), null, { timeout: 8000 }).catch(() => {});
    await g.wait(420);
    if (await g.ev(() => endingCardUp())) { await pressGo(g, "#ecBtn"); await g.wait(200); }
    return evs(g, "victory").then(v => v.pop());
  };
  // the strip once it has left "posting"
  const f7settled = (g, ms = 15000) => g.page.waitForFunction(() => !SC.page || SC.page.state !== "posting", null, { timeout: ms }).catch(() => {});
  // the score the server must give, from the victory's own numbers and the page's ruleset, by ref.js (the reference both are held to)
  const f7expect = async (g, v) => {
    const rules = await g.ev(() => rulesetData());
    const b = refm.boundsOf(rules, v.lv, v.diff, null, false);
    return refm.scoreOf({ won: true, lives: Math.min(v.lives, v.lives_board), sim_sec: v.sec, spent: v.spent, earned: v.earned }, b, rules.score);
  };
  const f7last = async (uid) => (await S.query("select score, lives, lives_max, sim_sec, loadout, board, flags from highland.hs_scores where user_id = $1 order by id desc limit 1", [uid]))[0] || null;
  // the victory page with its strip held to the iPhone suite's audit
  const f7audit = async (g, W, what, photo) => {
    const st = await strip(g);
    const primary = st.side ? (st.board ? ["#boardBtn"] : ["#mapBtn"]) : st.boardRow ? ["#ovScore .scBoard"] : ["#mapBtn"];
    if (st.side && st.recOut) fail(W, what + ": the record row's words run off the screen or onto a second line: " + JSON.stringify(st));
    if (st.side && st.rec && st.full && st.rec.replace(/^· /, "Score ") !== st.full && !st.full.startsWith(st.rec.replace(/^· /, "Score ").split(" · ")[0])) fail(W, what + ": the short words " + st.rec + " are not the full words' " + st.full);
    if (["ses", "i15h", "i15u"].includes(g.o.key)) await audit(g, W + " " + what, { root: "#overlay", parts: st.side ? ["#ovRecord", "#boardBtn", "#ovGear"] : ["#ovScore", "#ovRecord"], primary, primaryRequired: true, scroll: upr(g.o) ? "page" : "inside" }, null);
    // every way on from the page still in sight (held sideways and on a tablet, without a scroll)
    const out = await g.ev(() => [...document.querySelectorAll("#overlay .bigRow .big, #ovScore button")].filter(b => b.offsetParent && b.getBoundingClientRect().bottom > innerHeight - 1).map(b => b.id || b.className));
    if (!upr(g.o) && out.length) fail(W, what + ": past the screen's foot: " + out.join(", "));
    if (photo) await f7photo(g, photo);
  };
  const f7press = async (g, sel) => {
    await g.ev(sel => { const e = typeof sel === "string" ? document.querySelector(sel) : null; if (e) e.scrollIntoView({ block: "nearest" }); }, typeof sel === "string" ? sel : null);
    await g.frames(2);
    await pressGo(g, sel);
  };
  // the Leaderboards tab's state: its controls and its rows
  const board = (g) => g.ev(() => {
    const t = document.querySelector("#hallBody .lbTab");
    if (!t) return null;
    const on = (sel) => Array.from(t.querySelectorAll(sel)).filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.textContent.trim());
    return { tab: hallTab, field: (t.querySelector(".lbName") || {}).textContent, diff: on(".lbSeal"), opts: on(".lbOpt"), loading: !!t.querySelector(".lbLoading"),
      rows: Array.from(t.querySelectorAll(".lbRow:not(.lbHead):not(.lbFaint)")).map(r => ({ me: r.classList.contains("lbMe"), cells: Array.from(r.children).map(c => c.textContent) })),
      empty: (t.querySelector(".lbEmpty") || {}).textContent || "", pin: (t.querySelector(".lbPin") || {}).textContent || "", sign: !!t.querySelector(".lbSign"),
      foot: (t.querySelector(".lbFoot") || {}).textContent || "" };
  });
  const boardReady = (g) => g.page.waitForFunction(() => { const t = document.querySelector("#hallBody .lbTab"); return !!t && !t.querySelector(".lbLoading") && !hallEl.classList.contains("hlSettling"); }, null, { timeout: 15000 });
  const boardOpt = async (g, words) => {
    await pressGo(g, (0, eval)("() => Array.from(document.querySelectorAll('#hallBody .lbOpt, #hallBody .lbSeal')).find(b => b.textContent.trim() === " + JSON.stringify(words) + ")"));
    await boardReady(g);
  };
  // past a chapter's story to the map (its button pressed where it is drawn; on an upright phone the page is scrolled
  // to it first, and where it cannot be reached the map is opened as its button would open it)
  const f7toMap = async (g) => {
    for (let k = 0; k < 4 && (await g.ev(() => menuMode)) === "chapter"; k++) {
      await g.ev(() => { const e = $("startBtn"); if (e) e.scrollIntoView({ block: "center" }); });
      await g.frames(3);
      const q = await g.reach("#startBtn");
      if (q.why) await g.ev(() => openCampaignMap()); else await g.tapAt(q.x, q.y);
      await g.wait(200);
    }
  };
  const f7map = async (g) => {
    await pressWelcome(g, "Campaign Map");
    await gate(g, "");
    await f7toMap(g);
    await g.page.waitForFunction(() => menuMode === "map" && !overlayEl.classList.contains("hidden"), null, { timeout: 15000 });
    await g.frames(3);
  };
  // Flow 7's extra steps, at 1600x900 only (the review of P5): the page's own track() is sent gameplay's event shapes,
  // so no battle is played. Two tabs of one player, each with a battle of its own; a post held on its way (in the
  // outbox before it goes); a reload in the battle (the resumed battle posts with its token); another account's
  // waiting result (kept, never sent); a session over at the post (it waits, and goes at this account's sign-in)
  const f7more = async (A, W, uidA) => {
    const rs = await A.ev(() => ({ rs: RULESET, levels: rulesetData().levels }));
    const ids = Object.keys(rs.levels);
    const start = (g, id, resumed) => g.ev(([id, r, resumed]) => track("battle_start", { ranked: true, mode: "campaign", lv: id, diff: 1, ruleset: r, resumed: !!resumed }), [id, rs.rs, resumed]);
    const win = (g, id, x) => g.ev(([id, r, L, x]) => track("victory", Object.assign({ ranked: true, mode: "campaign", lv: id, diff: 1, ruleset: r, wave: L.waves, sec: L.d[1].slow, spent: 500,
      earned: 1000, lives: 15, loadout: "std", build: "flow7" }, x || {})), [id, rs.rs, rs.levels[id], x || null]);
    const held = (g, what) => until(() => g.ev(() => SC.why === "held" && !!SC.tok), 15000, what);
    const state = (g, want, what) => g.page.waitForFunction(w => SC.page && SC.page.state === w, want, { timeout: 20000 }).catch(async () => fail(W, what + ": " + JSON.stringify(await g.ev(() => SC.page))));
    const rows = async (id) => (await S.query("select lives from highland.hs_scores where user_id = $1 and level_id = $2 order by id", [uidA, id])).map(r => r.lives);
    const outOf = async (g) => JSON.parse(await store(g, "hs_pf_out") || "[]");
    log("  flow 7 desk: two tabs of one player, each with its own battle: both posted");
    const pg2 = await A.ctx.newPage();
    const A2 = new R.Game(pg2, A.ctx, { w: A.o.w, h: A.o.h, touch: false, name: A.o.name, key: A.o.key });
    pg2.on("pageerror", e => A2.errs.push("pageerror: " + e.message));
    await pg2.goto(SITE + "/", { timeout: 120000 });
    await gate(A2, "welcome");
    await start(A, ids[2]);
    await held(A, "tab 1's run token").catch(e => fail(W, e.message));
    await start(A2, ids[3]);
    await held(A2, "tab 2's run token").catch(e => fail(W, e.message));
    await S.control("runback", { user_id: uidA, seconds: 3600 });
    await win(A, ids[2]);
    await state(A, "posted", "tab 1's strip");
    await win(A2, ids[3]);
    await state(A2, "posted", "tab 2's strip");
    // the other tab's outbox may send this tab's result while its own call is out (seen under load): its own call is
    // then answered run_finished, which is posted, not refused
    const again = await A2.ev(async () => { const pg = SC.page; await scPost(pg.rid, {}, pg); return pg.state; });
    if (again !== "posted") fail(W, "two tabs: a result already on the server (run_finished) leaves the strip " + again);
    if ((await rows(ids[2])).length !== 1 || (await rows(ids[3])).length !== 1) fail(W, "two tabs: the server's rows " + JSON.stringify([await rows(ids[2]), await rows(ids[3])]));
    if (await store(A, "hs_pf_run")) fail(W, "two tabs: the run token is left once both battles are posted");
    const p2 = await A2.problems().catch(() => A2.errs);
    for (const e of p2) fail(W + " tab 2", e);
    await pg2.close();
    log("  flow 7 desk: a post held on its way is in the outbox before it goes, and leaves it once answered");
    await start(A, ids[4]);
    await held(A, "the run token").catch(e => fail(W, e.message));
    await S.control("runback", { user_id: uidA, seconds: 3600 });
    await S.control("hold", { rpc: "hs_score_submit", ms: 4000 });
    const ridH = await A.ev(() => SC.tok.rid);
    await win(A, ids[4]);
    await A.page.waitForFunction(() => SC.page && SC.page.state === "posting" && SC.posting, null, { timeout: 5000 }).catch(() => {});
    const outH = await outOf(A);
    if (outH.length !== 1 || outH[0].rid !== ridH || outH[0].uid !== uidA) fail(W, "the outbox while the post is out: " + JSON.stringify(outH).slice(0, 200));
    await state(A, "posted", "the held post");
    if (await store(A, "hs_pf_out")) fail(W, "the outbox once the held post was answered: " + await store(A, "hs_pf_out"));
    log("  flow 7 desk: a reload in the battle: the resumed battle posts with its token");
    await start(A, ids[5]);
    await held(A, "the run token").catch(e => fail(W, e.message));
    const ridR = await A.ev(() => SC.tok.rid);
    await A.page.reload();
    await gate(A, "welcome");
    const kept = JSON.parse(await store(A, "hs_pf_run") || "null");
    if (!kept || kept.rid !== ridR) fail(W, "the token after a reload: " + JSON.stringify(kept));
    await start(A, ids[5], true);
    if (!(await A.ev(() => SC.why === "held" && SC.tok && SC.tok.rid))) fail(W, "the resumed battle holds no token: " + await A.ev(() => SC.why));
    await S.control("runback", { user_id: uidA, seconds: 3600 });
    await win(A, ids[5], { resumed: true, lives_board: 12 });
    await state(A, "posted", "the resumed battle");
    if ((await rows(ids[5])).join() !== "12") fail(W, "the resumed battle's row (lives 12): " + JSON.stringify(await rows(ids[5])));
    log("  flow 7 desk: another account's waiting result is kept and never sent");
    const other = { rid: "7e000000-0000-4000-8000-000000000001", uid: "7e000000-0000-4000-8000-0000000000ff", t: await A.ev(() => pfNow()), lv: ids[6], diff: 1, mode: "campaign", score: 5000,
      stats: { won: true, lives: 15, waves: rs.levels[ids[6]].waves, sim_sec: rs.levels[ids[6]].d[1].slow, spent: 500, earned: 1000, loadout: "std", build: "flow7" } };
    await A.ev(e => localStorage.setItem("hs_pf_out", JSON.stringify([e])), other);
    const sub0 = await A.ev(() => (window.__hsEv || []).length);
    await A.ev(() => scFlush());
    await A.wait(1500);
    const outO = await outOf(A);
    if (outO.length !== 1 || outO[0].uid !== other.uid) fail(W, "another account's entry: " + JSON.stringify(outO).slice(0, 200));
    if ((await A.ev(n => (window.__hsEv || []).slice(n).filter(e => e[0] === "score_rejected").length, sub0))) fail(W, "another account's entry was sent");
    await A.ev(() => localStorage.removeItem("hs_pf_out"));
    log("  flow 7 desk: the session over at the post (401): the result waits, and goes at this account's next sign-in");
    await start(A, ids[6]);
    await held(A, "the run token").catch(e => fail(W, e.message));
    await S.control("runback", { user_id: uidA, seconds: 3600 });
    // (the access token refused and no refresh to be had: the post answers 401)
    await S.control("expire", { user_id: uidA });
    await S.control("auth", { mode: "down" });
    await win(A, ids[6]);
    await state(A, "waiting", "the post with the session over");
    const out4 = await outOf(A);
    if (out4.length !== 1 || out4[0].uid !== uidA) fail(W, "the outbox after a 401: " + JSON.stringify(out4).slice(0, 200));
    if ((await rows(ids[6])).length) fail(W, "a 401 post reached the board");
    await S.control("auth", { mode: "up" });
    // the session gone from this device (as the server's end of it leaves it), and this account signs in again
    await A.ev(() => localStorage.removeItem("hs_pf_auth"));
    await A.page.reload();
    await gate(A, "signin");
    await S.control("provider", f7who(A.o.key, "a"));
    await signIn(A, null, "google", "welcome");
    await until(async () => !(await store(A, "hs_pf_out")) && (await rows(ids[6])).length === 1, 20000, "the waiting result after the sign-in").catch(e => fail(W, e.message));
    log("  flow 7 desk: a battle resumed with its token but no session: \"Sign in to post it\", kept, and sent at the sign-in");
    await start(A, ids[7]);
    await held(A, "the run token").catch(e => fail(W, e.message));
    await S.control("runback", { user_id: uidA, seconds: 3600 });
    await A.ev(() => localStorage.removeItem("hs_pf_auth"));
    await A.page.reload();
    await gate(A, "signin");
    // (the battle is resumed behind the gate, as a player who closes it to play on would resume it)
    await start(A, ids[7], true);
    await win(A, ids[7], { resumed: true });
    await state(A, "signin", "the resumed battle with no session");
    const out5 = await outOf(A);
    if (out5.length !== 1 || out5[0].uid !== uidA) fail(W, "the resumed battle's result with no session: " + JSON.stringify(out5).slice(0, 200));
    await S.control("provider", f7who(A.o.key, "a"));
    await signIn(A, null, "google", "welcome");
    await until(async () => !(await store(A, "hs_pf_out")) && (await rows(ids[7])).length === 1, 20000, "the resumed battle's result after the sign-in").catch(e => fail(W, e.message));
  };
  const flow7 = async (C) => {
    const W = "flow 7 " + C.name;
    await resetStack();
    const K = C.key;
    log("  flow 7: A, the owner: a player with five battlefields, made an admin");
    // ---- A, the owner: a player with five battlefields, made an admin
    const A = await open(C, { storage: f7prog, quietCall: true });
    await A.page.waitForFunction(() => typeof gateState !== "undefined" && document.readyState === "complete");
    await S.control("provider", f7who(K, "a"));
    await signIn(A, null, "google", "name");
    const nameA = "Seven" + K + "A";
    await A.page.fill("#gate .gtField", nameA);
    await pressGo(A, "#gate .gtGo");
    await gate(A, "welcome");
    const uidA = await uidOf(A);
    await S.control("admin", { user_id: uidA });
    await f7map(A);
    // the map's door: 10 px right of the tally, on screen, uncovered, the Hall on Leaderboards (held sideways the tally itself)
    const door = await A.ev(() => {
      const b = $("hallBtn"), t = $("ovStars").getBoundingClientRect(), r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { shown: !b.hidden && getComputedStyle(b).display !== "none", gap: Math.round(r.left - t.right), top: Math.round(r.top - t.top), w: r.width, h: r.height,
        in: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, mine: hit === b || b.contains(hit), title: b.title, side: phoneWide(),
        over: ["ovCrest", "ovTitle", "nardiBtn", "ovGear", "chapterBar", "chStory"].filter(id => { const e = $(id); if (!e || !e.getClientRects().length) return false; const q = e.getBoundingClientRect(); return q.width && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; }) };
    });
    if (door.side) { if (door.shown) fail(W, "held sideways the map has a door of its own beside the tally"); }
    else if (!door.shown || Math.abs(door.gap - 10) > 1 || !door.in || !door.mine || door.over.length || door.w < 44 || door.title !== "Daily challenge and leaderboards") fail(W, "the map's door: " + JSON.stringify(door));
    if (["ses", "i15h", "i15u"].includes(K)) await audit(A, W + " map with its door", { root: "#overlay", parts: ["#ovStars"].concat(door.side ? [] : ["#hallBtn"]), primary: [door.side ? "#ovStars" : "#hallBtn"], primaryRequired: true, scroll: upr(C) ? "page" : "inside" }, null);
    await f7photo(A, "map-door");
    // the ruleset not yet published: a battle is fought and scored on the device, not ranked
    let v = await f7win(A, W, { lv: 1, token: false, runback: false });
    await f7settled(A);
    let st = await strip(A);
    if (stripSays(st) !== "Score " + (st.score || 0).toLocaleString("en-US") + " · The boards for this version open soon") fail(W, "unpublished: " + JSON.stringify(st));
    if (st.score !== await f7expect(A, v)) fail(W, "the page's score " + st.score + " is not ref.js's " + await f7expect(A, v));
    await f7audit(A, W, "strip, unpublished", "strip-unpublished");
    // the admin is told on the map
    await A.page.reload();
    await toasts(A);
    await gate(A, "welcome");
    await f7map(A);
    await until(() => A.ev(() => (window.__hsToasts || []).some(t => t === "Admin: publish ruleset 2 on the stats page.")), 15000, "the admin's toast").catch(e => fail(W, e.message));
    // publish from the stats page: the Rulesets card's button
    await A.page.goto(SITE + "/?stats");
    await statsUp(A);
    const rsCard = await A.ev(() => { const c = Array.from(document.querySelectorAll("#statsBody .stCard")).find(x => x.querySelector("h2").textContent === "Rulesets"); return c ? c.innerText : ""; });
    if (!/This page plays ruleset 2\. The server does not have it\./.test(rsCard)) fail(W, "the Rulesets card: " + rsCard.slice(0, 200));
    const hl = await A.ev(() => Array.from(document.querySelectorAll("#statsBody .stCard")).find(x => x.querySelector("h2").textContent === "Health").innerText);
    if (!/This page plays ruleset 2\. The server does not have it/.test(hl)) fail(W, "the Health card says nothing of the ruleset: " + hl.slice(0, 200));
    await pressStats(A, "#statsBody .stPublish");
    await A.page.waitForFunction(() => !stBusy && /Published\./.test($("statsBody").innerText), null, { timeout: 30000 }).catch(() => fail(W, "no Published. after the press"));
    const pub = await S.query("select id, active, data -> 'levels' -> 'erebuni' ->> 'waves' as w from highland.hs_rulesets");
    if (pub.length !== 1 || pub[0].id !== "2" || !pub[0].active || !(Number(pub[0].w) > 0)) fail(W, "the server's rulesets: " + JSON.stringify(pub));
    const pubSame = await A.ev(async () => {
      const r = await pfRpc("hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2", p_period: "all" }, {});
      return r.ok && r.data && !r.data.ruleset_unknown;
    });
    if (!pubSame) fail(W, "hs_board does not know ruleset 2 after the publish");
    if (K === "desk") {
      await A.ev(() => { const c = Array.from(document.querySelectorAll("#statsBody .stCard")).find(x => x.querySelector("h2").textContent === "Rulesets"); if (c) c.scrollIntoView({ block: "start" }); });
      await f7photo(A, "stats-rulesets");
    }
    log("  flow 7: A's battle, posted: the server's score is the page's and ref.js's; \"#");
    // ---- A's battle, posted: the server's score is the page's and ref.js's; "#1 of 1 this week"
    await A.page.goto(SITE + "/");
    await gate(A, "welcome");
    await f7map(A);
    v = await f7win(A, W, { lv: 0, sec: 900, spent: 400, lives: 17 });
    await f7settled(A);
    st = await strip(A);
    const expA = await f7expect(A, v), rowA = await f7last(uidA);
    if (!rowA || rowA.score !== expA || st.score !== expA) fail(W, "A's score: server " + JSON.stringify(rowA) + ", page " + st.score + ", ref " + expA);
    if (rowA && (rowA.lives !== Math.min(v.lives, v.lives_board) || rowA.loadout !== "std" || rowA.board !== "c:erebuni:1:std:" + v.rev)) fail(W, "A's row: " + JSON.stringify(rowA));
    if (stripSays(st) !== "Score " + expA.toLocaleString("en-US") + " · #1 of 1 this week") fail(W, "posted: " + JSON.stringify(st));
    if (!st.side && !st.boardRow) fail(W, "no Leaderboard button on the strip");
    if (st.side && !st.board) fail(W, "held sideways no round Leaderboard button: " + JSON.stringify(st));
    const posted = await evs(A, "score_posted");
    if (!posted.length || posted[posted.length - 1].score !== expA || posted[posted.length - 1].rank !== 1) fail(W, "score_posted: " + JSON.stringify(posted));
    await f7audit(A, W, "strip, posted", "strip-posted");
    // the tooltip, and on touch the tap that says the score's sentence
    const tip = await A.ev(() => { const e = $("pfRecScore") && $("pfRecScore").tagName === "SPAN" ? $("pfRecScore") : document.querySelector("#ovScore .scLine"); return e ? e.title : ""; });
    if (!/^A win is worth 4,000, plus up to 3,000 for the defenders you kept/.test(tip)) fail(W, "the score's tooltip: " + tip);
    log("  flow 7: the Leaderboard button: the Hall on this battlefield, Normal, This wee");
    // ---- the Leaderboard button: the Hall on this battlefield, Normal, This week, Standard; A on it, tinted
    await f7press(A, st.side ? "#boardBtn" : "#ovScore .scBoard");
    await boardReady(A);
    let bd = await board(A);
    if (!bd || bd.tab !== "boards" || bd.field !== "Erebuni Rise" || bd.diff.join() !== "Normal" || bd.opts.join() !== "This week,Standard") fail(W, "the board from the victory page: " + JSON.stringify(bd));
    const keptA = Math.min(v.lives, v.lives_board) + "/" + v.lives_max;
    if (!bd || bd.rows.length !== 1 || !bd.rows[0].me || bd.rows[0].cells.join("|") !== "1|" + nameA + "|" + expA.toLocaleString("en-US") + "|" + keptA + "|" + (Math.floor(rowA.sim_sec / 60) + ":" + String(rowA.sim_sec % 60).padStart(2, "0")))
      fail(W, "A's row on the board: " + JSON.stringify(bd && bd.rows));
    for (const want of ["A win is worth 4,000", "The battle clock runs between waves too. Pause to plan.", "Weeks run Monday to Sunday, UTC."]) if (!bd || !bd.foot.includes(want)) fail(W, "under the board: no " + want);
    await audit(A, W + " Leaderboards tab", { root: "#hall", parts: ["#hallBody", "#hallTabs", "#hallClose"], primary: ["#hallBody .lbOpt"], primaryRequired: true, scroll: "inside" }, null);
    await f7photo(A, "boards");
    // All time has it too; Open is empty; Hard is empty
    await boardOpt(A, "All time");
    bd = await board(A);
    if (!bd || bd.rows.length !== 1) fail(W, "All time: " + JSON.stringify(bd && bd.rows));
    await boardOpt(A, "Open");
    bd = await board(A);
    if (!bd || bd.rows.length || bd.empty !== "No scores yet. Be the first to hold this field.") fail(W, "Open before any open battle: " + JSON.stringify(bd));
    await boardOpt(A, "Standard");
    await boardOpt(A, "Hard");
    bd = await board(A);
    if (!bd || bd.rows.length || !bd.empty) fail(W, "Hard: " + JSON.stringify(bd));
    await boardOpt(A, "Normal");
    // the battlefield's arrows go round the battlefields this player has opened
    await pressGo(A, "#hallBody .lbArrow[aria-label='Next battlefield']");
    await boardReady(A);
    bd = await board(A);
    if (!bd || bd.field !== "Vale of Tushpa") fail(W, "the next battlefield is " + (bd && bd.field));
    await pressGo(A, "#hallBody .lbArrow[aria-label='Previous battlefield']");
    await boardReady(A);
    await A.ev(() => closeHall());
    log("  flow 7: B: a second player's lower score ranks second; then an open battle (a ");
    // ---- B: a second player's lower score ranks second; then an open battle (a gift of gold) is on Open only
    const B = await open(C, { storage: f7prog, quietCall: true });
    await B.page.waitForFunction(() => typeof gateState !== "undefined" && document.readyState === "complete");
    await S.control("provider", f7who(K, "b"));
    await signIn(B, null, "google", "name");
    const nameB = "Seven" + K + "B";
    await B.page.fill("#gate .gtField", nameB);
    await pressGo(B, "#gate .gtGo");
    await gate(B, "welcome");
    const uidB = await uidOf(B);
    await f7map(B);
    v = await f7win(B, W, { lv: 0, sec: 1100, spent: 900, lives: 9 });
    await f7settled(B);
    st = await strip(B);
    const expB = await f7expect(B, v);
    if (expB >= expA) fail(W, "B's score is not lower: " + expB + " against " + expA);
    if (stripSays(st) !== "Score " + expB.toLocaleString("en-US") + " · #2 of 2 this week") fail(W, "B posted: " + JSON.stringify(st));
    v = await f7win(B, W, { lv: 0, sec: 950, spent: 500, lives: 15, gift: 60 });
    await f7settled(B);
    st = await strip(B);
    const expBo = await f7expect(B, v);
    if (v.loadout !== "open") fail(W, "a gift of gold did not make the battle open: " + v.loadout);
    if (stripSays(st) !== "Score " + expBo.toLocaleString("en-US") + " · #1 of 1 this week · Open") fail(W, "B's open battle: " + JSON.stringify(st));
    await f7audit(B, W, "strip, posted open", "strip-open");
    await f7press(B, st.side ? "#boardBtn" : "#ovScore .scBoard");
    await boardReady(B);
    bd = await board(B);
    if (!bd || bd.opts.join() !== "This week,Open" || bd.rows.length !== 1 || bd.rows[0].cells[1] !== nameB || !bd.rows[0].me) fail(W, "the Open board: " + JSON.stringify(bd));
    await boardOpt(B, "Standard");
    bd = await board(B);
    if (!bd || bd.rows.map(r => r.cells[1]).join() !== nameA + "," + nameB || !bd.rows[1].me || bd.rows[0].me) fail(W, "the Standard board after B: " + JSON.stringify(bd && bd.rows));
    await B.ev(() => closeHall());
    log("  flow 7: A beats his own best: \" · your best\"");
    // ---- A beats his own best: " · your best"
    v = await f7win(A, W, { lv: 0, sec: 700, spent: 300, lives: 20 });
    await f7settled(A);
    st = await strip(A);
    const expA2 = await f7expect(A, v);
    if (stripSays(st) !== "Score " + expA2.toLocaleString("en-US") + " · #1 of 2 this week · your best") fail(W, "A's best beaten: " + JSON.stringify(st));
    log("  flow 7: waiting: the server down at the battle's end; the result waits in the ");
    // ---- waiting: the server down at the battle's end; the result waits in the outbox and goes when the device is online
    v = await f7win(A, W, { lv: 1, sec: 1000, spent: 500, lives: 16, last: async () => { await S.control("rest", { mode: "down" }); } });
    await f7settled(A);
    st = await strip(A);
    if (!/· It posts when you are back online$/.test(stripSays(st))) fail(W, "waiting: " + JSON.stringify(st));
    const out1 = JSON.parse(await store(A, "hs_pf_out") || "[]");
    if (out1.length !== 1 || out1[0].uid !== uidA) fail(W, "the outbox: " + JSON.stringify(out1).slice(0, 200));
    await f7audit(A, W, "strip, waiting", "strip-waiting");
    await S.control("rest", { mode: "up" });
    await A.ev(() => window.dispatchEvent(new Event("online")));
    await A.page.waitForFunction(() => SC.page && SC.page.state === "posted", null, { timeout: 15000 }).catch(() => {});
    st = await strip(A);
    if (stripSays(st) !== "Score " + (await f7expect(A, v)).toLocaleString("en-US") + " · #1 of 1 this week") fail(W, "the waiting result once online: " + JSON.stringify(st));
    if (await store(A, "hs_pf_out")) fail(W, "the outbox is not empty once sent");
    if (K === "desk") await f7more(A, W, uidA);
    log("  flow 7: the battle began offline: every try at the horn failed (the tries made");
    // ---- the battle began offline: every try at the horn failed (the tries made quick by the test's switch)
    const C2 = await open(C, { quietCall: true, init: [[() => { window.__HS_PLATFORM_TEST = Object.assign(window.__HS_PLATFORM_TEST || {}, { beginTries: [0, 300, 600] }); }, null]] });
    await gate(C2, "signin");
    await S.control("provider", f7who(K, "a"));
    await signIn(C2, null, "google", "welcome");
    await f7map(C2);
    v = await f7win(C2, W, { lv: 1, token: false, runback: false, before: async () => { await S.control("rest", { mode: "down" }); }, last: async () => { await C2.wait(1500); await S.control("rest", { mode: "up" }); } });
    await f7settled(C2);
    st = await strip(C2);
    if (!/· Not ranked: this battle began offline$/.test(stripSays(st))) fail(W, "began offline: " + JSON.stringify(st));
    await f7audit(C2, W, "strip, began offline", "strip-offline");
    log("  flow 7: refused: the run begun just now, a battle clock of 15 minutes (the ser");
    // ---- refused: the run begun just now, a battle clock of 15 minutes (the server's wall-clock check says no)
    v = await f7win(C2, W, { lv: 1, sec: 900, runback: false });
    await f7settled(C2);
    st = await strip(C2);
    if (!/· Not ranked$/.test(stripSays(st))) fail(W, "refused: " + JSON.stringify(st));
    const rj = await evs(C2, "score_rejected");
    if (!rj.length || rj[rj.length - 1].reason !== "score_implausible") fail(W, "score_rejected: " + JSON.stringify(rj));
    await f7audit(C2, W, "strip, refused", "strip-refused");
    log("  flow 7: not rankable: test mode (every battlefield open by the test's switch) ");
    // ---- not rankable: test mode (every battlefield open by the test's switch) shows no strip
    if (upr(C)) await C2.page.setViewportSize({ width: C.h, height: C.w });
    await C2.enterBattle(2);
    await C2.ev(() => { lives = 17; waveIdx = totalWaves(); phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
    await C2.page.waitForFunction(() => gameOver && (celebration || parley || menuMode === "victory"), null, { timeout: 15000 });
    if (await C2.ev(() => !!celebration)) await C2.ev(() => { celebration.start = performance.now() - DANCE_MAX_MS - 50; });
    await C2.page.waitForFunction(() => menuMode === "victory", null, { timeout: 20000 });
    if (upr(C)) await C2.page.setViewportSize({ width: C.w, height: C.h });
    await C2.wait(400);
    st = await strip(C2);
    if (st.row || st.rec != null || st.board) fail(W, "test mode has a strip: " + JSON.stringify(st));
    if (await C2.ev(() => !!SH.rec || document.body.classList.contains("pfShare"))) fail(W, "test mode (aided) has a share card");
    await done(C2, W + " (offline, refused, test mode)");
    log("  flow 7: a guest (the gate optional): \"Sign in to post it\", a button to the A");
    // ---- a guest (the gate optional): "Sign in to post it", a button to the Account tab
    const G = await open(C, { storage: f7prog, quietCall: true, init: [[() => { window.__HS_PLATFORM_TEST = Object.assign(window.__HS_PLATFORM_TEST || {}, { gate: "optional" }); }, null]] });
    await gate(G, "signin");
    await pressGo(G, (0, eval)("() => Array.from(gateCardEl.querySelectorAll('button')).find(b => b.textContent === 'Play as a guest')"));
    await gate(G, "");
    await f7toMap(G);
    v = await f7win(G, W, { lv: 0, token: false, runback: false });
    await f7settled(G);
    st = await strip(G);
    if (!/· Sign in to post it$/.test(stripSays(st))) fail(W, "a guest: " + JSON.stringify(st));
    await f7audit(G, W, "strip, signed out", "strip-signin");
    await f7press(G, st.side ? "#pfRecScore" : "#ovScore .scLink");
    await G.page.waitForFunction(() => hallOpen && hallTab === "account", null, { timeout: 5000 }).catch(() => fail(W, "Sign in to post it did not open the Account tab"));
    // the guest's Leaderboards tab: the board to read, and the sign-in line with its buttons
    await G.ev(() => openHall("boards"));
    await boardReady(G);
    bd = await board(G);
    if (!bd || !bd.sign || bd.rows.map(r => r.cells[1]).join() !== nameA + "," + nameB || bd.rows.some(r => r.me)) fail(W, "the guest's board: " + JSON.stringify(bd));
    await audit(G, W + " Leaderboards tab (a guest)", { root: "#hall", parts: ["#hallBody", "#hallTabs", "#hallClose"], primary: ["#hallBody .gateBtn"], primaryRequired: true, scroll: "inside" }, null);
    await f7photo(G, "boards-guest");
    // no connection, and Try again
    await S.control("rest", { mode: "down" });
    await boardOpt(G, "All time");
    bd = await board(G);
    if (!bd || bd.empty !== "The boards need a connection.") fail(W, "the board with no connection: " + JSON.stringify(bd));
    await f7photo(G, "boards-offline");
    await S.control("rest", { mode: "up" });
    await pressGo(G, "#hallBody .lbRetry");
    await G.page.waitForFunction(() => { const t = document.querySelector("#hallBody .lbTab"); return t && t.querySelectorAll(".lbRow:not(.lbHead):not(.lbFaint)").length === 2; }, null, { timeout: 15000 }).catch(() => fail(W, "Try again did not bring the board"));
    await done(G, W + " (a guest)");
    log("  flow 7: the boards switched off by the owner: no strip, no run begun; the tab says the boards are closed");
    // ---- the boards switched off by the owner: no strip, no run begun; the Leaderboards tab stays, closed
    await A.page.goto(SITE + "/?stats");
    await statsUp(A);
    await pressStats(A, "#statsBody .stBoards[data-on='false']");
    await A.page.waitForFunction(() => !stBusy && $("statsBody").querySelector(".stBoards[data-on='false'][aria-pressed='true']"), null, { timeout: 20000 }).catch(() => fail(W, "the boards' switch did not turn off"));
    // Scores to look at: A's quick battle (under its fast mark) is listed, and Remove takes it off; his next best stands
    const flagged = await A.ev(() => { const c = Array.from(document.querySelectorAll("#statsBody .stCard")).find(x => x.querySelector("h2").textContent === "Scores to look at"); return c ? Array.from(c.querySelectorAll(".stFlag")).map(f => f.innerText) : null; });
    const fastRow = (flagged || []).findIndex(t => t.includes(nameA) && /· fast/.test(t));
    if (fastRow < 0) fail(W, "Scores to look at does not list A's fast result: " + JSON.stringify(flagged));
    else {
      const n0 = (await S.query("select count(*)::int as n from highland.hs_scores where user_id = $1", [uidA]))[0].n;
      await A.ev(i => document.querySelectorAll("#statsBody .stFlag")[i].scrollIntoView({ block: "center" }), fastRow);
      await A.frames(2);
      await pressGo(A, (0, eval)("() => document.querySelectorAll('#statsBody .stFlag')[" + fastRow + "].querySelector('button')"));
      await A.page.waitForFunction(i => document.querySelectorAll("#statsBody .stFlag")[i].innerText.includes("Done."), fastRow, { timeout: 10000 }).catch(() => fail(W, "Remove did not say Done."));
      const n1 = (await S.query("select count(*)::int as n from highland.hs_scores where user_id = $1", [uidA]))[0].n;
      const best = await S.query("select score from highland.hs_score_best where user_id = $1 and board like 'c:erebuni:1:std:%' and period = 'all'", [uidA]);
      if (n1 !== n0 - 1 || best.length !== 1 || best[0].score !== expA) fail(W, "after Remove: " + JSON.stringify({ n0, n1, best, expA }));
    }
    if (K === "desk") { await A.ev(() => { const c = Array.from(document.querySelectorAll("#statsBody .stCard")).find(x => x.querySelector("h2").textContent === "Scores to look at"); if (c) c.scrollIntoView({ block: "start" }); }); await f7photo(A, "stats-flagged"); }
    await A.page.goto(SITE + "/");
    await gate(A, "welcome");
    await f7map(A);
    const runs0 = (await S.query("select count(*)::int as n from highland.hs_runs"))[0].n;
    v = await f7win(A, W, { lv: 0, token: false, runback: false });
    await A.wait(800);
    st = await strip(A);
    if (st.words || st.rec != null || st.board || st.boardRow) fail(W, "the boards off and a strip: " + JSON.stringify(st));
    // (the victory still has its card, Share alone, with no score: section 6 ties the card to the page, not the boards)
    await A.page.waitForFunction(() => !!SH.blob && !!SH.rec, null, { timeout: 20000 }).catch(() => fail(W, "the boards off: no share card"));
    const lone = await A.ev(() => { const e = phoneWide() ? $("shareBtn") : document.querySelector("#ovScore .scShare"); return { live: !!e && !e.hidden && !e.disabled && e.getClientRects().length > 0, score: JSON.parse(SH.key || "{}").score }; });
    if (!lone.live || lone.score !== null) fail(W, "the boards off: Share alone: " + JSON.stringify(lone));
    if ((await S.query("select count(*)::int as n from highland.hs_runs"))[0].n !== runs0) fail(W, "a run was begun with the boards off");
    await A.ev(() => openHall("boards"));
    await boardReady(A);
    bd = await board(A);
    if (!bd || bd.empty !== "The boards are closed for now.") fail(W, "the Leaderboards tab with the boards off: " + JSON.stringify(bd));
    await A.ev(() => closeHall());
    // (the switch back on for the next size's reset)
    await done(A, W + " (A)");
    await done(B, W + " (B)");
  };

  // ================================================================ flow 8: the daily challenge (work package P6)
  // A player with five battlefields (flow 7's) and the page's own ruleset published: the page's pick (gameplay's
  // dailyPick, the platform's dailyOf) equal to the server's _daily_pick for 366 days from today, skip lists included,
  // and Platform.daily() to the server's hs_daily_status; the welcome card's "Today's challenge" opens the Hall on the
  // Daily tab (its badge, the map door's dot); the tab's words; gameplay's map door leads to it too. Three attempts,
  // each told at its first wave: a victory posted ("#1 of 1 today", the server's score the page's and ref.js's, Share),
  // a loss scored by the waves it held (its strip on the daily's end page, no Share, the debrief kept), a third; then
  // the fourth is practice ("Practice: not ranked") and spends nothing. The tab: attempts 0 of 3, Practice, the board
  // with the player's row tinted. A second player's lower score ranks second (desktop and 667x320). The day changes
  // (the stack's clock): the next day's challenge, the attempts back, "Yesterday: 1. ..." under an empty board. With the
  // database down a daily begun is practice and no attempt is spent (desktop and 667x320). Photos in p6 (--photos)
  const F8SHOTS = PHOTOS ? path.join(PHOTOS, "p6") : null;
  if (F8SHOTS) fs.mkdirSync(F8SHOTS, { recursive: true });
  // (the attempt's word, a toast, is let go first: the page is photographed as the player sees it a moment later)
  const f8photo = async (g, name) => {
    if (!F8SHOTS) return;
    await g.page.waitForFunction(() => !toastEl.classList.contains("show"), null, { timeout: 7000 }).catch(() => {});
    await g.page.screenshot({ path: path.join(F8SHOTS, name + "-" + g.o.key + ".png") });
  };
  // the Daily tab as the page shows it
  const dyTab = (g) => g.ev(() => {
    const t = document.querySelector("#hallBody .dyTab");
    if (!t) return null;
    const q = (c) => (t.querySelector(c) || {}).textContent || "";
    return { tab: hallTab, head: q(".dyHead"), field: q(".dyField"), twist: q(".dyTwist"), rules: q(".dyRules"), mine: Array.from(t.querySelectorAll(".dyMine span")).map(s => s.textContent),
      play: q(".dyPlay"), note: Array.from(t.querySelectorAll(".lbNote")).map(e => e.textContent).join("|"), next: q(".dyNext"), sit: q(".dySit"), yest: q(".dyYest"),
      foot: q(".lbFoot"), loading: !!t.querySelector(".lbLoading"), empty: q(".lbEmpty"), sign: !!t.querySelector(".lbSign"),
      rows: Array.from(t.querySelectorAll(".lbRow:not(.lbHead):not(.lbFaint)")).map(r => ({ me: r.classList.contains("lbMe"), cells: Array.from(r.children).map(c => c.textContent) })),
      badge: (hallTabs().find(x => x.id === "daily") || {}).badge ? hallBadge(hallTabs().find(x => x.id === "daily")) : -1 };
  });
  const dyReady = (g) => g.page.waitForFunction(() => { const t = document.querySelector("#hallBody .dyTab"); return !!t && !t.querySelector(".lbLoading") && !hallEl.classList.contains("hlSettling") && !DY.asking; }, null, { timeout: 20000 });
  const dyAuditTab = async (g, W, what, photo) => {
    await audit(g, W + " " + what, { root: "#hall", parts: ["#hallBody", "#hallTabs", "#hallClose"], primary: ["#hallBody .dyPlay"], primaryRequired: true, scroll: "inside" }, null);
    if (photo) await f8photo(g, photo);
  };
  // the server's word on today, as the stack's database holds it (the pick and the attempts)
  const f8status = (g) => g.ev(async () => { const r = await pfRpc("hs_daily_status", { p_ruleset: PF_RULESET_ID }, { auth: true }); return r.ok ? r.data : { error: r.code }; });
  // the daily's battle from its chronicle (gameplay's startDaily put it up): the first wave sent as the player sends it,
  // then won or lost as vic.js stages an end: the clock and the gold set as a real battle's would stand, the run's
  // start moved back by as long. o: { win, cleared (a loss: the waves held), lives, practice (no token wanted) }.
  // An upright phone is turned sideways for the battle, and back for its end page
  const f8fight = async (g, W, o) => {
    const C = g.o, up = upr(C);
    if (up) await g.page.setViewportSize({ width: C.h, height: C.w });
    await g.page.waitForFunction(() => menuMode === "brief" && !!dailyRun && !overlayEl.classList.contains("hidden"), null, { timeout: 15000 });
    await toasts(g);
    const t0 = await g.ev(() => window.__hsToasts.length);
    for (let k = 0; k < 6 && !(await g.ev(() => battleLive())); k++) {
      await g.ev(() => { const e = $("startBtn"); if (e) e.scrollIntoView({ block: "nearest" }); });
      await g.frames(2);
      const q = await g.reach("#startBtn");
      if (q.why) { await g.wait(200); continue; }
      await g.tapAt(q.x, q.y);
      await g.wait(300);
    }
    if (!(await g.ev(() => battleLive()))) throw new Error("the daily did not begin from its chronicle (" + await g.ev(() => menuMode) + ")");
    await g.ev(() => { for (let k = 0; k < 6 && trickHold(); k++) dropTrickCards(); });
    await g.ev(() => { if (!battle.started) startWave(); });
    await g.page.waitForFunction(() => battle.started, null, { timeout: 10000 });
    // the player is told at once whether it counts (5.6)
    await until(() => g.ev(t => window.__hsToasts.slice(t).find(m => /^This attempt counts|^Practice/.test(m)) || null, t0), 9000, "the attempt's word").catch(e => fail(W, e.message));
    const said = await g.ev(t => window.__hsToasts.slice(t).find(m => /^This attempt counts|^Practice/.test(m)) || "", t0);
    if (!o.practice) await until(() => g.ev(() => SC.why === "held" && !!SC.tok), 10000, "the daily's run token").catch(e => fail(W, e.message));
    const uid = JSON.parse(await store(g, "hs_pf_auth") || "null");
    const b = await g.ev(() => { const L = levelId(curLevel); return Object.assign(boundsOf(pfRules(), L, 1, dailyRun.twist, true), { lv: L, twist: dailyRun.twist }); });
    if (!o.practice && uid) await S.control("runback", { user_id: uid.uid, seconds: b.slow + 60 });
    const lives = Math.min(b.lives, o.lives == null ? 10 : o.lives);
    await g.ev(([o, b, n]) => {
      battle.sec = o.win ? b.slow : Math.max(b.min, Math.round(b.slow * 0.6)); battle.spent = 400; battle.build = 400;
      battle.earned = Math.max(battle.earned, Math.min(2400, b.earnMax)); battle.bounty = battle.earned - battle.start;
      spawnQueue = []; enemies = [];
      if (o.win) { lives = n; waveIdx = totalWaves(); phase = "wave"; syncHud(); }
      else { lastCleared = o.cleared; waveIdx = o.cleared + 1; phase = "wave"; lives = 0; syncHud(); defeat(); }
    }, [o, b, lives]);
    if (o.win) {
      await g.page.waitForFunction(() => gameOver && (celebration || menuMode === "victory"), null, { timeout: 15000 });
      if (await g.ev(() => !!celebration)) await g.ev(() => { celebration.start = performance.now() - DANCE_MAX_MS - 50; });
    } else await g.ev(() => { if (fallen) fallen.start -= 60000; });
    await g.page.waitForFunction(() => menuMode === "victory" && overlayEl.classList.contains("dailyEnd") && !overlayEl.classList.contains("hidden"), null, { timeout: 20000 });
    if (up) await g.page.setViewportSize({ width: C.w, height: C.h });
    await g.page.waitForFunction(() => !overlayEl.classList.contains("settling"), null, { timeout: 8000 }).catch(() => {});
    await g.wait(420);
    const ev = (await evs(g, o.win ? "victory" : "defeat")).pop();
    return { said, b, lives, ev, uid: uid && uid.uid };
  };
  // "Fight again" on the daily's end page: its chronicle again
  const f8again = async (g) => { await f7press(g, "#startBtn"); await g.page.waitForFunction(() => menuMode === "brief" && !!dailyRun, null, { timeout: 10000 }); };
  // the Daily tab from the map's door (gameplay's "Today's challenge"): the Hall, not the battle
  const f8door = async (g, W) => {
    await g.ev(() => { if (hallOpen) closeHall(); openCampaignMap(); });
    await g.frames(3);
    await f7press(g, "#dailyBtn");
    await dyReady(g).catch(() => {});
    const h = await g.ev(() => ({ hall: hallOpen, tab: hallTab, mode: menuMode, daily: !!dailyRun }));
    if (!h.hall || h.tab !== "daily" || h.daily) fail(W, "the map's daily door: " + JSON.stringify(h));
  };
  const f8play = async (g, W) => {
    await dyReady(g).catch(() => {});
    await f7press(g, "#hallBody .dyPlay");
    await g.page.waitForFunction(() => !hallOpen && menuMode === "brief" && !!dailyRun, null, { timeout: 10000 }).catch(async () => fail(W, "Play did not open the daily's chronicle: " + JSON.stringify(await g.ev(() => ({ hall: hallOpen, mode: menuMode, d: !!dailyRun })))));
  };
  const flow8 = async (C) => {
    const W = "flow 8 " + C.name;
    await resetStack();
    const K = C.key, more = K === "desk" || K === "ses";
    log("  flow 8: A signs in; the ruleset published");
    const A = await open(C, { storage: f7prog, quietCall: true });
    await A.page.waitForFunction(() => typeof gateState !== "undefined" && document.readyState === "complete");
    await S.control("provider", f7who(K, "d8a"));
    await signIn(A, null, "google", "name");
    const nameA = "Eight" + K + "A";
    await A.page.fill("#gate .gtField", nameA);
    await pressGo(A, "#gate .gtGo");
    await gate(A, "welcome");
    const uidA = await uidOf(A);
    await S.control("admin", { user_id: uidA });
    const pub = await A.ev(async () => { const r = await pfRpc("hs_admin_publish_ruleset", { p_id: PF_RULESET_ID, p_data: rulesetData() }, { auth: true, timeout: 20000 }); return r.ok ? "ok" : r.code; });
    if (pub !== "ok") fail(W, "the ruleset was not published: " + pub);
    // ---- the pick: the page's (gameplay's dailyPick and the platform's dailyOf) equal to the server's for 366 days
    const today = (await S.query("select ((now() at time zone 'utc')::date - date '1970-01-01')::int as d"))[0].d;
    const srv = await S.query(`select g, p.level_id, p.twist from highland.hs_rulesets r, generate_series($1::int, $1::int + 365) g,
      lateral highland._daily_pick(r.data, date '1970-01-01' + g) p where r.id = '2' order by g`, [today]);
    const pg = await A.ev(d0 => { const out = []; for (let d = d0; d < d0 + 366; d++) { const a = dailyPick(d), b = dailyOf(rulesetData().daily, d); out.push([LEVELS[a.levelIndex].id, a.twist, b.level, b.twist]); } return { out, same: JSON.stringify(rulesetData().daily) === JSON.stringify(Object.assign({}, rulesetData().daily, dailyRules())) }; }, today);
    const skip = await A.ev(() => rulesetData().daily.skip);
    const diff = srv.filter((x, i) => !pg.out[i] || pg.out[i][0] !== x.level_id || pg.out[i][1] !== x.twist || pg.out[i][2] !== x.level_id || pg.out[i][3] !== x.twist);
    if (srv.length !== 366 || diff.length) fail(W, "the page's pick differs from the server's on " + diff.length + " of " + srv.length + " days: " + JSON.stringify(diff.slice(0, 3)));
    if (srv.some(x => (skip[x.level_id] || []).includes(x.twist))) fail(W, "the server served a pair the skip lists leave out");
    if (!pg.same) fail(W, "rulesetData().daily's pick is not dailyRules()'s");
    notes.flows["p6 pick@" + K] = srv.length + " days equal";
    // ---- the welcome card's door, the Daily tab, its words
    const wtxt = await cardText(A);
    if (!wtxt.includes("Today's challenge")) fail(W, "the welcome card has no Today's challenge: " + wtxt);
    await audit(A, W + " welcome with the daily", cardSpec(["#gate .gtDaily"]), null);
    await f8photo(A, "welcome");
    await pressWelcome(A, "Today's challenge");
    await gate(A, "");
    await A.page.waitForFunction(() => hallOpen && hallTab === "daily", null, { timeout: 15000 }).catch(() => fail(W, "Today's challenge did not open the Daily tab"));
    await dyReady(A).catch(() => fail(W, "the Daily tab did not settle"));
    const ho = (await evs(A, "hall_open")).pop();
    if (!ho || ho.tab !== "daily" || ho.from !== "welcome") fail(W, "hall_open from the welcome card: " + JSON.stringify(ho));
    const st0 = await f8status(A), pd = await A.ev(() => Platform.daily());
    const iA = await A.ev(id => LEVELS.findIndex(L => L.id === id), st0.level);
    if (!pd || pd.levelIndex !== iA || pd.twist !== st0.twist || pd.day !== today || pd.attemptsLeft !== 3 || pd.server !== true) fail(W, "Platform.daily() is not the server's: " + JSON.stringify(pd) + " " + JSON.stringify(st0));
    if (st0.level !== srv[0].level_id || st0.twist !== srv[0].twist) fail(W, "hs_daily_status is not the pick: " + JSON.stringify(st0));
    const words = await A.ev(([i, t, d]) => ({ head: "Daily challenge · " + dailyDateWords(d), field: dailyTitle(i) + ", " + LEVELS[i].date, twist: twistName(t, i) }), [iA, st0.twist, today]);
    let dt = await dyTab(A);
    if (!dt || dt.head !== words.head || dt.field !== words.field || !dt.twist.startsWith(words.twist) || dt.rules !== "Normal · 12 waves · Standard loadout · The same for everyone" ||
      dt.mine.join("|") !== "Attempts left: 3 of 3" || dt.play !== "Play today's challenge" || !/^New challenge in (\d+ h( \d+ min)?|\d+ min|under a minute)$/.test(dt.next) ||
      dt.sit !== "One sitting. Leaving the battle ends the attempt." || dt.empty !== "No scores yet today. Be the first to hold this field." || dt.badge !== 1 || dt.sign)
      fail(W, "the Daily tab: " + JSON.stringify(dt));
    if (/[\u2013\u2014]/.test(JSON.stringify(dt))) fail(W, "a long dash on the Daily tab");
    await dyAuditTab(A, W, "Daily tab", "tab-fresh");
    // the map's doors: the dot while today's daily is unplayed (the trophy door's, or held sideways the tally's pip)
    await A.ev(() => closeHall());
    await A.frames(3);
    const dots = await A.ev(() => ({ side: phoneWide(), hall: $("hallBtn") ? $("hallBtn").classList.contains("pip") : null, tally: $("ovStars").classList.contains("pip"), title: $("dailyBtn").title }));
    if ((!dots.side && !dots.hall) || !dots.tally) fail(W, "no dot for the unplayed daily: " + JSON.stringify(dots));
    if (!dots.title.includes(words.field.split(", ")[0]) || !dots.title.includes(words.twist)) fail(W, "gameplay's door does not name today's battle: " + dots.title);
    await f8photo(A, "map");
    // gameplay's own door leads to the tab while the platform is on
    await f8door(A, W);
    // ---- attempt 1: won and posted
    log("  flow 8: three attempts");
    await f8play(A, W);
    await f8photo(A, "chronicle");
    let f = await f8fight(A, W, { win: true, lives: 11 });
    if (f.said !== "This attempt counts. 2 attempts left today.") fail(W, "the first attempt's word: " + f.said);
    await f7settled(A);
    let st = await strip(A);
    const rules = await A.ev(() => rulesetData());
    const exp1 = refm.scoreOf({ won: true, lives: f.lives, sim_sec: f.b.slow, spent: 400, earned: f.ev.earned }, f.b, rules.score);
    const row1 = await f7last(uidA);
    if (!row1) fail(W, "the daily's post was refused: " + JSON.stringify(await A.ev(async (e) => { const r = await pfRpc("hs_score_submit", { p_run: SC.page.rid, p_stats: { won: true, lives: e.lives, waves: e.wave, sim_sec: e.sec, spent: e.spent, earned: e.earned, loadout: "std", build: "x" } }, { auth: true }); return [r.status, r.data]; }, f.ev)));
    if (!row1 || row1.score !== exp1 || st.score !== exp1 || row1.board !== "d:" + new Date(today * 86400000).toISOString().slice(0, 10)) fail(W, "the daily's score: server " + JSON.stringify(row1) + ", page " + st.score + ", ref " + exp1);
    if (stripSays(st) !== "Score " + exp1.toLocaleString("en-US") + " · #1 of 1 today") fail(W, "the won daily's strip: " + JSON.stringify(st));
    if (f.ev.stars !== 0) fail(W, "a daily's event carries stars: " + f.ev.stars);
    const shareOn = await A.ev(() => (phoneWide() ? !$("shareBtn").hidden : !!document.querySelector("#ovScore .scShare")));
    if (!shareOn) fail(W, "no Share on the won daily's page");
    // its card's words (5.6): "Highland Stand daily, Nov 17: Erebuni Rise, Forced march. Score 6,910, #1 today. <address>"
    await A.page.waitForFunction(() => !!SH.blob && !SH.drawing && !!SH.key && JSON.parse(SH.key).rank === 1, null, { timeout: 20000 }).catch(() => fail(W, "the won daily's card was not made with its rank"));
    const card = await A.ev(([i, t, d]) => ({ text: SH.text, want: "Highland Stand daily, " + shareDay(new Date(d * 86400000), false, true) + ": " + dailyTitle(i) + ", " + twistName(t, i) + ". Score " }), [iA, st0.twist, today]);
    if (card.text !== card.want + exp1.toLocaleString("en-US") + ", #1 today. https://highland.avunjian.com") fail(W, "the daily's share text: " + card.text);
    const dp = (await evs(A, "daily_played")).pop();
    if (!dp || dp.won !== true || dp.attempt !== 1 || dp.ranked !== true || dp.score !== exp1 || dp.twist !== st0.twist) fail(W, "daily_played: " + JSON.stringify(dp));
    await f7audit(A, W, "won daily's page", null);
    await f8photo(A, "won");
    // its Leaderboard: the Daily tab, the player on today's board
    await f7press(A, st.side ? "#boardBtn" : "#ovScore .scBoard");
    await A.page.waitForFunction(() => hallOpen && hallTab === "daily", null, { timeout: 10000 }).catch(() => fail(W, "the won daily's Leaderboard is not the Daily tab"));
    await dyReady(A).catch(() => {});
    dt = await dyTab(A);
    if (!dt || dt.rows.length !== 1 || !dt.rows[0].me || dt.rows[0].cells[1] !== nameA || dt.rows[0].cells[2] !== exp1.toLocaleString("en-US") || dt.rows[0].cells[3] !== f.lives + "/" + f.b.lives ||
      dt.mine.join("|") !== "Attempts left: 2 of 3|Your best today: " + exp1.toLocaleString("en-US") + " (#1 of 1)" || dt.badge !== 0) fail(W, "the Daily tab after a win: " + JSON.stringify(dt));
    await dyAuditTab(A, W, "Daily tab with a score", "tab-scored");
    await A.ev(() => closeHall());
    // ---- attempt 2: lost, scored by the waves it held; its strip on the daily's end page, no Share, the debrief
    await A.ev(() => { openCampaignMap(); });
    await f8door(A, W);
    await f8play(A, W);
    f = await f8fight(A, W, { win: false, cleared: 5 });
    if (f.said !== "This attempt counts. 1 attempt left today.") fail(W, "the second attempt's word: " + f.said);
    await f7settled(A);
    st = await strip(A);
    const row2 = await f7last(uidA);
    if (!row2 || row2.score !== Math.floor(4000 * 5 / 12)) fail(W, "the lost daily's score on the server: " + JSON.stringify(row2));
    if (st.score !== Math.floor(4000 * 5 / 12) || stripSays(st) !== "Score 1,666 · #1 of 1 today") fail(W, "the lost daily's strip: " + JSON.stringify(st));
    const lostPage = await A.ev(() => ({ share: !!document.querySelector("#ovScore .scShare") || !$("shareBtn").hidden, deb: $("ovDebrief").classList.contains("on") && getComputedStyle($("ovDebrief")).display !== "none",
      cls: document.body.classList.contains("pfShare"), title: $("ovTitle").textContent }));
    if (lostPage.share || lostPage.cls) fail(W, "a lost daily's page offers Share: " + JSON.stringify(lostPage));
    await f7audit(A, W, "lost daily's page", null);
    await f8photo(A, "lost");
    // ---- attempt 3 (Fight again), then the fourth: practice, said at once, nothing spent
    await f8again(A);
    f = await f8fight(A, W, { win: true, lives: 6 });
    if (f.said !== "This attempt counts. It is your last today.") fail(W, "the third attempt's word: " + f.said);
    await f7settled(A);
    st = await strip(A);
    // (the best stands: the first attempt's; the strip names the rank of the player's best)
    if (!/^Score [\d,]+ · #1 of 1 today$/.test(stripSays(st))) fail(W, "the third attempt's strip: " + JSON.stringify(st));
    const runs0 = (await S.query("select count(*)::int n from highland.hs_runs where user_id = $1 and mode = 'daily'", [uidA]))[0].n;
    await f8again(A);
    f = await f8fight(A, W, { win: true, lives: 12, practice: true });
    if (f.said !== "Practice: no attempts left today. This battle is not ranked.") fail(W, "the fourth attempt's word: " + f.said);
    await A.wait(400);
    st = await strip(A);
    if (!/^Score [\d,]+ · Practice: not ranked$/.test(stripSays(st))) fail(W, "the practice daily's strip: " + JSON.stringify(st));
    const runs1 = (await S.query("select count(*)::int n from highland.hs_runs where user_id = $1 and mode = 'daily'", [uidA]))[0].n;
    if (runs0 !== 3 || runs1 !== 3) fail(W, "the daily's runs on the server: " + runs0 + " then " + runs1 + " (three wanted)");
    const dp4 = (await evs(A, "daily_played")).pop();
    if (!dp4 || dp4.ranked !== false || dp4.attempt !== 0) fail(W, "the practice's daily_played: " + JSON.stringify(dp4));
    await f7audit(A, W, "practice daily's page", null);
    await f8photo(A, "practice");
    // the tab: none left, Practice
    await f7press(A, st.side ? "#boardBtn" : "#ovScore .scBoard");
    await dyReady(A).catch(() => {});
    dt = await dyTab(A);
    if (!dt || dt.mine[0] !== "Attempts left: 0 of 3" || dt.play !== "Practice" || !dt.note.includes("Your three attempts are used.")) fail(W, "the Daily tab with no attempt left: " + JSON.stringify(dt));
    await dyAuditTab(A, W, "Daily tab, attempts used", "tab-spent");
    await A.ev(() => closeHall());
    // ---- a second player's lower score ranks second
    let B = null;
    if (more) {
      log("  flow 8: B");
      B = await open(C, { storage: f7prog, quietCall: true });
      await B.page.waitForFunction(() => typeof gateState !== "undefined" && document.readyState === "complete");
      await S.control("provider", f7who(K, "d8b"));
      await signIn(B, null, "google", "name");
      const nameB = "Eight" + K + "B";
      await B.page.fill("#gate .gtField", nameB);
      await pressGo(B, "#gate .gtGo");
      await gate(B, "welcome");
      await f7map(B);
      await f8door(B, W);
      const dB = await dyTab(B);
      if (!dB || dB.badge !== 1 || dB.rows.length !== 1 || dB.rows[0].me || dB.mine.join("|") !== "Attempts left: 3 of 3") fail(W, "B's Daily tab: " + JSON.stringify(dB));
      await f8play(B, W);
      const fb = await f8fight(B, W, { win: false, cleared: 2 });
      await f7settled(B);
      const sb = await strip(B);
      if (stripSays(sb) !== "Score 666 · #2 of 2 today") fail(W, "B's strip: " + JSON.stringify(sb) + " " + fb.said);
      await done(B, W + " (B)");
    }
    // ---- the day changes: the next challenge, the attempts back, yesterday's first three. The stack's clock is set
    // to eight seconds before midnight UTC and the tab is left open: the page's own turn of the day (dyTimer, set
    // again from the tab's answer) asks for the new day and draws it (P6 review 5)
    log("  flow 8: the day changes");
    const toMid = (await S.query("select extract(epoch from (date_trunc('day', now() at time zone 'utc') + interval '1 day') - (now() at time zone 'utc'))::float8 s"))[0].s;
    await S.control("clock", { offset: Math.round((toMid - 8) * 1000) / 1000 });
    const p2 = (await S.query(`select p.level_id, p.twist from highland.hs_rulesets r, lateral highland._daily_pick(r.data, (now() at time zone 'utc')::date + 1) p where r.id = '2'`))[0];
    const i2 = await A.ev(id => LEVELS.findIndex(L => L.id === id), p2.level_id);
    const w2 = await A.ev(([i, t, d]) => ({ head: "Daily challenge · " + dailyDateWords(d), field: dailyTitle(i) + ", " + LEVELS[i].date, twist: twistName(t, i) }), [i2, p2.twist, today + 1]);
    await A.ev(() => { openCampaignMap(); });
    await f8door(A, W);
    const before = await dyTab(A);
    if (!before || before.head !== words.head) fail(W, "the tab before midnight: " + JSON.stringify(before && before.head) + ", wanted " + words.head);
    await A.page.waitForFunction(h => { const e = document.querySelector("#hallBody .dyTab .dyHead"); return hallOpen && hallTab === "daily" && !!e && e.textContent === h && !document.querySelector("#hallBody .lbLoading") && !DY.asking; }, w2.head, { timeout: 25000 })
      .catch(async () => fail(W, "the open tab did not turn to the next day by itself: " + JSON.stringify(await dyTab(A))));
    await A.wait(300);
    dt = await dyTab(A);
    const yWant = "Yesterday: 1. " + nameA + " " + exp1.toLocaleString("en-US") + (more ? " · 2. Eight" + K + "B 666" : "");
    if (!dt || dt.head !== w2.head || dt.field !== w2.field || !dt.twist.startsWith(w2.twist) || dt.mine.join("|") !== "Attempts left: 3 of 3" || dt.play !== "Play today's challenge" ||
      dt.rows.length || dt.yest !== yWant || dt.badge !== 1) fail(W, "the next day's tab: " + JSON.stringify(dt) + " wanted " + JSON.stringify(w2) + " " + yWant);
    const pd2 = await A.ev(() => Platform.daily());
    if (!pd2 || pd2.levelIndex !== i2 || pd2.twist !== p2.twist || pd2.day !== today + 1) fail(W, "Platform.daily() the next day: " + JSON.stringify(pd2));
    await dyAuditTab(A, W, "Daily tab, the next day", "tab-nextday");
    await A.ev(() => closeHall());
    const runsNext = async () => (await S.query("select count(*)::int n from highland.hs_runs where user_id = $1 and mode = 'daily' and day = (now() at time zone 'utc')::date + 1", [uidA]))[0].n;
    if (more) {
      // ---- the owner's daily switch off (P6 review 8): a page that has not heard it is refused at the first wave and
      // plays practice, nothing spent; once heard, the tab offers Practice and says why, and no badge
      log("  flow 8: the daily switched off");
      // (switched as the stats page's switch does it: hs_admin_set_config, A being the admin)
      const setDaily = (v) => A.ev(async v => { const r = await pfRpc("hs_admin_set_config", { p_key: "daily", p_value: v }, { auth: true, timeout: 10000 }); return r.ok ? "ok" : r.code; }, v);
      const off = await setDaily(false);
      if (off !== "ok") fail(W, "the daily was not switched off: " + off);
      await f8door(A, W);
      await f8play(A, W);
      let fx = await f8fight(A, W, { win: true, lives: 9, practice: true });
      if (fx.said !== "Practice: the daily's board is closed for now.") fail(W, "the daily switched off, its word: " + fx.said);
      await A.wait(300);
      st = await strip(A);
      if (!/^Score [\d,]+ · Practice: not ranked$/.test(stripSays(st))) fail(W, "the daily switched off, its strip: " + JSON.stringify(st));
      // (the page hears the switch as it reads hs_config at the load and the sign-in)
      await A.ev(async () => { const r = await pfRpc("hs_config", {}, {}); if (r.ok && r.data) pfCfgSet({ daily: r.data.daily !== false }); });
      await f8door(A, W);
      dt = await dyTab(A);
      if (!dt || dt.play !== "Practice" || dt.note !== "The daily's board is closed for now. Practice plays the same battle, not ranked." || dt.badge !== 0 || dt.sit) fail(W, "the Daily tab with the daily off: " + JSON.stringify(dt));
      await dyAuditTab(A, W, "Daily tab, the daily off", "tab-off");
      await A.ev(() => closeHall());
      await setDaily(true);
      await A.ev(() => pfCfgSet({ daily: true }));
      if (await runsNext()) fail(W, "a daily with the switch off spent an attempt");
      // ---- a newer ruleset published while the chronicle is up (P6 review 8): the first wave's daily_mismatch makes
      // it practice, nothing spent; the tab then says to reload and offers Practice
      log("  flow 8: a newer ruleset");
      await f8door(A, W);
      await f8play(A, W);
      const pub9 = await A.ev(async () => { const d = JSON.parse(JSON.stringify(rulesetData())); for (const k of Object.keys(d.daily.levels)) d.daily.levels[k].slow += 50;
        for (const k of Object.keys(d.levels)) d.levels[k].rev = (d.levels[k].rev || 1) + 7;
        const r = await pfRpc("hs_admin_publish_ruleset", { p_id: "9", p_data: d }, { auth: true, timeout: 20000 }); return r.ok ? "ok" : r.code; });
      if (pub9 !== "ok") fail(W, "the newer ruleset was not published: " + pub9);
      fx = await f8fight(A, W, { win: true, lives: 9, practice: true });
      if (fx.said !== "Practice: a new challenge has begun. This battle is not ranked.") fail(W, "the stale daily's word: " + fx.said);
      await A.wait(300);
      st = await strip(A);
      if (!/^Score [\d,]+ · Practice: not ranked$/.test(stripSays(st))) fail(W, "the stale daily's strip: " + JSON.stringify(st));
      await f8door(A, W);
      dt = await dyTab(A);
      if (!dt || dt.play !== "Practice" || dt.note !== "A newer version of the game is out. Reload the page to play for today's board." || dt.badge !== 0) fail(W, "the Daily tab with a newer ruleset: " + JSON.stringify(dt));
      await dyAuditTab(A, W, "Daily tab, a newer ruleset", "tab-stale");
      await A.ev(() => closeHall());
      // (no call takes a ruleset back: the stack's superuser removes it, so ruleset 2 is the newest again)
      { const c = await S.db.client("hs", "supabase_admin"); try { await c.query("delete from highland.hs_rulesets where id = '9'"); } finally { await c.end(); } }
      await A.ev(() => { DY.st = null; pfDrop("hs_pf_daily"); });
      if (await runsNext()) fail(W, "a stale daily spent an attempt");
    }
    // ---- the database down: Platform.daily() is still today's (the page's own lines), a daily begun is practice and spends nothing
    if (more) {
      log("  flow 8: offline");
      await S.control("rest", { mode: "down" });
      await A.ev(() => { DY.st = null; pfDrop("hs_pf_daily"); });
      const pd3 = await A.ev(() => Platform.daily());
      if (!pd3 || pd3.levelIndex !== i2 || pd3.twist !== p2.twist || pd3.server !== false || pd3.attemptsLeft !== null) fail(W, "Platform.daily() with the server down: " + JSON.stringify(pd3));
      await f8door(A, W);
      dt = await dyTab(A);
      if (!dt || dt.field !== w2.field || dt.play !== "Play today's challenge" || dt.empty !== "The daily's board needs a connection.") fail(W, "the Daily tab with the server down: " + JSON.stringify(dt));
      await f8play(A, W);
      const fo = await f8fight(A, W, { win: true, lives: 9, practice: true });
      if (fo.said !== "Practice: no connection. This battle is not ranked.") fail(W, "the offline daily's word: " + fo.said);
      await A.wait(300);
      st = await strip(A);
      if (!/^Score [\d,]+ · Practice: not ranked$/.test(stripSays(st))) fail(W, "the offline daily's strip: " + JSON.stringify(st));
      await S.control("rest", { mode: "up" });
      const n = (await S.query("select count(*)::int n from highland.hs_runs where user_id = $1 and mode = 'daily' and day = (now() at time zone 'utc')::date + 1", [uidA]))[0].n;
      if (n !== 0) fail(W, "a daily begun offline spent an attempt (" + n + ")");
      // ---- a guest (the gate optional; P6 review 7, 8): the tab offers Practice with the sign-in buttons, said once;
      // his daily is practice from its first wave, posts nothing, and his page turns the day too (dyTimer)
      log("  flow 8: a guest");
      await A.ev(() => closeHall());
      const G = await open(C, { storage: f7prog, quietCall: true, init: [[() => { window.__HS_PLATFORM_TEST = Object.assign(window.__HS_PLATFORM_TEST || {}, { gate: "optional" }); }, null]] });
      await G.page.waitForFunction(() => typeof gateState !== "undefined" && document.readyState === "complete");
      await gate(G, "signin");
      await pressGo(G, (0, eval)("() => Array.from(gateCardEl.querySelectorAll('button')).find(b => b.textContent === 'Play as a guest')"));
      await gate(G, "");
      await f7toMap(G);
      await f8door(G, W);
      const dg = await dyTab(G);
      if (!dg || dg.play !== "Practice" || !dg.sign || dg.note || dg.sit || dg.field !== w2.field || dg.badge !== 0) fail(W, "the guest's Daily tab: " + JSON.stringify(dg));
      const signWords = await G.ev(() => Array.from(document.querySelectorAll("#hallBody .dyTab .lbSign p")).map(p => p.textContent));
      if (signWords.join("|") !== "Sign in to play for today's board. Practice plays the same battle, not ranked.") fail(W, "the guest's sign-in words: " + JSON.stringify(signWords));
      if (!(await G.ev(() => !!DY.timer))) fail(W, "a guest's page has no turn of the day");
      await dyAuditTab(G, W, "the guest's Daily tab", "tab-guest");
      const gRuns = (await S.query("select count(*)::int n from highland.hs_runs where mode = 'daily'"))[0].n;
      await f8play(G, W);
      const fg = await f8fight(G, W, { win: true, lives: 9, practice: true });
      if (fg.said !== "Practice: sign in to play for today's board.") fail(W, "the guest's first wave: " + fg.said);
      await G.wait(300);
      const sg = await strip(G);
      if (!/^Score [\d,]+ · Practice: not ranked$/.test(stripSays(sg))) fail(W, "the guest's strip: " + JSON.stringify(sg));
      const dpg = (await evs(G, "daily_played")).pop();
      if (!dpg || dpg.ranked !== false || dpg.attempt !== 0) fail(W, "the guest's daily_played: " + JSON.stringify(dpg));
      if ((await S.query("select count(*)::int n from highland.hs_runs where mode = 'daily'"))[0].n !== gRuns) fail(W, "a guest's daily began a run");
      await f8photo(G, "guest-practice");
      await done(G, W + " (guest)");
      // ---- signed in with no name (P6 review 8): the name could not be saved twice, "Later"; the tab says to choose a
      // name and offers Practice, and the daily is practice from its first wave, nothing begun
      log("  flow 8: signed in, no name");
      const N = await open(C, { storage: f7prog, quietCall: true });
      await N.page.waitForFunction(() => typeof gateState !== "undefined" && document.readyState === "complete");
      await S.control("provider", f7who(K, "d8n"));
      await signIn(N, null, "google", "name");
      await S.control("rest", { mode: "down" });
      for (let k = 0; k < 2; k++) {
        await pressGo(N, "#gate .gtGo");
        await N.page.waitForFunction(() => { const e = document.querySelector("#gate .gtErr"); return !!e && !!e.textContent && !document.querySelector("#gate .gtGo").disabled; }, null, { timeout: 15000 }).catch(() => {});
      }
      await S.control("rest", { mode: "up" });
      await pressGo(N, "#gate .pfLater");
      await gate(N, "welcome");
      await f7map(N);
      await f8door(N, W);
      const dn = await dyTab(N);
      if (!dn || dn.play !== "Practice" || dn.note !== "Choose a name on the Account tab to play for today's board." || dn.sit || dn.badge !== 0 || dn.mine.length) fail(W, "the Daily tab with no name: " + JSON.stringify(dn));
      const nRuns = (await S.query("select count(*)::int n from highland.hs_runs where mode = 'daily'"))[0].n;
      await f8play(N, W);
      const fn = await f8fight(N, W, { win: true, lives: 9, practice: true });
      if (fn.said !== "Practice: choose a name to play for today's board.") fail(W, "no name, the first wave: " + fn.said);
      if ((await S.query("select count(*)::int n from highland.hs_runs where mode = 'daily'"))[0].n !== nRuns) fail(W, "a daily with no name began a run");
      await done(N, W + " (no name)");
    }
    await S.control("clock", { offset: "" });
    await done(A, W + " (A)");
  };

  // ================================================================ flow 9: the share card (work package P7)
  // A signed-in player with eight battlefields won wins Ani (a short name) and Sis (the longest title, "The King
  // Yields on Terms", after its Terms card); a guest under the optional gate wins Erebuni Rise. Each picture is read
  // back whole (a JPEG of 1200 x 630, its words as the page knows them), photographed with --photos (a folder p7),
  // and shared: with navigator.share and canShare stubbed the tap shares that file and words carrying the score (a
  // cancel is no error); without them the sheet's Save picture (a real download), Copy picture (a PNG to the
  // clipboard) and Copy text each work and say so, and Share link where navigator.share takes no file. Nothing is sent
  // for the picture: between the page opening and the tap no request but the strip's own post and the analytics
  const f9prog = (() => {
    const won = ["erebuni", "tushpa", "avarayr", "dvin", "tashir", "sevan", "ani", "mari"], eraOf = [0, 0, 1, 2, 2, 2, 7, 8], rec = {};
    won.forEach((id, i) => { rec[id] = { stars: [0, 3 - (i % 2), 0], lives: [0, 20 - i, 0], endless: [0, 0, 0] }; });
    const o = { hs_records: JSON.stringify(rec), hs_tutorial_done: "1", hs_chapters_seen: JSON.stringify(["kingdoms", "faith", "crowns", "night", "artsakh"]),
      hs_unlocked_seen: JSON.stringify(won.concat(["sis"])), hs_open_kept: JSON.stringify(["sis"]), hs_tricks_seen: JSON.stringify(["guard", "scout", "ambush", "hunter"]) };
    won.forEach((id, i) => { o["hs_best_" + id + "_" + eraOf[i]] = "21"; });
    return o;
  })();
  const F9SHOTS = PHOTOS ? path.join(PHOTOS, "p7") : null;
  if (F9SHOTS) fs.mkdirSync(F9SHOTS, { recursive: true });
  const f9photo = async (g, name) => { if (F9SHOTS) await g.page.screenshot({ path: path.join(F9SHOTS, name + "-" + g.o.key + ".png") }); };
  // a JPEG's size from its frame header
  const jpegSize = (buf) => {
    if (!buf || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) return null;
      const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  };
  // the picture the page holds, its words, and what the card says: { b64, bytes, type, name, text, info, ready }
  const f9card = (g) => g.ev(async () => {
    if (!SH.blob) return { ready: false };
    const a = new Uint8Array(await SH.blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return { ready: true, b64: btoa(s), bytes: a.length, type: SH.blob.type, name: SH.file ? SH.file.name : "", text: SH.text, info: JSON.parse(SH.key || "null"), bg: !!SH.bg };
  });
  // the picture ready, with the words wanted (the rank, once the server has said it)
  const f9ready = async (g, W, what, want) => {
    await g.page.waitForFunction(w => !!SH.blob && !SH.drawing && (!w || (SH.key && JSON.parse(SH.key).rank === w.rank)), want || null, { timeout: 20000 })
      .catch(async () => fail(W, what + ": no picture ready: " + JSON.stringify(await g.ev(() => ({ blob: !!SH.blob, drawing: SH.drawing.slice(0, 80), key: SH.key.slice(0, 200), page: SC.page })))));
    const c = await f9card(g);
    if (!c.ready) return c;
    const buf = Buffer.from(c.b64, "base64"), size = jpegSize(buf);
    c.buf = buf;
    if (c.type !== "image/jpeg" || !size || size.w !== 1200 || size.h !== 630) fail(W, what + ": the picture is not a JPEG of 1200 x 630: " + c.type + " " + JSON.stringify(size));
    if (c.bytes < 40000 || c.bytes > 600000) fail(W, what + ": the picture's size " + c.bytes + " bytes is far from 150 to 250 KB");
    if (!c.bg) fail(W, what + ": the field was not copied (the gradient stood in)");
    // every row's words are on the picture: in each row's box, pixels of the row's own color, far more than the field
    // alone has there (the canvas before the JPEG, so the colors are exact)
    const ink = await g.ev(() => {
      const card = SH.cv.getContext("2d"), field = SH.bg ? SH.bg.getContext("2d") : null, hex = (h) => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
      return shareRows(JSON.parse(SH.key)).map(r => {
        const w = 200, h = Math.round(r.px * 0.7), x0 = Math.round(r.align === "right" ? r.x - w : r.x), y0 = Math.round(r.y - h), c = hex(r.color);
        const count = (ctx) => {
          if (!ctx) return 0;
          const d = ctx.getImageData(x0, y0, w, h).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) < 36) n++;
          return n;
        };
        return { y: r.y, text: r.text, card: count(card), field: count(field) };
      });
    });
    for (const r of ink) if (r.card < 25 || r.card < 2 * r.field + 10) fail(W, what + ": the row \"" + r.text + "\" (y " + r.y + ") is not on the picture: " + JSON.stringify(r));
    notes.flows["p7 " + what + "@" + g.o.key] = Math.round(c.bytes / 1024) + " KB";
    if (F9SHOTS) fs.writeFileSync(path.join(F9SHOTS, "card-" + what + "-" + g.o.key + ".jpg"), buf);
    return c;
  };
  // the share's control as the page shows it at this size: the strip's Share, or held sideways the round button
  const f9btn = async (g) => ((await g.ev(() => phoneWide())) ? "#shareBtn" : "#ovScore .scShare");
  // navigator.share and canShare stubbed (files: whether canShare takes the picture; mode: "ok", "abort", "refuse"),
  // or taken away (null); and a clipboard that keeps what it was given
  const f9stub = (g, x) => g.ev((x) => {
    window.__shared = [];
    if (!x) { Object.defineProperty(navigator, "share", { configurable: true, writable: true, value: undefined }); Object.defineProperty(navigator, "canShare", { configurable: true, writable: true, value: undefined }); }
    else {
      Object.defineProperty(navigator, "canShare", { configurable: true, writable: true, value: (d) => !!x.files && !!d && Array.isArray(d.files) && d.files.length > 0 });
      Object.defineProperty(navigator, "share", { configurable: true, writable: true, value: (d) => {
        const f = d && d.files && d.files[0];
        window.__shared.push({ title: d.title, text: d.text, url: d.url, files: d.files ? d.files.length : 0, name: f && f.name, type: f && f.type, size: f && f.size, file: f || null });
        if (x.mode === "abort") return Promise.reject(new DOMException("Share canceled", "AbortError"));
        if (x.mode === "refuse") return Promise.reject(new DOMException("Not allowed", "NotAllowedError"));
        return Promise.resolve();
      } });
    }
    window.__clip = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      write: async (items) => { for (const it of items) for (const t of it.types) { const b = await it.getType(t); const a = new Uint8Array(await b.arrayBuffer()); window.__clip.push({ type: t, bytes: a.length, png: a[0] === 0x89 && a[1] === 0x50 && a[2] === 0x4e && a[3] === 0x47 }); } },
      writeText: async (t) => { window.__clip.push({ type: "text", text: t }); },
    } });
  }, x);
  // the share's events since n
  const f9evs = (g, n) => g.ev(n => (window.__hsEv || []).slice(n).filter(e => /^share_/.test(e[0])).map(e => e[0] + ":" + JSON.stringify(e[1])), n);
  const f9sheet = (g) => g.ev(() => {
    const s = $("shareSheet"), up = !!s && !s.classList.contains("shHidden") && SH.up;
    return { up, btns: up ? Array.from(s.querySelectorAll(".shBtns .btn")).map(b => b.textContent) : [], pic: up ? s.querySelector(".shPic").naturalWidth : 0,
      inert: overlayEl.hasAttribute("inert"), blocking: Platform.blocking() };
  });
  // the victory page's way to the card held to the audit on the phones, and the share's button live
  const f9page = async (g, W, what) => {
    const st = await strip(g), sel = await f9btn(g);
    const b = await g.ev(sel => { const e = document.querySelector(sel); return e ? { dis: e.disabled, hid: e.hidden || getComputedStyle(e).display === "none", vis: getComputedStyle(e).visibility } : null; }, sel);
    if (!b || b.hid || b.dis) fail(W, what + ": the Share button is not live: " + JSON.stringify(b));
    if (st.side) {
      const pos = await g.ev(() => { const a = $("shareBtn").getBoundingClientRect(), c = $("boardBtn").getBoundingClientRect(), gr = $("ovGear").getBoundingClientRect(); return { right: Math.round(innerWidth - a.right), top: Math.round(a.top), gapBoard: Math.round(c.left - a.right), board: !$("boardBtn").hidden, gear: Math.round(gr.left - c.right) }; });
      const Cz = SIZES.find(z => z.key === g.o.key) || {}, sar = Cz.insets ? Cz.insets.r || 0 : 0;
      if (b.vis !== "hidden" && (pos.right !== 110 + sar || pos.top !== 8 || (pos.board && pos.gapBoard !== 6))) fail(W, what + ": the round Share button is not at right 110 px, top 8 px, left of Leaderboard: " + JSON.stringify(pos));
    }
    if (["ses", "i15h", "i15u"].includes(g.o.key)) {
      const parts = st.side ? ["#ovRecord", "#boardBtn", "#shareBtn", "#ovGear"] : ["#ovScore", "#ovRecord"];
      const primary = st.side ? (b.vis === "hidden" ? ["#mapBtn"] : ["#shareBtn"]) : ["#ovScore .scShare"];
      await audit(g, W + " " + what + " victory page", { root: "#overlay", parts, primary, primaryRequired: true, scroll: upr(g.o) ? "page" : "inside" }, null);
    }
    const out = await g.ev(() => [...document.querySelectorAll("#overlay .bigRow .big, #ovScore button")].filter(b => b.offsetParent && b.getBoundingClientRect().bottom > innerHeight - 1).map(b => b.id || b.className));
    if (!upr(g.o) && out.length) fail(W, what + ": past the screen's foot: " + out.join(", "));
    return b.vis !== "hidden";
  };
  // the share pressed as the player presses it (held sideways under a long title its round button may hide: then by
  // Settings' row, as the player would)
  const f9tap = async (g, W, shown) => {
    if (shown) { await f7press(g, await f9btn(g)); return; }
    await pressGo(g, "#ovGear");
    await g.frames(3);
    const row = await g.ev(() => { const e = $("setShare"); return e && getComputedStyle(e).display !== "none"; });
    if (!row) { fail(W, "Settings has no Share row while the round button is hidden"); return; }
    await pressGo(g, "#setShare");
  };
  // one picture's whole round: its words, the file shared with stubs, a cancel, then the sheet and each of its buttons
  // (light: the file shared once, then back, for a page whose sheet another round has already held to every check)
  const f9share = async (g, W, what, want, light) => {
    const c = await f9ready(g, W, what, want.rank ? { rank: want.rank } : null);
    if (!c.ready) return;
    const I = c.info || {};
    for (const k of Object.keys(want)) if (JSON.stringify(I[k]) !== JSON.stringify(want[k])) fail(W, what + ": the card's " + k + " is " + JSON.stringify(I[k]) + ", not " + JSON.stringify(want[k]));
    const textWant = "I held " + want.field + " in Highland Stand with " + I.kept + " of " + I.max + " defenders. " + (I.score == null ? "" : "Score " + Number(I.score).toLocaleString("en-US") + ". ") + "https://highland.avunjian.com";
    if (c.text !== textWant) fail(W, what + ": the words: " + c.text);
    const shown = await f9page(g, W, what);
    await f9photo(g, "victory-" + what);
    // 1. the browser can share a file: the tap shares this picture, and its words carry the score
    await f9stub(g, { files: true, mode: "ok" });
    let n = await g.ev(() => (window.__hsEv || []).length);
    await f9tap(g, W, shown);
    await g.page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 5000 }).catch(() => {});
    const sh = await g.ev(async () => {
      const s = window.__shared[0];
      if (!s) return null;
      const bm = s.file ? await createImageBitmap(s.file) : null, same = s.file && SH.blob ? (await s.file.arrayBuffer()).byteLength === SH.blob.size : false;
      return { title: s.title, text: s.text, url: s.url, files: s.files, name: s.name, type: s.type, w: bm && bm.width, h: bm && bm.height, same };
    });
    const nameWant = "highland-stand-" + want.lv + ".jpg";
    if (!sh || sh.files !== 1 || sh.type !== "image/jpeg" || sh.w !== 1200 || sh.h !== 630 || sh.name !== nameWant || sh.title !== "Highland Stand" || sh.text !== textWant || !sh.same || sh.url !== undefined)
      fail(W, what + ": the share: " + JSON.stringify(sh));
    await g.wait(200);
    let ev = await f9evs(g, n);
    if (ev.join() !== 'share_tapped:{"from":"victory","method":"files"},share_done:{"method":"files"}') fail(W, what + ": the events of a share: " + ev.join());
    if ((await f9sheet(g)).up) fail(W, what + ": the sheet opened beside a share that worked");
    c.shown = shown;
    if (light) return c;
    // a cancel is no error: no sheet, no share_done, no toast
    await f9stub(g, { files: true, mode: "abort" });
    await toasts(g);
    n = await g.ev(() => (window.__hsEv || []).length);
    const t0 = await g.ev(() => window.__hsToasts.length);
    await f9tap(g, W, shown);
    await g.wait(400);
    ev = await f9evs(g, n);
    if (ev.join() !== 'share_tapped:{"from":"victory","method":"files"}' || (await f9sheet(g)).up || (await g.ev(t => window.__hsToasts.slice(t), t0)).length) fail(W, what + ": a cancel: " + ev.join());
    // 2. no navigator.share at all: the sheet, with Save picture, Copy picture and Copy text (no Share link)
    await f9stub(g, null);
    n = await g.ev(() => (window.__hsEv || []).length);
    await f9tap(g, W, shown);
    await g.page.waitForFunction(() => SH.up && $("shareSheet").querySelector(".shPic").complete, null, { timeout: 5000 }).catch(() => {});
    let sv = await f9sheet(g);
    if (!sv.up || sv.btns.join() !== "Save picture,Copy picture,Copy text" || sv.pic !== 1200 || !sv.inert || !sv.blocking) fail(W, what + ": the sheet: " + JSON.stringify(sv));
    ev = await f9evs(g, n);
    if (ev.join() !== 'share_tapped:{"from":"victory","method":"sheet"}') fail(W, what + ": the sheet's event: " + ev.join());
    if (["ses", "i15h", "i15u", "ipad"].includes(g.o.key) || what === "short") await audit(g, W + " " + what + " the sheet", { root: "#shareSheet", parts: ["#shareSheet .shCard"], primary: ["#shareSheet .shSave"], primaryRequired: true, scroll: "inside" }, null);
    await f9photo(g, "sheet-" + what);
    // Save picture: a real download of the picture
    n = await g.ev(() => (window.__hsEv || []).length);
    const tz = await g.ev(() => window.__hsToasts.length);
    const dl = g.page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await pressGo(g, "#shareSheet .shSave");
    const d = await dl;
    if (!d) fail(W, what + ": Save picture gave no download");
    else {
      const p = await d.path().catch(() => null), buf = p ? fs.readFileSync(p) : null, size = jpegSize(buf);
      if (d.suggestedFilename() !== nameWant || !size || size.w !== 1200 || size.h !== 630 || !buf.equals(c.buf)) fail(W, what + ": the download: " + d.suggestedFilename() + " " + JSON.stringify(size));
    }
    // Copy picture, Copy text
    await pressGo(g, "#shareSheet .shCopyPic");
    // (the PNG is made from the 1200 x 630 canvas as the sheet opens: a busy machine takes some seconds over it)
    await g.page.waitForFunction(t => window.__clip.length > 0 && window.__hsToasts.length > t + 1, tz, { timeout: 30000 }).catch(() => {});
    await pressGo(g, "#shareSheet .shCopyText");
    await g.page.waitForFunction(() => window.__clip.length > 1, null, { timeout: 5000 }).catch(() => {});
    const clip = await g.ev(() => window.__clip);
    if (clip.length !== 2 || clip[0].type !== "image/png" || !clip[0].png || clip[0].bytes < 40000 || clip[1].type !== "text" || clip[1].text !== textWant) fail(W, what + ": the clipboard: " + JSON.stringify(clip).slice(0, 300));
    await g.wait(150);
    const said = await g.ev(t => window.__hsToasts.slice(t), tz);
    if (said.join("|") !== "Picture saved.|Copied.|Copied.") fail(W, what + ": the toasts: " + said.join("|"));
    ev = await f9evs(g, n);
    if (ev.join() !== 'share_done:{"method":"save"},share_done:{"method":"copy_picture"},share_done:{"method":"copy_text"}') fail(W, what + ": the sheet's events: " + ev.join());
    // the sheet still up, the toast over it: then it closes (Escape on the desktop, its X by touch), the page in reach
    const tOver = await g.ev(() => { const t = $("toast"); return +getComputedStyle(t).zIndex > +getComputedStyle($("shareSheet")).zIndex; });
    if (!tOver) fail(W, what + ": the toast is under the sheet");
    if (g.touch) await pressGo(g, "#shareSheet .shX"); else { await g.page.keyboard.press("Escape"); }
    await g.frames(3);
    sv = await f9sheet(g);
    if (sv.up || sv.inert || sv.blocking) fail(W, what + ": the sheet did not close: " + JSON.stringify(sv));
    if ((await g.ev(() => menuMode)) !== "victory") fail(W, what + ": closing the sheet left the victory page");
    // 3. navigator.share without files: the sheet with Share link, which shares the words
    await f9stub(g, { files: false, mode: "ok" });
    await f9tap(g, W, shown);
    await g.page.waitForFunction(() => SH.up, null, { timeout: 5000 }).catch(() => {});
    sv = await f9sheet(g);
    if (sv.btns.join() !== "Save picture,Copy picture,Copy text,Share link") fail(W, what + ": the sheet with navigator.share and no files: " + sv.btns.join());
    n = await g.ev(() => (window.__hsEv || []).length);
    await pressGo(g, "#shareSheet .shLink");
    await g.page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 5000 }).catch(() => {});
    const lk = await g.ev(() => window.__shared[0] || null);
    if (!lk || lk.files !== 0 || lk.text !== textWant || lk.title !== "Highland Stand") fail(W, what + ": Share link: " + JSON.stringify(lk));
    await g.wait(150);
    if ((await f9evs(g, n)).join() !== 'share_done:{"method":"link"}') fail(W, what + ": Share link's event: " + (await f9evs(g, n)).join());
    if (g.touch) await pressGo(g, "#shareSheet .shX"); else await g.page.keyboard.press("Escape");
    await g.frames(2);
    // a refusal other than a cancel (the tap's permission spent): the sheet instead
    await f9stub(g, { files: true, mode: "refuse" });
    await f9tap(g, W, shown);
    await g.page.waitForFunction(() => SH.up, null, { timeout: 5000 }).catch(() => fail(W, what + ": a refused share did not open the sheet"));
    await g.ev(() => shClose());
    // Settings' row leads to the same card on every layout (held sideways, the way there when a title hides the button)
    if (shown) {
      await f9stub(g, null);
      await f9tap(g, W, false);
      await g.page.waitForFunction(() => SH.up, null, { timeout: 5000 }).catch(() => fail(W, what + ": Settings' Share row did not open the sheet"));
      await g.ev(() => shClose());
    }
    c.shown = shown;
    return c;
  };
  // the requests made since n: none but the platform's own calls to the stack's API (the strip's post, analytics)
  const f9quiet = (g, W, n, what) => {
    const bad = g.reqs.slice(n).filter(u => !(u.startsWith(API + "/rest/v1/rpc/hs_") || u.startsWith(API + "/auth/v1/")));
    if (bad.length) fail(W, what + ": requests beside the platform's own: " + bad.slice(0, 4).join(", "));
  };
  const flow9 = async (C) => {
    const W = "flow 9 " + C.name;
    await resetStack();
    const K = C.key;
    const A = await open(C, { storage: f9prog, quietCall: true });
    await A.page.waitForFunction(() => typeof gateState !== "undefined" && document.readyState === "complete");
    await S.control("provider", f7who(K, "s"));
    await signIn(A, null, "google", "name");
    const nameA = "Nine" + K;
    await A.page.fill("#gate .gtField", nameA);
    await pressGo(A, "#gate .gtGo");
    await gate(A, "welcome");
    const uidA = await uidOf(A);
    // the page's ruleset published (flow 7 does it from the stats page's button)
    await S.control("admin", { user_id: uidA });
    const pub = await A.ev(async () => { const r = await pfRpc("hs_admin_publish_ruleset", { p_id: PF_RULESET_ID, p_data: pfRules() }, { auth: true, timeout: 20000 }); return r.ok && r.data && r.data.ok === true; });
    if (!pub) fail(W, "the ruleset was not published");
    await f7map(A);
    log("  flow 9: a short name: Ani");
    let n0 = A.reqs.length;
    let v = await f7win(A, W, { lv: 6, sec: 820, spent: 600, lives: 17 });
    await f7settled(A);
    let st = await strip(A);
    if (st.state !== "posted" || st.score == null) fail(W, "Ani's strip: " + JSON.stringify(st));
    const ani = await f9share(A, W, "short", { title: "Ani Stands!", hy: "Անի", field: "Ani", lv: "ani", diff: "Normal", kept: Math.min(v.lives, v.lives_board), max: v.lives_max, stars: v.stars,
      rank: 1, player: nameA, open: false, daily: null, site: "highland.avunjian.com", url: "https://highland.avunjian.com" });
    f9quiet(A, W, n0, "Ani");
    // the rank arrives while the sheet is open (a player who taps Share before the post's answer): the sheet takes the
    // new picture, and Save picture still saves it, the new one
    log("  flow 9: a new picture while the sheet is open");
    await f9stub(A, null);
    await f9tap(A, W, ani.shown);
    await A.page.waitForFunction(() => SH.up && $("shareSheet").querySelector(".shPic").complete, null, { timeout: 5000 }).catch(() => fail(W, "the sheet did not open for the redraw"));
    const url0 = await A.ev(() => SH.url);
    await A.ev(() => { SC.page.rank = 2; scRender(); });
    const c2 = await f9ready(A, W, "redrawn", { rank: 2 });
    await A.page.waitForFunction(() => $("shareSheet").querySelector(".shPic").complete, null, { timeout: 5000 }).catch(() => {});
    const rs = await A.ev(async () => {
      const s = $("shareSheet"), save = s.querySelector(".shSave");
      let fetched = 0;
      try { fetched = (await (await fetch(save.href)).arrayBuffer()).byteLength; } catch (e) { fetched = -1; }
      return { up: SH.up, url: !!SH.url, pic: s.querySelector(".shPic").src === SH.url, save: save.href === SH.url, fetched, size: SH.blob.size, w: s.querySelector(".shPic").naturalWidth };
    });
    if (!rs.up || !rs.url || !rs.pic || !rs.save || rs.fetched !== rs.size || rs.w !== 1200 || url0 === "" ) fail(W, "the sheet after a new picture: " + JSON.stringify(rs));
    const tr = await A.ev(() => window.__hsToasts.length);
    const dl2 = A.page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await pressGo(A, "#shareSheet .shSave");
    const d2 = await dl2;
    const b2 = d2 ? await d2.path().then(p => fs.readFileSync(p)).catch(() => null) : null;
    if (!b2 || !c2.buf || !b2.equals(c2.buf)) fail(W, "Save picture after a new picture did not save the new picture: " + (b2 ? b2.length : "no download") + " of " + (c2.buf ? c2.buf.length : "?"));
    await A.wait(150);
    if ((await A.ev(t => window.__hsToasts.slice(t), tr)).join("|") !== "Picture saved.") fail(W, "the toast after Save on a new picture");
    await A.ev(() => shClose());
    log("  flow 9: the longest title: Sis, after its Terms card");
    await A.ev(() => openCampaignMap());
    n0 = A.reqs.length;
    v = await f7win(A, W, { lv: 8, sec: 1500, spent: 900, lives: 12 });
    await f7settled(A);
    await f9share(A, W, "long", { title: "The King Yields on Terms", hy: "Սիս", field: "Sis", lv: "sis", kept: Math.min(v.lives, v.lives_board), max: v.lives_max, stars: v.stars, rank: 1, player: nameA });
    f9quiet(A, W, n0, "Sis");
    // the title shrunk to fit 640 px, no less than 40 px (read off the page's own measure in the page's face)
    const fit = await A.ev(() => { const g = document.createElement("canvas").getContext("2d"), f = getComputedStyle(document.body).fontFamily; let px = 62; const w = (p) => { g.font = "bold " + p + "px " + f; return g.measureText("The King Yields on Terms").width; }; while (px > 40 && w(px) > 640) px--; return { px, w: Math.round(w(px)) }; });
    if (fit.px >= 62 || fit.px < 40) fail(W, "the long title was not shrunk: " + JSON.stringify(fit));
    notes.flows["p7 long title@" + K] = fit.px + " px, " + fit.w + " px wide";
    // a victory no board ranks (a coached stand: its start says ranked: false): no strip, no Leaderboard, but its card,
    // without a score or a rank (section 6 draws a card for every victory page)
    log("  flow 9: a victory no board ranks: the card without a score");
    await A.ev(() => openCampaignMap());
    n0 = A.reqs.length;
    v = await f7win(A, W, { lv: 1, ranked: false, token: false, runback: false, sec: 640, lives: 19, before: () => A.ev(() => { battle.tutorial = true; }) });
    if (!v || v.tutorial !== true) fail(W, "the coached victory's event: " + JSON.stringify(v && { tutorial: v.tutorial }));
    await A.wait(600);
    st = await strip(A);
    if (st.words || st.rec != null || st.board || st.boardRow || st.state != null) fail(W, "a victory no board ranks has a strip: " + JSON.stringify(st));
    await f9share(A, W, "unranked", { field: "Vale of Tushpa", lv: "tushpa", score: null, rank: null, player: nameA, kept: Math.min(v.lives, v.lives_board), max: v.lives_max, stars: v.stars }, true);
    f9quiet(A, W, n0, "the unranked victory");
    await done(A, W + " (A)");
    log("  flow 9: a guest (the gate optional): no name, no rank");
    const G = await open(C, { storage: f9prog, quietCall: true, init: [[() => { window.__HS_PLATFORM_TEST = Object.assign(window.__HS_PLATFORM_TEST || {}, { gate: "optional" }); }, null]] });
    await gate(G, "signin");
    await pressGo(G, (0, eval)("() => Array.from(gateCardEl.querySelectorAll('button')).find(b => b.textContent === 'Play as a guest')"));
    await gate(G, "");
    await f7toMap(G);
    n0 = G.reqs.length;
    v = await f7win(G, W, { lv: 0, token: false, runback: false, sec: 700, lives: 18 });
    await f7settled(G);
    st = await strip(G);
    if (!/· Sign in to post it$/.test(stripSays(st))) fail(W, "the guest's strip: " + JSON.stringify(st));
    await f9share(G, W, "guest", { title: "Erebuni Rise Stands!", field: "Erebuni Rise", lv: "erebuni", rank: null, player: null, kept: Math.min(v.lives, v.lives_board), max: v.lives_max });
    f9quiet(G, W, n0, "the guest");
    if (K === "desk") {
      // a daily's card, staged (no daily can be fought before work package P6): the strip's record made a daily's, to
      // see its two extra lines on the picture
      await G.ev(() => { Object.assign(SC.page, { daily: true, twist: "thin", state: "posted", rank: 12, total: 87 }); shSync(); });
      const dc = await f9ready(G, W, "daily-staged", { rank: 12 });
      if (dc.ready && (!dc.info.daily || dc.info.daily.twist !== "Thin purse" || !/^Highland Stand daily, [A-Z][a-z]{2} \d{1,2}: Erebuni Rise, Thin purse\. Score [\d,]+, #12 today\. https:\/\/highland\.avunjian\.com$/.test(dc.text)))
        fail(W, "the staged daily's card: " + JSON.stringify(dc.info) + " " + dc.text);
      // a browser that will not make the picture: tried once more, then Share is taken away, not left grey for good
      await G.ev(() => { window.__toBlob = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function (cb) { setTimeout(() => cb(null), 0); }; shPage(); scRender(); });
      await G.page.waitForFunction(() => SH.failed, null, { timeout: 10000 }).catch(() => fail(W, "a picture that cannot be made: Share stays"));
      const nf = await G.ev(() => ({ tries: SH.tries, strip: !!document.querySelector("#ovScore .scShare"), round: !$("shareBtn").hidden, cls: document.body.classList.contains("pfShare"), words: !!document.querySelector("#ovScore .scWords .scLine, #ovScore .scWords .scLink") && !$("ovScore").hidden }));
      if (nf.tries !== 2 || nf.strip || nf.round || nf.cls || !nf.words) fail(W, "a picture that cannot be made: " + JSON.stringify(nf));
      await G.ev(() => { HTMLCanvasElement.prototype.toBlob = window.__toBlob; shPage(); scRender(); });
      await G.page.waitForFunction(() => !!SH.blob && !!document.querySelector("#ovScore .scShare"), null, { timeout: 20000 }).catch(() => fail(W, "the card did not come back once a picture could be made"));
    }
    // the page left: the card goes with it
    await G.ev(() => openCampaignMap());
    await G.frames(3);
    const gone = await G.ev(() => ({ blob: !!SH.blob, cls: document.body.classList.contains("pfShare"), btn: !$("shareBtn").hidden }));
    if (gone.blob || gone.cls || gone.btn) fail(W, "the card stays after the page: " + JSON.stringify(gone));
    await done(G, W + " (a guest)");
  };

  const FLOW = { 1: flow1, 2: flow2, 3: flow3, 4: flow4, 5: flow5, 6: flow6, 7: flow7, 8: flow8, 9: flow9, 10: flow10, 11: flow11, 13: flow13, 14: flow14, 15: flow15, "4more": flow4more, "5more": flow5more, "13more": flow13more, "13del": flow13del, "13gone": flow13gone };
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
  // a close that never once landed by itself: the save that goes with a closing page is not working at all
  if (notes.closeTried && (notes.closeLost || 0) >= notes.closeTried) fail("close", "every one of the " + notes.closeTried + " closes fell back to the next load: no write with a closing page landed");
  R.finish("platform", fails, notes, t0);
})().catch(e => { console.log("FAIL platform: " + (e && e.stack || e)); process.exit(1); });
