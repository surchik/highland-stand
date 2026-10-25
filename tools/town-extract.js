// Loads the town's pure modules, TWT (its text) and TW (its simulation), out of index.html into Node, so the
// tools can run the town without a browser. Frozen after WP1-A (spec 13.11): the regions are sliced from the line
// after each BEGIN marker to the END marker, and evaluated in a fresh context after the prelude
//   "use strict"; let TWT = null, TW = null; const townRegion = (name, fn) => fn();
// so a region's own exception surfaces here instead of being swallowed by the page's guard. The context has no
// DOM, no page globals and no performance clock, and Math.random throws: the sim may not use them (13.2).
// Usage:  const { TW, TWT } = require("./town-extract.js")([path/to/index.html]);   (default: GAME or ../index.html)
//         node tools/town-extract.js [index.html]     prints what was loaded
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const MARKS = [
  ["// ---- TEXT BEGIN town ----", "// ---- TEXT END town ----"],
  ["// ==== TOWN SIM BEGIN ====", "// ==== TOWN SIM END ===="],
];
const PRELUDE = '"use strict"; let TWT = null, TW = null; const townRegion = (name, fn) => fn();\n';

// the region's text: from the line after the BEGIN marker (the rest of that line is its comment) to the END marker
function slice(html, begin, end, file) {
  const a = html.indexOf(begin);
  if (a < 0 || html.indexOf(begin, a + 1) >= 0) throw new Error(file + ": the marker \"" + begin + "\" must occur exactly once");
  const from = html.indexOf("\n", a) + 1, to = html.indexOf(end, from);
  if (to < 0) throw new Error(file + ": no \"" + end + "\" after \"" + begin + "\"");
  return { code: html.slice(from, to), line: html.slice(0, from).split("\n").length };
}

function townExtract(file) {
  file = path.resolve(file || process.env.GAME || path.join(__dirname, "..", "index.html"));
  const html = fs.readFileSync(file, "utf8");
  const parts = MARKS.map(([b, e]) => slice(html, b, e, file));
  // the regions are padded to their own lines in the page, so an error names the page's line numbers
  let code = PRELUDE, at = 2;
  for (const p of parts) { code += "\n".repeat(Math.max(0, p.line - at)) + p.code; at = p.line + p.code.split("\n").length - 1; }
  code += "\n;({ TW, TWT });";
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext("Math.random = () => { throw new Error('the town may not call Math.random'); };", sandbox);
  const out = vm.runInContext(code, sandbox, { filename: file });
  if (!out.TW || !out.TWT) throw new Error(file + ": the regions ran but left TW or TWT empty");
  return out;
}
module.exports = townExtract;

if (require.main === module) {
  const { TW, TWT } = townExtract(process.argv[2]);
  const keys = Object.keys(TW).filter(k => k !== "DATA");
  console.log("TW " + "v" + TW.VERSION + ": " + keys.join(", "));
  console.log("TW.DATA: " + Object.keys(TW.DATA).join(", "));
  console.log("TWT: " + Object.keys(TWT).join(", "));
  const G = TW.newGame({ seed: 20261025, diff: 1 });
  TW.run(G, 60);
  console.log("a minute of Normal on map 20261025: tick " + G.tick + ", hash " + TW.hash(G));
}
