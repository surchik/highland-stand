// Draws a subtitle cue over a frame the way the page will (a preview for reviewers; the videos themselves carry
// no subtitles): node subs-preview.js <mp4> <vtt> <outdir> <how many>
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require(process.env.PW_PATH || "playwright");
const [mp4, vtt, out, n] = process.argv.slice(2);
const sec = s => { const p = s.split(":").map(Number); return p[0] * 3600 + p[1] * 60 + p[2]; };
const cues = fs.readFileSync(vtt, "utf8").split(/\n\n+/).map(b => b.trim().split("\n")).filter(l => l.length >= 3 && /-->/.test(l[1]))
  .map(l => ({ a: sec(l[1].split(" --> ")[0]), b: sec(l[1].split(" --> ")[1]), text: l.slice(2).join("\n") }));
(async () => {
  const browser = await chromium.launch();
  const pick = []; for (let i = 0; i < +n; i++) pick.push(cues[Math.round(i * (cues.length - 1) / (+n - 1))]);
  for (const [i, c] of pick.entries()) {
    const t = (c.a + c.b) / 2, png = path.join(out, "_f.png");
    execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", mp4, "-frames:v", "1", png]);
    const b64 = fs.readFileSync(png).toString("base64");
    const page = await browser.newPage();
    await page.setContent('<body style="margin:0;background:#000"><div id="b" style="position:relative;display:inline-block"><img id="i" src="data:image/png;base64,' + b64 + '" style="display:block">' +
      '<div style="position:absolute;left:0;right:0;bottom:5%;text-align:center"><span style="display:inline-block;max-width:88%;background:rgba(18,12,6,.78);color:#f6ecd2;border-radius:6px;padding:.3em .7em;' +
      'font:600 CUEpx/1.3 \'Palatino Linotype\',Palatino,Georgia,serif;white-space:pre-line">' + c.text.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span></div></div></body>");
    const box = await page.evaluate(() => { const i = document.getElementById("i"); const s = document.querySelector("span"); s.style.fontSize = Math.round(Math.min(i.naturalWidth, i.naturalHeight) * 0.044) + "px"; return [i.naturalWidth, i.naturalHeight]; });
    await page.setViewportSize({ width: box[0], height: box[1] });
    await page.screenshot({ path: path.join(out, "subs-" + (i + 1) + "-at-" + t.toFixed(1) + "s.jpg"), type: "jpeg", quality: 85 });
    await page.close(); fs.unlinkSync(png);
  }
  await browser.close();
})();
