// Checks a page before it is published: node deploy/check-page.js index.html
// Every inline <script> (no src) must parse: a classic script with the classic-script grammar, compiled here
// by vm.Script and never run, and a module through `node --check` as a .mjs file. (A classic script is not
// handed to `node --check`: Node 22 guesses a file's kind from its syntax and passes `export` or a top-level
// `await` as a module, which the browser refuses in a classic script.) JSON blocks must parse, and no
// merge-conflict marker may be left anywhere in the file. A script held inside a string (the AudioWorklet
// source, say) is only text here, as it is to the parser.
// Exit 0 when the page passes; 1 when it fails, printing where each script broke with the page's own line
// numbers; 2 when the check itself could not run (no file, no temporary folder, node killed), which says
// nothing about the page.
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

// where, the line with its caret, and the error; not node's own stack, and no line longer than a log can hold
function report(text) {
  return text.split("\n").filter(l => l.trim() && !/^\s+at |^Node\.js v/.test(l)).slice(0, 4)
    .map(l => (l.length > 240 ? l.slice(0, 240) + " ..." : l)).join("\n");
}

function check(file) {
  const html = fs.readFileSync(file, "utf8");
  const lineAt = i => html.slice(0, i).split("\n").length;
  const fail = [];

  // a merge left half done: the markers git writes at the start of a line
  const conflict = /^(<{7}|>{7}) /m.exec(html);
  if (conflict) fail.push(file + ":" + lineAt(conflict.index) + ": merge-conflict marker");

  const tagRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m, n = 0, tmp = null;
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
      if (!module) {
        // compiled, not run; lineOffset makes the error name the page's own line
        try { new vm.Script(body, { filename: file, lineOffset: first - 1 }); }
        catch (e) {
          if (!(e instanceof SyntaxError) && e.name !== "SyntaxError") throw e;
          fail.push(report(e.stack || String(e)));
        }
        continue;
      }
      // a module, padded with blank lines so node reports the page's own line numbers
      if (!tmp) tmp = fs.mkdtempSync(path.join(os.tmpdir(), "page-check-"));
      const src = path.join(tmp, "script" + n + ".mjs");
      fs.writeFileSync(src, "\n".repeat(first - 1) + body);
      const r = spawnSync(process.execPath, ["--check", src], { encoding: "utf8" });
      const out = (r.stderr || "") + (r.stdout || "");
      if (r.error || r.signal) throw new Error("node --check did not finish: " + (r.error ? r.error.message : r.signal));
      if (r.status !== 0) {
        if (!/SyntaxError/.test(out)) throw new Error("node --check failed without a syntax error: " + report(out));
        fail.push(report(out.split(src).join(file)));
      }
    }
  } finally {
    // file by file, which every Node.js a server is likely to carry can do
    if (tmp) {
      for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f));
      fs.rmdirSync(tmp);
    }
  }
  if (!n) fail.push(file + ": no inline script found");
  return { fail, n };
}

const file = process.argv[2] || "index.html";
let res;
try { res = check(file); }
catch (e) {
  console.log("the check could not run (" + process.version + "): " + (e && e.message ? e.message : e));
  process.exit(2);
}
if (res.fail.length) {
  console.log(res.fail.join("\n"));
  process.exit(1);
}
console.log(file + ": " + res.n + " inline script" + (res.n === 1 ? "" : "s") + " parse (" + process.version + ")");
