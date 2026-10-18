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
//   JSON=1        also print one JSON line per battle: leaks by wave, damage by tower, each commander's fate
//                 (its wave, whether it reached the walls, the share of its hit points it had left there or the
//                 share of its road it had walked when it fell), and a trace with wave:lives:gold:towers after
//                 each wave (a tower as its kind's initial and rank, "b3", "ca")
//   CMD=probe     the commanders can neither fall nor cost lives: each walks its whole road, pays its bounty
//                 once it has taken its own hit points, and a second table gives, per cell, the least damage a
//                 wave-10 and a wave-20 commander took on its road as a share of its hit points. Above 1 the
//                 build fells a commander of that strength; 1.3 means it could stand 30% more hit points. The
//                 battle is the same as an ordinary one up to the moment the commander would have fallen, so
//                 the main table then shows the rank and file's toll alone. The wave-20 pair share the towers'
//                 fire all the way, where in a real battle the second gets all of it once the first falls, so
//                 its figure understates the pair: confirm a change with an ordinary run
//   BUILD_name=kinds  add a build of your own for this run, e.g. BUILD_catdrum=catapult,catapult,archer,drums
//   PATCH=js      run this code in every page once it has loaded, before any battle: for trying numbers
//                 without editing the game, e.g. PATCH='TOWER_DEFS.ballista.levels[0].dmg = 50' or
//                 PATCH='LEVELS[9].hpTune = 1.1'
//
// What it prints, for each difficulty: one row per battlefield and one column per build. With one seed, "W 14"
// is a stand held with 14 lives left and "L 12" a stand lost on wave 12; with several, "2/3 9.7" is two wins in
// three with 9.7 lives left on average (a loss counting 0) and "0/3 w12" three losses around wave 12. A cell
// ending "c2" saw two commanders reach the walls over its battles: each costs 10 lives at a stroke, so "3/3 10.0c3"
// is a field that cost the rank and file nothing and lost one commander a battle. The "best" column is the best
// build for that battlefield (most wins, then most lives, else the furthest wave): roughly what a capable player
// finds; where commanders got through it also gives the lives the build would have kept without them. Under the
// table: wins per build, the battlefields each build held on every seed, the commanders that reached the walls,
// then damage per 100 gold invested for each tower kind and mastery, summed over every battle. A tower built late
// has had less time to deal damage, so compare a mastery with its twin ("archer.a" with "archer.b"), not with an
// unmastered tower.
//
// What the game is tuned to (EARLY_HP and each battlefield's hpTune for the rank and file, CMD_HP for the
// commanders, all in index.html; Hard's rank and file stand as Normal's), with SEEDS=3:
//   - Normal: the best build fells both commanders on every battlefield and every seed, so the lives it loses
//     are the rank and file's toll: a few on battlefields 1-6 (Erebuni, the first, stays gentle), and about
//     7-14 left on 7-13. A balanced mix holds most battlefields; all-archer and all-catapult builds hold some.
//     Tushpa, Avarayr and Sevan are the exception for now: the mix holds them whole at any strength tried
//     (see EARLY_HP), so the best build ends them with 20 lives
//   - Hard: the best build holds at least 12 of the 14 on every seed with 3 lives or more, and the mix most of
//     the early ones. Easy: comfortable for every sensible build.
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
  const { lv, diff, plan, seed, pace, spells, spec, dt, probe } = a;
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
  // every commander on the field, watched until it falls or reaches the walls: one that reaches them costs 10
  // lives at a stroke, so it is counted apart from the rank and file. For each: its wave, and either the share
  // of its hit points it still had at the walls (a leak) or the share of its road it had walked when it fell.
  // With CMD=probe a commander can neither fall nor cost lives: it walks the whole road, pays its bounty once it
  // has taken its own hit points, and "took" is the damage it took over the road as a share of those hit points
  // (above 1, a commander of that strength falls short of the walls; the battle is the same until it would fall)
  const bosses = new Set(), boss = [];
  const roadOf = e => e.fly ? e.fly.len : ROUTES[e.route || 0].len;
  const watchBosses = () => {
    for (const e of enemies) if (e.type === "boss" && !bosses.has(e)) {
      bosses.add(e);
      if (probe) { e.hp0 = e.maxHp; e.hp = e.maxHp = e.maxHp * 1e4; e.dmg = 0; }
    }
    for (const b of bosses) {
      if (probe && !b.paid && b.maxHp - b.hp >= b.hp0) { b.paid = true; gold += b.bounty; }
      if (!b.dead && enemies.includes(b)) continue;
      bosses.delete(b);
      if (!b.dead) continue;   // the battle ended around it
      const leaked = b.dist >= roadOf(b);
      boss.push(probe ? { w: waveIdx, took: +((b.maxHp - b.hp) / b.hp0).toFixed(3) } :
        { w: waveIdx, leaked, left: leaked ? +Math.max(0, b.hp / b.maxHp).toFixed(3) : 0,
          walked: +Math.min(1, b.dist / roadOf(b)).toFixed(3) });
    }
  };
  while (!gameOver && waveIdx < TOTAL_WAVES) {
    spend();
    startWave();
    let n = 0;
    const before = lives;
    while (phase === "wave" && !gameOver && n < 2400 / dt) {
      update(dt); n++;
      watchBosses();
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
    towers: towers.length, plots: plotsBought, leaks, cmd: probe ? 0 : boss.filter(b => b.leaked).length, boss, by,
    trace: trace.join(" ") };
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
  const probe = process.env.CMD === "probe";

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
      spells, spec, dt, probe });
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
  // a cell ends in "c" and a count when commanders reached the walls in its battles (each one 10 lives)
  const cmdOf = rs => rs.reduce((s, r) => s + r.cmd, 0);
  const cellOf = rs => {
    const w = rs.filter(r => r.won).length, mean = rs.reduce((s, r) => s + r.lives, 0) / rs.length;
    const c = cmdOf(rs) ? "c" + cmdOf(rs) : "";
    if (rs.length === 1) return (rs[0].won ? "W " + rs[0].lives : "L " + rs[0].wave) + c;
    return w + "/" + rs.length + (w ? " " + mean.toFixed(1) : " w" + Math.round(rs.reduce((s, r) => s + r.wave, 0) / rs.length)) + c;
  };
  const score = rs => rs.filter(r => r.won).length * 1000 + rs.reduce((s, r) => s + r.lives + r.wave * 10 * !r.won, 0) / rs.length;
  for (const diff of diffs) {
    console.log("\n" + DN[diff] + ": " + levels.length + " battlefields, " + seeds + " seed" + (seeds > 1 ? "s" : "") +
      ", spells " + (spells ? "on" : "off") + ", masteries " + spec + ", dt " + dt.toFixed(4));
    const W = 12, NW = 25;
    console.log(pad("battlefield", NW) + builds.map(b => pad(b, W)).join("") + "| best");
    const wins = {}, cmds = {}, held = {};
    let bestWins = 0, bestCmd = 0, bestHeld = 0;
    for (const lv of levels) {
      let row = pad(lv + " " + names[lv], NW).slice(0, NW), best = null;
      for (const b of builds) {
        const rs = results.filter(r => r.diff === diff && r.lv === lv && r.build === b);
        wins[b] = (wins[b] || 0) + rs.filter(r => r.won).length;
        cmds[b] = (cmds[b] || 0) + cmdOf(rs);
        held[b] = (held[b] || 0) + (rs.every(r => r.won) ? 1 : 0);
        row += pad(cellOf(rs), W);
        if (!best || score(rs) > score(best.rs)) best = { b, rs };
      }
      bestWins += best.rs.filter(r => r.won).length; bestCmd += cmdOf(best.rs); bestHeld += best.rs.every(r => r.won);
      // the rank and file's toll: the lives the best build lost apart from commanders at the walls
      const rank = best.rs.reduce((s, r) => s + r.lives + 10 * r.cmd * r.won, 0) / best.rs.length;
      console.log(row + "| " + pad(cellOf(best.rs) + " " + best.b, 22) + (cmdOf(best.rs) ? "(" + rank.toFixed(1) + " without)" : ""));
    }
    console.log(pad("wins (of " + levels.length * seeds + ")", NW) + builds.map(b => pad(wins[b], W)).join("") +
      "| " + bestWins);
    console.log(pad("held every seed", NW) + builds.map(b => pad(held[b], W)).join("") + "| " + bestHeld);
    console.log(pad("commanders at the walls", NW) + builds.map(b => pad(cmds[b], W)).join("") + "| " + bestCmd);
    if (probe) {
      // the commanders' margins: the least any seed's wave-10 commander took (as a share of its hit points),
      // then the least of the wave-20 pair; "-" where no battle reached that wave
      console.log("\ncommander margins (CMD=probe): wave 10, wave 20; the least over the seeds");
      for (const lv of levels) {
        let row = pad(lv + " " + names[lv], NW).slice(0, NW);
        for (const b of builds) {
          const bs = results.filter(r => r.diff === diff && r.lv === lv && r.build === b).flatMap(r => r.boss);
          const least = w => { const v = bs.filter(x => x.w === w).map(x => x.took); return v.length ? Math.min(...v).toFixed(2) : "-"; };
          row += pad(least(10) + " " + least(20), W);
        }
        console.log(row);
      }
    }
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
