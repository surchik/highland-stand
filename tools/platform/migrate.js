#!/usr/bin/env node
// The game's migrations (deploy/supabase/migrations): applies them up to a version, or rolls them back to one, over
// a connection to the database (on the shared server, through an SSH tunnel; deploy/supabase/README.md).
//
//   node tools/platform/migrate.js status            [--dsn=postgres://postgres@127.0.0.1:55622/postgres]
//   node tools/platform/migrate.js up [N]            apply every migration up to N (default: the newest)
//   node tools/platform/migrate.js down N --yes      roll back to N (0: remove the schema highland and ALL its data)
//   node tools/platform/migrate.js regrant           the lockdown and 003's grants again (after a restore)
//   options: --dsn=... (or HS_DB_URL), --dry-run (say what would run, change nothing)
//
// The password is never on the command line and never printed: put it in PGPASSWORD (read it with  read -rs
// PGPASSWORD; export PGPASSWORD) or in ~/.pgpass. A password written into the DSN is refused.
//
// Each migration runs in one transaction of its own, under an advisory lock (two runs cannot overlap), with a
// lock_timeout of 10 s (it waits for no other app's long lock) and no statement timeout. In the same transaction:
// the bookkeeping row in highland.schema_migrations (the up file's sha256), then the lockdown (lockdown.sql), then,
// when 003 is applied, 003's grants and policies again. So whatever Supabase's default privileges granted while the
// migration made its objects is taken back before anyone can see them. A migration already applied whose up file
// has changed since stops the run.
//
// It connects as the migrating role, postgres, which on Supabase is not a superuser. A superuser connection is
// moved to postgres (set role postgres), so no function is ever owned by a superuser; if postgres itself is a
// superuser it stops.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = path.resolve(__dirname, "..", "..", "deploy", "supabase", "migrations");
const LOCK_KEY = 0x48534d47;   // "HSMG": the advisory lock's key

// the migrations on disk: [{ version, name, up, down }] in order, each with both files
function list(dir = DIR) {
  const files = fs.readdirSync(dir);
  const by = new Map();
  for (const f of files) {
    const m = /^(\d{3})_([a-z0-9_]+)\.(up|down)\.sql$/.exec(f);
    if (!m) continue;
    const v = Number(m[1]);
    const e = by.get(v) || { version: v, name: m[2] };
    if (e.name !== m[2]) throw new Error("two names for migration " + m[1] + ": " + e.name + " and " + m[2]);
    e[m[3]] = path.join(dir, f);
    by.set(v, e);
  }
  const out = [...by.values()].sort((a, b) => a.version - b.version);
  out.forEach((e, i) => {
    if (e.version !== i + 1) throw new Error("the migrations must be numbered 001, 002, ... with no gap (missing " + String(i + 1).padStart(3, "0") + ")");
    if (!e.up || !e.down) throw new Error("migration " + String(e.version).padStart(3, "0") + " needs both an up and a down file");
  });
  return out;
}
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file) => fs.readFileSync(file, "utf8");

async function applied(c) {
  const t = (await c.query("select to_regclass('highland.schema_migrations') is not null as t")).rows[0].t;
  if (!t) return [];
  return (await c.query("select version, name, checksum, applied_at from highland.schema_migrations order by version")).rows;
}

// moves a superuser connection to postgres; refuses a superuser postgres. Returns the role the migrations run as.
async function asMigrator(c) {
  const me = (await c.query("select current_user as u, (select rolsuper from pg_roles where rolname = current_user) as s")).rows[0];
  if (!me.s) return me.u;
  const pg = (await c.query("select rolsuper from pg_roles where rolname = 'postgres'")).rows[0];
  if (!pg) throw new Error("connected as the superuser " + me.u + " and there is no role postgres to run the migrations as");
  if (pg.rolsuper) throw new Error("postgres is a superuser here: the functions would be owned by a superuser. Stop and ask the game's builder.");
  await c.query("set role postgres");
  return "postgres (set role from " + me.u + ")";
}

// One step in its own transaction. kind: "up" | "down" | "regrant"
async function step(c, all, m, kind, log) {
  await c.query("begin");
  try {
    await c.query("select pg_advisory_xact_lock($1)", [LOCK_KEY]);
    await c.query("set local lock_timeout = '10s'; set local statement_timeout = 0");
    const before = await applied(c);
    const top = before.length ? before[before.length - 1].version : 0;
    if (kind === "up") {
      if (top !== m.version - 1) throw new Error("migration " + m.version + " cannot go on top of " + top);
      await c.query(read(m.up));
      await c.query("insert into highland.schema_migrations (version, name, checksum) values ($1, $2, $3)", [m.version, m.name, sha(m.up)]);
    } else if (kind === "down") {
      if (top !== m.version) throw new Error("migration " + m.version + " is not the newest applied (" + top + ")");
      await c.query("delete from highland.schema_migrations where version = $1", [m.version]);
      await c.query(read(m.down));
    }
    const now = kind === "down" ? m.version - 1 : kind === "up" ? m.version : top;
    // after every step: the lockdown, then 003's grants when 003 is applied (003 itself begins with the lockdown)
    const g = all.find(x => x.version === 3 && x.name === "grants_policies");
    if (now >= 3 && g && !(kind === "up" && m.version === 3)) await c.query(read(g.up));
    else if (now < 3) await c.query(read(path.join(path.dirname(all[0].up), "lockdown.sql")));
    await c.query("commit");
    log((kind === "up" ? "applied  " : kind === "down" ? "reverted " : "regranted ") + (m ? String(m.version).padStart(3, "0") + "_" + m.name : "") + "  (now at " + now + ")");
    return now;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  }
}

// The library entry, used by the tests: migrate({ client, target, regrant, dir, log, dryRun }) -> the version at the end
async function migrate(o) {
  const c = o.client, log = o.log || (() => {});
  const all = list(o.dir);
  await asMigrator(c);
  const done = await applied(c);
  for (const d of done) {
    const m = all.find(x => x.version === d.version);
    if (!m) throw new Error("the database has migration " + d.version + " (" + d.name + ") that is not on disk: is this an older checkout?");
    if (sha(m.up) !== d.checksum) throw new Error("migration " + String(d.version).padStart(3, "0") + "_" + d.name + " was applied from a different file: its up file changed since (" + d.checksum.slice(0, 12) + " applied, " + sha(m.up).slice(0, 12) + " now)");
  }
  let at = done.length ? done[done.length - 1].version : 0;
  if (o.regrant) {
    if (at < 3) throw new Error("003 is not applied: nothing to grant");
    if (o.dryRun) { log("would run the lockdown and 003's grants again"); return at; }
    return step(c, all, null, "regrant", log);
  }
  const target = o.target === undefined ? all.length : o.target;
  if (!(Number.isInteger(target) && target >= 0 && target <= all.length)) throw new Error("no such version: " + o.target + " (0 to " + all.length + ")");
  while (at < target) {
    const m = all[at];
    if (o.dryRun) { log("would apply  " + String(m.version).padStart(3, "0") + "_" + m.name); at++; continue; }
    at = await step(c, all, m, "up", log);
  }
  while (at > target) {
    const m = all[at - 1];
    if (o.dryRun) { log("would revert " + String(m.version).padStart(3, "0") + "_" + m.name); at--; continue; }
    at = await step(c, all, m, "down", log);
  }
  return at;
}

module.exports = { migrate, list, applied, DIR, sha };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (k) => { const a = argv.find(x => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : undefined; };
  const flag = (k) => argv.includes("--" + k);
  const pos = argv.filter(a => !a.startsWith("--"));
  const cmd = pos[0] || "status";
  const dsn = opt("dsn") || process.env.HS_DB_URL;
  const die = (m) => { console.error("migrate: " + m); process.exit(2); };
  if (!["status", "up", "down", "regrant"].includes(cmd)) die("unknown command " + cmd + " (status, up [N], down N --yes, regrant)");
  if (!dsn) die("no database: pass --dsn=postgres://postgres@127.0.0.1:55622/postgres (or set HS_DB_URL); the password goes in PGPASSWORD");
  let u;
  try { u = new URL(dsn); } catch (e) { die("the DSN is not an address"); }
  if (u.password) die("the DSN holds a password: take it out and put it in PGPASSWORD (it must never be on a command line or in a log)");
  const shown = u.protocol + "//" + (u.username ? u.username + "@" : "") + u.host + u.pathname;
  let pg;
  try { pg = require("pg"); } catch (e) { die("the npm package pg is missing: run  npm install --prefix tools/platform"); }
  (async () => {
    const c = new pg.Client({ connectionString: dsn, application_name: "highland-migrate" });
    try { await c.connect(); } catch (e) { die("could not connect to " + shown + ": " + e.message); }
    try {
      const all = list();
      const done = await applied(c);
      const at = done.length ? done[done.length - 1].version : 0;
      console.log("database " + shown + ": highland at " + at + " of " + all.length);
      if (cmd === "status") {
        for (const m of all) {
          const d = done.find(x => x.version === m.version);
          console.log("  " + String(m.version).padStart(3, "0") + "_" + m.name.padEnd(20) + (d ? "applied " + new Date(d.applied_at).toISOString() + (d.checksum === sha(m.up) ? "" : "  (ITS FILE CHANGED SINCE)") : "not applied"));
        }
        return;
      }
      let target;
      if (cmd === "up") target = pos[1] === undefined ? all.length : Number(pos[1]);
      if (cmd === "down") {
        if (pos[1] === undefined) die("down needs the version to roll back to (0 removes the schema and all its data)");
        target = Number(pos[1]);
        if (!flag("yes") && !flag("dry-run")) die("down changes the database: take the backup first (README), then run it again with --yes (or --dry-run to see the plan)");
      }
      const end = await migrate({ client: c, target, regrant: cmd === "regrant", dryRun: flag("dry-run"), log: (m) => console.log("  " + m) });
      console.log("done: highland at " + end);
    } catch (e) {
      console.error("migrate: stopped, nothing of the failed step was kept: " + e.message);
      process.exitCode = 1;
    } finally { await c.end().catch(() => {}); }
  })();
}
