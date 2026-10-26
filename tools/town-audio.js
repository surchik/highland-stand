// Under Ararat's sound, measured (WP5, spec 11 and 15.2): renders the town's sounds, beds and music offline through
// the game's own mixer (Snd.renderOffline) and meters them as the campaign's levels were set: K-weighted (BS.1770),
// momentary (400 ms) maximum, integrated loudness for beds and music. It also plays the loudest wonder raid of a bot
// game through TWS in an offline render (the sim ticking in suspends of 0.1 s of audio time, the music and the bed
// scheduled as Snd's own timer would) and counts the engine's voices, and walks every way out of the town.
// Usage:  NODE_PATH=$(npm root -g) node tools/town-audio.js [mode ...]   (GAME=path/index.html, N=renders per sound,
//         ONLY=regex: levels of the matching sounds only, with build and the horns)
//   levels  the tw sounds by age and variant against the campaign's references; checks the targets of spec 11
//   beds    the three beds (erebuni, ararat, twDvin) by day, and how often each bed's rare events fire
//   music   the three era voicings under the town's scene
//   raid    the loudest wonder raid of a steady bot game (Normal), at 1x and 2x, zoomed out and at 1.0: voices
//           (the engine's list), its loudness, and silence with every sound toggle off
//   exits   Snd.sceneOverride after each way out: leave, back swipe, error card (Back and back swipe),
//           recoverToMap, and the shot=town photo; and the override per age while open
// Prints tables and "RESULT {...}"; exits 1 when a check fails.
const { chromium } = require(process.env.PW_PATH || "playwright");
const path = require("path");
const FILE = path.resolve(process.env.GAME || path.join(__dirname, "..", "index.html"));
const ALL = ["levels", "beds", "music", "raid", "exits"];
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const N = +(process.env.N || 4);

// the meter, injected into the page: peak, K-weighted momentary max and integrated loudness of a buffer
const METER = () => {
  const kw = x => {
    const st = (b, a, inp) => { const out = new Float32Array(inp.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < inp.length; i++) { const v = b[0] * inp[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = inp[i]; y2 = y1; y1 = v; out[i] = v; } return out; };
    return st([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], st([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x));
  };
  window.__meter = buf => {
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, sr = buf.sampleRate;
    let pk = 0, nan = 0, over = 0;
    for (let i = 0; i < L.length; i++) { const m = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (!isFinite(m)) nan++; else { if (m > pk) pk = m; if (m > 0.891) over++; } }
    const kl = kw(L), kr = kw(R), win = Math.floor(0.4 * sr), hop = Math.floor(0.1 * sr), bl = [];
    for (let s = 0; s + win <= Math.max(win, kl.length); s += hop) { let e = 0; for (let i = s; i < s + win; i++) { const a = kl[i] || 0, b = kr[i] || 0; e += a * a + b * b; } bl.push(e / win); }
    const lu = e => -0.691 + 10 * Math.log10(Math.max(e, 1e-20));
    const mMax = Math.max(...bl.map(lu)), abs = bl.filter(e => lu(e) > -70);
    let integ = -Infinity;
    if (abs.length) { const rel = lu(abs.reduce((a, b) => a + b, 0) / abs.length) - 10, g = abs.filter(e => lu(e) > rel); integ = lu(g.reduce((a, b) => a + b, 0) / g.length); }
    return { peak: +(20 * Math.log10(pk + 1e-12)).toFixed(1), mMax: +mMax.toFixed(1), integ: +integ.toFixed(1), nan, over };
  };
};

(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const result = {}, fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); return c; };
  const newPage = async (q, vp) => {
    const ctx = await browser.newContext({ viewport: vp || { width: 1194, height: 834 } });
    const page = await ctx.newPage(), errs = [];
    page.on("pageerror", e => errs.push(e.message));
    page.on("console", m => { if (m.type() === "error" && !/probe:/.test(m.text())) errs.push("console: " + m.text()); });
    await page.goto("file://" + FILE + (q || ""));
    if (/shot=/.test(q || "")) await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
    else await page.waitForTimeout(1500);
    await page.evaluate(METER);
    return { page, ctx, errs };
  };
  const { page, errs } = await newPage("");
  const ev = (f, a) => page.evaluate(f, a);
  ok(await ev(() => !TOWN_FAIL && !!TWS), "the town did not load: " + (await ev(() => TOWN_FAIL)));

  // ---------------------------------------------------------------------------------------------------------------
  if (modes.includes("levels")) {
    // [label, sound, options, seconds, variant index (forced through rrIdx) or -1]
    const L = [];
    const ref = (lab, n, o, d) => L.push([lab, n, o || {}, d || 3, -1, true]);
    ref("build standard", "build", { skin: "standard" }); ref("build (A2)", "build", {}); ref("build banner", "build", { skin: "banner" });
    for (const e of [0, 1, 2]) ref("horn era " + e, "horn", { era: e }, 4);
    for (const e of [0, 1, 2]) ref("repelled era " + e, "repelled", { era: e }, 5);
    ref("plot", "plot", {}); ref("upgrade", "upgrade", {}); ref("upgrade x0.7", "upgrade", { vol: 0.7 }); ref("uiTick", "uiTick", {}, 1); ref("coin", "coin", {}); ref("arrow", "arrow", {}, 2); ref("arrow x0.36", "arrow", { vol: 0.36 }, 2); ref("arrow x0.42", "arrow", { vol: 0.42 }, 2); ref("stoneHit", "stoneHit", {}, 2); ref("coin x0.9", "coin", { vol: 0.9 });
    ref("stoneHit x0.32", "stoneHit", { vol: 0.32 }, 2); ref("impact shield x0.5", "impact", { armor: 5, vol: 0.5 }, 2);
    ref("death raider x0.5", "death", { kind: "raider", vol: 0.5 }, 2.5); ref("death cavalry x0.5", "death", { kind: "cavalry", vol: 0.5 }, 2.5);
    ref("win (campaign)", "win", {}, 5); ref("lose (campaign)", "lose", {}, 7);
    const tw = (lab, n, o, d, vars) => { if (vars) for (let i = 0; i < vars; i++) L.push([lab + " v" + i, n, o || {}, d || 3, i]); else L.push([lab, n, o || {}, d || 3, -1]); };
    tw("twChop", "twChop", {}, 1.5, 3); tw("twPick stone", "twPick", {}, 1.5, 3); tw("twPick ore", "twPick", { ore: true }, 1.5, 3);
    for (const k of ["field", "orchard", "dye"]) tw("twHarvest " + k, "twHarvest", { k }, 1.5);
    tw("twFlock", "twFlock", {}, 2);
    for (const r of ["f", "w", "s", "g"]) tw("twDrop " + r, "twDrop", { res: r }, 1.5);
    tw("twDoor", "twDoor", {}, 1.5);
    for (const k of ["vil", "spear", "bow", "horse"]) tw("twTrain " + k, "twTrain", { k }, 1.5);
    tw("twWall n1", "twWall", { n: 1 }, 1.5); tw("twWall n5", "twWall", { n: 5 }, 2); tw("twGate", "twGate", {}, 2);
    for (const a of [1, 2, 3]) tw("twAgeUp A" + a, "twAgeUp", { age: a }, 5);
    for (const a of [1, 2, 3]) { tw("twAlarm A" + a, "twAlarm", { age: a }, 3); tw("twAlarm all A" + a, "twAlarm", { age: a, all: 1 }, 3); tw("twAlarm soft A" + a, "twAlarm", { age: a, soft: 1, vol: 0.75 }, 3); tw("twAlarm urgent A" + a, "twAlarm", { age: a, all: 1, urgent: 1 }, 4); }
    tw("twAllClear", "twAllClear", {}, 2);
    for (const p of [25, 50, 75]) tw("twWonderStage " + p, "twWonderStage", { pct: p }, 3);
    tw("twSetback", "twSetback", {}, 2); tw("twWonderDone", "twWonderDone", {}, 3);
    for (const a of [1, 2, 3]) { tw("twWin A" + a, "twWin", { age: a }, 5); tw("twLose A" + a, "twLose", { age: a }, 8); }
    tw("twDeny", "twDeny", {}, 1.5);
    for (const a of [1, 2, 3]) { tw("twApproach far A" + a, "twApproach", { age: a, horses: a === 2 ? 3 : a === 3 ? 1 : 0 }, 5); tw("twApproach near A" + a, "twApproach", { age: a, near: 1, horses: a === 2 ? 3 : a === 3 ? 1 : 0 }, 5); tw("twPlunder A" + a, "twPlunder", { age: a }, 5); }
    tw("twPillage", "twPillage", {}, 3); tw("twCord", "twCord", {}, 2);
    for (const k of ["house", "wall", "field"]) { tw("twCollapse " + k, "twCollapse", { k }, 3); }
    tw("twCollapse far house", "twCollapse", { k: "house", far: 1 }, 3);
    tw("twFall", "twFall", {}, 1.5); tw("twDriven", "twDriven", {}, 2); tw("twTreeFall", "twTreeFall", {}, 3); tw("twCartLost", "twCartLost", {}, 2);
    tw("hoofbeats n1 (5 s)", "__hoof", { n: 1 }, 5); tw("hoofbeats n8 (5 s)", "__hoof", { n: 8 }, 5);
    const rows = [], ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
    for (const [lab, n, o, d, vi, isRef] of L) {
      if (ONLY && !ONLY.test(lab) && !/^(build|horn era)/.test(lab)) continue;
      const ms = [];
      for (let k = 0; k < N; k++) ms.push(await ev(async ([n, o, d, vi]) => {
        const keep = Snd.rrIdx;
        let r;
        try {
          r = await Snd.renderOffline(d, S => {
            if (vi >= 0) S.rrIdx = () => vi;
            if (n === "__hoof") { for (let t = 0.05; t < d - 0.5; t += 0.4) S.hoofStride(t, o.n); }
            else S.play(n, Object.assign({ at: 0.05 }, o));
          });
        } finally { Snd.rrIdx = keep; }
        return window.__meter(r.buf);
      }, [n, o, d, vi]));
      const m = ms.map(x => x.mMax);
      rows.push({ lab, ref: !!isRef, mMax: +(m.reduce((a, b) => a + b, 0) / m.length).toFixed(1), lo: Math.min(...m), hi: Math.max(...m), peak: Math.max(...ms.map(x => x.peak)), nan: ms.some(x => x.nan) });
      process.stdout.write(".");
    }
    console.log();
    const R = Object.fromEntries(rows.map(r => [r.lab, r]));
    console.log("| sound | M-max (LUFS) | lo | hi | peak dBFS |\n|---|---|---|---|---|");
    for (const r of rows) console.log(`| ${r.ref ? "(ref) " : ""}${r.lab} | ${r.mMax} | ${r.lo} | ${r.hi} | ${r.peak} |`);
    // the targets of spec 11
    const build = Math.max(R["build standard"].mMax, R["build (A2)"].mMax, R["build banner"].mMax), buildMin = Math.min(R["build standard"].mMax, R["build (A2)"].mMax, R["build banner"].mMax);
    for (const r of rows) {
      ok(!r.nan, r.lab + ": NaN in the render");
      ok(r.peak < -1, r.lab + ": peak " + r.peak + " dBFS");
      if (/^(twChop|twPick|twHarvest|twFlock|twDrop)/.test(r.lab)) ok(r.mMax <= buildMin - 12, r.lab + " is " + (r.mMax - buildMin).toFixed(1) + " dB from build (want <= -12)");
    }
    for (const a of [1, 2, 3]) {
      if (!R["twAgeUp A" + a] || !R["twAlarm A" + a]) continue;
      const horn = R["horn era " + (a - 1)].mMax;
      ok(Math.abs(R["twAgeUp A" + a].mMax - horn) <= 1.5, "twAgeUp A" + a + " " + (R["twAgeUp A" + a].mMax - horn).toFixed(1) + " dB from the horn (want within 1.5)");
      const d = horn - R["twAlarm A" + a].mMax;
      ok(d >= 1.9 && d <= 3.1, "twAlarm A" + a + " is " + d.toFixed(1) + " dB under the horn (want 2 to 3)");
    }
    const groups = {};
    for (const r of rows) { const m = /^(.*) v\d$/.exec(r.lab); if (m) (groups[m[1]] || (groups[m[1]] = [])).push(r.mMax); }
    for (const [g, a] of Object.entries(groups)) ok(Math.max(...a) - Math.min(...a) <= 0.5, g + ": variants differ by " + (Math.max(...a) - Math.min(...a)).toFixed(1) + " dB");
    result.levels = { build, rows: rows.length, groups: Object.fromEntries(Object.entries(groups).map(([g, a]) => [g, +(Math.max(...a) - Math.min(...a)).toFixed(2)])) };
  }

  // ---------------------------------------------------------------------------------------------------------------
  if (modes.includes("beds")) {
    console.log("| bed (day) | M-max | integrated LUFS | rare events in 300 s |\n|---|---|---|---|");
    const beds = {};
    for (const m of ["erebuni", "ararat", "twDvin", "dvin"]) {
      const a = [];
      for (let k = 0; k < 2; k++) a.push(await ev(async m => { const r = await Snd.renderOffline(60, S => { S.sceneOverride = { map: m, night: 0 }; S.ambTick(0, 60); }); return window.__meter(r.buf); }, m));
      // what the bed's event clock fires over five minutes (scheduling only, nothing rendered)
      const fired = await ev(async m => {
        const out = {}, keep = Snd.ambEv;
        Snd.ambEv = function (b, kind) { out[kind] = (out[kind] || 0) + 1; };
        try { await Snd.renderOffline(1, S => { S.sceneOverride = { map: m, night: 0 }; S.ambTick(0, 300); }); } finally { Snd.ambEv = keep; }
        return out;
      }, m);
      beds[m] = { integ: +((a[0].integ + a[1].integ) / 2).toFixed(1), mMax: Math.max(a[0].mMax, a[1].mMax), fired };
      console.log(`| ${m} | ${beds[m].mMax} | ${beds[m].integ} | ${JSON.stringify(fired)} |`);
    }
    ok(!beds.twDvin.fired.churchBell, "the twDvin bed rang its bell");
    ok(!beds.erebuni.fired.churchBell && !beds.ararat.fired.churchBell, "a bell in the erebuni or ararat bed");
    ok(Math.abs(beds.twDvin.integ - beds.dvin.integ) <= 1, "twDvin's loudness strays from dvin's: " + beds.twDvin.integ + " vs " + beds.dvin.integ);
    for (const m of ["erebuni", "ararat", "twDvin"]) ok(beds[m].integ >= -44.5 && beds[m].integ <= -40.5, m + " bed at " + beds[m].integ + " LUFS (the campaign's beds sit near -42)");
    ok(await ev(() => Snd.AMB.dvin.rare.includes("churchBell") && !Snd.AMB.twDvin.rare.includes("churchBell") && !("twDvin" in Snd.MUS_MAP)), "the Dvin tables are not as they must be");
    result.beds = beds;
  }

  // ---------------------------------------------------------------------------------------------------------------
  if (modes.includes("music")) {
    console.log("| music (scene) | M-max | integrated LUFS |\n|---|---|---|");
    const mus = {};
    for (const [era, map] of [[0, "erebuni"], [1, "ararat"], [2, "twDvin"]]) {
      const a = await ev(async ([era, map]) => {
        const r = await Snd.renderOffline(60, S => { S.sceneOverride = { map, era, night: 0, units: null }; S.setEra(era, 0, map); S.nextBeat = 0.1; S.beatN = 0; S.startDrone(); S.schedule(60); });
        return window.__meter(r.buf);
      }, [era, map]);
      mus[map] = a;
      console.log(`| era ${era} (${map}) | ${a.mMax} | ${a.integ} |`);
      ok(a.integ > -33 && a.integ < -25, "music era " + era + " at " + a.integ);
    }
    result.music = mus;
  }

  // ---------------------------------------------------------------------------------------------------------------
  if (modes.includes("raid")) {
    // bot games: every wonder raid, by the fighting in its busiest minute (hits, shots, falls and collapses)
    const GAMES = [["steady", 1], ["steady", 2], ["passive", 1], ["turtle", 2], ["greedy", 2]];
    const scan = await ev(GAMES => GAMES.map(([style, diff]) => {
      const G = TW.newGame({ seed: 20261025, diff, firstTown: false }), bot = TW.bot.create(style, { seed: 20261025 });
      const per = {}, warns = {};
      while (!G.over && G.tick < 40 * 600) {
        bot.think(G); TW.tick(G);
        for (const e of TW.drain(G)) {
          if (e.e === "raidWarn" && e.wonder) warns[e.raid] = G.tick;
          if ((e.e === "hit" || e.e === "shot" || e.e === "fell" || e.e === "destroyed") && G.wonder) { const s = Math.floor(G.tick / 10); per[s] = (per[s] || 0) + 1; }
        }
      }
      // the busiest 60 s window after a wonder raid's warning
      let best = { n: 0, at: 0, warn: 0 };
      for (const w of Object.values(warns)) for (let s0 = Math.floor(w / 10); s0 < Math.floor(w / 10) + 180; s0 += 5) {
        let n = 0; for (let s = s0; s < s0 + 60; s++) n += per[s] || 0;
        if (n > best.n) best = { n, at: s0 * 10, warn: w };
      }
      return { style, diff, best, wonderRaids: Object.keys(warns).length, over: G.over };
    }), GAMES);
    for (const g of scan) console.log("game " + g.style + " diff " + g.diff + ": wonder raids " + g.wonderRaids + ", busiest minute " + g.best.n + " events from " + (g.best.at / 10) + " s; over " + JSON.stringify(g.over));
    const pick = scan.slice().sort((a, b) => b.best.n - a.best.n)[0];
    ok(pick && pick.best.n > 0, "no wonder raid in the bot games");
    console.log("the loudest wonder raid: " + pick.style + " diff " + pick.diff + " from " + (pick.best.at / 10) + " s (" + pick.best.n + " events in its minute)");
    const runs = [];
    for (const [speed, zoom, off] of [[1, 0.55, false], [2, 0.55, false], [1, 1.0, false], [2, 1.0, false], [2, 0.55, true]]) {
      const r = await ev(async ([style, diff, from, speed, zoom, off, secs]) => {
        // the same game again, to five seconds before its busiest minute; the camera follows the raiders
        const G = TW.newGame({ seed: 20261025, diff, firstTown: false }), bot = TW.bot.create(style, { seed: 20261025 });
        while (G.tick < from - 50) { bot.think(G); TW.tick(G); TW.drain(G); }
        const W = 1194, top = 56, bot2 = 734;
        const view = { zoom, x: 0, y: 0, area: { l: 0, t: top, r: W, b: bot2 } };
        const follow = () => {
          let x = 0, y = 0, c = 0;
          for (const u of G.units) if (!u.dead && u.side === 1) { x += u.x; y += u.y; c++; }
          if (!c) { const w = G.blds.find(b => b.k === "wonder" && !b.dead) || G.blds.find(b => b.k === "tc"); x = w.x + w.w / 2; y = w.y + w.h / 2; c = 1; }
          view.x = x / c - W / 2 / (40 * zoom); view.y = y / c - (top + bot2) / 2 / (40 * zoom * 0.72);
        };
        follow();
        const keep = [Snd.sfxOn, Snd.musicOn, Snd.ambOn];
        if (off) Snd.sfxOn = Snd.musicOn = Snd.ambOn = false;
        let peakV = 0, peakAll = 0, plays = 0, horseMax = 0, pri = 0;
        const counts = {}, keepPlay = Snd.play;
        Snd.play = function (n, o) { plays++; counts[n] = (counts[n] || 0) + 1; return keepPlay.call(this, n, o); };
        let out;
        try {
          out = await Snd.renderOffline(secs, (S, oc) => {
            S.nextBeat = 0.1; S.beatN = 0; S.startDrone();
            TWS.open(G);
            const q = 128 / oc.sampleRate;
            for (let k = 1; k < secs * 10; k++) {
              const t = Math.round(k * 0.1 / q) * q;
              oc.suspend(t).then(() => {
                for (let i = 0; i < speed && !G.over; i++) { bot.think(G); TW.tick(G); TWS.onEvents(TW.drain(G), G, view, W); }
                if (k % 5 === 0) TWS.tick(G, view);
                if (k % 10 === 0) follow();
                const sc = S.scene();
                if (sc && sc.era != null) S.setEra(sc.era, t, sc.map);
                S.schedule(t + 0.5); S.ambTick(t, t + 0.6); S.unitTick(t, t + 0.6, sc);
                const live = S.voices.filter(x => x.end > t);
                peakV = Math.max(peakV, live.filter(x => !(S.SPEC[x.name] || {}).pri).length);
                peakAll = Math.max(peakAll, live.length);
                pri = Math.max(pri, live.filter(x => (S.SPEC[x.name] || {}).pri).length);
                horseMax = Math.max(horseMax, sc && sc.units && sc.units.horse || 0);
                oc.resume();
              });
            }
          });
        } finally {
          Snd.play = keepPlay; [Snd.sfxOn, Snd.musicOn, Snd.ambOn] = keep;
          TWS.close();
        }
        const m = window.__meter(out.buf);
        return { speed, zoom, off, peakV, peakAll, pri, plays, horseMax, m, stats: out.stats, counts };
      }, [pick.style, pick.diff, pick.best.at, speed, zoom, off, 70]);
      runs.push(r);
      console.log(`raid x${r.speed} zoom ${r.zoom}${r.off ? " (all sound off)" : ""}: voices peak ${r.peakAll} (non-priority ${r.peakV}, priority ${r.pri}), plays ${r.plays}, dropped ${r.stats.dropped}, stolen ${r.stats.stolen || 0}, horses ${r.horseMax}; mix M-max ${r.m.mMax} int ${r.m.integ} peak ${r.m.peak} dBFS over ${r.m.over}`);
      console.log("  plays by sound: " + Object.entries(r.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(", "));
      if (r.off) ok(r.m.peak < -90, "sound off but the raid rendered at " + r.m.peak + " dBFS");
      else { ok(r.peakAll <= 40, "voices in the raid: " + r.peakAll); ok(r.m.peak < -1, "the raid mix peaks at " + r.m.peak); }
    }
    result.raid = runs.map(r => ({ speed: r.speed, zoom: r.zoom, off: r.off, voices: r.peakAll, nonPri: r.peakV, pri: r.pri, plays: r.plays, horses: r.horseMax, mMax: r.m.mMax, integ: r.m.integ, peak: r.m.peak }));
  }

  // ---------------------------------------------------------------------------------------------------------------
  if (modes.includes("exits")) {
    const X = {};
    const st = async p => p.evaluate(() => ({ open: Town.isOpen(), card: Town.test.card(), over: Snd.sceneOverride, inert: overlayEl.hasAttribute("inert") }));
    const go = async (p, sc) => {
      const e = (f, a) => p.evaluate(f, a), wait = ms => p.waitForTimeout(ms);
      const click = async s => { await e(s => { const el = s.startsWith("@") ? Town.test.button(s.slice(1)) : document.querySelector(s); if (!el) throw new Error("no " + s); el.click(); }, s); await wait(150); };
      await e(() => { try { for (const k of ["hs_town", "hs_town_run", "hs_town_bless"]) localStorage.removeItem(k); } catch (x) {} if (menuMode === "chapter") $("startBtn").click(); });
      await wait(300);
      await click("#townBtn");
      const s0 = await st(p);
      await click("@card:begin"); await click("@card:cont"); await wait(300);
      const s1 = await st(p);
      if (sc === "leave") { await click("@leave"); await click("@card:leave"); }
      else if (sc === "back") await e(() => history.back());
      else if (sc === "errorBack" || sc === "errorSwipe") {
        await e(() => { window.__draw = TWA.draw; TWA.draw = () => { throw new Error("probe: a drawing bug"); }; });
        await wait(300);
        X[sc + "Card"] = (await st(p)).card;
        if (sc === "errorBack") await click("@card:back"); else await e(() => history.back());
        await e(() => { TWA.draw = window.__draw; });
      } else if (sc === "recover") await e(() => { showCrashCard(new Error("probe: a crash")); $("crashMap").click(); });
      await wait(500);
      const s2 = await st(p);
      return { atOpen: s0.over, playing: s1.over, after: s2 };
    };
    for (const sc of ["leave", "back", "errorBack", "errorSwipe", "recover"]) {
      const P = await newPage("");
      try {
        const r = await go(P.page, sc);
        X[sc] = r;
        ok(r.playing && r.playing.map === "erebuni" && r.playing.era === 0, sc + ": the town's scene was not set while open: " + JSON.stringify(r.playing));
        ok(!r.after.open && r.after.over === null && !r.after.inert, sc + ": after the way out " + JSON.stringify(r.after));
        if (P.errs.length) fails.push(sc + ": page errors " + P.errs.join(" | ").slice(0, 300));
      } catch (e) { fails.push(sc + ": " + String(e).slice(0, 200)); }
      await P.ctx.close();
    }
    ok(X.errorBackCard === "error" && X.errorSwipeCard === "error", "no error card: " + X.errorBackCard + " " + X.errorSwipeCard);
    // the photo (H6) never sets the scene
    for (const stage of ["age1", "age2raid", "age3wonder"]) {
      const P = await newPage("?shot=town&stage=" + stage);
      X["photo " + stage] = await P.page.evaluate(() => Snd.sceneOverride);
      ok(X["photo " + stage] === null, "photo " + stage + ": sceneOverride " + JSON.stringify(X["photo " + stage]));
      await P.ctx.close();
    }
    // per age, while open (TWS.open as the shell calls it), and the horses
    X.ages = await ev(() => [1, 2, 3].map(a => { const G = TW.stage("age" + a, 20261025, 1); TWS.open(G); const s = Object.assign({}, Snd.sceneOverride); TWS.close(); return s; }));
    ok(JSON.stringify(X.ages.map(s => [s.map, s.era])) === JSON.stringify([["erebuni", 0], ["ararat", 1], ["twDvin", 2]]), "the scenes by age: " + JSON.stringify(X.ages));
    ok(await ev(() => Snd.sceneOverride === null), "the override left set");
    console.log("exits: " + JSON.stringify(X));
    result.exits = X;
  }

  if (errs.length) fails.push("page errors: " + errs.join(" | ").slice(0, 400));
  for (const f of fails) console.log("FAIL " + f);
  console.log("RESULT " + JSON.stringify({ pass: !fails.length, fails: fails.length, modes }));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
