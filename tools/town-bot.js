// The town's balance bot (spec 14.2): plays TW in Node, no browser, with the styles of TW.bot, and prints one row
// per style and difficulty. WP1-A's skeleton: the arguments, the game loop, the measures and the table; WP2 fills
// TW.bot's styles and tunes TW.DATA against the acceptance matrix (and may grow this tool).
//
// Usage:  node tools/town-bot.js [diffs] [styles] [seeds]
//   diffs   easy,normal,hard | all          (default normal)
//   styles  steady,passive,afk,rush1,rush2,greedy,turtle,seal | all   (default steady,passive)
//   seeds   a count (default 10, seeds 1..n) or a list "4821,77"
// Env:  JSON=1 (one line per game: milestones, raids, losses, timings)  PATCH='TW.DATA.GATHER.tree = 0.4'
//       MAX_MIN=40 (stop a game at this game time)  GAME=path (another index.html)
//       MAPS=n (instead of games: generate the maps of seeds 1..n and report how many were valid, the attempts
//       the generator needed, the fields that fit and the time per map)
// All bots play with firstTown off. A bot acts only through TW.command, as a player would.
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
  const bot = TW.bot.create(style, { seed });
  const m = { seed, diff: DIFFS[diff], style, win: false, stars: 0, endS: null, cause: "", age: 1, peakVil: 0, peakGar: 0,
    raids: 0, repelled: 0, bldLost: 0, vilLostPerRaid: [], shelteredS: 0, idleS: 0, woodLeft: 0, pillaged: 0, stuck: null,
    milestones: {}, tickMs: [] };
  let raidLost = null;
  const stop = Math.round(MAX_MIN * 60 / DT);
  while (!G.over && G.tick < stop) {
    bot.think(G);
    const a = process.hrtime.bigint();
    TW.tick(G);
    if (G.tick % 50 === 0) m.tickMs.push(Number(process.hrtime.bigint() - a) / 1e6);
    for (const e of TW.drain(G)) {
      if (e.e === "ageDone") m.milestones["age" + e.age] = +(e.t * DT).toFixed(1);
      else if (e.e === "wonderBegin") m.milestones.wonder = +(e.t * DT).toFixed(1);
      else if (e.e === "raidSpawn") { m.raids++; if (raidLost !== null) m.vilLostPerRaid.push(raidLost); raidLost = 0; }
      else if (e.e === "raidRepelled") m.repelled++;
      else if (e.e === "destroyed") m.bldLost++;
      else if (e.e === "fell" && e.k === "vil" && raidLost !== null) raidLost++;
      else if (e.e === "pillage") m.pillaged += e.n || 0;
    }
    if (G.tick % SEC === 0) {
      const L = TW.labor(G);
      m.shelteredS += L.sheltered; m.idleS += L.idle;
      let vil = 0, gar = 0;
      for (const u of G.units) if (!u.dead && u.side === 0) { if (u.k === "vil") vil++; else gar++; }
      m.peakVil = Math.max(m.peakVil, vil); m.peakGar = Math.max(m.peakGar, gar);
    }
  }
  if (raidLost !== null) m.vilLostPerRaid.push(raidLost);
  if (G.over) { m.win = G.over.win; m.stars = G.over.stars | 0; m.cause = G.over.cause; m.endS = +(G.over.tick * DT).toFixed(1); }
  m.age = G.age;
  for (const n of G.nodes) if (!n.dead && n.k === "tree") m.woodLeft += n.left;
  m.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  m.tickP99 = m.tickMs.length ? m.tickMs.slice().sort((x, y) => x - y)[Math.floor(m.tickMs.length * 0.99)] : 0;
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
  rows.push({
    style: s, diff: d, wins: wins.length + "/" + games.length,
    stars: wins.length ? [1, 2, 3].map(k => wins.filter(g => g.stars === k).length).join("/") : "-",
    end: ends.length ? mmss(median(ends)) + " (" + mmss(Math.min(...ends)) + "-" + mmss(Math.max(...ends)) + ")" : "-",
    age: median(games.map(g => g.age)), vil: median(games.map(g => g.peakVil)), gar: median(games.map(g => g.peakGar)),
    repelled: median(games.map(g => g.repelled)), bldLost: median(games.map(g => g.bldLost)),
    lostRaid: lost.length ? median(lost) + "/" + Math.max(...lost) : "-",
    shelS: median(games.map(g => g.shelteredS)), idleS: median(games.map(g => g.idleS)),
    wood: Math.round(median(games.map(g => g.woodLeft))), pillaged: median(games.map(g => g.pillaged)), stuck: "-",
    ms: Math.round(median(games.map(g => g.ms))),
  });
}
const cols = [["style", 8], ["diff", 7], ["wins", 6], ["stars", 7], ["end", 22], ["age", 4], ["vil", 4], ["gar", 4],
  ["repelled", 9], ["bldLost", 8], ["lostRaid", 9], ["shelS", 6], ["idleS", 6], ["wood", 6], ["pillaged", 9], ["stuck", 6], ["ms", 6]];
console.log(cols.map(([k, w]) => k.padEnd(w)).join(" "));
for (const r of rows) console.log(cols.map(([k, w]) => String(r[k] === null ? "-" : r[k]).padEnd(w)).join(" "));
console.log("(stars: 1/2/3-star wins; end: median win time and range; lostRaid: villagers lost per raid, median/max; " +
  "shelS, idleS: villager-seconds; wood: wood left standing; MAX_MIN " + MAX_MIN + ")");
