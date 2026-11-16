#!/usr/bin/env node
// Tries the owner's deletion by hand (docs/specs/owner/p8-privacy-checklist.md, section 3: the psql block for a person
// who cannot sign in any more) on the local stack: two players, each with a visit from before the sign-in on his own
// device; the block run by psql as the migrating role with the first one's email in another letter case. Holds that
// every row of his in highland goes, his device's earlier visit too, and nothing of the other player's or of auth.users.
//   node tools/platform/owner-delete-check.js      prints PASS or FAIL and exits 0 or 1
"use strict";
const path = require("path"), fs = require("fs"), { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");
const stackLib = require(ROOT + "/tools/platform/stack.js");
(async () => {
  const S = await stackLib.start({});
  const fails = [];
  try {
    const A = "aa000000-0000-4000-8000-0000000000aa", B = "bb000000-0000-4000-8000-0000000000bb";
    // the two accounts, as the sign-in service would have them (written by the test's superuser connection)
    const pg = require(ROOT + "/tools/platform/node_modules/pg");
    const su = new pg.Client({ host: S.db.dir, port: S.db.port, user: "supabase_admin", database: "hs" });
    await su.connect();
    const q = async (sql, p) => (await su.query(sql, p)).rows;
    await q("insert into auth.users (id, email) values ($1, 'a.person@example.com'), ($2, 'b.person@example.com')", [A, B]);
    await q("insert into auth.identities (provider, provider_id, user_id, email) values ('google', 'g-a', $1, 'a.person@example.com'), ('google', 'g-b', $2, 'b.person@example.com')", [A, B]);
    const call = async (who, fn, body) => {
      const tok = S.sign({ sub: who, role: "authenticated", aud: "authenticated", amr: [{ method: "oauth", timestamp: 1700000000 }], exp: Math.floor(Date.now() / 1000) + 600 });
      const r = await fetch(S.url + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: S.anonKey, Authorization: "Bearer " + tok, "Content-Type": "application/json", "Content-Profile": "highland", "Accept-Profile": "highland" }, body: JSON.stringify(body) });
      return [r.status, await r.json().catch(() => null)];
    };
    for (const [u, n, d] of [[A, "Anna Try", "11111111-aaaa-4aaa-8aaa-111111111111"], [B, "Bert Try", "22222222-bbbb-4bbb-8bbb-222222222222"]]) {
      console.log(n, JSON.stringify(await call(u, "hs_profile_set_name", { p_name: n })));
      console.log(n, JSON.stringify(await call(u, "hs_save_put", { p_expected: 0, p_data: { v: 1, keys: {} }, p_device: "iPhone", p_channel: "live" })));
      // a visit before the sign-in, then the signed-in visit, on the same device
      await fetch(S.url + "/rest/v1/rpc/hs_track", { method: "POST", headers: { apikey: S.anonKey, Authorization: "Bearer " + S.anonKey, "Content-Type": "application/json", "Content-Profile": "highland" }, body: JSON.stringify({ p_ctx: { aid: d, sid: "pre-" + n.slice(0, 4) + "-0001" }, p_events: [{ n: "page_load", q: 1 }] }) });
      console.log(n, JSON.stringify(await call(u, "hs_track", { p_ctx: { aid: d, sid: "in-" + n.slice(0, 4) + "-00001" }, p_events: [{ n: "page_load", q: 1 }] })));
    }
    const count = async (u) => (await q(`select (select count(*) from highland.hs_profiles where user_id = $1) + (select count(*) from highland.hs_saves where user_id = $1)
      + (select count(*) from highland.hs_sessions where uid = $1) + (select count(*) from highland.hs_rate where key = $1::text) as n`, [u]))[0].n;
    const pre = async (n) => (await q("select count(*)::int n from highland.hs_sessions where sid = $1", ["pre-" + n + "-0001"]))[0].n;
    console.log("before: A", await count(A), "B", await count(B), "A's pre visit", await pre("Anna"));
    // the block, as the checklist writes it, run by psql from a file with the email set
    const md = fs.readFileSync(ROOT + "/docs/specs/owner/p8-privacy-checklist.md", "utf8");
    const block = md.split("\\set email")[1].split("```")[0];
    const file = path.join(require("os").tmpdir(), "hs-owner-delete-" + process.pid + ".sql");
    fs.writeFileSync(file, "\\set email 'A.Person@example.com'" + block.slice(block.indexOf("\n")));
    console.log(execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-h", S.db.dir, "-p", String(S.db.port), "-U", "postgres", "-d", "hs", "-f", file], { encoding: "utf8" }));
    const a = await count(A), b = await count(B);
    console.log("after: A", a, "B", b, "A's pre visit", await pre("Anna"), "B's pre visit", await pre("Bert"));
    const au = (await q("select count(*)::int n from auth.users"))[0].n;
    if (a !== "0" && a !== 0) fails.push("A still has rows: " + a);
    if (Number(b) < 3) fails.push("B lost rows: " + b);
    if (au !== 2) fails.push("auth.users changed: " + au);
    if (await pre("Anna")) fails.push("A's visit before the sign-in is left");
    if (!(await pre("Bert"))) fails.push("B's visit before the sign-in went");
    await su.end();
  } catch (e) { fails.push(e.stack || String(e)); }
  try { fs.rmSync(path.join(require("os").tmpdir(), "hs-owner-delete-" + process.pid + ".sql"), { force: true }); } catch (e) {}
  await S.stop();
  console.log(fails.length ? "FAIL\n" + fails.join("\n") : "PASS the checklist's deletion block");
  process.exit(fails.length ? 1 : 0);
})();
