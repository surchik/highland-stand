// Under Ararat: shell probes outside the harness (the real History API, real storage, real page events), the cases
// the self-test cannot reach because the harness turns history off and gives the page an in-memory store. Written
// for the gray box fix from the code review's probes (graybox/review-code.md issues 2, 3, 5, 6).
// Usage:  NODE_PATH=$(npm root -g) node tools/town-shell-probes.js [scenario ...]   (GAME=path/index.html)
//   errback     an error card, then Safari's back swipe: the town closes to the map and the page stays
//   closethrow  TWA.free() and then TWS.close() throw while leaving: the map is given back, not left inert
//   pagehide    a pagehide, then the page shown again by visibilitychange alone: the clock runs after Resume
//   nostore     site storage blocked: the leave card does not promise a save, and says the town lasts the page
// Prints one line per scenario and "RESULT {...}"; exits 1 on any failure.
const { chromium } = require(process.env.PW_PATH || "playwright");
const path = require("path");
const FILE = path.resolve(process.env.GAME || path.join(__dirname, "..", "index.html"));
const ALL = ["errback", "closethrow", "pagehide", "nostore"];
const want = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
(async () => {
  const b = await chromium.launch();
  const result = {};
  for (const sc of want) {
    const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, deviceScaleFactor: 2, hasTouch: true });
    if (sc === "nostore") await ctx.addInitScript(() => {
      for (const k of ["localStorage", "sessionStorage"]) Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });
    });
    const page = await ctx.newPage(), errs = [];
    page.on("pageerror", e => errs.push(e.message));
    const ev = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
    const fails = [];
    const ok = (c, m) => { if (!c) fails.push(m); };
    try {
      await page.goto("about:blank");
      await page.goto("file://" + FILE);
      await wait(1500);
      await ev(() => { try { for (const k of ["hs_town", "hs_town_run", "hs_town_bless"]) localStorage.removeItem(k); } catch (e) {} if (menuMode === "chapter") $("startBtn").click(); });
      await wait(300);
      const click = async s => { await ev(s => { const e = s.startsWith("@") ? Town.test.button(s.slice(1)) : document.querySelector(s); if (!e) throw new Error("no " + s); e.click(); }, s); await wait(150); };
      const st = () => ev(() => ({ url: location.protocol, open: Town.isOpen(), card: Town.test.card(), inert: overlayEl.hasAttribute("inert"), hidden: $("town").classList.contains("twHidden"), over: Snd.sceneOverride }));
      await click("#townBtn"); await click("@card:begin"); await click("@card:cont"); await wait(400);
      if (sc === "errback") {
        await ev(() => { TWA.draw = () => { throw new Error("probe: a drawing bug"); }; });
        await wait(300);
        ok((await st()).card === "error", "no error card after a drawing error");
        await ev(() => history.back());
        await wait(600);
        const s = await st();
        ok(s.url === "file:" && !s.open && s.hidden && !s.inert, "the back swipe after an error did not close to the map: " + JSON.stringify(s));
      } else if (sc === "closethrow") {
        for (const [mod, fn] of [["TWA", "free"], ["TWS", "close"]]) {
          if (!(await ev(() => Town.isOpen()))) { await click("#townBtn"); await wait(200); const c = await ev(() => Town.test.card()); if (c) await click("@card:" + (c === "resume" ? "resume" : "begin")); if (await ev(() => Town.test.card())) await click("@card:resume").catch(() => {}); }
          await ev(([mod, fn]) => { const M = mod === "TWA" ? TWA : TWS; window["__" + fn] = M[fn]; M[fn] = () => { throw new Error("probe: " + fn + " threw"); }; }, [mod, fn]);
          await click("@leave"); await click("@card:leave"); await wait(300);
          const s = await st();
          await ev(([mod, fn]) => { (mod === "TWA" ? TWA : TWS)[fn] = window["__" + fn]; }, [mod, fn]);
          ok(!s.open && s.hidden && !s.inert && !s.over, "a throw in " + mod + "." + fn + "() left the map unusable: " + JSON.stringify(s));
        }
      } else if (sc === "pagehide") {
        await ev(() => { window.dispatchEvent(new Event("pagehide")); Town.test.hide(true); });
        await wait(200);
        await ev(() => Town.test.hide(false));
        await wait(200);
        ok((await ev(() => Town.test.card())) === "pause", "no pause card when the page came back");
        await click("@card:resume");
        const t0 = await ev(() => Town.test.G.tick);
        await wait(1500);
        const t1 = await ev(() => Town.test.G.tick), held = await ev(() => Array.from(Town.test.held()));
        ok(t1 > t0 && !held.length, "the clock stayed held after Resume: " + JSON.stringify(held));
      } else if (sc === "nostore") {
        await click("@leave");
        const [line, want] = await ev(() => [document.querySelector("#twCard p").textContent, TWT.ui.leaveMem]);
        ok(!!want && line === want, "the leave card promised a save the page cannot keep: " + line);
      }
    } catch (e) { fails.push(String(e).slice(0, 200)); }
    if (errs.length) fails.push("page errors: " + errs.join(" | ").slice(0, 300));
    result[sc] = fails.length ? fails : "ok";
    console.log(sc + ": " + (fails.length ? "FAIL " + fails.join("; ") : "ok"));
    await ctx.close();
  }
  await b.close();
  console.log("RESULT " + JSON.stringify(result));
  process.exit(Object.values(result).every(v => v === "ok") ? 0 : 1);
})();
