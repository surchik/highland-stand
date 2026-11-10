// prototype of the script map (D4): a battlefield of N waves plays N steps of the 20-step script.
// Loaded through PATCH into a scratch copy of the page whose TOTAL_WAVES is a let.
(function () {
  const env = (typeof PROTO_WAVES !== "undefined") ? PROTO_WAVES : {};
  const table = N => {
    if (N >= 20) return [...Array(20)].map((_, i) => i + 1);
    const t = [1, 2];
    for (let k = 3; k <= N; k++) t.push(Math.round(3 + (k - 3) * 17 / (N - 3)));
    for (let i = 1; i < t.length; i++) if (t[i] <= t[i - 1]) t[i] = t[i - 1] + 1;
    if (!t.includes(10)) {
      let bi = -1, bd = 99;
      for (let i = 3; i < t.length - 1; i++) { const d = Math.abs(t[i] - 10); if (d < bd || (d === bd && t[i] > 10)) { bd = d; bi = i; } }
      t[bi] = 10;
    }
    t[t.length - 1] = 20;
    return t;
  };
  let SC = table(20);
  const sw = w => (w <= 0 ? 0 : w <= SC.length ? SC[w - 1] : 20 + (w - SC.length));
  const fstep = w => (w >= 1 && w < SC.length ? SC[w] - SC[w - 1] : 1);
  const played = s => { for (let k = 1; k <= SC.length; k++) if (SC[k - 1] >= s) return k; return SC.length + (s - 20); };
  window.PROTO = { sw, fstep, played, table, get SC() { return SC; }, payAhead: true };
  const own = (typeof PROTO_SCRIPT !== "undefined") ? PROTO_SCRIPT : {};
  const _reset = resetGame;
  resetGame = function () {
    const id = LEVELS[curLevel].id, N = env[id] || 20;
    SC = own[id] || table(N); TOTAL_WAVES = SC.length;
    _reset();
  };
  // composition: every group a covered script wave brings, at its largest
  const ORDER = ["spearman", "raider", "shield", "cavalry", "ram", "flyer", "boss"];
  const _wg = waveGroups;
  waveGroups = function (w) {
    const out = [];
    for (let i = sw(w - 1) + 1; i <= sw(w); i++) for (const g of _wg(i)) {
      const o = out.find(x => x.type === g.type);
      if (!o) out.push(Object.assign({}, g)); else if (g.n >= o.n) Object.assign(o, g);
    }
    return out.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  };
  // every trick's `from` in played waves
  const _cfg = trickCfg;
  trickCfg = function (kind) {
    const c = _cfg(kind);
    if (!c) return c;
    if (kind === "guards") return c.map(g => Object.assign({}, g, { from: played(g.from) }));
    if (kind === "weak" || typeof c !== "object" || c.from == null) return c;
    return Object.assign({}, c, { from: played(c.from), sfrom: c.from });
  };
  trickWave = function (w) {
    const g = waveGroups(w).map(x => Object.assign({}, x));
    if (curLevel === 0 && tutGentle && !endless && w <= 3) return g;
    const H = trickCfg("hunters"), S = trickCfg("hidden"), G = trickCfg("guards"), s = sw(w);
    if (H && w >= H.from) {
      if (H.add === false) {
        const grp = g.find(x => x.type === H.role);
        if (grp) grp.hunt = Math.min(grp.n, byDiff(H.huntCap) || 1);
      } else {
        const N = byDiff(H.n);
        if (N) {
          const n = Math.min(N[2], N[0] + Math.floor((s - H.sfrom) / N[1]));
          if (n > 0) insertAfter(g, "spearman", { type: H.role, n, gap: 1.4, trick: "hunter", name: H.name });
        }
      }
    }
    if (S && w >= S.from) {
      let comes = false;
      const dense = byDiff(S.dense) || Infinity;
      for (let i = Math.max(sw(w - 1) + 1, S.sfrom); i <= s; i++) if ((i - S.sfrom) % (S.every || 1) === 0 || i >= dense) comes = true;
      if (comes) {
        const N = byDiff(S.n);
        const n = N ? Math.min(byDiff(TRICK_RULES.hidden.cap), N[0] + Math.floor(s / N[1])) : 0;
        if (n > 0) insertAfter(g, "raider", { type: S.role, n, gap: 1.0, trick: "hidden", name: S.name });
      }
    }
    if (G) for (const q of G) if (w >= q.from) {
      for (const x of g) if (x.type === q.role && !x.trick && x.type !== "boss" && x.type !== "flyer") {
        x.guard = q.vs; x.guardName = q.name; x.guardDrop = !!q.drop; x.guardLook = q.look;
      }
    }
    return g;
  };
  const _hp = hpScale, _cc = commanderClimb, _hf = levelHpFrom, _fb = foeBounty, _ar = activeRoutes, _mend = mendTowers, _end = endWaveIfClear;
  hpScale = w => _hp(sw(w));
  commanderClimb = w => _cc(sw(w));
  levelHpFrom = (type, w) => _hf(type, sw(w));
  foeBounty = (d, w) => Math.max(1, Math.round(_fb(d, sw(w)) * (PROTO.payAhead ? fstep(w) : 1)));
  activeRoutes = w => _ar(sw(w));
  mendTowers = function () { for (let i = 0; i < fstep(waveIdx); i++) _mend(); };
  endWaveIfClear = function () {
    const clear = !gameOver && phase === "wave" && spawnQueue.length === 0 && enemies.length === 0;
    const g0 = gold, w = waveIdx;
    _end();
    if (clear && !gameOver && PROTO.payAhead) {
      let bonus = 0;
      for (let i = sw(w); i < sw(w) + fstep(w); i++) bonus += 25 + 3 * i;
      const interest = Math.min(60, Math.floor(g0 * 0.05));
      gold += bonus - (25 + 3 * w) + (fstep(w) - 1) * interest;
    }
  };
})();
