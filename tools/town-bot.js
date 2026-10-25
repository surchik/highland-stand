// The town's balance bot (spec 14.2): plays TW in Node, no browser, and prints one row per style and difficulty.
// WP1-A's skeleton (the arguments, the game loop, the measures and the table) with WP2's styles. WP2 2c, first pass:
// steady, passive and afk are makeBot's below (the other styles play as steady for now); they live in this file,
// not in the TW region, while the sim's size budget is open, and use only TW's public API and reads of G.
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

// ---- the bot's styles (14.2), WP2 2c's first pass. A bot reads G and acts only through TW.command, as a player
// would. It lives here, not in the TW region, while the sim's size budget is open (TW.bot stays the stub). ----
function makeBot(TW, style, opts) {
  const D = TW.DATA, W = TW.W, H = TW.H, RES = ["f", "w", "s", "g"];
  const RATE = { f: 0.36, w: 0.32, s: 0.33, g: 0.28 };   // a gatherer's effective rate, with walking
  const tcOf = G => G.blds.find(b => !b.dead && b.k === "tc");
  const has = (G, k, done) => G.blds.some(b => !b.dead && b.k === k && (!done || b.done >= 1));
  const count = (G, k) => G.blds.filter(b => !b.dead && b.k === k).length;
  // commands are checked against the stock when sent and paid when applied, so a think keeps its own purse
  let purse = null, placed = false;
  const COST_K = { place: c => c.type, train: c => c.unit, research: c => c.tech, advance: () => "advance" };
  const cmd = (G, c) => {
    const ck = COST_K[c.k] && TW.cost(G, COST_K[c.k](c)), k = ck && c.k === "train" ? Object.fromEntries(RES.map(r => [r, ck[r] * c.n])) : ck;
    if (k && !RES.every(r => purse[r] >= (k[r] || 0))) return false;
    if (c.k === "place" || c.k === "wall" || c.k === "gate") { if (placed) return false; }
    if (!TW.command(G, c).ok) return false;
    if (k) for (const r of RES) purse[r] -= k[r] || 0;
    if (c.k === "place") placed = true;
    if (c.k === "wall") purse.s -= 5 * c.tiles.length;
    return true;
  };
  const can = c => !!c && RES.every(r => purse[r] >= (c[r] || 0));
  const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  const S = { i: 0, ring: null, ringAt: -1, post: null, alarmAt: -1, wsite: null, log: [], lastRepair: 0, fieldsWanted: 0 };
  // the nearest legal, roomy site to a point: a free margin of one tile around the footprint (so nothing gets
  // walled in by the bot's own buildings), optional test on the footprint's top-left
  function site(G, type, px, py, test, rmax) {
    const sz = type === "wonder" ? [5, 5] : D.BLD[type].size, occ = G.map.occ;
    const roomy = (x, y) => {
      if (type === "field" || type === "wall") return true;
      for (let yy = y - 1; yy <= y + sz[1]; yy++) for (let xx = x - 1; xx <= x + sz[0]; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (xx >= x && yy >= y && xx < x + sz[0] && yy < y + sz[1]) continue;
        const o = occ[yy * W + xx];
        if (o > 0) { const b = G.blds.find(q => q.id === o); if (b && b.k !== "wall" && b.k !== "gate") return false; }
      }
      return true;
    };
    px = Math.round(px); py = Math.round(py);
    for (let r = 0; r <= (rmax || 20); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = px + dx - (sz[0] >> 1), y = py + dy - (sz[1] >> 1);
      if ((!test || test(x, y)) && TW.canPlace(G, type, x, y, 0).ok && roomy(x, y)) return [x, y];
    }
    return null;
  }
  const place = (G, type, p) => (p ? cmd(G, { k: "place", type, x: p[0], y: p[1], rot: 0 }) : false);
  const nearest = (G, k, x, y) => { let b = null, bd = 1e9; for (const n of G.nodes) if (!n.dead && n.k === k) { const d = d2(n.x, n.y, x, y); if (d < bd) { bd = d; b = n; } } return b; };
  const insideR = (G, x, y, r) => { const tc = tcOf(G); return d2(x + 1, y + 1, tc.x + 2, tc.y + 2) <= r * r; };
  // where the raids of the age come from (the weighted zones' centers)
  function raidSide(G) {
    let x = 0, y = 0, s = 0;
    for (const z in D.RAID.zones) { const w = D.RAID.zones[z][G.age - 1]; if (!w) continue; const e = G.map.entries[z], m = e[e.length >> 1]; x += m[0] * w; y += m[1] * w; s += w; }
    return [x / s, y / s];
  }
  const toward = (G, p, dist) => { const tc = tcOf(G), cx = tc.x + 2, cy = tc.y + 2, dx = p[0] - cx, dy = p[1] - cy, d = Math.sqrt(dx * dx + dy * dy) || 1; return [cx + dx / d * dist, cy + dy / d * dist]; };
  function fieldSite(G) {
    const tc = tcOf(G), drops = G.blds.filter(b => !b.dead && (b.k === "tc" || b.k === "store"));
    let best = null, bd = 1e9;
    for (let y = 2; y < H - 4; y++) for (let x = 2; x < W - 4; x++) {
      const i = y * W + x;
      if (!G.map.fert[i]) continue;
      let dm = 1e9;
      for (const b of drops) dm = Math.min(dm, d2(x + 1.5, y + 1.5, b.x + b.w / 2, b.y + b.h / 2));
      const k = dm + 0.2 * d2(x, y, tc.x + 2, tc.y + 2);
      if (k < bd && TW.canPlace(G, "field", x, y, 0).ok && !(S.ring && ringBlocks(x, y, 3, 3))) { bd = k; best = [x, y]; }
    }
    return best;
  }
  // the ring's tiles stay free of the bot's own buildings once it is planned
  const ringBlocks = (x, y, w, h) => S.ringSet && [...Array(w * h).keys()].some(k => S.ringSet.has((y + Math.floor(k / w)) * W + x + k % w));

  // the plan: the build order of 14.2 (steady), each step done once it can be paid
  const P = [];
  const step = (k, a) => P.push(Object.assign({ k }, a || {}));
  step("place", { type: "store", at: G => { const tc = tcOf(G), t = nearest(G, "tree", tc.x + 2, tc.y + 2); return t ? [t.x, t.y] : [tc.x - 6, tc.y]; } });
  step("place", { type: "house", at: G => { const tc = tcOf(G); return [tc.x + 2, tc.y + 6]; } });
  step("field"); step("field");
  step("place", { type: "barracks", at: G => { const tc = tcOf(G); return toward(G, raidSide(G), 5); } });
  step("field");
  step("place", { type: "smithy", at: G => { const tc = tcOf(G); return [tc.x + 7, tc.y + 2]; } });
  step("tech", { id: "iron_tools" });
  step("place", { type: "store", at: G => { const f = G.blds.filter(b => !b.dead && b.k === "field"); if (!f.length) return null; let x = 0, y = 0; for (const b of f) { x += b.x + 1.5; y += b.y + 1.5; } return [x / f.length, y / f.length]; }, rmax: 8 });
  step("field");
  step("place", { type: "tower", at: G => toward(G, raidSide(G), 6) });
  step("advance", { to: 2 });
  step("ring");
  step("place", { type: "market", at: G => { const tc = tcOf(G), r = G.map.road, p = r[Math.max(0, r.length - 6)]; return [p[0] + 2, p[1]]; } });
  step("place", { type: "temple", at: G => { const tc = tcOf(G); return [tc.x - 4, tc.y + 2]; } });
  step("advance", { to: 3 });
  step("tech", { id: "stone_domes" });
  step("place", { type: "tower", at: G => toward(G, raidSide(G), 7) });
  step("tech", { id: "land_survey" });
  step("place", { type: "store", at: G => { const tc = tcOf(G), n = nearest(G, "stone", tc.x + 2, tc.y + 2); return n ? [n.x, n.y] : null; }, rmax: 6 });
  step("wsite");
  step("place", { type: "tower", at: G => S.wsite && [S.wsite[0] - 2, S.wsite[1] + 2], rmax: 4 });
  step("place", { type: "tower", at: G => S.wsite && [S.wsite[0] + 6, S.wsite[1] + 2], rmax: 4 });
  step("wonder");
  const costOf = (G, s) => s.k === "place" ? TW.cost(G, s.type) : s.k === "field" ? TW.cost(G, "field") : s.k === "tech" ? TW.cost(G, s.id) :
    s.k === "advance" ? TW.cost(G, "advance") : s.k === "wonder" ? TW.cost(G, "wonder") : s.k === "ring" ? { f: 0, w: 0, s: 5 * 45 + 60, g: 0 } : { f: 0, w: 0, s: 0, g: 0 };
  function doStep(G, s) {
    const tc = tcOf(G);
    switch (s.k) {
      case "place": { const p0 = s.at(G); if (!p0) return 2; const p = site(G, s.type, p0[0], p0[1], (x, y) => !ringBlocks(x, y, D.BLD[s.type].size[0], D.BLD[s.type].size[1]), s.rmax); return p ? (place(G, s.type, p) ? 1 : 0) : (s.miss = (s.miss | 0) + 1) > 30 ? 2 : 0; }
      case "field": { const p = fieldSite(G); return p ? (place(G, "field", p) ? 1 : 0) : 2; }
      case "tech": return G.techs[s.id] || G.blds.some(b => b.rq.some(q => q.tech === s.id)) ? 2 : cmd(G, { k: "research", tech: s.id }) ? 1 : 0;
      case "advance": {
        if (G.age >= s.to) return 2;
        if (G.aging) return 0;
        // a building the advance needs was lost: put it up again first
        for (const k of D.AGES[s.to - 1].advance.req) if (!has(G, k)) { const st = P.find(q => q.type === k), p0 = st && st.at(G), p = p0 && site(G, k, p0[0], p0[1]); if (p) place(G, k, p); return 0; }
        return cmd(G, { k: "advance" }) ? 1 : 0;
      }
      case "ring": {
        const R = TW.suggestRing(G);
        if (!R.gate) return 2;
        for (const st of R.strokes) { placed = false; cmd(G, { k: "wall", tiles: st }); }
        for (const g of R.gates) { placed = false; cmd(G, { k: "gate", x: g.x, y: g.y, rot: g.rot }); }
        S.ring = R; S.ringSet = new Set(); for (const st of R.strokes) for (const [x, y] of st) S.ringSet.add(y * W + x);
        S.ringN = S.ringSet.size + 2 * R.gates.length;
        return 2;
      }
      case "wsite": {   // Zvartnots: out on the plain, 10 to 14 tiles from the palace, away from the raids
        if (!G.techs.stone_domes) return 0;
        const rs = raidSide(G), cx = tc.x + 2, cy = tc.y + 2;
        let best = null, bd = 1e9;
        const keep = G.res; G.res = { f: 1e9, w: 1e9, s: 1e9, g: 1e9 };
        for (let y = 3; y < H - 8; y++) for (let x = 3; x < W - 8; x++) {
          const dd = d2(x + 2.5, y + 2.5, cx, cy);
          if (dd < 110 || dd > 200) continue;
          if (!TW.canPlace(G, "wonder", x, y, 0).ok) continue;
          const k = dd - 0.3 * d2(x + 2.5, y + 2.5, rs[0], rs[1]);
          if (k < bd) { bd = k; best = [x, y]; }
        }
        G.res = keep;
        S.wsite = best;
        return 2;
      }
      case "wonder": {
        if (!S.wsite || !TW.canPlace(G, "wonder", S.wsite[0], S.wsite[1], 0).ok) { const keep = S.wsite; doStep(G, { k: "wsite" }); if (!S.wsite) S.wsite = keep; }
        return S.wsite && cmd(G, { k: "place", type: "wonder", x: S.wsite[0], y: S.wsite[1], rot: 0 }) ? 1 : 0;
      }
    }
    return 2;
  }
  // the next raid's points (6.6), for the garrison's size
  function nextPts(G) {
    const ri = TW.raidInfo(G);
    if (ri.warn.length) return ri.warn[0].pts;
    const Df = D.DIFFS[G.diff], m = ri.nextSpawn * TW.DT / 60, a = G.age - 1;
    let p = Math.round(Df.mult * (D.RAID.A[a] + D.RAID.B[a] * m));
    if (G.wonder) p = Math.round(p * Df.wonderMult);
    return p;
  }
  // labor: workers in proportion to what the next goals still need (in gathering time), with a reserve for the
  // houses, fields and training that never stop, and a floor on each resource; one move a think
  function labor(G, need) {
    const L = TW.labor(G), V = L.f + L.w + L.s + L.g;
    const dem = {};
    for (const r of RES) dem[r] = (Math.max(0, (need[r] || 0) - G.res[r]) + RESERVE[r]) / RATE[r];
    const tot = RES.reduce((a, r) => a + dem[r], 0) || 1, floor = { f: 4, w: 3, s: G.tick > 1200 ? 1 : 0, g: G.tick > 1200 ? 1 : 0 };
    const want = {};
    for (const r of RES) want[r] = Math.max(floor[r], V * dem[r] / tot);
    const order = RES.slice().sort((a, b) => (want[b] - L[b]) - (want[a] - L[a]));
    for (let k = 0; k < Math.min(4, L.idle); k++) for (const r of order.concat(["f", "w"])) if (TW.command(G, { k: "labor", res: r, delta: 1 }).ok) { L[r]++; break; }
    const hi = order[0], lo = order[3];
    if (want[hi] - L[hi] >= 1.2 && L[lo] - want[lo] >= 0.8 && L[lo] > floor[lo]) { TW.command(G, { k: "labor", res: lo, delta: -1 }); TW.command(G, { k: "labor", res: hi, delta: 1 }); }
  }
  const RESERVE = { f: 120, w: 80, s: 20, g: 0 };
  function garrison(G) {
    const gar = G.units.filter(u => !u.dead && u.side === 0 && u.k !== "vil"), want = Math.min(16, 3 + Math.floor(nextPts(G) / 3));
    if (gar.length >= want || G.popCap - TW.labor(G).pop <= 0) return;
    const n = k => gar.filter(u => u.k === k).length;
    let k = n("spear") * 2 < want ? "spear" : n("bow") * 3 < want ? "bow" : G.age >= 2 && has(G, "stable", true) ? "horse" : "spear";
    const at = G.blds.filter(b => !b.dead && b.done >= 1 && b.k === (k === "horse" ? "stable" : "barracks")).sort((a, b) => a.q.length - b.q.length)[0];
    if (at && at.q.length < 2) cmd(G, { k: "train", bld: at.id, unit: k, n: 1 });
  }
  function defend(G) {
    const ri = TW.raidInfo(G), tc = tcOf(G), cx = tc.x + 2, cy = tc.y + 2, raiders = G.units.filter(u => !u.dead && u.side === 1 && !u.flee);
    const gar = G.units.filter(u => !u.dead && u.side === 0 && u.k !== "vil").length;
    const near = raiders.filter(u => Math.abs(u.x - cx) + Math.abs(u.y - cy) < 18);
    // the post: on the building under attack nearest the palace, else the raiders' middle near the town, else the
    // gate facing the warned raid (or toward it from the palace); home when all is quiet
    let p = null;
    const hit = raiders.map(u => (u.st === 12 || u.st === 11) && G.blds.find(b => b.id === u.tgt && !b.dead)).filter(Boolean).sort((a, b) => d2(a.x, a.y, cx, cy) - d2(b.x, b.y, cx, cy))[0];
    if (hit && d2(hit.x, hit.y, cx, cy) < 18 * 18) p = [hit.x + (hit.w >> 1), hit.y + hit.h];
    else if (near.length) { let x = 0, y = 0; for (const u of near) { x += u.x; y += u.y; } p = [x / near.length, y / near.length]; }
    else {
      const zone = ri.warn.length ? ri.warn[0].zones[0] : null;
      if (zone) {
        const e = G.map.entries[zone], m = e[e.length >> 1];
        p = toward(G, m, 4);
        if (S.ring && S.ring.gates.length) { const g = S.ring.gates.slice().sort((a, b) => d2(a.x, a.y, m[0], m[1]) - d2(b.x, b.y, m[0], m[1]))[0]; p = toward(G, [g.x, g.y], Math.max(2, Math.sqrt(d2(g.x, g.y, cx, cy)) - 2)); }
      } else if (!raiders.length) p = [cx, cy + 3];
    }
    if (p && G.tick - (S.postAt || -99) >= 30) {
      p = [Math.round(p[0]), Math.round(p[1])];
      if (p[0] !== G.post.x || p[1] !== G.post.y) cmd(G, { k: "post", x: p[0], y: p[1], hold: false });
      S.postAt = G.tick;
    }
    // the alarm as soon as raiders come within 16 tiles of a villager at work (they shelter before the raiders see
    // them); all clear once none is that near
    // (behind a finished ring the villagers keep working: a raider outside it cannot reach them)
    const inR = u => { if (!S.ring) return false; const dx = Math.abs(u.x - cx), dy = Math.abs(u.y - cy), R = S.ring.r; return dx < R - 1 && dy < R - 1 && dx + dy < R * 1.39 - 1.5; };
    const ringUp = S.ring && G.blds.filter(b => !b.dead && (b.k === "wall" || b.k === "gate")).length >= S.ringN * 0.9;
    const exposed = (r, v, d) => Math.abs(v.x - r.x) < d && Math.abs(v.y - r.y) < d && !(ringUp && inR(v) && !inR(r));
    const vils = G.units.filter(u => !u.dead && u.k === "vil" && !u.shel);
    if (!G.alarm.on && raiders.some(r => vils.some(v => exposed(r, v, 16)))) { cmd(G, { k: "alarm", on: true, all: false }); S.alarmAt = G.tick; }
    else if (G.alarm.on && G.tick - S.alarmAt > 50 && !raiders.some(r => G.units.some(v => !v.dead && v.k === "vil" && exposed(r, v, opts.clearAt || 14)))) cmd(G, { k: "alarm", on: false, all: false });
    // repairs after a raid: the two nearest workers to the most damaged building
    if (!raiders.length && G.tick - S.lastRepair > 50) {
      const b = G.blds.filter(q => !q.dead && q.done >= 1 && q.k !== "wonder" && q.hp < q.hpMax * 0.75 && !q.builders.length).sort((a, c) => a.hp / a.hpMax - c.hp / c.hpMax)[0];
      if (b) {
        const vs = G.units.filter(u => !u.dead && u.k === "vil" && u.task && (u.task.t === "gather" || u.task.t === "farm")).sort((a, c) => d2(a.x, a.y, b.x, b.y) - d2(c.x, c.y, b.x, b.y)).slice(0, 2);
        if (vs.length) cmd(G, { k: "task", ids: vs.map(u => u.id), target: b.id });
        S.lastRepair = G.tick;
      }
    }
  }
  const VIL_CAP = opts.vilCap || [26, 40, 50];
  function steady(G) {
    const tc = tcOf(G);
    if (!tc) return;
    const L = TW.labor(G), vil = G.units.filter(u => !u.dead && u.k === "vil").length;
    // the town center trains while the villagers are under the age's cap and the plan is not waiting for food
    const s0 = P[S.i], c0 = s0 && costOf(G, s0), wait = c0 && c0.f > 0 && G.res.f < c0.f && RES.every(r => r === "f" || G.res[r] >= (c0[r] || 0));
    const on = vil < VIL_CAP[G.age - 1] && !wait;
    if (tc.auto !== on) cmd(G, { k: "auto", bld: tc.id, on });
    // houses at 2 or less room
    if (G.popCap < 60 && G.popCap - L.pop <= 2 + Math.floor(L.pop / 15) && !G.blds.some(b => !b.dead && b.k === "house" && b.done < 1)) {
      if (can(TW.cost(G, "house"))) place(G, "house", site(G, "house", tc.x + 2, tc.y + 2, (x, y) => !ringBlocks(x, y, 2, 2) && insideR(G, x, y, 7.5)) || site(G, "house", tc.x + 2, tc.y + 2, (x, y) => !ringBlocks(x, y, 2, 2)));
    }
    // the plan: one step at a time; a step sent is checked on the next thinks (a dropped command is sent again)
    const s = P[S.i];
    if (s && S.pend) {
      const done = s.k === "place" || s.k === "field" ? count(G, s.type || "field") > S.pend.n : s.k === "tech" ? G.techs[s.id] || G.blds.some(b => b.rq.some(q => q.tech === s.id))
        : s.k === "advance" ? (G.aging && G.aging.to === s.to) || G.age >= s.to : s.k === "wonder" ? !!G.wonder : true;
      if (done) { S.log.push([Math.round(G.tick / 10), s.k + (s.type ? ":" + s.type : s.id ? ":" + s.id : "")]); S.i++; S.pend = null; }
      else if (G.tick - S.pend.at > 40) S.pend = null;
    } else if (s) {
      const n = count(G, s.type || "field"), r = can(costOf(G, s)) ? doStep(G, s) : 0;
      if (r === 1) S.pend = { at: G.tick, n };
      else if (r === 2) { S.log.push([Math.round(G.tick / 10), s.k + (s.type ? ":" + s.type : s.id ? ":" + s.id : "") + "/skip"]); S.i++; }
    }
    // more fields while food work runs short (a food worker with nothing to do)
    const foodRoom = G.nodes.filter(n => !n.dead && (n.k === "flock" || n.k === "orchard") && n.left > 20).length * 1.4 + G.blds.filter(b => !b.dead && b.k === "field").length;
    if (L.f + 1 >= foodRoom && can(TW.cost(G, "field")) && !G.blds.some(b => !b.dead && b.k === "field" && b.done < 1)) { const p = fieldSite(G); if (p) place(G, "field", p); }
    // a foundation nobody builds gets its builders again
    if (G.tick % 100 === 3) for (const b of G.blds) if (!b.dead && b.done < 1 && !b.builders.length && b.k !== "wall") cmd(G, { k: "builders", bld: b.id, n: b.k === "wonder" ? 14 : 2 });
    // the wonder's builders
    if (G.wonder) { const w = G.blds.find(b => b.id === G.wonder); if (w && w.builders.length < 14) cmd(G, { k: "builders", bld: w.id, n: 14 }); }
    garrison(G);
    defend(G);
    // labor by the deficits of the next two goals, plus food for the villagers in training
    const need = { f: 100, w: 0, s: 0, g: 0 };
    for (let k = S.i; k < Math.min(P.length, S.i + 4); k++) { const c = costOf(G, P[k]); for (const r of RES) need[r] += c[r] || 0; }
    if (G.age >= 2 && !G.wonder) { const c = D.WONDERS[2].cost; for (const r of RES) need[r] += (c[r] || 0) * (G.age === 2 ? 0.3 : 0.6); }
    if (G.wonder) { need.f += 50; need.w += 50; need.s += 100; need.g += 50; }
    labor(G, need);
  }
  function passive(G) {
    const tc = tcOf(G), L = TW.labor(G);
    if (G.popCap < 60 && G.popCap - L.pop <= 2 && !G.blds.some(b => !b.dead && b.k === "house" && b.done < 1) && can(TW.cost(G, "house"))) place(G, "house", site(G, "house", tc.x + 2, tc.y + 2));
    const foodRoom = G.nodes.filter(n => !n.dead && (n.k === "flock" || n.k === "orchard") && n.left > 20).length * 1.4 + G.blds.filter(b => !b.dead && b.k === "field").length;
    if (L.f + 1 >= foodRoom && can(TW.cost(G, "field")) && !G.blds.some(b => !b.dead && b.k === "field" && b.done < 1)) { const p = fieldSite(G); if (p) place(G, "field", p); }
    if (L.idle) cmd(G, { k: "labor", res: L.f <= L.w * 2 ? "f" : "w", delta: 1 });
  }
  return {
    style, S, plan: P,
    think(G) {
      if (G.over || G.tick % 10 !== 3) return;
      purse = Object.assign({}, G.res); placed = false;
      if (style === "afk") return;
      if (style === "passive") passive(G); else steady(G);
    },
  };
}


function play(diff, style, seed) {
  const t0 = process.hrtime.bigint();
  const G = TW.newGame({ seed, diff, firstTown: false });
  const bot = makeBot(TW, style, { seed });
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
      else if (e.e === "raidSpawn") { m.raids++; if (raidLost !== null) m.vilLostPerRaid.push(raidLost); raidLost = 0; if (m.raids === 1) { m.r1 = e.raid; m.v1 = G.units.filter(u => !u.dead && u.k === "vil").length; } }
      else if ((e.e === "raidRepelled" || e.e === "raidPlunder" || e.e === "raidLeft") && e.raid === m.r1) m.alive1 = G.units.filter(u => !u.dead && u.k === "vil").length + "/" + m.v1;
      else if (e.e === "raidRepelled") m.repelled++;
      else if (e.e === "destroyed") m.bldLost++;
      else if (e.e === "fell" && e.k === "vil" && raidLost !== null) raidLost++;
      else if (e.e === "pillage") m.pillaged += e.n || 0;
      else if (e.e === "ageDone" || e.e === "win" || e.e === "lose") m.milestones[e.e === "ageDone" ? "age" + e.age : e.e] = +(e.t * DT).toFixed(1);
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
  m.age = G.age; m.stuck = G.stats.stuck | 0; m.pillaged = Math.round(G.stats.pillaged || 0);
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
    wood: Math.round(median(games.map(g => g.woodLeft))), pillaged: median(games.map(g => g.pillaged)), stuck: games.reduce((a, g) => a + g.stuck, 0),
    a2: mmss(median(games.map(g => g.milestones.age2).filter(x => x != null))), a3: mmss(median(games.map(g => g.milestones.age3).filter(x => x != null))),
    wb: mmss(median(games.map(g => g.milestones.wonder).filter(x => x != null))),
    lostEnd: games.filter(g => !g.win && g.endS != null).map(g => mmss(g.endS)).join(" ") || "-",
    alive1: games.map(g => g.alive1 === undefined ? "-" : g.alive1).join(" "),
    ms: Math.round(median(games.map(g => g.ms))),
  });
}
const cols = [["style", 8], ["diff", 7], ["wins", 6], ["stars", 7], ["end", 22], ["a2", 6], ["a3", 6], ["wb", 6], ["age", 4], ["vil", 4], ["gar", 4],
  ["repelled", 9], ["bldLost", 8], ["lostRaid", 9], ["shelS", 6], ["idleS", 6], ["wood", 6], ["pillaged", 9], ["stuck", 6], ["ms", 6], ["lostEnd", 12], ["alive1", 8]];
console.log(cols.map(([k, w]) => k.padEnd(w)).join(" "));
for (const r of rows) console.log(cols.map(([k, w]) => String(r[k] === null ? "-" : r[k]).padEnd(w)).join(" "));
console.log("(stars: 1/2/3-star wins; end: median win time and range; a2, a3, wb: median Age 2, Age 3 and wonder begun; " +
  "lostRaid: villagers lost per raid, median/max; shelS, idleS: villager-seconds; wood: wood left standing; lostEnd: the " +
  "times of the losses; alive1: villagers alive after raid 1 per game, of those at its spawn; MAX_MIN " + MAX_MIN + ")");
