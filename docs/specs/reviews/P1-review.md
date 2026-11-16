# Review of P1: the stack and the schema, the staging channel and the owner's guide

Reviewed: commit 24ca794 on `pf/work` (one commit on 04fb968, `p0-done`), by a reviewer who did not build it.
Every claim of the build report was rerun (list at the end). The reviewer's own probes are in the scratchpad
folder `top/build/review/P1/` (`probe.js`, `probe-psql.js`, `update-extra.sh`, and their `.out` files); none of
them is in the repository, and no line of the package's code was changed.

**REVIEW P1: 1 blocker, 4 majors, 14 minors.**

The schema itself held against every attack tried: no table, sequence, private function or view was reachable
by a visitor or a player, through the stand-in for PostgREST or through `set role`; every `security definer`
function pins `search_path`; no SQL is built from a caller's string; forged, swapped and `alg: none` tokens are
refused; out-of-bound scores are refused by name. The rulings S1 to S5 and S8 are in the SQL. The faults found are
in what lies around the schema: the guide's walls on the owner's server, the staging channel's handling of odd
states, and a few edges.

## Findings

### 1. BLOCKER. The guide closes the gateway's port 8000 but not Kong's port 8443, which serves the whole API

Evidence. Supabase's own compose files, fetched today from `raw.githubusercontent.com/supabase/supabase/master/docker/`:
`docker-compose.yml` line 91 publishes only `${API_GW_HTTP_PORT:-${KONG_HTTP_PORT:-8000}}:8000/tcp` (the Envoy
gateway), but `docker-compose.kong.yml` line 22 publishes `${KONG_HTTPS_PORT:-8443}:8443/tcp`, and `.env.example`
line 359 sets `KONG_HTTPS_PORT=8443` ("Kong re-adds an HTTPS listener on 8443"). The classic Kong-only compose
that older installs run publishes the same two ports (from memory of that file; the guide itself expects older
installs, it names `KONG_HTTP_PORT`). The guide's step 0 item 2 (`deploy/supabase/README.md` lines 67 to 78)
checks and closes 8000 only; smoke check 12 (`tools/platform/smoke.js` line 228) probes 8000 only.

Why it blocks. This is the exact danger spec 9.1 builds the guide around. On a Kong install the owner follows
every step, every check passes, the page then publishes the anon key, and `https://76.13.121.176:8443/rest/v1/<any
table>` (a self-signed certificate: `curl -k`) answers every table of every project that has row level security
off, plus storage, GraphQL and the rest. The narrow name of step 1 is bypassed. (Supavisor also publishes the
database itself on 5432 and 6543, `docker-compose.yml` lines 537 and 538; that one is behind the database
password, which step 0 item 1 checks, but the owner should know.)

Fix. In step 0 item 2: also run `curl -k -m 5 -I https://76.13.121.176:8443/auth/v1/settings` from outside, and
when it answers set `KONG_HTTPS_PORT=127.0.0.1:8443` beside `KONG_HTTP_PORT=127.0.0.1:8000` (or remove the 8443
line from the kong service's `ports:`), then `docker compose up -d`. Add one sentence: "the database's own ports
5432 and 6543 also answer from outside; they are protected by the database password of item 1; if no program off
the server needs them, ask whoever set up the server to bind them to 127.0.0.1." In `smoke.js` check 12: probe
8443 (https, certificate not checked) as well as 8000, and name both in the line. In spec 9.1 and 10.6 item 12:
"the gateway's own ports (8000, and 8443 on a Kong install)".

### 2. MAJOR. The public name serves all of `/auth/v1/`: sign-up, one-time codes, password and recovery mails, not only the six routes the page uses

Evidence. `deploy/supabase/README.md` lines 123 to 128: `location /auth/v1/ { proxy_pass ... }`. The page needs
`settings`, `authorize`, `callback`, `token` (pkce and refresh_token), `user`, `logout` (spec 1.1). Supabase's
defaults (`.env.example` lines 175 to 196): `DISABLE_SIGNUP=false`, `ENABLE_EMAIL_SIGNUP=true`,
`ENABLE_PHONE_SIGNUP=true`, **`ENABLE_PHONE_AUTOCONFIRM=true`**. So through the game's address anyone can
`POST /auth/v1/signup` (by my reading of GoTrue's sign-up, a phone sign-up with auto-confirm on returns a session
without any SMS; not tried here, the stack has no sign-up route), and `/auth/v1/otp`, `/recover`, `/magiclink`
send mail or SMS to any address through the owner's providers. Each minted account is a signed-in player: it
skips the visitors' event pool (1,500 events an hour each, no pool, `schema.sql` line 726), and can begin runs and
post bounded forged scores under as many names as it likes. A Supabase that was reachable from the server alone
gets these doors from this guide.

Fix. Replace the `/auth/v1/` block with the routes the page uses, and refuse the password grant:

```
location ~ ^/auth/v1/(settings|authorize|callback|user|logout|health)$ { proxy_pass http://127.0.0.1:8000; ...same headers... }
location = /auth/v1/token {
    if ($arg_grant_type !~ ^(pkce|refresh_token)$) { return 404; }
    proxy_pass http://127.0.0.1:8000; ...same headers...
}
```

(and the same list in the Caddy block). Add `/auth/v1/signup`, `/auth/v1/otp`, `/auth/v1/recover` and
`/auth/v1/token?grant_type=password` to smoke check 11's list of paths that must answer 404, and the same to
`guide-check.sh`. Spec 9.1's "two path prefixes" becomes "the six Auth routes and `/rest/v1/rpc/hs_`".

### 3. MAJOR. `update.sh` asks for "next" with a suffix match: a branch such as `feature/next` blocks or replaces staging

Evidence. `deploy/update.sh` line 101: `git ls-remote --heads origin next`, then `rev=${heads%%[[:space:]]*}`
takes the first line. `ls-remote` patterns match from the tail, so `refs/heads/feature/next` matches too.
Reviewer's case X3 (`update-extra.sh`): with `feature/next` and `next` both on the remote, `ls-remote` answered

```
e325410...	refs/heads/feature/next
59472de...	refs/heads/next
```

and the run logged `NOT published next e325410: the branch has no index.html; /next/ stays as it was` (the
fetched object is next's, the one named is feature/next's), wrote e325410 to `.git/hs-next-rejected`, and the real
`next` is never published while `feature/next` exists. With `feature/next` alone (case X2) the fetch of `next`
fails and the script returns silently every run; had `feature/next`'s commit been fetched it would have been
published at `/next/`. Master is not affected (its flow runs first and apart).

Fix. `heads=$(git ls-remote origin refs/heads/next 2>/dev/null) || return 0` (an exact ref), and fetch the same
ref: `git fetch -q origin refs/heads/next 2>/dev/null || return 0`. Add the case to `test-update.sh`.

### 4. MAJOR. On its first run the new `update.sh` deletes any `/next/` folder in the web root, also one it never made

Evidence. `deploy/update.sh` lines 102 to 108: no branch `next` and `[ -d "$WEB/next" ]` leads to
`rm -rf "$WEB/next"`. Reviewer's case X1: a folder `$WEB/next` holding the owner's own `notes.txt`, no branch
next, one run: the folder is gone and the log says `removed /next/: the branch next is gone`. The live server's
web root is the owner's; nothing says `/next/` is free there today, and the run happens unattended every two
minutes.

Fix. Remove `$WEB/next` only when this script published it: `if [ -f .git/hs-next-live ] && [ -d "$WEB/next" ]`.
Otherwise leave it, and (once, under a marker) log "a /next/ folder exists that this script did not make: it is
left alone and staging will not publish over it", and make `publish_next` refuse to write into such a folder.
Add the case to `test-update.sh`.

### 5. MAJOR. One device id drains the visitors' event pool for everyone in about 400 calls

Evidence. `schema.sql` lines 718 to 723: the pool (`evanon`, `ev_cap_hour`, 20,000) is charged with the whole
batch before the per-device limit (900 an hour) is looked at, and is charged even when the batch is then dropped.
Reviewer's probe: one made-up `aid`, 405 calls of 50 events. Stored: 900 events. Pool counter: 20,251. A new
visitor's single event right after: `{"dropped":1,"accepted":0}`. At the proxy's 10 calls a second from one
address that is 40 seconds of work an hour, and every visitor's `page_load`, `gate_shown` and `provider_tapped`
is then lost for the rest of the hour: the funnel the owner is to judge the gate by (RULINGS D2) goes dark. The
spec accepts that many made-up ids can dry the pool; it does not need one id to do it while storing 900 rows.

Fix. Look at the pool without charging it, then the device, then charge the pool with what was taken:

```sql
if v_mb > v_max_mb then v_drop := true;
elsif coalesce((select r.n from public.hs_rate r where r.bucket = 'evanon:' || <this hour> and r.key = 'all'), 0) + n > v_cap then v_drop := true;
elsif not hs_private.rate_ok('ev', v_aid::text, 3600, 900, n) then v_drop := true;
else perform hs_private.rate_ok('evanon', 'all', 3600, v_cap, n);
end if;
```

The pool row is still read first, so a flood of made-up ids once it is dry still adds no rows (the spec's
reason for the order). Add the one-device flood to `sql-tests.js`'s limits group.

### 6. minor. With no Node.js, the staging line is logged every two minutes

Evidence. `deploy/update.sh` lines 140 to 145 write no marker. Case X4: five runs, five lines `NOT published next
316231c: no Node.js 18 or newer found to check it; tried again next run`: 720 lines a day in
`/var/log/highland-update.log` on a server without Node.js 18 (which `deploy/README.md` says can happen). Fix:
write the commit to `.git/hs-next-nonode` and log only when it changes; retry silently.

### 7. minor. A staging run that fails after `mktemp` leaves a 4.5 MB folder in /tmp, every run

Evidence. Case X5: with something in the way of `$WEB/next` the subshell stops at `mkdir -p` (set -e), the log
gets `mkdir: cannot create directory ...: File exists` each run, and `/tmp` gains one more `tmp.*` folder per run
(before 1, after 2). Any failure between line 115 and line 165 (a full disk at `install`, say) does the same,
every two minutes. Fix: `tmp=$(mktemp -d) || return 0; trap 'rm -rf "$tmp"' EXIT` inside the subshell (the flow
already runs in its own subshell, so the trap cannot reach master's), and drop the scattered `rm -rf "$tmp"`.

### 8. minor. A deleted account's access token still writes visits and counters for an hour

Evidence. Reviewer's probe, after `hs_delete_account` as Bagrat, with his old token: `hs_profile_get` answers 200
with his user id, `hs_track` answers `{"accepted":1}`, and the database then holds `{"ses":1,"rate":1}` rows
carrying the deleted id; `hs_save_put` and `hs_profile_set_name` fail with raw foreign-key errors (409).
`hs_private.uid()` (`schema.sql` line 208) trusts the claim alone. The page reloads at once after deletion, so
this needs a second tab or a script. Fix: in `hs_private.uid()`, `if not exists (select 1 from auth.users where id
= v) then raise exception 'not_signed_in' using errcode = '42501'`; in `hs_track`, attach `v_uid` only when that
user exists. Add both to the deletion group of `sql-tests.js`.

### 9. minor. Publishing accepts a ruleset that every later run then fails on with a raw error

Evidence. Probe as an admin: a ruleset with `"min": "abc"` publishes (`{"ok":true}`), and every `hs_run_begin`
under it answers `400 invalid input syntax for type numeric: "abc"`. A score weight of `"4000.5"` and a twist
multiplier `"lots"` publish too, and fail later in `::integer` and `::numeric` casts. `hs_private.ruleset_problem`
(lines 787 to 860) never reads `min`, `lostMax`, the twist table `t` or `livesSet`, and checks the weights as
numeric while `hs_score_submit` casts them to integer. Fix: check `min` (number, under `fast`) in both tables,
each weight and `lostMax` as integers, and every value of `daily.t` (numbers; `livesSet` a whole number of at
least 1).

### 10. minor. Admin functions answer a few edges with raw database errors, and one value has no size limit

Evidence (probe as admin): `hs_admin_set_config` with `p_key: null` answers `409 null value in column "key"`;
`hs_admin_moderate` renaming to a taken name answers `409 duplicate key value violates unique constraint
"hs_profiles_name_key"` instead of `name_taken`; `hs_admin_set_config('boards', <400 KB>)` is stored and then
`hs_config()` hands 400,060 bytes to every visitor on every start. Fix: `p_key is null` gives `key_unknown`;
catch `unique_violation` in moderate as `name_taken`; refuse any value over 4 KB (`octet_length(p_value::text)`).

### 11. minor. `hs_run_begin` with `p_diff: -1` passes the bounds and fails on the table's check

Evidence. Probe: `409 new row for relation "hs_runs" violates check constraint "hs_runs_diff_check"`. In
`hs_private.bounds` line 359, `lv -> 'd' -> -1` is the last element (jsonb counts from the end), so a negative
difficulty is read as Hard before the insert refuses it. Fix: `if p_diff is null or p_diff not between 0 and 2
then raise exception 'diff_unknown'` at the top of `bounds`.

### 12. minor. Refused calls never count against the limits (documented, but its cost is not)

Evidence. Probe: 60 refused `hs_score_submit` calls in a row, 60 answers of 400, none 429; the builder's report
(difference 5) says each call is one transaction, so a refusal rolls its counter back. So name probes, refused
saves and refused scores are limited only by the proxy's 10 a second (and not at all on Caddy). The bounds are
public anyway (they are in the page), so nothing leaks; it is database work for nothing. Fix: say so in spec 2.3
under the limits ("a refused call costs the caller nothing but the proxy's limit") so it is a decision, not a
surprise; nothing to change in the SQL now.

### 13. minor. `smoke.js` check 12 can pass or fail for the wrong reason

Evidence. `smoke.js` lines 228 to 233 count only `timeout`, `refused`, `ECONNRESET` and `EHOSTUNREACH` as "does not
answer". From this machine a direct connection to a public host fails with `ENOTFOUND` (tried: `example.com:8000`
and `:80` both `ENOTFOUND`, there is no direct route out, only the proxy), which check 12 reports as "the gateway's
port 8000 ANSWERS (getaddrinfo ENOTFOUND ...)": a FAIL for the wrong reason on the day of the owner's values.
And behind a network that drops outbound 8000, a timeout reports PASS about the owner's server. Fix: when a
proxy is in use or the name does not resolve, report check 12 as "cannot be answered from this machine" (not
pass, not fail) and say who can run it (any computer off the server, the guide's step 0 `curl`); probe 8443 too
(finding 1).

### 14. minor. The audit of step 4 says more than it shows

Evidence. `README.md` lines 386 to 404 list tables without row level security (select and insert only) in
`public` and `graphql_public`, and say "No rows: nothing of yours is exposed by the key". A table with row level
security and a policy `to anon using (true)` is exposed too; so is one where the API roles hold `update` or
`delete`; and PostgREST also serves `storage` (Supabase's default `PGRST_DB_SCHEMAS`). Fix: add a third part
listing every policy whose roles include `anon`, `authenticated` or `public` on API schemas
(`select schemaname, tablename, policyname, roles, cmd, qual from pg_policies where schemaname not in ('auth',
'storage', 'realtime', 'hs_private') and (roles && '{anon,authenticated,public}')`), add `update` and `delete` to
the privilege test, and change the sentence to "No rows: no table of yours is open to the key without a rule."

### 15. minor. The guide's backup lines will not work as a cron job as written

Evidence. `README.md` lines 561 to 567: `$(date +%F)` in a crontab line is cut at the `%` (cron reads `%` as a
newline), `/root/backups` may not exist (`docker cp` then fails), and "keep a week of copies" has no command. Fix:
give the three lines as a script file to make once (`/root/backup-highland.sh` with `mkdir -p /root/backups`, the
two lines, and `find /root/backups -name 'highland-*.dump' -mtime +7 -delete`), and the one cron line that runs
it, marked [your server].

### 16. minor. The daily's board and attempts are shared by every active ruleset of a channel, and no ruleset is ever retired

Evidence. `hs_run_begin` (lines 479 to 490) picks the day's battlefield from the ruleset the caller names;
`hs_private.daily_board` is `d:<day>` for all of a channel's rulesets; publishing (line 870) never makes an older
ruleset inactive, and there is no admin call to do it. After a ruleset whose `daily.pool`, `k`, `j` or `skip`
differs is published, a player whose page is still the older one (or anyone naming the older id) plays a
different battlefield on the same day's board, with the same three attempts, and can choose the easier one. The
same holds on a campaign board under S4 when a ruleset changes the score weights or a difficulty's `lives` while
leaving that battlefield's `rev` alone. Fix: in `hs_run_begin` for a daily, refuse `daily_mismatch` when the pick
under the named ruleset differs from the pick under the newest active ruleset of the same channel; at publish,
refuse a ruleset that keeps a battlefield's `rev` while its `waves`, `script` or `d` differ from the newest active
ruleset that has that rev, or that changes `score` without moving every rev (name the battlefield in the
detail). Gameplay should know the rule: change a battlefield, move its rev.

### 17. minor. The stack leaves its database and a running postgres behind when its caller dies

Evidence. The reviewer's first probe threw before `stop()`: `/var/tmp/hs-stack/stack-NRG2hI` stayed, and
`postgres -D /var/tmp/hs-stack/stack-NRG2hI/data` kept running (removed by hand). `pgtemp.js` has no exit
handler and `start()` sweeps nothing; a killed `sql-tests.js` (a container restart, a timeout) does the same. The
Playwright flows of P2 and later will start the stack many times on a shared 15 GB machine. Fix: in `pgtemp.start`,
first remove folders under `BASE` whose `data/postmaster.pid` names a dead process (stopping any live one is not
ours to do), and register `process.on("exit")` plus `SIGINT`/`SIGTERM` handlers that run `pg_ctl stop -m immediate`
synchronously and remove the folder.

### 18. minor. The stack differs from the live server and the proxy in two ways a later flow could trip on

Evidence. `stack.js` lines 153 to 175 serve any file under the repository root at the site port (`/.git/config`,
`/tools/...`, `/docs/...`), while the live web root holds `index.html` and `og.jpg` only, so a page that loads a
file of its own passes in the stack and 404s live. And a body over 512 KB gets its connection reset (`readBody`
calls `req.destroy()`, probe: `ECONNRESET`), where nginx answers 413: the page's keepalive flush would see a
network failure (status 0) on the stack and a 413 live. Fix: serve only `index.html`, `og.jpg` and the
`/next/` pair (with nginx's fallback to `/index.html`), and answer 413 before destroying.

### 19. minor. Gaps in the tests the rulings ask for

- S2: no SQL case posts a **win with `lives: 0`** (the resumed battle that lost every defender on the boards'
  count), which the SQL now allows (`schema.sql` line 550) and the build report names as a change.
- S4: no case shows that a `rev` sent in `p_stats` is ignored ("never from the client's post").
- PKCE: `curl-session.sh` has no expired-code case. The stack does it right (probe: after `authclock` 301 s,
  `flow_state_expired`, then `flow_state_not_found`); the session should show it, as the package asks.
- `test-update.sh` lacks the cases of findings 3, 4, 6 and 7 (`update-extra.sh` holds them, ready to adapt).

## What was rerun, and what it gave

All on the committed tree 24ca794, from `/home/user/hs-wt/pf`, logs in the scratchpad `top/build/review/P1/`.

| command | result |
| --- | --- |
| `node tools/platform/sql-tests.js`, twice in a row | PASS both: 453 assertions, 0 failed, 2 s each |
| `bash tools/platform/curl-session.sh` | PASS: 58 refusals shown, 0 unexpected answers |
| `node tools/platform/smoke-local.js` | PASS: all four runs ended as expected (11 pass, 2 "only on the real Supabase") |
| `bash tools/platform/test-update.sh` | PASS: 31 cases |
| `bash -n deploy/update.sh` | PASS |
| `node tools/platform/unit.js` | PASS: 72 checks, 0 failed, 7 subjects not in the page yet |
| `node deploy/check-page.js index.html` | PASS: 1 inline script parses |
| `bash tools/platform/guide-check.sh <the builder's unpacked nginx 1.24>` | PASS: 24 commands gave the guide's answer |
| `timeout 900 node tools/selftest.js` | see the line below the table |
| `/var/tmp/hs-stack` after every run above | empty; no postgres left running |
| `probe.js` (the stack's PostgREST and Auth, attacked) | every refusal as expected; findings 5, 8, 9, 10, 11, 12, 18 |
| `probe-psql.js` (`set role anon` / `authenticated` as `authenticator`) | 48 table reads and writes refused, all private helpers and views refused (schema), sequences refused, create in public refused, forged admin claims refused (`not_admin`); all 18 public and 21 private functions pin `search_path`; none executable by anon outside the four; no policy on any table |
| `update-extra.sh` (seven states of `next`) | findings 3, 4, 6, 7; a force-push back to a good commit published it; a 300 MB `next` took 5 s and master went out on the same run |
| secrets grep of the tracked tree | no JWT-shaped string, no private key or token shape. `service_role` appears only as the stand-in role's name, in `smoke.js`'s refusal and in unit tests' unsigned payloads. Supabase's published example passwords appear in the guide's step 0 greps and in `guide-check.sh`'s fake `.env` (what the owner looks for, public knowledge) and in the draft `docs/specs/platform/setup-guide.md`; the draft `docs/specs/platform/standins.sql` has a test-only `password 'authenticator'`. All harmless. The stack's secret is `crypto.randomBytes(48)` at each start, never written. |
| long dashes in the change and the commit message | none |

`timeout 900 node tools/selftest.js`: PASS, 151 checks, 0 errors, perfMs 16.91 (run while the other track ran its regression suite), exit 0.

Attacks tried and what answered (beyond the build report's own list): `alg: none`, a token signed with
Supabase's example secret, a valid token with its `sub` swapped (all 401 `JWSInvalidSignature`); the anon key as
a bearer on player functions (401); names of 100 KB, null, an object, `Ar4m` against `Aram`, a right-to-left
override, a zero-width joiner, stacked combining marks (all refused by name); a Cyrillic letter mixed into a
Latin name (accepted, as spec 5.5 says); saves over 256 KB, an array, a bad channel, a non-number version
(refused), a save nested 2,000 deep (accepted, harmless); `hs_board` with a limit of 1e9 (clamped) and 1e12
(refused), a date and a mode carrying SQL text (refused as text); a function name with a quote (404); the six
admin functions as a player (403 `not_admin`) and a visitor (401); score forgery: lives over the difficulty,
waves short, gold over `earnMax`, spent over earned, `NaN`, `Infinity`, 1e10, 1e300, a list (all refused); a
result posted on another player's run (`run_unknown`); the best result the bounds allow (lives full, the clock at
nine tenths of `min` plus one, one coin spent, `earnMax` earned, sent 100 s after begin) is accepted at 10,000,
which is spec 2.5's known limit; PKCE with a wrong verifier, then the right one (200: a wrong try does not burn
the code, as GoTrue), the code reused (404), the code after 301 s (400 `flow_state_expired`), the challenge sent
as the verifier (403), a short verifier (400).

## What could not be checked

- Anything on the owner's server: the real gateway (Envoy or Kong), its ports, whether phone sign-up with
  auto-confirm really returns a session there (finding 2), the Studio editor's role, `postgres`'s right to delete
  from `auth.users`, the ICU collation. The smoke test against the real Supabase waits for the owner's values.
- The Caddy block (no Caddy here). Note for whoever fixes finding 2: Caddy has no counterpart of the nginx line
  that refuses slipped paths, so its block should be held to the same smoke checks once it runs.
- The occasional purge inside `hs_track` (1 call in 200 removes up to 300 old visits with their events under a
  visitor's 3 s limit) was not measured with a large table; if it ever runs out of time, that visitor's batch is
  lost with it.
- iOS, the providers' consoles, and the page itself (P1 does not touch `index.html`; it is byte for byte as at
  04fb968).

## For the builder, the other track and the owner

- Fix 1 before the owner starts step 0; 2 before step 1; 3 and 4 before `update.sh` reaches master; 5 before
  analytics (P4) is merged.
- Gameplay: the boards' fairness now rests on the rule "change a battlefield, move its `rev`" (finding 16).
- The owner should not follow step 0 and step 1 of the guide as it stands on an install that runs Kong.
