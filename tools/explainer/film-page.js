// Runs inside the game's own page (index.html in its photo harness), injected by film.js. It draws every frame
// of an explainer video with the game's own painters: the battlefield (draw, update), the campaign chart
// (buildWorldTerrain) and the chronicle's painting (briefScene). Titles and plaques are drawn here in the
// game's palette and faces. Nothing in index.html is changed.
(function () {
  "use strict";
  const F = (window.FILM = {});
  const FACE = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
  const HY = '"Noto Serif Armenian", Mshtakan, Sylfaen, "Noto Sans Armenian", "Arian AMU", "DejaVu Serif", serif';
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
    // the campaign chart at twice the page's backing, for close views
    const src = buildWorldTerrain.toString().replace(/^function\s+buildWorldTerrain/, "function").replace(/MAP_BACKING/g, "6");
    mapPlate = (0, eval)("(" + src + ")")(CHAPTERS[mapChapterOf(lv)].chart, false);
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
  function stage(st) {
    if (st.mode === "battle" || st.mode === "garrison") {
      photoStageBattle(lv, st.wave || 5, {});
      if (st.mode === "garrison") { enemies.length = 0; if (typeof corpses !== "undefined") corpses.length = 0; }
    } else {
      curLevel = lv; curDiff = 1;
      resetGame();
      overlayEl.classList.add("hidden");
      waveIdx = st.wave || 0;
    }
    if (st.noHero && typeof hero !== "undefined" && hero) { hero.x = -9999; hero.y = -9999; }
    document.body.classList.add("photoNoHud");
    simT = 0;
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
      simT += 1 / fps;
      for (const s of st.spawn || []) if (!s.done && simT >= s.at) { s.done = true; for (let i = 0; i < (s.n || 1); i++) spawnEnemy(s.role); }
    }
    const cover = Math.max(W / VW, H / VH);
    let [cx, cy, z] = cam(sc, t);
    if (sc.follow) {
      // the camera keeps a walker in view: the hero, or the first foe of a kind still on the road
      const f = sc.follow, e = f.type === "hero" ? hero : enemies.find(x => x.type === f.type && !x.dead) || null;
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
    photo = { time: PHOTO_TIME + t * 1000, zoom: z, cx: cx, cy: cy };
    draw(photo.time);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(canvas, 0, 0, W, H);
  }

  // ---- a plate under a moving camera (the chart, the painting) ----
  function drawPlate(sc, t, c, plate, pw, ph) {
    const cover = Math.max(W / pw, H / ph);
    let [cx, cy, z] = cam(sc, t);
    z *= cover;
    cx = Math.max(W / 2 / z, Math.min(pw - W / 2 / z, cx));
    cy = Math.max(H / 2 / z, Math.min(ph - H / 2 / z, cy));
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
      const lines = [[m.name, m.big ? 27 : 22, "700"]];
      if (m.hy) lines.push([m.hy, m.big ? 19 : 16, "600", "#5e4120", HY]);
      if (m.sub) lines.push([m.sub, m.big ? 17 : 15, "italic 600", "#8a2a1c"]);
      const dy = m.above ? -(lines.reduce((s, l) => s + l[1] * 1.24, 0) + 16 + 24) * U : 24 * U;
      plaque(c, p[0] + (m.dx || 0) * U, p[1] + dy, lines, a, "center");
    }
  }
  function drawArt(sc, t, c) {
    drawPlate(sc, t, c, artPlate, artPlate.width, artPlate.height);
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
    c.font = "700 " + 18 * U + "px " + FACE; c.fillStyle = "#e9d9aa";
    c.shadowColor = "rgba(0,0,0,.8)"; c.shadowBlur = 6 * U;
    c.fillText(spaced(o.over), x, y - (tall ? 82 : 70) * U);
    c.shadowColor = "transparent";
    rule(c, x, y - (tall ? 58 : 48) * U, 300 * U);
    goldText(c, o.name, x, y, (tall ? 62 : 66) * U);
    if (o.hy) { c.font = "700 " + 34 * U + "px " + HY; c.fillStyle = "#f1e4bd"; c.strokeStyle = "rgba(20,12,4,.85)"; c.lineWidth = 4 * U; c.strokeText(o.hy, x, y + 56 * U); c.fillText(o.hy, x, y + 56 * U); }
    c.font = "700 " + 26 * U + "px " + FACE;
    c.strokeStyle = "rgba(20,12,4,.95)"; c.lineWidth = 5 * U; c.strokeText(spaced(o.sub), x, y + (o.hy ? 104 : 66) * U);
    c.fillStyle = "#f58a6e"; c.fillText(spaced(o.sub), x, y + (o.hy ? 104 : 66) * U);
    c.restore();
  }
  function chip(c, a, o) {
    if (a <= 0) return;
    c.save();
    c.globalAlpha = a;
    const x = 34 * U, y = (H > W ? 64 : 34) * U, p1 = 27 * U, p2 = 18 * U;
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
      if (sc.kind === "field" && !sc.keep) stage(sc.stage || {});
    }
    const b = bufs[bi], c = b.getContext("2d");
    if (sc.kind === "field") drawField(sc, t, c); else if (sc.kind === "map") drawMap(sc, t, c); else drawArt(sc, t, c);
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.globalAlpha = 1;
    fx.drawImage(b, 0, 0);
    const fade = sc.fade == null ? 0.8 : sc.fade;
    if (i > 0 && t - sc.t0 < fade) { fx.globalAlpha = 1 - ease((t - sc.t0) / fade); fx.drawImage(bufs[1 - bi], 0, 0); fx.globalAlpha = 1; }
    vignette(fx);
    for (const o of spec.overlays) {
      if (o.kind === "chip") chip(fx, env(t, o.t0, o.t1, 0.45, 0.45), o);
      else if (o.kind === "title") titleCard(fx, env(t, o.t0 - 1, o.t1, 0.01, 0.8), o.dim == null ? 0.38 : o.dim, o);
      else if (o.kind === "end") titleCard(fx, env(t, o.t0, o.t1 + 9, 0.9, 1), o.dim == null ? 0.5 : o.dim, o);
    }
    // in from black (the last frame is the closing card, held: the page shows the chronicle's text after it)
    const k = clamp01(t / 0.5);
    if (k < 1) { fx.fillStyle = "rgba(12, 8, 4, " + (1 - k) + ")"; fx.fillRect(0, 0, W, H); }
    return i;
  };
})();
