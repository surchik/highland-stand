// The town's balance bot (spec 14.2): plays TW in Node, no browser, with the styles of TW.bot, and prints one row
// per style and difficulty. WP1-A's skeleton (the arguments, the game loop, the measures and the table), grown by
// WP2 2c: the styles live in the sim region (TW.bot.create), so this tool and selftest check 9 play the same bot.
//
// Usage:  node tools/town-bot.js [diffs] [styles] [seeds]
//   diffs   easy,normal,hard | all          (default normal)
//   styles  steady,passive,afk,rush1,rush2,greedy,turtle,seal | all   (default steady,passive)
//   seeds   a count (default 10, seeds 1..n) or a list "4821,77"
// Env:  JSON=1 (one line per game: milestones, raids, losses, timings)  PATCH='TW.DATA.GATHER.tree = 0.4'
//       MAX_MIN=40 (stop a game at this game time)  GAME=path (another index.html)
//       BOT='{"pace":3,"careless":true}' (bot options: think every 3 s; no towers, no ring, the post left at home)
//       MAPS=n (instead of games: generate the maps of seeds 1..n and report how many were valid, the attempts
//       the generator needed, the fields that fit and the time per map)
// All bots play with firstTown off. A bot acts only through TW.command, as a player would.
// Villagers lost per raid: each death is put to the raid whose kill count rose in that tick (raids overlap on Hard).
const path = require("path");
const townExtract = require("./town-extract.js");

const DIFFS = ["easy", "normal", "hard"];
const STYLES = ["steady", "passive", "afk", "rush1", "rush2", "greedy", "turtle", "seal"];
const list = (arg, all, dflt) => (!arg ? dflt : arg === "all" ? all.slice() : arg.split(",").map(s => s.trim()).filter(Boolean));
const [aDiffs, aStyles, aSeeds] = process.argv.slice(2);
const diffs = list(aDiffs, DIFFS, ["normal"]);
const styles = list(aStyles, STYLES, ["steady", "passive"]);
for (const d of diffs) if (!DIFFS.includes(d)) { console.error("unknown difficulty: " + d); process.exit(2); }
for (const s of styles) if (!STYLES.includes(s)) { console.error("unknown style: " + s); process.exit(2); }
const seeds = !aSeeds ? [...Array(10).keys()].map(i => i + 1)
  : /^\d+$/.test(aSeeds) ? [...Array(+aSeeds).keys()].map(i => i + 1) : aSeeds.split(",").map(Number);
const MAX_MIN = +(process.env.MAX_MIN || 40);
const BOT = process.env.BOT ? JSON.parse(process.env.BOT) : {};   // bot options, e.g. BOT='{"pace":3,"careless":true}'


const { TW } = townExtract(process.env.GAME ? path.resolve(process.env.GAME) : undefined);
if (process.env.PATCH) new Function("TW", process.env.PATCH)(TW);
const DT = TW.DT, SEC = Math.round(1 / DT);
if (process.env.MAPS) {
  const n = +process.env.MAPS, tries = {}, fields = [], bad = [];
  const t0 = process.hrtime.bigint();
  for (let seed = 1; seed <= n; seed++) {
    const m = TW.mapGen(seed);
    if (!m.valid) bad.push(seed);
    tries[m.attempt + 1] = (tries[m.attempt + 1] || 0) + 1;
    fields.push(m.fields);
  }
  fields.sort((a, b) => a - b);
  console.log("maps " + n + ": valid " + (n - bad.length) + (bad.length ? " (invalid: " + bad.slice(0, 20).join(",") + ")" : "") +
    "; attempts " + JSON.stringify(tries) + "; fields min " + fields[0] + ", median " + fields[n >> 1] + ", max " + fields[n - 1] +
    "; " + (Number(process.hrtime.bigint() - t0) / 1e6 / n).toFixed(2) + " ms a map");
  process.exit(bad.length ? 1 : 0);
}

function play(diff, style, seed) {
  const t0 = process.hrtime.bigint();
  const G = TW.newGame({ seed, diff, firstTown: false });
  const bot = TW.bot.create(style, Object.assign({ seed }, BOT));
  const m = { seed, diff: DIFFS[diff], style, win: false, stars: 0, endS: null, cause: "", age: 1, peakVil: 0, peakGar: 0,
    raids: 0, repelled: 0, bldLost: 0, vilLostPerRaid: [], shelteredS: 0, idleS: 0, vilS: 0, woodLeft: 0, pillaged: 0,
    stuck: null, milestones: {}, tickMs: [] };
  const byRaid = new Map(), raidIds = [];
  const stop = Math.round(MAX_MIN * 60 / DT);
  while (!G.over && G.tick < stop) {
    bot.think(G);
    const kl0 = new Map();
    for (const r of G.raids) kl0.set(r.id, r.kl | 0);
    const a = process.hrtime.bigint();
    TW.tick(G);
    m.tickMs.push(Number(process.hrtime.bigint() - a) / 1e6);
    const up = [];
    for (const r of G.raids) for (let k = (kl0.get(r.id) || 0); k < (r.kl | 0); k++) up.push(r.id);
    for (const e of TW.drain(G)) {
      if (e.e === "ageDone") m.milestones["age" + e.age] = +(e.t * DT).toFixed(1);
      else if (e.e === "wonderBegin") m.milestones.wonder = +(e.t * DT).toFixed(1);
      else if (e.e === "raidSpawn") {
        m.raids++; raidIds.push(e.raid);
        if (m.raids === 1) { m.r1 = e.raid; m.v1 = G.units.filter(u => !u.dead && u.k === "vil").length; }
      } else if ((e.e === "raidRepelled" || e.e === "raidPlunder" || e.e === "raidLeft") && e.raid === m.r1) m.alive1 = G.units.filter(u => !u.dead && u.k === "vil").length + "/" + m.v1;
      if (e.e === "raidRepelled") m.repelled++;
      else if (e.e === "destroyed") m.bldLost++;
      else if (e.e === "fell" && e.k === "vil") { const id = up.length ? up.shift() : 0; if (id) byRaid.set(id, (byRaid.get(id) || 0) + 1); }
      else if (e.e === "win" || e.e === "lose") m.milestones[e.e] = +(e.t * DT).toFixed(1);
    }
    if (G.tick % SEC === 0) {
      const L = TW.labor(G);
      m.shelteredS += L.sheltered; m.idleS += L.idle;
      let vil = 0, gar = 0;
      for (const u of G.units) if (!u.dead && u.side === 0) { if (u.k === "vil") vil++; else gar++; }
      m.vilS += vil;
      m.peakVil = Math.max(m.peakVil, vil); m.peakGar = Math.max(m.peakGar, gar);
    }
  }
  m.vilLostPerRaid = raidIds.map(id => byRaid.get(id) || 0);
  if (G.over) { m.win = G.over.win; m.stars = G.over.stars | 0; m.cause = G.over.cause; m.endS = +(G.over.tick * DT).toFixed(1); }
  m.age = G.age; m.stuck = G.stats.stuck | 0; m.pillaged = Math.round(G.stats.pillaged || 0); m.fallen = G.stats.fallen;
  for (const n of G.nodes) if (!n.dead && n.k === "tree") m.woodLeft += n.left;
  m.woodLeft = Math.round(m.woodLeft);
  m.ms = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
  const t = m.tickMs.sort((x, y) => x - y);
  m.tickP50 = +t[Math.floor(t.length * 0.5)].toFixed(3); m.tickP99 = +t[Math.floor(t.length * 0.99)].toFixed(3); m.tickMax = +t[t.length - 1].toFixed(2);
  delete m.tickMs;
  return m;
}

const mmss = s => (s === null || s === undefined ? "-" : Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"));
const median = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.floor((b.length - 1) / 2)]; };
const rows = [];
for (const d of diffs) for (const s of styles) {
  const games = seeds.map(seed => play(DIFFS.indexOf(d), s, seed));
  if (process.env.JSON) for (const g of games) console.log(JSON.stringify(g));
  const wins = games.filter(g => g.win), ends = wins.map(g => g.endS), lost = games.flatMap(g => g.vilLostPerRaid);
  const pct = k => (100 * median(games.map(g => g[k] / Math.max(1, g.vilS)))).toFixed(1) + "%";
  rows.push({
    style: s, diff: d, wins: wins.length + "/" + games.length,
    stars: wins.length ? [1, 2, 3].map(k => wins.filter(g => g.stars === k).length).join("/") : "-",
    end: ends.length ? mmss(median(ends)) + " (" + mmss(Math.min(...ends)) + "-" + mmss(Math.max(...ends)) + ")" : "-",
    age: median(games.map(g => g.age)), vil: median(games.map(g => g.peakVil)), gar: median(games.map(g => g.peakGar)),
    repelled: median(games.map(g => g.repelled)), bldLost: median(games.map(g => g.bldLost)),
    lostRaid: lost.length ? median(lost) + "/" + Math.max(...lost) : "-",
    shelS: median(games.map(g => g.shelteredS)), shel: pct("shelteredS"), idleS: median(games.map(g => g.idleS)), idle: pct("idleS"),
    wood: median(games.map(g => g.woodLeft)), woodMin: wins.length ? Math.min(...wins.map(g => g.woodLeft)) : "-",
    pillaged: median(games.map(g => g.pillaged)), stuck: games.reduce((a, g) => a + g.stuck, 0),
    a2: mmss(median(games.map(g => g.milestones.age2).filter(x => x != null))), a3: mmss(median(games.map(g => g.milestones.age3).filter(x => x != null))),
    wb: mmss(median(wins.map(g => g.milestones.wonder).filter(x => x != null))),
    lostEnd: games.filter(g => !g.win).map(g => (g.endS == null ? "open" : mmss(g.endS))).join(" ") || "-",
    alive1: games.map(g => g.alive1 === undefined ? "-" : g.alive1).join(" "),
    ms: median(games.map(g => g.ms)), p99: Math.max(...games.map(g => g.tickP99)).toFixed(2),
  });
}
const cols = [["style", 8], ["diff", 7], ["wins", 6], ["stars", 8], ["end", 22], ["a2", 6], ["a3", 6], ["wb", 6], ["age", 4], ["vil", 4], ["gar", 4],
  ["repelled", 9], ["bldLost", 8], ["lostRaid", 9], ["shelS", 6], ["shel", 6], ["idleS", 6], ["idle", 5], ["wood", 6], ["woodMin", 8], ["pillaged", 9],
  ["stuck", 6], ["ms", 6], ["p99", 5], ["lostEnd", 12], ["alive1", 8]];
console.log(cols.map(([k, w]) => k.padEnd(w)).join(" "));
for (const r of rows) console.log(cols.map(([k, w]) => String(r[k] === null ? "-" : r[k]).padEnd(w)).join(" "));
console.log("(stars: 1/2/3-star wins; end: median win time and range; a2, a3: median Age 2 and Age 3; wb: median wonder begun " +
  "in the wins; lostRaid: villagers lost per raid, median/max; shelS, idleS: villager-seconds (median), shel, idle: their " +
  "share of villager time; wood: wood left standing (woodMin: least at a win); ms: per game; p99: worst game's tick p99 " +
  "in ms; lostEnd: the times of the losses (open: none by MAX_MIN); alive1: villagers alive after raid 1 per game, of " +
  "those at its spawn; MAX_MIN " + MAX_MIN + ")");
