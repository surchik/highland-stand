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
// Home Screen SE 667x375, iPhone 15 852x393 and Pro Max 932x430 with insets left 59, right 59, bottom 21 (laid on
// the page as --sa*, lib.js openGame); upright 393x659 and 375x553. --quick: iPhone 15 in Safari and from the Home
// Screen. Prints one line per failure (FAIL <size> <state>: ...), a FIELD line per size, a RESULT line, exits 1 on any.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/iphone.js [index.html] [--quick] [--sizes=i15s,i15h]
//         [--only=pages,map,...] [--dpr=3] [--shots=dir] [--photos=dir] [--jobs=n] [--verbose]
//   --shots   a photo of every state that failed; --photos a photo of every state; --dpr their density (default 1)
//   --only    some of the states: tip, pages, map, settings, chronicle, battle, panel, foe, tricks, note, bubble, crash,
//             victory, defeat, nardi, coach (rotate is part of battle)
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
      const keys0 = await g.ev(() => Object.keys(localStorage));
      await tap("Home Screen tip", t.btn, "cannot close the tip");
      if (!(await hidden(t.box))) fail("Home Screen tip", "its close button did not put it away");
      const keys1 = await g.ev(() => { const k = []; for (let i = 0; i < localStorage.length; i++) k.push(localStorage.key(i)); return k; });
      if (!keys1.some(k => /^hs_/.test(k) && !keys0.includes(k))) fail("Home Screen tip", "closing it stored no new hs_ key");
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
      if (want("tip") && !C.home && !C.upright && !tipSeen) fail("Home Screen tip", "Safari shows no tip to add the game to the Home Screen (looked on the first screen and the map)");
      // ---- Settings from the map ----
      await step("settings", "Settings (map)", async () => {
        await tap("Settings (map)", "#ovGear");
        await check("Settings (map)", { root: "#settings", scroll: "inside" });
        await tap("Settings (map)", "#ovGear", "cannot close Settings");
        if (await shown("#settings")) fail("Settings (map)", "the gear did not put Settings away");
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
          if (id !== "tushpa") continue;
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
        else await banner("wave banner");
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
          if (nx) { await tap(label, "#coach .cNext", "cannot tap " + "Next"); continue; }
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
