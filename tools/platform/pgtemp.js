// A throwaway PostgreSQL for the platform's tests (docs/specs/platform.final.md 10.1). It runs the machine's own
// PostgreSQL 16 server from /usr/lib/postgresql/16/bin as the "postgres" user (PostgreSQL refuses to run as
// root) on a data folder under /var/tmp/hs-stack. Not under the session's scratch folder: the postgres user
// cannot enter root's private folders. It listens on a socket in that folder only, never on the network, and
// lets local users in without a password: there is no password, key or secret anywhere in it. stop() removes
// the folder.
//
// const db = await require("./pgtemp").start();
// await db.createDatabase("hs", { schema: true });     // standins.sql, schema.sql (twice when asked), test-clock.sql
// const c = await db.client("hs", "supabase_admin");     // a pg Client; also "postgres" and "authenticator"
// await db.stop();
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync, spawnSync } = require("child_process");

const BIN = process.env.HS_PG_BIN || "/usr/lib/postgresql/16/bin";
const BASE = process.env.HS_STACK_DIR || "/var/tmp/hs-stack";
const ROOT = path.resolve(__dirname, "..", "..");
const FILES = {
  standins: path.join(__dirname, "standins.sql"),
  schema: path.join(ROOT, "deploy", "supabase", "schema.sql"),
  handoff: path.join(ROOT, "deploy", "supabase", "schema-handoff.sql"),
  clock: path.join(__dirname, "test-clock.sql"),
};

let pg;
function needPg() {
  if (pg) return pg;
  try { pg = require("pg"); } catch (e) {
    throw new Error("the npm package pg is missing: run  npm install --prefix tools/platform  (see tools/platform/README.md)");
  }
  // jsonb and json come back as JS values, bigint (int8) as a number: the tests compare plain values
  pg.types.setTypeParser(20, v => Number(v));
  return pg;
}

// run a PostgreSQL program as the postgres user (as root), or as ourselves when we are not root
function asPostgres(prog, args, opts = {}) {
  const exe = path.join(BIN, prog);
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  const cmd = isRoot ? "runuser" : exe;
  const argv = isRoot ? ["-u", "postgres", "--", exe, ...args] : args;
  const r = spawnSync(cmd, argv, { cwd: "/", encoding: "utf8", timeout: opts.timeout || 60000 });
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(prog + " failed (" + (r.status === null ? r.signal : "exit " + r.status) + "): " + (r.stderr || r.stdout || "").trim().slice(0, 2000));
  }
  return r;
}

async function start(opts = {}) {
  if (!fs.existsSync(path.join(BIN, "postgres"))) throw new Error("no PostgreSQL server at " + BIN + " (set HS_PG_BIN)");
  fs.mkdirSync(BASE, { recursive: true, mode: 0o755 });
  fs.chmodSync(BASE, 0o1777);
  const dir = fs.mkdtempSync(path.join(BASE, (opts.name || "db") + "-"));
  fs.chmodSync(dir, 0o755);
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  if (isRoot) execFileSync("chown", ["postgres", dir]);
  const data = path.join(dir, "data");
  const port = 20000 + Math.floor(Math.random() * 20000);
  asPostgres("initdb", ["-D", data, "-U", "supabase_admin", "--auth=trust", "-E", "UTF8", "--locale=C.UTF-8", "-N"]);
  const conf = [
    "listen_addresses = ''", "port = " + port, "unix_socket_directories = '" + dir + "'",
    "fsync = off", "synchronous_commit = off", "full_page_writes = off",   // a throwaway database: speed over safety
    "max_connections = 60", "shared_buffers = 64MB",
  ].join("\n") + "\n";
  fs.appendFileSync(path.join(data, "postgresql.conf"), conf);
  if (isRoot) execFileSync("chown", ["postgres", path.join(data, "postgresql.conf")]);
  asPostgres("pg_ctl", ["-D", data, "-w", "-t", "60", "-l", path.join(dir, "server.log"), "start"]);
  const db = {
    dir, port, host: dir,
    async client(database, user) {
      const P = needPg();
      const c = new P.Client({ host: dir, port, user: user || "supabase_admin", database: database || "postgres" });
      await c.connect();
      return c;
    },
    pool(database, user, max) {
      const P = needPg();
      return new P.Pool({ host: dir, port, user: user || "supabase_admin", database, max: max || 10 });
    },
    // a fresh database owned by postgres, with Supabase's stand-ins and, when asked, the game's schema
    async createDatabase(name, o = {}) {
      const a = await db.client("postgres");
      try {
        await a.query("drop database if exists " + quoteIdent(name) + " with (force)");
        // the roles live in the whole cluster: postgres must exist before it can own the database
        await a.query("do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login createrole createdb bypassrls; end if; end $$");
        await a.query("create database " + quoteIdent(name) + " owner postgres");
      } finally { await a.end(); }
      const c = await db.client(name);
      try {
        await db.runFile(c, FILES.standins);
        if (o.schema) {
          const times = o.schemaTwice ? 2 : 1;
          for (let i = 0; i < times; i++) await db.runFile(c, FILES.schema, o.onNotice);
          if (o.handoff) for (let i = 0; i < times; i++) await db.runFile(c, FILES.handoff, o.onNotice);
          if (o.clock !== false) await db.runFile(c, FILES.clock);
        }
      } finally { await c.end(); }
    },
    async runFile(c, file, onNotice) {
      const sql = fs.readFileSync(file, "utf8");
      const notices = [];
      const h = m => { notices.push(m); if (onNotice) onNotice(m, file); };
      c.on("notice", h);
      try { await c.query(sql); } catch (e) {
        e.message = path.basename(file) + ": " + e.message + (e.position ? " (at character " + e.position + ")" : "");
        throw e;
      } finally { c.removeListener("notice", h); }
      return notices;
    },
    async stop() {
      asPostgres("pg_ctl", ["-D", data, "-m", "immediate", "-w", "-t", "30", "stop"], { allowFail: true });
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    },
    log() { try { return fs.readFileSync(path.join(dir, "server.log"), "utf8"); } catch (e) { return ""; } },
  };
  return db;
}

function quoteIdent(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

module.exports = { start, needPg, quoteIdent, FILES, BASE };
