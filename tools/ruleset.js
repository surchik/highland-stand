// Prints the page's ruleset: rulesetData() as JSON, and the pins to write beside RULESET and LEVEL_REV in
// index.html (the self-test's second suite compares them).
// Usage: NODE_PATH=$(npm root -g) node tools/ruleset.js [--json] [--pins] [path/to/index.html]
//   no option  the pins as the page works them out now, beside the pins it carries, and what differs
//   --json     rulesetData() as JSON, indented (docs/specs/balance/ keeps a copy for each ruleset)
//   --pins     the two lines to paste into index.html
// When a pin differs, a rule has changed: raise RULESET, and LEVEL_REV for each battlefield named, then paste.
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
(async () => {
  const args = process.argv.slice(2);
  const file = path.resolve(args.find(a => !a.startsWith("--")) || path.join(__dirname, "..", "index.html"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("file://" + file + "?shot=menu");
  await page.waitForFunction(() => /^PHOTO_/.test(document.title), null, { timeout: 180000 });
  const R = await page.evaluate(() => ({ data: rulesetData(), pins: rulesetPins(), ruleset: RULESET, pin: RULESET_PIN, revs: LEVEL_REV, levelPins: LEVEL_PIN }));
  await browser.close();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  if (args.includes("--json")) { console.log(JSON.stringify(R.data, null, 1)); return; }
  const ids = Object.keys(R.pins.levels);
  const lines = 'const RULESET_PIN = "' + R.pins.all + '";\nconst LEVEL_PIN = {\n' +
    ids.reduce((rows, id, i) => { (rows[Math.floor(i / 6)] = rows[Math.floor(i / 6)] || []).push(id + ': "' + R.pins.levels[id] + '"'); return rows; }, [])
      .map(r => "  " + r.join(", ") + ",").join("\n") + "\n};";
  if (args.includes("--pins")) { console.log(lines); return; }
  console.log("RULESET " + R.ruleset + ": the page carries " + R.pin + ", its rules hash to " + R.pins.all + (R.pin === R.pins.all ? " (the same)" : " (CHANGED)"));
  const off = ids.filter(id => R.levelPins[id] !== R.pins.levels[id]);
  for (const id of ids) console.log("  " + id.padEnd(14) + " rev " + R.revs[id] + "  " + R.pins.levels[id] + (off.includes(id) ? "  CHANGED (the page carries " + R.levelPins[id] + ")" : ""));
  if (R.pin !== R.pins.all || off.length) {
    console.log("\nA rule has changed. Raise RULESET" + (off.length ? " and LEVEL_REV of " + off.join(", ") : "") + ", then write:\n" + lines);
    process.exit(1);
  }
})();
