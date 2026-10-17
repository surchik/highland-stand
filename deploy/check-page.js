// Checks a page before it is published: node deploy/check-page.js index.html
// Every inline <script> (no src) is run through `node --check`: a classic script as a script, a module as a
// module. JSON blocks must parse, and no merge-conflict marker may be left anywhere in the file. A script
// held inside a string (the AudioWorklet source, say) is only text here, as it is to the parser.
// Exit 0 when the page passes; otherwise exit 1 and print where each script broke, with the page's own
// line numbers.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const file = process.argv[2] || "index.html";
const html = fs.readFileSync(file, "utf8");
const lineAt = i => html.slice(0, i).split("\n").length;
const fail = [];

// a merge left half done: the markers git writes at the start of a line
const conflict = /^(<{7}|>{7}) /m.exec(html);
if (conflict) fail.push(file + ":" + lineAt(conflict.index) + ": merge-conflict marker");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "page-check-"));
const tagRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
let m, n = 0;
try {
  while ((m = tagRe.exec(html))) {
    const attrs = m[1], body = m[2];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const typeM = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
    const type = typeM ? typeM[1].toLowerCase() : "";
    const first = lineAt(m.index + m[0].indexOf(">") + 1);
    if (/json$/.test(type)) {
      try { JSON.parse(body); } catch (e) { fail.push(file + ":" + first + ": " + e.message); }
      continue;
    }
    const module = type === "module";
    if (type && !module && !/^(text|application)\/(x-)?(java|ecma)script$/.test(type)) continue;   // data, not code
    n++;
    // padded with blank lines, so node reports the page's own line numbers
    const src = path.join(tmp, "script" + n + (module ? ".mjs" : ".js"));
    fs.writeFileSync(src, "\n".repeat(first - 1) + body);
    const r = spawnSync(process.execPath, ["--check", src], { encoding: "utf8" });
    if (r.status !== 0) {
      // where, the line with its caret, and the error; not node's own stack
      const out = (r.stderr || r.stdout || "node --check failed").split(src).join(file).split("\n");
      fail.push(out.filter(l => l.trim() && !/^\s+at |^Node\.js v/.test(l)).slice(0, 4).join("\n"));
    }
  }
} finally {
  // file by file, which every Node.js a server is likely to carry can do
  for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f));
  fs.rmdirSync(tmp);
}
if (!n) fail.push(file + ": no inline script found");

if (fail.length) {
  console.log(fail.join("\n"));
  process.exit(1);
}
console.log(file + ": " + n + " inline script" + (n === 1 ? "" : "s") + " pass node --check");
