// The game on an iPhone, held sideways in Safari (its bars showing) and from the Home Screen (full screen, the safe
// areas of the sensor housing and the home indicator kept clear), and held upright: every screen and pop-up is opened
// as a player opens it, by touch, and held to the quality bar:
// - a pop-up lies inside the visible area minus the safe areas, or scrolls inside itself with its way forward in view
//   (held upright, a page may scroll: the owner's best effort there);
// - every control is on screen, out of the safe areas, uncovered at its center and corners (elementFromPoint), and
//   at least 44 x 44 px to a finger where it is the way forward, never under 36 px (measured through its center, so
//   a reach widened past the drawn button counts);
// - text at least 11 px, not cut off, not under a button or anything else; the text drawn on the canvases too
//   (the wave and pause banners, the map's names, the nardi board and the field itself);
// - the field as large as the HUD lets it be: it must fill FIELD_SHARE of the safe area, and the part of it free of
//   the HUD FIELD_CLEAR; no pad, plot sign or tower under the HUD; a tower's tap zone at least 36 px;
// - nothing that holds the battle (a trick card, a tower panel, the foe card, Settings, the coach, a card over the
//   nardi board, the crash card, the rotate card) is left without a way out: its close or onward button is pressed
//   by a finger and must put it away;
// - held upright, the rotate card speaks of a phone, and Play in portrait leaves every control in reach;
// - in Safari (navigator.standalone false) a one-time tip says how to add the game to the Home Screen: shown on
//   the first screen or the map, never modal and never over a control, closed by its own button, remembered in an
//   hs_ key so a reload does not show it again; from the Home Screen it never shows.
// The sizes (CSS px, touch, an iPhone's Safari user agent): Safari SE 667x320, iPhone 15 734x343, Pro Max 814x380;
// Safari across the whole width with the insets (viewport-fit=cover may report them held sideways) iPhone 15 852x343
// and Pro Max 932x380; Home Screen SE 667x375, iPhone 15 852x393 and Pro Max 932x430 with insets left 59, right 59, bottom 21 (laid on
// the page as --sa*, lib.js openGame); upright 393x659 and 375x553. --quick: iPhone 15 in Safari and from the Home
// Screen. Prints one line per failure (FAIL <size> <state>: ...), a FIELD line per size, a RESULT line, exits 1 on any.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/iphone.js [index.html] [--quick] [--sizes=i15s,i15h]
//         [--only=pages,map,...] [--dpr=3] [--shots=dir] [--photos=dir] [--jobs=n] [--verbose]
//   --shots   a photo of every state that failed; --photos a photo of every state; --dpr their density (default 1)
//   --only    some of the states: tip, pages, map, settings, council, chronicle, battle, panel, foe, tricks, note, bubble,
//             crash, victory, defeat, nardi, coach, towers (rotate is part of battle)
// The War Council (gameplay 4.6, 8.2, 8.4 playtest 4): on a save with stars to spend its one-time card comes up over
// the map and its button opens the Hall on the Council; the panel lies wholly in the Hall's box (held sideways
// nothing in it scrolls) and is held to the bar; a finger takes three tiers, resets the Council (a second tap
// confirms) and takes a tier again; the Hall's close gives the map back. The chronicle's #briefKit (the Council's
// chip, the Standard switch 44 px tall, which a tap turns on) and the victory page's #ovGrowth (held sideways one
// line of text in place of the prose's last line; upright a button 44 px tall) are held to the bar with their pages.
"use strict";
const path = require("path");
const R = require("./lib");
const AU = require("./iphone-audit");
const { devices } = require(process.env.PW_PATH || "playwright");
const o = R.cli();
const t0 = Date.now();
const opt = (k, d) => { const a = o.rest.find(x => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
const DPR = +opt("dpr", 1) || 1;
const PHOTOS = opt("photos", null) ? path.resolve(opt("photos")) : null;
if (PHOTOS) require("fs").mkdirSync(PHOTOS, { recursive: true });
const ONLY = opt("only", null) ? opt("only").split(",") : null;
const want = (k) => !ONLY || ONLY.includes(k);
const UA = devices["iPhone 15"].userAgent;
const HOME_INSETS = { l: 59, r: 59, b: 21, t: 0 };
const FIELD_SHARE = 0.55;   // the field's share of the safe area, at least
const FIELD_CLEAR = 0.45;   // the share of the safe area where the field shows with no HUD over it, at least

const SIZES = [
  { key: "ses", name: "SE Safari 667x320", w: 667, h: 320, home: false },
  { key: "i15s", name: "iPhone 15 Safari 734x343", w: 734, h: 343, home: false },
  { key: "maxs", name: "Pro Max Safari 814x380", w: 814, h: 380, home: false },
  { key: "seh", name: "SE Home Screen 667x375", w: 667, h: 375, home: true },
  { key: "i15h", name: "iPhone 15 Home Screen 852x393", w: 852, h: 393, home: true, insets: HOME_INSETS },
  { key: "maxh", name: "Pro Max Home Screen 932x430", w: 932, h: 430, home: true, insets: HOME_INSETS },
  // Safari held sideways with viewport-fit=cover reports the whole width and the insets too (as the Home Screen does)
  { key: "i15c", name: "iPhone 15 Safari full width 852x343", w: 852, h: 343, home: false, insets: HOME_INSETS },
  { key: "maxc", name: "Pro Max Safari full width 932x380", w: 932, h: 380, home: false, insets: HOME_INSETS },
  { key: "i15u", name: "iPhone 15 upright 393x659", w: 393, h: 659, home: false, upright: true },
  { key: "seu", name: "SE upright 375x553", w: 375, h: 553, home: false, upright: true },
];
const pick = opt("sizes", null);
const RUN = pick ? SIZES.filter(s => pick.split(",").includes(s.key)) : o.quick ? SIZES.filter(s => ["i15s", "i15h"].includes(s.key)) : SIZES;
const LONG_TOAST = "The field is clear: tap or click Send Wave for wave 7, or switch on Auto to keep them coming.";

(async () => {
  const browser = await R.launch();
  const fails = [], fieldLines = [];
  let states = 0;
  const counts = {};

  const runSize = async (C) => {
    const tag = C.name;
    const page = { w: C.w, h: C.h, touch: true, dpr: DPR, name: tag, ua: UA, standalone: !!C.home, insets: C.insets, init: [[AU.canvasHook]] };
    let g = null;
    const log = (m) => { if (o.verbose) console.log(tag + " " + m); };
    const shotName = (label) => C.key + " " + label;
    // a failure of a state; the same failure on the pages of one leaf or the steps of the coach is told once, with
    // the pages or steps it was seen on
    const raw = [];
    const fail = (label, m) => { raw.push({ label, m }); };
    const groupOf = (label) => { const p = /^(.*?) page (\d+)$/.exec(label); if (p) return [p[1], "page " + p[2]]; const c = /^coach (\d+ \S+)$/.exec(label); return c ? ["coach", c[1]] : [label, ""]; };
    const flush = () => {
      const by = new Map();
      for (const { label, m } of raw) {
        const [gr, sub] = groupOf(label), k = gr + "\u0000" + m;
        if (!by.has(k)) by.set(k, { gr, m, subs: [] });
        if (sub) by.get(k).subs.push(sub);
      }
      counts[C.key] = by.size;
      for (const { gr, m, subs } of by.values()) fails.push(tag + " " + gr + (subs.length ? " (" + (subs[0].startsWith("page") ? "pages " + subs.map(x => x.slice(5)).join(", ") : subs.join(", ")) + ")" : "") + ": " + m);
    };
    const open = async () => {
      if (g) await g.close();
      g = await R.openGame(browser, o.file, page);
      await g.ev(AU.install);
      // every trick counts as met: a first-time card would otherwise come up over the states staged here (the cards
      // themselves are opened one by one in their own state)
      await g.ev(() => { for (const k of ["hidden", "guards", "ambush", "hunters", "adapt"]) markTrickSeen(k); });
    };
    const settle = async (n) => { await g.frames(n || 3); };
    const hidden = (sel) => g.ev(sel => { const e = document.querySelector(sel); return !e || !__hsAudit.visible(e); }, sel);
    const shown = async (sel) => !(await hidden(sel));
    // one state held to the bar; a photo of it under --shots when it fails, and under --photos always
    const check = async (label, spec) => {
      states++;
      let res;
      try { res = await g.ev(spec => __hsAudit.check(spec), spec); } catch (e) { res = { fails: ["the check failed: " + e.message.split("\n")[0]], notes: [] }; }
      for (const f of res.fails) fail(label, f);
      if (o.verbose) for (const n of res.notes) console.log(tag + " " + label + ": note: " + n);
      if (res.fails.length) await g.shot(o.shots, shotName(label));
      if (PHOTOS) await g.shot(PHOTOS, shotName(label));
      return res;
    };
    // a finger on a control: it must be in reach (else the failure is told and the control is pressed by script, so
    // the walk goes on)
    const tap = async (label, sel, why, scroll) => {
      // a page that runs past the screen is scrolled to the button first, as a finger would (the page's own check
      // says whether it may run so)
      if (scroll) await g.ev(sel => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "nearest", inline: "nearest" }); }, sel);
      const q = await g.reach(sel);
      if (q.why) {
        fail(label, (why || "cannot tap " + sel) + ": " + q.why);
        // pressed by script as a finger would press it (a tower's tile answers its pointerdown, a button its click)
        const ok = await g.ev(sel => {
          const e = document.querySelector(sel);
          if (!e) return false;
          const o = { bubbles: true, cancelable: true, pointerType: "touch", pointerId: 99, isPrimary: true };
          e.dispatchEvent(new PointerEvent("pointerdown", o));
          e.dispatchEvent(new PointerEvent("pointerup", o));
          e.click();
          return true;
        }, sel);
        await settle(2);
        return ok ? "script" : "";
      }
      await g.tapAt(q.x, q.y);
      await settle(2);
      return "finger";
    };
    // the text a canvas drew over two frames (or while fn ran), under 11 px
    const canvasText = async (label, which, fn) => {
      await g.ev(() => { __hsText.list = []; __hsText.on = true; });
      if (fn) await g.ev(fn); else await settle(2);
      const rep = await g.ev(() => { __hsText.on = false; __hsText.ribbon = false; return __hsAudit.textReport(); });
      for (const k of which) {
        const b = rep[k];
        if (!b) continue;
        if (b.small.length) fail(label, "the " + (k === "game" ? "field" : k) + " canvas draws text under 11 px: " +
          b.small.map(([t, px]) => '"' + t + '" ' + px + " px").join(", "));
      }
      return rep;
    };
    const step = async (key, label, fn) => {
      if (!want(key)) return;
      try { await fn(); } catch (e) { fail(label, "the walk stopped: " + e.message.split("\n")[0]); await g.shot(o.shots, shotName(label + " stopped")); }
    };
    const pageSpec = (parts, primary) => ({ root: "#overlay", parts, primary, scroll: C.upright ? "page" : "inside", primaryRequired: true });
    // the boxes that must lie in the safe area (a bar's background may run under the insets; its controls and text
    // are held to the bar one by one)
    const MAP_PARTS = ["#worldMap", "#ovGear", "#ovStars", "#nardiBtn"];
    const LEAF_PARTS = ["#ovPage", "#ovGear"];
    const BATTLE_CTRLS = "#topbar button, #shop .card, #waveBtn, #waveInfo .chip, #spellbar .spell";
    const BATTLE = { controls: BATTLE_CTRLS, primary: ["#waveBtn", "#shop .card"], parts: ["#topbar .hudPlaque", "#spellbar", "#shop .trayCap.right"],
      text: ["#topbar", "#shop", "#spellbar"], scroll: "inside" };
    const NEEDED = ["#musicBtn", "#sfxBtn", "#gearBtn", "#autoBtn", "#hudPause", "#speedBtn", "#waveBtn", "#heroBtn"];
    // the battle's HUD and field
    const battleCheck = async (label) => {
      await check(label, BATTLE);
      const miss = await g.ev(sel => sel.filter(s => !__hsAudit.visible(document.querySelector(s))), NEEDED);
      if (miss.length) fail(label, "controls missing from the HUD: " + miss.join(", "));
      const chips = await g.ev(() => {
        const box = waveInfoEl.getBoundingClientRect(), all = [...waveInfoEl.querySelectorAll(".chip")];
        return { all: all.length, seen: all.filter(c => { const r = c.getBoundingClientRect(); return r.width && r.bottom <= box.bottom + 1 && r.right <= box.right + 1; }).length };
      });
      if (chips.seen < chips.all) fail(label, "the next-wave row shows " + chips.seen + " of its " + chips.all + " chips (the rest wrap out of sight)");
      const F = await g.ev(() => __hsAudit.field());
      if (C.upright) {
        // held upright (the owner's fallback after Play in portrait, no portrait redesign) the 16:9 field can be no
        // larger than the width allows: it must span the whole safe width, with nothing of the HUD over it
        if (F.w < F.safeW - 1) fail(label, "the field is " + F.w + " px wide of the " + Math.round(F.safeW) + " the width allows");
        if (F.clear < F.share * 0.97) fail(label, "the HUD lies over " + Math.round((1 - F.clear / F.share) * 100) + "% of the field (needs under 3% held upright)");
      } else {
        if (F.share < FIELD_SHARE) fail(label, "the field is " + F.w + "x" + F.h + ", " + Math.round(F.share * 100) + "% of the safe area (needs " + Math.round(FIELD_SHARE * 100) + "%)");
        if (F.clear < FIELD_CLEAR) fail(label, "the field free of the HUD is " + Math.round(F.clear * 100) + "% of the safe area (needs " + Math.round(FIELD_CLEAR * 100) + "%)");
      }
      for (const p of F.pads.concat(F.plots, F.towers)) fail(label, p);
      if (F.zone && Math.min(F.zone.w, F.zone.h) < 36) fail(label, "a tower's tap zone is as small as " + F.zone.w + "x" + F.zone.h + " px (needs 36)");
      if (F.plotLabel !== null && F.plotLabel < 10.95) fail(label, "a plot's price board reads at " + F.plotLabel.toFixed(1) + " px on an iPhone's density (needs 11)");
      return F;
    };
    // the Home Screen tip: whatever on screen tells to add the game to the Home Screen
    const tipFind = () => g.ev(() => {
      // the words as shown (innerText leaves out what is hidden: a tip kept in the page but not shown is not seen)
      const els = [...document.body.querySelectorAll("div, section, aside, p")].filter(e => __hsAudit.visible(e) && /home screen/i.test(e.innerText || "") && !e.closest("#overlay #ovPage"));
      // the smallest box that holds the words and a button
      const box = els.filter(e => e.querySelector("button, [role=button]")).sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      if (!box) return null;
      if (!box.id) box.id = "__hsTip";
      const btn = box.querySelector("button, [role=button]");
      if (!btn.id) btn.id = "__hsTipX";
      return { box: "#" + box.id, btn: "#" + btn.id, text: box.innerText.replace(/\s+/g, " ").trim().slice(0, 160) };
    });
    let tipSeen = null;
    const tipStep = async (where) => {
      if (!want("tip")) return;
      const t = await tipFind();
      if (C.home) { if (t) fail("Home Screen tip", "shows on the " + where + " of a game opened from the Home Screen: " + t.text.slice(0, 60)); return; }
      if (C.upright || tipSeen || !t) return;
      tipSeen = where;
      if (!/add highland stand to your home screen/i.test(t.text)) fail("Home Screen tip", "its words do not say \"Add Highland Stand to your Home Screen\": " + t.text.slice(0, 80));
      if (!/share/i.test(t.text)) fail("Home Screen tip", "its words do not name the Share button: " + t.text.slice(0, 80));
      await check("Home Screen tip", { root: t.box, noCover: true, scroll: "inside" });
      // one time: the visit that shows it spends it (an hs_ key is stored as it shows), so a reload without closing
      // it does not bring it back
      const hsKeys = () => g.ev(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^hs_/.test(k)) o[k] = localStorage.getItem(k); } return JSON.stringify(o); });
      const keys0 = JSON.parse(await hsKeys());
      await tap("Home Screen tip", t.btn, "cannot close the tip");
      if (!(await hidden(t.box))) fail("Home Screen tip", "its close button did not put it away");
      const keys1 = JSON.parse(await hsKeys());
      if (!Object.keys(keys1).some(k => /tip/i.test(k))) fail("Home Screen tip", "no hs_ key remembers it");
      if (!Object.keys(keys1).some(k => keys1[k] !== keys0[k])) fail("Home Screen tip", "closing it changed no hs_ key");
    };
    // a fresh visit that shows the tip and leaves it open, then a reload: the tip is not shown again
    const tipOnceStep = async () => {
      if (!want("tip") || C.home || C.upright) return;
      const g2 = await R.openGame(browser, o.file, page);
      try {
        await g2.ev(AU.install);
        await g2.frames(3);
        const seen = await g2.ev(() => { const e = document.getElementById("homeTip"); return !!e && __hsAudit.visible(e); });
        if (!seen) { if (await g2.ev(() => menuMode) === "chapter") { await g2.ev(() => document.getElementById("startBtn").click()); await g2.frames(3); } }
        const seen2 = await g2.ev(() => { const e = document.getElementById("homeTip"); return !!e && __hsAudit.visible(e); });
        if (!seen2) { fail("Home Screen tip", "a fresh visit in Safari shows no tip"); return; }
        await g2.page.reload();
        await g2.page.waitForFunction(() => typeof menuMode !== "undefined" && document.readyState === "complete", null, { timeout: 60000 });
        await g2.frames(3);
        if (await g2.ev(() => menuMode) === "chapter") { await g2.ev(() => document.getElementById("startBtn").click()); await g2.frames(3); }
        if (await g2.ev(() => { const e = document.getElementById("homeTip"); return !!e && getComputedStyle(e).display !== "none"; })) fail("Home Screen tip", "shows again on the next visit though it was left open (it is a one-time tip)");
      } finally { await g2.close(); }
    };

    try {
      await open();
      // ---- the first screen: Chapter I's story, page by page ----
      await step("pages", "story", async () => {
        if (await g.ev(() => menuMode) !== "chapter") fail("story", "the first screen is " + await g.ev(() => menuMode) + ", not the chapter's story");
        const n = await g.ev(() => leafPages.length);
        for (let k = 0; k < n; k++) {
          if (k) await tap("story page " + (k + 1), "#pgNext", null, true);
          await check("story page " + (k + 1), pageSpec(LEAF_PARTS, ["#startBtn"]));
        }
      });
      await tipStep("first screen");
      if (await g.ev(() => menuMode) === "chapter") await tap("story", "#startBtn", "cannot tap To the Map", true);
      await g.ev(() => { try { localStorage.setItem("hs_tutorial_done", "1"); } catch (e) {} });
      // ---- the campaign map ----
      await step("map", "map", async () => {
        if (await g.ev(() => menuMode) !== "map") throw new Error("no map after the story");
        await check("map", pageSpec(MAP_PARTS, ["#startBtn"]));
        // its battlefields: a finger picks one within 34 map units of its node (the game's mapNodeRadius where it has one)
        const nodes = await g.ev(() => {
          const cv = $("worldMap"), r = cv.getBoundingClientRect(), rad = typeof mapNodeRadius === "function" ? mapNodeRadius() : 34;
          return CHAPTERS[mapChapter()].levels.map(i => {
            const x = r.left + MAP_NODES[i].x * r.width / MAP_W, y = r.top + MAP_NODES[i].y * r.height / MAP_H, e = document.elementFromPoint(x, y);
            return { id: LEVELS[i].id, x, y, d: 2 * rad * r.width / MAP_W, hit: e === cv ? "" : __hsAudit.hitName(x, y) };
          });
        });
        for (const n of nodes) if (n.hit) fail("map", "the node of " + n.id + " lies under " + n.hit);
        if (nodes.length && nodes[0].d < 44) fail("map", "a battlefield's node answers a finger " + Math.round(nodes[0].d) + " px across (needs 44, the way forward)");
        await canvasText("map", ["worldMap"], () => renderWorldMap());
      });
      await tipStep("map");
      await tipOnceStep();
      if (want("tip") && !C.home && !C.upright && !tipSeen) fail("Home Screen tip", "Safari shows no tip to add the game to the Home Screen (looked on the first screen and the map)");
      // ---- Settings from the map ----
      await step("settings", "Settings (map)", async () => {
        await tap("Settings (map)", "#ovGear");
        await check("Settings (map)", { root: "#settings", scroll: "inside" });
        await tap("Settings (map)", "#ovGear", "cannot close Settings");
        if (await shown("#settings")) fail("Settings (map)", "the gear did not put Settings away");
      });
      // ---- the War Council: its one-time card, its panel in the Hall, three tiers taken by a finger, reset, again ----
      await step("council", "council", async () => {
        await g.ev(() => {
          const rec = {};
          for (let i = 0; i < 3; i++) {
            localStorage.setItem(bestKey(i, LEVELS[i].era), "21");
            rec[levelId(i)] = { stars: [0, 3, i === 1 ? 2 : 0], lives: [0, 18, i === 1 ? 9 : 0], endless: [0, 0, 0] };
          }
          localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
          localStorage.removeItem("hs_council");
          localStorage.removeItem("hs_towers_seen");   // the card is this state's to show (openGame counts it as seen)
          testUnlockAll = false;
          openCampaignMap(2);
        });
        const card = await g.page.waitForFunction(() => unlockCardOn === "council", null, { timeout: 5000 }).then(() => true, () => false);
        if (!card) { fail("council card", "\"The War Council opens\" did not come up over the map"); await tap("council", "#ovStars", "cannot tap the tally"); }
        else {
          await settle(2);
          await check("council card", { root: "#trickCard .kit", primary: ["#tcBtn"], scroll: "inside", primaryRequired: true });
          await tap("council card", "#tcBtn", "cannot tap To the Council");
          if (await g.ev(() => !!unlockCardOn || towersSeen().indexOf("council") < 0)) fail("council card", "its button did not put it away and remember it");
        }
        await g.page.waitForFunction(() => hallOpen && !hallEl.classList.contains("hlSettling"), null, { timeout: 5000 }).catch(() => {});
        if (!(await g.ev(() => hallOpen && hallTab === "council"))) throw new Error("the Hall did not open on the Council");
        await settle(2);
        await check("council", { root: "#hall", parts: ["#hallBody", "#hallClose", "#hallTabs"], primary: ["#wcTake"], scroll: C.upright ? "page" : "inside", primaryRequired: true });
        const fit = await g.ev(() => {
          const B = $("hallBody"), b = B.getBoundingClientRect(), out = [];
          for (const e of B.querySelectorAll(".wc *")) {
            const r = e.getBoundingClientRect();
            if (!r.width && !r.height) continue;
            if (r.left < b.left - 0.5 || r.right > b.right + 0.5 || (!isPhone() || phoneWide()) && (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5)) out.push((e.id || e.className || e.tagName) + " " + [r.left, r.top, r.right, r.bottom].map(Math.round));
          }
          return { out: out.slice(0, 4), scrolls: phoneWide() && B.scrollHeight > B.clientHeight + 1, box: [Math.round(b.width), Math.round(b.height)] };
        });
        if (fit.out.length) fail("council", "outside the Hall's box " + fit.box.join("x") + ": " + fit.out.join("; "));
        if (fit.scrolls) fail("council", "the panel scrolls in a phone held sideways");
        // playtest 4: three tiers taken by a finger, the Council reset (two taps), a tier taken again
        for (const [b, t] of [["bows", 1], ["engines", 1], ["bows", 2]]) {
          await tap("council", '.wcMed[data-b="' + b + '"][data-t="' + t + '"]', "cannot tap " + b + " " + t, true);
          await tap("council", "#wcTake", "cannot tap Take it", true);
        }
        let own = await g.ev(() => councilOwn());
        if (own.bows !== 2 || own.engines !== 1) fail("council", "three tiers by a finger left " + JSON.stringify(own));
        await tap("council", "#wcReset", "cannot tap Reset", true);
        if (await g.ev(() => councilSpent(councilOwn())) === 0) fail("council", "a finger's first tap on Reset reset the Council");
        await check("council reset armed", { root: "#hall", parts: ["#hallBody", "#hallClose", "#hallTabs"], primary: ["#wcReset"], scroll: C.upright ? "page" : "inside", primaryRequired: true });
        await tap("council", "#wcReset", "cannot tap Reset again", true);
        if (await g.ev(() => councilSpent(councilOwn())) !== 0) fail("council", "the second tap on Reset did not reset");
        await tap("council", '.wcMed[data-b="stewards"][data-t="1"]', "cannot tap the Stewards' first tier", true);
        await tap("council", "#wcTake", "cannot tap Take it", true);
        own = await g.ev(() => councilOwn());
        if (own.stewards !== 1 || own.bows) fail("council", "after the reset, a tier taken again left " + JSON.stringify(own));
        await tap("council", "#hallClose", "cannot close the Hall");
        await settle(3);
        const back = await g.ev(() => ({ open: hallOpen, mode: menuMode, inert: overlayEl.hasAttribute("inert") }));
        if (back.open || back.mode !== "map" || back.inert) fail("council", "the Hall's close did not give the map back " + JSON.stringify(back));
      });
      // ---- chronicles: every page, a foe's card from its medallion, a trick's card from its row ----
      await step("chronicle", "chronicle", async () => {
        for (const id of ["tushpa", "stepanakert23"]) {
          const label = "chronicle " + id;
          await g.ev(id => { const lv = levelIndexOf(id); testUnlockAll = true; openCampaignMap(lv); selectMapLevel(lv); showBrief(); }, id);
          await settle(3);
          const n = await g.ev(() => leafPages.length);
          for (let k = 0; k < n; k++) {
            if (k) await tap(label + " page " + (k + 1), "#pgNext", null, true);
            await check(label + " page " + (k + 1), pageSpec(LEAF_PARTS, ["#startBtn"]));
          }
          // held sideways the host's column shows its first row of medallions whole, and shows that it scrolls
          if (!C.upright) {
            await g.ev(() => { const L = document.querySelector("#ovPage .briefLeft"); if (L) L.scrollTop = 0; });
            await settle(2);
            const m = await g.ev(() => {
              const L = document.querySelector("#ovPage .briefLeft"), B = L.getBoundingClientRect();
              const ds = [...document.querySelectorAll("#briefHost .disc")].map(d => d.getBoundingClientRect()).filter(r => r.width);
              return { first: ds.length ? ds[0].bottom <= B.bottom + 1 : true, more: L.scrollHeight > L.clientHeight + 4, fade: L.classList.contains("more") };
            });
            if (!m.first) fail(label, "the host's first row of medallions is cut by its column's fold");
            if (m.more && !m.fade) fail(label, "the host's column runs past its fold with nothing to show that it scrolls");
          }
          if (id !== "tushpa") continue;
          // the row of the battle (#briefKit): the Standard switch for a player who owns a tier, 44 px, turned on by a tap
          if (await g.ev(() => councilSpent(councilOwn()) > 0)) {
            const k = await g.ev(() => ({ towers: !!document.querySelector("#briefKit .bkTowers"), sw: !!$("bkStd") }));
            if (!k.sw) fail(label, "no Standard switch for a player who owns a tier");
            else {
              if (!C.upright && k.towers) fail(label, "held sideways #briefKit shows the tray's towers, for which the column has no room");
              const q = await g.ev(() => { const e = $("bkStd"); e.scrollIntoView({ block: "nearest" }); return e.getBoundingClientRect().height; });
              if (q < 43.5) fail(label, "the Standard switch is " + Math.round(q) + " px tall");
              await tap(label, "#bkStd", "cannot tap the Standard switch", true);
              if (await g.ev(() => !standardBattle)) fail(label, "a tap did not turn the Standard switch on");
              // (the page as it opens: scrolled back to its top, as the other pages of this chronicle are held)
              await g.ev(() => { overlayEl.scrollTop = 0; const L = document.querySelector("#ovPage .briefLeft"); if (L) L.scrollTop = 0; });
              await settle(2);
              await check(label + " switch", pageSpec(LEAF_PARTS, ["#startBtn"]));
              await g.ev(() => { standardBattle = false; briefKitRow(); });
            }
          }
          if (await shown("#briefHost .foe[data-role]")) {
            await tap(label, "#briefHost .foe[data-role]", "cannot tap a foe's medallion", true);
            await settle(2);
            await check("foe card (chronicle)", { root: "#foeCard", scroll: "inside" });
            await tap("foe card (chronicle)", "#foeCard .fcX", "cannot close the foe card");
            if (await shown("#foeCard")) fail("foe card (chronicle)", "its close button did not put it away");
          }
          if (await shown("#briefTricks .tbg")) {
            await tap(label, "#briefTricks .tbg", "cannot tap a trick of the chronicle", true);
            await check("trick card (chronicle)", { root: "#trickCard .kit", primary: ["#tcBtn"], scroll: "inside", primaryRequired: true });
            await tap("trick card (chronicle)", "#tcBtn", "cannot close the trick card");
            if (await g.ev(() => !!trickCardOn)) fail("trick card (chronicle)", "Close did not put it away");
          } else fail(label, "shows no row of the enemy's tricks on Normal");
        }
      });

      // ---- a battle begun from its chronicle ----
      const begin = async (lv, opts) => {
        await g.ev(([lv, tut]) => {
          try {
            localStorage.setItem("hs_tutorial_done", tut ? "0" : "1");
            localStorage.setItem("hs_chapters_seen", JSON.stringify(CHAPTERS.map(C => C.id)));
            localStorage.setItem("hs_unlocked_seen", JSON.stringify(LEVELS.map(L => L.id)));
          } catch (e) {}
          if (Nardi.isOpen()) Nardi.close();
          hideEndingCard(); celebration = null; parley = null; fallen = null; gameOver = true; paused = false; endless = false;
          clearRun(); testUnlockAll = true; curDiff = prefDiff = 1;
          openCampaignMap(lv); selectMapLevel(lv); showBrief();
        }, [lv, !!(opts && opts.tutorial)]);
        await settle(3);
        for (let k = 0; k < 20 && (await g.reach("#startBtn")).why; k++) await g.wait(100);
        await tap("battle", "#startBtn", "cannot tap Begin the Stand", true);
        await g.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
        await settle(3);
      };
      const rotateStep = async () => {
        const up = await shown("#rotateHint");
        if (!C.upright) { if (up) fail("rotate card", "shows on a phone held sideways"); return; }
        if (!up) { fail("rotate card", "does not show on a phone held upright in battle"); return; }
        await check("rotate card", { root: "#rotateHint .kit", primary: ["#rotateHint button"], scroll: "inside", primaryRequired: true });
        const txt = await g.ev(() => $("rotateHint").textContent);
        if (!/\bphone\b/i.test(txt) || /tablet/i.test(txt)) fail("rotate card", "it speaks of a tablet, not a phone: \"" + txt.replace(/\s+/g, " ").trim().slice(0, 70) + "\"");
        await tap("rotate card", "#rotateHint button", "cannot tap Play in portrait");
        if (await shown("#rotateHint")) fail("rotate card", "Play in portrait did not put it away");
      };
      const freeze = () => g.ev(() => { speedMult = 0; });
      // a panel a finger opened takes presses once that finger is up (the game's settlePanel): wait for it
      const panelSettled = () => g.page.waitForFunction(() => !panelEl.classList.contains("settling"), null, { timeout: 3000 }).catch(() => fail("tower panel", "the panel a finger opened never took presses"));
      const stage = async (id, wave, extra) => {
        await g.ev(([id, wave, extra]) => {
          photoStageBattle(levelIndexOf(id), wave, extra || {});
          speedMult = 0;   // the battle holds still while it is measured (the speed button keeps its label)
          hudCache.chips = null; syncHud();
        }, [id, wave, extra || null]);
        await settle(3);
      };

      await step("battle", "battle", async () => {
        await begin(1);
        await rotateStep();
        const F = await battleCheck("battle");
        fieldLines.push("FIELD " + tag + ": " + F.w + "x" + F.h + " at " + F.x + "," + F.y + ", scale " + F.scale.toFixed(3) + ", " +
          Math.round(F.share * 100) + "% of the safe area, " + Math.round(F.clear * 100) + "% free of the HUD");
        await canvasText("battle", ["game"]);
        // a tower's tile: a touch shows its line for a few seconds
        await tap("tower tile", '#shop .card[data-type="archer"]', "cannot tap the first tower's tile");
        if (await shown("#shop .card.selected .ds")) await check("tower tile's line", { root: "#shop .card.selected .ds", controls: "none", scroll: "inside" });
        await tap("tower tile", '#shop .card[data-type="archer"]', "cannot tap the tile again");
        // Settings in battle
        await tap("Settings (battle)", "#gearBtn");
        await check("Settings (battle)", { root: "#settings", scroll: "inside" });
        await tap("Settings (battle)", "#gearBtn", "cannot close Settings");
        if (await shown("#settings")) fail("Settings (battle)", "the gear did not put Settings away");
        // Settings over the field: its Resume (or Pause) puts it away, and so does its own close button
        await tap("Settings (battle)", "#gearBtn");
        await tap("Settings (battle)", "#pauseBtn", "cannot tap Settings' Resume or Pause");
        if (await shown("#settings")) fail("Settings (battle)", "its Resume (or Pause) left it open over the field");
        await g.ev(() => { if (paused) togglePause(); toastEl.classList.remove("show"); });
        await tap("Settings (battle)", "#gearBtn");
        await tap("Settings (battle)", "#setClose", "cannot tap Settings' close button");
        if (await shown("#settings")) fail("Settings (battle)", "its close button did not put it away");
        await g.ev(() => { if (settingsEl.style.display === "block") closeSettings(); if (paused) togglePause(); toastEl.classList.remove("show"); });
        // a long toast
        await g.ev(t => toast(t, 6000), LONG_TOAST);
        await g.wait(450);   // its fade in
        await check("toast", { root: "#toast", controls: "none", noCover: true, scroll: "inside" });
        await g.ev(() => toastEl.classList.remove("show"));
        // the pause banner, and the wave banner as the first wave is sent
        const banner = async (label) => {
          await canvasText(label, ["banner"], () => { ribbonCache.clear(); __hsText.ribbon = true; draw(performance.now()); });
          const b = await g.ev(() => {
            const r = canvas.getBoundingClientRect(), y = paused ? pausedBannerY() : null;
            return { up: paused || waveBannerT > 0, y };
          });
          if (!b.up) fail(label, "no banner on the field");
        };
        await tap("pause banner", "#hudPause", "cannot tap pause");
        if (await g.ev(() => paused)) await banner("pause banner");
        else fail("pause banner", "the pause button did not pause");
        await tap("pause banner", "#hudPause", "cannot tap play to resume");
        if (await g.ev(() => paused)) fail("pause banner", "the play button did not resume");
        await tap("wave banner", "#waveBtn", "cannot tap Send Wave");
        if (await g.ev(() => waveIdx) !== 1) fail("wave banner", "Send Wave sent no wave");
        else {
          await banner("wave banner");
          // the wave's toast does not lie over its ribbon
          const tb = await g.ev(() => {
            if (!toastEl.classList.contains("show") || waveBannerT <= 0) return null;
            const t = toastEl.getBoundingClientRect(), half = Math.max(42, ...[...ribbonCache.values()].map(sp => sp.hsHalf || 0));
            return { t: t.top, b: t.bottom, bt: offY + (190 - half) * scale, bb: offY + (190 + half) * scale };
          });
          if (tb && tb.t < tb.bb - 1 && tb.b > tb.bt + 1) fail("wave banner", "the toast (" + Math.round(tb.t) + "-" + Math.round(tb.b) + ") lies over the wave's ribbon (" + Math.round(tb.bt) + "-" + Math.round(tb.bb) + ")");
        }
        await freeze();
      });

      // ---- a busy field: towers of every rank, foes on the roads; the panel of towers across the field ----
      await step("panel", "tower panel", async () => {
        if (!(await g.ev(() => !gameOver && overlayEl.classList.contains("hidden")))) { await begin(3); await rotateStep(); }
        await stage("dvin", 8, { trick: "hunt" });
        await battleCheck("battle (busy)");
        // the towers a finger reaches first on each side of the field, one waiting for its Mastery, one damaged
        const picks = await g.ev(() => {
          const live = towers.filter(t => !t.wreck);
          const pt = t => __hsAudit.towerPoint(t);
          const by = (f) => live.slice().sort((a, b) => f(pt(a)) - f(pt(b)))[0];
          const set = [["leftmost", by(p => p.x)], ["rightmost", by(p => -p.x)], ["highest", by(p => p.y)], ["lowest", by(p => -p.y)]];
          const m = live.find(t => !set.some(s => s[1] === t)) || live[0];
          m.level = TOWER_DEFS[m.type].levels.length - 1; m.spec = null;   // its Mastery to choose: the tallest panel
          set.push(["choosing a Mastery", m]);
          const hurt = live.find(t => t.maxHp && t.hp < t.maxHp && !set.some(s => s[1] === t));
          if (hurt) set.push(["damaged", hurt]);
          const wreck = towers.find(t => t.wreck);
          if (wreck) set.push(["wrecked", wreck]);
          syncHud();
          return set.map(([k, t]) => ({ k, pad: t.pad }));
        });
        for (const p of picks) {
          const label = "tower panel (" + p.k + ", pad " + p.pad + ")";
          const at = await g.ev(pad => { const t = towers.find(t => t.pad === pad); return __hsAudit.towerPoint(t); }, p.pad);
          const hit = await g.hitName(at.x, at.y);
          await g.tapAt(at.x, at.y);
          await settle(3);
          await panelSettled();
          const open = await g.ev(pad => !!selected && selected.pad === pad && panelEl.style.display === "block", p.pad);
          if (!open) {
            fail(label, "a tap on the tower at " + Math.round(at.x) + "," + Math.round(at.y) + " (on " + hit + ") did not open its panel");
            // whatever the stray tap chose (the hero, a spell, a tower's tile) is let go, and the panel opened by script
            await g.ev(pad => { heroSelected = false; castingSpell = null; setPlacing(null); updateSpellBar(); showPanel(towers.find(t => t.pad === pad)); }, p.pad);
            await settle(2);
          }
          await check(label, { root: "#panel", primary: ["#pActions .up", "#pActions .spec", "#pActions .sell", "#pActions .repair", "#pActions .clear"], scroll: "inside", primaryRequired: true });
          const over = await g.ev(pad => { const t = towers.find(t => t.pad === pad), q = __hsAudit.towerPoint(t), e = document.elementFromPoint(q.x, q.y); return e && panelEl.contains(e); }, p.pad);
          if (over) fail(label, "the panel lies over its own tower");
          const empty = await g.ev(() => __hsAudit.emptyPoint());
          if (!empty) { fail(label, "no open ground to tap to put the panel away"); await g.ev(() => hidePanel()); continue; }
          await g.tapAt(empty.x, empty.y);
          await settle(2);
          if (await g.ev(() => panelEl.style.display === "block")) { fail(label, "a tap on open ground at " + Math.round(empty.x) + "," + Math.round(empty.y) + " did not put the panel away"); await g.ev(() => hidePanel()); }
        }
      });
      // ---- every tower by a finger. At top rank (choosing its Mastery, every third one damaged): the tap that opens
      // its panel presses nothing in it (no gold spent, nothing sold), the panel's buttons lie inside the panel and the
      // safe area, and still do after one tap on Sell ("Tap again to sell"). Beside a tower (16 px each way) a tap
      // opens that tower or claims nothing (a plot nearer the finger is only lit: a second tap buys it) and never
      // spends gold. A tower built from a chosen tile opens at a tap while the tile is still chosen ----
      await step("towers", "towers by finger", async () => {
        if (!(await g.ev(() => !gameOver && overlayEl.classList.contains("hidden")))) { await begin(3); await rotateStep(); }
        const sig = () => g.ev(() => JSON.stringify({ gold: Math.round(gold), plots: plots.length, t: towers.map(t => t.pad + ":" + t.level + ":" + (t.spec || "") + ":" + (t.wreck ? "w" : "")) }));
        const clear = () => g.ev(() => { hidePanel(); touchArmedPlot = null; heroSelected = false; castingSpell = null; setPlacing(null); updateSpellBar(); });
        const bad = [];
        for (const [id, offs] of [["gyumri", false], ["stepanakert92", false], ["dvin", true]]) {
          await stage(id, 8, {});
          await g.ev(() => {
            gold = 5000; const kinds = ["archer", "ballista", "catapult", "fire", "drums"];
            PADS.forEach((_, i) => { if (!towerAt(i)) placeTower(kinds[i % 5], i); });
            towers.forEach((t, k) => { t.wreck = false; t.level = TOWER_DEFS[t.type].levels.length - 1; t.spec = null; if (t.maxHp) t.hp = k % 3 === 0 ? t.maxHp * 0.4 : t.maxHp; });
            if (hero) { hero.x = -500; hero.y = -500; }
            syncHud();
          });
          await settle(2);
          const pads = await g.ev(() => towers.map(t => t.pad));
          for (const pad of pads) {
            const L = "towers " + id + " pad " + pad;
            await clear();
            const at = await g.ev(pad => __hsAudit.towerPoint(towers.find(t => t.pad === pad)), pad);
            if (await g.hitName(at.x, at.y) !== "canvas#game") continue;   // under the HUD: battleCheck tells it
            const s0 = await sig();
            await g.tapAt(at.x, at.y); await settle(2); await panelSettled();
            const opened = await g.ev(pad => !!selected && selected.pad === pad && panelEl.style.display === "block", pad);
            if (!opened) { bad.push(L + ": a tap on the tower did not open its panel"); continue; }
            if (await sig() !== s0) { bad.push(L + ": the tap that opened the panel also spent gold or changed the towers"); continue; }
            const inside = () => g.ev(() => {
              const P = panelEl.getBoundingClientRect(), S = __hsAudit.safe(), out = [];
              for (const b of panelEl.querySelectorAll("#pActions .btn")) {
                const r = b.getBoundingClientRect();
                if (!r.width) continue;
                const nm = (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 22);
                if (r.top < P.top - 0.5 || r.bottom > P.bottom + 0.5) out.push('"' + nm + '" runs past the panel (' + Math.round(r.top) + "-" + Math.round(r.bottom) + " of " + Math.round(P.top) + "-" + Math.round(P.bottom) + ")");
                const acts = $("pActions"), A = acts.getBoundingClientRect();
                if ((r.bottom > A.bottom + 0.5 || r.top < A.top - 0.5) && acts.scrollHeight <= acts.clientHeight + 1) out.push('"' + nm + '" is cut off');
              }
              if (P.top < S.t - 0.5 || P.bottom > S.b + 0.5 || P.left < S.l - 0.5 || P.right > S.r + 0.5) out.push("the panel runs out of the safe area");
              return out;
            });
            for (const m of await inside()) bad.push(L + ": " + m);
            const q = await g.reach("#pActions .sell");
            if (!q.why) {
              await g.tapAt(q.x, q.y); await settle(2);
              if (await sig() !== s0) bad.push(L + ": one tap on Sell sold the tower");
              else for (const m of await inside()) bad.push(L + " (Tap again to sell): " + m);
            }
            if (!offs) continue;
            for (const [dx, dy] of [[16, 0], [-16, 0], [0, 16], [0, -16]]) {
              await clear();
              const x = at.x + dx, y = at.y + dy;
              if (await g.hitName(x, y) !== "canvas#game") continue;
              const s1 = await sig();
              await g.tapAt(x, y); await settle(2);
              const r = await g.ev(([x, y, pad]) => {
                const sel = selected ? selected.pad : -1, d = t => { const q = __hsAudit.towerPoint(t); return Math.hypot(q.x - x, q.y - y); };
                // (towers closer together than the offset, as held upright: one as near the finger is as right)
                return { sel, nearer: !!selected && d(selected) <= d(towers.find(t => t.pad === pad)) + 4, armed: !!touchArmedPlot, hero: heroSelected };
              }, [x, y, pad]);
              if (await sig() !== s1) bad.push(L + ": a tap " + dx + "," + dy + " px off it spent gold or changed the towers");
              else if (r.sel >= 0 && r.sel !== pad && !r.nearer) bad.push(L + ": a tap " + dx + "," + dy + " px off it opened the tower on pad " + r.sel + ", which is farther from the finger");
              else if (r.sel < 0 && !r.armed && !r.hero) bad.push(L + ": a tap " + dx + "," + dy + " px off it did nothing");
            }
          }
        }
        // a tower built from a chosen tile, tapped while the tile is still chosen: its panel, no gold spent
        await stage("erebuni", 3, {});
        await g.ev(() => { gold = 5000; for (const t of towers.slice()) towers.splice(towers.indexOf(t), 1); if (hero) { hero.x = -500; hero.y = -500; } hidePanel(); setPlacing(null); syncHud(); });
        const free = await g.ev(() => PADS.map((_, i) => i).filter(i => !towerAt(i)).slice(0, 6));
        for (const i of free) {
          const L = "tower from the tray, pad " + i;
          await clear();
          await tap(L, '#shop .card[data-type="archer"]', "cannot tap the archers' tile");
          const p = await g.ev(i => { const r = canvas.getBoundingClientRect(), q = proj(PADS[i][0], PADS[i][1]); return { x: r.left + offX + q.x * scale, y: r.top + offY + (q.y + 4 * q.s) * scale }; }, i);
          if (await g.hitName(p.x, p.y) !== "canvas#game") continue;
          await g.tapAt(p.x, p.y); await settle(1); await g.tapAt(p.x, p.y); await settle(2);
          if (!(await g.ev(i => !!towerAt(i), i))) { bad.push(L + ": two taps on the pad built nothing"); continue; }
          const at = await g.ev(i => __hsAudit.towerPoint(towerAt(i)), i);
          const s0 = await sig();
          await g.tapAt(at.x, at.y); await settle(2); await panelSettled();
          const r = await g.ev(i => ({ open: !!selected && selected === towerAt(i) && panelEl.style.display === "block", placing }), i);
          if (await sig() !== s0) bad.push(L + ": a tap on the new tower (its tile still chosen) spent gold or changed the towers");
          else if (!r.open) bad.push(L + ": a tap on the new tower (its tile still chosen) did not open its panel");
        }
        await clear();
        for (const b of bad.slice(0, 12)) fail("towers by finger", b);
        if (bad.length > 12) fail("towers by finger", (bad.length - 12) + " more like these");
      });
      // ---- the foe card from the next-wave row ----
      await step("foe", "foe card (wave row)", async () => {
        if (!(await g.ev(() => !gameOver && overlayEl.classList.contains("hidden")))) { await begin(3); await rotateStep(); }
        await stage("tushpa", 5, {});
        await g.ev(() => { phase = "idle"; hudCache.chips = null; syncHud(); });
        await settle(2);
        const chip = await g.ev(() => {
          const box = waveInfoEl.getBoundingClientRect();
          const c = [...waveInfoEl.querySelectorAll(".chip[data-role]")].find(c => { const r = c.getBoundingClientRect(); return r.width && r.bottom <= box.bottom + 1; });
          if (!c) return null;
          c.id = c.id || "__hsChip";
          return "#" + c.id;
        });
        if (!chip) { fail("foe card (wave row)", "the next-wave row shows no chip to tap"); return; }
        await tap("foe card (wave row)", chip, "cannot tap a chip of the next-wave row");
        await settle(2);
        await check("foe card (wave row)", { root: "#foeCard", scroll: "inside" });
        await tap("foe card (wave row)", "#foeCard .fcX", "cannot close the foe card");
        if (await shown("#foeCard")) fail("foe card (wave row)", "its close button did not put it away");
      });
      // ---- every trick's first-time card, and a card of two ----
      await step("tricks", "trick card", async () => {
        if (!(await g.ev(() => !gameOver && overlayEl.classList.contains("hidden")))) { await begin(3); await rotateStep(); }
        await stage("tushpa", 6, {});
        for (const keys of [["hidden"], ["guards"], ["ambush"], ["hunters"], ["adapt"], ["hidden", "guards"]]) {
          const label = "trick card (" + keys.join(" + ") + ")";
          await g.ev(keys => { showTrickCard(keys.length > 1 ? keys : keys[0]); }, keys);
          await settle(2);
          await check(label, { root: "#trickCard .kit", primary: ["#tcBtn"], scroll: "inside", primaryRequired: true });
          await tap(label, "#tcBtn", "cannot tap To the walls");
          if (await g.ev(() => !!trickCardOn)) { fail(label, "To the walls did not put it away"); await g.ev(() => closeTrickCard()); }
        }
      });
      // ---- a battlefield's own line under the wave counter (Mari's relief, Sis's days) ----
      await step("note", "wave counter's note", async () => {
        if (!(await g.ev(() => !gameOver && overlayEl.classList.contains("hidden")))) { await begin(3); await rotateStep(); }
        for (const id of ["mari", "sis"]) {
          await stage(id, 5, {});
          await g.ev(() => syncHudNote(true));
          await check("wave counter's note (" + id + ")", { root: "#hudNote", controls: "none", noCover: true, scroll: "inside" });
        }
      });
      // ---- Erebuni's bubble before its first scouts ----
      await step("bubble", "scout bubble", async () => {
        if (!(await g.ev(() => !gameOver && overlayEl.classList.contains("hidden")))) { await begin(3); await rotateStep(); }
        await stage("erebuni", 3, { trick: "bubble" });
        await settle(3);
        if (!(await g.ev(() => !!scoutBubble))) { fail("scout bubble", "it did not show"); return; }
        await check("scout bubble", { root: "#coach", primary: ["#coach .cNext"], scroll: "inside", primaryRequired: true });
        const cov = await g.ev(() => { const t = document.querySelector('#shop .card[data-type="' + trickWatch()[0] + '"]'), r = t.getBoundingClientRect(); return __hsAudit.hits(t, (r.left + r.right) / 2, (r.top + r.bottom) / 2) ? "" : __hsAudit.hitName((r.left + r.right) / 2, (r.top + r.bottom) / 2); });
        if (cov) fail("scout bubble", "the tile it points at is covered by " + cov);
        await tap("scout bubble", "#coach .cNext", "cannot tap Got it");
        if (await g.ev(() => !!scoutBubble)) { fail("scout bubble", "Got it did not put it away"); await g.ev(() => closeScoutBubble()); }
      });
      // ---- the crash card, from a battle ----
      await step("crash", "crash card", async () => {
        if (!(await g.ev(() => !gameOver && overlayEl.classList.contains("hidden")))) { await begin(3); await rotateStep(); }
        const n0 = g.errs.length;
        await g.ev(() => showCrashCard(new Error("a test error from tools/regress/iphone.js")));
        await settle(2);
        g.errs.splice(n0).filter(e => !/test error from tools\/regress\/iphone/.test(e)).forEach(e => g.errs.push(e));
        await check("crash card", { root: "#crashCard .kit", primary: ["#crashReload", "#crashMap"], scroll: "inside", primaryRequired: true });
        await tap("crash card", "#crashMap", "cannot tap Return to map");
        if (await shown("#crashCard")) fail("crash card", "Return to map did not put it away");
      });
      // ---- victory pages: a plain one, Ani's with its Summons, Sis's with its Terms ----
      const waitSettled = () => g.page.waitForFunction(() => !overlayEl.classList.contains("settling"), null, { timeout: 8000 }).catch(() => {});
      await step("victory", "victory", async () => {
        for (const id of ["avarayr", "ani", "sis"]) {
          const label = "victory " + id;
          await g.ev(id => {
            const lv = levelIndexOf(id);
            localStorage.setItem("hs_unlocked_seen", JSON.stringify(LEVELS.slice(0, lv + 1).map(L => L.id)));
            if (lv > 0) localStorage.setItem(bestKey(lv - 1, LEVELS[lv - 1].era), "21");
            photoStageBattle(lv, 20, {});
            enemies = []; projectiles = []; lives = 17;
            victory();
            endCelebration();
          }, id);
          await settle(3);
          await waitSettled();
          if (await shown("#endingCard")) {
            await check("ending card (" + id + ")", { root: "#endingCard .ecLeaf", primary: ["#ecBtn"], scroll: "inside", primaryRequired: true });
            await tap("ending card (" + id + ")", "#ecBtn", "cannot tap the ending card's button");
            if (await shown("#endingCard")) fail("ending card (" + id + ")", "its button did not put it away");
          } else if (id !== "avarayr") fail(label, "no ending card over the page");
          await check(label, pageSpec(["#ovGear"], ["#nextBtn", "#mapBtn.lead"]));
          // the row of growth: a first victory here earns stars to spend. Held sideways one line in place of the prose's last
          // line; upright a button 44 px tall
          if (id === "ani") {
            const gr = await g.ev(() => { const e = $("ovGrowth"), b = $("ogCouncil"); return { on: e.classList.contains("on"), line: e.classList.contains("line"), text: e.textContent, btn: b ? b.getBoundingClientRect().height : 0 }; });
            if (!gr.on) fail(label, "no row of growth after a victory that earned stars to spend");
            else if (!C.upright && (!gr.line || !/^\d+ stars? to spend at the War Council\.$/.test(gr.text))) fail(label, "held sideways the row of growth is not one line: " + JSON.stringify(gr));
            else if (C.upright && gr.btn < 43.5) fail(label, "the Council's button is " + Math.round(gr.btn) + " px tall");
          }
          // every way on from the page in sight (held sideways, without a scroll) and 44 px tall
          const v = await g.ev(() => {
            const bs = [...document.querySelectorAll("#overlay .bigRow .big")].filter(b => b.offsetParent);
            return { small: bs.filter(b => b.getBoundingClientRect().height < 43.5).map(b => b.id + " " + Math.round(b.getBoundingClientRect().height)),
              out: bs.filter(b => b.getBoundingClientRect().bottom > __hsAudit.safe().b + 0.5).map(b => b.id) };
          });
          if (!C.upright && v.out.length) fail(label, "buttons below the screen's edge until the page is scrolled: " + v.out.join(", "));
          if (v.small.length) fail(label, "buttons under 44 px tall: " + v.small.join(", "));
        }
      });
      // ---- the defeat page with its debrief, and the end of an endless stand ----
      await step("defeat", "defeat", async () => {
        for (const [label, id, wave, inf] of [["defeat with debrief", "dvin", 8, false], ["endless stand ends", "avarayr", 23, true]]) {
          await g.ev(([id, wave, inf]) => {
            photoStageBattle(levelIndexOf(id), wave, {});
            if (inf) { endless = true; lastCleared = wave - 1; }
            for (const e of enemies.slice()) { if (gameOver) break; e.dead = true; leakFoe(e); }
            while (!gameOver) { spawnEnemy("spearman"); const e = enemies[enemies.length - 1]; e.dead = true; leakFoe(e); }
            enemies = enemies.filter(e => !e.dead);
            endFall();
          }, [id, wave, inf]);
          await settle(3);
          await waitSettled();
          await check(label, pageSpec(MAP_PARTS, ["#startBtn"]));
          // held sideways the debrief's tip is in sight as the page opens (it leads the column)
          if (!inf && !C.upright) {
            const v = await g.ev(() => {
              const P = $("ovPage").getBoundingClientRect(), T = document.querySelector("#ovDebrief.on .dbTip");
              if (!T) return null;
              const r = T.getBoundingClientRect();
              return r.top >= P.top - 1 && r.top + 16 <= P.bottom;
            });
            if (v === false) fail(label, "the debrief's tip is out of sight until the column is scrolled");
          }
        }
      });
      // ---- nardi: the board, its rules, leaving, the invitation and the end of a game ----
      await step("nardi", "nardi", async () => {
        await g.ev(() => { celebration = null; fallen = null; gameOver = true; openCampaignMap(); });
        await settle(3);
        await tap("nardi", "#nardiBtn", "cannot tap the map's Nardi door", true);
        await g.wait(500);
        if (!(await g.ev(() => Nardi.isOpen()))) throw new Error("the board did not open");
        await check("nardi board", { root: "#nardi", parts: ["#ndBoard", "#nardi .ndHead", "#nardi .ndFoot"], primary: ["#ndMain"], scroll: "inside" });
        await canvasText("nardi board", ["ndBoard"]);
        const card = async (label, primary) => { await settle(2); await check(label, { root: "#ndCard", primary, scroll: "inside", primaryRequired: true }); };
        await tap("nardi rules", "#ndRules", "cannot tap the rules button");
        await card("nardi rules", ["#ndBack"]);
        await tap("nardi rules", "#ndBack", "cannot tap Back");
        await g.wait(1500);   // the opening throw
        await tap("nardi leave", "#ndClose", "cannot tap the board's close button");
        if (await shown("#ndLeave")) {
          await card("nardi leave", ["#ndStay", "#ndLeave"]);
          await tap("nardi leave", "#ndStay", "cannot tap Keep playing");
          await tap("nardi leave", "#ndClose", "cannot tap the board's close button");
          await tap("nardi leave", "#ndLeave", "cannot tap Leave the board");
        }
        if (await g.ev(() => Nardi.isOpen())) { fail("nardi leave", "the board did not close"); await g.ev(() => Nardi.close()); }
        await g.ev(() => Nardi.offer(1, () => {}));
        await card("nardi invitation", ["#ndPlay"]);
        await tap("nardi invitation", "#ndNo", "cannot tap Not now");
        if (await g.ev(() => Nardi.isOpen())) { fail("nardi invitation", "Not now did not close the board"); await g.ev(() => Nardi.close()); }
        await g.ev(() => Nardi.play());
        await g.ev(() => { const S = Nardi.test.S; S.phase = "over"; S.result = { winner: 0, points: 2, mars: true }; });
        await tap("nardi game over", "#ndRules", "cannot tap the rules button");
        await tap("nardi game over", "#ndBack", "cannot tap Back");
        await card("nardi game over", ["#ndAgain"]);
        await tap("nardi game over", "#ndLeave", "cannot tap Leave the board");
        if (await g.ev(() => Nardi.isOpen())) { fail("nardi game over", "Leave the board did not close it"); await g.ev(() => Nardi.close()); }
      });
      // ---- the tutorial's coach, walked step by step by a finger ----
      await step("coach", "coach", async () => {
        await begin(0, { tutorial: true });
        if (C.upright && await shown("#rotateHint")) await tap("coach", "#rotateHint button", "cannot tap Play in portrait");
        if (!(await g.ev(() => !!tut))) throw new Error("the tutorial did not start");
        const seen = new Set();
        for (let k = 0; k < 40; k++) {
          const st = await g.ev(() => tut ? { id: TUT_STEPS[tut.i].id, i: tut.i } : null);
          if (!st) break;
          await settle(3);
          const label = "coach " + (st.i + 1) + " " + st.id;
          if (!seen.has(st.id)) {
            seen.add(st.id);
            await check(label, { root: "#coach", primary: ["#coach .cNext"], scroll: "inside" });
            // what the bubble points at: in view, and not under the bubble
            const tg = await g.ev(() => {
              const S = TUT_STEPS[tut.i], el = S.el && S.el(), w = S.world && S.world();
              let r = null, nm = "";
              if (el) { if (!__hsAudit.visible(el)) return { why: "its target " + __hsAudit.name(el) + " is not on the screen" }; r = el.getBoundingClientRect(); nm = __hsAudit.name(el); }
              else if (w) { r = coachRing.getBoundingClientRect(); nm = "the ring on the field"; }
              if (!r) return {};
              const c = coachEl.getBoundingClientRect();
              const ov = Math.max(0, Math.min(c.right, r.right) - Math.max(c.left, r.left)) * Math.max(0, Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top));
              return ov > 0.2 * r.width * r.height ? { why: "the bubble lies over what it points at (" + nm + ")" } : {};
            });
            if (tg.why) fail(label, tg.why);
          }
          // on to the next step, as a player goes
          const nx = await g.ev(() => { const b = coachEl.querySelector(".cNext"); return __hsAudit.visible(b); });
          if (nx) {
            // (a bubble just come up takes no press for a moment on a phone: coachSettleUntil)
            await g.page.waitForFunction(() => typeof coachSettleUntil === "undefined" || performance.now() >= coachSettleUntil, null, { timeout: 2000 }).catch(() => {});
            await tap(label, "#coach .cNext", "cannot tap " + "Next");
            if (await g.ev(() => tut ? tut.i : -1) === st.i) { fail(label, "Next did not lead on"); await g.ev(() => tutAdvance()); }
            continue;
          }
          if (st.id === "spells") {
            // the tap that casts the spell on the field must press nothing of the bubble that comes up after it (the
            // next step's Skip tutorial, where the finger is): a finger held down for a few frames, as a real tap is
            const pt = await g.ev(() => {
              const i = tut.i; tutGo(i + 1); coachTick();
              const b = coachEl.querySelector(".cSkip").getBoundingClientRect();
              tutGo(i); coachTick();
              return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
            });
            await tap(label, "#spellbar .spell[data-spell]", "cannot tap a spell");
            if (await g.hitName(pt.x, pt.y) === "canvas#game" && await g.ev(() => !!castingSpell)) {
              await g.touchAt(pt.x, pt.y, 90); await settle(3);
              const r = await g.ev(() => ({ on: !!tut, confirm: !!(coachEl && coachEl.querySelector(".cSkip").classList.contains("confirm")), cast: !castingSpell }));
              if (!r.on) { fail(label, "the tap that cast the spell also pressed the next bubble's Skip tutorial, which ended the lesson"); break; }
              if (r.confirm) fail(label, "the tap that cast the spell also pressed the next bubble's Skip tutorial");
              if (!r.cast) fail(label, "a tap on the field with a spell chosen cast nothing");
              await g.ev(() => coachSkipReset && coachSkipReset());
            } else await g.ev(() => { castingSpell = null; updateSpellBar(); tut.ev.spell = true; });
            await settle(3);
            continue;
          }
          if (st.id === "shop") await tap(label, '#shop .card[data-type="archer"]', "cannot tap the archers' tile");
          else if (st.id === "pad") {
            const p = await g.ev(() => { const P = PADS[tut.pad], r = canvas.getBoundingClientRect(), q = proj(P[0], P[1]); return { x: r.left + offX + q.x * scale, y: r.top + offY + (q.y + 4 * q.s) * scale }; });
            await g.tapAt(p.x, p.y); await settle(2); await g.tapAt(p.x, p.y); await settle(2);
            if (await g.ev(() => !towers.length)) { fail(label, "two taps on the ringed pad built nothing"); await g.ev(() => { placeTower("archer", tut.pad); }); }
          } else if (st.id === "wave") await tap(label, "#waveBtn", "cannot tap Send Wave");
          else if (st.id === "fight") await g.ev(() => { tut.ev.kill = true; });
          else if (st.id === "select") {
            const p = await g.ev(() => __hsAudit.towerPoint(towers[0]));
            await g.tapAt(p.x, p.y); await settle(2);
            if (await g.ev(() => !selected)) { fail(label, "a tap on the tower did not select it"); await g.ev(() => showPanel(towers[0])); }
            await panelSettled();
          } else if (st.id === "upgrade") await tap(label, "#pActions .up", "cannot tap Upgrade");
          else await g.ev(id => { tut.ev[{ spells: "spell", hero: "hero", speed: "speed", auto: "auto" }[id] || "kill"] = true; }, st.id);
          await settle(3);
          const now = await g.ev(() => tut ? tut.i : -1);
          if (now === st.i) { await g.ev(() => tutAdvance()); }
        }
        await g.ev(() => { if (tut) endTutorial(true); });
      });
      // ---- the tip once closed stays closed ----
      if (want("tip") && tipSeen) {
        await g.page.reload();
        await g.page.waitForFunction(() => typeof menuMode !== "undefined" && document.readyState === "complete", null, { timeout: 60000 });
        await g.ev(AU.install);
        await settle(3);
        if (await tipFind()) fail("Home Screen tip", "shows again after the page is reloaded");
        if (await g.ev(() => menuMode) === "chapter") await tap("Home Screen tip", "#startBtn");
        if (await tipFind()) fail("Home Screen tip", "shows again on the map after a reload");
      }
    } catch (e) {
      fail("walk", "stopped: " + e.message.split("\n")[0]);
      if (g) await g.shot(o.shots, shotName("walk stopped"));
    }
    if (g) {
      const p = await g.problems();
      for (const m of p) fail("page", m);
      await g.close();
    }
    flush();
    log("done, " + counts[C.key] + " failures");
  };

  await R.pool(RUN, o.jobs || (o.quick ? 2 : 4), runSize);
  await browser.close();
  for (const l of fieldLines) console.log(l);
  for (const C of RUN) console.log("SIZE " + C.name + ": " + (counts[C.key] || 0) + " failures");
  R.finish("iphone", fails, { states, sizes: RUN.map(s => s.key), counts }, t0);
})().catch(e => { console.error(e); process.exit(1); });
