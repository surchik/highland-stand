#!/usr/bin/env node
// Checks that a throwaway database never outlives its test (pgtemp.js): a test that ends without calling stop(),
// one stopped by SIGTERM or SIGINT, and one killed outright (SIGKILL, which no handler can see) whose folder and
// running server the next start() sweeps away. A folder whose owner still runs is left alone.
//
//   node tools/platform/pgtemp-check.js
//
// RESULT line; exit 0 only when every case ended as it should. Needs PostgreSQL 16 (see pgtemp.js).
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const pgtemp = require("./pgtemp");

let fails = 0, oks = 0;
const ok = (c, what) => { if (c) { oks++; console.log("ok   " + what); } else { fails++; console.log("FAIL " + what); } };
// a process that has ended but not yet been reaped by its parent (a zombie, state Z) counts as gone
const alive = (pid) => {
  if (!(pid > 0)) return false;
  try { process.kill(pid, 0); } catch (e) { if (e.code !== "EPERM") return false; }
  try { return !/^\d+ \(.*\) Z/.test(fs.readFileSync("/proc/" + pid + "/stat", "utf8")); } catch (e) { return !fs.existsSync("/proc"); }
};
// poll for up to 3 s: a server stopped a moment ago may take that long to be reaped
async function gone(pid) { for (let i = 0; i < 30 && alive(pid); i++) await sleep(100); return !alive(pid); }
const serverPid = (dir) => { try { return parseInt(fs.readFileSync(path.join(dir, "data", "postmaster.pid"), "utf8"), 10); } catch (e) { return 0; } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// a child that starts a database, says where, and then does as told: "end" (exit without stop), or "wait"
function child(how) {
  const code = "const p = require(" + JSON.stringify(path.join(__dirname, "pgtemp")) + ");" +
    "p.start({ name: 'pgcheck' }).then(db => { console.log('DIR ' + db.dir); " +
    (how === "end" ? "process.exit(0);" : "setInterval(() => {}, 1000);") + " }).catch(e => { console.log('ERR ' + e.message); process.exit(3); });";
  const p = spawn(process.execPath, ["-e", code], { stdio: ["ignore", "pipe", "inherit"] });
  return new Promise((resolve) => {
    let out = "";
    p.stdout.on("data", d => { out += d; const m = /DIR (\S+)/.exec(out); if (m) resolve({ p, dir: m[1] }); });
    p.on("close", () => { if (!/DIR /.test(out)) resolve({ p, dir: null, out }); });
  });
}
const closed = (p) => new Promise(r => { if (p.exitCode !== null || p.signalCode !== null) r(); else p.on("close", r); });

(async () => {
  // 1. the test ends without stop()
  let c = await child("end");
  await closed(c.p);
  ok(c.dir && !fs.existsSync(c.dir), "a test that ends without stop(): its folder is gone");
  // 2 and 3. SIGTERM, SIGINT
  for (const sig of ["SIGTERM", "SIGINT"]) {
    c = await child("wait");
    const spid = serverPid(c.dir);
    c.p.kill(sig); await closed(c.p);
    ok(c.dir && !fs.existsSync(c.dir) && spid > 0 && await gone(spid), "a test stopped by " + sig + ": its folder is gone and its server stopped");
  }
  // 4. SIGKILL: left behind, then swept by the next start(); a folder whose owner runs is left alone
  const keep = await child("wait");
  c = await child("wait");
  const spid = serverPid(c.dir);
  c.p.kill("SIGKILL"); await closed(c.p);
  ok(fs.existsSync(c.dir) && alive(spid), "a test killed outright (SIGKILL) leaves its folder and its server (no handler can run)");
  const db = await pgtemp.start({ name: "pgcheck-sweeper" });
  ok(!fs.existsSync(c.dir) && await gone(spid), "the next start() sweeps that folder and stops its server");
  ok(fs.existsSync(keep.dir) && alive(serverPid(keep.dir)), "and leaves alone the folder of a test that still runs");
  await db.stop();
  ok(!fs.existsSync(db.dir), "stop() removes its own folder");
  keep.p.kill("SIGTERM"); await closed(keep.p);
  console.log("RESULT pgtemp-check: " + oks + " passed, " + fails + " failed");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("FAIL " + (e.stack || e.message)); process.exit(1); });
