// Runs every regression script of tools/regress against one page and prints one PASS/FAIL line per script, the
// failures under it, and a summary. Exits 1 when any script failed.
// Usage:  NODE_PATH=$(npm root -g) node tools/regress/run-all.js [index.html] [--quick] [--only=padplace,vic]
//         [--jobs=n] [--shots=dir] [--log=dir] [--strict]
//   --quick   each script's smaller sample (about 7 minutes in all, against about 25 for the full suite)
//   --only    some of the scripts, by name
//   --jobs    scripts run side by side (default 1: the timed scripts, dance10, nag and live, keep to real time best
//             on a quiet machine)
//   --shots   a folder per script with a screenshot of every failure
//   --log     each script's whole output in <dir>/<name>.txt
//   --strict  a known fault of the live game (a script's KNOWN line) fails its script too
"use strict";
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const SCRIPTS = ["padplace", "plots", "probe", "vic", "nag", "dance10", "live", "doors", "iphone", "waves"];
// a script that runs past this is stopped and fails
// (vic plays a victory on every battlefield at three sizes: 444 s on a quiet machine, over 900 s on a busy one;
// iphone walks over 700 states at ten sizes: about 500 s on a quiet machine since G3, past 600 s on a busy one;
// waves plays all 245 waves of the campaign at 4x, four battlefields at a time)
const LIMIT_S = { padplace: 1200, plots: 900, probe: 900, vic: 1800, nag: 400, dance10: 400, live: 1200, doors: 300, iphone: 1000, waves: 2400 };

const argv = process.argv.slice(2);
let file = null, quick = false, only = null, jobs = 1, shots = null, logDir = null, strict = false;
for (const a of argv) {
  if (a === "--quick") quick = true;
  else if (a === "--strict") strict = true;
  else if (a.startsWith("--only=")) only = a.slice(7).split(",").filter(Boolean);
  else if (a.startsWith("--jobs=")) jobs = Math.max(1, +a.slice(7) | 0);
  else if (a.startsWith("--shots=")) shots = path.resolve(a.slice(8));
  else if (a.startsWith("--log=")) logDir = path.resolve(a.slice(6));
  else if (!a.startsWith("--") && !file) file = a;
  else { console.error("unknown argument: " + a); process.exit(2); }
}
file = path.resolve(file || process.env.GAME || path.join(__dirname, "..", "..", "index.html"));
if (!fs.existsSync(file)) { console.error("no such page: " + file); process.exit(2); }
const names = only || SCRIPTS;
for (const n of names) if (!SCRIPTS.includes(n)) { console.error("no script " + n + " (" + SCRIPTS.join(", ") + ")"); process.exit(2); }
if (logDir) fs.mkdirSync(logDir, { recursive: true });

function run(name) {
  return new Promise((resolve) => {
    const args = [path.join(__dirname, name + ".js"), file];
    if (quick) args.push("--quick");
    if (strict) args.push("--strict");
    if (shots) args.push("--shots=" + path.join(shots, name));
    const t0 = Date.now();
    const ch = spawn(process.execPath, args, { env: process.env });
    let out = "";
    ch.stdout.on("data", d => { out += d; });
    ch.stderr.on("data", d => { out += d; });
    const timer = setTimeout(() => { out += "\nFAIL stopped after " + LIMIT_S[name] + " s"; ch.kill("SIGKILL"); }, LIMIT_S[name] * 1000 * (quick ? 0.6 : 1));
    ch.on("close", (code) => {
      clearTimeout(timer);
      const s = (Date.now() - t0) / 1000;
      if (logDir) fs.writeFileSync(path.join(logDir, name + ".txt"), out);
      resolve({ name, ok: code === 0, s, out });
    });
  });
}

(async () => {
  const t0 = Date.now();
  console.log("regress " + (quick ? "--quick " : "") + "on " + file);
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, names.length) }, async () => {
    while (next < names.length) {
      const r = await run(names[next++]);
      results.push(r);
      const lines = r.out.split("\n");
      const result = lines.find(l => l.startsWith("RESULT ")) || "";
      const info = result ? result.replace(/^RESULT \S+ (PASS|FAIL) /, "") : "";
      console.log((r.ok ? "PASS " : "FAIL ") + r.name.padEnd(9) + " " + r.s.toFixed(0).padStart(4) + " s  " + info.slice(0, 160));
      // a known fault of the live game, which a script reports without failing (see README.md)
      for (const l of [...new Set(lines.filter(l => l.startsWith("KNOWN ")))].slice(0, 4)) console.log("    " + l.slice(0, 300));
      if (!r.ok) {
        const bad = lines.filter(l => l.startsWith("FAIL ") || /Error|error/.test(l) && !l.startsWith("RESULT"));
        for (const l of bad.slice(0, 12)) console.log("    " + l.slice(0, 300));
        if (bad.length > 12) console.log("    ... " + (bad.length - 12) + " more");
        if (!bad.length) for (const l of lines.filter(Boolean).slice(-8)) console.log("    " + l.slice(0, 300));
      }
    }
  }));
  const passed = results.filter(r => r.ok).length;
  console.log("SUMMARY " + passed + "/" + results.length + " passed in " + ((Date.now() - t0) / 1000).toFixed(0) + " s" +
    (passed < results.length ? "; failed: " + results.filter(r => !r.ok).map(r => r.name).join(", ") : ""));
  process.exit(passed === results.length ? 0 : 1);
})();
