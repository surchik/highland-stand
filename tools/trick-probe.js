// The enemy's tricks, battlefield by battlefield and difficulty by difficulty, as the game's own data and rules
// lay them out (L.tricks, TRICK_RULES in index.html): what a balancer or a reviewer checks before a run.
//   - each ambush road: its own stretch (where it leaves the main roads and where it joins one again), its clearance
//     from every pad and plot (fails under 45), its margin from a lake (fails under 20), and the pads and plots that
//     reach 60 px of it at 152 and at 188 (fails under two: two pads, or a pad and a plot)
//   - each battlefield with hidden scouts: the watch slot's best pad and how much of the last 40% of each road a
//     first-rank watch tower there reveals
//   - the timeline: the waves of the ambush's tell and opening, the scouts, the hunters, the guards and the adaptive
//     enemy's first wave, commander waves marked "!"
//   - the teaching order of the first six: each teaches at most one trick not met before, the shields before the
//     enemy adapts with them (fails otherwise)
// Usage:  NODE_PATH=$(npm root -g) node tools/trick-probe.js [index.html]
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
(async () => {
  const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "index.html"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file://" + file + "?shot=battle&lv=0&wave=1");
  await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
  const out = await page.evaluate(() => {
    const lines = [], fails = [];
    const DN = ["Easy", "Normal", "Hard"];
    for (let i = 0; i < LEVELS.length; i++) {
      const L = LEVELS[i];
      curLevel = i; curDiff = 1; curEra = L.era; loadLevel(i);
      const T = L.tricks || {};
      lines.push("");
      lines.push(i + " " + L.id + (T.watch ? "  (watch: " + T.watch.join(", ") + ")" : ""));
      // the ambush road
      const A = T.ambush;
      if (A && ROUTES[A.route]) {
        const S = ambushStretch(A.route), P = [];
        for (let d = S.a; d <= S.b; d += 4) P.push(routeAt(A.route, d));
        const onScreen = P.filter(p => p.x >= 0 && p.x <= VW && p.y >= 0 && p.y <= VH).length * 4;
        let clear = 1e9, at = null;
        for (const q of L.pads.concat(L.plots || [])) {
          const dm = Math.min(...P.map(p => Math.hypot(p.x - q[0], p.y - q[1])));
          if (dm < clear) { clear = dm; at = q; }
        }
        let wet = 1e9;
        if (L.lake) for (const p of P) { for (let m = 0; m < 200; m += 2) if (lakeAt(p.x, p.y, m)) { wet = Math.min(wet, m); break; } }
        const reach = r => q => P.filter(p => inGroundRange(q[0], q[1], p.x, p.y, r)).length * 4 >= 60;
        const pads = r => L.pads.filter(reach(r)), plts = r => (L.plots || []).filter(reach(r));
        lines.push("  ambush road " + A.route + " (" + A.name + (A.legacy ? ", legacy" : "") + "): own stretch " + Math.round(S.b - S.a) + " px (" + onScreen +
          " on the field) of " + Math.round(ROUTES[A.route].len) + "; nearest pad or plot " + Math.round(clear) + " at " + at +
          (L.lake ? "; lake margin " + (wet >= 1e9 ? "200+" : wet) : ""));
        for (const r of [152, 188]) lines.push("    reached at " + r + ": pads " + JSON.stringify(pads(r)) + " plots " + JSON.stringify(plts(r)));
        if (!A.legacy) {
          if (clear < 45) fails.push(L.id + ": a pad or plot is " + Math.round(clear) + " from the ambush road");
          if (wet < 20) fails.push(L.id + ": the ambush road runs " + wet + " from the lake");
          if (!(pads(152).length >= 2 || (pads(152).length >= 1 && plts(152).length >= 1))) fails.push(L.id + ": the ambush road is reached by too few pads at 152");
        }
      }
      // the watch slot's best pad against the last 40% of each main road
      if (T.hidden) {
        const kind = (T.watch || ["fire"])[0], r = watchReach({ type: kind, level: 0, spec: null });
        const tails = ROUTES.map((R, k) => k).filter(k => !ROUTES[k].track).map(k => {
          const P = [];
          for (let d = ROUTES[k].len * 0.6; d <= ROUTES[k].len; d += 4) P.push(routeAt(k, d));
          return P;
        });
        let best = -1, bv = -1, per = [];
        L.pads.forEach((p, j) => {
          const v = tails.map(P => P.filter(q => inGroundRange(p[0], p[1], q.x, q.y, r)).length * 4);
          if (v.reduce((a, b) => a + b, 0) > bv) { bv = v.reduce((a, b) => a + b, 0); best = j; per = v; }
        });
        lines.push("  watch: a first-rank " + kind + " (reveals within " + Math.round(r) + ") on pad " + best + " " + JSON.stringify(L.pads[best]) +
          " reveals " + per.map(v => v + " px").join(" and ") + " of the last 40% of " + (per.length > 1 ? "the roads" : "the road"));
      }
      // the timeline on each difficulty
      for (let d = 0; d < 3; d++) {
        curDiff = d;
        const parts = [], mark = w => w + (w % 10 === 0 ? "!" : "");
        const Ac = trickCfg("ambush");
        if (Ac) parts.push("ambush tell " + mark(Ac.from - (byDiff(Ac.tell) || 0)) + " open " + mark(Ac.from) + (Ac.legacy ? "" : " share " + byDiff(Ac.share)));
        const sc = [], hu = [], gu = [];
        for (let w = 1; w <= TOTAL_WAVES; w++) for (const g of trickWave(w)) {
          if (g.trick === "hidden") sc.push(mark(w) + "x" + g.n);
          if (g.trick === "hunter") hu.push(mark(w) + "x" + g.n);
          if (g.hunt) hu.push(mark(w) + "x" + g.hunt);
          if (g.guard && !gu.length) gu.push(mark(w) + " " + g.guardName + " vs " + g.guard);
        }
        if (sc.length) parts.push("scouts " + sc.join(","));
        if (hu.length) parts.push("hunters " + hu.join(","));
        if (gu.length) parts.push("guards from " + gu[0]);
        const C = trickCfg("adapt");
        if (C) parts.push("adapts from " + mark(C.from));
        lines.push("  " + DN[d] + ": " + (parts.join(" · ") || "no tricks"));
      }
    }
    // the teaching order of the first six
    for (let d = 0; d < 3; d++) {
      const met = new Set(), order = [];
      for (let i = 0; i < 6; i++) {
        curLevel = i; curDiff = d; curEra = LEVELS[i].era;
        const kinds = TRICK_KEYS.filter(k => trickCfg(k)), fresh = kinds.filter(k => !met.has(k));
        order.push(LEVELS[i].id + ":" + (fresh.join("+") || "-"));
        if (fresh.length > 1) fails.push(LEVELS[i].id + " teaches " + fresh.join(" and ") + " on " + DN[d]);
        if (fresh.includes("adapt") && !met.has("guards")) fails.push("the enemy adapts before the shields are taught on " + DN[d]);
        kinds.forEach(k => met.add(k));
      }
      lines.push((d ? "" : "\n") + "teaching order, " + DN[d] + ": " + order.join(" "));
    }
    return { lines, fails };
  });
  console.log(out.lines.join("\n"));
  for (const f of out.fails) console.log("FAIL " + f);
  if (errs.length) console.log("page errors: " + errs.join(" | "));
  console.log(out.fails.length || errs.length ? "trick-probe: FAIL" : "trick-probe: PASS");
  await browser.close();
  process.exit(out.fails.length || errs.length ? 1 : 0);
})();
