// Under Ararat, gate P's automated part (spec 15.3, 14.5): a whole town game played through the real UI by touch
// (CDP touch events, as an iPad's finger), in the real rAF loop at 4x (the held speed button). The script reads the
// game's state to decide, as a player looks at the screen, but every action is a tap or a drag on a real button or
// on the map, and every tap point is checked with elementFromPoint first (a covered button counts as a dead end).
// Usage:  NODE_PATH=$(npm root -g) node tools/town-touch.js [W H] [goal] [maxGameMin]
//   goal: age2 (default: play to Age 2 and 2 minutes on) | opening (the coached steps, then 3 minutes) | win (Age 2,
//   then the Temple of Garni)
// Env:  GAME=path/index.html  SHOTS=dir (screenshots, the log and a JSON summary)  STORAGE=throw (localStorage
//       access throws, as in a sandboxed page)  FIRST=0 (no first town)
// Prints "RESULT {...}"; fails counts the actions the UI did not let through, errs the page errors.
const { chromium } = require(process.env.PW_PATH || "playwright");
const W = +(process.argv[2] || 1194), H = +(process.argv[3] || 834), GOAL = process.argv[4] || "age2", MAXMIN = +(process.argv[5] || 30);
const fs = require("fs"), path = require("path"), os = require("os");
const FILE = path.resolve(process.env.GAME || path.join(__dirname, "..", "index.html"));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), "town-touch");
fs.mkdirSync(SHOTS, { recursive: true });
const TAG = "tg" + W + "x" + H + (process.env.STORAGE === "throw" ? "-nostore" : "");
const log = [], errs = [], fails = [], stats = {};
let age2At = 0;
const t0 = Date.now();
const note = s => { const l = "[" + ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + "s] " + s; log.push(l); console.log(l); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  if (process.env.STORAGE === "throw") await ctx.addInitScript(() => {
    for (const k of ["localStorage", "sessionStorage"]) Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  page.on("pageerror", e => { errs.push(e.message); note("PAGEERROR " + e.message); });
  page.on("console", m => { if (m.type() === "error") { errs.push("console: " + m.text()); note("CONSOLE.ERROR " + m.text()); } });
  await page.goto("file://" + FILE);
  await page.waitForTimeout(1500);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = ms => page.waitForTimeout(ms);
  await ev(() => { try { for (const k of ["hs_town", "hs_town_run", "hs_town_bless"]) localStorage.removeItem(k); } catch (e) {} if (typeof menuMode !== "undefined" && menuMode === "chapter") $("startBtn").click(); });
  await wait(400);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(p => ({ x: p.x, y: p.y, id: p.id || 0, radiusX: 2, radiusY: 2, force: 1 })) });
  async function tapXY(x, y, hold) { await touch("touchStart", [{ x, y }]); if (hold) await wait(hold); await touch("touchEnd", []); await wait(70); }
  // a DOM element's center, if a finger there would reach it (it, or something inside it, is what the point hits)
  const reach = sel => ev(s => {
    let e = null;
    if (s.startsWith("@")) e = Town.test.button(s.slice(1)); else e = document.querySelector(s);
    if (!e) return { why: "missing" };
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (!r.width || cs.display === "none" || cs.visibility === "hidden") return { why: "hidden" };
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { why: "off screen " + [Math.round(x), Math.round(y)] };
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(hit === e || e.contains(hit))) return { why: "covered by " + (hit ? (hit.id || hit.className || hit.tagName) : "nothing") };
    return { x, y, w: r.width, h: r.height, off: e.classList.contains("off") || e.getAttribute("aria-disabled") === "true" || e.disabled, txt: (e.textContent || "").trim().slice(0, 40) };
  }, sel);
  async function press(sel, hold) {
    const q = await reach(sel);
    if (!q.x) throw new Error("cannot tap " + sel + ": " + q.why);
    await tapXY(q.x, q.y, hold);
    stats[sel] = (stats[sel] || 0) + 1;
    return q;
  }
  async function tryPress(sel) { try { await press(sel); return true; } catch (e) { return false; } }
  const S = () => ev(() => {
    const T = Town.test, g = T.G;
    if (!g) return { card: T.card(), noG: true };
    const L = TW.labor(g), tc = g.blds.find(b => b.k === "tc");
    const blds = g.blds.filter(b => !b.dead).map(b => ({ id: b.id, k: b.k, x: b.x, y: b.y, done: b.done, auto: b.auto, q: (b.q || []).length, nb: (b.builders || []).length }));
    const units = g.units.filter(u => !u.dead);
    return {
      tick: g.tick, min: g.tick / 600, age: g.age, aging: !!g.aging, res: Object.assign({}, g.res), popCap: g.popCap, pop: L.pop, L,
      vil: units.filter(u => u.k === "vil").length, gar: units.filter(u => u.side === 0 && u.k !== "vil").length,
      raiders: units.filter(u => u.side === 1).length, blds, tc: tc ? { x: tc.x, y: tc.y, auto: tc.auto, q: (tc.q || []).length } : null,
      card: T.card(), mode: T.mode(), sheet: T.sheet(), garOpen: T.garOpen(), next: T.nextLine(), call: T.callLine(), over: g.over, held: Array.from(T.held()),
      speed: (document.querySelector("#twSpeed") || {}).textContent, info: !!document.querySelector("#twInfo.on"),
      fallen: Object.assign({}, g.stats.fallen), raids: g.clock.raidN, ghost: T.ghost(), techs: Object.assign({}, g.techs), researching: g.blds.some(b => b.rq && b.rq.length),
    };
  });
  const shot = async n => { try { await page.screenshot({ path: SHOTS + "/" + TAG + "-" + n + ".png" }); } catch (e) {} };
  const fail = (what, why) => { fails.push(what + ": " + why); note("FAIL " + what + ": " + why); };

  // ---- the door, the start card, Begin, the age card ----
  let st;
  try {
    await press("#townBtn");
    await wait(300);
    st = await S();
    if (st.card !== "start") throw new Error("no start card: " + st.card);
    await press('#twCard [data-diff="1"]');
    const ft = await ev(() => document.querySelector("#twCard [data-ft]").getAttribute("aria-pressed"));
    const wantFt = process.env.FIRST !== "0";
    if ((ft === "true") !== wantFt) await press("#twCard [data-ft]");
    await shot("01-start");
    await press('#twCard [data-act="begin"]');
    await wait(200);
    st = await S();
    if (st.card === "age") await press('#twCard [data-act="cont"]');
    await wait(300);
    st = await S();
    if (st.card) throw new Error("a card is still up: " + st.card);
    note("began: Normal, first town " + wantFt + ", next: " + st.next);
    await shot("02-begin");
  } catch (e) { fail("opening", e.message); await shot("fail-opening"); await finish(); return; }

  // ---- 4x: hold the speed button 0.8 s ----
  async function speed4() {
    await press("#twSpeed", 1000);
    await wait(100);
    const s = await S();
    if (s.speed !== "4x") { fail("speed", "hold did not give 4x: " + s.speed); return false; }
    return true;
  }

  // a legal site for a type near an anchor, whose tap point hits the map canvas (not the HUD) and whose
  // ghost buttons will fit; returns the tile to tap and the ghost's top-left
  const findSite = (type, ax, ay, rmin, rmax, extra) => ev(([type, ax, ay, rmin, rmax, extra]) => {
    const T = Town.test, g = T.G, sz = type === "wonder" ? [5, 5] : TW.DATA.BLD[type].size, cv = document.querySelector("#twMap");
    const arrows = (T.perf().arrows || []).map(o => { const r = cv.getBoundingClientRect(); return { x: r.left + o.x, y: r.top + o.y }; });
    const hits = (x, y) => { const e = document.elementFromPoint(x, y); return e === cv && !arrows.some(o => Math.hypot(o.x - x, o.y - y) < 40); };   // a raid arrow on the canvas takes taps too
    const out = [];
    for (let d = rmin; d <= rmax; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const x = ax + dx, y = ay + dy, r = TW.canPlace(g, type, x, y, 0);
      if (!r.ok) continue;
      if (extra === "fert" && !g.map.fert[(y + 1) * 64 + x + 1]) continue;
      // keep a lane free around the palace's door and the other buildings (one tile)
      const bs = b => (b.k === "wonder" ? [5, 5] : b.k === "gate" ? (b.rot ? [1, 2] : [2, 1]) : TW.DATA.BLD[b.k].size);
      if (type !== "field" && g.blds.some(b => !b.dead && b.k !== "field" && b.k !== "wall" && x < b.x + bs(b)[0] + 1 && x + sz[0] > b.x - 1 && y < b.y + bs(b)[1] + 1 && y + sz[1] > b.y - 1)) continue;
      const tx = x + Math.floor((sz[0] - 1) / 2), ty = y + Math.floor((sz[1] - 1) / 2), p = T.client(tx, ty);
      const a = T.client(x - 1, y - 1), e = T.client(x + sz[0], y + sz[1]);
      if (!(hits(p.x, p.y) && hits(a.x, a.y) && hits(e.x, e.y) && hits(a.x, e.y) && hits(e.x, a.y))) continue;
      if (a.x < 40 || e.x > innerWidth - 40 || a.y < 40 || e.y > innerHeight - 40) continue;
      out.push({ x, y, tx, ty, px: p.x, py: p.y, d });
      if (out.length > 6) return out[0];
    }
    return out[0] || null;
  }, [type, ax, ay, rmin, rmax, extra || ""]);
  const anyLegal = (type, ax, ay, rmax, extra) => ev(([type, ax, ay, rmax, extra]) => {
    const g = Town.test.G; let best = null, bd = 1e9;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) {
      const d = Math.max(Math.abs(x - ax), Math.abs(y - ay)); if (d > rmax || d >= bd) continue;
      if (extra === "fert" && !g.map.fert[(y + 1) * 64 + x + 1]) continue;
      if (TW.canPlace(g, type, x, y, 0).ok) { best = { x, y }; bd = d; }
    }
    return best;
  }, [type, ax, ay, rmax, extra || ""]);
  // the camera to a tile, by a one-finger drag on the map (from the middle of the map area)
  async function panTo(x, y) {
    const q = await ev(([x, y]) => { const T = Town.test, L = T.layout(), p = T.client(x, y); return { cx: L.w / 2, cy: (L.area.t + L.area.b) / 2, p }; }, [x, y]);
    const dx = q.cx - q.p.x, dy = q.cy - q.p.y;
    if (Math.abs(dx) + Math.abs(dy) < 40) return;
    // start on a point of the map that the canvas gets
    const start = await ev(([cx, cy]) => { const cv = document.querySelector("#twMap"); for (let r = 0; r < 300; r += 20) for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const e = document.elementFromPoint(cx + ox, cy + oy); if (e === cv) return { x: cx + ox, y: cy + oy }; } return null; }, [q.cx, q.cy]);
    if (!start) throw new Error("no free map point to drag");
    const steps = 10, m = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 350));
    for (let k = 0; k < m; k++) {
      await touch("touchStart", [{ x: start.x, y: start.y }]);
      for (let i = 1; i <= steps; i++) { await touch("touchMove", [{ x: start.x + dx / m * i / steps, y: start.y + dy / m * i / steps }]); await wait(16); }
      await wait(120);   // a still finger at the end: no inertia
      await touch("touchEnd", []);
      await wait(150);
    }
    stats.pan = (stats.pan || 0) + 1;
  }
  // place a building by touch: its button, a tap on the site (the ghost moves there), the check
  async function place(type, ax, ay, rmin, rmax, extra) {
    let site = await findSite(type, ax, ay, rmin, rmax, extra);
    if (!site) {
      const far = await anyLegal(type, ax, ay, rmax + 6, extra);
      if (!far) return "nosite";
      await panTo(far.x, far.y);
      site = await findSite(type, far.x, far.y, 0, 6, extra);
      if (!site) return "nosite-onscreen";
    }
    await press('@build:' + type);
    await wait(120);
    let s = await S();
    if (s.mode !== "place" || !s.ghost) { if (s.mode === "place") await tryPress("@ghostX"); throw new Error("no ghost after the " + type + " button (mode " + s.mode + ", call " + s.call + ")"); }
    // the ghost's own buttons may cover the site now: look again, as a player would, with the ghost up
    const site2 = await findSite(type, site.x, site.y, 0, 8, extra);
    if (!site2) { await tryPress("@ghostX"); throw new Error(type + ": no free site on screen with the ghost up"); }
    site = site2;
    const p = await ev(([tx, ty]) => Town.test.client(tx, ty), [site.tx, site.ty]);
    await tapXY(p.x, p.y);
    await wait(380);   // past the double-tap window
    s = await S();
    if (!s.ghost || s.ghost.x !== site.x || s.ghost.y !== site.y) {
      await tryPress("@ghostX");
      throw new Error(type + ": the ghost is not on the site after a tap: " + JSON.stringify([s.ghost && [s.ghost.x, s.ghost.y], [site.x, site.y]]));
    }
    if (!s.ghost.ok) { await tryPress("@ghostX"); throw new Error(type + " ghost red: " + s.call); }
    const n0 = s.blds.filter(b => b.k === type).length;
    await press("@ghostOk");
    await wait(150);
    s = await S();
    if (s.mode === "place") await tryPress("@ghostX");   // a Place another may linger
    const n1 = s.blds.filter(b => b.k === type).length;
    if (n1 <= n0) throw new Error(type + ": no foundation after the check (call: " + s.call + ")");
    stats["place:" + type] = (stats["place:" + type] || 0) + 1;
    return "ok";
  }
  // the dock's + for a resource
  const DOCKN = { f: "Food", w: "Wood", s: "Stone", g: "Goods" };
  async function dockPlus(r) { await press("@dock" + DOCKN[r] + "+"); }
  async function dockMinus(r) { await press("@dock" + DOCKN[r] + "-"); }
  async function closePanels() {
    const s = await S();
    if (s.sheet) await tryPress('#twSheet [data-a="close"]');
    if (s.garOpen) await tryPress("#twShield");
    if (s.info) await tryPress('#twInfo [data-a="close"]');
  }
  async function advance() {
    await closePanels();
    await press("#twAge");
    await wait(150);
    let s = await S();
    if (s.sheet !== "age") throw new Error("the age sheet did not open");
    const q = await reach('#twSheet [data-a="advance"]');
    if (!q.x) {
      // the sheet scrolls: a finger drag inside it brings the button into view
      const sb = await ev(() => { const r = document.querySelector("#twSheet").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; });
      await touch("touchStart", [{ x: sb.x, y: sb.y + sb.h / 4 }]);
      for (let i = 1; i <= 8; i++) { await touch("touchMove", [{ x: sb.x, y: sb.y + sb.h / 4 - i * 20 }]); await wait(16); }
      await touch("touchEnd", []); await wait(200);
    }
    const q2 = await press('#twSheet [data-a="advance"]');
    await wait(200);
    s = await S();
    await tryPress('#twSheet [data-a="close"]');
    if (!s.aging) throw new Error("the advance did not start (button " + JSON.stringify(q2) + ", call " + s.call + ")");
  }
  // a button in the age sheet: open it, scroll it by finger until the button is reachable, tap it, close it
  async function sheetAct(act) {
    await closePanels();
    await press("#twAge");
    await wait(150);
    if ((await S()).sheet !== "age") throw new Error("the age sheet did not open");
    for (let k = 0; k < 14; k++) {
      const q = await reach('#twSheet [data-a="' + act + '"]');
      if (q.x) break;
      if (q.why === "missing") { await tryPress('#twSheet [data-a="close"]'); throw new Error("no " + act + " in the sheet"); }
      const sb = await ev(() => { const r = document.querySelector("#twSheet").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; });
      await touch("touchStart", [{ x: sb.x, y: sb.y + sb.h / 4 }]);
      for (let i = 1; i <= 8; i++) { await touch("touchMove", [{ x: sb.x, y: sb.y + sb.h / 4 - i * 25 }]); await wait(16); }
      await touch("touchEnd", []); await wait(250);
      stats.sheetScroll = (stats.sheetScroll || 0) + 1;
    }
    const q = await press('#twSheet [data-a="' + act + '"]');
    await wait(150);
    await tryPress('#twSheet [data-a="close"]');
    if (q.off) throw new Error(act + " is marked unavailable");
    return "ok";
  }
  // a building's info panel by a tap on it (its middle), then an action there n times
  async function bldAct(id, act, n) {
    await closePanels();
    const b = (await S()).blds.find(x => x.id === id);
    if (!b) throw new Error("no building " + id);
    const sz = await ev(k => (k === "wonder" ? [5, 5] : TW.DATA.BLD[k].size), b.k);
    let p = await ev(([x, y]) => { const T = Town.test, c = T.client(x, y), e = document.elementFromPoint(c.x, c.y); return { x: c.x, y: c.y, ok: e === document.querySelector("#twMap") }; }, [b.x + sz[0] / 2 - 0.5, b.y + sz[1] / 2]);
    if (!p.ok) { await panTo(b.x + sz[0] / 2, b.y + sz[1] / 2); p = await ev(([x, y]) => Town.test.client(x, y), [b.x + sz[0] / 2 - 0.5, b.y + sz[1] / 2]); }
    await tapXY(p.x, p.y);
    await wait(380);
    for (let i = 0; i < n; i++) { const q = await reach('#twInfo [data-a="' + act + '"]'); if (!q.x) { await tryPress('#twInfo [data-a="close"]'); throw new Error("no " + act + " in the panel: " + q.why); } if (q.off) break; await press('#twInfo [data-a="' + act + '"]'); await wait(60); }
    await tryPress('#twInfo [data-a="close"]');
  }
  async function trainSpear(n) {
    await closePanels();
    await press("#twShield");
    await wait(150);
    for (let i = 0; i < n; i++) await press('#twGar [data-a="gtrain:spear"]');
    await wait(100);
    await tryPress("#twShield");
  }
  // the palace's info panel: auto-train on or off, by a tap on the palace
  async function setAuto(on) {
    await closePanels();
    const s = await S();
    const tc = s.blds.find(b => b.k === "tc");
    const p = await ev(([x, y]) => { const T = Town.test, c = T.client(x, y), e = document.elementFromPoint(c.x, c.y); return { x: c.x, y: c.y, ok: e === document.querySelector("#twMap") }; }, [tc.x + 1, tc.y + 2]);
    if (!p.ok) { await panTo(tc.x + 2, tc.y + 2); }
    const p2 = await ev(([x, y]) => Town.test.client(x, y), [tc.x + 1, tc.y + 2]);
    await tapXY(p2.x, p2.y);
    await wait(380);
    const q = await reach('#twInfo [data-a="auto"]');
    if (!q.x) throw new Error("no auto-train button in the palace's panel: " + q.why);
    const pressed = await ev(() => document.querySelector('#twInfo [data-a="auto"]').getAttribute("aria-pressed"));
    if ((pressed === "true") !== on) await press('#twInfo [data-a="auto"]');
    await wait(100);
    const now = (await S()).tc.auto;
    await tryPress('#twInfo [data-a="close"]');
    if (!!now !== on) throw new Error("auto-train did not turn " + (on ? "on" : "off"));
  }

  // ---- the coached opening (first town): House, Field, Storehouse, a worker move ----
  const coached = process.env.FIRST !== "0";
  st = await S();
  const tcx = st.tc.x, tcy = st.tc.y;
  const near = (k, s) => { const n = s.blds.filter(b => b.k === k); return n.length; };
  async function attempt(name, fn) {
    try { const r = await fn(); if (r && r !== "ok") { fail(name, r); return false; } note("ok   " + name); return true; }
    catch (e) { fail(name, e.message.split("\n")[0]); await shot("fail-" + name.replace(/\W+/g, "_")); await closePanels().catch(() => {}); return false; }
  }
  if (coached) {
    await attempt("coached: " + st.next, () => place("house", tcx + 1, tcy + 1, 4, 9));
    st = await S(); note("next: " + st.next);
    const fz = await anyLegal("field", tcx, tcy, 30, "fert");
    await attempt("coached: " + st.next, () => place("field", fz.x, fz.y, 0, 6, "fert"));
    st = await S(); note("next: " + st.next);
    const tree = await ev(([x, y]) => { const g = Town.test.G; return g.nodes.filter(n => n.k === "tree" && !n.dead).sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - (b.x - x) ** 2 - (b.y - y) ** 2)[0]; }, [tcx, tcy]);
    await attempt("coached: " + st.next, () => place("store", tree.x, tree.y, 1, 6));
    st = await S(); note("next: " + st.next);
    await attempt("coached: " + st.next, async () => { await dockPlus("s"); await wait(200); });
    st = await S(); note("next after the coached steps: " + st.next + " | raids: " + (await ev(() => JSON.stringify(TW.raidInfo(Town.test.G).held))));
    await shot("03-coached");
  }
  if (!(await speed4())) await press("#twSpeed");   // fall back to 2x

  // ---- the game: a simple sensible player, one action per look ----
  const full = {};
  let lastAct = Date.now(), lastNext = "", nextSince = 0, lastLabor = 0, autoOff = false, sp = 0;
  const nextLog = [];
  const cooldown = {};
  const ready = (k, ms) => { const t = Date.now(); if ((cooldown[k] || 0) > t) return false; cooldown[k] = t + ms; return true; };
  let lastGameMin = 0, staleLooks = 0;
  for (let look = 0; look < 6000; look++) {
    const s = await S();
    if (s.noG) { fail("game", "no game (card " + s.card + ")"); break; }
    if (s.next !== lastNext) { nextLog.push(s.min.toFixed(1) + " " + s.next); lastNext = s.next; nextSince = s.min; }
    if (s.min === lastGameMin && !s.card) { if (++staleLooks > 40) { fail("clock", "the game clock does not move (held " + s.held + ")"); break; } } else staleLooks = 0;
    lastGameMin = s.min;
    if (s.over) { note("game over: " + JSON.stringify(s.over)); break; }
    if (s.min > MAXMIN) { note("time cap " + MAXMIN + " min"); break; }
    if (GOAL === "opening" && s.min > 3) break;
    if (s.age >= 2 && !age2At) { age2At = s.min; note("AGE 2 at " + s.min.toFixed(2) + " min"); await shot("05-age2"); }
    if (GOAL === "age2" && age2At && s.min > age2At + 2) break;
    // cards first: every card must have a way on
    if (s.card) {
      const acts = await ev(() => Array.from(document.querySelectorAll("#twCard [data-act]")).map(b => b.dataset.act));
      note("card " + s.card + " buttons " + acts.join(","));
      if (!acts.length) { fail("card", s.card + " has no button"); break; }
      if (s.card === "age") { await shot("04-agecard"); await press('#twCard [data-act="cont"]'); }
      else if (s.card === "pause") await press('#twCard [data-act="resume"]');
      else if (s.card === "win" || s.card === "lose") { await shot("09-" + s.card); break; }
      else await press('#twCard [data-act="' + acts[0] + '"]');
      await wait(200);
      if (s.card === "age" && !(await S()).card) { if ((await S()).speed !== "4x") await speed4(); }
      continue;
    }
    if (s.mode !== "none") { note("mode " + s.mode + " left over: cancel"); await tryPress("@ghostX"); await wait(100); continue; }
    if (s.min - nextSince > 1.0 && !s.next) { fail("next", "the Next line is empty at " + s.min.toFixed(1)); nextSince = s.min; }
    const r = s.res, has = k => s.blds.some(b => b.k === k && b.done >= 1), some = k => s.blds.some(b => b.k === k);
    const building = k => s.blds.some(b => b.k === k && b.done < 1);
    const room = s.popCap - s.pop;
    let did = false;
    // 1. the advance
    if (s.age === 1 && !s.aging && has("store") && has("barracks") && r.f >= 350 && r.g >= 80 && ready("advance", 3000)) {
      did = await attempt("advance to Age 2 at " + s.min.toFixed(1), advance);
      if (did && autoOff) { await attempt("auto-train back on", () => setAuto(true)); autoOff = false; }
    }
    // saving for the advance: the palace stops training villagers once the rest stands
    else if (s.age === 1 && !s.aging && has("store") && has("barracks") && s.vil >= 20 && !autoOff && s.tc.auto && ready("auto", 4000)) {
      did = await attempt("auto-train off (saving food for the advance)", () => setAuto(false)); if (did) autoOff = true;
    }
    // 2. houses
    else if (room <= 3 && s.popCap < 60 && !building("house") && r.w >= 15 && r.s >= 20 && ready("house", 2500)) {
      did = await attempt("house at " + s.min.toFixed(1) + " (pop " + s.pop + "/" + s.popCap + ")", () => place("house", tcx + 1, tcy + 1, 4, 12));
    }
    // 3. a storehouse by the trees, if none
    else if (!some("store") && r.w >= 60 && ready("store", 3000)) {
      const tree = await ev(([x, y]) => { const g = Town.test.G; return g.nodes.filter(n => n.k === "tree" && !n.dead).sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - (b.x - x) ** 2 - (b.y - y) ** 2)[0]; }, [tcx, tcy]);
      did = await attempt("store by the trees", () => place("store", tree.x, tree.y, 1, 6));
    }
    // 4. fields: 2 plus one per 5 villagers, up to 8
    else if (s.blds.filter(b => b.k === "field").length < Math.min(12, 2 + Math.floor(s.vil / 4)) && r.w >= (some("barracks") ? 35 : 125) && !building("field") && ready("field", 2500)) {
      const fz = await anyLegal("field", tcx, tcy, 30, "fert");
      did = fz ? await attempt("field at " + s.min.toFixed(1), () => place("field", fz.x, fz.y, 0, 6, "fert")) : false;
    }
    // 5. the barracks
    else if (!some("barracks") && s.vil >= 10 && r.w >= 100 && r.s >= 50 && ready("barracks", 3000)) {
      did = await attempt("barracks at " + s.min.toFixed(1), () => place("barracks", tcx + 1, tcy + 1, 5, 12));
    }
    // 6. a storehouse by the stone in Age 2
    else if (s.age >= 2 && s.blds.filter(b => b.k === "store").length < 2 && r.w >= 60 && ready("store2", 4000)) {
      const stn = await ev(([x, y]) => { const g = Town.test.G; return g.nodes.filter(n => (n.k === "stone" || n.k === "ore") && !n.dead).sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - (b.x - x) ** 2 - (b.y - y) ** 2)[0]; }, [tcx, tcy]);
      did = stn ? await attempt("store by the stone", () => place("store", stn.x, stn.y, 1, 6)) : false;
    }
    // 7. Age 2: a market
    else if (s.age >= 2 && !some("market") && r.w >= 120 && r.s >= 60 && ready("market", 4000)) {
      did = await attempt("market at " + s.min.toFixed(1), () => place("market", tcx + 1, tcy + 1, 5, 14));
    }
    // 7b. the win: smithy, temple, Clamped Masonry, then the Temple of Garni on a bluff with 12 builders
    else if (GOAL === "win" && s.age >= 2 && !some("smithy") && r.w >= 80 && r.s >= 40 && ready("smithy", 4000)) {
      did = await attempt("smithy at " + s.min.toFixed(1), () => place("smithy", tcx + 1, tcy + 1, 5, 14));
    }
    else if (GOAL === "win" && s.age >= 2 && !some("temple") && r.w >= 50 && r.s >= 120 && ready("temple", 4000)) {
      did = await attempt("temple at " + s.min.toFixed(1), () => place("temple", tcx + 1, tcy + 1, 5, 14));
    }
    else if (GOAL === "win" && s.age >= 2 && has("smithy") && !s.techs.clamped_masonry && !s.researching && r.s >= 150 && r.g >= 150 && ready("cm", 5000)) {
      did = await attempt("Clamped Masonry from the age sheet at " + s.min.toFixed(1), () => sheetAct("tech:clamped_masonry"));
    }
    else if (GOAL === "win" && s.age === 2 && !some("wonder") && has("temple") && s.techs.clamped_masonry && r.w >= 300 && r.s >= 750 && r.g >= 300 && ready("wonder", 5000)) {
      const site = await anyLegal("wonder", tcx, tcy, 60);
      did = site ? await attempt("Temple of Garni at " + s.min.toFixed(1), () => place("wonder", site.x, site.y, 0, 4)) : (fail("wonder", "no legal site"), false);
    }
    else if (GOAL === "win" && s.blds.some(b => b.k === "wonder" && b.done < 1 && b.nb < 12) && ready("builders", 6000)) {
      const w = s.blds.find(b => b.k === "wonder");
      did = await attempt("builders on the wonder (" + w.nb + ")", () => bldAct(w.id, "bld:1", 12 - w.nb));
    }
    // 8. a small garrison once the barracks stands
    else if (has("barracks") && s.gar < 3 + Math.min(5, Math.floor(s.raids / 2)) && r.f >= 120 && (s.age > 1 || s.aging || r.f >= 400) && ready("spear", 8000)) {
      did = await attempt("2 spearmen from the shield chip", () => trainSpear(2));
    }
    // 9. labor by the dock: food first, wood for building, a little stone, goods until the advance's 80
    else if (Date.now() - lastLabor > 2500) {
      lastLabor = Date.now();
      const L = s.L, n = L.f + L.w + L.s + L.g + L.idle;
      const want = { f: 0.5, w: 0.33, s: 0.1, g: s.age === 1 && r.g < 90 ? 0.07 : s.age >= 2 ? 0.07 : 0 };
      if (s.age === 1 && has("barracks") && r.f < 350) { want.f = 0.62; want.w = 0.22; }
      if (GOAL === "win" && s.age >= 2) { want.f = 0.36; want.w = 0.2; want.s = 0.3; want.g = 0.14; }
      // the resources by their gap, biggest first; one that had no free work a moment ago waits 20 s
      const order = ["f", "w", "s", "g"].map(k => [k, want[k] * n - L[k]]).filter(([k, g]) => g > 0.6 && !(full[k] > Date.now())).sort((a, b) => b[1] - a[1]);
      for (const [best] of order) {
        const before = L[best];
        const ok = await attempt("dock + " + best + " (" + JSON.stringify({ f: L.f, w: L.w, s: L.s, g: L.g, idle: L.idle }) + ")", () => dockPlus(best));
        if (!ok) break;
        await wait(150);
        const a = await S();
        if (a.L[best] > before) { did = true; break; }
        full[best] = Date.now() + 20000;
        note("     (the dock's + on " + best + " moved nobody; the call line says: " + a.call + ")");
        // a player builds work for the idle: a field for food
        if (best === "f" && a.L.idle >= 2) { const fz = await anyLegal("field", tcx, tcy, 30, "fert"); if (fz && a.res.w >= 25) { did = await attempt("field for the idle", () => place("field", fz.x, fz.y, 0, 6, "fert")); break; } }
      }
    }
    if (did) lastAct = Date.now();
    if ((look % 40) === 0) note("t " + s.min.toFixed(1) + " age " + s.age + (s.aging ? "+" : "") + " vil " + s.vil + " gar " + s.gar + " pop " + s.pop + "/" + s.popCap + " res " + [r.f, r.w, r.s, r.g].map(Math.floor).join("/") + " raids " + s.raids + " fallen " + JSON.stringify(s.fallen) + " | " + s.next);
    if ((look % 150) === 75) await shot("p" + String(Math.floor(s.min)).padStart(2, "0"));
    await wait(did ? 150 : 400);
  }
  const s = await S();
  note("END t " + (s.min || 0).toFixed(2) + " age " + s.age + " vil " + s.vil + " fallen " + JSON.stringify(s.fallen) + " over " + JSON.stringify(s.over));
  await shot("10-end");
  // the end card, if the game ended: its buttons, then back to the map
  try {
    await wait(600);
    const c0 = (await S()).card;
    if (c0) {
      const acts = await ev(() => Array.from(document.querySelectorAll("#twCard [data-act]")).map(b => b.dataset.act + ":" + b.textContent.trim()));
      note("end card " + c0 + ": " + acts.join(" | ") + " | text: " + (await ev(() => document.querySelector("#twCard").innerText.replace(/\s+/g, " ").slice(0, 400))));
      await shot("09-endcard");
      if (acts.some(a => a.startsWith("back:"))) { await press('#twCard [data-act="back"]'); await wait(300); const o = await ev(() => Town.isOpen()); if (o) fail("end card", "Back to map left the town open"); else note("end card: back to the map"); }
      const bless = await ev(() => { try { return localStorage.getItem("hs_town_bless"); } catch (e) { return "storage throws"; } });
      note("blessing stored: " + bless);
    }
  } catch (e) { fail("end card", e.message); }
  // leave by the leave button: the card, then the map
  if (await ev(() => Town.isOpen())) try {
    await closePanels();
    await press("#twLeave"); await wait(200);
    const c = (await S()).card;
    if (c === "leave") await press('#twCard [data-act="leave"]');
    await wait(300);
    const open = await ev(() => Town.isOpen());
    if (open) fail("leave", "the town is still open"); else note("left the town to the map");
    const saved = await ev(() => { try { return !!localStorage.getItem("hs_town_run"); } catch (e) { return "storage throws"; } });
    note("saved run after leaving: " + saved);
  } catch (e) { fail("leave", e.message); }
  s.age2At = age2At;
  await finish(s, nextLog);
  async function finish(sx, nl) {
    const out = { W, H, goal: GOAL, age2At, end: sx ? { min: +(sx.min || 0).toFixed(2), age: sx.age, vil: sx.vil, fallen: sx.fallen, over: sx.over } : null, fails, errs, stats, nextLog: nl };
    fs.writeFileSync(SHOTS + "/" + TAG + ".json", JSON.stringify(out, null, 1));
    fs.writeFileSync(SHOTS + "/" + TAG + ".log", log.join("\n"));
    console.log("RESULT " + JSON.stringify({ W, H, goal: GOAL, age2At: +age2At.toFixed(2), fails: fails.length, errs: errs.length, end: out.end }));
    await b.close();
    process.exitCode = fails.length || errs.length || (GOAL !== "opening" && !age2At) ? 1 : 0;
  }
})();
