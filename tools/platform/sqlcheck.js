// Static checks of the game's SQL files (deploy/supabase/migrations, deploy/supabase/optional), for the shared
// server's rules, read from the text itself:
// - every UPDATE and DELETE has a WHERE (the server runs pg-safeupdate for the API's sessions, which refuses an
//   UPDATE or DELETE without one, inside a function too);
// - nothing is created, altered, dropped or granted outside the schema highland (no public., auth. is only read and
//   referenced, the neighbours' schemas never named);
// - every function pins search_path to '';
// - a down file drops only what lives in highland, and never with cascade.
// problems(file) -> [ "file:line: what" ]
"use strict";
const fs = require("fs");
const path = require("path");

// the text with comments and string literals blanked out (kept the same length, so line numbers hold). Dollar
// quoted bodies ($$ ... $$, $name$ ... $name$) are code and stay; single-quoted strings are blanked.
function strip(sql) {
  let out = "", i = 0;
  while (i < sql.length) {
    const c = sql[i], d = sql[i + 1];
    if (c === "-" && d === "-") { while (i < sql.length && sql[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && d === "*") { const j = sql.indexOf("*/", i + 2); const e = j < 0 ? sql.length : j + 2; out += sql.slice(i, e).replace(/[^\n]/g, " "); i = e; continue; }
    if (c === "'") {
      let j = i + 1;
      while (j < sql.length) { if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; } if (sql[j] === "'") break; j++; }
      out += "'" + sql.slice(i + 1, j).replace(/[^\n]/g, " ") + "'"; i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

// the statements of a text: split on ; (bodies of functions included: their own statements end with ; too)
function statements(text) {
  const out = []; let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === ";") { out.push({ text: text.slice(start, i), at: start }); start = i + 1; }
  }
  return out;
}

function problems(file) {
  const raw = fs.readFileSync(file, "utf8");
  const t = strip(raw).toLowerCase();
  const name = path.relative(path.resolve(__dirname, "..", ".."), file);
  const bad = [];
  const say = (idx, what) => bad.push(name + ":" + lineOf(t, idx) + ": " + what);
  for (const st of statements(t)) {
    const s = st.text;
    // UPDATE ... SET (not "on conflict ... do update", not "for update", not a privilege's name) and DELETE FROM
    const re = /\b(update)\s+(only\s+)?[a-z_."]+(\s+(as\s+)?[a-z_]+)?\s+set\b|\bdelete\s+from\b/g;
    let m;
    while ((m = re.exec(s))) {
      const before = s.slice(Math.max(0, m.index - 12), m.index);
      if (/\bdo\s+$/.test(before)) continue;
      if (!/\bwhere\b/.test(s.slice(m.index))) say(st.at + m.index, m[0].split(/\s+/)[0].toUpperCase() + " without a WHERE (pg-safeupdate refuses it)");
    }
    // a truncate passes safeupdate but empties a table: none in the migrations
    if (/\btruncate\b/.test(s)) say(st.at + s.search(/\btruncate\b/), "TRUNCATE");
  }
  // nothing outside highland: create/alter/drop/comment on/grant on an object named in another schema
  const objRe = /\b(create|alter|drop|comment\s+on)\s+(or\s+replace\s+)?(unique\s+)?(table|view|materialized\s+view|function|procedure|index|sequence|type|trigger|policy|schema|extension|role|event\s+trigger|publication)\s+(if\s+(not\s+)?exists\s+)?("?[a-z_][a-z0-9_]*"?)(\.("?[a-z_][a-z0-9_]*"?))?/g;
  let m;
  while ((m = objRe.exec(t))) {
    const kind = m[4], first = m[7].replace(/"/g, ""), qualified = !!m[8];
    if (kind === "extension" || kind === "role" || kind === "event trigger" || kind === "publication") { say(m.index, kind + " made or changed: the game needs none"); continue; }
    if (kind === "schema") { if (first !== "highland") say(m.index, "a schema other than highland: " + first); continue; }
    if (kind === "index" || kind === "trigger" || kind === "policy") {   // named bare; the table follows "on"
      const on = /\bon\s+("?[a-z_][a-z0-9_]*"?)\.(\S+)/.exec(t.slice(m.index, m.index + 300));
      if (m[1] !== "drop" || kind === "policy") { if (!on || on[1].replace(/"/g, "") !== "highland") say(m.index, kind + " on a table outside highland"); }
      continue;
    }
    if (!qualified || first !== "highland") say(m.index, m[1] + " " + kind + " " + first + (qualified ? "." + m[9] : "") + ": not in highland");
  }
  if (/\bcascade\b/.test(t.replace(/on\s+delete\s+cascade/g, ""))) say(t.search(/\bcascade\b/), "CASCADE (a drop must stop if anything depends on it)");
  if (/\bpublic\s*\./.test(t)) say(t.search(/\bpublic\s*\./), "names an object in public");
  for (const s of ["reqstream", "reqstream_meta", "storage", "realtime", "graphql_public", "extensions"]) {
    const r = new RegExp("\\b" + s + "\\s*\\.");
    if (r.test(t)) say(t.search(r), "names an object in " + s);
  }
  // grants and revokes: on highland only
  const gRe = /\b(grant|revoke)\b[^;]*?\bon\s+(all\s+(tables|sequences|functions|routines)\s+in\s+schema\s+([a-z_]+)|(table|function|schema|sequence)\s+([a-z_]+))/g;
  while ((m = gRe.exec(t))) {
    const sch = m[4] || m[6];
    if (sch !== "highland") say(m.index, m[1] + " on " + sch + ": not highland");
  }
  // every function pins search_path
  const fRe = /\bcreate\s+(or\s+replace\s+)?function\s+([a-z_.]+)\s*\(/g;
  while ((m = fRe.exec(t))) {
    const body = t.slice(m.index, t.indexOf(" as $", m.index) + 1 || m.index + 2000);
    if (!/set\s+search_path\s*=\s*''/.test(body)) say(m.index, "function " + m[2] + " does not pin search_path to ''");
  }
  return bad;
}

function allFiles(root = path.resolve(__dirname, "..", "..", "deploy", "supabase")) {
  const out = [];
  for (const d of ["migrations", "optional"]) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith(".sql")) out.push(path.join(dir, f));
  }
  return out;
}

module.exports = { problems, allFiles, strip, statements };

if (require.main === module) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : allFiles();
  let n = 0;
  for (const f of files) for (const p of problems(f)) { console.log("FAIL " + p); n++; }
  console.log("RESULT sqlcheck: " + files.length + " files, " + n + " problems");
  process.exit(n ? 1 : 0);
}
