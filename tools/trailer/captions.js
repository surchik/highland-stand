// The trailer's words, drawn once each as a transparent 1280x720 PNG in the game's own faces and colours (the gold
// title type of the chronicle's cards): node tools/trailer/captions.js <out dir>
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PW_PATH || "playwright");
const CAPS = {
  a: { lines: [["782 BC to 2023", 64, "gold"]], y: 0.5 },
  b: { lines: [["17 battlefields. 5 eras.", 58, "gold"]], y: 0.8 },
  c: { lines: [["Raise your towers.", 58, "gold"], ["Hold the road.", 40, "cream"]], y: 0.76 },
  d: { lines: [["Lead the hero into the line.", 50, "gold"]], y: 0.8 },
  e: { lines: [["Every wave counts.", 62, "gold"]], y: 0.8 },
  f: { lines: [["Free in your browser", 56, "gold"], ["Desktop  ·  iPad  ·  iPhone", 36, "cream"]], y: 0.76 },
  title: { title: true },
};
(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 2560, height: 1440 } });
  await p.setContent("<canvas id=c width=2560 height=1440></canvas>");
  for (const [id, cap] of Object.entries(CAPS)) {
    const data = await p.evaluate(cap => {
      const FACE = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
      const c = document.getElementById("c"), g = c.getContext("2d"), W = 2560, H = 1440, U = 2;
      g.clearRect(0, 0, W, H); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      const gold = (t, x, y, px) => {
        g.font = "700 " + px + "px " + FACE;
        const gr = g.createLinearGradient(0, y - px * 0.5, 0, y + px * 0.5);
        gr.addColorStop(0, "#f7e3a0"); gr.addColorStop(0.5, "#e2b85a"); gr.addColorStop(1, "#a9772a");
        g.shadowColor = "rgba(0,0,0,.85)"; g.shadowBlur = px * 0.35; g.shadowOffsetY = px * 0.06;
        g.strokeStyle = "rgba(20,12,4,.92)"; g.lineWidth = px * 0.15; g.strokeText(t, x, y);
        g.shadowColor = "transparent"; g.fillStyle = gr; g.fillText(t, x, y);
      };
      const cream = (t, x, y, px, face) => {
        g.font = (face || "italic 600 ") + px + "px " + FACE;
        g.shadowColor = "rgba(0,0,0,.9)"; g.shadowBlur = px * 0.4;
        g.strokeStyle = "rgba(20,12,4,.9)"; g.lineWidth = px * 0.14; g.strokeText(t, x, y);
        g.shadowColor = "transparent"; g.fillStyle = "#f3e6c0"; g.fillText(t, x, y);
      };
      const rule = (x, y, w) => {
        const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        gr.addColorStop(0, "rgba(201,151,47,0)"); gr.addColorStop(0.5, "rgba(232,190,96,.95)"); gr.addColorStop(1, "rgba(201,151,47,0)");
        g.fillStyle = gr; g.fillRect(x - w / 2, y - 1.6, w, 3.2);
        g.fillStyle = "#e8be60"; g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.closePath(); g.fill();
      };
      if (cap.title) {
        // a soft dark band behind the title, so it reads over any frame of the map
        const band = g.createLinearGradient(0, H * 0.2, 0, H * 0.82);
        band.addColorStop(0, "rgba(14,9,4,0)"); band.addColorStop(0.5, "rgba(14,9,4,.62)"); band.addColorStop(1, "rgba(14,9,4,0)");
        g.fillStyle = band; g.fillRect(0, H * 0.2, W, H * 0.62);
        g.font = "700 " + 30 * U + "px " + FACE; g.fillStyle = "#e9d9aa"; g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 12;
        g.fillText("A  TOWER  DEFENSE  OF  ARMENIAN  HISTORY".split("").join(""), W / 2, H * 0.33); g.shadowColor = "transparent";
        rule(W / 2, H * 0.375, 560);
        gold("HIGHLAND STAND", W / 2, H * 0.47, 128 * U);
        cream("Hold the highlands across 2,800 years", W / 2, H * 0.585, 38 * U);
        g.font = "700 " + 34 * U + "px " + FACE;
        cream("highland.avunjian.com", W / 2, H * 0.68, 36 * U, "700 ");
      } else {
        let y = H * cap.y - (cap.lines.length - 1) * 38 * U;
        for (const [t, px, kind] of cap.lines) { (kind === "gold" ? gold : cream)(t, W / 2, y, px * U); y += px * U * 1.25; }
      }
      return c.toDataURL("image/png");
    }, cap);
    fs.writeFileSync(path.join(out, id + ".png"), Buffer.from(data.split(",")[1], "base64"));
  }
  await b.close();
  console.log("captions:", Object.keys(CAPS).join(" "));
})();
