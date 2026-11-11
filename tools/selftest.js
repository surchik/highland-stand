// Runs the game's built-in self-test in headless Chromium and prints each suite's result.
// Usage: node tools/selftest.js [--suite=1|2|all] [--serial] [path/to/index.html]
//   --suite=1    the first suite (?selftest=1): the game as it was, 151 checks. It gains no check, so it keeps its time
//   --suite=2    the second suite (?selftest=2): the battle's numbers, the hooks, the rules. It grows package by package
//   --suite=all  both (the default): side by side, or one after the other with --serial or on fewer than four cores
// A suite fails when a check fails, when the page threw, or when its own clock passes its budget of 125 s. The
// clock is res.ms: the time the suite's checks took inside the page, not the browser's start. A budget passed on a
// busy machine is run again alone (--suite=N) before it is believed.
const path = require("path");
const os = require("os");
const { chromium } = require(process.env.PW_PATH || "playwright");
const BUDGET_MS = 125000;

const args = process.argv.slice(2);
const opt = name => (args.find(a => a.startsWith("--" + name + "=")) || "").split("=")[1];
const which = opt("suite") || "all";
if (!["1", "2", "all"].includes(which)) { console.error("unknown suite " + which + ": --suite=1, --suite=2 or --suite=all"); process.exit(2); }
const serial = args.includes("--serial") || os.cpus().length < 4;
const file = path.resolve(args.find(a => !a.startsWith("--")) || path.join(__dirname, "..", "index.html"));

async function runSuite(browser, n) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on("pageerror", e => logs.push("pageerror: " + e.message));
  // the checks run synchronously while the page loads, so its load can take the whole run
  await page.goto("file://" + file + "?selftest=" + n, { timeout: 300000 });
  await page.waitForSelector("#selftest-result", { timeout: 300000 });
  const txt = await page.textContent("#selftest-result");
  await page.close();
  let res = null;
  try { res = JSON.parse(txt.replace(/^SELFTEST_RESULT /, "")); } catch (e) {}
  const ms = res && typeof res.ms === "number" ? res.ms : null;
  const over = ms === null || ms > BUDGET_MS;
  const ok = !!res && res.pass === true && !logs.length && !over;
  return { n, txt, logs, res, ms, over, ok };
}

(async () => {
  const suites = which === "all" ? [1, 2] : [Number(which)];
  const browser = await chromium.launch();
  let results;
  if (serial || suites.length === 1) {
    results = [];
    for (const n of suites) results.push(await runSuite(browser, n));
  } else results = await Promise.all(suites.map(n => runSuite(browser, n)));
  await browser.close();
  for (const r of results) {
    console.log("suite " + r.n + ": " + r.txt.slice(0, 4000));
    if (r.logs.length) console.log(r.logs.join("\n"));
    const secs = r.ms === null ? "no clock" : (r.ms / 1000).toFixed(1) + " s of " + BUDGET_MS / 1000;
    console.log("suite " + r.n + ": " + (r.ok ? "PASS" : "FAIL") + ", " + (r.res ? r.res.checks : "?") + " checks, " + secs +
      (r.over ? (r.ms === null ? " (the result carries no res.ms)" : " (over its budget: run it again alone, --suite=" + r.n + ")") : ""));
  }
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
