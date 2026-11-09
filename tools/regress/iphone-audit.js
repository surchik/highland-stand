// The in-page half of iphone.js: what the quality bar measures, run inside the page (page.evaluate). install() puts
// window.__hsAudit in place; canvasHook (an init script) counts the size of the text the game draws on its canvases.
// Each function here is serialized into the page: no closures over this file.
"use strict";

// Every fillText and strokeText is measured while window.__hsText.on is set: the font's size times the context's
// scale and the canvas's own scale on the screen, in CSS px. A canvas that is not on the page (a sprite baked for
// later) is measured only inside paintRibbon (the wave and pause banners), whose sprite is drawn RIBBON_W world
// units wide on the field.
function canvasHook() {
  const rec = window.__hsText = { on: false, list: [], ribbon: false };
  const P = CanvasRenderingContext2D.prototype;
  for (const name of ["fillText", "strokeText"]) {
    const orig = P[name];
    P[name] = function (text) {
      if (rec.on) {
        try {
          const m = /(\d+(?:\.\d+)?)px/.exec(this.font), fpx = m ? +m[1] : 10;
          const t = this.getTransform(), k = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c));
          const cv = this.canvas;
          let px = null, where = null;
          if (cv.isConnected) {
            const r = cv.getBoundingClientRect();
            if (r.width) { px = fpx * k * r.width / cv.width; where = cv.id || "canvas"; }
          } else if (rec.ribbon && typeof RIBBON_W !== "undefined" && typeof scale !== "undefined" && cv.width) {
            px = fpx * k * RIBBON_W * scale / cv.width; where = "banner";
          }
          if (px !== null && String(text).trim()) rec.list.push({ where, px: Math.round(px * 10) / 10, text: String(text).trim().slice(0, 40) });
        } catch (e) { /* a measurement never breaks the game */ }
      }
      return orig.apply(this, arguments);
    };
  }
}

function install() {
  if (window.__hsAudit) return;
  const CONTROL = "button, [role=button], [role=radio], input, select, a[href], .tgl, .chip[data-role], .chip.warn, " +
    ".foe[data-role], #shop .card[data-type], .chTab, .diffBtn, .tbg, .eraBtn";
  const A = {};
  A.CONTROL = CONTROL;
  // the visible area minus the safe areas, as the page itself reads them (#safeProbe pads itself by --sa*)
  A.safe = () => {
    const cs = getComputedStyle(document.getElementById("safeProbe"));
    const l = parseFloat(cs.paddingLeft) || 0, t = parseFloat(cs.paddingTop) || 0;
    const r = parseFloat(cs.paddingRight) || 0, b = parseFloat(cs.paddingBottom) || 0;
    return { l, t, r: innerWidth - r, b: innerHeight - b, W: innerWidth, H: innerHeight, ins: { l, t, r, b } };
  };
  A.name = (e) => {
    if (!e) return "nothing";
    if (e === document.body) return "body";
    let n = e.tagName.toLowerCase() + (e.id ? "#" + e.id : "");
    if (!e.id && typeof e.className === "string" && e.className.trim()) n += "." + e.className.trim().split(/\s+/).slice(0, 2).join(".");
    else if (!e.id && e.className && e.className.baseVal) n += "." + e.className.baseVal.trim().split(/\s+/)[0];
    const txt = (e.getAttribute && (e.getAttribute("aria-label") || "")) || (e.textContent || "").replace(/\s+/g, " ").trim();
    if (txt && !/^(canvas|svg|use)$/.test(e.tagName.toLowerCase())) n += ' "' + txt.slice(0, 26) + (txt.length > 26 ? "…" : "") + '"';
    return n;
  };
  // shown at all: laid out, not hidden, not inside a faded-out layer
  A.visible = (e) => {
    if (!e || !e.isConnected) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let p = e; p && p.nodeType === 1; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  };
  // the part of a box the page lets be seen: cut by every ancestor that clips (overflow other than visible) and by
  // the window; a fixed element leaves its ancestors' clipping behind. Returns the box seen and what cut it
  A.seen = (e, box) => {
    let r = box || e.getBoundingClientRect();
    let v = { l: r.left, t: r.top, r: r.right, b: r.bottom }, by = null, scrollBy = null;
    let fixed = getComputedStyle(e).position === "fixed";
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (!fixed && (cs.overflowX !== "visible" || cs.overflowY !== "visible") && p !== document.body) {
        const q = p.getBoundingClientRect();
        const c = { l: Math.max(v.l, q.left + p.clientLeft), t: Math.max(v.t, q.top + p.clientTop),
          r: Math.min(v.r, q.left + p.clientLeft + p.clientWidth), b: Math.min(v.b, q.top + p.clientTop + p.clientHeight) };
        if (c.r - c.l < v.r - v.l - 0.5 || c.b - c.t < v.b - v.t - 0.5) {
          const scrolls = (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) ||
            (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1);
          // what overflows above or left of a frame's scroll origin (a centered column taller than its frame) can
          // never be scrolled to: it is cut off, not reached by scrolling
          const ox = q.left + p.clientLeft - p.scrollLeft, oy = q.top + p.clientTop - p.scrollTop;
          const before = r.top < oy - 0.5 || r.left < ox - 0.5;
          if (scrolls && !before) scrollBy = scrollBy || p; else by = by || p;
        }
        v = c;
      }
      if (cs.position === "fixed") fixed = true;
    }
    const w = { l: Math.max(v.l, 0), t: Math.max(v.t, 0), r: Math.min(v.r, innerWidth), b: Math.min(v.b, innerHeight) };
    if (w.r - w.l < v.r - v.l - 0.5 || w.b - w.t < v.b - v.t - 0.5) by = by || "window";
    v = w;
    const area = Math.max(0, v.r - v.l) * Math.max(0, v.b - v.t), full = Math.max(1, (r.right - r.left) * (r.bottom - r.top));
    return { v, share: area / full, by, scrollBy };
  };
  // inside a frame that scrolls (overflow auto or scroll, with more to show), short of a fixed layer
  A.scrolls = (e) => {
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (getComputedStyle(e).position === "fixed") return false;
      const cs = getComputedStyle(p);
      if ((/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) || (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1)) return true;
      if (cs.position === "fixed") return false;
      e = p;
    }
    return false;
  };
  A.hits = (e, x, y) => {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
    const h = document.elementFromPoint(x, y);
    if (!h) return false;
    if (h === e || e.contains(h)) return true;
    // a wave chip answers a finger anywhere in the wave cap's band above Send Wave, the nearest chip across within
    // 6 px (foeTargetAt), as the game itself reads the tap
    if (e.matches(".chip[data-role]") && e.closest("#waveInfo") && h.closest(".trayCap.right") && !h.closest("#waveBtn")) {
      const wb = document.getElementById("waveBtn").getBoundingClientRect(), box = document.getElementById("waveInfo").getBoundingClientRect();
      if (y > wb.top - 2) return false;
      let best = null, bd = 1e9;
      for (const c of document.querySelectorAll("#waveInfo .chip[data-role]")) {
        const r = c.getBoundingClientRect();
        if (!r.width || r.bottom > box.bottom + 1) continue;
        const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
        if (d < bd) { bd = d; best = c; }
      }
      return best === e && bd <= 6;
    }
    return false;
  };
  A.hitName = (x, y) => (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight ? "off the screen" : A.name(document.elementFromPoint(x, y)));
  // how far a finger reaches the element through its center, across and down (pseudo-elements that widen a button's
  // reach count, as they do for a real finger)
  A.extent = (e, x, y) => {
    let l = 0, r = 0, u = 0, d = 0;
    while (l < 100 && A.hits(e, x - l - 1, y)) l++;
    while (r < 100 && A.hits(e, x + r + 1, y)) r++;
    while (u < 100 && A.hits(e, x, y - u - 1)) u++;
    while (d < 100 && A.hits(e, x, y + d + 1)) d++;
    return { w: l + r + 1, h: u + d + 1 };
  };
  const inBands = (r, S) => {
    const out = [];
    if (r.left < S.l - 0.5) out.push("left " + Math.round(r.left) + " < " + Math.round(S.l));
    if (r.right > S.r + 0.5) out.push("right " + Math.round(r.right) + " > " + Math.round(S.r));
    if (r.top < S.t - 0.5) out.push("top " + Math.round(r.top) + " < " + Math.round(S.t));
    if (r.bottom > S.b + 0.5) out.push("bottom " + Math.round(r.bottom) + " > " + Math.round(S.b));
    return out;
  };
  A.inBands = inBands;
  const qsa = (sels) => {
    const out = [];
    for (const s of [].concat(sels || [])) for (const e of document.querySelectorAll(s)) if (!out.includes(e)) out.push(e);
    return out;
  };

  // One state of the page against the quality bar. spec:
  //   root      the pop-up (a selector; the body when left out); a root not on screen fails
  //   parts     boxes that must lie inside the visible area minus the safe areas (default: the root)
  //   controls  the controls to hold to the bar (default: every control inside the root); "none" for none
  //   primary   selectors of the main way forward: 44 x 44 px to a finger, and never only reachable by scrolling
  //   scroll    "page": anything may be reached by scrolling (an upright phone's best effort); "inside" (default):
  //             a part or control may scroll inside its pop-up, but a primary control must be on screen as it opens
  //   text      where to read the text (default: the root); [] for none
  //   noCover   the root must not lie over any control outside it (toasts, notes, the Home Screen tip)
  //   ignore    controls to leave out
  A.check = (spec) => {
    const S = A.safe(), notes = [];
    // failures of one kind in one state come out as one line
    const kinds = new Map(), order = [];
    const fails = { push(m, kind) { if (!kind) { order.push(m); return; } if (!kinds.has(kind)) { kinds.set(kind, []); order.push(kind); } kinds.get(kind).push(m); } };
    const root = spec.root ? document.querySelector(spec.root) : document.body;
    if (!root || !A.visible(root)) return { fails: [(spec.root || "the page") + " is not shown"], notes };
    const pageScroll = spec.scroll === "page";
    const restore = [];
    const scrollTo = (e) => {
      for (let p = e.parentElement; p; p = p.parentElement) if (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1) restore.push([p, p.scrollTop, p.scrollLeft]);
      e.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    // the parts: inside the safe area, or (a part that runs long) clipped only by something that scrolls
    for (const e of qsa(spec.parts || [spec.root || "body"])) {
      if (!A.visible(e)) continue;
      const r = e.getBoundingClientRect(), out = inBands(r, S);
      if (!out.length) continue;
      const s = A.seen(e);
      const sideways = out.filter(x => /^(left|right)/.test(x));
      if (s.scrollBy && !s.by && !sideways.length) { notes.push(A.name(e) + " runs past the screen and scrolls"); continue; }
      if (pageScroll && !sideways.length && (s.scrollBy || /auto|scroll/.test(getComputedStyle(e).overflowY))) { notes.push(A.name(e) + " runs past the screen and scrolls"); continue; }
      fails.push(A.name(e) + " (" + out.join(", ") + ")", "runs off the screen or into the safe area: ");
    }
    // the controls
    const ignore = qsa(spec.ignore);
    const ctrls = spec.controls === "none" ? [] : (spec.controls ? qsa(spec.controls) : [...root.querySelectorAll(CONTROL)])
      .filter(e => A.visible(e) && !ignore.includes(e) && !e.closest("[aria-hidden=true]"));
    const prim = qsa(spec.primary);
    const seenFail = new Set();
    // every control as the state opens, before anything is scrolled to reach another
    const first = new Map(ctrls.map(e => [e, A.seen(e)]));
    for (const e of ctrls) {
      const isP = prim.includes(e), nm = A.name(e);
      let s = first.get(e);
      // seen as the state opened: measured where it stands now (scrolled back if reaching another moved it away)
      if (s.share >= 0.9) { s = A.seen(e); if (s.share < 0.9) { for (const [p, t, l] of restore.slice().reverse()) { p.scrollTop = t; p.scrollLeft = l; } s = A.seen(e); } }
      if (s.share < 0.9) {
        const may = s.scrollBy && !s.by && (!isP || pageScroll);
        if (may || (pageScroll && s.scrollBy)) { scrollTo(e); s = A.seen(e); notes.push(nm + " is reached by scrolling"); }
        else if (isP && s.scrollBy && !s.by) { fails.push(nm, "the way forward is only seen after scrolling " + A.name(s.scrollBy).split(" ")[0] + ": "); continue; }
        if (s.share < 0.9) {
          fails.push(nm + " (box " + [e.getBoundingClientRect().left, e.getBoundingClientRect().top, e.getBoundingClientRect().right, e.getBoundingClientRect().bottom].map(Math.round).join(",") + ")",
            (s.share < 0.05 ? "off the screen" : "cut off") + (s.by && s.by !== "window" ? " by " + A.name(s.by).split(" ")[0] : " by the edge of the screen") + ": ");
          continue;
        }
      }
      const r = e.getBoundingClientRect();
      // (a control in a frame that scrolls can be scrolled out of a band)
      const band = A.scrolls(e) ? [] : inBands(r, S);
      if (band.length) fails.push(nm + " (" + band.join(", ") + ")", "in the safe area: ");
      const cx = (s.v.l + s.v.r) / 2, cy = (s.v.t + s.v.b) / 2;
      if (!A.hits(e, cx, cy)) { fails.push(nm + " under " + A.hitName(cx, cy), "covered at the center: "); continue; }
      // the middle of each edge, a little inside it (a round or pill-shaped button's corners are not its own)
      const ix = Math.min(5, (s.v.r - s.v.l) / 5), iy = Math.min(5, (s.v.b - s.v.t) / 5);
      const edges = [[s.v.l + ix, cy], [s.v.r - ix, cy], [cx, s.v.t + iy], [cx, s.v.b - iy]];
      const bad = edges.find(([x, y]) => !A.hits(e, x, y));
      if (bad) fails.push(nm + " under " + A.hitName(bad[0], bad[1]), "partly covered: ");
      if (e.matches("input[type=range]") || e.disabled) continue;   // a slider's thumb, and a button that takes no press now
      const ex = A.extent(e, cx, cy), need = isP ? 44 : 36;
      if (Math.min(ex.w, ex.h) < need) {
        const key = (e.className || e.tagName) + "|" + ex.w + "x" + ex.h;
        if (!seenFail.has(key)) { seenFail.add(key); fails.push(nm + " " + ex.w + "x" + ex.h, isP ? "the way forward is under 44 px to a finger: " : "under 36 px to a finger: "); }
      }
    }
    // the text is read as the state opened
    for (const [p, t, l] of restore.slice().reverse()) { p.scrollTop = t; p.scrollLeft = l; }
    // a primary control that is not on screen at all
    if (spec.primaryRequired && !prim.some(e => A.visible(e))) fails.push("no way forward is shown (" + [].concat(spec.primary).join(", ") + ")");
    // the text: at least 11 px, not cut off, not under a control or anything else, out of the safe area
    const textRoots = spec.text === undefined ? [root] : qsa(spec.text);
    const small = new Map(), cut = new Set(), under = new Set(), banded = new Set();
    for (const tr of textRoots) {
      const walker = document.createTreeWalker(tr, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const txt = n.nodeValue.replace(/\s+/g, " ").trim();
        if (!txt) continue;
        const par = n.parentElement;
        if (!par || !A.visible(par) || par.closest("svg")) continue;
        const cs = getComputedStyle(par), fs = parseFloat(cs.fontSize);
        const snip = txt.slice(0, 30) + (txt.length > 30 ? "…" : "");
        if (fs < 10.95) { const k = fs.toFixed(1); if (!small.has(k)) small.set(k, []); if (small.get(k).length < 3) small.get(k).push(snip); }
        const range = document.createRange();
        range.selectNodeContents(n);
        const passes = cs.pointerEvents === "none";
        for (const lr of range.getClientRects()) {
          if (lr.width < 2 || lr.height < 2) continue;
          const s = A.seen(par, lr);
          if (s.share < 0.6) {
            if (s.scrollBy && !s.by) continue;   // reached by scrolling its frame
            if (pageScroll && s.share < 0.6 && !s.by) continue;
            cut.add(snip + (s.by && s.by !== "window" ? " (by " + A.name(s.by) + ")" : " (by the edge of the screen)"));
            continue;
          }
          const lb = A.scrolls(par) ? [] : inBands(lr, S);
          if (lb.length) banded.add(snip);
          if (passes) continue;
          // five points along the line: a button laid over part of it is found wherever it lies
          const my = (s.v.t + s.v.b) / 2;
          for (const f of [0.08, 0.3, 0.5, 0.7, 0.92]) {
            const mx = s.v.l + (s.v.r - s.v.l) * f;
            const h = mx >= 0 && my >= 0 && mx < innerWidth && my < innerHeight ? document.elementFromPoint(mx, my) : null;
            if (h && !(par.contains(h) || h.contains(par))) {
              const ctl = h.closest(CONTROL);
              if (!(ctl && ctl.contains(par))) { under.add(snip + " under " + A.name(ctl || h)); break; }
            }
          }
        }
      }
    }
    for (const [fs, list] of small) fails.push("text at " + fs + " px (needs 11): " + list.map(s => '"' + s + '"').join(", "));
    if (cut.size) fails.push("text cut off: " + [...cut].slice(0, 4).join("; ") + (cut.size > 4 ? "; and " + (cut.size - 4) + " more" : ""));
    if (under.size) fails.push("text covered: " + [...under].slice(0, 3).join("; ") + (under.size > 3 ? "; and " + (under.size - 3) + " more" : ""));
    if (banded.size) fails.push("text runs off the screen or into the safe area: " + [...banded].slice(0, 3).map(s => '"' + s + '"').join(", "));
    // a layer over the field that takes no taps must not hide a control either
    if (spec.noCover) {
      const rr = root.getBoundingClientRect();
      for (const c of document.querySelectorAll(CONTROL)) {
        if (root.contains(c) || !A.visible(c)) continue;
        const q = c.getBoundingClientRect();
        const ov = Math.max(0, Math.min(rr.right, q.right) - Math.max(rr.left, q.left)) * Math.max(0, Math.min(rr.bottom, q.bottom) - Math.max(rr.top, q.top));
        if (ov > 0.15 * q.width * q.height) fails.push(A.name(c), "it lies over controls (taps pass, but they are hidden): ");
      }
    }
    for (const [p, t, l] of restore.reverse()) { p.scrollTop = t; p.scrollLeft = l; }
    return { fails: order.map(k => kinds.has(k) ? k + kinds.get(k).join("; ") : k), notes };
  };

  // the battlefield: how much of the safe area it fills, how much of it is free of the HUD, the pads, plots and
  // towers a finger must reach (none under the HUD), and the size of a tower's tap zone
  A.field = () => {
    const S = A.safe(), cv = document.getElementById("game"), r = cv.getBoundingClientRect();
    const fx = r.left + offX, fy = r.top + offY, fw = VW * scale, fh = VH * scale;
    const v = { l: Math.max(fx, 0), t: Math.max(fy, 0), r: Math.min(fx + fw, innerWidth), b: Math.min(fy + fh, innerHeight) };
    const safeArea = (S.r - S.l) * (S.b - S.t);
    let clear = 0, n = 0;
    for (let i = 0; i < 40; i++) for (let j = 0; j < 22; j++) {
      const x = v.l + (i + 0.5) * (v.r - v.l) / 40, y = v.t + (j + 0.5) * (v.b - v.t) / 22;
      n++;
      if (document.elementFromPoint(x, y) === cv && x >= S.l && x <= S.r && y >= S.t && y <= S.b) clear++;
    }
    const fieldArea = (v.r - v.l) * (v.b - v.t);
    const out = { w: Math.round(fw), h: Math.round(fh), x: Math.round(fx), y: Math.round(fy), share: fieldArea / safeArea,
      clear: clear / n * fieldArea / safeArea, scale, pads: [], plots: [], towers: [], zone: null };
    const where = (x, y) => {
      const e = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? document.elementFromPoint(x, y) : null;
      if (e !== cv) return "under " + A.hitName(x, y);
      if (x < S.l || x > S.r || y < S.t || y > S.b) return "in the safe area";
      return "";
    };
    PADS.forEach((P, i) => {
      if (towers.some(t => t.pad === i)) return;
      const p = proj(P[0], P[1]), x = r.left + offX + p.x * scale, y = r.top + offY + (p.y + 4 * p.s) * scale;
      const w = where(x, y);
      if (w) out.pads.push("pad " + i + " at " + Math.round(x) + "," + Math.round(y) + " " + w);
    });
    // a plot's price board keeps "a legible size" of 0.96 device px a unit (plotSignView), so its 12.5-unit price is
    // read here as an iPhone shows it, at the canvas's density there (2, dprCap), whatever the density of this run
    out.plotLabel = null;
    (typeof plots !== "undefined" ? plots : []).forEach((P, i) => {
      const pp = proj(P[0], P[1]), ks = Math.max(1, pp.s, 0.96 / Math.max(0.2, scale * 2)), px = 12.5 * ks * scale;
      out.plotLabel = out.plotLabel === null ? px : Math.min(out.plotLabel, px);
      const rc = plotSignRects.get(P);
      if (!rc) return;
      const x = r.left + offX + (rc[0] + rc[2]) / 2 * scale, y = r.top + offY + (rc[1] + rc[3]) / 2 * scale;
      const w = where(x, y);
      if (w) out.plots.push("plot " + i + " sign at " + Math.round(x) + "," + Math.round(y) + " " + w);
    });
    let zw = 1e9, zh = 1e9;
    for (const t of towers) {
      const p = proj(t.x, t.y), s = Math.max(0.35, p.s);
      const x = r.left + offX + p.x * scale, y = r.top + offY + (p.y - 26 * s) * scale;
      zw = Math.min(zw, 60 * s * scale); zh = Math.min(zh, 88 * s * scale);
      const w = where(x, y);
      if (w) out.towers.push("the tower on pad " + t.pad + " at " + Math.round(x) + "," + Math.round(y) + " " + w);
    }
    if (towers.length) out.zone = { w: Math.round(zw), h: Math.round(zh) };
    return out;
  };
  // the client point a finger presses to pick a tower (the middle of its tap zone, towerUnderPointer)
  A.towerPoint = (t) => {
    const r = document.getElementById("game").getBoundingClientRect(), p = proj(t.x, t.y), s = Math.max(0.35, p.s);
    return { x: r.left + offX + p.x * scale, y: r.top + offY + (p.y - 26 * s) * scale };
  };
  // a point of the open field a finger can tap to put a panel away: on the canvas, far from towers, pads and the hero
  A.emptyPoint = () => {
    const cv = document.getElementById("game"), r = cv.getBoundingClientRect(), S = A.safe();
    let best = null, bd = -1;
    for (let i = 1; i < 24; i++) for (let j = 1; j < 14; j++) {
      const x = S.l + (S.r - S.l) * i / 24, y = S.t + (S.b - S.t) * j / 14;
      if (document.elementFromPoint(x, y) !== cv) continue;
      const vx = (x - r.left - offX) / scale, vy = (y - r.top - offY) / scale;
      if (vx < 0 || vy < 0 || vx > VW || vy > VH) continue;
      let d = 1e9;
      for (const t of towers) { const p = proj(t.x, t.y); d = Math.min(d, Math.hypot(p.x - vx, p.y - 30 - vy)); }
      for (const P of PADS) { const p = proj(P[0], P[1]); d = Math.min(d, Math.hypot(p.x - vx, p.y - vy)); }
      if (hero && hero.alive) { const p = proj(hero.x, hero.y); d = Math.min(d, Math.hypot(p.x - vx, p.y - vy)); }
      for (const P of plots || []) { const p = proj(P[0], P[1]); d = Math.min(d, Math.hypot(p.x - vx, p.y - vy)); }
      if (d > bd) { bd = d; best = { x, y }; }
    }
    return best;
  };
  // the text the canvases drew while recording: the smallest of each canvas, and what stands under 11 px
  A.textReport = () => {
    const list = window.__hsText ? window.__hsText.list : [];
    const by = {};
    for (const e of list) {
      const b = by[e.where] || (by[e.where] = { min: 1e9, small: new Map(), n: 0 });
      b.n++;
      b.min = Math.min(b.min, e.px);
      if (e.px < 10.95) { const k = e.text; if (!b.small.has(k) || b.small.get(k) > e.px) b.small.set(k, e.px); }
    }
    const out = {};
    for (const k in by) out[k] = { min: by[k].min, n: by[k].n, small: [...by[k].small].sort((a, b) => a[1] - b[1]).slice(0, 6) };
    return out;
  };
  window.__hsAudit = A;
}

module.exports = { canvasHook, install };
