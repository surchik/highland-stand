// Renders the trailer's game shots: node tools/trailer/shots.js <shots.json> <out dir> [--only id,id] [--stills]
// Each shot is one scene of tools/explainer/film-page.js (the game's own painters, interface off) on its own page,
// so every battlefield of the campaign can be filmed: { id, level, dur, scene: { kind, stage, a, b, markers } }.
// Frames are drawn at 1.5x and scaled to 1280x720 (or the shot's own size).
const path = require("path"), fs = require("fs"), { spawn } = require("child_process");
const { chromium } = require(process.env.PW_PATH || "playwright");
const ROOT = path.resolve(__dirname, "..", "..");
function arg(n, d) { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; }
(async () => {
  const [spec, out] = process.argv.slice(2);
  const shots = JSON.parse(fs.readFileSync(spec, "utf8")).shots;
  const only = arg("only", null), stills = process.argv.includes("--stills");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const s of shots) {
    if (only && !only.split(",").includes(s.id)) continue;
    const fps = s.fps || 30, OW = s.w || 1280, OH = s.h || 720, ss = s.ss || 1.5, W = Math.round(OW * ss), H = Math.round(OH * ss);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const errs = []; page.on("pageerror", e => errs.push(e.message));
    await page.goto("file://" + path.join(ROOT, "index.html") + "?shot=battle&lv=" + s.level + "&wave=1&nohud");
    await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 120000 });
    await page.addScriptTag({ path: path.join(ROOT, "tools/explainer/film-page.js") });
    const pre = s.pre || 0, dur = s.dur + pre;
    const sc = Object.assign({ t0: 0, t1: dur, at: 0 }, s.scene);
    await page.evaluate(o => FILM.init(o), { W, H, fps, level: s.level, scenes: [sc], overlays: [], dur, plain: true });
    const n = Math.round(dur * fps), from = Math.round(pre * fps);
    let ff = null;
    const file = path.join(out, s.id + ".mkv");
    if (!stills) ff = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
      "-vf", "scale=" + OW + ":" + OH + ":flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "8", "-pix_fmt", "yuv420p", file], { stdio: ["pipe", "inherit", "inherit"] });
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => FILM.frame(t), i / fps);
      if (i < from) continue;
      if (stills) { if ((i - from) % Math.round(fps * (s.dur / 3)) === 0) await page.screenshot({ path: path.join(out, s.id + "-" + (i - from) + ".jpg"), type: "jpeg", quality: 85 }); continue; }
      const buf = await page.screenshot({ type: "jpeg", quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    }
    if (ff) { ff.stdin.end(); await new Promise(r => ff.on("close", r)); }
    await page.close();
    console.log(s.id, errs.length ? "PAGE ERRORS " + [...new Set(errs)].join(" | ") : "ok");
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
