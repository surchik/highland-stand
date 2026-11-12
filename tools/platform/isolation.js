#!/usr/bin/env node
// The tenants' walls, tried over HTTP through the stack's stand-in for PostgREST with real signed tokens, as the
// shared server will be reached (RULINGS S9, S10): the whole REST API served, the schema highland named in
// Accept-Profile and Content-Profile.
//
//   node tools/platform/isolation.js                              a fresh stack: the migrations, then the fixture
//   node tools/platform/isolation.js --attach=HOST:PORT/DATABASE  a database already there (the restore rehearsal's
//                                                                 restored copy): tried as it is
//   options: --verbose
//
// Who: player A and player B (each made a player by the game's own name card, hs_profile_set_name), an outsider O
// who signed up through another app's open email sign-up (an account in the shared auth.users with an email
// identity and no profile), a visitor (the anon key alone), the admin, and service_role's claims (the service key).
// What is held: B can neither read nor write A's save, profile, runs or scores through any function; the outsider
// and the visitor are refused every player's function; everyone but the admin every admin function; every table and
// view of highland refused to anon, authenticated and service_role by GET, POST, PATCH and DELETE on
// /rest/v1/<table>; the helpers not callable; a call without the profile headers finds nothing (public is the
// default schema); a schema not served answers 406; the preflight lets the page's two headers through; and
// "Delete my account" leaves the shared auth.users alone.
// Prints a FAIL line per broken rule and "RESULT isolation: N checks, F failed". Exit 0 only when nothing failed.
"use strict";
const stackLib = require("./stack");

const ARGS = process.argv.slice(2);
const VERBOSE = ARGS.includes("--verbose");
const ATTACH = (ARGS.find(a => a.startsWith("--attach=")) || "").slice(9);

// the fixture's people (fixed ids, so a restored copy of a populated database has the same ones)
const P = {
  A: "1a000000-0000-4000-8000-00000000000a", B: "1b000000-0000-4000-8000-00000000000b",
  O: "1c000000-0000-4000-8000-00000000000c", AD: "1d000000-0000-4000-8000-0000000000ad",
};
const DEVICE = { A: "2a000000-0000-4000-8000-00000000000a", B: "2b000000-0000-4000-8000-00000000000b", O: "2c000000-0000-4000-8000-00000000000c", V: "2e000000-0000-4000-8000-00000000000e" };
const SCRIPT10 = [1, 2, 3, 5, 8, 10, 12, 15, 18, 20], SCRIPT12 = [1, 2, 3, 5, 8, 9, 10, 12, 14, 16, 18, 20];
const RULES = {
  v: 1, score: { win: 4000, lives: 3000, speed: 1500, thrift: 1500, lostMax: 3999 },
  levels: { erebuni: { waves: 10, rev: 1, script: SCRIPT10, d: [
    { lives: 30, min: 200, fast: 300, slow: 900, earnMax: 6000 }, { lives: 20, min: 200, fast: 300, slow: 900, earnMax: 5500 },
    { lives: 14, min: 200, fast: 300, slow: 900, earnMax: 5200 }] } },
  daily: { pool: ["erebuni"], twists: ["thin"], k: 1, j: 1, diff: 1, attempts: 3, waves: 12, t: { thin: { earn: 0.8 } },
    levels: { erebuni: { script: SCRIPT12, min: 150, fast: 200, slow: 700, earnMax: 4000 } } },
};
const RULESET = "iso-1";
const WIN = { won: true, lives: 18, waves: 10, sim_sec: 600, spent: 3000, earned: 4000, loadout: "std", build: "iso" };

let total = 0, failed = 0;
function ok(cond, what) {
  total++;
  if (cond !== true) { failed++; console.log("FAIL " + what); } else if (VERBOSE) console.log("  ok " + what);
}

// one HTTP call to the stack: { status, body }
function client(S) {
  const tokens = {};
  const now = () => Math.floor(Date.now() / 1000);
  const bearer = (who) => {
    if (!who) return S.anonKey;
    if (who === "service") return S.serviceKey;
    // as GoTrue signs a session begun with a provider (amr oauth); "A:password" is A's account signed in by password
    const [k, how] = who.split(":");
    if (!tokens[who]) tokens[who] = S.sign({ aud: "authenticated", sub: P[k], role: "authenticated", iat: now(), exp: now() + 3600, is_anonymous: false,
      amr: [{ method: how || "oauth", timestamp: now() }] });
    return tokens[who];
  };
  async function call(method, path, o = {}) {
    const headers = { apikey: o.who === "service" ? S.serviceKey : S.anonKey, Authorization: "Bearer " + bearer(o.who) };
    if (o.profile !== false) { headers["Accept-Profile"] = o.profile || "highland"; headers["Content-Profile"] = o.profile || "highland"; }
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    if (o.prefer) headers.Prefer = o.prefer;
    const r = await fetch(S.url + path, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
    const t = await r.text();
    let body = null;
    try { body = t ? JSON.parse(t) : null; } catch (e) { body = t; }
    return { status: r.status, body, code: body && typeof body === "object" ? body.code : undefined, message: body && typeof body === "object" ? body.message : undefined };
  }
  const rpc = (who, fn, args, o = {}) => call("POST", "/rest/v1/rpc/" + fn, { ...o, who, body: args || {} });
  return { call, rpc };
}

// the accounts in the (stand-in) shared auth schema: the game's players signed in with a provider, the outsider by
// email. Only auth rows: anything of highland is made through the game's own functions
async function ensureAccounts(S) {
  const c = await S.db.client(S.dbName || "hs", "supabase_admin");
  try {
    for (const [k, prov] of [["A", "google"], ["B", "discord"], ["AD", "facebook"], ["O", "email"]]) {
      await c.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now()) on conflict (id) do nothing", [P[k], "iso-" + k.toLowerCase() + "@example.com"]);
      await c.query("insert into auth.identities (provider, provider_id, user_id, email) values ($1, $2, $3, $4) on conflict do nothing",
        [prov, prov === "email" ? P[k] : "iso-" + k, P[k], "iso-" + k.toLowerCase() + "@example.com"]);
    }
  } finally { await c.end(); }
}

// the game's data, made as the page makes it: names through the name card, saves, a ranked battle each, events
async function populate(S, api) {
  const c = await S.db.client(S.dbName || "hs", "supabase_admin");
  try {
    if ((await c.query("select count(*)::int n from highland.hs_profiles where user_id = $1", [P.A])).rows[0].n) return false;
    for (const [k, name] of [["A", "Aram Iso"], ["B", "Bagrat Iso"], ["AD", "Owner Iso"]]) {
      const r = await api.rpc(k, "hs_profile_set_name", { p_name: name, p_aid: DEVICE[k] || null });
      if (r.status !== 200) throw new Error("the fixture's name for " + k + ": " + JSON.stringify(r.body));
    }
    // the admin row is the owner's one line of SQL (the guide's step); the ruleset is published from the stats page
    await c.query("insert into highland.hs_admins (user_id, note) values ($1, 'the fixture') on conflict do nothing", [P.AD]);
    const pub = await api.rpc("AD", "hs_admin_publish_ruleset", { p_id: RULESET, p_data: RULES });
    if (pub.status !== 200) throw new Error("publish: " + JSON.stringify(pub.body));
    for (const k of ["A", "B"]) {
      const sv = await api.rpc(k, "hs_save_put", { p_expected: 0, p_data: { owner: k, secret: k + "-secret-save" }, p_device: "iso-" + k });
      if (!(sv.body && sv.body.ok)) throw new Error("save " + k + ": " + JSON.stringify(sv.body));
      const b = await api.rpc(k, "hs_run_begin", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_ruleset: RULESET });
      if (!(b.body && b.body.ok)) throw new Error("run " + k + ": " + JSON.stringify(b.body));
      await c.query("update highland.hs_runs set started_at = started_at - interval '40 minutes' where id = $1", [b.body.run_id]);
      const sc = await api.rpc(k, "hs_score_submit", { p_run: b.body.run_id, p_stats: { ...WIN, lives: k === "A" ? 18 : 15 } });
      if (!(sc.body && sc.body.accepted)) throw new Error("score " + k + ": " + JSON.stringify(sc.body));
      // a battle begun and not finished, for the cross-tenant check
      await api.rpc(k, "hs_run_begin", { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_ruleset: RULESET });
      await api.rpc(k, "hs_track", { p_ctx: { aid: DEVICE[k], sid: "iso-" + k.toLowerCase() + "-0001" }, p_events: [{ n: "page_load", q: 1 }, { n: "signed_in", q: 2 }] });
    }
    await api.rpc(null, "hs_track", { p_ctx: { aid: DEVICE.V, sid: "iso-v-0001" }, p_events: [{ n: "page_load", q: 1 }] });
    return true;
  } finally { await c.end(); }
}

const TABLES = ["hs_profiles", "hs_saves", "hs_rulesets", "hs_runs", "hs_scores", "hs_score_best", "hs_sessions", "hs_events", "hs_admins",
  "hs_config", "hs_name_blocklist", "hs_rate", "schema_migrations"];
const VIEWS = ["_v_sessions", "_v_first_seen", "_v_game_sessions", "_v_game_first_seen", "_v_battles"];
const OPEN = { hs_config: {}, hs_track: { p_ctx: { aid: "2f000000-0000-4000-8000-00000000000f", sid: "iso-x-0001" }, p_events: [] },
  hs_board: { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_loadout: "std", p_ruleset: RULESET }, hs_daily_status: { p_ruleset: RULESET } };
const MEMBER = { hs_save_get: {}, hs_save_put: { p_expected: 0, p_data: { forged: true } }, hs_run_begin: { p_mode: "campaign", p_level: "erebuni", p_diff: 1, p_ruleset: RULESET },
  hs_score_submit: { p_run: "3f000000-0000-4000-8000-00000000000f", p_stats: WIN } };
const ADMIN = { hs_stats: { p_days: 7 }, hs_admin_publish_ruleset: { p_id: "iso-forged", p_data: RULES }, hs_admin_set_config: { p_key: "notice", p_value: "forged" },
  hs_admin_moderate: { p_user: P.A, p_hidden: true }, hs_admin_remove_score: { p_score: 1 }, hs_admin_purge_events: { p_days: 9999 } };
const HELPERS = ["_uid", "_member", "_is_admin", "_need_admin", "_now", "_uid_or_null", "_member_or_null", "_limit_hit"];

async function run(S) {
  const api = client(S);
  const su = await S.db.client(S.dbName || "hs", "supabase_admin");
  const q = async (sql, params) => (await su.query(sql, params)).rows;
  try {
    await ensureAccounts(S);
    const made = await populate(S, api);
    console.log(made ? "-- the fixture made through the game's own functions" : "-- the database already holds the fixture's players (a restored copy): tried as it is");
    let authBefore = await q("select id::text, email from auth.users order by id");

    // the profile headers
    const bare = await api.rpc(null, "hs_config", {}, { profile: false });
    ok(bare.status === 404 && bare.code === "PGRST202" && /public\.hs_config/.test(bare.message), "without Content-Profile the call looks in public and finds no hs_config (" + bare.status + " " + bare.code + ")");
    const wrong = await api.rpc(null, "hs_config", {}, { profile: "hs_private" });
    ok(wrong.status === 406 && wrong.code === "PGRST106", "a schema not in db-schemas answers 406 PGRST106 (" + wrong.status + ")");
    const right = await api.rpc(null, "hs_config", {});
    ok(right.status === 200 && typeof right.body.now === "string", "with Content-Profile: highland, hs_config answers");
    const pre = await fetch(S.url + "/rest/v1/rpc/hs_config", { method: "OPTIONS", headers: { origin: S.site, "access-control-request-method": "POST",
      "access-control-request-headers": "apikey,authorization,content-type,accept-profile,content-profile" } });
    const allow = String(pre.headers.get("access-control-allow-headers") || "").toLowerCase();
    ok(pre.status === 200 && /accept-profile/.test(allow) && /content-profile/.test(allow) && pre.headers.get("access-control-allow-origin") === S.site,
      "the preflight lets the page's origin and its Accept-Profile and Content-Profile through (" + allow + ")");

    // the sign-in's way back (the README's shared change b): SITE_URL is another app's, so the page's redirect_to must
    // be allowed by ADDITIONAL_REDIRECT_URLS or the player lands on that other app. The page sends its own address,
    // origin + path + ?hsh=... (and ?stats&hsh=... from the stats page), on / and on /next/
    const back = async (redirectTo) => {
      await S.control("provider", { who: "aram" });
      const a = await fetch(S.url + "/auth/v1/authorize?" + new URLSearchParams({ provider: "google", redirect_to: redirectTo, code_challenge: "x".repeat(43), code_challenge_method: "s256" }), { redirect: "manual" });
      const b = await fetch(a.headers.get("location"), { redirect: "manual" });
      const c = await fetch(b.headers.get("location"), { redirect: "manual" });
      return c.headers.get("location") || "";
    };
    const PAGE_BACKS = ["https://highland.avunjian.com/?hsh=abc", "https://highland.avunjian.com/next/?hsh=abc", "https://highland.avunjian.com/?stats&hsh=abc",
      "https://highland.avunjian.com/next/?stats&hsh=abc"];
    await S.control("redirects", { allow: ["https://other-app.example/**"] });
    ok((await back(PAGE_BACKS[1])).startsWith(S.site), "without the game's lines in the allow list, the sign-in returns to SITE_URL (another app), not the game");
    await S.control("redirects", { allow: ["https://other-app.example/**", "https://highland.avunjian.com/**", "https://highland.avunjian.com/next/**"] });
    const same = (got, want) => { try { const g = new URL(got), w = new URL(want); return g.origin + g.pathname === w.origin + w.pathname && g.searchParams.get("hsh") === "abc"
      && !!g.searchParams.get("code") && (!w.searchParams.has("stats") || g.searchParams.has("stats")); } catch (e) { return false; } };
    for (const r of PAGE_BACKS) { const got = await back(r); ok(same(got, r), "with them, the sign-in returns to " + r + " with its code (" + got.replace(/code=[^&]*/, "code=...") + ")"); }
    await S.control("redirects", { allow: ["https://other-app.example/**", "https://highland.avunjian.com/next/**"] });
    ok(!same(await back(PAGE_BACKS[0]), PAGE_BACKS[0]) && same(await back(PAGE_BACKS[1]), PAGE_BACKS[1]), "(/next/** alone lets only the staging page back; /** covers both)");
    await S.control("redirects", { allow: [] });
    authBefore = await q("select id::text, email from auth.users order by id");

    // cross-tenant: B and A's data, through every function
    const aSave = await api.rpc("A", "hs_save_get", {});
    ok(aSave.status === 200 && aSave.body.data && aSave.body.data.secret === "A-secret-save", "A reads his own save");
    const bSave = await api.rpc("B", "hs_save_get", {});
    ok(bSave.status === 200 && !JSON.stringify(bSave.body).includes("A-secret"), "B's hs_save_get answers B's save, never A's");
    for (const ch of ["live", "next"]) {
      const r = await api.rpc("B", "hs_save_get", { p_channel: ch });
      ok(!JSON.stringify(r.body).includes("A-secret"), "nor on the " + ch + " channel");
    }
    const aBefore = await q("select version, data from highland.hs_saves where user_id = $1 order by channel", [P.A]);
    const bs = await api.rpc("B", "hs_save_put", { p_expected: bSave.body.version, p_data: { owner: "B", secret: "B-secret-save", note: "B writes" } });
    ok(bs.status === 200 && bs.body.ok === true, "B writes his own save");
    ok(JSON.stringify(await q("select version, data from highland.hs_saves where user_id = $1 order by channel", [P.A])) === JSON.stringify(aBefore), "and A's is untouched");
    ok((await api.rpc("B", "hs_save_put", { p_expected: 0, p_data: { owner: "A" }, user_id: P.A })).status === 404, "no function takes another player's id: hs_save_put with a user_id is not found (404)");
    const pa = await api.rpc("B", "hs_profile_get", {});
    ok(pa.status === 200 && pa.body.user_id === P.B && pa.body.name === "Bagrat Iso", "hs_profile_get answers B's own profile");
    const aRun = (await q("select id from highland.hs_runs where user_id = $1 and finished_at is null limit 1", [P.A]))[0];
    ok(!!aRun, "A has a battle begun");
    const steal = await api.rpc("B", "hs_score_submit", { p_run: aRun.id, p_stats: WIN });
    ok(steal.status === 400 && steal.message === "run_unknown", "B posting a result on A's battle: run_unknown (" + steal.status + " " + steal.message + ")");
    ok((await q("select finished_at from highland.hs_runs where id = $1", [aRun.id]))[0].finished_at === null, "and A's battle is still open");
    const board = await api.rpc("B", "hs_board", OPEN.hs_board);
    ok(board.status === 200 && board.body.rows.length >= 2 && board.body.rows.every(r => !("uid" in r) && !("id" in r)), "B's board shows names and numbers, no user id or score id (" + (board.body.rows || []).length + " rows)");
    ok(board.body.rows.filter(r => r.me).every(r => r.name === "Bagrat Iso"), "and only B's own row is marked his");
    const nm = await api.rpc("B", "hs_profile_set_name", { p_name: "Aram Iso" });
    ok(nm.status === 400 && nm.message === "name_taken", "B cannot take A's name (" + nm.message + ")");
    const del = await api.rpc("B", "hs_admin_moderate", ADMIN.hs_admin_moderate);
    ok(del.status === 403 && del.message === "not_admin", "B cannot hide A (not_admin)");

    // the outsider (an account of another app's email sign-up), the visitor, service_role: every player's function
    for (const fn of Object.keys(MEMBER)) {
      const o = await api.rpc("O", fn, MEMBER[fn]);
      ok(o.status === 403 && o.code === "42501" && o.message === "no_profile", "the outsider is refused " + fn + ": 403 no_profile (" + o.status + " " + o.message + ")");
      const v = await api.rpc(null, fn, MEMBER[fn]);
      ok(v.status === 401 && v.code === "42501", "the visitor is refused " + fn + ": 401 (" + v.status + " " + v.message + ")");
      const s = await api.rpc("service", fn, MEMBER[fn]);
      ok(s.status === 403 && s.code === "42501", "service_role is refused " + fn + " (" + s.status + " " + s.message + ")");
    }
    for (const fn of Object.keys(MEMBER)) {
      const pw = await api.rpc("A:password", fn, MEMBER[fn]);
      ok(pw.status === 403 && pw.message === "not_game_session", "A's account in a password session (the shared email sign-in) is refused " + fn + " (" + pw.status + " " + pw.message + ")");
    }
    const pwa = await api.rpc("AD:password", "hs_stats", ADMIN.hs_stats);
    ok(pwa.status === 403 && pwa.message === "not_admin", "the admin's account in a password session is refused the stats");
    const on = await api.rpc("O", "hs_profile_set_name", { p_name: "Outsider Iso" });
    ok(on.status === 403 && on.message === "not_game_account", "the outsider cannot make himself a player (not_game_account, " + on.status + ")");
    const op = await api.rpc("O", "hs_profile_get", {});
    ok(op.status === 200 && op.body.name === null && op.body.admin === false, "the outsider's profile: none");
    for (const fn of ["hs_delete_account"]) {
      const v = await api.rpc(null, fn, {});
      ok(v.status === 401, "the visitor is refused " + fn);
    }
    // the admin's functions: refused to everyone but the admin
    for (const fn of Object.keys(ADMIN)) {
      for (const who of ["A", "B", "O"]) {
        const r = await api.rpc(who, fn, ADMIN[fn]);
        ok(r.status === 403 && r.message === "not_admin", who + " is refused " + fn + ": not_admin (" + r.status + " " + r.message + ")");
      }
      ok((await api.rpc(null, fn, ADMIN[fn])).status === 401, "the visitor is refused " + fn);
      ok((await api.rpc("service", fn, ADMIN[fn])).status === 403, "service_role is refused " + fn);
    }
    ok((await api.rpc("AD", "hs_stats", ADMIN.hs_stats)).status === 200, "the admin reads the stats");
    ok((await q("select hidden from highland.hs_profiles where user_id = $1", [P.A]))[0].hidden === false, "nobody hid A");
    ok((await q("select count(*)::int n from highland.hs_rulesets where id = 'iso-forged'"))[0].n === 0, "nobody published a forged ruleset");
    // the open functions: the outsider's answer is a visitor's
    for (const fn of ["hs_board", "hs_daily_status", "hs_config"]) {
      const a = await api.rpc("O", fn, OPEN[fn]), b = await api.rpc(null, fn, OPEN[fn]);
      const strip = (x) => JSON.stringify(x, (k, v) => (k === "now" || k === "ends_in" ? undefined : v));
      ok(a.status === 200 && strip(a.body) === strip(b.body), fn + ": the outsider gets what the visitor gets");
      ok((await api.rpc("service", fn, OPEN[fn])).status === 403, "service_role is refused even " + fn);
    }

    // the tables and views, every way, as each API role
    for (const [who, label, want] of [[null, "anon", 401], ["A", "authenticated", 403], ["service", "service_role", 403]]) {
      for (const t of TABLES.concat(VIEWS)) {
        const filt = { hs_sessions: "?uid=eq." + P.A, hs_rulesets: "?id=eq." + RULESET, hs_events: "?seq=eq.1", hs_config: "?key=eq.ev_cap_hour",
          hs_name_blocklist: "?pattern=eq.admin", hs_rate: "?key=eq." + P.A, schema_migrations: "?version=eq.1" }[t] || "?user_id=eq." + P.A;
        const g = await api.call("GET", "/rest/v1/" + t + "?select=*", { who });
        ok(g.status === want && g.code === "42501", label + ": GET /rest/v1/" + t + " refused " + want + " (" + g.status + " " + g.message + ")");
        if (VIEWS.includes(t)) continue;
        const ins = await api.call("POST", "/rest/v1/" + t, { who, body: t === "hs_admins" ? { user_id: P.B } : t === "hs_config" ? { key: "notice", value: { forged: true } } : {} });
        ok(ins.status === want && ins.code === "42501", label + ": POST /rest/v1/" + t + " refused (" + ins.status + " " + ins.message + ")");
        const col = { hs_profiles: "hidden", hs_saves: "device", hs_rulesets: "active", hs_runs: "twist", hs_scores: "build", hs_score_best: "lives", hs_sessions: "build", hs_events: "name",
          hs_admins: "note", hs_config: "value", hs_name_blocklist: "kind", hs_rate: "n", schema_migrations: "name" }[t];
        const val = { hs_profiles: true, hs_rulesets: false, hs_score_best: 1, hs_rate: 0, hs_config: { forged: true }, hs_name_blocklist: "exact" }[t] ?? "x";
        const pa = await api.call("PATCH", "/rest/v1/" + t + filt, { who, body: { [col]: val } });
        ok(pa.status === want && pa.code === "42501", label + ": PATCH /rest/v1/" + t + filt + " refused (" + pa.status + " " + pa.message + ")");
        const de = await api.call("DELETE", "/rest/v1/" + t + filt, { who });
        ok(de.status === want && de.code === "42501", label + ": DELETE /rest/v1/" + t + filt + " refused (" + de.status + " " + de.message + ")");
        const all = await api.call("DELETE", "/rest/v1/" + t, { who });
        ok(all.status >= 400 && all.status < 500, label + ": DELETE /rest/v1/" + t + " with no filter refused (" + all.status + " " + all.code + ")");
      }
    }
    // the helpers are not doors
    for (const h of HELPERS) {
      for (const [who, label] of [[null, "anon"], ["A", "authenticated"], ["service", "service_role"]]) {
        const r = await api.rpc(who, h, {});
        ok([401, 403].includes(r.status) && r.code === "42501", label + " cannot call the helper " + h + " (" + r.status + " " + r.message + ")");
      }
    }
    // and nothing of the game's sits where PostgREST looks by default
    for (const fn of ["hs_config", "hs_profile_get", "hs_save_get"]) ok((await api.rpc("A", fn, {}, { profile: "public" })).status === 404, "public has no " + fn);
    ok((await api.call("GET", "/rest/v1/hs_saves", { who: "A", profile: "public" })).status === 404, "nor a table hs_saves");

    // "Delete my account" (RULINGS S10): B's game data goes, the shared account stays
    const bRows = async () => (await q(`select (select count(*) from highland.hs_profiles where user_id = $1) + (select count(*) from highland.hs_saves where user_id = $1)
      + (select count(*) from highland.hs_runs where user_id = $1) + (select count(*) from highland.hs_scores where user_id = $1)
      + (select count(*) from highland.hs_score_best where user_id = $1) + (select count(*) from highland.hs_sessions where uid = $1) as n`, [P.B]))[0].n;
    ok(await bRows() >= 5, "B has rows in highland before (" + await bRows() + ")");
    const aRowsBefore = (await q("select count(*)::int n from highland.hs_scores where user_id = $1", [P.A]))[0].n;
    const d = await api.rpc("B", "hs_delete_account", {});
    ok(d.status === 200 && d.body.ok === true, "B deletes his account");
    ok(await bRows() === 0, "every row of B's in highland is gone");
    ok(JSON.stringify(await q("select id::text, email from auth.users order by id")) === JSON.stringify(authBefore), "auth.users is exactly as it was: B's sign-in account, shared with the other apps, stays");
    ok((await q("select count(*)::int n from auth.identities where user_id = $1", [P.B]))[0].n >= 1, "and so do his identities");
    ok((await q("select count(*)::int n from highland.hs_scores where user_id = $1", [P.A]))[0].n === aRowsBefore, "A's scores are untouched");
    const after = await api.rpc("B", "hs_save_get", {});
    ok(after.status === 403 && after.message === "no_profile", "B's token now gets what an outsider gets (no_profile)");
  } finally { await su.end(); }
}

module.exports = { run, P, RULES, RULESET, ensureAccounts, populate, client };

if (require.main === module) {
  (async () => {
    const t0 = Date.now();
    let S;
    try {
      let attach;
      if (ATTACH) {
        const m = /^(.+):(\d+)\/([A-Za-z0-9_]+)$/.exec(ATTACH);
        if (!m) throw new Error("--attach=HOST:PORT/DATABASE (HOST may be a socket folder)");
        attach = { host: m[1], port: Number(m[2]), database: m[3] };
      }
      S = await stackLib.start({ attach });
      S.dbName = attach ? attach.database : "hs";
      console.log("-- the stack at " + S.url + ", serving " + S.schemas.join(",") + (S.db.safeupdate ? ", pg-safeupdate (the tests' stand-in) loaded for the API" : "") + (attach ? ", on " + ATTACH : ""));
      await run(S);
    } catch (e) {
      failed++; console.log("FAIL the isolation tests could not run: " + (e.stack || e.message));
    } finally { if (S) await S.stop(); }
    console.log("RESULT isolation: " + total + " checks, " + failed + " failed (" + Math.round((Date.now() - t0) / 1000) + " s)");
    process.exit(failed ? 1 : 0);
  })();
}
