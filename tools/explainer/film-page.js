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
      update(1 / fps);
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
    }
    if (st.fallAt != null && !st.fell && t >= st.fallAt) { st.fell = true; heroFalls(); }
    if (!st.live) {   // a still field: what has just fallen settles, the burst of the fall runs out
      for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i]; q.life -= 1 / fps; q.x += (q.vx || 0) / fps; q.y += (q.vy || 0) / fps; q.vy = (q.vy || 0) + 60 / fps; if (q.life <= 0) particles.splice(i, 1); }
    }
    const cover = Math.max(W / VW, H / VH);
    let [cx, cy, z] = cam(sc, t);
    if (sc.follow) {
      // the camera keeps a walker in view: the hero, or the first foe of a kind still on the road
      const f = sc.follow, e = f.type === "hero" ? hero : f.type === "spawn" ? (sc.lead && enemies.indexOf(sc.lead) >= 0 ? sc.lead : null) : (sc.folE && enemies.indexOf(sc.folE) >= 0 ? sc.folE : (sc.folE = enemies.find(x => f.type === "any" ? !x.fly && x.dist > (f.min || 0) : x.type === f.type) || null));
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
    if (st.lift) {   // the dusk of a lost field, lifted a little so what lies on it can be seen
      c.globalCompositeOperation = "screen"; c.fillStyle = "rgba(255, 176, 110, " + st.lift + ")"; c.fillRect(0, 0, W, H); c.globalCompositeOperation = "source-over";
    }
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
        c.strokeStyle = "rgba(240, 228, 190, .85)"; c.lineWidth = 5 * U; c.lineJoin = "round"; c.strokeText(lab, 0, 0);
        c.fillStyle = m.land ? "#7a2a1c" : "#1f4f6e"; c.fillText(lab, 0, 0);
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
      stones[tone] = buildStone(tone);
      if (tone === "pale") {   // carved limestone, a little out of focus: the look of an inscription, no sign to read
        const soft = mk(1600, 1000), g = soft.getContext("2d");
        g.filter = "blur(2.2px)"; g.drawImage(stones[tone], 0, 0); g.filter = "none";
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
    c.translate(W / 2 + (sc.drift || 0) * U * (k - 0.5), H * (tall ? 0.42 : 0.43)); c.scale(z, z);
    const lines = sc.lines || [], gap = (tall ? 50 : 46) * U;
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
    let y = -((sc.emblem ? 70 : 0) + (sc.rubric ? 62 : 0) + 58 + 44 + (lines.length - 1) * (tall ? 50 : 46)) * U / 2;
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
      c.font = "italic 600 " + (tall ? 36 : 37) * U + "px " + FACE; c.fillStyle = "#3b2a16";
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
    if (sc.kind === "field") drawField(sc, t, c); else if (sc.kind === "map") drawMap(sc, t, c); else if (sc.kind === "stone") drawStone(sc, t, c); else if (sc.kind === "card") drawCard(sc, t, c); else drawArt(sc, t, c);
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
    const fade = sc.fade != null ? sc.fade : prev && prev.kind === "field" && sc.kind === "field" ? 0.3 : 0.55;
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
      else if (o.kind === "end") titleCard(fx, env(t, o.t0, o.t1 + 9, 0.9, 1), o.dim == null ? 0.74 : o.dim, o);
    }
    // in from black (the last frame is the closing card, held: the page shows the chronicle's text after it)
    const k = spec.plain ? 1 : clamp01(t / 0.5);
    if (k < 1) { fx.fillStyle = "rgba(12, 8, 4, " + (1 - k) + ")"; fx.fillRect(0, 0, W, H); }
    return i;
  };
})();
