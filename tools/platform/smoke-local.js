#!/usr/bin/env node
// smoke.js run against the local stack as its target, then against three broken versions of it, to show that each
// check can fail (docs/specs/platform.final.md 10.6; work package P1's acceptance).
//
//   node tools/platform/smoke-local.js
//
// 1. The stack as the owner's server should be: every check passes but 12 and 13, which only the real Supabase can
//    answer (the gateway's own port and the certificate of the owner's https name).
// 2. The same stack with email auto-confirm on and served whole (no narrow proxy): checks 3 and 11 must fail, and
//    11 must name Auth's signup, otp, recover, magiclink, password sign-in and a write to the user.
// 3. A key that says it is Supabase's demo key (made here with an unsigned payload: the real demo key is not
//    copied into the repository): check 1 must fail.
// 4. A key whose role is service_role: check 1 must fail and say never to hand it over.
// RESULT line; exit 0 only when each run ended as expected.
"use strict";
const path = require("path");
const stackLib = require("./stack");

const SMOKE = path.join(__dirname, "smoke.js");
const fakeKey = (payload) => Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." +
  Buffer.from(JSON.stringify(payload)).toString("base64url") + ".not-signed";
function smoke(url, key) {
  // run in its own process, as the owner's builder runs it, so a hang cannot hide behind this script
  return new Promise((resolve) => {
    const { spawn } = require("child_process");
    const p = spawn(process.execPath, [SMOKE, url, key], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", d => { out += d; }); p.stderr.on("data", d => { out += d; });
    p.on("close", (code) => resolve({ code, out }));
  });
}
const failedChecks = (out) => [...out.matchAll(/^FAIL +(\d+)\./gm)].map(m => Number(m[1]));

(async () => {
  let bad = 0;
  const stack = await stackLib.start({});
  try {
    console.log("== 1. the local stack, narrow as the guide's public name");
    let r = await smoke(stack.url, stack.anonKey);
    process.stdout.write(r.out);
    if (r.code !== 0 || failedChecks(r.out).length) { bad++; console.log("UNEXPECTED: the healthy stack failed a check"); }
    const local = (r.out.match(/^ONLY ON THE REAL SUPABASE +(\d+)\./gm) || []).length;
    if (local !== 2) { bad++; console.log("UNEXPECTED: " + local + " checks left to the real Supabase, wanted 2 (12 and 13)"); }

    console.log("\n== 2. email auto-confirm on, and the whole API served (no narrow proxy)");
    await stack.control("settings", { mailer_autoconfirm: true });
    await stack.control("narrow", { on: false });
    r = await smoke(stack.url, stack.anonKey);
    process.stdout.write(r.out.split("\n").filter(l => /^(FAIL|RESULT|        what)/.test(l)).join("\n") + "\n");
    if (JSON.stringify(failedChecks(r.out)) !== "[3,11]" || r.code !== 1) { bad++; console.log("UNEXPECTED: wanted checks 3 and 11 to fail, got " + JSON.stringify(failedChecks(r.out))); }
    // Auth's routes that make accounts or send mail are among what check 11 names (the stand-in answers them as
    // an open Supabase Auth would)
    for (const p of ["POST /auth/v1/signup", "POST /auth/v1/otp", "POST /auth/v1/recover", "POST /auth/v1/magiclink", "POST /auth/v1/token?grant_type=password", "PUT /auth/v1/user"]) {
      if (!r.out.includes(p + " -> 200")) { bad++; console.log("UNEXPECTED: check 11 did not name " + p); }
    }
    await stack.control("settings", { mailer_autoconfirm: false });
    await stack.control("narrow", { on: true });

    console.log("\n== 3. a key that says it is Supabase's demo key");
    r = await smoke(stack.url, fakeKey({ iss: "supabase-demo", role: "anon", exp: 1983812996 }));
    process.stdout.write(r.out.split("\n").filter(l => /^(FAIL +1\.|        what)/.test(l)).slice(0, 2).join("\n") + "\n");
    if (!failedChecks(r.out).includes(1)) { bad++; console.log("UNEXPECTED: check 1 passed a demo key"); }

    console.log("\n== 4. a service role key");
    r = await smoke(stack.url, fakeKey({ iss: "supabase", role: "service_role" }));
    process.stdout.write(r.out.split("\n").filter(l => /^(FAIL +1\.|        what)/.test(l)).slice(0, 2).join("\n") + "\n");
    if (!failedChecks(r.out).includes(1) || !/SERVICE ROLE/.test(r.out)) { bad++; console.log("UNEXPECTED: check 1 passed a service key"); }
  } finally { await stack.stop(); }
  console.log("\nRESULT smoke-local: " + (bad ? bad + " runs did not end as expected" : "all four runs ended as expected"));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log("FAIL " + (e.stack || e.message)); process.exit(1); });
