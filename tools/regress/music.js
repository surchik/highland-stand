// The owner's recordings (stage 6, docs/specs/owner-requests-stage6.md sections 2, 4 and 5): the battle music from
// assets/music/ and the victory dance's from assets/victory/, played as a player meets them, over http (the page and
// the files served from the repository, the recordings joined to the Web Audio graph) and from file:// (the
// element's own volume). It holds the page to:
// - nothing of assets/ asked for by a plain load, the map, the chronicle, the trailer, the Hall or Settings;
// - a battle begun by its button asks for its battlefield's own tune (its number among the five, the next one when
//   that was the tune heard last), and once it plays the generated music is turned down (Snd.musGain at 0); a
//   battle tune that ends goes on to the next one; the battle paused pauses it, Settings opened in battle does not
//   (its volume must be heard), the Music switch off pauses it and on takes it up; the Music slider sets its level;
// - the victory: one of the two recordings, in turn from victory to victory (hs_vic_rec), the battle's tune faded,
//   the dancers stepping at the recording's measured tempo, the dance held DANCE_MAX_MS (twice the old 21.6 s), a
//   tap after DANCE_MIN_MS still leaving at once, and the recording faded as the page comes;
// - a defeat fades the battle's tune; leaving a battle by Abandon stops it; the map, the chronicle and the
//   trailer play none;
// - a file that cannot load (answered 404): the generated music stays, and a victory then dances to the generated
//   band (Snd.danceBus);
// - the pointer: the cross over a battle only; the arrow over the dance, the victory page and the map.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/music.js [index.html] [--quick] [--verbose]
"use strict";
const R = require("./lib");
const http = require("http");
const fs = require("fs");
const path = require("path");
const o = R.cli();
const t0 = Date.now();
const fails = [];
const fail = (w, m) => { fails.push(w + ": " + m); console.log("FAIL " + w + ": " + m); };
const log = (...a) => { if (o.verbose) console.log(...a); };

// the page and the repository's assets over http, as the live web root serves them; /missing/ answers 404 for the
// recordings (a file that cannot load)
function serve(file) {
  const root = path.dirname(file);
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let miss = false;
    if (p.startsWith("/missing/")) { miss = true; p = p.slice("/missing".length); }
    if (p === "/" || p === "") p = "/" + path.basename(file);
    if (miss && /^\/assets\//.test(p)) { res.writeHead(404); res.end(); return; }
    const f = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    const type = /\.html$/.test(f) ? "text/html; charset=utf-8" : /\.mp3$/.test(f) ? "audio/mpeg" : /\.jpg$/.test(f) ? "image/jpeg" : /\.mp4$/.test(f) ? "video/mp4" : /\.webm$/.test(f) ? "video/webm" : "application/octet-stream";
    const st = fs.statSync(f), range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
    if (range) {
      const a = +range[1], b = range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { "content-type": type, "content-range": "bytes " + a + "-" + b + "/" + st.size, "accept-ranges": "bytes", "content-length": b - a + 1 });
      fs.createReadStream(f, { start: a, end: b }).pipe(res);
      return;
    }
    res.writeHead(200, { "content-type": type, "content-length": st.size, "accept-ranges": "bytes" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, "127.0.0.1", () => ok({ srv, base: "http://127.0.0.1:" + srv.address().port })));
}

(async () => {
  const { srv, base } = await serve(o.file);
  const browser = await R.launch({ audio: true });
  const C = R.SIZES.desk;
  // one page: over http (via: graph) or file:// (via: element). prefix: "/missing" for the 404 case
  const open = async (where, prefix) => {
    const g = await R.openGame(browser, o.file, Object.assign({}, C, { storage: { hs_trailer_seen: "1" } }));
    g.asked = [];
    g.page.on("request", r => { const u = r.url(); if (/\/assets\/(music|victory)\//.test(u)) g.asked.push(u.replace(/^.*\/assets\//, "assets/").replace(/#.*$/, "")); });
    if (where === "http") {
      await g.page.goto(base + (prefix || "") + "/", { timeout: 120000 });
      await g.page.waitForFunction(() => typeof menuMode !== "undefined" && typeof Town !== "undefined" && document.readyState === "complete", null, { timeout: 120000 });
      await g.frames(3);
    }
    g.where = where + (prefix ? prefix : "");
    return g;
  };
  const st = (g) => g.ev(() => {
    const c = Rec.ch.battle, v = Rec.ch.victory;
    return { hold: Rec.hold, ok: Rec.ok, last: Rec.lastBattle, mus: Snd.musGain ? +Snd.musGain.gain.value.toFixed(4) : null,
      b: c ? { want: c.want, idx: c.idx, playing: c.playing, paused: c.el.paused, t: c.el.currentTime, vol: c.el.volume, gain: c.gain ? +c.gain.gain.value.toFixed(4) : null, src: c.el.src.replace(/^.*\/assets\//, "assets/") } : null,
      v: v ? { want: v.want, idx: v.idx, playing: v.playing, paused: v.el.paused, t: v.el.currentTime, src: v.el.src.replace(/^.*\/assets\//, "assets/") } : null,
      aim: canvas.classList.contains("aim"), cursor: getComputedStyle(canvas).cursor, cele: !!celebration, rec: celebration && celebration.rec ? celebration.rec.id : null };
  });
  const until = async (g, fn, ms, what) => {
    const end = Date.now() + ms;
    for (;;) {
      const s = await st(g);
      if (fn(s)) return s;
      if (Date.now() > end) { fail(g.where, what + " " + JSON.stringify(s)); return null; }
      await g.wait(100);
    }
  };

  // the openings (no file needed): ten tunes, every battlefield its own opening, a lament only on a field of loss or
  // siege, never the tune heard last, and never a lament in a brighter one's stead
  {
    const g = await R.openGame(browser, o.file, Object.assign({}, C, { storage: { hs_trailer_seen: "1" } }));
    const r = await g.ev(() => {
      const LOSS = ["avarayr", "sis", "shushi", "stepanakert23"], out = { n: REC_BATTLE.length, bad: [] };
      LEVELS.forEach((L, i) => {
        Rec.lastBattle = -1;
        const k = Rec.battleFirst(i);
        if (!REC_BATTLE[k]) out.bad.push(L.id + " opens on nothing");
        else if (REC_BATTLE[k].lament && !LOSS.includes(L.id)) out.bad.push(L.id + " opens on the lament " + REC_BATTLE[k].id);
        Rec.lastBattle = k;
        const k2 = Rec.battleFirst(i);
        if (k2 === k || REC_BATTLE[k2].lament) out.bad.push(L.id + " after its own tune opens on " + REC_BATTLE[k2].id);
      });
      Rec.lastBattle = -1;
      out.avarayr = REC_BATTLE[Rec.battleFirst(LEVELS.findIndex(L => L.id === "avarayr"))].id;
      out.files = REC_BATTLE.map(x => x.file);
      return out;
    });
    if (r.n !== 10) fail("openings", "there are " + r.n + " battle tunes, not ten");
    for (const b of r.bad) fail("openings", b);
    if (r.avarayr !== "vartani-mor-vokhbe") fail("openings", "Avarayr opens on " + r.avarayr);
    for (const f of r.files) if (!fs.existsSync(path.join(path.dirname(o.file), f))) fail("openings", "no file " + f);
    await g.close();
  }
  for (const where of o.quick ? ["http"] : ["http", "file"]) {
    const g = await open(where);
    const W = g.where;
    // a plain load, the map, the chronicle, Settings: nothing asked
    await g.toMap();
    await g.ev(() => { localStorage.setItem("hs_tutorial_done", "1"); testUnlockAll = true; openCampaignMap(2); selectMapLevel(2); showBrief(); });
    await g.frames(3);
    await g.press("#ovGear"); await g.frames(2); await g.ev(() => closeSettings());
    if (g.asked.length) fail(W, "the map or the chronicle asked for " + g.asked.join(", "));
    let s = await st(g);
    if (s.aim || s.cursor !== "default") fail(W, "the pointer over the chronicle is " + s.cursor);
    // a battle: Avarayr (index 2) opens on tune 2
    const want = await g.ev(() => Rec.battleFirst(2));
    await g.enterBattle(2);
    s = await until(g, x => x.b && x.b.playing && x.hold, 8000, "the battle's tune never began");
    if (s) { await g.wait(2500); s = await st(g); }
    if (s) {
      if (s.b.idx !== want || !s.b.src.startsWith(await g.ev(i => REC_BATTLE[i].file, want))) fail(W, "Avarayr's battle plays " + s.b.src + ", not its own tune " + want);
      if (s.mus > 0.01) fail(W, "the generated music is not turned down under the recording: " + s.mus);
      if (!s.aim || s.cursor !== "crosshair") fail(W, "the pointer over the battle is " + s.cursor);
      if (where === "http" && !(s.b.gain > 0)) fail(W, "over http the tune is not on the graph: " + JSON.stringify(s.b));
      if (where === "file" && !(s.b.vol > 0 && s.b.vol <= 1)) fail(W, "on file:// the tune has no volume: " + s.b.vol);
      // the Music slider: lower, then back
      const lv0 = await g.ev(() => Rec.level("battle", Rec.ch.battle.idx));
      await g.ev(() => { Snd.musVol = 0.3; Snd.applyVolumes(); });
      const lv1 = await g.ev(() => Rec.level("battle", Rec.ch.battle.idx));
      if (!(lv1 < lv0 * 0.5)) fail(W, "the Music slider does not lower the tune: " + lv0 + " -> " + lv1);
      await g.ev(() => { Snd.musVol = 0.75; Snd.applyVolumes(); });
      // paused: the tune waits; Settings in battle: it plays on
      await g.ev(() => togglePause()); await g.frames(3);
      s = await until(g, x => x.b.paused, 3000, "the battle paused, its tune plays on");
      await g.ev(() => togglePause()); await g.frames(3);
      s = await until(g, x => !x.b.paused, 3000, "the battle resumed, its tune stays paused");
      await g.ev(() => openSettings()); await g.frames(4);
      s = await st(g);
      if (s.b.paused) fail(W, "Settings opened in battle paused the tune (its volume could not be heard)");
      await g.ev(() => closeSettings());
      // the Music switch
      await g.ev(() => toggleMusic()); await g.frames(3);
      s = await until(g, x => x.b.paused, 3000, "the Music switch off, the tune plays on");
      await g.ev(() => toggleMusic()); await g.frames(3);
      s = await until(g, x => !x.b.paused, 3000, "the Music switch on again, the tune stays paused");
      // a tune that ends: the next one
      const t1 = await g.ev(() => { const el = Rec.ch.battle.el; el.currentTime = Math.max(0, el.duration - 0.6); return Rec.ch.battle.idx; });
      s = await until(g, x => x.b.idx === (t1 + 1) % 10 && x.b.playing, 8000, "a tune that ended did not go on to the next");
    }
    // the victory: the next recording in turn, the battle's tune faded, the dancers at its tempo
    const first = await g.ev(() => { try { return (Number(localStorage.getItem("hs_vic_rec")) | 0) % REC_VICTORY.length; } catch (e) { return 0; } });
    await g.ev(() => { lives = 17; waveIdx = totalWaves(); phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
    s = await until(g, x => x.cele, 8000, "no victory came");
    if (s) {
      const vs = await until(g, x => x.v && x.v.playing, 8000, "the victory's recording never began");
      if (vs) {
        const R0 = await g.ev(i => REC_VICTORY[i], first);
        if (vs.v.idx !== first || vs.rec !== R0.id) fail(W, "the victory plays " + vs.v.src + ", not " + R0.id + " in turn");
        if (vs.b.want) fail(W, "the battle's tune still wanted under the victory");
        if (vs.aim || vs.cursor !== "default") fail(W, "the pointer over the dance is " + vs.cursor);
        if (R0.at && vs.v.t < R0.at - 0.5) fail(W, R0.id + " began at " + vs.v.t + " s, not at its dance (" + R0.at + " s)");
        const b = await g.ev(() => { const a = celebrationBeat(); return new Promise(ok => setTimeout(() => ok([a, celebrationBeat(), Rec.victoryTime()]), 4000)); });
        const rate = (b[1] - b[0]) * 15;
        if (Math.abs(rate - R0.bpm) > R0.bpm * 0.12) fail(W, "the dancers step at " + rate.toFixed(1) + " a minute, not " + R0.bpm);
        const max = await g.ev(() => [DANCE_MAX_MS, 2 * (16 * 4 * 30 / DANCE_BPM + 1.6) * 1000]);
        if (Math.abs(max[0] - max[1]) > 1 || max[0] < 43000) fail(W, "DANCE_MAX_MS is " + max[0]);
        // a tap past DANCE_MIN_MS leaves at once
        await g.ev(() => { celebration.start -= DANCE_MIN_MS + 100; });
        await g.tapAt(800, 450);
        await g.frames(3);
        const after = await until(g, x => !x.cele && !x.v.want, 3000, "a tap after the first 10 s did not leave the dance, or the recording stays wanted");
        if (after && (after.aim || after.cursor !== "default")) fail(W, "the pointer over the victory page is " + after.cursor);
        await g.wait(3200);
        const quiet = await st(g);
        if (!quiet.v.paused) fail(W, "the victory's recording did not fade and stop with the page");
        const nx = await g.ev(() => Number(localStorage.getItem("hs_vic_rec")));
        if (nx !== (first + 1) % 2) fail(W, "the next victory's recording is " + nx + ", not the other one");
      }
    }
    // the map plays none, the trailer none
    await g.ev(() => openCampaignMap());
    await g.wait(400);
    s = await st(g);
    if (s.b.want || s.v.want || s.hold) fail(W, "the map plays a recording " + JSON.stringify(s));
    // a defeat: the tune fades
    await g.enterBattle(4);
    await until(g, x => x.b && x.b.playing, 8000, "the second battle's tune never began");
    await g.ev(() => { lives = 0; defeat(); });
    await g.page.waitForFunction(() => gameOver, null, { timeout: 10000 }).catch(() => {});
    s = await until(g, x => !x.b.want, 4000, "the defeat did not take the battle's tune away");
    await g.wait(2400);
    s = await st(g);
    if (!s.b.paused) fail(W, "the defeat's fade did not end in a pause");
    // leaving by Abandon: at once
    await g.enterBattle(6);
    await until(g, x => x.b && x.b.playing, 8000, "the third battle's tune never began");
    await g.ev(() => { abandonConfirm.arm(); $("menuBtn").click(); });
    await g.wait(1200);
    s = await st(g);
    if (s.b.want || !s.b.paused) fail(W, "Abandon left the tune playing " + JSON.stringify(s.b));
    const pr = await g.problems();
    if (pr.length) fail(W, "page problems: " + pr.join(" | "));
    log(W, "asked", g.asked.join(", "));
    await g.close();
  }

  // a file that cannot load: the generated music stays; the victory dances to the generated band
  {
    const g = await open("http", "/missing");
    const W = g.where;
    await g.toMap();
    await g.enterBattle(1);
    await g.wait(1500);
    let s = await st(g);
    if (s.hold || s.ok || !(s.mus > 0)) fail(W, "a missing file: the generated music is not back " + JSON.stringify(s));
    await g.ev(() => { lives = 17; waveIdx = totalWaves(); phase = "wave"; spawnQueue = []; enemies = []; syncHud(); });
    await until(g, x => x.cele, 8000, "no victory came");
    const d = await g.ev(() => ({ bus: !!Snd.danceBus, end: Snd.danceEnd - Snd.ctx.currentTime, rec: celebration && celebration.rec }));
    if (!d.bus || d.rec) fail(W, "a missing file: the victory has no generated band " + JSON.stringify(d));
    // the generated tune is played twice: about 43 s of it
    if (!(d.end > 38)) fail(W, "the generated dance lasts " + d.end.toFixed(1) + " s, not about twice its tune");
    const pr = (await g.problems()).filter(x => !/404|Failed to load resource/.test(x));
    if (pr.length) fail(W, "page problems: " + pr.join(" | "));
    await g.close();
  }
  await browser.close();
  srv.close();
  R.finish("music", fails, {}, t0);
})().catch(e => { console.log("FAIL music: " + (e && e.stack || e)); process.exit(1); });
