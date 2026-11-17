// Renders one cut's picture: node film.js <cut> <narration.wav.json> <out.mkv> [--fps 30] [--ss 1.5] [--from s --to s] [--stills dir]
// The page is the game itself (index.html in its photo harness) with film-page.js injected; every frame is drawn
// there and photographed, then scaled down by ffmpeg (the frames are drawn larger than the video: --ss).
// --stills dir writes a still every 2 s instead of a video (a quick look).
const path = require("path"), fs = require("fs"), { spawn } = require("child_process");
const { chromium } = require(process.env.PW_PATH || "playwright");
const FILMS = require("./films.js");

function arg(name, d) { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : d; }

function resolve(cut, tl) {
  const f = FILMS[cut], S = tl.sentences, dur = tl.duration;
  // a position: a whole number is the moment a little before that sentence begins
  const at = (p, lead) => { const i = Math.floor(p), k = p - i, s = S[Math.min(i, S.length - 1)]; return k ? s.start + k * (s.end - s.start) : Math.max(0, s.start - (lead == null ? 0.45 : lead)); };
  const scenes = f.scenes.map(s => Object.assign({}, s));
  scenes.forEach((s, i) => {
    s.t0 = i ? at(s.at) : 0;
    for (const m of s.markers || []) { m.at = Math.max(at(m.at, 0), i ? 0 : 3.7) - s.t0; if (m.until != null) m.until = at(m.until, 0) - s.t0; }
  });
  scenes.forEach((s, i) => { s.t1 = i + 1 < scenes.length ? scenes[i + 1].t0 : dur + 1; });
  const overlays = [];
  overlays.push({ kind: "title", t0: 0, t1: Math.min(3.6, S[0].start + 3.1), over: "Highland Stand · Chronicle" });
  for (const c of f.chips || []) overlays.push({ kind: "chip", t0: Math.max(at(c.from, 0.1), overlays[0].t1 - 0.3), t1: S[c.to].end + 0.25, text: c.text, sub: c.sub });
  overlays.push({ kind: "end", t0: at(f.end.from, 0.1) + 0.2, t1: dur, over: "Begin the Stand" });
  return { level: f.level, scenes, overlays, dur };
}

(async () => {
  const [cut, tlPath, out] = process.argv.slice(2);
  const tall = /vertical/.test(cut), fps = +arg("fps", 30), ss = +arg("ss", 1.25);
  const OW = tall ? 720 : 1280, OH = tall ? 1280 : 720, W = Math.round(OW * ss), H = Math.round(OH * ss);
  const tl = JSON.parse(fs.readFileSync(tlPath, "utf8"));
  const spec = resolve(cut, tl);
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
  for (const o of spec.overlays) if (o.kind === "title" || o.kind === "end") Object.assign(o, { name: info.name, hy: info.hy, sub: info.date });
  await page.evaluate(o => { FILM.setOverlays(o); }, spec.overlays);
  const n = Math.round(spec.dur * fps), from = Math.round(+arg("from", 0) * fps), to = Math.min(n, Math.round(+arg("to", 1e9) * fps));
  let ff = null;
  if (!stills) {
    ff = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
      "-vf", "scale=" + OW + ":" + OH + ":flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "10", "-pix_fmt", "yuv420p", out], { stdio: ["pipe", "inherit", "inherit"] });
  } else fs.mkdirSync(stills, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < to; i++) {
    const t = i / fps;
    // every frame is drawn, in order, even those before --from: the battle is a simulation and has no other way there
    await page.evaluate(t => FILM.frame(t), t);
    if (i < from) continue;
    if (stills) { if (i % (fps * 2) === 0) await page.screenshot({ path: path.join(stills, cut + "-" + String(Math.round(t)).padStart(3, "0") + ".jpg"), type: "jpeg", quality: 88, clip: { x: 0, y: 0, width: W, height: H } }); continue; }
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
