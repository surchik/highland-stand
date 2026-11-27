// Renders one cut's picture: node film.js <cut> <narration.wav.json> <out.mkv> [--fps 30] [--ss 1.5] [--from s --to s] [--stills dir]
// The page is the game itself (index.html in its photo harness) with film-page.js injected; every frame is drawn
// there and photographed, then scaled down by ffmpeg (the frames are drawn larger than the video: --ss).
// --stills dir writes a still every 2 s (--every s) instead of a video (a quick look).
const path = require("path"), fs = require("fs"), { spawn } = require("child_process");
const { chromium } = require(process.env.PW_PATH || "playwright");
const FILMS = require("./films.js");

function arg(name, d) { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : d; }

function resolve(cut, tl, cues) {
  const f = FILMS[cut], S = tl.sentences, dur = tl.duration;
  // a position: a whole number is the moment a little before that sentence begins; "s/c" is the moment the words of
  // part c of sentence s begin (its cues as scripts.json sets them, timed as the subtitles are: <cut>.parts.json),
  // "s/c+0.5" half a second after it
  const cueAt = (p, lead) => {
    const m = /^(\d+)\/(\d+)([+-][\d.]+)?$/.exec(p);
    if (!m) throw new Error("bad position " + p);
    const list = (cues || []).filter(c => c.sentence === +m[1]);
    const c = list[+m[2]];
    let t;
    if (c) t = c.speech; else { const s = S[+m[1]]; t = s.start + (s.end - s.start) * (+m[2]) / Math.max(1, (f.cueCount || 2)); }
    return t + (m[3] ? +m[3] : 0) - (lead == null ? 0.25 : lead);
  };
  const at = (p, lead) => {
    if (typeof p === "string") return cueAt(p, lead);
    const i = Math.floor(p), k = p - i, s = S[Math.min(i, S.length - 1)];
    return k ? s.start + k * (s.end - s.start) : Math.max(0, s.start - (lead == null ? 0.45 : lead));
  };
  const scenes = f.scenes.map(s => JSON.parse(JSON.stringify(s)));
  const titleEnd = S[0].start + 0.3;   // the title has the film's first seconds to itself, and is gone as the voice begins
  scenes.forEach((s, i) => {
    s.t0 = i ? at(s.at) : 0;
    for (const m of s.markers || []) { m.at = Math.max(at(m.at, 0), i ? 0 : titleEnd + 0.2) - s.t0; if (m.until != null) m.until = at(m.until, 0) - s.t0; }
    if (s.lineAt) s.lineAt = s.lineAt.map(p => at(p, 0.1) - s.t0);
    if (s.sealAt != null) s.sealAt = at(s.sealAt, 0.1) - s.t0;
    if (s.stage && s.stage.fallAt != null) s.stage.fallAt = at(s.stage.fallAt, 0);   // (absolute: the moment he falls)
  });
  scenes.forEach((s, i) => { s.t1 = i + 1 < scenes.length ? scenes[i + 1].t0 : dur; });
  // a scene that goes on with the battle before it counts its spawns and fall from that battle's start
  const overlays = [];
  // the title has the film's first seconds to itself (the voice begins as it clears)
  const title = { kind: "title", t0: 0, t1: titleEnd, over: "Highland Stand · Chronicle" };
  overlays.push(title);
  const end = (p) => typeof p === "string" ? at(p, 0) : p % 1 ? at(p) : S[p].end + 0.3;
  const chips = (f.chips || []).map(c => ({ kind: "chip", t0: Math.max(at(c.from, 0.1), title.t1 - 0.25), t1: end(c.to), text: c.text, sub: c.sub }));
  chips.forEach((c, i) => {   // a plaque stays long enough to read, and gives way to the next, and to a page of the chronicle
    const next = i + 1 < chips.length ? chips[i + 1].t0 - 0.15 : dur;
    c.t1 = Math.min(Math.max(c.t1, c.t0 + 2.4), next);
    for (const s of scenes) if (s.kind === "card" && s.t0 > c.t0 && s.t0 < c.t1) c.t1 = s.t0;
    if (c.t1 - c.t0 >= 1.2) overlays.push(c);   // (one that could not be read is left out, never flashed)
  });
  // the closing card comes up once the last line has been said
  const last = S[S.length - 1], endAt = last.end + 0.25;
  for (const o of overlays) if (o.kind === "chip" && o.t1 > endAt) o.t1 = endAt + 0.3;
  overlays.push({ kind: "end", t0: endAt, t1: dur, over: "Begin the Stand" });
  return { level: f.level, scenes, overlays, dur };
}

(async () => {
  const [cut, tlPath, out] = process.argv.slice(2);
  const tall = /vertical/.test(cut), fps = +arg("fps", 24), ss = +arg("ss", 1.25);
  const OW = tall ? 720 : 1280, OH = tall ? 1280 : 720, W = Math.round(OW * ss), H = Math.round(OH * ss);
  const tl = JSON.parse(fs.readFileSync(tlPath, "utf8"));
  const cuesPath = tlPath.replace(/\.narr\.wav\.json$/, ".parts.json");
  const spec = resolve(cut, tl, fs.existsSync(cuesPath) ? JSON.parse(fs.readFileSync(cuesPath, "utf8")) : null);
  const stills = arg("stills", null);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file://" + path.resolve(__dirname, "..", "..", "index.html") + "?shot=battle&lv=" + spec.level + "&wave=1&nohud");
  await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
  if ((await page.title()) !== "PHOTO_READY") throw new Error("the harness did not come up");
  await page.addScriptTag({ path: path.join(__dirname, "film-page.js") });
  const info = await page.evaluate(o => FILM.init(o), { W, H, fps, level: spec.level, scenes: spec.scenes, overlays: spec.overlays, dur: spec.dur });
  // the title and closing card carry the battlefield's own name and date, read from the page
  for (const o of spec.overlays) if (o.kind === "title" || o.kind === "end") Object.assign(o, { name: info.name, hy: info.hy, sub: FILMS[cut].date || info.date });
  await page.evaluate(o => { FILM.setOverlays(o); }, spec.overlays);
  const n = Math.round(spec.dur * fps), from = Math.round(+arg("from", 0) * fps), to = Math.min(n, Math.round(+arg("to", 1e9) * fps));
  let ff = null;
  if (!stills) {
    ff = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
      "-vf", "scale=" + OW + ":" + OH + ":flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "8", "-pix_fmt", "yuv420p", out], { stdio: ["pipe", "inherit", "inherit"] });
  } else fs.mkdirSync(stills, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < to; i++) {
    const t = i / fps;
    // every frame is drawn, in order, even those before --from: the battle is a simulation and has no other way there
    await page.evaluate(t => FILM.frame(t), t);
    if (i < from) continue;
    if (stills) { if (i % Math.round(fps * +arg("every", 2)) === 0) await page.screenshot({ path: path.join(stills, cut + "-" + t.toFixed(1).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 88, clip: { x: 0, y: 0, width: W, height: H } }); continue; }
    const buf = await page.screenshot({ type: "jpeg", quality: 96, clip: { x: 0, y: 0, width: W, height: H } });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (i % 300 === 0) process.stderr.write(cut + " frame " + i + "/" + n + " " + ((Date.now() - t0) / 1000).toFixed(0) + " s\n");
  }
  if (ff) { ff.stdin.end(); await new Promise(r => ff.on("close", r)); }
  await browser.close();
  fs.writeFileSync(out + ".scenes.json", JSON.stringify(spec, null, 1));
  if (errs.length) { console.error("PAGE ERRORS: " + [...new Set(errs)].join(" | ")); process.exit(1); }
  console.log(cut, "frames", to - from, "in", ((Date.now() - t0) / 1000).toFixed(0), "s");
})().catch(e => { console.error(e); process.exit(1); });
