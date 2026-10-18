// Headless balance bot: plays battlefields with a set of fixed build orders and prints who held.
//
// Usage:  NODE_PATH=$(npm root -g) node tools/balance.js [diff] [levels] [builds]
//   diff     0 (or easy), 1 (normal, the default), 2 (hard); "1,2" or "all" runs each in turn
//   levels   battlefield indices: "0-13" (the default, every battlefield), "3", "0,5,12", "7-13"
//   builds   build names from BUILDS below, comma-separated (default: all of them)
// Environment:
//   GAME=path     the page to play (default: the index.html beside this folder), e.g. an older copy to compare
//   JOBS=n        battles played side by side, each in its own browser page (default: CPUs, at most 4)
//   SEEDS=n       battles per cell (default 1), each with its own random seed and its own pace (the bot
//                 spends and casts every 2, 1.6, 2.5, 1.8 or 2.2 s). Use 3 before deciding anything: one battle
//                 can turn on whether a commander slips through, and that alone is 10 lives
//   SPELLS=0      the bot never casts (by default it casts each spell on the thickest knot of foes)
//   SPEC=a|b|alt  masteries: always the first, always the second, or (the default) alternating among the
//                 towers of one kind, so both masteries of every tower are tried in every battle. The first
//                 tower of a kind stands on the better pad, so it takes "a" on even battlefields, "b" on odd.
//                 Per kind for an A/B test: SPEC=catapult=b,drums=a (kinds not named alternate)
//   DT=s          simulation step in seconds (default 1/60, one frame of the game at 60 Hz; a coarser step
//                 rounds every reload up and so shortchanges the fast-shooting towers)
//   JSON=1        also print one JSON line per battle: leaks by wave, damage by tower, and a trace with
//                 wave:lives:gold:towers after each wave (a tower as its kind's initial and rank, "b3", "ca")
//   BUILD_name=kinds  add a build of your own for this run, e.g. BUILD_catdrum=catapult,catapult,archer,drums
//   PATCH=js      run this code in every page once it has loaded, before any battle: for trying numbers
//                 without editing the game, e.g. PATCH='TOWER_DEFS.ballista.levels[0].dmg = 50' or
//                 PATCH='LEVELS[9].hpTune = 1.1'
//
// What it prints, for each difficulty: one row per battlefield and one column per build. With one seed, "W 14"
// is a stand held with 14 lives left and "L 12" a stand lost on wave 12; with several, "2/3 9.7" is two wins in
// three with 9.7 lives left on average (a loss counting 0) and "0/3 w12" three losses around wave 12. The "best"
// column is the best build for that battlefield (most wins, then most lives, else the furthest wave): roughly
// what a capable player finds. Under the table: wins per build, then damage per 100 gold invested for each
// tower kind and mastery, summed over every battle. A tower built late has had less time to deal damage, so
// compare a mastery with its twin ("archer.a" with "archer.b"), not with an unmastered tower.
//
// How the bot plays: the same rules for every build, so the table compares builds, not the bot's skill.
//   - Pads are ranked greedily by how much road each adds within 170 px of the pads already taken; for the
//     towers that hit outflankers (archers, ballistae) the flyers' line to the fortress counts too.
//   - It keeps at least five towers, then raises every tower to its third rank before building more, takes
//     masteries once every pad is built, and claims the plot that watches the most road only after that.
//     Each new tower is the next kind in the build's order.
//   - It spends and casts before every wave and every two seconds of battle (see SEEDS). A spell goes on the
//     knot of ground foes with the most hit points within its radius, if they hold more than 600.
//   - It never moves its hero, never calls a wave early, never sells and never changes a tower's target.
// Math.random is seeded per battle, so a run is repeatable and two versions of the game can be compared
// battle for battle (GAME= the old copy). Read the table as relative movement between versions and between
// builds, not as a person's results. On 4 cores one difficulty takes about 1-2 min, or 3-5 min with SEEDS=3.
const path = require("path");
const os = require("os");
const { chromium } = require(process.env.PW_PATH || "playwright");

// each build is the order its towers are placed in, repeated. Stones cannot reach outflankers and are slow
// to fell one commander, so the catapult build is half catapults, with an archer for the sky and drums.
const BUILDS = {
  mix:       ["archer", "ballista", "catapult", "fire", "archer", "drums", "ballista", "catapult", "archer", "fire",
              "ballista", "drums", "catapult", "archer"],
  balldrum:  ["ballista", "ballista", "ballista", "drums"],
  ballista:  ["ballista"],
  archers:   ["archer"],
  archdrum:  ["archer", "archer", "archer", "drums"],
  catapults: ["catapult", "archer", "catapult", "drums"],
  firemix:   ["ballista", "fire", "archer", "fire", "catapult", "drums"],
};

function parseList(s, all) {
  if (!s || s === "all") return all.slice();
  const out = [];
  for (const part of s.split(",")) {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else out.push(isNaN(+part) ? part : +part);
  }
  return out;
}

// one battle, played inside the page (this function is serialised into it, so it sees only its argument)
function playBattle(a) {
  const { lv, diff, plan, seed, pace, spells, spec, dt } = a;
  Math.random = mulberry32(seed);
  toast = () => {};
  curDiff = diff; curLevel = lv;
  resetGame();
  spawnSeq = 0;   // which road each foe takes on a forked field: the game never resets it between battles
  overlayEl.classList.add("hidden");
  // rank pads by how much road lies within reach: each next pad is the one adding most reach over road the
  // pads before it already cover. Towers that hit outflankers rank them by road and sky together: the sky is
  // the line a flyer from each road's entry takes, read off a probe flyer (over a lake it bends to the water)
  const pts = [], sky = [], seq0 = spawnSeq;
  for (let ri = 0; ri < ROUTES.length; ri++) {
    for (let k = 0; k <= 120; k++) pts.push(routeAt(ri, ROUTES[ri].len * k / 120));
    spawnSeq = ri; spawnEnemy("flyer");
    const f = enemies.pop();
    for (let k = 0; k <= 40; k++) { f.dist = f.fly.len * k / 40; sky.push(enemyPos(f)); }
  }
  spawnSeq = seq0;
  const near = (q, x, y) => Math.hypot(q.x - x, q.y - y) < 170;
  const rankOver = P => {
    const cover = P.map(() => 0), rank = [], left = PADS.map((p, i) => i);
    while (left.length) {
      let best = -1, bv = -1;
      for (const i of left) {
        let v = 0;
        P.forEach((q, k) => { if (near(q, PADS[i][0], PADS[i][1])) v += 1 / (1 + 2 * cover[k]); });
        if (v > bv) { bv = v; best = i; }
      }
      rank.push(best); left.splice(left.indexOf(best), 1);
      P.forEach((q, k) => { if (near(q, PADS[best][0], PADS[best][1])) cover[k]++; });
    }
    return rank;
  };
  const rankRoad = rankOver(pts), rankAir = rankOver(pts.concat(sky));
  const specCount = {};
  const specFor = t => {
    const fixed = spec === "a" || spec === "b" ? spec : (spec.match(new RegExp("\\b" + t.type + "=([ab])")) || [])[1];
    if (fixed) return fixed;
    const n = specCount[t.type] = (specCount[t.type] || 0) + 1;
    return (n + lv) % 2 ? "a" : "b";
  };
  const spend = () => {
    for (let guard = 0; guard < 200; guard++) {
      const n = towers.length;
      const up = towers.filter(t => !t.spec && t.level < TOWER_DEFS[t.type].levels.length - 1).sort((x, y) => x.level - y.level)[0];
      const build = PADS.some((p, i) => !towerAt(i)) ? plan[n % plan.length] : null;
      const nextPad = build && (TOWER_DEFS[build].air ? rankAir : rankRoad).find(i => !towerAt(i));
      let done = false;
      if (build && (n < 5 || !up) && gold >= TOWER_DEFS[build].cost) { placeTower(build, nextPad); done = true; }
      else if (up && gold >= TOWER_DEFS[up.type].levels[up.level + 1].cost) { upgradeTower(up); done = true; }
      else if (!up && !build) {
        const sp = towers.find(t => !t.spec);
        if (sp) {
          const key = sp.botSpec || (sp.botSpec = specFor(sp));
          if (gold >= specInfo(sp.type, key).cost) { specializeTower(sp, key); done = true; }
        } else if (plots.length && gold >= plotPrice() + 200) {
          const val = q => pts.filter(p => near(p, q[0], q[1])).length;
          let bi = 0;
          plots.forEach((q, i) => { if (val(q) > val(plots[bi])) bi = i; });
          buyPlot(bi); rankRoad.push(PADS.length - 1); rankAir.push(PADS.length - 1); done = true;
        }
      }
      if (!done) break;
    }
  };
  const castAll = () => {
    for (const k of Object.keys(SPELLS)) {
      if (spellCd[k] > 0 || enemies.length < 4) continue;
      const ps = enemies.filter(e => !e.fly).map(e => ({ e, p: enemyPos(e) }));
      let best = null, bv = 0;
      for (const o of ps) {
        const v = ps.filter(b => Math.hypot(o.p.x - b.p.x, o.p.y - b.p.y) < SPELLS[k].radius).reduce((s, b) => s + b.e.hp, 0);
        if (v > bv) { bv = v; best = o.p; }
      }
      if (best && bv > 600) castSpell(k, best.x, best.y);
    }
  };
  const every = Math.max(1, Math.round(pace / dt)), leaks = {}, trace = [];
  while (!gameOver && waveIdx < TOTAL_WAVES) {
    spend();
    startWave();
    let n = 0;
    const before = lives;
    while (phase === "wave" && !gameOver && n < 2400 / dt) {
      update(dt); n++;
      if (n % every === 0) { spend(); if (spells) castAll(); }
    }
    if (lives < before) leaks[waveIdx] = before - Math.max(0, lives);
    // wave:lives:gold:towers, each tower as its kind's initial and rank (a, b for a mastery)
    trace.push(waveIdx + ":" + Math.max(0, lives) + ":" + Math.round(gold) + ":" +
      towers.map(t => t.type[0] + (t.spec || t.level + 1)).join(""));
  }
  // damage and gold by tower kind and mastery ("archer" for an unmastered one, "archer.a" for a mastery)
  const by = {};
  for (const t of towers) {
    const k = t.type + (t.spec ? "." + t.spec : "");
    const o = by[k] || (by[k] = { n: 0, dmg: 0, gold: 0 });
    o.n++; o.dmg += t.dmgDone || 0; o.gold += towerInvested(t);
  }
  return { won: lives > 0 && waveIdx >= TOTAL_WAVES && gameOver, lives: Math.max(0, lives), wave: waveIdx,
    towers: towers.length, plots: plotsBought, leaks, by, trace: trace.join(" ") };
}

(async () => {
  const t0 = Date.now();
  const file = path.resolve(process.env.GAME || path.join(__dirname, "..", "index.html"));
  const diffs = parseList(process.argv[2] || "1", [0, 1, 2]).map(d => ({ easy: 0, normal: 1, hard: 2 }[d] ?? +d));
  const levels = parseList(process.argv[3], [...Array(14).keys()]);
  for (const k in process.env) if (k.startsWith("BUILD_")) BUILDS[k.slice(6)] = process.env[k].split(",");
  const builds = parseList(process.argv[4], Object.keys(BUILDS));
  for (const b of builds) if (!BUILDS[b]) { console.error("unknown build " + b + "; builds: " + Object.keys(BUILDS).join(", ")); process.exit(2); }
  const seeds = Math.max(1, +(process.env.SEEDS || 1));
  const spells = process.env.SPELLS !== "0";
  const spec = process.env.SPEC || "alt";
  const dt = +(process.env.DT || 1 / 60);
  const jobs = Math.max(1, +(process.env.JOBS || Math.min(4, os.cpus().length)));

  const browser = await chromium.launch();
  const errors = [];
  // the photo harness gives every page in-memory storage, no audio device and a frozen draw loop, so update()
  // runs only when the bot calls it
  const pages = await Promise.all([...Array(jobs)].map(async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("file://" + file + "?shot=battle&lv=0&wave=1");
    await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 180000 });
    if (process.env.PATCH) await page.evaluate(js => (0, eval)(js), process.env.PATCH);
    return page;
  }));
  const names = await pages[0].evaluate(() => LEVELS.map(L => L.name + " " + (L.year < 0 ? -L.year + " BC" : L.year)));

  const queue = [];
  for (const diff of diffs) for (const lv of levels) for (const b of builds) for (let s = 0; s < seeds; s++) {
    // a second seed also changes how often the bot looks at its gold and spells, which moves every purchase
    queue.push({ lv, diff, build: b, plan: BUILDS[b], seed: 1009 + 7919 * s + 31 * lv, pace: 2 * [1, 0.8, 1.25, 0.9, 1.1][s % 5],
      spells, spec, dt });
  }
  const results = [];
  let done = 0;
  await Promise.all(pages.map(async page => {
    while (queue.length) {
      const job = queue.shift();
      const r = await page.evaluate(playBattle, job);
      Object.assign(r, { lv: job.lv, diff: job.diff, build: job.build, seed: job.seed });
      results.push(r);
      if (process.env.JSON) console.log(JSON.stringify(r));
      if (process.stderr.isTTY) process.stderr.write("\r" + ++done + " battles");
    }
  }));
  if (process.stderr.isTTY) process.stderr.write("\r");
  await browser.close();

  const DN = ["Easy", "Normal", "Hard"];
  const pad = (s, n) => String(s).padEnd(n);
  const cellOf = rs => {
    const w = rs.filter(r => r.won).length, mean = rs.reduce((s, r) => s + r.lives, 0) / rs.length;
    if (rs.length === 1) return rs[0].won ? "W " + rs[0].lives : "L " + rs[0].wave;
    return w + "/" + rs.length + (w ? " " + mean.toFixed(1) : " w" + Math.round(rs.reduce((s, r) => s + r.wave, 0) / rs.length));
  };
  const score = rs => rs.filter(r => r.won).length * 1000 + rs.reduce((s, r) => s + r.lives + r.wave * 10 * !r.won, 0) / rs.length;
  for (const diff of diffs) {
    console.log("\n" + DN[diff] + ": " + levels.length + " battlefields, " + seeds + " seed" + (seeds > 1 ? "s" : "") +
      ", spells " + (spells ? "on" : "off") + ", masteries " + spec + ", dt " + dt.toFixed(4));
    const W = 10, NW = 25;
    console.log(pad("battlefield", NW) + builds.map(b => pad(b, W)).join("") + "| best");
    const wins = {};
    for (const lv of levels) {
      let row = pad(lv + " " + names[lv], NW).slice(0, NW), best = null;
      for (const b of builds) {
        const rs = results.filter(r => r.diff === diff && r.lv === lv && r.build === b);
        wins[b] = (wins[b] || 0) + rs.filter(r => r.won).length;
        row += pad(cellOf(rs), W);
        if (!best || score(rs) > score(best.rs)) best = { b, rs };
      }
      console.log(row + "| " + cellOf(best.rs) + " " + best.b);
    }
    console.log(pad("wins (of " + levels.length * seeds + ")", NW) + builds.map(b => pad(wins[b], W)).join(""));
    // damage per 100 gold, by tower kind and mastery
    const agg = {};
    for (const r of results) if (r.diff === diff) for (const k in r.by) {
      const o = agg[k] || (agg[k] = { n: 0, dmg: 0, gold: 0 });
      o.n += r.by[k].n; o.dmg += r.by[k].dmg; o.gold += r.by[k].gold;
    }
    const keys = Object.keys(agg).filter(k => agg[k].dmg > 0).sort();
    console.log("damage per 100 gold: " + keys.map(k => k + " " + Math.round(agg[k].dmg / agg[k].gold * 100) + " (" + agg[k].n + ")").join(", "));
  }
  if (errors.length) console.log("\npage errors:\n" + [...new Set(errors)].slice(0, 8).join("\n"));
  console.log("\n" + results.length + " battles in " + Math.round((Date.now() - t0) / 1000) + " s");
  process.exit(errors.length ? 1 : 0);
})();
