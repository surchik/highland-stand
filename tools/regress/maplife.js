// The living map (the page's MapLife block; docs/specs/owner/living-map.md): the layer over the campaign map, the
// march after a victory, the wide window's larger map. A browser driven by a test has no living map at all unless the
// test sets window.__hsMapTest, which this script does (and, once, does not).
// At 1600x900 (mouse), 1194x834 (touch) and 667x320 (touch, a phone held sideways) it holds the page to:
// - without the switch (a plain test-driven load): no layer, no march kept for the map;
// - the layer #mapLife is there over the map and lies on the map's sheet (the canvas inside its border) within 1 px
//   on every side, takes no pointer (a point on a fort hits #worldMap), and is drawn at the screen's own pixels;
// - it animates: its frames count on and two frames taken apart differ;
// - it stops under Settings and comes back after, stops while the page is hidden, and is put away (not shown, its
//   loop ended) on a chronicle and back on the map;
// - hit-testing: every battlefield of the chart answers at its fort (mapNodeAt), and a real tap on each open fort
//   chooses that battlefield;
// - the march: a staged victory (the save as a victory leaves it, the page's own checkNewUnlocks and
//   openCampaignMap) plays it once, from the fort won to the one opened: the new fort and its road stay closed on
//   the chart until the seal breaks, then stand open; it ends by itself in about 2.5 s; a second return to the map
//   plays nothing; the next victory's march ends at a tap on the map at once, its fort open; a victory that opens the
//   next chapter's chart plays the "road leads on" cue on this one;
// - a defeat's ember is asked for the fort that fell and is gone within 2 s;
// - with the system's "reduce motion": the loop is off, no frame is drawn while nothing changes, and a victory's
//   return is an instant change (no fort held closed) with a highlight that is gone within a second;
// - at 1600x900 the map is the wide window's (over 1000 px wide), nothing of the page lies over it, and the chapters,
//   the difficulty seals, the march button, Nardi and Settings are all in reach and apart from one another;
// - no page error, console error or crash card anywhere.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/maplife.js [index.html] [--quick] [--shots=dir] [--verbose]
"use strict";
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const SEEN = { hs_ios_tip: "1", hs_tutorial_done: "1", hs_home_tip: "closed" };
const lifeOn = [() => { window.__hsMapTest = true; }];
const SIZES = [
  { name: "mouse 1600x900", w: 1600, h: 900 },
  { name: "touch 1194x834", w: 1194, h: 834, touch: true },
  { name: "touch 667x320", w: 667, h: 320, touch: true },
];

(async () => {
  const browser = await R.launch();
  const fails = [];
  let checks = 0;
  const say = (...a) => { if (o.verbose) console.log(...a); };

  // the campaign as it stands with the first `won` battlefields won, every road so far told, on the map at `lv`
  const campaign = (g, won, lv) => g.ev(([won, lv]) => {
    for (let i = 0; i < LEVELS.length; i++) for (let e = 0; e < ERAS.length; e++) localStorage.removeItem(bestKey(i, e));
    for (let i = 0; i < won; i++) localStorage.setItem(bestKey(i, LEVELS[i].era), "21");
    localStorage.setItem("hs_chapters_seen", JSON.stringify(CHAPTERS.map(C => C.id)));
    localStorage.setItem("hs_unlocked_seen", JSON.stringify(LEVELS.slice(0, won + 1).map(L => L.id)));
    localStorage.removeItem("hs_map_march");
    testUnlockAll = false;
    gameOver = true;
    openCampaignMap(lv);
  }, [won, lv]);
  // a victory at battlefield lv as the save and the victory page leave it, then the Campaign Map button's own call
  const winAndReturn = (g, lv) => g.ev(lv => {
    localStorage.setItem(bestKey(lv, LEVELS[lv].era), "21");
    checkNewUnlocks();           // the victory page's buildMenu tells the new road
    openCampaignMap(lv);         // the page's Campaign Map button
  }, lv);
  const st = g => g.ev(() => MapLife.state());
  const until = async (g, fn, ms, arg) => {
    const t = Date.now();
    for (;;) {
      if (await g.ev(fn, arg)) return Date.now() - t;
      if (Date.now() - t > ms) return -1;
      await g.wait(30);
    }
  };

  for (const size of SIZES) {
    const fail = (m) => { fails.push(size.name + ": " + m); };
    const ok = (cond, m) => { checks++; if (!cond) fail(m); else say("  ok " + m); return cond; };
    const g = await R.openGame(browser, o.file, Object.assign({}, size, { storage: SEEN, init: [lifeOn] }));
    try {
      await campaign(g, 2, 2);
      await g.wait(700);
      let s = await st(g);
      ok(s.allowed && s.running && s.shown, "the layer runs on the map (" + JSON.stringify(s) + ")");

      // ---- the layer on the sheet ----
      const geo = await g.ev(() => {
        const c = $("worldMap"), l = $("mapLife"), r = c.getBoundingClientRect(), q = l ? l.getBoundingClientRect() : null;
        const sheet = { l: r.left + c.clientLeft, t: r.top + c.clientTop, w: r.width - 2 * c.clientLeft, h: r.height - 2 * c.clientTop };
        return { sheet, layer: q ? { l: q.left, t: q.top, w: q.width, h: q.height } : null, bw: l ? l.width : 0, dpr: devicePixelRatio,
          pe: l ? getComputedStyle(l).pointerEvents : "", map: { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } };
      });
      if (ok(!!geo.layer, "#mapLife is in the page")) {
        const d = Math.max(Math.abs(geo.layer.l - geo.sheet.l), Math.abs(geo.layer.t - geo.sheet.t),
          Math.abs(geo.layer.l + geo.layer.w - geo.sheet.l - geo.sheet.w), Math.abs(geo.layer.t + geo.layer.h - geo.sheet.t - geo.sheet.h));
        ok(d <= 1, "the layer lies on the map's sheet within 1 px (off by " + d.toFixed(2) + ": layer " + JSON.stringify(geo.layer) + " sheet " + JSON.stringify(geo.sheet) + ")");
        ok(geo.pe === "none", "the layer takes no pointer");
        ok(Math.abs(geo.bw - Math.min(2880, Math.round(geo.sheet.w * Math.min(3, geo.dpr)))) <= 2, "the layer is drawn at the screen's pixels (" + geo.bw + " for " + geo.sheet.w.toFixed(1) + " px at " + geo.dpr + "x)");
      }
      ok(Math.abs(geo.map.w / geo.map.h - 1.8) < 0.03, "the map keeps its shape (" + geo.map.w.toFixed(1) + " x " + geo.map.h.toFixed(1) + ")");

      // ---- it animates ----
      const a1 = await g.ev(() => ({ n: MapLife.state().frames, px: $("mapLife").toDataURL() }));
      await g.wait(450);
      const a2 = await g.ev(() => ({ n: MapLife.state().frames, px: $("mapLife").toDataURL() }));
      ok(a2.n - a1.n >= 5 && a2.n - a1.n <= 20, "about thirty frames a second (" + (a2.n - a1.n) + " in 0.45 s)");
      ok(a1.px !== a2.px, "two frames apart differ");

      // ---- hit-testing ----
      const nodes = await g.ev(() => {
        const c = $("worldMap"), r = c.getBoundingClientRect(), w = r.width - 2 * c.clientLeft, h = r.height - 2 * c.clientTop;
        return CHAPTERS[mapChapter()].levels.map(i => {
          const x = r.left + c.clientLeft + MAP_NODES[i].x * w / MAP_W, y = r.top + c.clientTop + MAP_NODES[i].y * h / MAP_H;
          const e = document.elementFromPoint(x, y);
          return { i, x, y, at: mapNodeAt({ clientX: x, clientY: y }), edge: mapNodeAt({ clientX: x + 20 * w / MAP_W, clientY: y - 20 * h / MAP_H }),
            hit: e ? e.id : "", open: levelUnlocked(i) };
        });
      });
      for (const n of nodes) {
        ok(n.at === n.i && n.edge === n.i, "battlefield " + n.i + " answers at its fort (" + n.at + ", " + n.edge + ")");
        ok(n.hit === "worldMap", "a point on fort " + n.i + " hits the map itself (" + n.hit + ")");
      }
      for (const n of nodes.filter(n => n.open).sort((a, b) => a.i - b.i)) {
        if (await g.ev(() => curLevel) === n.i) continue;
        await g.tapAt(n.x, n.y);
        await g.frames(3);
        const got = await g.ev(() => ({ lv: curLevel, mode: menuMode }));
        ok(got.lv === n.i && got.mode === "map", "a tap on fort " + n.i + " chooses it (chose " + got.lv + ", " + got.mode + ")");
      }

      // ---- the wide window's map and its column ----
      if (size.w === 1600) {
        ok(geo.map.w > 1000, "the map takes the wide window (" + geo.map.w.toFixed(0) + " px wide)");
        const boxes = {};
        for (const sel of ["#startBtn", "#chapterTabs .chTab.selected", "#chStory", "#diffRow .diffBtn.selected", "#ovGear", "#nardiBtn", "#ovStars", "#ovSub"]) {
          const q = await g.reach(sel);
          if (ok(!q.why, sel + " is in reach" + (q.why ? " (" + q.why + ")" : ""))) boxes[sel] = q.r;
        }
        const over = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
        const names = Object.keys(boxes);
        for (const k of names) ok(!over(boxes[k], geo.map), k + " lies clear of the map");
        for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) ok(!over(boxes[names[a]], boxes[names[b]]), names[a] + " and " + names[b] + " lie apart");
        const inside = await g.ev(() => { const r = $("worldMap").getBoundingClientRect(); return r.left >= 20 && r.top >= 20 && r.right <= innerWidth - 20 && r.bottom <= innerHeight - 20; });
        ok(inside, "the map lies inside the page's frame");
      }

      // ---- it stops under Settings, while the page is hidden, and on a chronicle ----
      const idle = async (what) => {
        await g.wait(350);
        const b1 = (await st(g)).frames;
        await g.wait(400);
        const b2 = (await st(g)).frames;
        ok(b2 === b1, "no frame is drawn " + what + " (" + (b2 - b1) + " in 0.4 s)");
      };
      const runs = async (what) => {
        await g.wait(350);
        const b1 = (await st(g)).frames;
        await g.wait(400);
        const b2 = (await st(g)).frames;
        ok(b2 - b1 >= 4, "the layer runs again " + what + " (" + (b2 - b1) + " frames in 0.4 s)");
      };
      await g.press("#ovGear");
      ok(await g.ev(() => $("settings").style.display === "block"), "Settings opens");
      await idle("under Settings");
      await g.ev(() => closeSettings());
      await runs("after Settings");
      await g.ev(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); });
      await idle("while the page is hidden");
      await g.ev(() => { delete document.hidden; });
      await runs("when the page is back");
      await g.ev(() => showBrief());
      await g.wait(900);
      s = await st(g);
      ok(!s.running && !s.shown, "on a chronicle the loop is ended and the layer put away (" + JSON.stringify({ running: s.running, shown: s.shown }) + ")");
      await idle("on a chronicle");
      await g.ev(() => openCampaignMap(curLevel));
      await runs("back on the map");

      // ---- the march ----
      await campaign(g, 0, 0);
      await g.wait(500);
      const m0 = (await st(g)).marches;
      await winAndReturn(g, 0);
      const tm = Date.now();
      ok(await g.ev(() => localStorage.getItem("hs_map_march")) !== null || (await st(g)).march, "the new road's march waits for the map");
      ok(await g.ev(() => MapLife.holds(1)), "the new fort stays closed on the chart until the march opens it");
      const began = await until(g, () => !!MapLife.state().march, 1500);
      s = await st(g);
      ok(began >= 0 && s.march && s.march.from === 0 && s.march.to === 1 && s.march.mode === "road", "the march plays from the fort won to the fort opened (" + JSON.stringify(s.march) + ")");
      ok(await g.ev(() => localStorage.getItem("hs_map_march")) === null, "the march is told once (its mark is spent as it begins)");
      await g.shot(o.shots, size.name + " march");
      const done = await until(g, () => !MapLife.state().march, 4000);
      const took = Date.now() - tm;
      s = await st(g);
      ok(done >= 0 && took > 1500 && took < 3600, "the march ends by itself in about 2.5 s (" + took + " ms)");
      ok(s.marches === m0 + 1 && !(await g.ev(() => MapLife.holds(1))), "one march played, and the new fort stands open (" + s.marches + ")");
      await g.ev(() => openCampaignMap(0));
      await g.wait(900);
      s = await st(g);
      ok(s.marches === m0 + 1 && !s.march && s.pending < 0, "a second return to the map plays nothing (" + JSON.stringify({ marches: s.marches, march: s.march, pending: s.pending }) + ")");

      // the next victory's march, ended by a tap on the map (clear of every fort)
      await winAndReturn(g, 1);
      const b2 = await until(g, () => { const m = MapLife.state().march; return !!m && m.p > 0.05; }, 2000);
      ok(b2 >= 0, "the next victory's march plays");
      const clear = await g.ev(() => {
        const c = $("worldMap"), r = c.getBoundingClientRect();
        for (const p of [[360, 200], [120, 120], [520, 60], [600, 250], [300, 60]]) {
          const x = r.left + c.clientLeft + p[0] * (r.width - 2 * c.clientLeft) / MAP_W, y = r.top + c.clientTop + p[1] * (r.height - 2 * c.clientTop) / MAP_H;
          if (mapNodeAt({ clientX: x, clientY: y }) < 0) return { x, y };
        }
        return null;
      });
      const lvBefore = await g.ev(() => curLevel);
      await g.tapAt(clear.x, clear.y);
      await g.frames(2);
      s = await st(g);
      ok(!s.march, "a tap ends the march at once (" + JSON.stringify(s.march) + ")");
      ok(!(await g.ev(() => MapLife.holds(2))) && await g.ev(() => levelUnlocked(2)), "and its fort stands open");
      ok(await g.ev(() => curLevel) === lvBefore, "the tap chose nothing");
      // the last battlefield of the chart: the road leads on to the next chapter's
      const last = await g.ev(() => CHAPTERS[0].levels[CHAPTERS[0].levels.length - 1]);
      await campaign(g, last, last);
      await g.wait(400);
      await winAndReturn(g, last);
      const b3 = await until(g, () => !!MapLife.state().march, 2000);
      s = await st(g);
      ok(b3 >= 0 && s.march && s.march.mode === "on" && s.march.from === last, "a road to the next chart plays its cue on this one (" + JSON.stringify(s.march) + ")");
      await g.page.keyboard.press("Shift");
      await g.frames(2);
      ok(!(await st(g)).march, "a key ends it at once");

      // ---- the ember ----
      await campaign(g, 1, 1);
      await g.wait(300);
      await g.ev(() => MapLife.lost(1));
      ok((await st(g)).ember === 1, "a lost stand's fort is given its ember");
      await g.wait(2000);
      ok((await st(g)).ember === -1, "and the ember is gone within 2 s");

      // ---- reduced motion ----
      await g.page.emulateMedia({ reducedMotion: "reduce" });
      await campaign(g, 0, 0);
      await g.wait(1300);
      s = await st(g);
      ok(s.still && !s.running, "with reduced motion the loop is off (" + JSON.stringify({ still: s.still, running: s.running }) + ")");
      const r1 = await g.ev(() => ({ n: MapLife.state().frames, px: $("mapLife") ? $("mapLife").toDataURL() : "" }));
      await g.wait(1300);
      const r2 = await g.ev(() => ({ n: MapLife.state().frames, px: $("mapLife") ? $("mapLife").toDataURL() : "" }));
      ok(r1.px === r2.px, "and the layer holds one still frame");
      const m1 = s.marches;
      await winAndReturn(g, 0);
      ok(!(await g.ev(() => MapLife.holds(1))), "a victory's return holds no fort closed");
      const lit = await until(g, () => MapLife.state().glow === 1, 1500);
      s = await st(g);
      ok(lit >= 0 && !s.march && s.marches === m1 + 1, "the new fort is lit, with no march (" + JSON.stringify({ glow: s.glow, march: s.march, marches: s.marches }) + ")");
      const dark = await until(g, () => MapLife.state().glow === -1, 1200);
      ok(dark >= 0, "and the light is gone within a second");
      await g.page.emulateMedia({ reducedMotion: "no-preference" });
      await g.wait(1300);
      ok((await st(g)).running, "motion allowed again, the layer runs");

      const probs = await g.problems();
      ok(!probs.length, "no errors (" + probs.join("; ") + ")");
      if (fails.some(f => f.startsWith(size.name))) await g.shot(o.shots, size.name);
    } catch (e) {
      fail("the script stopped: " + (e && e.stack || e));
      await g.shot(o.shots, size.name + " stopped");
    }
    await g.close();
  }

  // ---- a plain test-driven load has no living map ----
  {
    const g = await R.openGame(browser, o.file, { name: "plain 1600x900", w: 1600, h: 900, storage: SEEN });
    try {
      await campaign(g, 1, 1);
      await winAndReturn(g, 1);
      await g.wait(800);
      const s = await st(g);
      checks++;
      if (s.allowed || s.running || s.march || s.frames || await g.ev(() => !!$("mapLife") || localStorage.getItem("hs_map_march") !== null || MapLife.holds(2) || MapLife.flies())) {
        fails.push("plain load: a browser driven by a test has a living map (" + JSON.stringify(s) + ")");
      }
      const probs = await g.problems();
      checks++;
      if (probs.length) fails.push("plain load: " + probs.join("; "));
    } catch (e) { fails.push("plain load: the script stopped: " + (e && e.stack || e)); }
    await g.close();
  }

  await browser.close();
  R.finish("maplife", fails, { checks, sizes: SIZES.length }, t0);
})();
