// Shared helpers of the regression scripts in tools/regress (see README.md): the page opened in headless Chromium at
// a given size, by mouse or by touch, real input (CDP touches, Playwright's mouse) aimed at what the player sees,
// and a battle entered through the battlefield's chronicle as a player enters it.
//
// Every script takes the page to test as its first argument (default: the repo's index.html) and needs only
// Playwright (NODE_PATH=$(npm root -g)). Options every script accepts:
//   --quick         a smaller sample (fewer battlefields, shorter waits); run-all passes it on
//   --levels=a,b    battlefields by index or id (0, ani, 3-5), where the script walks battlefields
//   --shots=dir     a screenshot of every failure there
//   --verbose       a line per step
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require(process.env.PW_PATH || "playwright");

const ROOT = path.resolve(__dirname, "..", "..");

// ---- the command line ----
function cli(argv = process.argv.slice(2)) {
  const o = { file: null, quick: false, levels: null, shots: null, verbose: false, jobs: 0, rest: [] };
  for (const a of argv) {
    if (a === "--quick") o.quick = true;
    else if (a === "--verbose" || a === "-v") o.verbose = true;
    else if (a.startsWith("--levels=")) o.levels = a.slice(9);
    else if (a.startsWith("--shots=")) o.shots = path.resolve(a.slice(8));
    else if (a.startsWith("--jobs=")) o.jobs = +a.slice(7) | 0;
    else if (a.startsWith("--")) o.rest.push(a);
    else if (!o.file) o.file = a;
    else o.rest.push(a);
  }
  o.file = path.resolve(o.file || process.env.GAME || path.join(ROOT, "index.html"));
  if (!fs.existsSync(o.file)) { console.error("no such page: " + o.file); process.exit(2); }
  if (o.shots) fs.mkdirSync(o.shots, { recursive: true });
  return o;
}

// battlefield list: "0,3,ani" or "10-16"; ids are resolved in the page (levelIndexOf)
function parseLevels(spec, ids) {
  if (!spec || spec === "all") return ids.map((_, i) => i);
  const out = [];
  for (const part of String(spec).split(",")) {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (m) { for (let i = +m[1]; i <= +m[2]; i++) out.push(i); continue; }
    const i = /^\d+$/.test(part) ? +part : ids.indexOf(part);
    if (i < 0 || i >= ids.length) throw new Error("no battlefield " + part);
    out.push(i);
  }
  return out;
}

// ---- sizes ----
const SIZES = {
  desk: { name: "mouse 1600x900", w: 1600, h: 900 },
  big: { name: "mouse 2000x1250", w: 2000, h: 1250 },
  wide1440: { name: "mouse 1440x900", w: 1440, h: 900 },
  ipad: { name: "touch 1194x834", w: 1194, h: 834, touch: true },
  ipadTall: { name: "touch 834x1194", w: 834, h: 1194, touch: true },
};

// ---- the browser ----
async function launch(opts = {}) {
  const args = [];
  if (opts.audio) args.push("--autoplay-policy=no-user-gesture-required");
  return chromium.launch({ args });
}

// A page of the game at one size. o: { w, h, touch, dpr, name, storage: { key: value } set before the game loads }
async function openGame(browser, file, o) {
  const ctx = await browser.newContext({
    viewport: { width: o.w, height: o.h },
    deviceScaleFactor: o.dpr || (o.touch ? 2 : 1),
    hasTouch: !!o.touch, isMobile: !!o.touch,
  });
  if (o.storage) {
    await ctx.addInitScript(st => {
      try { for (const k in st) { if (st[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, st[k]); } } catch (e) {}
    }, o.storage);
  }
  const page = await ctx.newPage();
  const g = new Game(page, ctx, o);
  page.on("pageerror", e => g.errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") g.errs.push("console.error: " + m.text()); });
  page.on("crash", () => g.errs.push("the page crashed"));
  await page.goto("file://" + file + (o.query ? "?" + o.query : ""), { timeout: 120000 });
  await page.waitForFunction(() => typeof menuMode !== "undefined" && typeof Town !== "undefined" && typeof Nardi !== "undefined" &&
    document.readyState === "complete", null, { timeout: 120000 });
  g.cdp = await ctx.newCDPSession(page);
  await g.frames(3);
  return g;
}

class Game {
  constructor(page, ctx, o) {
    this.page = page; this.ctx = ctx; this.o = o; this.touch = !!o.touch;
    this.name = o.name || (o.touch ? "touch " : "mouse ") + o.w + "x" + o.h;
    this.errs = [];
  }
  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  wait(ms) { return this.page.waitForTimeout(ms); }
  // n animation frames of the page
  frames(n = 1) {
    return this.page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  }
  async close() { try { await this.ctx.close(); } catch (e) {} }

  // ---- input: a finger (CDP touch events, as an iPad's) or the mouse, at client pixels ----
  async touchAt(x, y, holdMs) {
    const pt = [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }];
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
    if (holdMs) await this.wait(holdMs);
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  async clickAt(x, y, opts = {}) {
    const m = this.page.mouse;
    await m.move(x, y);
    if (opts.shift) await this.page.keyboard.down("Shift");
    await m.down();
    if (opts.holdMs) await this.wait(opts.holdMs);
    await m.up();
    if (opts.shift) await this.page.keyboard.up("Shift");
  }
  // the player's own input at a point: a tap on a touch page, a click elsewhere
  async tapAt(x, y, opts = {}) {
    if (this.touch) await this.touchAt(x, y, opts.holdMs);
    else await this.clickAt(x, y, opts);
  }
  // what a finger or the pointer at (x, y) lands on, named
  hitName(x, y) {
    return this.ev(([x, y]) => {
      const e = document.elementFromPoint(x, y);
      if (!e) return "nothing";
      return e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).join(".") : "");
    }, [x, y]);
  }
  // An element's center, if a finger or the pointer there reaches it (it, or something inside it, is what the
  // point hits). Returns { x, y, w, h, r } or { why }. sel: a CSS selector, or a function source returning the element
  reach(sel) {
    return this.ev(sel => {
      const e = sel.startsWith("=>") ? (0, eval)("(" + sel.slice(2) + ")")() : document.querySelector(sel);
      if (!e) return { why: "missing" };
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if (!r.width || !r.height || cs.display === "none" || cs.visibility === "hidden") return { why: "hidden" };
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { why: "off screen at " + Math.round(x) + "," + Math.round(y) };
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === e || e.contains(hit))) {
        return { why: "covered by " + (hit ? hit.tagName.toLowerCase() + (hit.id ? "#" + hit.id : "") + (typeof hit.className === "string" && hit.className ? "." + hit.className.trim().split(/\s+/).join(".") : "") : "nothing") };
      }
      return { x, y, w: r.width, h: r.height, r: { l: r.left, t: r.top, r: r.right, b: r.bottom } };
    }, typeof sel === "function" ? "=>" + sel.toString() : sel);
  }
  // press a button as the player does: it must be on screen and uncovered
  async press(sel, opts = {}) {
    const q = await this.reach(sel);
    if (q.why) throw new Error("cannot " + (this.touch ? "tap " : "click ") + (typeof sel === "function" ? "the element" : sel) + ": " + q.why);
    await this.tapAt(q.x, q.y, opts);
    await this.frames(2);
    return q;
  }

  // ---- the field: world points on the screen ----
  // a world point (dy: world units below it, scaled with depth; lift: units above) in client pixels
  worldToClient(wx, wy, dy = 0) {
    return this.ev(([wx, wy, dy]) => {
      const r = canvas.getBoundingClientRect(), p = proj(wx, wy);
      return { x: r.left + offX + p.x * scale, y: r.top + offY + (p.y + dy * p.s) * scale, s: p.s * scale };
    }, [wx, wy, dy]);
  }

  // ---- state ----
  // page errors, console errors and the game's crash card, as one list
  async problems() {
    const crash = await this.ev(() => (typeof crashed !== "undefined" && crashed ? String(crashed && crashed.message || crashed) : "")).catch(e => "evaluate failed: " + e.message);
    return this.errs.concat(crash ? ["crash card: " + crash] : []);
  }
  async shot(dir, name) {
    if (!dir) return;
    try { await this.page.screenshot({ path: path.join(dir, name.replace(/[^\w.-]+/g, "_") + ".png") }); } catch (e) {}
  }

  // ---- the way into a battle ----
  // the story page of the first visit is turned to the map ("To the Map"), as a player does
  async toMap() {
    for (let k = 0; k < 4; k++) {
      const mode = await this.ev(() => menuMode);
      if (mode !== "chapter") break;
      await this.press("#startBtn");
      await this.wait(150);
    }
  }
  // The battlefield's chronicle, reached as the map leads there (every road opened, as Shift+U does in the game),
  // then "Begin the Stand" pressed by the player's own input. o.tutorial: leave the tutorial pending (else it is
  // marked done first, so the coach does not hold the field). o.diff: 0, 1, 2
  async enterBattle(lv, o = {}) {
    await this.ev(([lv, o]) => {
      try {
        if (!o.tutorial) localStorage.setItem("hs_tutorial_done", "1");
        localStorage.setItem("hs_chapters_seen", JSON.stringify(CHAPTERS.map(C => C.id)));
        localStorage.setItem("hs_unlocked_seen", JSON.stringify(LEVELS.map(L => L.id)));
      } catch (e) {}
      if (typeof Nardi !== "undefined" && Nardi.isOpen()) Nardi.close();
      if (typeof Town !== "undefined" && Town.isOpen()) Town.close();
      hideEndingCard();
      celebration = null; parley = null; fallen = null;
      gameOver = true; paused = false; endless = false;
      clearRun();
      testUnlockAll = true;
      curDiff = prefDiff = o.diff === undefined ? 1 : o.diff;
      openCampaignMap(lv);
      selectMapLevel(lv);
      showBrief();
    }, [lv, o]);
    await this.frames(2);
    // the brief's button: the overlay may still be fading in
    for (let k = 0; k < 20; k++) {
      const q = await this.reach("#startBtn");
      if (!q.why) break;
      await this.wait(100);
    }
    await this.press("#startBtn");
    await this.page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
    await this.frames(2);
  }
}

// ---- running and reporting ----
// a small pool: run fn over items, n at a time
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  return out;
}

// each script prints its findings and one RESULT line, and exits 1 when anything failed
function finish(name, fails, notes, t0) {
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  for (const f of fails) console.log("FAIL " + f);
  console.log("RESULT " + name + " " + (fails.length ? "FAIL" : "PASS") + " " + JSON.stringify(Object.assign({ fails: fails.length, seconds: +s }, notes || {})));
  process.exit(fails.length ? 1 : 0);
}

module.exports = { cli, parseLevels, SIZES, launch, openGame, Game, pool, finish, ROOT };
