#!/usr/bin/env node
// The throwaway PostgreSQL the restore rehearsal (deploy/supabase/restore-rehearsal.sh) works on, kept running until
// this process is told to stop (SIGTERM, SIGINT, or its stdin closing). It makes three databases with Supabase's
// stand-ins (standins.sql, and pg-safeupdate's test stand-in for the API's sessions where it is built):
//   hs_src      the migrations and the isolation tests' fixture, made through the game's own functions (a
//               populated database to back up); left out with --no-source (a dump made elsewhere is restored)
//   hs_scratch  the stand-ins only: what a fresh database to restore into looks like
//   hs_raw      the same, for a second restore that is left as the restore leaves it (no regrant), to show the
//               isolation tests catch what the restore widened
// Then prints one line:  READY <socket folder> <port>  and waits. Nothing listens on the network.
"use strict";
const pgtemp = require("./pgtemp");
const stackLib = require("./stack");
const iso = require("./isolation");

(async () => {
  const db = await pgtemp.start({ name: "rehearsal" });
  const stop = async (code) => { await db.stop(); process.exit(code); };
  process.on("SIGTERM", () => stop(0)); process.on("SIGINT", () => stop(0));
  try {
    if (!process.argv.includes("--no-source")) {
      await db.createDatabase("hs_src", { schema: true, clock: false });
      const S = await stackLib.start({ attach: { host: db.dir, port: db.port, database: "hs_src" } });
      S.dbName = "hs_src";
      try {
        await iso.ensureAccounts(S);
        await iso.populate(S, iso.client(S));
      } finally { await S.stop(); }
    }
    await db.createDatabase("hs_scratch", {});
    await db.createDatabase("hs_raw", {});
    console.log("READY " + db.dir + " " + db.port + (db.safeupdate ? " safeupdate" : ""));
  } catch (e) {
    console.error("the rehearsal's cluster could not be made: " + (e.stack || e.message));
    return stop(1);
  }
  process.stdin.resume();
  process.stdin.on("end", () => stop(0));
  process.stdin.on("close", () => stop(0));
})();
