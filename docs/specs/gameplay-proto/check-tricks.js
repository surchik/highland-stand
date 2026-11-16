// with the prototype patch loaded: where each trick first comes, and whether an ambush opens or is first told on a commander wave
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("file://" + process.argv[2] + "?shot=battle&lv=0&wave=1");
  await p.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 180000 });
  await p.evaluate(js => (0, eval)(js), process.env.PATCH);
  const out = await p.evaluate(() => {
    const rows = [];
    for (let lv = 0; lv < LEVELS.length; lv++) for (let d = 0; d < 3; d++) {
      curLevel = lv; curDiff = d; resetGame();
      const N = TOTAL_WAVES, cmd = [];
      for (let w = 1; w <= N; w++) if (trickWave(w).some(g => g.type === "boss")) cmd.push(w);
      const A = trickCfg("ambush"), first = trickFirstWaves();
      let bad = "";
      if (A && !A.legacy) { const t = A.from - (byDiff(A.tell) || 0); if (cmd.includes(A.from) || cmd.includes(t)) bad = " AMBUSH ON COMMANDER WAVE (opens " + A.from + ", told " + t + ")"; }
      const fly = []; for (let w = 1; w <= N; w++) if (trickWave(w).some(g => g.type === "flyer")) fly.push(w);
      rows.push(LEVELS[lv].id.padEnd(14) + ["E", "N", "H"][d] + " N=" + N + " cmd " + cmd.join(",") + " first " + JSON.stringify(first) + " flyers " + fly.join(",") + bad);
    }
    return rows;
  });
  console.log(out.join("\n"));
  await b.close();
})();
