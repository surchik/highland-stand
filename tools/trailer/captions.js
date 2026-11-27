// The trailer's words, drawn once each as a transparent 1280x720 PNG in the game's own faces and colours (the gold
// title type of the chronicle's cards): node tools/trailer/captions.js <out dir>
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PW_PATH || "playwright");
const CAPS = {
  a: { lines: [["From Erebuni to Artsakh", 66, "gold"], ["782 BC to 2023", 50, "cream"]], y: 0.78 },
  b: { lines: [["17 battlefields. 5 eras.", 62, "gold"]], y: 0.8 },
  c: { lines: [["Raise your towers", 62, "gold"], ["on the mountain roads", 52, "cream"]], y: 0.76 },
  d: { lines: [["Lead your hero.", 62, "gold"]], y: 0.8 },
  e: { lines: [["Every wave counts.", 64, "gold"], ["Hold the line.", 52, "cream"]], y: 0.76 },
  g: { lines: [["Hold the highlands.", 64, "gold"]], y: 0.8 },
  t_erebuni: { tag: ["Erebuni", "782 BC"] },
  t_sardarapat: { tag: ["Sardarapat", "1918"] },
  t_avarayr: { tag: ["Avarayr", "451"] },
  t_ani: { tag: ["Ani", "1041"] },
  t_musadagh: { tag: ["Musa Dagh", "1915"] },
  t_stepanakert: { tag: ["Stepanakert", "2023"] },
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
      if (cap.tag) {
        // a place and its year, on a dark plate in the top left corner, as the films' plaques
        const [name, year] = cap.tag, x = 80, y = 72, p1 = 86, p2 = 64;
        g.font = "700 " + p1 + "px " + FACE; let w = g.measureText(name).width;
        g.font = "700 " + p2 + "px " + FACE; w += g.measureText(year).width + 150;
        const h = 150;
        g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 20; g.shadowOffsetY = 6;
        const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "rgba(58,40,22,.94)"); gr.addColorStop(1, "rgba(34,23,12,.94)");
        g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill(); g.shadowColor = "transparent";
        g.strokeStyle = "#c9972f"; g.lineWidth = 3.2; g.stroke();
        g.fillStyle = "#a8231c"; g.fillRect(x, y + 16, 14, h - 32);
        g.textAlign = "left"; g.textBaseline = "middle";
        g.font = "700 " + p1 + "px " + FACE; g.fillStyle = "#f3dfa2"; g.fillText(name, x + 54, y + h / 2 + 3);
        const nw = g.measureText(name).width;
        g.font = "700 " + p2 + "px " + FACE; g.fillStyle = "#ffb199"; g.fillText(year, x + 54 + nw + 44, y + h / 2 + 3);
        return c.toDataURL("image/png");
      }
      if (cap.title) {
        // a soft dark band behind the title, so it reads over any frame of the map
        const band = g.createLinearGradient(0, H * 0.16, 0, H * 0.8);
        band.addColorStop(0, "rgba(14,9,4,0)"); band.addColorStop(0.5, "rgba(14,9,4,.72)"); band.addColorStop(1, "rgba(14,9,4,0)");
        g.fillStyle = band; g.fillRect(0, H * 0.16, W, H * 0.64);
        cream("A tower defense of Armenian history", W / 2, H * 0.3, 40 * U, "700 ");
        rule(W / 2, H * 0.355, 620);
        gold("HIGHLAND STAND", W / 2, H * 0.45, 104 * U);
        cream("Free in your browser  \u00b7  Desktop, iPad, iPhone", W / 2, H * 0.565, 40 * U);
        gold("highland.avunjian.com", W / 2, H * 0.665, 50 * U);
      } else {
        // a soft dark ground under the words, so they read over a bright field
        const h0 = H * cap.y - cap.lines.length * 75 * U, h1 = H * cap.y + 95 * U;
        const band = g.createLinearGradient(0, h0, 0, h1);
        band.addColorStop(0, "rgba(14,9,4,0)"); band.addColorStop(0.5, "rgba(14,9,4,.66)"); band.addColorStop(1, "rgba(14,9,4,0)");
        g.fillStyle = band; g.fillRect(0, h0, W, h1 - h0);
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
