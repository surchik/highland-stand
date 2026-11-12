// Saved runs of an older page, resumed in this one: a run finishes under the rules it began with.
// Usage: NODE_PATH=$(npm root -g) node tools/run-fixtures.js check [path/to/index.html]
//        NODE_PATH=$(npm root -g) node tools/run-fixtures.js make <older index.html> <name>
//
//   make   plays Erebuni on Normal in the older page (the page's own loop at 4x, three towers) and writes two of its
//          hs_run values to tools/fixtures/: run-<name>-between.json, saved by the clear of wave 3, and
//          run-<name>-midwave.json, saved by a rank bought while wave 4 was on the field with a defender lost.
//          The fixtures in the repo were made this way from the page before the battle's numbers were kept
//          (branch next at 3714b0d: `make /home/user/hs-wt/next/index.html base`).
//   check  for every fixture: the page is opened with the run on the device, the map offers it ("Resume: ..."), the
//          button resumes it with the board, the purse, the defenders and the wave it saved, the wave is then sent
//          and held through the page's own loop, the run is saved again, and the battle is won (its last wave
//          staged: the foes of its last wave fall as they come on) with its record written. A run finishes under the
//          rules it began with: one saved before the lengths (no `script`) is the 20-wave battle it was, with its
//          old economy, and its victory page and numbers say 20 waves. A run from before the numbers were kept, or
//          under an older RULESET, is fought on as it was but is never ranked (legacy). Prints one RESULT line;
//          exit 1 when anything failed.
const path = require("path");
const fs = require("fs");
const { chromium } = require(process.env.PW_PATH || "playwright");
const DIR = path.join(__dirname, "fixtures");

async function openPage(browser, file, storage) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(st => { try { for (const k in st) localStorage.setItem(k, st[k]); } catch (e) {} }, storage);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  await page.goto("file://" + file, { timeout: 120000 });
  await page.waitForFunction(() => typeof menuMode !== "undefined" && document.readyState === "complete", null, { timeout: 120000 });
  return { ctx, page, errs };
}
// the story page of a first visit is turned to the map
async function toMap(page) {
  for (let k = 0; k < 4 && await page.evaluate(() => menuMode) === "chapter"; k++) { await page.click("#startBtn"); await page.waitForTimeout(150); }
}
// a returning player's device: the tutorial done and the old one-time migrations long run (the first of them
// drops a saved run, as it must on a save from the four-battlefield game)
// (and every trick's first-time card read: one would hold the staged last wave)
const SEEN = { hs_tutorial_done: "1", hs_mig_7lv: "1", hs_mig_ids: "1", hs_mig_rec: "1",
  hs_tricks_seen: JSON.stringify(["ambush", "hunters", "hidden", "guards", "adapt"]) };

async function make(file, name) {
  const browser = await chromium.launch();
  const { ctx, page, errs } = await openPage(browser, file, SEEN);
  await toMap(page);
  await page.click("#startBtn");                      // March on Erebuni: its chronicle
  await page.waitForFunction(() => menuMode === "brief");
  await page.click("#startBtn");                      // Begin the Stand
  await page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver);
  await page.evaluate(() => {
    // the three pads that watch the most road
    const pts = [];
    for (let ri = 0; ri < ROUTES.length; ri++) for (let k = 0; k <= 80; k++) pts.push(routeAt(ri, ROUTES[ri].len * k / 80));
    const pads = PADS.map((p, i) => ({ i, n: pts.filter(q => inGroundRange(p[0], p[1], q.x, q.y, 150)).length })).sort((a, b) => b.n - a.n);
    placeTower("archer", pads[0].i); placeTower("archer", pads[1].i); placeTower("archer", pads[2].i);
    setSpeed(4);
  });
  for (let w = 1; w <= 3; w++) {
    await page.click("#waveBtn");
    await page.waitForFunction(w => gameOver || (waveIdx === w && phase === "idle"), w, { timeout: 120000, polling: 100 });
  }
  if (await page.evaluate(() => gameOver)) throw new Error("the older page lost the staged battle");
  const between = await page.evaluate(() => localStorage.getItem("hs_run"));
  await page.click("#waveBtn");
  await page.waitForFunction(() => enemies.length >= 3, null, { timeout: 60000, polling: 50 });
  await page.evaluate(() => {
    // one foot soldier reaches the walls, then a rank is bought: the purchase saves the run in the middle of the wave
    const e = enemies.find(x => !x.fly && x.dmg === 1);
    e.dist = ROUTES[e.route || 0].len;
  });
  await page.waitForFunction(() => lives < DIFFS[curDiff].lives, null, { timeout: 20000, polling: 50 });
  const info = await page.evaluate(() => {
    const t = towers.find(x => x.level === 0 && gold >= TOWER_DEFS[x.type].levels[1].cost);
    if (t) upgradeTower(t);
    return { ranked: !!t, phase, lives, waveIdx, build: typeof BUILD_ID === "undefined" ? "" : BUILD_ID };
  });
  if (info.phase !== "wave" || !info.ranked) throw new Error("the older page's wave ended before the save: " + JSON.stringify(info));
  const midwave = await page.evaluate(() => localStorage.getItem("hs_run"));
  await ctx.close();
  await browser.close();
  if (errs.length) throw new Error(errs.join(" | "));
  fs.mkdirSync(DIR, { recursive: true });
  for (const [kind, raw] of [["between", between], ["midwave", midwave]]) {
    const run = JSON.parse(raw);
    fs.writeFileSync(path.join(DIR, "run-" + name + "-" + kind + ".json"), JSON.stringify(run, null, 1) + "\n");
    console.log("run-" + name + "-" + kind + ".json: " + run.lvl + ", wave " + (run.cleared + 1) + " next, " + run.lives + " defenders, " + run.gold + " gold, " +
      run.towers.length + " towers, build " + run.build + (run.rules === undefined ? ", no ruleset" : ", ruleset " + run.rules));
  }
}

async function check(file) {
  const names = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^run-.*\.json$/.test(f)).sort() : [];
  const fails = [], done = [];
  const browser = await chromium.launch();
  for (const name of names) {
    const run = JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
    const fail = m => fails.push(name + ": " + m);
    const { ctx, page, errs } = await openPage(browser, file, Object.assign({ hs_run: JSON.stringify(run) }, SEEN));
    try {
      await toMap(page);
      const label = await page.evaluate(() => { const b = $("resumeBtn"); return b.style.display === "none" ? "" : b.textContent; });
      if (!label.includes("Resume") || !label.includes("Wave " + (run.cleared + 1))) fail("the map does not offer the run: \"" + label + "\"");
      await page.click("#resumeBtn");
      await page.waitForFunction(() => overlayEl.classList.contains("hidden") && !gameOver, null, { timeout: 10000 });
      const st = await page.evaluate(() => ({ lv: levelId(curLevel), diff: curDiff, waveIdx, phase, gold, lives, towers: towers.map(t => t.type + t.level + (t.spec || "") + "@" + t.pad).join(),
        total: typeof totalWaves === "function" ? totalWaves() : TOTAL_WAVES, ruleset: typeof RULESET === "number" ? RULESET : 0,
        step: typeof payStep === "function" ? [1, 2, 3, 4, 5, 10, 19, 20].map(w => payStep(w)).join() : "1,1,1,1,1,1,1,1",
        facts: battleFacts(), start: (window.__hsEv || []).filter(e => e[0] === "battle_start").map(e => e[1]), spells: Object.values(spellCd).join(), hero: hero.alive }));
      const want = run.towers.map(t => t.type + t.level + (t.spec || "") + "@" + t.pad).join();
      if (st.lv !== run.lvl || st.diff !== run.diff || st.waveIdx !== run.cleared || st.phase !== "idle" || st.gold !== run.gold || st.lives !== run.lives || st.towers !== want) {
        fail("resumed as " + JSON.stringify({ lv: st.lv, wave: st.waveIdx, gold: st.gold, lives: st.lives, towers: st.towers }) + ", saved as " + JSON.stringify({ lv: run.lvl, wave: run.cleared, gold: run.gold, lives: run.lives, towers: want }));
      }
      // the run's own length: a run saved before the lengths is 20 waves, each paying for itself alone
      const len = Array.isArray(run.script) ? run.script.length : 20;
      if (st.total !== len || (!Array.isArray(run.script) && st.step !== "1,1,1,1,1,1,1,1")) fail("the run resumed as " + st.total + " waves (pay steps " + st.step + "), saved as " + len);
      const legacy = run.rules !== st.ruleset;
      const b = st.start[0];
      if (st.start.length !== 1 || b.resumed !== true || b.legacy !== legacy || b.ranked !== !legacy) fail("battle_start of the resumed run: " + JSON.stringify(st.start));
      if (st.facts.legacy !== legacy || st.facts.left !== st.facts.earned - st.facts.spent + st.facts.refunds || st.facts.resumed !== 1) fail("the resumed run's numbers: " + JSON.stringify(st.facts).slice(0, 400));
      if (legacy && (st.spells !== "0,0,0" || !st.hero)) fail("a run without saved clocks did not resume ready: spells " + st.spells);
      // the wave it saved is sent and held through the page's own loop
      await page.evaluate(() => setSpeed(4));
      await page.click("#waveBtn");
      await page.waitForFunction(w => gameOver || (waveIdx === w && phase === "idle"), run.cleared + 1, { timeout: 180000, polling: 100 });
      const after = await page.evaluate(() => ({ gameOver, waveIdx, lives, saved: JSON.parse(localStorage.getItem("hs_run") || "null"), debt: battle.debt }));
      if (after.gameOver) fail("the resumed battle fell on wave " + after.waveIdx);
      else {
        if (!after.saved || after.saved.cleared !== run.cleared + 1 || !after.saved.facts || !after.saved.cd) fail("the run was not saved again with its numbers: " + JSON.stringify(after.saved).slice(0, 200));
        else if (after.saved.rules !== (run.rules === undefined ? 0 : run.rules)) fail("the run was saved again under ruleset " + after.saved.rules);
        else if (JSON.stringify(after.saved.script || null) !== JSON.stringify(Array.isArray(run.script) ? run.script : Array.from({ length: 20 }, (_, k) => k + 1))) fail("the run was saved again with the table " + JSON.stringify(after.saved.script));
        if (legacy && after.debt !== 0) fail("a run that saved no attempt owes " + after.debt);
        // the last wave, staged: its foes fall as they come on; the victory is the campaign's in full
        await page.evaluate(() => { waveIdx = lastCleared = (typeof totalWaves === "function" ? totalWaves() : TOTAL_WAVES) - 1; });
        await page.click("#waveBtn");
        const t0 = Date.now();
        while (!(await page.evaluate(() => { for (const e of enemies) e.hp = 0; return gameOver; }))) {
          if (Date.now() - t0 > 120000) { fail("the staged last wave did not end"); break; }
          await page.waitForTimeout(50);
        }
        const won = await page.evaluate(() => { endCelebration(); const v = (window.__hsEv || []).filter(e => e[0] === "victory").pop();
          return { v: v && v[1], won: levelConquered(curLevel), best: localStorage.getItem(bestKey(curLevel, curEra)), stars: levelRecord(curLevel).stars[curDiff], page: menuMode, run: localStorage.getItem("hs_run"), sub: $("ovSub").textContent }; });
        if (!won.v || !won.won || won.best !== "21" || won.stars < 1 || won.page !== "victory" || won.run !== null) fail("the victory of the resumed run: " + JSON.stringify(won).slice(0, 300));
        else if (won.v.waves !== len || won.v.wave !== len) fail("the victory counts " + won.v.wave + " of " + won.v.waves + " waves, the run had " + len);
        else if (won.v.legacy !== legacy || /worse attempt/.test(won.sub) !== (!legacy && won.v.debt > 0)) fail("the victory's numbers or its page: legacy " + won.v.legacy + ", \"" + won.sub.slice(-80) + "\"");
        done.push(name + " " + won.v.lives + " kept, " + won.stars + " stars, " + len + " waves" + (legacy ? ", legacy" : ""));
      }
    } catch (e) { fail(e.message.split("\n")[0]); }
    if (errs.length) fail(errs.join(" | "));
    await ctx.close();
  }
  await browser.close();
  if (!names.length) fails.push("no fixture in " + DIR);
  for (const f of fails) console.log("FAIL " + f);
  console.log("RESULT run-fixtures " + (fails.length ? "FAIL" : "PASS") + " " + JSON.stringify({ fixtures: names.length, fails: fails.length, done }));
  process.exit(fails.length ? 1 : 0);
}

(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "make" && a && b) await make(path.resolve(a), b);
  else if (cmd === "check" || !cmd) await check(path.resolve(a || path.join(__dirname, "..", "index.html")));
  else { console.error("usage: node tools/run-fixtures.js check [index.html] | make <older index.html> <name>"); process.exit(2); }
})().catch(e => { console.error(e); process.exit(1); });
