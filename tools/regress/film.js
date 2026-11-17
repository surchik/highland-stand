// The chronicle's film (stage 5; the page's Film block): Erebuni, Tushpa and Avarayr open their chronicle on a short
// film, every other battlefield on the text as before. Headless Chromium may not decode H.264, so this script holds
// the page to its own logic, not to the picture: it sets window.__hsFilmTest ({ hold: true } keeps the film up
// through a decoding error; { base } points it at a folder with no files), which also lifts the rule that a browser
// driven by a test (navigator.webdriver) gets the text chronicle alone.
// At each size (1600x900 by mouse; by touch an iPad upright 834x1194 and an iPhone at 667x320, 852x393 with the
// Home Screen's insets, 393x659 and 375x553 upright), for each of the three battlefields:
// - the chronicle opens with the film over it: one <video> with the cut the window asks for (landscape when wider
//   than tall, vertical otherwise), its poster, its .mp4 asked for only now, its subtitles <track> on by default and
//   showing; all three files are in the repository; Skip is in reach, out of the safe areas, 44 px to a finger;
// - a muted film shows "Sound on" in reach, and a press unmutes it and puts the button away;
// - Skip puts the film away: no <video> left, the chronicle's text there, Begin the Stand, Campaign Map and the
//   pager in reach, the battlefield marked seen (hs_film_seen_<id>), and a "Watch the film" button in reach that no
//   other button overlaps;
// - opened again, the chronicle shows its text at once with that button, which plays the film again; Escape puts it
//   away; the film's end (the video's ended event) puts it away a second later;
// - Campaign Map takes the button away with the chronicle; a film left by the map is released.
// Once per size: Dvin (no film) has neither film nor button. Once, at 1600x900: a plain load driven by a test has no
// film, no button and no <video>; a missing file falls back to the text within the page's 4 s, unmarked and with no
// button; reduced motion and Save-Data show the text with the button and no autoplay; and under /next/ (the page
// served over http from a folder of that name) the mark is kept as next:hs_film_seen_<id> and the film's files are
// asked for under /next/assets/explainer/.
// Also: every battlefield with a film has its six files, and assets/explainer holds no other folder.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/film.js [index.html] [--quick] [--shots=dir] [--verbose]
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const R = require("./lib");
const o = R.cli();
const t0 = Date.now();
const IDS = ["erebuni", "tushpa", "avarayr"];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ALL = [
  R.SIZES.desk,
  { name: "iPhone SE Safari 667x320", w: 667, h: 320, touch: true, ua: UA, standalone: false },
  { name: "iPhone 15 upright 393x659", w: 393, h: 659, touch: true, ua: UA, standalone: false },
  R.SIZES.ipadTall,
  { name: "iPhone 15 Home Screen 852x393", w: 852, h: 393, touch: true, ua: UA, standalone: true, insets: { l: 59, r: 59, b: 21, t: 0 } },
  { name: "iPhone SE upright 375x553", w: 375, h: 553, touch: true, ua: UA, standalone: false },
];
const CONFIGS = o.quick ? ALL.slice(0, 3) : ALL;
const dir = path.dirname(o.file);
// a film's own failed request is not the page's error (a missing file, a codec this Chromium lacks)
// (nor is Chromium's refusal to read a subtitles file from file://, where every file is an origin of its own: the
// game is served over http, and the /next/ case below loads the track that way)
const mediaNoise = (m) => /Failed to load resource|ERR_FILE_NOT_FOUND|net::ERR_|MEDIA_ERR|DEMUXER|PIPELINE|Unsafe attempt to load URL file:\S+\.vtt/i.test(m);
const SEEN_TIP = { hs_ios_tip: "1", hs_tutorial_done: "1" };

(async () => {
  const browser = await R.launch();
  const fails = [];
  let films = 0, checks = 0;

  // ---- the files ----
  const have = fs.existsSync(path.join(dir, "assets", "explainer")) ? fs.readdirSync(path.join(dir, "assets", "explainer")).sort() : [];
  if (have.join() !== IDS.slice().sort().join()) fails.push("files: assets/explainer holds [" + have.join(", ") + "], the page's films are [" + IDS.join(", ") + "]");
  for (const id of IDS) for (const f of ["landscape.mp4", "landscape.vtt", "landscape-poster.jpg", "vertical.mp4", "vertical.vtt", "vertical-poster.jpg"]) {
    const p = path.join(dir, "assets", "explainer", id, f);
    if (!fs.existsSync(p) || !fs.statSync(p).size) fails.push("files: " + id + "/" + f + " is missing or empty");
    else if (f.endsWith(".vtt") && !/^WEBVTT/.test(fs.readFileSync(p, "utf8"))) fails.push("files: " + id + "/" + f + " is not a WebVTT file");
  }

  const openBrief = (g, id) => g.ev(id => {
    try {
      localStorage.setItem("hs_tutorial_done", "1");
      localStorage.setItem("hs_chapters_seen", JSON.stringify(CHAPTERS.map(C => C.id)));
      localStorage.setItem("hs_unlocked_seen", JSON.stringify(LEVELS.map(L => L.id)));
    } catch (e) {}
    const lv = levelIndexOf(id);
    testUnlockAll = true; curDiff = prefDiff = 1;
    openCampaignMap(lv); selectMapLevel(lv); showBrief();
  }, id).then(() => g.frames(3));
  const state = (g, id) => g.ev(id => {
    const f = document.getElementById("film"), v = f && f.querySelector("video"), t = v && v.querySelector("track"), b = document.getElementById("filmBtn");
    let seen = null; try { seen = localStorage.getItem("hs_film_seen_" + id); } catch (e) {}
    return {
      film: !!f, cut: f ? f.dataset.cut : "", fid: f ? f.dataset.id : "", videos: document.querySelectorAll("video").length,
      src: v ? v.getAttribute("src") : "", poster: v ? v.getAttribute("poster") : "", inline: v ? v.hasAttribute("playsinline") : false,
      controls: v ? v.controls : false, muted: v ? v.muted : null,
      track: t ? { kind: t.kind, src: t.getAttribute("src"), def: t.default, mode: v.textTracks[0] ? v.textTracks[0].mode : "" } : null,
      btn: !!b && !b.hidden && !!b.offsetParent, mode: menuMode, up: !overlayEl.classList.contains("hidden"),
      text: (document.getElementById("ovSub").textContent || "").trim().length, seen, open: Film.isOpen(),
    };
  }, id);
  // a control in reach: on screen, uncovered, out of the safe areas, at least min px each way to a finger
  // (held upright the chronicle may scroll, the owner's fallback there: the control is scrolled to first, as a
  // finger would)
  const inReach = async (g, C, sel, min, fail, what) => {
    if (C.h > C.w) { await g.ev(sel => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "nearest" }); }, sel); await g.frames(1); }
    const q = await g.reach(sel);
    checks++;
    if (q.why) { await fail(what + ": " + sel + " " + q.why); return null; }
    const ins = C.insets || {};
    if (q.r.l < (ins.l || 0) - 0.5 || q.r.r > C.w - (ins.r || 0) + 0.5 || q.r.t < (ins.t || 0) - 0.5 || q.r.b > C.h - (ins.b || 0) + 0.5) {
      await fail(what + ": " + sel + " is off screen or in a safe area (" + [q.r.l, q.r.t, q.r.r, q.r.b].map(Math.round).join(",") + ")");
    }
    if (min && (q.w < min - 0.5 || q.h < min - 0.5)) await fail(what + ": " + sel + " is " + Math.round(q.w) + "x" + Math.round(q.h) + " px, under " + min);
    return q;
  };
  const press = async (g, sel) => {
    if (g.o.h > g.o.w) { await g.ev(sel => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "nearest" }); }, sel); await g.frames(1); }
    return g.press(sel);
  };
  // the chronicle as it always was: its text and every button of it in reach
  const textPage = async (g, C, fail, what, wantBtn) => {
    const s = await state(g, "erebuni");
    if (s.film || s.videos || s.open) await fail(what + ": a film is still up (" + s.videos + " video)");
    if (s.mode !== "brief" || !s.up) await fail(what + ": not on the chronicle (" + s.mode + ")");
    if (s.text < 80) await fail(what + ": the chronicle's text is not there (" + s.text + " letters)");
    await inReach(g, C, "#startBtn", C.touch ? 44 : 0, fail, what);
    await inReach(g, C, "#mapBtn", C.touch ? 36 : 0, fail, what);
    if (await g.ev(() => document.getElementById("ovPager").classList.contains("on"))) {
      await inReach(g, C, "#pgNext", 0, fail, what);
    }
    if (wantBtn !== s.btn) await fail(what + ": the Watch the film button is " + (s.btn ? "shown" : "not shown"));
    if (wantBtn && s.btn) {
      await inReach(g, C, "#filmBtn", C.touch ? 36 : 0, fail, what);
      const lap = await g.ev(() => {
        const a = document.getElementById("filmBtn").getBoundingClientRect();
        return [...document.querySelectorAll("#overlay .bigRow .big")].filter(b => b.id !== "filmBtn" && b.offsetParent).filter(b => {
          const r = b.getBoundingClientRect();
          return a.left < r.right - 0.5 && r.left < a.right - 0.5 && a.top < r.bottom - 0.5 && r.top < a.bottom - 0.5;
        }).map(b => b.id);
      });
      if (lap.length) await fail(what + ": the Watch the film button overlaps " + lap.join(", "));
      const clip = await g.ev(() => { const b = document.getElementById("filmBtn"); return b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1; });
      if (clip) await fail(what + ": the Watch the film button's words are cut off");
    }
  };
  const filmUp = async (g, C, id, fail, what) => {
    const cut = C.w > C.h ? "landscape" : "vertical";
    const s = await state(g, id);
    films++;
    if (!s.film || s.videos !== 1) { await fail(what + ": no film (" + s.videos + " video)"); return false; }
    if (s.cut !== cut || s.fid !== id) await fail(what + ": the cut is " + s.fid + "/" + s.cut + ", not " + id + "/" + cut);
    const at = "assets/explainer/" + id + "/" + cut;
    if (s.src !== at + ".mp4") await fail(what + ": the video's file is " + s.src);
    if (s.poster !== at + "-poster.jpg") await fail(what + ": the poster is " + s.poster);
    if (!s.inline || s.controls) await fail(what + ": the video must play in line with no native controls");
    if (!s.track || s.track.kind !== "subtitles" || s.track.src !== at + ".vtt" || !s.track.def || s.track.mode !== "showing") await fail(what + ": the subtitles track is " + JSON.stringify(s.track));
    for (const f of [s.src, s.poster, s.track && s.track.src]) if (f && !fs.existsSync(path.join(dir, f))) await fail(what + ": " + f + " is not in the repository");
    await inReach(g, C, "#filmSkip", 44, fail, what);
    if (await g.ev(() => document.activeElement && document.activeElement.id) !== "filmSkip") await fail(what + ": Skip does not hold the focus");
    // nothing of the chronicle can be pressed through the film
    const through = await g.ev(() => [[0.5, 0.5], [0.1, 0.9], [0.5, 0.92], [0.9, 0.9], [0.1, 0.1]].filter(([fx, fy]) => {
      const e = document.elementFromPoint(innerWidth * fx, innerHeight * fy);
      return !(e && e.closest("#film"));
    }).length);
    if (through) await fail(what + ": the page under the film can be pressed through it at " + through + " of 5 points");
    return true;
  };

  const visit = async (C) => {
    const tag = C.name;
    const g = await R.openGame(browser, o.file, Object.assign({}, C, { storage: SEEN_TIP, init: [[() => { window.__hsFilmTest = { hold: true }; }, null]] }));
    const fail = async (m) => { fails.push(tag + " " + m); await g.shot(o.shots, "film " + tag + " " + m.slice(0, 60)); };
    const log = (m) => { if (o.verbose) console.log(tag + " " + m); };
    try {
      // (the first visit's story turned to the map: held upright its button is scrolled to first)
      for (let k = 0; k < 4 && (await g.ev(() => menuMode)) === "chapter"; k++) { await press(g, "#startBtn"); await g.wait(150); }
      for (const id of IDS) {
        await openBrief(g, id);
        if (await filmUp(g, C, id, fail, id + " opened")) {
          if ((await state(g, id)).seen) await fail(id + ": marked seen before it was skipped");
          // muted, it offers Sound on
          await g.ev(() => { document.querySelector("#film video").muted = true; });
          await g.frames(2);
          if (await inReach(g, C, "#filmSound", 44, fail, id + " muted")) {
            await g.press("#filmSound");
            const s = await g.ev(() => ({ muted: document.querySelector("#film video").muted, hid: document.getElementById("filmSound").hidden }));
            if (s.muted || !s.hid) await fail(id + ": Sound on left the film " + (s.muted ? "muted" : "with its button up"));
          }
          await g.press("#filmSkip");
        }
        await textPage(g, C, fail, id + " after Skip", true);
        if ((await state(g, id)).seen !== "1") await fail(id + ": Skip did not mark the film seen");
        log(id + " skipped");
        // the chronicle again: the text at once, the button plays the film, Escape puts it away
        await openBrief(g, id);
        await textPage(g, C, fail, id + " opened again", true);
        await press(g, "#filmBtn");
        if (await filmUp(g, C, id, fail, id + " by its button")) {
          await g.page.keyboard.press("Escape");
          await g.frames(2);
        }
        await textPage(g, C, fail, id + " after Escape", true);
        // the film's end puts it away a second later
        await press(g, "#filmBtn");
        await g.ev(() => document.querySelector("#film video").dispatchEvent(new Event("ended")));
        await g.wait(400);
        if (!(await state(g, id)).film) await fail(id + ": the film went at once at its end, not after its closing card");
        await g.wait(1000);
        await textPage(g, C, fail, id + " after its end", true);
        // left by the map with the film up: the video is released and the button goes with the chronicle
        await press(g, "#filmBtn");
        await g.ev(() => openCampaignMap(curLevel));
        await g.frames(3);
        const s = await state(g, id);
        if (s.film || s.videos || s.btn || s.mode !== "map") await fail(id + ": back on the map " + JSON.stringify({ film: s.film, videos: s.videos, btn: s.btn, mode: s.mode }));
        await openBrief(g, id);
        await press(g, "#mapBtn");
        await g.frames(3);
        const m = await state(g, id);
        if (m.btn || m.mode !== "map") await fail(id + ": Campaign Map left the button up (" + m.mode + ")");
      }
      // a battlefield with no film
      await openBrief(g, "dvin");
      const d = await state(g, "dvin");
      if (d.film || d.videos || d.btn) await fail("dvin: a film or its button on a battlefield without one");
      const errs = (await g.problems()).filter(e => !mediaNoise(e));
      if (errs.length) await fail("errors: " + errs.slice(0, 3).join(" | "));
    } catch (e) {
      await fail("stopped: " + String(e && e.message || e).split("\n")[0]);
    }
    await g.close();
  };
  await R.pool(CONFIGS, o.jobs || 2, visit);

  // ---- once, at 1600x900 ----
  const one = async (tag, opts, run) => {
    let g = null;
    const fail = async (m) => { fails.push(tag + ": " + m); if (g) await g.shot(o.shots, "film " + tag + " " + m.slice(0, 60)); };
    try {
      g = await R.openGame(browser, o.file, Object.assign({}, R.SIZES.desk, opts));
      await g.toMap();
      await run(g, fail);
      const errs = (await g.problems()).filter(e => !mediaNoise(e));
      if (errs.length) await fail("errors: " + errs.slice(0, 3).join(" | "));
    } catch (e) { await fail("stopped: " + String(e && e.message || e).split("\n")[0]); }
    if (g) await g.close();
  };
  const D = R.SIZES.desk;
  // a browser driven by a test, with no switch: the page of before
  await one("a plain load", {}, async (g, fail) => {
    for (const id of IDS) {
      await openBrief(g, id);
      await g.wait(300);
      await textPage(g, D, fail, id, false);
      if (await g.ev(() => !!document.getElementById("film") || !!document.getElementById("filmBtn") || !!document.querySelector("video"))) await fail(id + ": something of the film is in the page");
    }
  });
  // a missing file: the film goes by itself, the text stands, nothing is marked
  await one("a missing file", { init: [[() => { window.__hsFilmTest = { base: "assets/explainer-none/" }; }, null]] }, async (g, fail) => {
    await openBrief(g, "erebuni");
    const at = Date.now();
    await g.page.waitForFunction(() => !document.getElementById("film"), null, { timeout: 6000 }).catch(() => {});
    const s = await state(g, "erebuni");
    if (s.film) await fail("the film is still up " + (Date.now() - at) + " ms after its file failed");
    if (s.seen) await fail("a film that failed is marked seen");
    await textPage(g, D, fail, "after the failure", false);
  });
  // less motion asked for: the text, with the button, and no film by itself
  await one("reduced motion", { init: [[() => { window.__hsFilmTest = { hold: true }; }, null]] }, async (g, fail) => {
    await g.page.emulateMedia({ reducedMotion: "reduce" });
    await openBrief(g, "tushpa");
    await textPage(g, D, fail, "the chronicle", true);
    await press(g, "#filmBtn");
    if (!(await state(g, "tushpa")).film) await fail("the button did not play the film");
    await g.press("#filmSkip");
  });
  await one("Save-Data", { init: [[() => {
    window.__hsFilmTest = { hold: true };
    try { Object.defineProperty(Navigator.prototype, "connection", { configurable: true, get: () => ({ saveData: true, effectiveType: "4g" }) }); } catch (e) {}
  }, null]] }, async (g, fail) => {
    await openBrief(g, "avarayr");
    await textPage(g, D, fail, "the chronicle", true);
  });
  // under /next/: the mark wears the staging channel's prefix, the files are asked for under /next/
  {
    const asked = [];
    const srv = http.createServer((q, s) => {
      const u = decodeURIComponent(q.url.split("?")[0]);
      asked.push(u);
      if (u === "/next/" || u === "/next/index.html") { s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); fs.createReadStream(o.file).pipe(s); return; }
      const f = u.startsWith("/next/assets/explainer/") && !u.includes("..") ? path.join(dir, u.slice(6)) : "";
      if (f && fs.existsSync(f)) { s.writeHead(200, { "content-type": f.endsWith(".mp4") ? "video/mp4" : f.endsWith(".vtt") ? "text/vtt" : "image/jpeg" }); fs.createReadStream(f).pipe(s); return; }
      s.writeHead(404); s.end();
    });
    await new Promise(r => srv.listen(0, "127.0.0.1", r));
    const tag = "/next/";
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    try {
      await ctx.addInitScript(() => { window.__hsFilmTest = { hold: true }; window.__hsQuietCouncilCard = window.__hsQuietPostCard = true; });
      const page = await ctx.newPage();
      await page.goto("http://127.0.0.1:" + srv.address().port + "/next/", { timeout: 120000 });
      await page.waitForFunction(() => typeof menuMode !== "undefined" && typeof Film !== "undefined" && document.readyState === "complete", null, { timeout: 120000 });
      const r = await page.evaluate(async () => {
        const lv = levelIndexOf("erebuni");
        localStorage.setItem("hs_tutorial_done", "1");
        testUnlockAll = true; openCampaignMap(lv); selectMapLevel(lv); showBrief();
        await new Promise(r => setTimeout(r, 300));
        const up = !!document.getElementById("film");
        if (up) document.getElementById("filmSkip").click();
        // (the page's own localStorage adds the prefix by itself: the browser's is read through a frame of the same origin)
        const fr = document.body.appendChild(document.createElement("iframe"));
        const real = fr.contentWindow.localStorage;
        const out = { channel: HS_CHANNEL, up, next: real.getItem("next:hs_film_seen_erebuni"), live: real.getItem("hs_film_seen_erebuni") };
        fr.remove();
        return out;
      });
      if (r.channel !== "next" || !r.up) fails.push(tag + ": " + JSON.stringify(r));
      if (r.next !== "1" || r.live !== null) fails.push(tag + ": the mark is kept as " + JSON.stringify({ "next:hs_film_seen_erebuni": r.next, hs_film_seen_erebuni: r.live }));
      if (!asked.some(u => u.startsWith("/next/assets/explainer/erebuni/landscape"))) fails.push(tag + ": no file of the film was asked for under /next/assets/explainer/ (" + asked.join(", ") + ")");
      if (asked.some(u => u.startsWith("/assets/"))) fails.push(tag + ": a file was asked for at the site's root (" + asked.filter(u => u.startsWith("/assets/")).join(", ") + ")");
    } catch (e) { fails.push(tag + ": stopped: " + String(e && e.message || e).split("\n")[0]); }
    await ctx.close();
    srv.close();
  }

  await browser.close();
  R.finish("film", fails, { sizes: CONFIGS.length, films, checks }, t0);
})().catch(e => { console.log("FAIL film stopped: " + (e && e.stack || e)); console.log("RESULT film FAIL {}"); process.exit(1); });
