// Runs inside the game's own page (index.html in its photo harness), injected by film.js. It draws every frame
// of an explainer video with the game's own painters: the battlefield (draw, update), the campaign chart
// (buildWorldTerrain) and the chronicle's painting (briefScene). Titles and plaques are drawn here in the
// game's palette and faces. Nothing in index.html is changed.
(function () {
  "use strict";
  const F = (window.FILM = {});
  const FACE = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
  const HY = '"Noto Serif Armenian", Mshtakan, Sylfaen, "Noto Sans Armenian", "Arian AMU", "DejaVu Serif", serif';
  let tall = false, K = 1, padPainters = null;
  let W, H, U, fps, lv, L, spec, film, fx, bufs, bi = 0, cur = -1, mapPlate, artPlate, simT = 0;
  const ease = k => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, k)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  // 0..1..0: in over `i` seconds from t0, out over `o` seconds to t1
  const env = (t, t0, t1, i, o) => clamp01(Math.min((t - t0) / i, (t1 - t) / o));

  function mk(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  F.init = function (o) {
    W = o.W; H = o.H; fps = o.fps; spec = o; U = Math.min(W, H) / 720;
    lv = levelIndexOf(o.level); L = LEVELS[lv];
    film = mk(W, H);
    film.id = "film";
    film.style.cssText = "position:fixed;left:0;top:0;width:" + W + "px;height:" + H + "px;z-index:2147483647";
    document.body.appendChild(film);
    fx = film.getContext("2d");
    bufs = [mk(W, H), mk(W, H)];
    // the field is drawn through photo.zoom alone: one virtual unit is `scale * photo.zoom` pixels
    scale = 1;
    canvas.width = W; canvas.height = H; DPR = 1;
    // the terrain baked once, at its densest, so a moving camera never waits on a new bake
    terrSpriteDensity = () => 3;
    // a film, not a battle in play: the build-price signs, the health bars, the range rings, the flank road's dashes
    // and the floating coin counts are the interface's, so they are left out (the painters are only switched off
    // in this page; index.html is not changed)
    const off = () => {};
    drawPlotSign = off; drawEnemyMarks = off; drawHeroBar = off; drawPostBars = off; drawRange = off; drawTowerHpBar = off;
    drawFlankLines = off; drawHuntLines = off; drawWatchReach = off; drawHoverRange = off; drawWaveBanner = off; drawPlacement = off; drawCastPreview = off;
    padPainters = [drawPads, shadeOpenPads, drawPlots];
    tall = H > W; K = tall ? 1.28 : 1.1;
    // the campaign chart at twice the page's backing, for close views
    const src = buildWorldTerrain.toString().replace(/^function\s+buildWorldTerrain/, "function").replace(/MAP_BACKING/g, "6");
    mapPlate = (0, eval)("(" + src + ")")(CHAPTERS[mapChapterOf(lv)].chart, true);   // (true: the sheet without its cartouche, as a phone gets it)
    if (!mapPlate) mapPlate = terrainCanvases[CHAPTERS[mapChapterOf(lv)].chart] || terrainCanvases.highlands;
    // the chronicle's painting of this battlefield
    const keep = THEME;
    THEME = levelTheme(L);
    artPlate = briefScene(BRIEF_CROPS[lv] || BRIEF_CROPS[0], 1600, 1600, 7001 + lv * 53);
    THEME = keep;
    return { map: [mapPlate.width, mapPlate.height], art: [artPlate.width, artPlate.height], name: L.name, date: L.date, hy: (HY_NAMES.field[L.name] || {}).hy || "" };
  };
  function mapChapterOf(i) { for (let c = 0; c < CHAPTERS.length; c++) if (CHAPTERS[c].levels.indexOf(i) >= 0) return c; return 0; }

  // ---- the battlefield ----
  function stage(st, sc) {
    // the empty tower pads with their flags are the interface's too: they show only where towers stand on them
    const pads = st.mode === "battle" || st.mode === "garrison";
    drawPads = pads ? padPainters[0] : () => {}; shadeOpenPads = pads ? padPainters[1] : () => {};
    drawPlots = () => {};   // the empty build plots with their corner marks and stone piles are the interface too
    // a scene may look at another battlefield of the campaign (stage.level): Erebuni's film shows Tushpa's rock
    const at = st.level ? levelIndexOf(st.level) : lv;
    if (st.mode === "fall") {
      // the game's own picture of a stand that is lost: the citadel burning at dusk (its defeat beat, held)
      photoFall(at, st.wave || 8, 0, false);
      fallen.start = PHOTO_TIME + sc.t0 * 1000 - 700;
      if (hero) hero.alive = false;
    } else if (st.mode === "march") {
      // a column on the road and nothing else: no towers, no hero (the army on its way)
      curLevel = lv; curDiff = 1;
      resetGame();
      overlayEl.classList.add("hidden");
      waveIdx = st.wave || 2; phase = "wave";
      spawnQueue = [{ type: "spearman", t: 1e9 }];
      (st.roles || ["spearman", "spearman", "shield", "cavalry", "spearman", "shield", "spearman", "cavalry"]).forEach((r, i) => {
        spawnEnemy(r);
        const e = enemies[enemies.length - 1], len = e.fly ? e.fly.len : ROUTES[e.route].len;
        e.dist = len * ((st.head || 0.5) - (st.spread || 0.4) * (i / 8) + 0.03 * ((i * 0.618034) % 1));
      });
      if (typeof hero !== "undefined" && hero) hero.alive = false;
    } else if (st.mode === "battle" || st.mode === "garrison") {
      photoStageBattle(lv, st.wave || 5, {});
      if (st.mode === "garrison") { enemies.length = 0; projectiles.length = 0; particles.length = 0; if (typeof corpses !== "undefined") corpses.length = 0; spawnQueue = []; }
    } else {
      curLevel = at; curDiff = 1;
      resetGame();
      overlayEl.classList.add("hidden");
      waveIdx = st.wave || 0;
    }
    // the hero is shown only where the film is about him
    if ((st.noHero || !st.mode || st.mode === "empty") && typeof hero !== "undefined" && hero) hero.alive = false;
    // the dead of a lost field, laid along the road: [{ role, d (how far down its road), dx, dy, color, road }]
    for (const q of st.corpses || []) layCorpse(q);
    // the hero walks to a place on the field (a live scene): { x, y }
    if (st.heroTo && typeof hero !== "undefined" && hero) { hero.rally = { x: st.heroTo[0], y: st.heroTo[1] }; hero.face = st.heroTo[0] >= hero.x ? 1 : -1; }
    document.body.classList.add("photoNoHud");
    simT = 0;
  }
  function layCorpse(q) {
    spawnEnemy(q.role || "spearman");
    const e = enemies.pop();
    if (q.road != null && !e.fly) e.route = q.road;
    const len = e.fly ? e.fly.len : ROUTES[e.route].len;
    e.dist = len * (q.d == null ? 0.5 : q.d);
    const p = enemyPos(e);
    corpses.push({ x: p.x + (q.dx || 0), y: p.y + (q.dy || 0), k: (q.k || e.r / 11), color: q.color || e.def.color, t: 0.8, type: e.type, name: e.def.name, fly: false, keep: true });
  }
  // the hero falls where he stands: he is gone from the field, a fallen figure in his colours lies there, and a
  // burst of red, as when he falls in play (heroDie), marks the moment
  function heroFalls() {
    if (typeof hero === "undefined" || !hero) return;
    const x = hero.x, y = hero.y;
    hero.alive = false; hero.respawn = 1e9; hero.rally = null;
    corpses.push({ x: x, y: y, k: 1.25, color: "#a8231c", t: 0.8, type: "hero", name: "hero", fly: false, keep: true });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2, sp2 = 30 + (i * 37 % 50);
      particles.push({ x: x, y: y - 10, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2 * 0.5 - 34, life: 0.9, color: i % 3 ? "#c9552e" : "#ffd27a", size: 3.2 });
    }
  }
  function cam(sc, t) {
    const k = ease((t - sc.t0) / (sc.t1 - sc.t0)), a = sc.a, b = sc.b || sc.a;
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), a[2] * Math.pow(b[2] / a[2], k)];
  }
  function drawField(sc, t, c) {
    const st = sc.stage || {};
    if (st.live) {
      const lives0 = lives;
      const back = st.fleeAt != null && t >= st.fleeAt ? enemies.map(e => [e, e.dist]) : null;   // (a column that breaks and flees)
      update(1 / fps);
      if (back) for (const [e, d0] of back) if (enemies.indexOf(e) >= 0 && !e.fly) e.dist = Math.max(0, d0 - Math.max(0, e.dist - d0) * 1.6 - 40 / fps);
      lives = Math.max(lives, lives0, 20);
      for (const c of corpses) if (c.keep) c.t = 0.8;   // the film's own dead stay where they lie
      if (st.noRespawn && hero && !hero.alive) hero.respawn = 1e9;
      if (st.mode === "march" && hero) hero.alive = false;
      simT += 1 / fps;
      for (const s of st.spawn || []) if (!s.done && simT >= s.at) {
        s.done = true;
        for (let i = 0; i < (s.n || 1); i++) {
          spawnEnemy(s.role);
          // (the trailer's crowds: d puts the column part way down its road, hp makes it last on screen)
          const e = enemies[enemies.length - 1];
          if (s.road != null && !e.fly && ROUTES[s.road]) e.route = s.road;   // (a field of two roads: which one)
          if (s.d != null) { const len = e.fly ? e.fly.len : ROUTES[e.route].len; e.dist = len * Math.max(0, s.d - i * (s.gap || 0.018)); }
          if (s.hp) { e.maxHp *= s.hp; e.hp = e.maxHp; }
          if (!sc.lead && !e.fly) sc.lead = e;
        }
      }
      // (the trailer's hero: set down beside the column, then sent into it)
      const ht = st.heroTo;
      if (ht && hero && sc.lead && enemies.indexOf(sc.lead) >= 0) {
        const p = enemyPos(sc.lead);
        if (!sc.heroSet) { sc.heroSet = true; hero.alive = true; hero.x = p.x + (ht.off || [150, 30])[0]; hero.y = p.y + (ht.off || [150, 30])[1]; hero.rally = null; }
        if (!sc.heroSent && simT >= (ht.at || 0.3)) { sc.heroSent = true; hero.rally = { x: p.x, y: p.y }; }
      }
    }
    if (st.fallAt != null && !st.fell && t >= st.fallAt) { st.fell = true; heroFalls(); }
    if (!st.live) {   // a still field: what has just fallen settles, the burst of the fall runs out
      for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i]; q.life -= 1 / fps; q.x += (q.vx || 0) / fps; q.y += (q.vy || 0) / fps; q.vy = (q.vy || 0) + 60 / fps; if (q.life <= 0) particles.splice(i, 1); }
    }
    const cover = Math.max(W / VW, H / VH);
    let [cx, cy, z] = cam(sc, t);
    if (sc.follow) {
      // the camera keeps a walker in view: the hero, or the first foe of a kind still on the road
      if (sc.follow && sc.follow.type === "tower" && !sc.towerAt && sc.lead && towers.length) {
        // the camera on the tower nearest the column (the column walks into its reach)
        const lp = enemyPos(sc.lead);
        let best = null, bd = 1e9;
        for (const tw of towers) { const d = Math.hypot(tw.x - lp.x, tw.y - lp.y) - (tw.y > lp.y ? 60 : 0); if (d < bd) { bd = d; best = tw; } }   // (a tower below the road is preferred: it stands in front)
        if (best) { const q = proj(best.x, best.y), r = proj(lp.x, lp.y), k = sc.follow.k == null ? 0.45 : sc.follow.k; sc.towerAt = [q.x + (r.x - q.x) * k + (sc.follow.dx || 0), q.y + (r.y - q.y) * k + (sc.follow.dy || 0)]; }
        // (the trailer's "raise your towers": that tower is taken down and goes up again on its pad, in shot)
        if (best && sc.follow.build != null) { sc.rebuild = { type: best.type, pad: best.pad, at: sc.follow.build, x: best.x, y: best.y }; towers.splice(towers.indexOf(best), 1); }
      }
      if (sc.towerAt) { cx = sc.towerAt[0]; cy = sc.towerAt[1]; }
      const rb = sc.rebuild;
      // (and then ranked up twice, with the same burst each time: build, upgrade)
      if (rb && rb.done && rb.tw && rb.ups && rb.ups.length && simT >= rb.done + rb.ups[0]) {
        rb.ups.shift(); rb.tw.level = Math.min(rb.tw.level + 1, 2);   // (its look ranks up; the game's rank-up toast and ring are interface, so upgradeTower is not called)
        for (let i = 0; i < 18; i++) particles.push({ x: rb.x + ((i * 0.618) % 1 - 0.5) * 40, y: rb.y - 24, vx: ((i * 0.381) % 1 - 0.5) * 36, vy: -60 - (i * 13 % 34), life: 1.0, color: "#f3cf72", size: 3.5 });
      }
      if (rb && !rb.done && simT >= rb.at) { rb.done = simT; const g0 = gold; gold = 99999; placeTower(sc.follow.kind || rb.type, rb.pad); gold = g0; const tw = towers[towers.length - 1]; if (tw) tw.placedAt = -1e9; rb.tw = tw; rb.ups = (sc.follow.ups || []).slice();
        // the game's own particles for the moment it goes up: a burst of dust and a rise of gold sparks
        for (let i = 0; i < 26; i++) { const a = i / 26 * 6.2832, sp = 40 + (i * 37 % 50); particles.push({ x: rb.x + Math.cos(a) * 10, y: rb.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.4 - 20, life: 0.9, color: i % 2 ? "#a8957a" : "#5e544a", size: 5 }); }
        for (let i = 0; i < 16; i++) particles.push({ x: rb.x + ((i * 0.618) % 1 - 0.5) * 36, y: rb.y - 20, vx: ((i * 0.381) % 1 - 0.5) * 30, vy: -50 - (i * 13 % 30), life: 1.0, color: "#f3cf72", size: 3 }); }
      const f = sc.follow, e = f.type === "tower" ? null : f.type === "hero" ? hero : f.type === "spawn" ? (sc.lead && enemies.indexOf(sc.lead) >= 0 ? sc.lead : null) : (sc.folE && enemies.indexOf(sc.folE) >= 0 ? sc.folE : (sc.folE = enemies.find(x => f.type === "any" ? !x.fly && x.dist > (f.min || 0) : x.type === f.type) || null));
      if (e) {
        const w = f.type === "hero" ? { x: e.x, y: e.y } : enemyPos(e), p = proj(w.x, w.y);
        const tx = p.x + (f.dx || 0), ty = p.y + (f.dy || -20);
        if (!sc.fol) sc.fol = [tx, ty];
        sc.fol[0] += (tx - sc.fol[0]) * 0.08; sc.fol[1] += (ty - sc.fol[1]) * 0.08;
      }
      if (sc.fol) { cx = sc.fol[0]; cy = sc.fol[1]; }
    }
    z *= cover;
    cx = Math.max(W / 2 / z, Math.min(VW - W / 2 / z, cx));
    cy = Math.max(H / 2 / z, Math.min(VH - H / 2 / z, cy));
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].text) particles.splice(i, 1);   // the coin counts
    for (const tw of towers) tw.novaFx = 0;   // the beacon's ring of fire reads as a range ring in a still: left out
    photo = { time: PHOTO_TIME + t * 1000, zoom: z, cx: cx, cy: cy };
    draw(photo.time);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(canvas, 0, 0, W, H);
    if (sc.boats) drawBoats(sc, t, c, cx, cy, z);
    if (st.lift) {   // the dusk of a lost field, lifted a little so what lies on it can be seen
      c.globalCompositeOperation = "screen"; c.fillStyle = "rgba(255, 176, 110, " + st.lift + ")"; c.fillRect(0, 0, W, H); c.globalCompositeOperation = "source-over";
    }
  }

  // ---- boats on the field's lake (Sevan: the king's seventy archers): sc.boats = { at: [[x, y], ...] where each boat
  // ends, from: [dx, dy] the way they come (world units), arriveAt (absolute s), shootAt (absolute s), target: [x, y] on
  // the shore, spread }. Each boat is a dark hull with its archers standing in it, drawn in the field's own perspective
  // (proj); from shootAt they loose volleys at the target, and an arrow that lands beside a foe strikes it ----
  function drawBoats(sc, t, c, cx, cy, z) {
    const B = sc.boats, t0 = B.startAt != null ? B.startAt : sc.t0;
    const k = B.arriveAt != null ? ease((t - t0) / Math.max(0.1, B.arriveAt - t0)) : 1;
    const scr = (wx, wy) => { const p = proj(wx, wy); return [W / 2 + (p.x - cx) * z, H / 2 + (p.y - cy) * z, p.s * z * (B.scale || 2.2)]; };
    const boats = B.at.map((q, i) => [q[0] + (B.from || [0, 0])[0] * (1 - k), q[1] + (B.from || [0, 0])[1] * (1 - k) + Math.sin(t * 2.1 + i * 1.7) * 1.5]);
    for (const [bx, by] of boats) {
      const [x, y, s] = scr(bx, by), L = 46 * s, Hh = 9 * s;
      c.save(); c.translate(x, y);
      c.fillStyle = "rgba(20, 40, 60, .35)"; c.beginPath(); c.ellipse(0, Hh * 0.9, L * 0.62, Hh * 0.5, 0, 0, 6.2832); c.fill();   // its shadow on the water
      if (k < 1) { c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1.6 * s; for (const w of [1, 2]) { c.beginPath(); c.moveTo(L * 0.5 + w * 10 * s, -w * 3 * s); c.lineTo(L * 0.5 + w * 22 * s, w * 4 * s); c.stroke(); } }   // the wake
      for (let a = 0; a < 3; a++) {   // the archers, standing, bows raised
        const ax = (-0.28 + a * 0.28) * L, ay = -Hh * 0.2;
        c.fillStyle = "#8e2a1e"; c.fillRect(ax - 3.2 * s, ay - 13 * s, 6.4 * s, 12 * s);
        c.fillStyle = "#e0b48a"; c.beginPath(); c.arc(ax, ay - 16 * s, 3.2 * s, 0, 6.2832); c.fill();
        c.fillStyle = "#6f6a62"; c.beginPath(); c.arc(ax, ay - 17.2 * s, 3.4 * s, Math.PI, 0); c.fill();
        c.strokeStyle = "#3a2410"; c.lineWidth = 1.4 * s; c.beginPath(); c.arc(ax - 6 * s, ay - 12 * s, 7 * s, -1.1, 1.1); c.stroke();
      }
      c.fillStyle = "#5a3818"; c.strokeStyle = "#2c1a0a"; c.lineWidth = 1.5 * s;   // the hull
      c.beginPath(); c.moveTo(-L / 2, -Hh * 0.2); c.lineTo(L / 2, -Hh * 0.2); c.quadraticCurveTo(L * 0.42, Hh, L * 0.3, Hh); c.lineTo(-L * 0.3, Hh); c.quadraticCurveTo(-L * 0.42, Hh, -L / 2, -Hh * 0.2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#7a5228"; c.fillRect(-L / 2, -Hh * 0.2, L, 2.2 * s);
      c.restore();
    }
    if (B.shootAt == null || t < B.shootAt) return;
    // the volleys: every boat looses together, a volley every 0.8 s; each arrow flies 0.75 s on an arc
    sc.arrows = sc.arrows || []; sc.volley = sc.volley || 0;
    const tgt = B.target || [880, 250], sp = B.spread || 60;
    while (B.shootAt + sc.volley * 0.8 <= t) {
      const v = sc.volley++;
      boats.forEach((b, i) => { for (let j = 0; j < 3; j++) { const r = ((v * 7 + i * 3 + j) * 0.618034) % 1, r2 = ((v * 5 + i * 11 + j * 3) * 0.381966) % 1;
        sc.arrows.push({ t0: B.shootAt + v * 0.8 + j * 0.06, from: [b[0] - 12 + j * 10, b[1] - 6], to: [tgt[0] + (r - 0.5) * 50, tgt[1] + (r2 - 0.5) * sp * 2], hit: false }); } });
    }
    c.save(); c.lineCap = "round";
    for (const a of sc.arrows) {
      const u = (t - a.t0) / 0.75;
      if (u < 0) continue;
      if (u >= 1) {
        if (!a.hit) { a.hit = true;   // it lands: the nearest foe within reach is struck
          let best = null, bd = 34;
          for (const e of enemies) { if (e.fly) continue; const p = enemyPos(e), d = Math.hypot(p.x - a.to[0], p.y - a.to[1]); if (d < bd) { bd = d; best = e; } }
          if (best && sc.stage && sc.stage.live) damageEnemy(best, (B.dmg || 0.45) * best.maxHp, true, null);
        }
        continue;
      }
      const wx = a.from[0] + (a.to[0] - a.from[0]) * u, wy = a.from[1] + (a.to[1] - a.from[1]) * u;
      const [x, y, s] = scr(wx, wy), lift = Math.sin(Math.PI * u) * 70 * s;
      const [x2, y2] = scr(wx + (a.to[0] - a.from[0]) * 0.04, wy + (a.to[1] - a.from[1]) * 0.04), lift2 = Math.sin(Math.PI * Math.min(1, u + 0.04)) * 70 * s;
      c.strokeStyle = "rgba(40, 24, 10, .9)"; c.lineWidth = 1.8 * s;
      c.beginPath(); c.moveTo(x, y - lift); c.lineTo(x + (x2 - x) * 3, y - lift + (y2 - lift2 - (y - lift)) * 3); c.stroke();
    }
    c.restore();
  }

  // ---- a plate under a moving camera (the chart, the painting) ----
  function drawPlate(sc, t, c, plate, pw, ph) {
    const cover = Math.max(W / pw, H / ph);
    let [cx, cy, z] = cam(sc, t);
    z *= cover;
    const edge = plate === mapPlate ? 13 : 0;   // the chart's braided border stays out of the frame
    cx = Math.max(W / 2 / z + edge, Math.min(pw - W / 2 / z - edge, cx));
    cy = Math.max(H / 2 / z + edge, Math.min(ph - H / 2 / z - edge, cy));
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#191410"; c.fillRect(0, 0, W, H);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    c.setTransform(z, 0, 0, z, W / 2 - cx * z, H / 2 - cy * z);
    c.drawImage(plate, 0, 0, pw, ph);
    c.setTransform(1, 0, 0, 1, 0, 0);
    return p => [W / 2 + (p[0] - cx) * z, H / 2 + (p[1] - cy) * z];
  }
  function plaque(c, x, y, lines, alpha, align) {
    // a cream plate with an ink border, as the chart's own plates: lines = [[text, px, weight, colour, face]]
    c.save();
    c.globalAlpha = alpha;
    let w = 0, h = 0;
    for (const l of lines) { c.font = (l[2] || "700") + " " + l[1] * U + "px " + (l[4] || FACE); w = Math.max(w, c.measureText(l[0]).width); h += l[1] * U * 1.24; }
    const px = 12 * U, py = 8 * U; w += px * 2; h += py * 2;
    const x0 = align === "left" ? x : align === "right" ? x - w : x - w / 2;
    c.shadowColor = "rgba(20, 12, 4, .55)"; c.shadowBlur = 10 * U; c.shadowOffsetY = 3 * U;
    c.fillStyle = "#f3e6c0"; c.strokeStyle = "#2c1e10"; c.lineWidth = 2 * U;
    c.beginPath(); c.roundRect(x0, y, w, h, 4 * U); c.fill();
    c.shadowColor = "transparent"; c.stroke();
    c.strokeStyle = "#b88a2e"; c.lineWidth = 1 * U;
    c.beginPath(); c.roundRect(x0 + 3 * U, y + 3 * U, w - 6 * U, h - 6 * U, 2 * U); c.stroke();
    let yy = y + py;
    c.textAlign = "center"; c.textBaseline = "top";
    for (const l of lines) {
      c.font = (l[2] || "700") + " " + l[1] * U + "px " + (l[4] || FACE);
      c.fillStyle = l[3] || "#2c1e10";
      c.fillText(l[0], x0 + w / 2, yy + l[1] * U * 0.1);
      yy += l[1] * U * 1.24;
    }
    c.restore();
    return [x0, y, w, h];
  }
  function drawMap(sc, t, c) {
    const pr = drawPlate(sc, t, c, mapPlate, MAP_W, MAP_H);
    for (const m of sc.markers || []) {
      const a = env(t, sc.t0 + (m.at || 0), sc.t0 + (m.until || 1e9), 0.5, 0.5);
      if (a <= 0) continue;
      if (m.arrow) {   // a march drawn on the chart: an ink line that grows, with a head
        const p0 = pr(m.arrow[0]), p1 = pr(m.arrow[1]), g = ease((t - sc.t0 - (m.at || 0)) / (m.grow || 1.4));   // (grow: seconds, to keep pace with a pan)
        const x1 = p0[0] + (p1[0] - p0[0]) * g, y1 = p0[1] + (p1[1] - p0[1]) * g, ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
        c.save(); c.globalAlpha = a; c.lineCap = "round";
        for (const [col, lw] of [["rgba(244, 232, 196, .9)", 9], ["#a8231c", 4.5]]) {
          c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw * U; c.setLineDash([12 * U, 9 * U]);
          c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
          c.save(); c.translate(x1, y1); c.rotate(ang);
          const hs = (lw > 5 ? 17 : 14) * U;
          c.beginPath(); c.moveTo(hs, 0); c.lineTo(-hs * 0.7, -hs * 0.75); c.lineTo(-hs * 0.7, hs * 0.75); c.closePath(); c.fill(); c.restore();
        }
        c.restore();
        continue;
      }
      if (m.label) {   // a name written on the chart in the chart's own hand (its water labels are this blue italic)
        const q = pr(m.xy);
        c.save(); c.globalAlpha = a; c.translate(q[0], q[1]); c.rotate(m.rot || 0);
        c.font = (m.land ? "700 " : "italic 600 ") + (m.size || 25) * U * K + "px " + FACE; c.textAlign = "center"; c.textBaseline = "middle";
        const lab = m.land ? spaced(m.label) : m.label;   // a land's name is set spaced in capitals, as the chart's own regions
        c.strokeStyle = "rgba(240, 228, 190, .9)"; c.lineWidth = (m.land ? 7 : 5) * U; c.lineJoin = "round"; c.strokeText(lab, 0, 0);
        c.fillStyle = m.land ? "#6e1f14" : "#1f4f6e"; c.fillText(lab, 0, 0);
        c.restore();
        continue;
      }
      const n = m.xy || [MAP_NODES[levelIndexOf(m.node)].x, MAP_NODES[levelIndexOf(m.node)].y], p = pr(n);
      const pulse = 0.5 + 0.5 * Math.sin((t - sc.t0) * 3.2);
      c.save();
      c.globalAlpha = a;
      // a gilt ring with a crimson heart, and a second ring breathing round it
      c.strokeStyle = "rgba(232, 184, 74, " + (0.55 - 0.35 * pulse) + ")"; c.lineWidth = 3 * U;
      c.beginPath(); c.arc(p[0], p[1], (17 + 9 * pulse) * U, 0, 6.2832); c.stroke();
      c.fillStyle = "#f6e7b8"; c.strokeStyle = "#2c1e10"; c.lineWidth = 2 * U;
      c.beginPath(); c.arc(p[0], p[1], 11 * U, 0, 6.2832); c.fill(); c.stroke();
      c.strokeStyle = "#c9972f"; c.lineWidth = 2.4 * U;
      c.beginPath(); c.arc(p[0], p[1], 8 * U, 0, 6.2832); c.stroke();
      c.fillStyle = "#a8231c";
      c.beginPath(); c.moveTo(p[0], p[1] - 5 * U); c.lineTo(p[0] + 5 * U, p[1]); c.lineTo(p[0], p[1] + 5 * U); c.lineTo(p[0] - 5 * U, p[1]); c.closePath(); c.fill();
      c.restore();
      const lines = [[m.name, (m.big ? 32 : 28) * K, "700"]];
      if (m.hy) lines.push([m.hy, (m.big ? 23 : 21) * K, "600", "#5e4120", HY]);
      if (m.sub) lines.push([m.sub, 23 * K, "italic 600", "#8a2a1c"]);
      const dy = m.above ? -(lines.reduce((s, l) => s + l[1] * 1.24, 0) + 16 + 26) * U : 26 * U;
      plaque(c, p[0] + (m.dx || 0) * U, p[1] + dy, lines, a, "center");
    }
  }
  const arts = {};
  function drawArt(sc, t, c) {
    let plate = artPlate;
    if (sc.level || sc.hires) {   // the chronicle's painting of another battlefield (Erebuni's film shows the royal seat, Tushpa)
      const i = sc.level ? levelIndexOf(sc.level) : lv, key = i + (sc.hires ? "h" : "");
      // (hires: painted at twice the size, for a close look; its units stay those of the 1600 plate)
      if (!arts[key]) { const keep = THEME; THEME = levelTheme(LEVELS[i]); arts[key] = briefScene(BRIEF_CROPS[i] || BRIEF_CROPS[0], sc.hires ? 3200 : 1600, sc.hires ? 3200 : 1600, 7001 + i * 53); THEME = keep; }
      plate = arts[key];
    }
    drawPlate(sc, t, c, plate, 1600, 1600);
  }

  // ---- the Rock of Van: a long, narrow limestone ridge rising steeply from the plain, its citadel walls along the
  // crest, Lake Van to the west and the snow peaks beyond (drawn here in the chronicle's flat colours, 1600 x 1000) ----
  let rockPlate = null;
  function buildRock() {
    const c = mk(1600, 1000), g = c.getContext("2d"), rnd = mulberry32(735);
    const sky = g.createLinearGradient(0, 0, 0, 640);
    sky.addColorStop(0, "#8fb1c6"); sky.addColorStop(1, "#e6dcc2");
    g.fillStyle = sky; g.fillRect(0, 0, 1600, 1000);
    const poly = (pts, fill, ink) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fillStyle = fill; g.fill(); if (ink) { g.strokeStyle = ink; g.lineWidth = 3; g.lineJoin = "round"; g.stroke(); } };
    // the far snow peaks
    poly([[700, 640], [930, 430], [1010, 470], [1120, 380], [1260, 470], [1420, 420], [1600, 520], [1600, 640]], "#a4a9bf");
    poly([[1080, 420], [1120, 380], [1170, 412], [1150, 430], [1120, 420], [1100, 436]], "#f4f6f8");
    poly([[1390, 436], [1420, 420], [1470, 448], [1440, 452]], "#f4f6f8");
    poly([[0, 640], [120, 560], [260, 590], [420, 530], [560, 600], [700, 640]], "#b3b0bd");
    // Lake Van, to the west
    const lake = g.createLinearGradient(0, 600, 0, 680);
    lake.addColorStop(0, "#7fb2cf"); lake.addColorStop(1, "#3f7fae");
    g.fillStyle = lake; g.fillRect(0, 612, 520, 60);
    g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const y = 622 + rnd() * 44, x = rnd() * 480; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rnd() * 30, y); g.stroke(); }
    // the plain
    const plain = g.createLinearGradient(0, 640, 0, 1000);
    plain.addColorStop(0, "#c9b27a"); plain.addColorStop(1, "#9c8a52");
    g.fillStyle = plain; g.fillRect(0, 660, 1600, 340);
    for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(90, 110, 50, " + (0.18 + rnd() * 0.2) + ")"; const x = rnd() * 1600, y = 690 + rnd() * 300; g.beginPath(); g.ellipse(x, y, 20 + rnd() * 50, 5 + rnd() * 8, 0, 0, 6.2832); g.fill(); }
    // the Rock: long and narrow, sheer on its south face, the west end lit and the east in shade
    const crest = [[300, 700], [340, 560], [400, 470], [470, 432], [620, 414], [800, 408], [980, 412], [1120, 424], [1220, 446], [1290, 500], [1330, 600], [1350, 700]];
    const face = g.createLinearGradient(300, 0, 1350, 0);
    face.addColorStop(0, "#e2c48c"); face.addColorStop(0.55, "#c9a36a"); face.addColorStop(1, "#8c6a4c");
    poly(crest, face, "#3a2814");
    g.save(); g.beginPath(); crest.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.clip();
    for (let i = 0; i < 26; i++) {   // the facets and clefts of the limestone
      const x = 340 + i * 38 + rnd() * 16, top = 420 + rnd() * 30, len = 150 + rnd() * 140;
      poly([[x, top], [x + 14 + rnd() * 12, top + len], [x + 36 + rnd() * 20, top + len * 0.8]], "rgba(70, 46, 28, " + (0.16 + rnd() * 0.12) + ")");
      poly([[x, top], [x - 8, top + len * 0.9], [x + 6, top + len]], "rgba(255, 244, 214, .18)");
    }
    for (const y of [500, 560, 620]) { g.fillStyle = "rgba(70, 46, 28, .22)"; g.fillRect(320, y, 1020, 5); g.fillStyle = "rgba(255, 244, 214, .25)"; g.fillRect(320, y - 4, 1020, 3); }
    g.restore();
    // the citadel's walls along the crest, with its towers
    const crestY = x => { for (let i = 1; i < crest.length; i++) if (x <= crest[i][0]) { const a = crest[i - 1], b = crest[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return 700; };
    const wallTop = x => crestY(x) - 34;
    g.fillStyle = "#d9b77e"; g.strokeStyle = "#3a2814"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(410, crestY(410) + 4);
    for (let x = 410; x <= 1230; x += 10) g.lineTo(x, wallTop(x));
    for (let x = 1230; x >= 410; x -= 10) g.lineTo(x, crestY(x) + 4);
    g.closePath(); g.fill(); g.stroke();
    for (let x = 414; x < 1226; x += 22) { g.fillStyle = "#d9b77e"; g.fillRect(x, wallTop(x) - 12, 12, 13); g.strokeRect(x, wallTop(x) - 12, 12, 13); }
    for (const tx of [440, 620, 790, 960, 1120, 1210]) {
      const ty = wallTop(tx) - 46, tw = tx === 790 ? 64 : 44;
      g.fillStyle = tx === 790 ? "#c99d62" : "#d4ad72"; g.fillRect(tx - tw / 2, ty, tw, crestY(tx) - ty + 4); g.strokeRect(tx - tw / 2, ty, tw, crestY(tx) - ty + 4);
      for (let k = 0; k < (tx === 790 ? 4 : 3); k++) { const mx = tx - tw / 2 + 2 + k * (tw - 10) / ((tx === 790 ? 4 : 3) - 1); g.fillRect(mx - 1, ty - 12, 10, 12); g.strokeRect(mx - 1, ty - 12, 10, 12); }
      g.fillStyle = "#3a2814"; g.fillRect(tx - 3, ty + 14, 6, 14);
    }
    g.fillStyle = "#a8231c"; g.beginPath(); g.moveTo(790, wallTop(790) - 58); g.lineTo(790, wallTop(790) - 100); g.lineTo(826, wallTop(790) - 90); g.lineTo(790, wallTop(790) - 80); g.fill();
    g.strokeStyle = "#3a2814"; g.lineWidth = 3; g.beginPath(); g.moveTo(790, wallTop(790) - 58); g.lineTo(790, wallTop(790) - 102); g.stroke();
    // a few flat-roofed houses of mud-brick at the rock's foot, and the road across the plain
    for (let i = 0; i < 22; i++) {
      const x = 360 + i * 44 + rnd() * 20, w = 30 + rnd() * 26, h = 18 + rnd() * 18, y = 712 + rnd() * 16;
      g.fillStyle = rnd() < 0.5 ? "#d8bd88" : "#c7a874"; g.fillRect(x, y - h, w, h); g.strokeStyle = "rgba(58,40,20,.8)"; g.lineWidth = 2; g.strokeRect(x, y - h, w, h);
      g.fillStyle = "rgba(58,40,20,.75)"; g.fillRect(x + w * 0.3, y - h * 0.6, 5, 7);
    }
    g.strokeStyle = "#e8d6a6"; g.lineWidth = 26; g.lineCap = "round";
    g.beginPath(); g.moveTo(760, 1000); g.quadraticCurveTo(820, 850, 780, 740); g.stroke();
    return c;
  }
  function drawRockOfVan(sc, t, c) {
    if (!rockPlate) rockPlate = buildRock();
    drawPlate(sc, t, c, rockPlate, 1600, 1000);
  }

  // ---- the founding inscription: an illustration (a basalt block with rows of wedge marks; no real text is copied) ----
  const stones = {};
  function buildStone(tone) {
    const c = mk(1600, 1000), g = c.getContext("2d"), rnd = mulberry32(tone === "pale" ? 735 : 782);
    const bg = g.createRadialGradient(800, 480, 100, 800, 500, 1000);
    bg.addColorStop(0, "#4a3a26"); bg.addColorStop(1, "#1c140c");
    g.fillStyle = bg; g.fillRect(0, 0, 1600, 1000);
    const x0 = 330, y0 = 190, w = 940, h = 600;
    g.save();
    g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = 50; g.shadowOffsetY = 24;
    const st = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
    if (tone === "pale") { st.addColorStop(0, "#a8a294"); st.addColorStop(0.5, "#8f897b"); st.addColorStop(1, "#716b5e"); }   // the grey limestone of an Assyrian slab
    else { st.addColorStop(0, "#6f6a62"); st.addColorStop(0.5, "#5a554e"); st.addColorStop(1, "#45413b"); }
    g.fillStyle = st;
    g.beginPath();
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push([x0 + w * i / 40, y0 + (rnd() - 0.5) * 10]);
    for (let i = 1; i <= 26; i++) pts.push([x0 + w + (rnd() - 0.5) * 10, y0 + h * i / 26]);
    for (let i = 39; i >= 0; i--) pts.push([x0 + w * i / 40, y0 + h + (rnd() - 0.5) * 12]);
    for (let i = 25; i >= 1; i--) pts.push([x0 + (rnd() - 0.5) * 10, y0 + h * i / 26]);
    pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
    g.closePath(); g.fill();
    g.restore();
    g.save(); g.clip();
    for (let i = 0; i < 5200; i++) {   // the grain of the stone
      g.fillStyle = rnd() < 0.5 ? "rgba(20, 18, 16, " + (0.05 + rnd() * 0.12) + ")" : "rgba(220, 214, 200, " + (0.03 + rnd() * 0.07) + ")";
      const r = 0.6 + rnd() * 2.2; g.fillRect(x0 + rnd() * w, y0 + rnd() * h, r, r);
    }
    g.restore();
    g.strokeStyle = "#2a2622"; g.lineWidth = 4; g.stroke();
    // the slab's thickness: a lit top edge and a shadowed lower edge, so it reads as carved stone, not a sheet
    g.save(); g.clip();
    g.strokeStyle = "rgba(255, 248, 230, .28)"; g.lineWidth = 22; g.beginPath(); g.moveTo(x0, y0 + 8); g.lineTo(x0 + w, y0 + 8); g.stroke();
    g.strokeStyle = "rgba(20, 14, 8, .45)"; g.lineWidth = 30; g.beginPath(); g.moveTo(x0, y0 + h - 10); g.lineTo(x0 + w, y0 + h - 10); g.moveTo(x0 + w - 10, y0); g.lineTo(x0 + w - 10, y0 + h); g.stroke();
    for (let i = 0; i < 14; i++) { const cx = x0 + rnd() * w, cy = rnd() < 0.5 ? y0 + rnd() * 30 : y0 + h - rnd() * 30; g.fillStyle = "rgba(30, 24, 18, .35)"; g.beginPath(); g.arc(cx, cy, 6 + rnd() * 14, 0, 6.2832); g.fill(); }
    g.restore();
    const wedge = (x, y, len, ang) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = "rgba(24, 21, 18, .9)";
      g.beginPath(); g.moveTo(0, -5.5); g.lineTo(9, 0); g.lineTo(0, 5.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(6, -1.6); g.lineTo(len, 0); g.lineTo(6, 1.6); g.closePath(); g.fill();
      g.fillStyle = "rgba(226, 220, 206, .28)";
      g.beginPath(); g.moveTo(0, 5.5); g.lineTo(9, 0.6); g.lineTo(len, 0.9); g.lineTo(6, 2.6); g.closePath(); g.fill();
      g.restore();
    };
    const rows = 9, rh = (h - 90) / rows;
    for (let r = 0; r <= rows; r++) { g.fillStyle = "rgba(24, 21, 18, .55)"; g.fillRect(x0 + 44, y0 + 45 + r * rh - 1, w - 88, 2); }
    for (let r = 0; r < rows; r++) {
      let x = x0 + 60;
      const yc = y0 + 45 + r * rh + rh / 2;
      while (x < x0 + w - 90) {
        const n = 2 + Math.floor(rnd() * 4), sw = 26 + rnd() * 20;
        for (let k = 0; k < n; k++) {
          const kind = rnd();
          if (kind < 0.45) wedge(x + rnd() * 6, yc - rh * 0.28 + rnd() * rh * 0.56, sw * (0.6 + rnd() * 0.4), 0);
          else if (kind < 0.85) wedge(x + rnd() * sw, yc - rh * 0.34, rh * (0.42 + rnd() * 0.22), Math.PI / 2);
          else wedge(x + rnd() * sw * 0.6, yc - rh * 0.2, 18 + rnd() * 8, Math.PI / 4);
        }
        x += sw + 16 + rnd() * 10;
      }
    }
    return c;
  }
  function drawStone(sc, t, c) {
    const tone = sc.tone || "basalt";
    if (!stones[tone]) {
      stones[tone] = tone === "soft" ? null : buildStone(tone);
      if (tone === "soft") {   // the dark stone out of focus: an inscribed slab, its rows of wedges and no sign to read
        const soft = mk(1600, 1000), g = soft.getContext("2d");
        g.filter = "blur(1.5px)"; g.drawImage(buildStone("basalt"), 0, 0); g.filter = "none";
        stones[tone] = soft;
      }
      if (tone === "pale") {   // carved limestone, a little out of focus: the look of an inscription, no sign to read
        const soft = mk(1600, 1000), g = soft.getContext("2d");
        g.filter = "blur(0.9px)"; g.drawImage(stones[tone], 0, 0); g.filter = "none";
        const sh = g.createLinearGradient(0, 0, 1600, 1000);
        sh.addColorStop(0, "rgba(255, 245, 220, .10)"); sh.addColorStop(1, "rgba(30, 20, 10, .28)");
        g.fillStyle = sh; g.fillRect(0, 0, 1600, 1000);
        stones[tone] = soft;
      }
    }
    drawPlate(sc, t, c, stones[tone], 1600, 1000);
    const k = (t - sc.t0) / (sc.t1 - sc.t0), x = W * (-0.3 + 1.6 * k);
    const lg = c.createLinearGradient(x - W * 0.28, 0, x + W * 0.28, H * 0.3);
    lg.addColorStop(0, "rgba(255, 236, 190, 0)"); lg.addColorStop(0.5, "rgba(255, 236, 190, .17)"); lg.addColorStop(1, "rgba(255, 236, 190, 0)");
    c.globalCompositeOperation = "lighter"; c.fillStyle = lg; c.fillRect(0, 0, W, H); c.globalCompositeOperation = "source-over";
  }

  // ---- a page of the chronicle: a date and a line on parchment, where the game has no picture of the place ----
  // sc.bg: "map" (the campaign chart, dimmed and drifting: the default), "art" (the chronicle's painting, sc.bgLevel
  // for another battlefield's), "field" is not offered: a page is for what the game has no picture of
  // sc.scroll: the page unrolls between two rods; sc.lineAt: when each line comes in (resolved by film.js);
  // sc.seal: a wax seal pressed on the page at sc.sealAt; sc.emblem: "crown" | "cross" drawn above the rubric
  function drawCard(sc, t, c) {
    const T = t - sc.t0, k = ease(T / (sc.t1 - sc.t0)), z = 1 + 0.12 * k;
    if (sc.bg === "art") {
      let plate = artPlate;
      if (sc.bgLevel) { const i = levelIndexOf(sc.bgLevel); if (!arts[i]) { const keep = THEME; THEME = levelTheme(LEVELS[i]); arts[i] = briefScene(BRIEF_CROPS[i] || BRIEF_CROPS[0], 1600, 1600, 7001 + i * 53); THEME = keep; } plate = arts[i]; }
      drawPlate({ t0: sc.t0, t1: sc.t1, a: sc.a || [800, 760, 1.0], b: sc.b || [800, 640, 1.25] }, t, c, plate, plate.width, plate.height);
    } else if (sc.bg === "dark") {   // a plain dark ground (a place far off the chart)
      c.setTransform(1, 0, 0, 1, 0, 0);
      const g = c.createRadialGradient(W / 2, H * 0.45, 20 * U, W / 2, H * 0.5, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, "#4a3620"); g.addColorStop(1, "#140d06");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    } else drawPlate({ t0: sc.t0, t1: sc.t1, a: sc.a || [300, 200, 1.5], b: sc.b || [420, 215, 1.7] }, t, c, mapPlate, MAP_W, MAP_H);
    c.fillStyle = "rgba(20, 13, 6, " + (sc.dim == null ? 0.7 : sc.dim) + ")"; c.fillRect(0, 0, W, H);
    // a slow warm light drifts across behind the page, so the ground is never still
    const lx = W * (0.15 + 0.7 * k), lg = c.createRadialGradient(lx, H * 0.4, 10 * U, lx, H * 0.4, W * 0.5);
    lg.addColorStop(0, "rgba(255, 210, 140, .16)"); lg.addColorStop(1, "rgba(255, 210, 140, 0)");
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2 + (sc.drift == null ? 70 : sc.drift) * U * (k - 0.5), H * (tall ? 0.42 : 0.43) - (tall ? 30 : 18) * U * (k - 0.5)); c.scale(z, z);   // (the page drifts a little as it comes nearer)
    const lines = sc.lines || [], gap = (tall ? 54 : 52) * U;
    const pw = (sc.w || (tall ? 640 : 1000)) * U, ph = (sc.h || (tall ? 600 : 440)) * U;
    const open = sc.scroll ? ease(T / 0.9) : 1, vh = ph * (0.08 + 0.92 * open);
    // the page (clipped to what has unrolled)
    c.save();
    c.shadowColor = "rgba(0,0,0,.6)"; c.shadowBlur = 40 * U; c.shadowOffsetY = 14 * U;
    const pg = c.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
    pg.addColorStop(0, "#f1e2bb"); pg.addColorStop(1, "#dcc894");
    c.fillStyle = pg; c.fillRect(-pw / 2, -vh / 2, pw, vh);
    c.shadowColor = "transparent";
    c.beginPath(); c.rect(-pw / 2 - 20 * U, -vh / 2, pw + 40 * U, vh); c.clip();
    if (!sc.scroll) {
      c.strokeStyle = "#2c1e10"; c.lineWidth = 3 * U; c.strokeRect(-pw / 2, -ph / 2, pw, ph);
      c.strokeStyle = "#a8231c"; c.lineWidth = 5 * U; c.strokeRect(-pw / 2 + 9 * U, -ph / 2 + 9 * U, pw - 18 * U, ph - 18 * U);
      c.strokeStyle = "#c9972f"; c.lineWidth = 2 * U; c.strokeRect(-pw / 2 + 16 * U, -ph / 2 + 16 * U, pw - 32 * U, ph - 32 * U);
    } else {
      c.strokeStyle = "#a8231c"; c.lineWidth = 4 * U; c.strokeRect(-pw / 2 + 22 * U, -ph / 2 + 30 * U, pw - 44 * U, ph - 60 * U);
      c.strokeStyle = "#c9972f"; c.lineWidth = 1.6 * U; c.strokeRect(-pw / 2 + 30 * U, -ph / 2 + 38 * U, pw - 60 * U, ph - 76 * U);
      // the grain of the skin
      const rnd = mulberry32(911);
      for (let i = 0; i < 260; i++) { c.fillStyle = "rgba(120, 84, 40, " + (0.03 + rnd() * 0.05) + ")"; c.fillRect(-pw / 2 + rnd() * pw, -ph / 2 + rnd() * ph, (2 + rnd() * 9) * U, (1 + rnd() * 2) * U); }
    }
    c.textAlign = "center"; c.textBaseline = "middle";
    const textAlpha = sc.scroll ? clamp01((T - 0.6) / 0.4) : 1;
    c.globalAlpha = textAlpha;
    let y = -((sc.emblem ? 70 : 0) + (sc.rubric ? 62 : 0) + 58 + 44 + (lines.length - 1) * (tall ? 54 : 52)) * U / 2;
    if (sc.emblem) { emblem(c, sc.emblem, 0, y + 22 * U, 30 * U); y += 70 * U; }
    if (sc.rubric) { c.font = "700 " + 32 * U + "px " + FACE; c.fillStyle = "#a8231c"; c.fillText(spaced(sc.rubric), 0, y); y += 62 * U; }
    let tp = (tall ? 60 : 68) * U;
    c.font = "700 " + tp + "px " + FACE;
    const tw = c.measureText(sc.title).width;
    if (tw > pw - 90 * U) { tp *= (pw - 90 * U) / tw; c.font = "700 " + tp + "px " + FACE; }   // a long title is set smaller, never cut
    c.fillStyle = "#2c1e10"; c.fillText(sc.title, 0, y); y += 58 * U;
    const rg = c.createLinearGradient(-170 * U, 0, 170 * U, 0);
    rg.addColorStop(0, "rgba(168, 35, 28, 0)"); rg.addColorStop(0.5, "rgba(168, 35, 28, .9)"); rg.addColorStop(1, "rgba(168, 35, 28, 0)");
    c.fillStyle = rg; c.fillRect(-170 * U, y - 1 * U, 340 * U, 2 * U); y += 44 * U;
    lines.forEach((l, i) => {   // the lines come in one after another (with the voice, where lineAt says when)
      const at = sc.lineAt ? sc.lineAt[i] : 0.5 + i * Math.min(1.1, (sc.t1 - sc.t0 - 2) / Math.max(1, lines.length));
      const a = clamp01((T - at) / 0.45);
      c.globalAlpha = textAlpha * a;
      c.font = "italic 600 " + (tall ? 40 : 43) * U + "px " + FACE; c.fillStyle = "#3b2a16";
      // as if written: the line is revealed from the left
      const lw = c.measureText(l).width;
      c.save(); c.beginPath(); c.rect(-lw / 2 - 4 * U, y - gap / 2, (lw + 8 * U) * ease((T - at) / 0.7), gap); c.clip();
      c.fillText(l, 0, y); c.restore();
      y += gap;
    });
    c.globalAlpha = 1;
    if (sc.seal) {   // the seal: pressed down onto the page, a little rocking, then still
      const st = T - (sc.sealAt == null ? 1.5 : sc.sealAt);
      if (st > 0) {
        const p = clamp01(st / 0.35), sz = (1 + 1.4 * (1 - ease(p))), x = tall ? 0 : pw / 2 - 110 * U, yy = tall ? ph / 2 - 64 * U : ph / 2 - 92 * U;   // (upright: under the lines, in the middle)
        c.save(); c.globalAlpha = p; c.translate(x, yy); c.scale(sz, sz); c.rotate(-0.12 + 0.05 * Math.sin(st * 6) * (1 - p));
        waxSeal(c, sc.seal, 48 * U);
        c.restore();
      }
    }
    c.restore();
    if (sc.scroll) {   // the two rods of the scroll, at the edges of what has unrolled
      for (const sgn of [-1, 1]) {
        const ry = sgn * vh / 2, rw = pw + 46 * U, rh = 22 * U;
        const g = c.createLinearGradient(0, ry - rh / 2, 0, ry + rh / 2);
        g.addColorStop(0, "#8a5a2a"); g.addColorStop(0.5, "#c88f4e"); g.addColorStop(1, "#5a3814");
        c.fillStyle = g; c.strokeStyle = "#2c1e10"; c.lineWidth = 2 * U;
        c.beginPath(); c.roundRect(-rw / 2, ry - rh / 2, rw, rh, rh / 2); c.fill(); c.stroke();
        for (const ex of [-1, 1]) { c.fillStyle = "#c9972f"; c.beginPath(); c.arc(ex * (rw / 2 + 6 * U), ry, 14 * U, 0, 6.2832); c.fill(); c.stroke(); }
      }
    }
    c.restore();
  }
  function emblem(c, kind, x, y, r) {
    c.save(); c.translate(x, y);
    c.fillStyle = "#a8231c"; c.strokeStyle = "#2c1e10"; c.lineWidth = 2 * U;
    if (kind === "tricolor") {   // a flag of three bands, red, blue and orange (the First Republic's, Armenia's today)
      const w = r * 2.6, h = r * 1.6;
      [["#c8102e", 0], ["#0033a0", 1], ["#f2a800", 2]].forEach(([col, k]) => { c.fillStyle = col; c.fillRect(-w / 2, -h / 2 + k * h / 3, w, h / 3 + 0.5); });
      c.strokeRect(-w / 2, -h / 2, w, h);
      c.restore(); return;
    }
    if (kind === "cross") {   // an Armenian cross, its arms flaring
      c.beginPath();
      const a = r, b = r * 0.22;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        c.save(); c.rotate(Math.atan2(dy, dx) + Math.PI / 2);
        c.moveTo(-b, 0); c.lineTo(-b, -a * 0.72); c.quadraticCurveTo(-b * 2.4, -a, -b * 1.6, -a * 1.06); c.lineTo(0, -a * 0.86); c.lineTo(b * 1.6, -a * 1.06); c.quadraticCurveTo(b * 2.4, -a, b, -a * 0.72); c.lineTo(b, 0);
        c.restore();
      }
      c.fill(); c.stroke();
    } else {   // a crown of three points
      c.beginPath(); c.moveTo(-r, r * 0.5); c.lineTo(-r, -r * 0.3); c.lineTo(-r * 0.5, r * 0.1); c.lineTo(0, -r * 0.7); c.lineTo(r * 0.5, r * 0.1); c.lineTo(r, -r * 0.3); c.lineTo(r, r * 0.5); c.closePath();
      c.fillStyle = "#c9972f"; c.fill(); c.stroke();
      c.fillStyle = "#a8231c"; for (const dx of [-0.5, 0, 0.5]) { c.beginPath(); c.arc(dx * r, r * 0.25, r * 0.1, 0, 6.2832); c.fill(); }
    }
    c.restore();
  }
  function waxSeal(c, kind, r) {
    c.fillStyle = "#8e1b16"; c.strokeStyle = "rgba(40, 8, 6, .8)"; c.lineWidth = 2 * U;
    c.beginPath();
    for (let i = 0; i <= 28; i++) { const a = i / 28 * 6.2832, rr = r * (1 + 0.07 * Math.sin(i * 2.7)); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = "rgba(255, 190, 160, .35)"; c.lineWidth = 3 * U; c.beginPath(); c.arc(0, 0, r * 0.74, 0, 6.2832); c.stroke();
    c.save(); c.globalAlpha *= 0.9; c.scale(0.55, 0.55);
    c.fillStyle = "#c2443a";
    emblemInk(c, kind, r);
    c.restore();
  }
  function emblemInk(c, kind, r) {
    c.save(); c.fillStyle = "rgba(255, 200, 170, .55)"; c.strokeStyle = "rgba(60, 10, 8, .7)"; c.lineWidth = 2 * U;
    if (kind === "cross") { c.fillRect(-r * 0.16, -r * 0.8, r * 0.32, r * 1.6); c.fillRect(-r * 0.8, -r * 0.16, r * 1.6, r * 0.32); }
    else { c.beginPath(); c.moveTo(-r * 0.8, r * 0.4); c.lineTo(-r * 0.8, -r * 0.3); c.lineTo(-r * 0.4, r * 0.05); c.lineTo(0, -r * 0.6); c.lineTo(r * 0.4, r * 0.05); c.lineTo(r * 0.8, -r * 0.3); c.lineTo(r * 0.8, r * 0.4); c.closePath(); c.fill(); }
    c.restore();
  }

  // ---- what lies over every scene ----
  function goldText(c, text, x, y, px, face, weight) {
    c.font = (weight || "700") + " " + px + "px " + (face || FACE);
    const g = c.createLinearGradient(0, y - px * 0.5, 0, y + px * 0.5);
    g.addColorStop(0, "#f7e3a0"); g.addColorStop(0.5, "#e2b85a"); g.addColorStop(1, "#a9772a");
    c.lineJoin = "round";
    c.strokeStyle = "rgba(20, 12, 4, .9)"; c.lineWidth = px * 0.16; c.strokeText(text, x, y);
    c.fillStyle = g; c.fillText(text, x, y);
  }
  function spaced(s) { return s.toUpperCase().split("").join(" "); }
  function rule(c, x, y, w) {
    const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, "rgba(201, 151, 47, 0)"); g.addColorStop(0.5, "rgba(232, 190, 96, .95)"); g.addColorStop(1, "rgba(201, 151, 47, 0)");
    c.fillStyle = g; c.fillRect(x - w / 2, y - 0.8 * U, w, 1.6 * U);
    c.fillStyle = "#e8be60";
    c.beginPath(); c.moveTo(x, y - 4.5 * U); c.lineTo(x + 4.5 * U, y); c.lineTo(x, y + 4.5 * U); c.lineTo(x - 4.5 * U, y); c.closePath(); c.fill();
  }
  function titleCard(c, a, dim, o) {
    if (a <= 0) return;
    c.save();
    c.globalAlpha = a;
    c.fillStyle = "rgba(18, 12, 6, " + dim + ")"; c.fillRect(0, 0, W, H);
    const band = c.createLinearGradient(0, H * 0.14, 0, H * 0.66);
    band.addColorStop(0, "rgba(18, 12, 6, 0)"); band.addColorStop(0.5, "rgba(18, 12, 6, .62)"); band.addColorStop(1, "rgba(18, 12, 6, 0)");
    c.fillStyle = band; c.fillRect(0, H * 0.14, W, H * 0.52);
    const x = W / 2, y = H * (o.y || 0.4), tall = H > W;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "700 " + 22 * U * K + "px " + FACE; c.fillStyle = "#e9d9aa";
    c.shadowColor = "rgba(0,0,0,.8)"; c.shadowBlur = 6 * U;
    c.fillText(spaced(o.over), x, y - (tall ? 92 : 78) * U);
    c.shadowColor = "transparent";
    rule(c, x, y - (tall ? 58 : 48) * U, 300 * U);
    goldText(c, o.name, x, y, (tall ? 62 : 66) * U);
    if (o.hy) { c.font = "700 " + 38 * U + "px " + HY; c.fillStyle = "#f1e4bd"; c.strokeStyle = "rgba(20,12,4,.85)"; c.lineWidth = 4 * U; c.strokeText(o.hy, x, y + 60 * U); c.fillText(o.hy, x, y + 60 * U); }
    c.font = "700 " + 31 * U + "px " + FACE;
    c.strokeStyle = "rgba(20,12,4,.95)"; c.lineWidth = 5 * U; c.strokeText(spaced(o.sub), x, y + (o.hy ? 112 : 70) * U);
    c.fillStyle = "#ffb199"; c.fillText(spaced(o.sub), x, y + (o.hy ? 112 : 70) * U);
    c.restore();
  }
  function chip(c, a, o) {
    if (a <= 0) return;
    c.save();
    c.globalAlpha = a;
    const KC = H > W ? 1.28 : 1.3;   // (a landscape film is often watched small, in an upright page: its plaques are set large)
    const x = 34 * U, y = (H > W ? 64 : 30) * U, p1 = 32 * U * KC, p2 = 27 * U * KC;
    c.font = "700 " + p1 + "px " + FACE;
    let w = c.measureText(o.text).width;
    if (o.sub) { c.font = "italic 600 " + p2 + "px " + FACE; w = Math.max(w, c.measureText(o.sub).width); }
    w += 34 * U;
    const h = (o.sub ? p1 + p2 + 26 * U : p1 + 20 * U);
    c.shadowColor = "rgba(0,0,0,.6)"; c.shadowBlur = 10 * U; c.shadowOffsetY = 3 * U;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(58, 40, 22, .94)"); g.addColorStop(1, "rgba(34, 23, 12, .94)");
    c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, 5 * U); c.fill();
    c.shadowColor = "transparent";
    c.strokeStyle = "#c9972f"; c.lineWidth = 1.6 * U; c.stroke();
    c.fillStyle = "#a8231c"; c.fillRect(x, y + 6 * U, 5 * U, h - 12 * U);
    c.textAlign = "left"; c.textBaseline = "top";
    c.font = "700 " + p1 + "px " + FACE; c.fillStyle = "#f3dfa2"; c.fillText(o.text, x + 19 * U, y + 10 * U);
    if (o.sub) { c.font = "italic 600 " + p2 + "px " + FACE; c.fillStyle = "#e6d5ab"; c.fillText(o.sub, x + 19 * U, y + 14 * U + p1); }
    c.restore();
  }
  function vignette(c) {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, "rgba(10, 6, 2, 0)"); g.addColorStop(1, "rgba(10, 6, 2, .5)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  F.setOverlays = function (o) { spec.overlays = o; };
  F.frame = function (t) {
    let i = spec.scenes.findIndex(s => t >= s.t0 && t < s.t1);
    if (i < 0) i = spec.scenes.length - 1;
    const sc = spec.scenes[i];
    if (i !== cur) {
      bi = 1 - bi; cur = i;
      if (sc.kind === "field" && !sc.keep) stage(sc.stage || {}, sc);
      if (sc.kind === "field" && sc.keep && sc.stage && sc.stage.heroTo && hero && hero.alive) { hero.rally = { x: sc.stage.heroTo[0], y: sc.stage.heroTo[1] }; hero.face = sc.stage.heroTo[0] >= hero.x ? 1 : -1; }
    }
    const b = bufs[bi], c = b.getContext("2d");
    if (sc.kind === "field") drawField(sc, t, c); else if (sc.kind === "map") drawMap(sc, t, c); else if (sc.kind === "stone") drawStone(sc, t, c); else if (sc.kind === "card") drawCard(sc, t, c); else if (sc.kind === "rock") drawRockOfVan(sc, t, c); else drawArt(sc, t, c);
    if (sc.tag) {   // the place on screen named in its corner (the plaque in the top left is the voice's; this is the picture's)
      const lines = [[sc.tag, 27 * K, "700"]];
      if (sc.tagSub) lines.push([sc.tagSub, 21 * K, "italic 600", "#8a2a1c"]);
      plaque(c, W - 30 * U, (tall ? 196 : 30) * U, lines, env(t, sc.t0 + (sc.tagAt || 0.3), sc.t1 + 9, 0.5, 0.5), "right");
    }
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.globalAlpha = 1;
    fx.drawImage(b, 0, 0);
    // a dissolve between two pictures; between two looks at the same field, a quick one (a long one reads as a double exposure)
    const prev = i > 0 ? spec.scenes[i - 1] : null;
    const fade = sc.fade != null ? sc.fade : prev && prev.kind === "field" && sc.kind === "field" ? 0.3 : sc.kind === "card" || (prev && prev.kind === "card") ? 0.3 : 0.55;
    if (i > 0 && t - sc.t0 < fade) { fx.globalAlpha = 1 - ease((t - sc.t0) / fade); fx.drawImage(bufs[1 - bi], 0, 0); fx.globalAlpha = 1; }
    vignette(fx);
    // the lower fifth is the subtitles' ground: the picture is dimmed there, so nothing in it asks to be read
    // (the trailer's shots, spec.plain, have no subtitles: no dimmed ground, no fade in from black)
    if (!spec.plain) {
      const lg = fx.createLinearGradient(0, H * 0.74, 0, H);
      lg.addColorStop(0, "rgba(14, 9, 4, 0)"); lg.addColorStop(0.45, "rgba(14, 9, 4, .42)"); lg.addColorStop(1, "rgba(14, 9, 4, .66)");
      fx.fillStyle = lg; fx.fillRect(0, H * 0.74, W, H * 0.26);
    }
    for (const o of spec.overlays) {
      if (o.kind === "chip") chip(fx, env(t, o.t0, o.t1, 0.45, 0.45), o);
      else if (o.kind === "title") titleCard(fx, env(t, o.t0 - 1, o.t1, 0.01, 0.8), o.dim == null ? 0.38 : o.dim, o);
      else if (o.kind === "end") titleCard(fx, env(t, o.t0, o.t1 + 9, 0.9, 1), o.dim == null ? 0.8 : o.dim, o);
    }
    // in from black (the last frame is the closing card, held: the page shows the chronicle's text after it)
    const k = spec.plain ? 1 : clamp01(t / 0.5);
    if (k < 1) { fx.fillStyle = "rgba(12, 8, 4, " + (1 - k) + ")"; fx.fillRect(0, 0, W, H); }
    return i;
  };
})();
