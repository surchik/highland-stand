#!/usr/bin/env node
// The SQL suite (docs/specs/platform.final.md 10.2, with docs/specs/RULINGS.md S1 to S5 and S8).
//
//   node tools/platform/sql-tests.js [--only=group,group] [--keep] [--verbose]
//
// It starts a throwaway PostgreSQL 16 (pgtemp.js), makes a fresh database with Supabase's stand-ins
// (standins.sql), runs deploy/supabase/schema.sql in it TWICE (the file must be safe to run again), loads the
// test clock (test-clock.sql) and then holds every rule of the spec to account, as the three callers a rule
// concerns: a visitor (anon), a player (authenticated) and an admin. A caller's call is made the way PostgREST
// makes it: on a connection logged in as "authenticator", in a transaction of its own, after
// "set local role anon|authenticated" and the JWT claims set for the transaction; a function marked stable runs
// in a read-only transaction. So the grants and row level security are the database's own, really enforced.
// A second database is then made with the optional schema-handoff.sql loaded as well, for the handoff's cases
// and to show the main file's rules still hold beside it.
//
// Prints one line per group and a FAIL line per broken rule, then "RESULT sql-tests: N assertions, F failed".
// Exit 0 only when nothing failed. Needs the npm package pg (npm install --prefix tools/platform).
"use strict";
const crypto = require("crypto");
const pgtemp = require("./pgtemp");
const ref = require("./ref");

const ARGS = process.argv.slice(2);
const ONLY = (ARGS.find(a => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const VERBOSE = ARGS.includes("--verbose");

let total = 0, failed = 0, groupName = "", groupCount = 0, groupFail = 0;
function ok(cond, what) {
  total++; groupCount++;
  if (cond !== true) { failed++; groupFail++; console.log("FAIL [" + groupName + "] " + what); }
  else if (VERBOSE) console.log("  ok " + what);
}
function eq(a, b, what) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  ok(sa === sb, what + (sa === sb ? "" : " (got " + sa + ", wanted " + sb + ")"));
}

// ------------------------------------------------------------------ callers
const U = {
  A: "00000000-0000-4000-8000-00000000000a", B: "00000000-0000-4000-8000-00000000000b",
  C: "00000000-0000-4000-8000-00000000000c", D: "00000000-0000-4000-8000-00000000000d",
  N: "00000000-0000-4000-8000-0000000000e0",   // signed in, no name yet
  R: "00000000-0000-4000-8000-0000000000f0",   // rate limits
  Q: "00000000-0000-4000-8000-0000000000f2",   // the limit on results
  S: "00000000-0000-4000-8000-0000000000f1",   // the score table
  AD: "00000000-0000-4000-8000-0000000000ad",
};

let admin, api, api2, clock = "";
async function setClock(interval) { clock = interval || ""; }
// a superuser's statement, with the test clock set for its transaction
async function su(sql, params) {
  await admin.query("begin");
  try {
    await admin.query("select set_config('hs_test.clock', $1, true)", [clock]);
    const r = await admin.query(sql, params);
    await admin.query("commit");
    return r.rows;
  } catch (e) { await admin.query("rollback"); throw e; }
}
// one call by one caller, as PostgREST would make it
async function as(who, sql, params, o = {}) {
  const c = o.conn || api;
  await c.query(o.readOnly ? "begin isolation level read committed read only" : "begin");
  try {
    const claims = who ? { sub: who, role: "authenticated", aud: "authenticated" } : { role: "anon" };
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('hs_test.clock', $2, true)", [JSON.stringify(claims), clock]);
    await c.query(who ? "set local role authenticated" : "set local role anon");
    const r = await c.query(sql, params);
    if (o.hold) return { rows: r.rows, commit: () => c.query("commit"), rollback: () => c.query("rollback") };
    await c.query("commit");
    return r.rows;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; }
}
const STABLE = new Set(["hs_config", "hs_board", "hs_daily_status", "hs_profile_get", "hs_save_get", "hs_stats"]);
// a function by name with named arguments, as POST /rest/v1/rpc/<fn> does it; the answer's JSON
// (a jsonb argument is sent as JSON whatever its value, as PostgREST sends it; a text[] as a list)
const SIG = new Map();
async function argTypes(fn) {
  if (!SIG.has(fn)) {
    const rows = (await admin.query(`select p.proargnames as n, array(select format_type(t, null) from unnest(p.proargtypes) t) as t
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1`, [fn])).rows;
    const m = {};
    for (const r of rows) (r.n || []).forEach((n, i) => { m[n] = r.t[i]; });
    SIG.set(fn, m);
  }
  return SIG.get(fn);
}
async function rpc(who, fn, args, o = {}) {
  const keys = Object.keys(args || {});
  const types = await argTypes(fn);
  const vals = keys.map(k => { const v = args[k]; return types[k] === "jsonb" ? JSON.stringify(v) : v; });
  const sql = "select public." + fn + "(" + keys.map((k, i) => k + " => $" + (i + 1)).join(", ") + ") as r";
  const rows = await as(who, sql, vals, { readOnly: STABLE.has(fn), ...o });
  return o.hold ? rows : rows[0].r;
}
// the error a call raises: { msg, code, detail } or null
async function err(p) {
  try { await p; return null; } catch (e) { return { msg: e.message, code: e.code, detail: e.detail }; }
}
async function errMsg(p) { const e = await err(p); return e ? e.msg : ""; }

// ------------------------------------------------------------------ rulesets
const SCRIPT10 = [1, 2, 3, 5, 8, 10, 12, 15, 18, 20];
const SCRIPT12 = [1, 2, 3, 5, 8, 9, 10, 12, 14, 16, 18, 20];
function rules(o = {}) {
  const r = {
    v: 1,
    score: { win: 4000, lives: 3000, speed: 1500, thrift: 1500, lostMax: 3999 },
    levels: {
      erebuni: { waves: 10, rev: 1, script: SCRIPT10, d: [
        { lives: 30, min: 200, fast: 300, slow: 900, earnMax: 6000 }, { lives: 20, min: 200, fast: 300, slow: 900, earnMax: 5500 },
        { lives: 14, min: 200, fast: 300, slow: 900, earnMax: 5200 }] },
      tushpa: { waves: 12, rev: o.tushpaRev || 1, script: SCRIPT12, d: [
        { lives: 30, fast: 400, slow: 1100, earnMax: 7000 }, { lives: 20, fast: 400, slow: 1100, earnMax: 6500 },
        { lives: 14, fast: 400, slow: 1100, earnMax: 6200 }] },
    },
    daily: {
      pool: ["erebuni", "tushpa"], twists: ["thin", "few"], k: 5, j: 3, diff: 1, attempts: 3, waves: 12,
      skip: { tushpa: ["few"] },
      t: { thin: { earn: 0.8 }, few: { livesSet: 12 } },
      levels: {
        erebuni: { script: SCRIPT12, min: 150, fast: 200, slow: 700, earnMax: 4000 },
        tushpa: { script: SCRIPT12, min: 160, fast: 250, slow: 800, earnMax: 4500 },
      },
    },
  };
  return r;
}
const R2 = rules(), R3 = rules({ tushpaRev: 2 });

function dayNumber(dateStr) { return Math.floor(Date.parse(dateStr + "T00:00:00Z") / 86400000); }
function dayString(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
async function serverDay() { return (await su("select (hs_private.now() at time zone 'utc')::date::text as d"))[0].d; }
async function backRuns(user, interval) {
  await su("update public.hs_runs set started_at = started_at - $2::interval where user_id = $1", [user, interval]);
}
async function runBegin(who, mode, level, diff, ruleset, twist) {
  const a = { p_mode: mode, p_level: level, p_diff: diff, p_ruleset: ruleset };
  if (twist !== undefined) a.p_twist = twist;
  return rpc(who, "hs_run_begin", a);
}
// begin a run, move its start back, post the stats; the answer (or the error's message)
async function play(who, ruleset, level, diff, stats, o = {}) {
  const b = await runBegin(who, o.mode || "campaign", level, diff, ruleset, o.twist);
  if (!b.ok) return { begin: b };
  await su("update public.hs_runs set started_at = started_at - $2::interval where id = $1", [b.run_id, o.back || "40 minutes"]);
  const e = await err(rpc(who, "hs_score_submit", { p_run: b.run_id, p_stats: stats }));
  if (e) return { error: e.msg, detail: e.detail, run: b.run_id };
  return { ...(await su("select score, stars, flags, board from public.hs_scores where run_id = $1", [b.run_id]))[0], run: b.run_id };
}

// ------------------------------------------------------------------ the groups
const GROUPS = [];
function group(name, fn) { GROUPS.push({ name, fn }); }

const TABLES = ["hs_profiles", "hs_saves", "hs_rulesets", "hs_runs", "hs_scores", "hs_score_best", "hs_sessions", "hs_events",
  "hs_admins", "hs_config", "hs_name_blocklist", "hs_rate"];
const OPEN_FNS = ["hs_config", "hs_track", "hs_board", "hs_daily_status"];
const PLAYER_FNS = ["hs_profile_get", "hs_profile_set_name", "hs_save_get", "hs_save_put", "hs_run_begin", "hs_score_submit", "hs_delete_account"];
const ADMIN_FNS = ["hs_stats", "hs_admin_publish_ruleset", "hs_admin_set_config", "hs_admin_moderate", "hs_admin_remove_score", "hs_admin_purge_events"];
// a call of each function that would be valid in shape, to see who may make it
const SAMPLE = {
  hs_profile_get: {}, hs_profile_set_name: { p_name: "Tryname" }, hs_save_get: {}, hs_save_put: { p_expected: 0, p_data: { v: 1 } },
  hs_run_begin: { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_ruleset: "2" },
  hs_score_submit: { p_run: "00000000-0000-4000-8000-000000000999", p_stats: { won: true } }, hs_delete_account: {},
  hs_stats: { p_days: 7 }, hs_admin_publish_ruleset: { p_id: "x", p_data: {} }, hs_admin_set_config: { p_key: "gate", p_value: "off" },
  hs_admin_moderate: { p_user: U.B, p_hidden: true }, hs_admin_remove_score: { p_score: 1 }, hs_admin_purge_events: { p_days: 180 },
};

group("structure", async (ctx) => {
  const tables = TABLES.concat(ctx.handoff ? ["hs_handoff"] : []);
  const rows = await su(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'hs\\_%' and c.relkind = 'r' order by 1`);
  eq(rows.map(r => r.relname).sort(), tables.slice().sort(), "the hs_ tables are the spec's " + tables.length);
  ok(rows.every(r => r.relrowsecurity), "row level security is on for every hs_ table");
  const privs = await su(`select c.relname, r.role, q.priv from pg_class c join pg_namespace n on n.oid = c.relnamespace,
      (values ('anon'), ('authenticated'), ('public')) r(role),
      (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) q(priv)
    where n.nspname = 'public' and c.relname like 'hs\\_%' and c.relkind = 'r'
      and has_table_privilege(case when r.role = 'public' then 'anon' else r.role end, c.oid, q.priv)`);
  eq(privs, [], "no API role holds any privilege on any hs_ table");
  const seq = await su(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace, (values ('anon'), ('authenticated')) r(role)
    where n.nspname = 'public' and c.relname like 'hs\\_%' and c.relkind = 'S'
      and (has_sequence_privilege(r.role, c.oid, 'USAGE') or has_sequence_privilege(r.role, c.oid, 'SELECT') or has_sequence_privilege(r.role, c.oid, 'UPDATE'))`);
  eq(seq, [], "nor on any hs_ sequence");
  eq(await su(`select tablename from pg_policies where schemaname = 'public' and tablename like 'hs\\_%'`), [], "no policy exists on any hs_ table");
  eq(await su(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'hs_private' or (n.nspname = 'public' and p.proname like 'hs\\_%')) and has_function_privilege('public', p.oid, 'execute')`), [],
    "no hs_ function and no helper is executable by PUBLIC");
  eq(await su(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'hs_private' or (n.nspname = 'public' and p.proname like 'hs\\_%'))
      and (p.proconfig is null or not p.proconfig @> array['search_path=""'])`), [], "every function of the game pins its search_path (security definer or not)");
  eq(await su(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'hs\\_%' and not p.prosecdef`), [], "every hs_ function in public is security definer");
  ok((await su(`select has_schema_privilege('anon', 'hs_private', 'usage') or has_schema_privilege('authenticated', 'hs_private', 'usage') as u`))[0].u === false,
    "no API role may use the schema hs_private");
  const exec = await su(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as u
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'hs\\_%' order by 1`);
  const open = OPEN_FNS.concat(ctx.handoff ? ["hs_handoff_put", "hs_handoff_take"] : []);
  eq(exec.filter(r => r.a).map(r => r.proname).sort(), open.slice().sort(), "a visitor may run exactly the open functions");
  eq(exec.filter(r => r.u).map(r => r.proname).sort(), open.concat(PLAYER_FNS, ADMIN_FNS).sort(), "a player may run exactly the open, the player's and the admin's (which refuse him)");
  eq(exec.map(r => r.proname).sort(), open.concat(PLAYER_FNS, ADMIN_FNS).sort(), "no other hs_ function exists in public");
  eq((await su(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'hs\\_%' and p.provolatile <> 'v' order by 1`)).map(r => r.proname), [...STABLE].sort(),
    "exactly six hs_ functions are stable (PostgREST runs those read-only), and no seventh");
  eq(await su(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid = p.proowner
    where (n.nspname = 'hs_private' or (n.nspname = 'public' and p.proname like 'hs\\_%')) and (r.rolsuper or r.rolname <> 'postgres')`), [],
    "every function belongs to postgres, which is not a superuser");
  const tmo = await su(`select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('hs_stats', 'hs_admin_purge_events', 'hs_delete_account') order by 1`);
  eq(tmo.map(r => r.proname + ":" + (r.proconfig.find(x => x.startsWith("statement_timeout")) || "")),
    ["hs_admin_purge_events:statement_timeout=60s", "hs_delete_account:statement_timeout=30s", "hs_stats:statement_timeout=30s"],
    "the three heavy functions carry their own statement timeout");
  eq(ctx.warnings, [], "schema.sql's closing checks warn of nothing on this stand-in, run twice");
});

group("refusals", async () => {
  // every table, every way, as a visitor and as a player: refused by the database itself
  const sqlOf = {
    select: t => "select * from public." + t + " limit 1",
    insert: t => "insert into public." + t + " default values",
    update: t => "update public." + t + " set " + (t === "hs_rate" ? "n = 0" : t === "hs_config" ? "key = key" : t === "hs_name_blocklist" ? "kind = kind" : "user_id = user_id") +
      (["hs_rulesets", "hs_sessions", "hs_events"].includes(t) ? "" : ""),
    delete: t => "delete from public." + t,
  };
  for (const who of [null, U.A]) {
    const label = who ? "a player" : "a visitor";
    for (const t of TABLES) {
      for (const op of ["select", "insert", "delete"]) {
        const m = await errMsg(as(who, sqlOf[op](t)));
        ok(/permission denied for table/.test(m), label + " cannot " + op + " " + t + (m ? "" : " (it ran)"));
      }
      const m = await errMsg(as(who, "update public." + t + " set " + firstColumn[t] + " = " + firstColumn[t]));
      ok(/permission denied for table/.test(m), label + " cannot update " + t);
    }
    const m = await errMsg(as(who, "select hs_private.is_admin()"));
    ok(/permission denied for schema hs_private/.test(m), label + " cannot call a private helper");
  }
  // a visitor may not run any function but the open ones
  for (const fn of PLAYER_FNS.concat(ADMIN_FNS)) {
    const m = await errMsg(rpc(null, fn, SAMPLE[fn]));
    ok(/permission denied for function/.test(m), "a visitor is refused " + fn + " (" + m + ")");
  }
  // a player is refused every admin function, by the function's own word
  for (const fn of ADMIN_FNS) {
    const e = await err(rpc(U.A, fn, SAMPLE[fn]));
    ok(e && e.msg === "not_admin" && e.code === "42501", "a player is refused " + fn + " with not_admin (" + (e && e.msg) + ")");
  }
  // an unknown name and an overload that does not exist
  ok(/does not exist/.test(await errMsg(as(null, "select public.hs_secret()"))), "a function that does not exist");
  ok(/does not exist/.test(await errMsg(as(null, "select public.hs_config(p_x => 1)"))), "an argument a function does not have");
  // auth.users, as on Supabase, is not the API's either
  ok(/permission denied/.test(await errMsg(as(U.A, "select * from auth.users"))), "a player cannot read auth.users");
});
const firstColumn = { hs_profiles: "name", hs_saves: "version", hs_rulesets: "active", hs_runs: "diff", hs_scores: "score",
  hs_score_best: "score", hs_sessions: "build", hs_events: "seq", hs_admins: "note", hs_config: "value", hs_name_blocklist: "kind", hs_rate: "n" };

group("names", async () => {
  ok((await rpc(U.A, "hs_profile_get", {})).name === null, "no profile yet: name is null");
  ok((await rpc(U.A, "hs_profile_get", {})).admin === false, "and not an admin");
  // the table of names the page's own check is held to as well (ref.js)
  for (const [n, want, what] of ref.NAME_CASES) {
    if (!/^name_/.test(want)) continue;
    eq(await errMsg(rpc(U.A, "hs_profile_set_name", { p_name: n })), want, "refused: " + what);
  }
  for (const [n, want, what] of ref.NAME_CASES) {
    if (/^name_/.test(want)) continue;
    eq((await su("select hs_private.name_clean($1) as n", [n]))[0].n, want, "accepted: " + what);
  }
  eq((await rpc(U.A, "hs_profile_set_name", { p_name: "  Արամ   Aram " })).name, "Արամ Aram", "Armenian letters accepted, spaces trimmed and made one");
  eq((await errMsg(as(U.A, "select count(*) from public.hs_profiles"))).includes("permission denied"), true, "a player reads not even his own profile row");
  eq(await errMsg(rpc(U.B, "hs_profile_set_name", { p_name: "արամ_aram" })), "name_taken", "the same name folded (case, underscore) is taken");
  eq(await errMsg(rpc(U.B, "hs_profile_set_name", { p_name: "Արամ A.r.a.m" })), "name_taken", "dots folded away too");
  eq((await rpc(U.B, "hs_profile_set_name", { p_name: "Ar4m" })).ok, true, "Ar4m is not Արամ Aram");
  eq(await errMsg(rpc(U.C, "hs_profile_set_name", { p_name: "a r a m" })), "name_taken", "a r a m folds to Ar4m's aram");
  eq((await rpc(U.B, "hs_profile_set_name", { p_name: "Bagrat" })).name, "Bagrat", "a change in the first ten minutes is free");
  eq((await rpc(U.B, "hs_profile_get", {})).name, "Bagrat", "the player reads his own name through the function");
  eq((await rpc(U.B, "hs_profile_set_name", { p_name: "Bagrat" })).ok, true, "the same name again is no change");
  for (const [who, n] of [[U.C, "Нарек"], [U.D, "山田太郎"]]) eq((await rpc(who, "hs_profile_set_name", { p_name: n })).name, n, "letters of another alphabet: " + n);
  const L = await su(`select hs_private.name_letters('محمد') a, hs_private.name_letters('Zoë 7') b, hs_private.name_letters('Ελένη') c, hs_private.name_letters('a😀b') d`);
  ok(L[0].a && L[0].b && L[0].c && !L[0].d, "Arabic, accented Latin and Greek are letters; a picture is not");
  eq(await errMsg(rpc(U.S, "hs_profile_set_name", { p_name: "Supporters" })), "", "an exact reserved word inside a longer name is allowed");
  // the weekly limit: past the first ten minutes, one change in seven days
  await setClock("11 minutes");
  eq(await errMsg(rpc(U.B, "hs_profile_set_name", { p_name: "Bagrat II" })), "name_wait", "past the first ten minutes a second change waits a week");
  await setClock("8 days");
  eq((await rpc(U.B, "hs_profile_set_name", { p_name: "Bagrat II" })).name, "Bagrat II", "after seven days it is allowed");
  await setClock("8 days 1 hour");
  eq(await errMsg(rpc(U.B, "hs_profile_set_name", { p_name: "Bagrat III" })), "name_wait", "and then the week starts again");
  await setClock("");
  // twenty changes an hour
  let last = "";
  for (let i = 0; i < 21; i++) last = await errMsg(rpc(U.R, "hs_profile_set_name", { p_name: "Rater " + String.fromCharCode(97 + i) }));
  eq(last, "rate_limited", "the 21st name call in an hour is refused");
  const e = await err(rpc(U.R, "hs_profile_set_name", { p_name: "Rater zz" }));
  eq(e && e.code, "PT429", "with PostgREST's 429 code");
  // the admin renames and hides
  ok((await rpc(U.AD, "hs_profile_get", {})).admin === true, "the admin's profile says admin");
});

group("saves", async () => {
  eq((await rpc(U.A, "hs_save_get", {})).version, 0, "no save yet: version 0");
  ok((await rpc(U.A, "hs_save_get", {})).data === null, "and no data");
  eq((await rpc(U.A, "hs_save_put", { p_expected: 0, p_data: { v: 1, keys: { hs_records: "{}" } }, p_device: "iPad" })).version, 1, "first write");
  eq((await rpc(U.A, "hs_save_put", { p_expected: 1, p_data: { v: 1, keys: { hs_records: "{\"erebuni\":1}" } }, p_device: "iPad" })).version, 2, "second write");
  const stale = await rpc(U.A, "hs_save_put", { p_expected: 1, p_data: { v: 1, keys: {} }, p_device: "PC" });
  ok(stale.ok === false && stale.version === 2, "a stale write is turned away with the version stored");
  ok(/erebuni/.test(stale.data.keys.hs_records) && stale.device === "iPad", "and gets the stored save and its device back");
  eq((await rpc(U.A, "hs_save_put", { p_expected: 0, p_data: { v: 1 } })).ok, false, "a first write over an existing save is turned away");
  const g = await rpc(U.A, "hs_save_get", {});
  ok(g.version === 2 && g.device === "iPad" && typeof g.updated_at === "string" && typeof g.now === "string", "the save reads back with its version, device and time");
  eq(await errMsg(rpc(U.A, "hs_save_put", { p_expected: 2, p_data: { k: "x".repeat(270000) } })), "save_too_large", "a save over 256 KB");
  eq(await errMsg(as(U.A, "select public.hs_save_put(2, '[1]')")), "save_invalid", "a save that is not an object");
  eq(await errMsg(as(U.A, "select public.hs_save_put(2, null)")), "save_invalid", "a save that is null");
  eq((await rpc(U.A, "hs_save_get", { p_channel: "next" })).version, 0, "the staging channel has a save of its own");
  eq((await rpc(U.A, "hs_save_put", { p_expected: 0, p_data: { v: 1, keys: { hs_records: "{\"staging\":1}" } }, p_device: "next:test", p_channel: "next" })).version, 1, "and writes it");
  ok(/erebuni/.test((await rpc(U.A, "hs_save_get", {})).data.keys.hs_records), "the live save is untouched by it");
  eq(await errMsg(rpc(U.A, "hs_save_put", { p_expected: 0, p_data: {}, p_channel: "beta" })), "channel_unknown", "a channel that does not exist");
  eq(await errMsg(rpc(U.A, "hs_save_get", { p_channel: "beta" })), "channel_unknown", "nor can it be read");
  eq((await rpc(U.B, "hs_save_get", {})).version, 0, "B has no save and cannot see A's");
  // two devices race a first write: the second waits for the first, then gets the first's save back
  const t1 = await rpc(U.C, "hs_save_put", { p_expected: 0, p_data: { v: 1, keys: { from: "one" } }, p_device: "one" }, { hold: true });
  const p2 = rpc(U.C, "hs_save_put", { p_expected: 0, p_data: { v: 1, keys: { from: "two" } }, p_device: "two" }, { conn: api2 });
  await new Promise(r => setTimeout(r, 300));
  await t1.commit();
  const r2 = await p2;
  ok(r2.ok === false && r2.version === 1 && r2.data.keys.from === "one" && r2.device === "one", "two devices racing a first write: the second gets the first's save back");
  // 240 writes an hour
  let v = 0, last = null;
  for (let i = 0; i < 241; i++) {
    const e = await err(rpc(U.R, "hs_save_put", { p_expected: v, p_data: { v: 1, n: i } }).then(x => { v = x.version; }));
    last = e;
  }
  ok(last && last.msg === "rate_limited" && v === 240, "the 241st save write in an hour is refused (" + (last && last.msg) + ", " + v + " written)");
});

group("rulesets", async () => {
  eq(await errMsg(rpc(U.A, "hs_admin_publish_ruleset", { p_id: "2", p_data: R2 })), "not_admin", "a player publishes a ruleset");
  eq((await rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "2", p_data: R2 })).ok, true, "the admin publishes ruleset 2");
  eq((await rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "3", p_data: R3 })).ok, true, "and ruleset 3 (Tushpa's rev moved, Erebuni's did not)");
  eq((await rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "3-next", p_data: R3 })).ok, true, "and the staging page's 3-next");
  const bad = (f) => { const r = JSON.parse(JSON.stringify(R2)); f(r); return r; };
  const cases = [
    [bad(r => { delete r.levels.erebuni.rev; }), "erebuni: rev", "a battlefield without its rev (RULINGS S4)"],
    [bad(r => { r.levels.erebuni.rev = "x"; }), null, "a rev that is not a number"],
    [bad(r => { r.levels.erebuni.script = [1, 2, 3]; }), "erebuni: script", "a script table of the wrong length"],
    [bad(r => { r.levels.erebuni.script = SCRIPT10.slice(0, 9).concat([19]); }), "erebuni: script", "a script table that does not end on 20"],
    [bad(r => { r.levels.erebuni.d.pop(); }), "erebuni", "two difficulties instead of three"],
    [bad(r => { r.levels.erebuni.d[1].fast = 950; }), "erebuni: difficulty 1", "fast not under slow"],
    [bad(r => { r.levels.erebuni.d[1].fast = "quick"; }), null, "a pace that is not a number"],
    [bad(r => { r.levels.erebuni.waves = 0; }), "erebuni", "no waves"],
    [bad(r => { delete r.daily.waves; }), "daily: waves", "a daily without its own length (RULINGS S5)"],
    [bad(r => { delete r.daily.levels.tushpa; }), "tushpa: the daily's table", "a daily without its table for a battlefield of its pool"],
    [bad(r => { r.daily.levels.erebuni.script = SCRIPT10; }), "erebuni: the daily's script", "a daily script that is not daily.waves long"],
    [bad(r => { r.daily.pool.push("nowhere"); }), "nowhere: not a battlefield", "a pool that names a battlefield the ruleset lacks"],
    [bad(r => { r.daily.skip.erebuni = ["thin", "few"]; }), "erebuni: no twist left", "a battlefield that leaves out every twist"],
    [bad(r => { r.daily.k = 4; }), "daily: k shares a factor with the pool", "a step k that shares a factor with the pool"],
    [bad(r => { r.daily.j = 2; }), "daily: j shares a factor with the twists", "a step j that shares a factor with the twists"],
    [bad(r => { r.daily.diff = 3; }), "daily: diff or attempts", "a daily difficulty that does not exist"],
    [bad(r => { delete r.score; }), "shape", "no score weights"],
    [bad(r => { delete r.daily; }), "daily", "no daily at all"],
    [bad(r => { r.daily.pool = "erebuni"; }), "daily", "a pool that is not a list"],
    [bad(r => { r.levels.erebuni.d[0].min = "abc"; }), "a value that is not a number", "a min that is not a number (it would fail every run's begin)"],
    [bad(r => { r.levels.erebuni.d[0].min = -1; }), "erebuni: difficulty 0", "a min under zero"],
    [bad(r => { r.score.win = "4000.5"; }), "a value that is not a number", "a weight that is not a whole number (hs_score_submit adds it as one)"],
    [bad(r => { r.score.speed = 1500.5; }), "a value that is not a number", "a weight that is a fraction"],
    [bad(r => { r.score.lostMax = "x"; }), "a value that is not a number", "a lostMax that is not a number"],
    [bad(r => { r.daily.t.thin.earn = "lots"; }), "a value that is not a number", "a twist multiplier that is not a number"],
    [bad(r => { r.daily.t.thin.fast = 0; }), "daily: twist thin", "a twist multiplier of zero"],
    [bad(r => { r.daily.t.few.livesSet = 0; }), "daily: twist few", "a twist that sets no defenders"],
    [bad(r => { r.daily.t.few.livesSet = "x"; }), "a value that is not a number", "a livesSet that is not a number"],
    [bad(r => { r.daily.t = [1]; }), "daily: t", "twists' table that is not an object"],
    [bad(r => { r.daily.levels.erebuni.min = "abc"; }), "a value that is not a number", "a daily min that is not a number"],
    [bad(r => { r.daily.t.thin.slow = 0.2; }), "erebuni: the daily's table under twist thin", "a twist that brings slow under fast"],
    ["[1]", "shape", "not an object"],
  ];
  for (const [data, detail, what] of cases) {
    const e = await err(rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "9", p_data: data }));
    ok(e && e.msg === "ruleset_invalid" && (detail === null || e.detail === detail), "refused: " + what + " (" + (e ? e.msg + " / " + e.detail : "published") + ")");
  }
  eq(await errMsg(rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "a b", p_data: R2 })), "ruleset_invalid", "an id with a space");
  // a kept rev must mean the same battle (the boards are keyed by it, RULINGS S4), on the same channel
  for (const [data, detail, what] of [
    [bad(r => { r.levels.erebuni.d[1].lives = 25; }), "erebuni: its rev is kept but the battle or the score changed (move its rev)", "Erebuni's defenders changed, its rev kept"],
    [bad(r => { r.levels.erebuni.d[2].fast = 310; }), "erebuni: its rev is kept but the battle or the score changed (move its rev)", "Erebuni's pace changed, its rev kept"],
    [bad(r => { r.levels.tushpa.script = SCRIPT12.slice(0, 11).concat([20]).map((x, i) => i === 0 ? 2 : x); }), "tushpa: its rev is kept but the battle or the score changed (move its rev)", "Tushpa's script changed, its rev kept"],
    [bad(r => { r.score.speed = 1600; r.levels.tushpa.rev = 7; }), "erebuni: its rev is kept but the battle or the score changed (move its rev)", "the score's weights changed, one rev kept"],
  ]) {
    const e = await err(rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "9", p_data: data }));
    ok(e && e.msg === "ruleset_invalid" && e.detail === detail, "refused: " + what + " (" + (e ? e.msg + " / " + e.detail : "published") + ")");
  }
  eq(await errMsg(rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "2", p_data: bad(r => { r.levels.erebuni.d[1].lives = 25; }) })), "ruleset_invalid", "nor by publishing ruleset 2 again with it");
  eq((await rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "9", p_data: bad(r => { r.score.speed = 1600; r.levels.erebuni.rev = 8; r.levels.tushpa.rev = 7; r.score.lostMax = 3000; }) })).ok, true,
    "the weights changed with every rev moved: published");
  eq((await rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "9", p_data: bad(r => { r.score.speed = 1600; r.levels.erebuni.rev = 8; r.levels.tushpa.rev = 7; }) })).ok, true,
    "lostMax alone may change (it is no campaign board's)");
  eq((await rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "9-next", p_data: bad(r => { r.levels.erebuni.d[1].lives = 25; r.levels.erebuni.rev = 8; r.levels.tushpa.rev = 2; }) })).ok, true,
    "a staging ruleset is held only to the staging channel's (Erebuni's rev 8 means another battle on the live boards)");
  await su("delete from public.hs_rulesets where id in ('9', '9-next')");
  ok((await su("select count(*)::int as n from public.hs_rulesets where id = '9'"))[0].n === 0, "none of them was stored");
  // the switches
  eq(await errMsg(rpc(U.A, "hs_admin_set_config", { p_key: "gate", p_value: "off" })), "not_admin", "a player sets the gate");
  eq((await rpc(U.AD, "hs_admin_set_config", { p_key: "gate", p_value: "optional" })).gate, "optional", "the admin sets the gate");
  eq((await rpc(null, "hs_config", {})).gate, "optional", "and a visitor's hs_config says so");
  ok(!("ev_cap_hour" in (await rpc(null, "hs_config", {}))), "hs_config shows a visitor no private switch");
  for (const [k, v, what] of [["gate", "sometimes", "a gate value that does not exist"], ["ev_cap_hour", "many", "a cap that is not a number"],
      ["notice", "x".repeat(141), "a notice over 140 characters"]]) {
    eq(await errMsg(rpc(U.AD, "hs_admin_set_config", { p_key: k, p_value: v })), "value_invalid", "refused: " + what);
  }
  eq(await errMsg(rpc(U.AD, "hs_admin_set_config", { p_key: "secret", p_value: 1 })), "key_unknown", "a switch that does not exist");
  eq(await errMsg(as(U.AD, "select public.hs_admin_set_config(null, '1'::jsonb)")), "key_unknown", "a switch with no name");
  eq(await errMsg(rpc(U.AD, "hs_admin_set_config", { p_key: "boards", p_value: { pad: "x".repeat(4100) } })), "value_invalid", "a switch over 4 KB (hs_config sends it to every visitor)");
  eq((await rpc(U.AD, "hs_admin_set_config", { p_key: "boards", p_value: { pad: "x".repeat(3000) } })).boards.pad.length, 3000, "one of 3 KB is kept");
  await as(U.AD, "select public.hs_admin_set_config('boards', 'null'::jsonb)");
  await as(U.AD, "select public.hs_admin_set_config('gate', 'null'::jsonb)");
  ok(!("gate" in (await rpc(null, "hs_config", {}))), "a null value removes the switch");
  eq((await rpc(U.AD, "hs_admin_set_config", { p_key: "notice", p_value: "Back at six." })).notice, "Back at six.", "a notice for the gate's cards");
  await as(U.AD, "select public.hs_admin_set_config('notice', 'null'::jsonb)");
});

group("scores", async () => {
  for (const who of [U.C, U.D, U.S, U.N]) { /* names were set in "names" for A, B, C, D */ }
  await rpc(U.S, "hs_profile_set_name", { p_name: "Sargis" });
  eq(await errMsg(runBegin(U.N, "campaign", "erebuni", 1, "2")), "no_profile", "a player without a name begins no run");
  eq(await errMsg(runBegin(U.A, "arena", "erebuni", 1, "2")), "mode_unknown", "a mode that does not exist");
  eq(await errMsg(runBegin(U.A, "campaign", "erebuni", 1, "99")), "ruleset_unknown", "a run under an unpublished ruleset");
  eq(await errMsg(runBegin(U.A, "campaign", "nowhere", 1, "2")), "level_unknown", "a run on a battlefield the ruleset lacks");
  eq(await errMsg(runBegin(U.A, "campaign", "erebuni", 3, "2")), "diff_unknown", "a difficulty that does not exist");
  eq(await errMsg(runBegin(U.A, "campaign", "erebuni", -1, "2")), "diff_unknown", "a difficulty of -1 (jsonb would read it as Hard)");
  const b0 = await runBegin(U.A, "campaign", "erebuni", 1, "2");
  ok(b0.ok === true && /^[0-9a-f-]{36}$/.test(b0.run_id) && b0.attempts_left === null, "a campaign run begins with its token");
  const good = { won: true, lives: 20, waves: 10, sim_sec: 600, spent: 900, earned: 3000, loadout: "std", build: "2026-11-20" };
  const e0 = await err(rpc(U.A, "hs_score_submit", { p_run: b0.run_id, p_stats: good }));
  ok(e0 && e0.msg === "score_implausible" && e0.detail === "clock", "a ten-minute battle sent at once cannot have been played (clock)");
  await su("update public.hs_runs set started_at = started_at - interval '20 minutes' where id = $1", [b0.run_id]);
  const refuse = [
    [{ ...good, lives: 21 }, "lives or waves", "more defenders than the difficulty has"],
    [{ ...good, lives: -1 }, "lives or waves", "fewer than none"],
    [{ ...good, waves: 9 }, "lives or waves", "a win short of the battlefield's length"],
    [{ ...good, sim_sec: 179 }, "time", "a clock under nine tenths of min"],
    [{ ...good, sim_sec: 6 * 3600 + 1 }, "time", "a clock over six hours"],
    [{ ...good, earned: 5501 }, "gold", "more gold than the battle pays"],
    [{ ...good, spent: 3001 }, "gold", "more spent than earned"],
    [{ ...good, spent: 0 }, "gold", "a win with nothing spent"],
    [{ ...good, won: false, lives: 0, waves: 4 }, "a defeat", "a campaign defeat is not a score"],
  ];
  for (const [st, detail, what] of refuse) {
    const e = await err(rpc(U.A, "hs_score_submit", { p_run: b0.run_id, p_stats: st }));
    ok(e && e.msg === "score_implausible" && e.detail === detail, "refused: " + what + " (" + (e ? e.msg + "/" + e.detail : "taken") + ")");
  }
  for (const [st, what] of [[{ ...good, won: "maybe" }, "won is not a boolean"], [{ ...good, lives: "many" }, "lives is not a number"],
      [{ ...good, loadout: "gold" }, "a loadout that does not exist"], [{ won: true }, "numbers missing"], ["[1]", "not an object"]]) {
    eq(await errMsg(rpc(U.A, "hs_score_submit", { p_run: b0.run_id, p_stats: st })), "stats_invalid", "refused: " + what);
  }
  const a1 = await rpc(U.A, "hs_score_submit", { p_run: b0.run_id, p_stats: good });
  ok(a1.accepted && a1.score === 8800 && a1.stars === 3, "the spec's example scores 4000 + 3000 + 750 + 1050 = 8800, three stars");
  ok(a1.board === "c:erebuni:1:std:1" && a1.best_all && a1.best_week && a1.rank_all === 1 && a1.total_all === 1 && a1.rank_week === 1,
    "it goes on board c:erebuni:1:std:1 (the battlefield's rev, RULINGS S4), first of one, all time and this week");
  eq(await errMsg(rpc(U.A, "hs_score_submit", { p_run: b0.run_id, p_stats: good })), "run_finished", "a run posts once");
  eq(await errMsg(rpc(U.A, "hs_score_submit", { p_run: crypto.randomUUID(), p_stats: good })), "run_unknown", "a run that does not exist");
  const bB = await runBegin(U.B, "campaign", "erebuni", 1, "2");
  eq(await errMsg(rpc(U.A, "hs_score_submit", { p_run: bB.run_id, p_stats: good })), "run_unknown", "A cannot post on B's run");
  await su("update public.hs_runs set started_at = started_at - interval '31 days' where id = $1", [bB.run_id]);
  eq(await errMsg(rpc(U.B, "hs_score_submit", { p_run: bB.run_id, p_stats: good })), "run_expired", "a run begun over 30 days ago");
  ok(/permission denied/.test(await errMsg(as(U.A, "select flags from public.hs_scores"))), "a player cannot read his flags");
  // the table of score cases, the same as unit.js holds the page's scoreOf to
  for (const c of ref.SCORE_CASES) {
    const r = await play(U.S, "2", "erebuni", 1, { ...c.stats, loadout: "open" });
    ok(r.score === c.score && r.stars === c.stars && JSON.stringify(r.flags) === JSON.stringify(c.flags),
      "score table: " + c.what + " (got " + JSON.stringify([r.score, r.stars, r.flags, r.error]) + ", wanted " + JSON.stringify([c.score, c.stars, c.flags]) + ")");
    ok(ref.scoreOf(c.stats, ref.SCORE_BOUNDS) === c.score, "and the reference arithmetic agrees: " + c.what);
  }
  // best of, ranks and ties
  let r = await play(U.A, "2", "erebuni", 1, { ...good, lives: 15 });
  ok(r.score < 8800, "A's lower score is taken");
  eq((await rpc(U.A, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" })).rows[0].score, 8800, "but A's board row keeps his best");
  r = await play(U.B, "2", "erebuni", 1, { ...good, lives: 10, sim_sec: 900, spent: 3000 });
  eq(r.score, 5500, "B scores 5500");
  r = await play(U.C, "2", "erebuni", 1, { ...good, lives: 10, sim_sec: 900, spent: 3000 });
  const board = await rpc(U.C, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" });
  eq(board.rows.map(x => [x.rank, x.name, x.score]), [[1, "Արամ Aram", 8800], [2, "Bagrat II", 5500], [3, "Нарек", 5500]], "ranks: equal scores rank by who got there first");
  ok(board.me.rank === 3 && board.total === 3 && board.rows[2].me === true && board.rows[0].me === false, "the caller's own row and rank come with the board");
  ok(board.rows.every(x => !("uid" in x) && !("id" in x)), "a player's board rows carry no account or score ids");
  ok(board.rows.every(x => typeof x.lives === "number" && typeof x.sec === "number" && typeof x.at === "string"), "rows carry defenders kept, the clock and the time");
  const vis = await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" });
  ok(vis.rows.length === 3 && vis.me === null, "a visitor reads the board and has no rank");
  ok((await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2", p_limit: 1 })).rows.length === 1, "a board of one row");
  // Standard and Open, rulesets and revs (RULINGS S4), staging
  const openB = await rpc(U.A, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "open", p_ruleset: "2" });
  ok(openB.board === "c:erebuni:1:open:1" && openB.rows.length === 1 && openB.rows[0].name === "Sargis", "the Open board is another board");
  r = await play(U.D, "3", "erebuni", 1, { ...good, lives: 18 });
  ok(r.board === "c:erebuni:1:std:1", "ruleset 3 leaves Erebuni's rev alone: its score joins the same board");
  eq((await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" })).rows.length, 4, "seen from ruleset 2's side too");
  r = await play(U.D, "2", "tushpa", 1, { ...good, waves: 12, sim_sec: 700 });
  const r3 = await play(U.D, "3", "tushpa", 1, { ...good, waves: 12, sim_sec: 700 });
  ok(r.board === "c:tushpa:1:std:1" && r3.board === "c:tushpa:1:std:2", "ruleset 3 moved Tushpa's rev: Tushpa's boards start fresh");
  // RULINGS S2: a resumed battle posts lives_board, which may be 0 on a win; the stars come from what is posted
  r = await play(U.D, "2", "erebuni", 1, { ...good, lives: 0 });
  ok(r.score === ref.scoreOf({ ...good, lives: 0 }, ref.boundsOf(R2, "erebuni", 1)) && r.stars === 1 && r.board === "c:erebuni:1:std:1",
    "a win posted with 0 defenders (a resumed battle's lives_board) is taken, one star (" + JSON.stringify([r.score, r.stars, r.error]) + ")");
  // RULINGS S4: the board's rev is the published ruleset's, never the client's
  r = await play(U.D, "2", "erebuni", 1, { ...good, lives: 17, rev: 99 });
  eq(r.board, "c:erebuni:1:std:1", "a rev sent in p_stats is ignored: the board is the ruleset's rev 1");
  const rn = await play(U.D, "3-next", "erebuni", 1, { ...good, lives: 19 });
  ok(rn.board === "c:erebuni:1:std:1:next", "a staging ruleset's scores go on a board of their own (:next)");
  eq((await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "3-next" })).rows.length, 1, "which the staging page reads");
  eq((await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "3" })).rows.length, 4, "and the live board does not show");
  const unk = await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "77" });
  ok(unk.ruleset_unknown === true && unk.rows.length === 0 && unk.total === 0, "a ruleset the server lacks answers an empty board");
  eq(await errMsg(rpc(null, "hs_board", { p_mode: "campaign", p_level: "nowhere", p_diff: 1, p_loadout: "std", p_ruleset: "2" })), "board_unknown", "a battlefield the ruleset lacks");
  eq(await errMsg(rpc(null, "hs_board", { p_mode: "arena" })), "mode_unknown", "a board mode that does not exist");
  // the week: this week's key across a Sunday midnight UTC, and a new week's board starts empty
  const wk = await su(`select hs_private.week_key('2026-11-15 23:59:59+00') a, hs_private.week_key('2026-11-16 00:00:00+00') b, hs_private.week_key('2026-11-16 00:00:00+01') c`);
  ok(wk[0].a === "w:2026-11-09" && wk[0].b === "w:2026-11-16" && wk[0].c === "w:2026-11-09", "the week turns at Monday 00:00 UTC, not at local midnight");
  const now = new Date((await su("select extract(epoch from pg_catalog.now()) as e"))[0].e * 1000);
  const toMonday = ((8 - now.getUTCDay()) % 7 || 7) * 86400 - (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) + 60;
  await setClock(toMonday + " seconds");
  const wkB = await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2", p_period: "week" });
  ok(wkB.rows.length === 0 && wkB.period !== "w:" + now.toISOString().slice(0, 10), "on Monday the week's board starts empty (" + wkB.period + ")");
  eq((await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" })).rows.length, 4, "the all-time board keeps everyone");
  r = await play(U.B, "2", "erebuni", 1, { ...good, lives: 12, sim_sec: 900 });
  const wkB2 = await rpc(U.B, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2", p_period: "week" });
  ok(wkB2.rows.length === 1 && wkB2.me.rank === 1, "B's score on Monday leads the new week");
  await setClock("");
  // a hidden player, a removed score
  await rpc(U.AD, "hs_admin_moderate", { p_user: U.A, p_hidden: true });
  const hid = await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" });
  ok(hid.rows.length === 3 && hid.total === 3 && !hid.rows.some(x => x.name === "Արամ Aram"), "a hidden player is on no board and in no total");
  await rpc(U.AD, "hs_admin_moderate", { p_user: U.A, p_hidden: false });
  const adm = await rpc(U.AD, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" });
  ok(adm.rows.length === 4 && adm.rows.every(x => typeof x.id === "number" && typeof x.uid === "string"), "an admin's rows carry the score and account ids");
  await rpc(U.AD, "hs_admin_remove_score", { p_score: adm.rows.find(x => x.name === "Արամ Aram").id });
  const after = await rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" });
  const aRow = after.rows.find(x => x.name === "Արամ Aram");
  ok(aRow && aRow.score < 8800 && aRow.score > 7000, "a removed score: the player's next best takes its place (" + (aRow && aRow.score) + ")");
  eq(await errMsg(rpc(U.AD, "hs_admin_remove_score", { p_score: 999999 })), "score_unknown", "removing a score that does not exist");
  eq(await errMsg(rpc(U.AD, "hs_admin_moderate", { p_user: crypto.randomUUID(), p_hidden: true })), "user_unknown", "moderating a player who does not exist");
  await rpc(U.AD, "hs_admin_moderate", { p_user: U.C, p_hidden: false, p_name: "Narek" });
  eq((await rpc(U.C, "hs_profile_get", {})).name, "Narek", "the admin renames a player");
  eq(await errMsg(rpc(U.AD, "hs_admin_moderate", { p_user: U.C, p_hidden: false, p_name: "<x>" })), "name_chars", "under the same name rule");
  eq(await errMsg(rpc(U.AD, "hs_admin_moderate", { p_user: U.C, p_hidden: false, p_name: "Bagrat II" })), "name_taken", "and a name another player holds is name_taken, not a raw error");
  // rate limits: 60 runs an hour, 40 results an hour
  let last = "";
  await rpc(U.R, "hs_profile_get", {});
  for (let i = 0; i < 61; i++) last = await errMsg(runBegin(U.R, "campaign", "erebuni", 1, "2"));
  eq(last, "rate_limited", "the 61st run in an hour is refused");
  // (a call that fails is rolled back with its counter, as every PostgREST call is one transaction: what is
  // limited is what is stored)
  for (let i = 0; i < 3; i++) last = await errMsg(rpc(U.R, "hs_score_submit", { p_run: crypto.randomUUID(), p_stats: good }));
  eq(last, "run_unknown", "a refused result stores nothing, its counter included");
  await rpc(U.Q, "hs_profile_set_name", { p_name: "Quick Poster" });
  let n = 0;
  for (let i = 0; i < 41; i++) { const x = await play(U.Q, "2", "erebuni", 1, good); if (x.score) n++; else last = x.error; }
  ok(n === 40 && last === "rate_limited", "the 41st result in an hour is refused (" + n + " taken, then " + last + ")");
});

group("daily", async () => {
  const today = await serverDay(), dn = dayNumber(today);
  const pick = ref.dailyOf(R2.daily, dn);
  const st = await rpc(U.A, "hs_daily_status", { p_ruleset: "2" });
  ok(st.day === today && st.level === pick.level && st.twist === pick.twist && st.attempts === 3 && st.used === 0 && st.waves === 12 && st.diff === 1,
    "today's challenge is the page's arithmetic: " + pick.level + ", " + pick.twist);
  ok(st.ends_in > 0 && st.ends_in <= 86400, "and says when the next one comes");
  ok((await rpc(null, "hs_daily_status", { p_ruleset: "2" })).used === 0, "a visitor reads today's challenge");
  eq(await errMsg(rpc(null, "hs_daily_status", { p_ruleset: "77" })), "ruleset_unknown", "under a ruleset the server lacks");
  const other = pick.level === "erebuni" ? "tushpa" : "erebuni";
  eq(await errMsg(runBegin(U.A, "daily", other, 1, "2", pick.twist)), "daily_mismatch", "a daily on another battlefield");
  eq(await errMsg(runBegin(U.A, "daily", pick.level, 1, "2", "noarchers")), "daily_mismatch", "a daily with a twist of one's own");
  eq(await errMsg(runBegin(U.A, "daily", pick.level, 2, "2", pick.twist)), "daily_mismatch", "a daily on another difficulty");
  const b = await (async () => { const out = []; for (let i = 0; i < 4; i++) out.push(await runBegin(U.A, "daily", pick.level, 1, "2", pick.twist)); return out; })();
  eq(b.map(x => x.attempts_left), [2, 1, 0, 0], "three attempts, then none");
  ok(b[3].ok === false && b[3].reason === "no_attempts", "a fourth attempt is turned away");
  const bd = ref.boundsOf(R2, pick.level, 1, pick.twist, true);
  await backRuns(U.A, "40 minutes");
  // a lost daily is scored by the waves it held of the daily's twelve (RULINGS S3)
  const lost = await rpc(U.A, "hs_score_submit", { p_run: b[0].run_id, p_stats: { won: false, lives: 0, waves: 5, sim_sec: 300, spent: 900, earned: 2000 } });
  ok(lost.score === Math.floor(4000 * 5 / 12) && lost.stars === 0 && lost.board === "d:" + today, "a loss on wave 6 of 12 scores floor(4000 * 5 / 12) = 1666 on the day's board");
  ok(lost.rank_week === null && lost.total_week === null, "a daily has no week's board");
  const lost6 = await rpc(U.A, "hs_score_submit", { p_run: b[2].run_id, p_stats: { won: false, lives: 0, waves: 6, sim_sec: 350, spent: 900, earned: 2000 } });
  eq(lost6.score, 2000, "a loss with half the daily held scores floor(4000 * 6 / 12) = 2000");
  eq(await errMsg(rpc(U.A, "hs_score_submit", { p_run: b[1].run_id, p_stats: { won: false, lives: 0, waves: 12, sim_sec: 900, spent: 900, earned: 2000 } })),
    "score_implausible", "a defeat with all twelve waves cleared");
  eq(await errMsg(rpc(U.A, "hs_score_submit", { p_run: b[1].run_id, p_stats: { won: true, lives: 10, waves: 10, sim_sec: 900, spent: 900, earned: 2000 } })),
    "score_implausible", "a win of the campaign's ten waves: a daily is daily.waves long (RULINGS S5)");
  eq(await errMsg(rpc(U.A, "hs_score_submit", { p_run: b[1].run_id, p_stats: { won: true, lives: 10, waves: 12, sim_sec: 900, spent: 900, earned: bd.earnMax + 1 } })),
    "score_implausible", "more gold than the daily's own table pays (" + bd.earnMax + ")");
  eq(await errMsg(rpc(U.A, "hs_score_submit", { p_run: b[1].run_id, p_stats: { won: true, lives: 10, waves: 12, sim_sec: Math.floor(bd.min * 0.9) - 1, spent: 900, earned: 2000 } })),
    "score_implausible", "faster than the daily's own min");
  const won = await rpc(U.A, "hs_score_submit", { p_run: b[1].run_id, p_stats: { won: true, lives: Math.min(10, bd.lives), waves: 12, sim_sec: bd.slow, spent: 1000, earned: 2000, loadout: "open" } });
  const want = ref.scoreOf({ won: true, lives: Math.min(10, bd.lives), sim_sec: bd.slow, spent: 1000, earned: 2000 }, bd);
  ok(won.score === want, "a won daily is scored on the daily's own pars (" + won.score + ", wanted " + want + ")");
  ok((await su("select loadout from public.hs_scores where run_id = $1", [b[1].run_id]))[0].loadout === "std", "a daily is always standard, whatever is posted");
  const st2 = await rpc(U.A, "hs_daily_status", { p_ruleset: "2" });
  ok(st2.used === 3 && st2.best === want && st2.rank === 1 && st2.total === 1, "the status counts three attempts used and the best");
  for (const c of ref.LOST_CASES) eq(ref.scoreOf({ won: false, waves: c.cleared }, { waves: 12 }), c.score, "reference: a loss with " + c.cleared + " of 12 cleared");
  // staging: attempts and the board of the staging channel are its own
  const sn = await rpc(U.A, "hs_daily_status", { p_ruleset: "3-next" });
  ok(sn.used === 0, "the staging page's daily counts its own attempts");
  const bn = await runBegin(U.A, "daily", sn.level, 1, "3-next", sn.twist);
  ok(bn.ok && bn.attempts_left === 2, "and begins one of them");
  await backRuns(U.A, "40 minutes");
  const ln = await rpc(U.A, "hs_score_submit", { p_run: bn.run_id, p_stats: { won: false, lives: 0, waves: 3, sim_sec: 200, spent: 100, earned: 900 } });
  ok(ln.board === "d:" + today + ":next" && ln.score === 1000, "on the day's staging board, scored floor(4000 * 3 / 12) = 1000");
  eq((await rpc(null, "hs_board", { p_mode: "daily" })).rows.length, 1, "the live day's board holds only the live score");
  eq((await rpc(null, "hs_board", { p_mode: "daily", p_ruleset: "3-next" })).rows.length, 1, "the staging day's board holds its own");
  // one day's board for the whole channel: a page on an older ruleset whose daily would be another battle is
  // turned away once a newer ruleset is published, and the newer one's page plays it
  const R8 = JSON.parse(JSON.stringify(R3));
  for (const k of Object.keys(R8.daily.levels)) R8.daily.levels[k].slow += 50;
  await rpc(U.AD, "hs_admin_publish_ruleset", { p_id: "8-next", p_data: R8 });
  const eOld = await err(runBegin(U.B, "daily", sn.level, 1, "3-next", sn.twist));
  ok(eOld && eOld.msg === "daily_mismatch" && eOld.detail === "an older ruleset", "a daily under an older ruleset with other tables than the newest: daily_mismatch");
  const b8 = await runBegin(U.B, "daily", sn.level, 1, "8-next", sn.twist);
  ok(b8.ok === true, "the newest ruleset's daily begins");
  eq((await runBegin(U.B, "daily", pick.level, 1, "2", pick.twist)).ok, true, "and the live channel is not touched by a staging ruleset");
  await su("delete from public.hs_runs where ruleset = '8-next' or (user_id = $1 and mode = 'daily')", [U.B]);
  await su("delete from public.hs_rulesets where id = '8-next'");
  // the bounds of a twist
  const bb = await su(`select (hs_private.bounds($1::jsonb, 'erebuni', 1, 'few', true)).lives a, (hs_private.bounds($1::jsonb, 'erebuni', 1, 'thin', true)).earn_max b,
      (hs_private.bounds($1::jsonb, 'erebuni', 1, null, false)).earn_max c, (hs_private.bounds($1::jsonb, 'erebuni', 1, 'thin', true)).waves d`, [JSON.stringify(R2)]);
  ok(bb[0].a === 12 && bb[0].b === 3200 && bb[0].c === 5500 && bb[0].d === 12, "Few defenders sets 12; Thin purse scales the daily's purse; the campaign's is its own");
  // the next day: a new challenge, the attempts back, yesterday's board kept
  await setClock("1 day");
  const tomorrow = dayString(dn + 1), p2 = ref.dailyOf(R2.daily, dn + 1);
  const st3 = await rpc(U.A, "hs_daily_status", { p_ruleset: "2" });
  ok(st3.day === tomorrow && st3.level === p2.level && st3.twist === p2.twist && st3.used === 0 && st3.best === null, "the day changes, and the challenge with it");
  ok(p2.level !== pick.level, "never the same battlefield two days running");
  eq((await rpc(null, "hs_board", { p_mode: "daily" })).rows.length, 0, "today's board starts empty");
  const y = await rpc(null, "hs_board", { p_mode: "daily", p_day: today });
  ok(y.rows.length === 1 && y.rows[0].score === want && y.board === "d:" + today, "yesterday's board is still there");
  // a day whose twist is Few defenders: more than 12 defenders is refused
  let fewDay = null;
  for (let d = dn + 1; d < dn + 40; d++) if (ref.dailyOf(R2.daily, d).twist === "few") { fewDay = d; break; }
  await setClock((fewDay - dn) + " days");
  const pf = ref.dailyOf(R2.daily, fewDay);
  const bf = await runBegin(U.B, "daily", pf.level, 1, "2", pf.twist);
  await backRuns(U.B, "40 minutes");
  eq(await errMsg(rpc(U.B, "hs_score_submit", { p_run: bf.run_id, p_stats: { won: true, lives: 13, waves: 12, sim_sec: 600, spent: 900, earned: 2000 } })),
    "score_implausible", "on a Few defenders day, 13 defenders cannot be");
  ok((await rpc(U.B, "hs_score_submit", { p_run: bf.run_id, p_stats: { won: true, lives: 12, waves: 12, sim_sec: 600, spent: 900, earned: 2000 } })).stars === 3,
    "12 of 12 is all of them: three stars");
  await setClock("");
  // the pick: the page's arithmetic for every day of a year, three pool sizes, with skips
  const pools = [
    { pool: Array.from({ length: 17 }, (_, i) => "b" + i), twists: ["thin", "swift", "iron", "few", "quiet", "noballista"], skip: { b3: ["few"], b7: ["few", "quiet"] } },
    { pool: Array.from({ length: 5 }, (_, i) => "b" + i), twists: Array.from({ length: 12 }, (_, i) => "t" + i), skip: { b0: ["t0", "t1", "t2"] } },
    { pool: ["a", "b", "c"], twists: ["x", "y"], skip: {} },
  ];
  for (const p of pools) {
    p.k = ref.kOf(p.pool.length); p.j = ref.jOf(p.twists.length);
    const rows = await su(`select g, (hs_private.daily_pick(jsonb_build_object('daily', $1::jsonb), (date '1970-01-01' + g))).* from generate_series($2::int, $2::int + 364) g order by g`,
      [JSON.stringify(p), dn]);
    const bad = rows.filter(x => { const w = ref.dailyOf(p, x.g); return w.level !== x.level_id || w.twist !== x.twist; });
    ok(bad.length === 0, "the server's pick equals the page's for 365 days, " + p.pool.length + " battlefields by " + p.twists.length + " twists (" + bad.length + " differ)");
    const skipped = rows.filter(x => (p.skip[x.level_id] || []).includes(x.twist));
    ok(skipped.length === 0, "and never serves a twist a battlefield skips");
  }
  for (const m of [6, 12]) {
    const p = { pool: Array.from({ length: 17 }, (_, i) => "b" + i), twists: Array.from({ length: m }, (_, i) => "t" + i), k: 5, j: ref.jOf(m) };
    const rows = await su(`select g, (hs_private.daily_pick(jsonb_build_object('daily', $1::jsonb), (date '1970-01-01' + g))).* from generate_series($2::int, $2::int + $3::int - 1) g order by g`,
      [JSON.stringify(p), dn, 2 * 17 * m]);
    const first = rows.slice(0, 17 * m), seen = new Set(first.map(x => x.level_id + "/" + x.twist));
    ok(seen.size === 17 * m, "over 17 x " + m + " days every battlefield meets every twist exactly once");
    let rep = 0; for (let i = 1; i < rows.length; i++) if (rows[i].level_id === rows[i - 1].level_id || rows[i].twist === rows[i - 1].twist) rep++;
    ok(rep === 0, "and over two cycles neither the battlefield nor the twist repeats on consecutive days");
  }
});

group("analytics", async () => {
  const ctx = (aid, sid, more) => ({ aid, sid, build: "2026-11-20", ruleset: "2", channel: "live", dev: "phone", os: "ios", browser: "safari", standalone: false, vw: 667, vh: 320, lang: "en", ref: "", ...more });
  const D1 = "11111111-1111-4111-8111-111111111111", D2 = "22222222-2222-4222-8222-222222222222";
  let r = await rpc(null, "hs_track", { p_ctx: ctx(D1, "sess-0001-abcd"), p_events: [
    { n: "page_load", q: 1, t: 1794000000000, p: {} }, { n: "gate_shown", q: 2, t: 1794000001000, p: { state: "signin" } }, { n: "Bad Name", q: 3 },
    { n: "x", q: 4 }, { n: "a".repeat(41), q: 5 }, { n: 7, q: 6 }, "page_load", { n: "wave_end", q: 7, p: [1, 2] }, { n: "wave_end", q: 8, p: null }] });
  ok(r.accepted === 3 && r.dropped === 6, "bad names, a bare string and props that are a list are skipped; null props are kept (" + JSON.stringify(r) + ")");
  eq(await errMsg(rpc(null, "hs_track", { p_ctx: ctx(D2, "sess-0001-abcd"), p_events: [{ n: "page_load" }] })), "ctx_invalid", "another device borrows a session id");
  for (const [c, what] of [[ctx("not-a-uuid", "sess-0002-x"), "a device id that is not a uuid"], [ctx(D2, "short"), "a session id too short"],
      [ctx(D2, "sess<0002>"), "a session id with markup"], [{ sid: "sess-0002-abcd" }, "no device id"]]) {
    eq(await errMsg(rpc(null, "hs_track", { p_ctx: c, p_events: [{ n: "page_load" }] })), "ctx_invalid", "refused: " + what);
  }
  eq(await errMsg(as(null, "select public.hs_track($1::jsonb, '{}'::jsonb)", [JSON.stringify(ctx(D2, "sess-0002-abcd"))])), "ctx_invalid", "events that are not a list");
  eq(await errMsg(rpc(null, "hs_track", { p_ctx: ctx(D2, "sess-0002-abcd"), p_events: Array.from({ length: 51 }, (_, i) => ({ n: "page_load", q: i })) })), "batch_too_large", "a batch of 51 events");
  eq(await errMsg(rpc(null, "hs_track", { p_ctx: ctx(D2, "sess-0002-abcd"), p_events: Array.from({ length: 20 }, (_, i) => ({ n: "wave_end", q: i, p: { pad: "x".repeat(3500) } })) })),
    "batch_too_large", "a batch over 60 KB");
  eq((await rpc(null, "hs_track", { p_ctx: ctx(D2, "sess-0002-abcd"), p_events: [] })).accepted, 0, "an empty batch");
  r = await rpc(null, "hs_track", { p_ctx: ctx(D1, "sess-0001-abcd"), p_events: [
    { n: "defeat", q: 9, p: { lv: "erebuni", diff: 1, wave: 4, pad: "x".repeat(1500) } }, { n: "wave_end", q: 10, p: { pad: "x".repeat(5000) } },
    { n: "victory", q: 11, p: { lv: "erebuni", towers: { archer: 4, ballista: 3 }, speedS: { x1: 120 }, tray: ["a", "b"] } },
    { n: "victory", q: 12, p: { lv: "erebuni", deep: { a: { b: 1 } } } }, { n: "victory", q: 13, p: { lv: "erebuni", list: [{ a: 1 }] } }] });
  ok(r.accepted === 2 && r.dropped === 3, "1.5 KB kept, 5 KB not; one level of nesting kept, two levels not (RULINGS S8) (" + JSON.stringify(r) + ")");
  const facts = { lv: "stepanakert", diff: 2, mode: "campaign", ruleset: "2", rev: 1, loadout: "std", wave: 20, waves: 20, lives: 999999, lives_max: 999999,
    held: 999999, lives_board: 999999, stars: 3, sec: 999999, spent: 999999, earned: 999999, twist: null, through: "cavalry:3,spearman:2,raider:1,shield:4,archer:9,siege:2,tank:1", road: 0,
    legacy: false, resumed: 0, build: "2026-11-09", kitset: 1, ch: "republic", script: 20, beyond: 0, lost: 999999, returned: 999999, debt: 999999, cmdMet: 999999, cmdFelled: 999999,
    trickLost: { ambush: 999999, hidden: 999999, hunter: 999999, adapted: 999999 }, realS: 999999, speedS: { x1: 999999, x2: 999999, x4: 999999 }, idleS: 999999,
    left: 999999, refunds: 999999, from: { bounty: 999999, clear: 999999, interest: 999999, early: 999999, stores: 999999 },
    on: { build: 999999, rank: 999999, mastery: 999999, land: 999999, repair: 999999 }, towers: { archer: 999999, ballista: 999999, catapult: 999999, fire: 999999, drums: 999999, post: 999999 },
    masteries: 999999, built: 999999, sold: 999999, wrecks: 999999, plots: 999999, tray: "archer,ballista,catapult,fire,drums,post", ban: "",
    spells: { arrows: 999999, frost: 999999, wrath: 999999 }, calls: 999999, heroLevel: 999999, heroFalls: 999999, heroKills: 999999,
    council: { bows: 999999, engines: 999999, captains: 999999, heralds: 999999, stewards: 999999 }, power: 999999, early: 999999, auto: false, aided: false, tutorial: false };
  r = await rpc(null, "hs_track", { p_ctx: ctx(D1, "sess-0001-abcd"), p_events: [{ n: "victory", q: 14, p: facts }] });
  ok(r.accepted === 1, "gameplay's worst case of a battle's facts (" + JSON.stringify(facts).length + " characters) is kept");
  // an event sent again (the page's batch at closing, sent once more on the next load) is kept once
  r = await rpc(null, "hs_track", { p_ctx: ctx(D1, "sess-0001-abcd"), p_events: [{ n: "victory", q: 14, p: facts }, { n: "page_hide", q: 30, p: { where: "map" } }] });
  ok(r.accepted === 1 && r.dropped === 1, "an event sent again is kept once: the same visit and number (" + JSON.stringify(r) + ")");
  eq((await su("select count(*)::int n from public.hs_events where sid = 'sess-0001-abcd' and seq = 14"))[0].n, 1, "one row for it");
  eq((await su("select indexdef from pg_indexes where indexname = 'hs_events_once'"))[0].indexdef.replace(/\s+/g, " ").replace(/public\./g, ""),
    "CREATE UNIQUE INDEX hs_events_once ON hs_events USING btree (sid, seq) WHERE (seq > 0)", "each event of a visit once (events without a number are not held to it)");
  // the account joins the visit once signed in, and never another's
  await rpc(U.A, "hs_track", { p_ctx: ctx(D1, "sess-0001-abcd"), p_events: [{ n: "signed_in", q: 15, p: { provider: "google" } }] });
  eq((await su("select uid::text from public.hs_sessions where sid = 'sess-0001-abcd'"))[0].uid, U.A, "the visit takes the account once signed in");
  await rpc(U.B, "hs_track", { p_ctx: ctx(D1, "sess-0001-abcd"), p_events: [{ n: "page_load", q: 16 }] });
  eq((await su("select uid::text from public.hs_sessions where sid = 'sess-0001-abcd'"))[0].uid, U.A, "and keeps it when another account sends on it");
  ok(/permission denied/.test(await errMsg(as(U.A, "select count(*) from public.hs_events"))), "a player cannot read events");
  // limits count events, not calls
  const D3 = "33333333-3333-4333-8333-333333333333";
  let acc = 0; for (let i = 0; i < 18; i++) acc += (await rpc(null, "hs_track", { p_ctx: ctx(D3, "sess-0003-cap"), p_events: Array.from({ length: 50 }, (_, j) => ({ n: "tower_built", q: i * 50 + j })) })).accepted;
  r = await rpc(null, "hs_track", { p_ctx: ctx(D3, "sess-0003-cap"), p_events: [{ n: "tower_built", q: 9999 }] });
  ok(acc === 900 && r.accepted === 0, "one device id: 900 events an hour, then not one more (" + acc + ")");
  acc = 0; for (let i = 0; i < 30; i++) acc += (await rpc(U.D, "hs_track", { p_ctx: ctx(D3, "sess-0004-user"), p_events: Array.from({ length: 50 }, (_, j) => ({ n: "tower_built", q: i * 50 + j })) })).accepted;
  r = await rpc(U.D, "hs_track", { p_ctx: ctx(D3, "sess-0004-user"), p_events: [{ n: "tower_built", q: 9999 }] });
  ok(acc === 1500 && r.accepted === 0, "a signed-in player: his own 1,500 an hour, from the same device too (" + acc + ")");
  await su("update public.hs_config set value = '60' where key = 'ev_cap_hour'");
  await su("delete from public.hs_rate where bucket like 'evanon:%'");
  const D4 = "44444444-4444-4444-8444-444444444444", D5 = "55555555-5555-4555-8555-555555555555";
  eq((await rpc(null, "hs_track", { p_ctx: ctx(D4, "sess-0005-pool"), p_events: Array.from({ length: 50 }, (_, g) => ({ n: "page_load", q: g })) })).accepted, 50, "fifty events inside a pool of sixty");
  eq((await rpc(null, "hs_track", { p_ctx: ctx(D5, "sess-0006-pool"), p_events: Array.from({ length: 11 }, (_, g) => ({ n: "page_load", q: g })) })).accepted, 0, "eleven more would pass the pool: dropped");
  eq((await rpc(null, "hs_track", { p_ctx: ctx(D5, "sess-0006-pool"), p_events: Array.from({ length: 10 }, (_, g) => ({ n: "page_load", q: 20 + g })) })).accepted, 10,
    "a dropped batch is not charged to the pool: ten more fill it exactly");
  eq((await rpc(null, "hs_track", { p_ctx: ctx(D5, "sess-0006-pool"), p_events: [{ n: "page_load", q: 1 }] })).accepted, 0, "and a single one after that is dropped (the pool counts events)");
  const before = (await su("select count(*)::int n from public.hs_rate where bucket like 'ev:%'"))[0].n;
  for (let i = 0; i < 20; i++) await rpc(null, "hs_track", { p_ctx: ctx(crypto.randomUUID(), "sess-flood-" + i), p_events: [{ n: "page_load" }] });
  eq((await su("select count(*)::int n from public.hs_rate where bucket like 'ev:%'"))[0].n, before, "once the pool is dry, made-up device ids add no rate rows");
  eq((await su("select count(*)::int n from public.hs_sessions where sid like 'sess-flood-%'"))[0].n, 0, "nor visits");
  eq((await rpc(U.B, "hs_track", { p_ctx: ctx(D5, "sess-0007-user"), p_events: [{ n: "page_load", q: 1 }] })).accepted, 1, "a signed-in player is not starved by the visitors' pool");
  await su("update public.hs_config set value = '20000' where key = 'ev_cap_hour'");
  // one device id flooding past its own 900 does not drain the pool for every other visitor
  await su("update public.hs_config set value = '2000' where key = 'ev_cap_hour'");
  await su("delete from public.hs_rate where bucket like 'evanon:%' or bucket like 'ev:%'");
  const D6 = "66666666-6666-4666-8666-666666666666";
  acc = 0; for (let i = 0; i < 60; i++) acc += (await rpc(null, "hs_track", { p_ctx: ctx(D6, "sess-0008-flood"), p_events: Array.from({ length: 50 }, (_, j) => ({ n: "tower_built", q: i * 50 + j })) })).accepted;
  const pool = (await su("select n from public.hs_rate where bucket like 'evanon:%' and key = 'all'"))[0].n;
  ok(acc === 900 && pool === 900, "one device sends 3,000 events: 900 kept, and the pool is charged only those 900 (" + acc + ", pool " + pool + ")");
  eq((await rpc(null, "hs_track", { p_ctx: ctx(crypto.randomUUID(), "sess-0009-after"), p_events: [{ n: "page_load", q: 1 }] })).accepted, 1, "a new visitor after the flood is still counted");
  await su("update public.hs_config set value = '20000' where key = 'ev_cap_hour'");
});

group("stats", async () => {
  // a small made-up history four hundred days from now, so that nothing earlier is in its window
  const base = 400;
  const at = d => setClock((base + d) + " days");
  // (old visits leave by themselves, now and then, on any call: here today's would look 400 days old)
  await su("update public.hs_config set value = '5000' where key = 'ev_keep_days'");
  const ctx = (aid, sid, more) => ({ aid, sid, build: "b", ruleset: "2", channel: "live", dev: "phone", os: "ios", browser: "safari", ...more });
  const N1 = "a1000000-0000-4000-8000-000000000001", N2 = "a1000000-0000-4000-8000-000000000002",
    R1 = "a1000000-0000-4000-8000-000000000003", I1 = "a1000000-0000-4000-8000-000000000004", X1 = "a1000000-0000-4000-8000-000000000005";
  const U1 = "b1000000-0000-4000-8000-000000000001", U2 = "b1000000-0000-4000-8000-000000000002";
  await su("insert into auth.users (id, email) values ($1, 'u1@example.com'), ($2, 'u2@example.com')", [U1, U2]);
  await at(0);
  await rpc(U1, "hs_profile_set_name", { p_name: "Ani Player" });
  const ev = (n, q, p) => ({ n, q, p: p || {} });
  await rpc(null, "hs_track", { p_ctx: ctx(N1, "st-n1-visit1"), p_events: [ev("page_load", 1, { progress: 0 }), ev("gate_shown", 2, { state: "signin" }), ev("provider_tapped", 3, { provider: "google" })] });
  await rpc(U1, "hs_track", { p_ctx: ctx(N1, "st-n1-visit1"), p_events: [ev("signed_in", 4, { provider: "google", standalone: true }), ev("battle_start", 5, { lv: "erebuni" }), ev("tutorial_done", 6),
    ev("wave_end", 7, { lv: "erebuni" }), ev("victory", 8, { lv: "erebuni", diff: 1, mode: "campaign", lives: 17, lives_max: 20, wave: 10, waves: 10 })] });
  await rpc(null, "hs_track", { p_ctx: ctx(N2, "st-n2-visit1", { dev: "desktop", os: "windows", browser: "chrome" }), p_events: [ev("page_load", 1, { progress: 0 }), ev("gate_shown", 2, { state: "signin" })] });
  await rpc(null, "hs_track", { p_ctx: ctx(R1, "st-r1-visit1", { dev: "tablet" }), p_events: [ev("page_load", 1, { progress: 5 }), ev("gate_shown", 2, { state: "signin" }), ev("provider_tapped", 3, { provider: "discord" })] });
  await rpc(U2, "hs_track", { p_ctx: ctx(R1, "st-r1-visit1", { dev: "tablet" }), p_events: [ev("battle_start", 4, { lv: "tushpa" }),
    ev("defeat", 5, { lv: "tushpa", diff: 1, mode: "campaign", lives: 0, lives_max: 20, wave: 4, waves: 12 }),
    ev("battle_quit", 6, { lv: "tushpa", diff: 1, wave: 2 }), ev("battle_back", 7, { lv: "tushpa" }), ev("battle_quit", 8, { lv: "erebuni", diff: 0, wave: 3 })] });
  await rpc(null, "hs_track", { p_ctx: ctx(I1, "st-i1-visit1"), p_events: [ev("page_load", 1, { progress: 0 }), ev("gate_shown", 2, { state: "inapp" })] });
  await rpc(null, "hs_track", { p_ctx: ctx(X1, "st-x1-next", { channel: "next" }), p_events: [ev("page_load", 1, { progress: 0 })] });
  await rpc(null, "hs_track", { p_ctx: ctx(X1, "st-x1-smoke", { channel: "smoke" }), p_events: [ev("page_load", 1, { progress: 0 })] });
  await at(1);
  await rpc(null, "hs_track", { p_ctx: ctx(N1, "st-n1-visit2"), p_events: [ev("page_load", 1, { progress: 1 })] });
  await at(7);
  await rpc(null, "hs_track", { p_ctx: ctx(N2, "st-n2-visit2", { dev: "desktop", os: "windows" }), p_events: [ev("page_load", 1, { progress: 0 })] });
  await at(8);
  const s = await rpc(U.AD, "hs_stats", { p_days: 30 });
  const f = Object.fromEntries(s.funnel.map(x => [x.step, [x.n, x.new, x.returning, x.inapp]]));
  eq(f, { page_load: [4, 2, 1, 1], gate_shown: [4, 2, 1, 1], provider_tapped: [2, 1, 1, 0], signed_in: [2, 1, 1, 0], name_set: [1, 1, 0, 0],
    battle_start: [2, 1, 1, 0], tutorial_done: [1, 1, 0, 0], wave_end: [1, 1, 0, 0], victory: [1, 1, 0, 0] },
    "the funnel: each step for new devices, returning players and in-app arrivals apart; staging and smoke visits left out");
  eq(s.funnel.map(x => x.step), ["page_load", "gate_shown", "provider_tapped", "signed_in", "name_set", "battle_start", "tutorial_done", "wave_end", "victory"], "in the funnel's order");
  const ret = s.retention.find(x => x.new === 4);
  ok(ret && ret.d1 === 1 && ret.d7 === 1, "day 1 and day 7 returns of the devices first seen that day (" + JSON.stringify(s.retention) + ")");
  eq(s.quits.map(x => [x.lv, x.diff, x.wave, x.n]), [["erebuni", 0, 3, 1]], "quits: a battle left and come back to in the same visit is not a quit");
  const fl = Object.fromEntries(s.fields.map(x => [x.lv + ":" + x.diff, x]));
  ok(fl["erebuni:1"] && fl["erebuni:1"].ended === 1 && fl["erebuni:1"].wins === 1 && Number(fl["erebuni:1"].lives_avg) === 17 && Number(fl["erebuni:1"].lives_share) === 0.85,
    "per battlefield: win rate and defenders kept (" + JSON.stringify(fl["erebuni:1"]) + ")");
  ok(fl["tushpa:1"] && fl["tushpa:1"].ended === 1 && fl["tushpa:1"].wins === 0 && Number(fl["tushpa:1"].defeat_wave_avg) === 4 && fl["tushpa:1"].quits === 0,
    "and where the defeats came");
  ok(fl["erebuni:0"] && fl["erebuni:0"].quits === 1 && fl["erebuni:0"].ended === 0, "and the quits");
  const dv = Object.fromEntries(s.devices.map(x => [x.dev + "/" + x.os, x.people]));
  ok(dv["phone/ios"] === 3 && dv["desktop/windows"] === 1 && dv["tablet/ios"] === 1, "people by kind of device (" + JSON.stringify(dv) + ")");
  ok(s.gate.some(x => x.event === "provider_tapped" && x.provider === "discord" && x.n === 1), "the gate card counts what was tapped");
  ok(s.gate.some(x => x.event === "gate_shown" && x.why === "inapp" && x.n === 1), "and the arrivals in another app's browser");
  ok(s.gate.every(x => typeof x.standalone === "boolean"), "each of its rows says whether it is the Home Screen app's");
  ok(s.gate.some(x => x.event === "signed_in" && x.standalone === true && x.n === 1) && s.gate.some(x => x.event === "provider_tapped" && x.provider === "google" && x.standalone === false),
    "a sign-in in the Home Screen app on a line of its own (1.6)");
  ok(s.rulesets.some(x => x.ruleset === "2" && x.published === true), "the rulesets card says which are published");
  ok(typeof s.events_mb === "number" && s.config && "ev_cap_hour" in s.config, "the stats say how full the events are and show every switch");
  ok(s.totals && s.totals.accounts >= 1, "totals");
  const one = await rpc(U.AD, "hs_stats", { p_days: 30, p_cards: ["gate"] });
  ok(one.funnel.length === 0 && one.gate.length > 0, "one card can be asked for alone");
  // a stranger's events: markup where an id belongs, text where a number belongs
  const H = "a1000000-0000-4000-8000-0000000000ff";
  await rpc(null, "hs_track", { p_ctx: { aid: H, sid: "st-evil-0001", dev: "<b>x</b>", os: "<script>", vw: "wide", standalone: "maybe", ruleset: "<i>", channel: "live" },
    p_events: [{ n: "page_load", q: "first", t: "now", p: { progress: "lots" } },
      { n: "victory", q: 2, p: { lv: "<img src=x onerror=alert(1)>", diff: "x", lives: "many", lives_max: {}, mode: "<u>" } },
      { n: "gate_bypass", q: 3, p: { why: "<svg onload=alert(1)>" } }, { n: "provider_tapped", q: 4, p: { provider: "\"><script>" } },
      { n: "battle_quit", q: 5, p: { lv: "erebuni‮", diff: "1; drop table", wave: "1e9" } }] });
  const e = await err(rpc(U.AD, "hs_stats", { p_days: 30 }));
  ok(e === null, "with hostile events in the table the stats still answer (" + (e && e.msg) + ")");
  const s2 = await rpc(U.AD, "hs_stats", { p_days: 30 });
  ok(JSON.stringify(s2).indexOf("<") < 0, "and no stranger's markup reaches them");
  ok(JSON.stringify(s2).includes('"other"'), "it shows as \"other\"");
  ok(s2.funnel[0].n === 5, "the stranger counts once, as a device");
  await setClock("");
  await su("update public.hs_config set value = '180' where key = 'ev_keep_days'");
});

group("purge", async () => {
  const P = "c1000000-0000-4000-8000-000000000001";
  await su(`insert into public.hs_sessions (sid, aid, started_at, day) values ('old-0001-aaaa', $1, now() - interval '200 days', current_date - 200),
    ('old-0002-aaaa', $1, now() - interval '190 days', current_date - 190), ('new-0003-aaaa', $1, now() - interval '3 days', current_date - 3)`, [P]);
  await su(`insert into public.hs_events (sid, seq, name) values ('old-0001-aaaa', 1, 'page_load'), ('new-0003-aaaa', 1, 'page_load')`);
  const run = await runBegin(U.D, "campaign", "erebuni", 1, "2");
  await su("update public.hs_runs set started_at = now() - interval '31 days' where id = $1", [run.run_id]);
  const r = await rpc(U.AD, "hs_admin_purge_events", { p_days: 180 });
  ok(r.ok && r.sessions_removed === 2 && r.more === false, "the purge removes visits older than 180 days, and says there is no more");
  eq((await su("select count(*)::int n from public.hs_events where sid like 'old-%'"))[0].n, 0, "with their events");
  eq((await su("select count(*)::int n from public.hs_sessions where sid = 'new-0003-aaaa'"))[0].n, 1, "and keeps the recent ones");
  eq((await su("select count(*)::int n from public.hs_runs where id = $1", [run.run_id]))[0].n, 0, "a run begun over 30 days ago and never finished goes too");
  ok((await su("select count(*)::int n from public.hs_runs where finished_at is not null"))[0].n > 0, "finished runs stay");
  eq((await rpc(U.AD, "hs_admin_purge_events", { p_days: 1 })).sessions_removed >= 0, true, "a window under seven days is read as seven");
  ok((await su("select count(*)::int n from public.hs_sessions where sid = 'new-0003-aaaa'"))[0].n === 1, "so a visit of three days ago stays");
});

group("readonly", async () => {
  // PostgREST runs a function marked stable in a read-only transaction: each of the six must do without writing
  ok((await err(rpc(null, "hs_config", {}))) === null, "hs_config runs read-only for a visitor");
  ok((await err(rpc(null, "hs_board", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: "2" }))) === null, "hs_board read-only");
  ok((await err(rpc(null, "hs_daily_status", { p_ruleset: "2" }))) === null, "hs_daily_status read-only");
  ok((await err(rpc(U.B, "hs_profile_get", {}))) === null && (await err(rpc(U.B, "hs_save_get", {}))) === null, "a player's reads run read-only");
  ok((await err(rpc(U.AD, "hs_stats", { p_days: 7 }))) === null, "the stats run read-only");
  // and a function that writes fails in a read-only transaction, so the check above means something
  const e = await err(as(null, "select public.hs_track($1::jsonb, '[{\"n\":\"page_load\"}]'::jsonb)", [JSON.stringify({ aid: "d1000000-0000-4000-8000-000000000001", sid: "ro-0001-aaaa" })], { readOnly: true }));
  ok(e && e.code === "25006", "hs_track (which writes) fails in a read-only transaction (" + (e && e.code) + ")");
});

group("delete", async () => {
  const D1 = "11111111-1111-4111-8111-111111111111";
  // what A has by now: a profile, saves on both channels, runs, scores, board rows, visits that carried him and
  // the same device's visits before any sign-in, rate counters; and the sign-in service's log and identities
  await rpc(null, "hs_track", { p_ctx: { aid: D1, sid: "sess-pre-signin" }, p_events: [{ n: "page_load", q: 1 }] });
  await su(`insert into auth.audit_log_entries (payload, ip_address) values
    (json_build_object('actor_id', $1::text, 'actor_username', 'a@example.com', 'action', 'login'), '203.0.113.7'),
    (json_build_object('actor_id', $2::text, 'actor_username', 'b@example.com', 'action', 'login'), '203.0.113.8')`, [U.A, U.B]);
  await su(`insert into auth.identities (provider, provider_id, user_id, email) values ('google', 'g-a', $1, 'a@example.com'), ('google', 'g-b', $2, 'b@example.com')`, [U.A, U.B]);
  const has = async (u) => (await su(`select (select count(*) from public.hs_profiles where user_id = $1) + (select count(*) from public.hs_saves where user_id = $1)
    + (select count(*) from public.hs_runs where user_id = $1) + (select count(*) from public.hs_scores where user_id = $1)
    + (select count(*) from public.hs_score_best where user_id = $1) + (select count(*) from public.hs_sessions where uid = $1)
    + (select count(*) from auth.identities where user_id = $1) as n`, [u]))[0].n;
  ok(await has(U.A) > 8, "A has rows in every table before (" + await has(U.A) + ")");
  const bBefore = await has(U.B);
  eq((await rpc(U.A, "hs_delete_account", {})).ok, true, "A deletes his account");
  eq((await su("select count(*)::int n from auth.users where id = $1", [U.A]))[0].n, 0, "the account is gone from auth.users");
  eq(await has(U.A), 0, "and every row that was his: profile, saves, runs, scores, board rows, visits, identities");
  eq(await su("select sid, uid::text from public.hs_sessions where aid = $1", [D1]), [], "and his device's visits from before the sign-in");
  eq((await su("select count(*)::int n from public.hs_rate where key = $1", [U.A]))[0].n, 0, "and his rate counters");
  eq((await su("select payload->>'actor_username' u from auth.audit_log_entries")).map(x => x.u), ["b@example.com"], "and the sign-in service's log of him, not of anyone else");
  eq(await has(U.B), bBefore, "B is untouched");
  // the deleted account's access token still holds its signature for up to an hour: it is no longer signed in
  for (const [fn, args] of [["hs_profile_get", {}], ["hs_profile_set_name", { p_name: "Ghost" }], ["hs_save_get", {}], ["hs_save_put", { p_expected: 0, p_data: { v: 1 } }],
      ["hs_run_begin", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_ruleset: "2" }], ["hs_score_submit", { p_run: crypto.randomUUID(), p_stats: { won: true } }],
      ["hs_delete_account", {}]]) {
    eq(await errMsg(rpc(U.A, fn, args)), "not_signed_in", "a token of the deleted account: " + fn + " answers not_signed_in");
  }
  eq((await rpc(U.A, "hs_track", { p_ctx: { aid: "77777777-7777-4777-8777-777777777777", sid: "sess-ghost-0001" }, p_events: [{ n: "page_load", q: 1 }] })).accepted, 1,
    "its events are counted as a visitor's");
  eq(await has(U.A), 0, "and leave nothing that carries the deleted account");
  eq((await su("select count(*)::int n from public.hs_rate where key = $1", [U.A]))[0].n, 0, "not even a rate counter");
});

group("ceiling", async () => {
  // above ev_max_mb megabytes of events visitors' events are dropped; above one and a half times it, everyone's
  await su(`insert into public.hs_sessions (sid, aid) values ('fill-0001-aaaa', 'e1000000-0000-4000-8000-000000000001')`);
  await su(`insert into public.hs_events (sid, seq, name, props) select 'fill-0001-aaaa', g, 'pad', jsonb_build_object('p', repeat(md5(g::text), 40)) from generate_series(1, 1700) g`);
  const mb = (await su("select pg_total_relation_size('public.hs_events') / 1048576.0 as m"))[0].m;
  const cap = Math.max(1, Math.ceil(mb / 1.5));
  ok(mb > cap && mb <= cap * 1.5, "the table holds " + Number(mb).toFixed(2) + " MB for a ceiling of " + cap);
  await su("update public.hs_config set value = $1 where key = 'ev_max_mb'", [JSON.stringify(cap)]);
  const V = "e1000000-0000-4000-8000-000000000002";
  eq((await rpc(null, "hs_track", { p_ctx: { aid: V, sid: "ceil-0001-aaaa" }, p_events: [{ n: "page_load" }] })).accepted, 0, "over the ceiling a visitor's events are dropped");
  eq((await rpc(U.B, "hs_track", { p_ctx: { aid: V, sid: "ceil-0002-aaaa" }, p_events: [{ n: "page_load" }] })).accepted, 1, "a player's are still kept");
  await su("update public.hs_config set value = $1 where key = 'ev_max_mb'", [JSON.stringify(Math.max(0, Math.floor(mb / 2) - 1))]);
  eq((await rpc(U.B, "hs_track", { p_ctx: { aid: V, sid: "ceil-0002-aaaa" }, p_events: [{ n: "page_load" }] })).accepted, 0, "over one and a half times it, a player's too");
  await su("update public.hs_config set value = '1024' where key = 'ev_max_mb'");
});

group("handoff", async (ctx) => {
  if (!ctx.handoff) {
    ok((await su("select to_regprocedure('public.hs_handoff_put(text, text)') is null as x"))[0].x === true, "without its file the handoff does not exist");
    return;
  }
  const id = "h".repeat(40), code = "009e5066-fc11-4eca-8c8c-6fd82aa263f2";
  eq((await rpc(null, "hs_handoff_put", { p_id: id, p_code: code })).ok, true, "a visitor leaves a code");
  eq((await rpc(null, "hs_handoff_take", { p_id: id })).code, code, "the waiting window takes it");
  ok((await rpc(null, "hs_handoff_take", { p_id: id })).code === null, "once");
  for (const [i, c, what] of [["short", code, "an id too short"], [id, "<script>", "a code with markup"], ["x".repeat(65), code, "an id too long"]]) {
    eq(await errMsg(rpc(null, "hs_handoff_put", { p_id: i, p_code: c })), "handoff_invalid", "refused: " + what);
  }
  const id2 = "i".repeat(40);
  for (let i = 0; i < 3; i++) await rpc(null, "hs_handoff_put", { p_id: id2, p_code: code });
  eq(await errMsg(rpc(null, "hs_handoff_put", { p_id: id2, p_code: code })), "rate_limited", "one id takes three puts, not four");
  const id3 = "j".repeat(40);
  await rpc(null, "hs_handoff_put", { p_id: id3, p_code: code });
  await setClock("6 minutes");
  ok((await rpc(null, "hs_handoff_take", { p_id: id3 })).code === null, "a code older than five minutes is not handed over");
  await setClock("");
  ok(/permission denied/.test(await errMsg(as(null, "select * from public.hs_handoff"))), "nobody reads the table");
});

// ------------------------------------------------------------------ run
async function suite(db, name, handoff) {
  const warnings = [];
  await db.createDatabase(name, { schema: true, schemaTwice: true, handoff, onNotice: m => { if (m.severity === "WARNING") warnings.push(m.message); } });
  admin = await db.client(name, "supabase_admin");
  api = await db.client(name, "authenticator");
  api2 = await db.client(name, "authenticator");
  clock = "";
  for (const [k, id] of Object.entries(U)) await admin.query("insert into auth.users (id, email) values ($1, $2)", [id, k.toLowerCase() + "@example.com"]);
  await admin.query("insert into public.hs_admins (user_id) values ($1)", [U.AD]);
  const ctx = { handoff, warnings };
  for (const g of GROUPS) {
    if (ONLY.length && !ONLY.includes(g.name)) continue;
    groupName = g.name + (handoff ? "+handoff" : ""); groupCount = 0; groupFail = 0;
    const t0 = Date.now();
    try { await g.fn(ctx); } catch (e) {
      failed++; total++; groupFail++; console.log("FAIL [" + groupName + "] stopped: " + (e.detail ? "(" + e.detail + ") " : "") + (e.stack || e.message));
      for (const c of [admin, api, api2]) await c.query("rollback").catch(() => {});
    }
    await setClock("");
    console.log((groupFail ? "FAIL " : "ok   ") + groupName.padEnd(18) + String(groupCount).padStart(4) + " assertions" + (groupFail ? ", " + groupFail + " failed" : "") + "  (" + (Date.now() - t0) + " ms)");
  }
  await admin.end(); await api.end(); await api2.end();
}

(async () => {
  const t0 = Date.now();
  let db;
  try {
    db = await pgtemp.start({ name: "sqltests" });
    const v = await (async () => { const c = await db.client("postgres"); const r = await c.query("show server_version"); await c.end(); return r.rows[0].server_version; })();
    console.log("PostgreSQL " + v + " at " + db.dir + " (thrown away at the end)");
    console.log("-- schema.sql loaded twice into a fresh database");
    await suite(db, "hs_main", false);
    if (!ONLY.length || ONLY.includes("handoff") || ONLY.includes("structure")) {
      console.log("-- again with schema-handoff.sql loaded beside it");
      const keep = GROUPS.slice();
      GROUPS.length = 0; GROUPS.push(...keep.filter(g => ["structure", "handoff"].includes(g.name)));
      await suite(db, "hs_handoff", true);
    }
  } catch (e) {
    failed++; console.log("FAIL the suite could not run: " + (e.stack || e.message));
    if (db) console.log(db.log().split("\n").slice(-20).join("\n"));
  } finally {
    if (db && !ARGS.includes("--keep")) await db.stop();
  }
  console.log("RESULT sql-tests: " + total + " assertions, " + failed + " failed (" + Math.round((Date.now() - t0) / 1000) + " s)");
  process.exit(failed ? 1 : 0);
})();
