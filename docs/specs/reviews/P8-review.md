# P8 review: privacy and deletion

REVIEW P8: 0 blockers, 4 majors, 6 minors.

Reviewed: branch pf/work, commit 03db068 (tag p8-done), against its base 5b18b01 (p3-done). The whole diff was
read line by line: index.html (the ?privacy page, the Account tab's question, pfDeleteAccount, pfDeletedLine,
the platform-off door), migration 005 up and down, sql-tests.js, isolation.js, owner-delete-check.js,
platform.js (flows 1, 10, 13del, 14), the owner's checklist and the guide's changes. Every claim of the
builder's report was rerun (below), and two probes and five mutants were run against it.

The probes and mutants live outside the repo, in
`/tmp/claude-0/-home-user/169f7cc7-9178-569c-b36f-88a849db13cf/scratchpad/top/build/review/P8/`:
`probe-platform.js` is a copy of tools/regress/platform.js with two extra flows, `pA` and `pB`
(`NODE_PATH=$(npm root -g) node <that dir>/probe-platform.js index.html --flows=pA,pB --sizes=desk`, run from the
worktree); the mutants were made in a detached worktree of 03db068 in `<that dir>/mut`.

The single-tab deletion itself is sound. The server function removes the caller's rows in `highland` and
nothing in `auth`. Migration 005 closes a real hole (a password session of the shared sign-in could delete a
player's data). The page clears the device, makes a new anonymous id and reloads to the gate. The privacy page
is the spec's text, readable at 667 x 320. With the platform off, ?privacy opens with no request. What fails is
the account's progress kept by another tab or another device: it comes back to the server after the deletion
(findings 1 and 2). The owner's checklist gives two procedures that leave data behind (findings 3 and 4).

## Findings

### 1. major: a second device still signed in brings the deleted progress back to the server

Evidence: probe `pA` (desk). Aram plays on device 1 and his save holds erebuni. Device 2 signs in to the same
account. Device 1 deletes the account, and the server has no row of his. Device 2 reloads. Its session is still
good (auth is untouched, by design), so it shows the name card like a new player's and says nothing about the
deletion. Aram types a name, and device 2's old progress goes up into the new player's save:

```
probeA after deletion server rows {"profile":0,"saves":0,"runs":0,"scores":0,"boards":0,"visits":0,"admin":0,"rate":0,"auth_user":1,"auth_ids":1}
probeA device 2 on reload: {"gate":true,"st":"name","text":"Choose your player name ...","held":0}
probeA server save after device 2 named again: {"erebuni":{"stars":[0,3,0],"lives":[0,20,0],"endless":[0,0,0]}}
FAIL probeA two devices mouse 1600x900: the deleted account's progress came back to the server from device 2
```

Why: csJoin (index.html 80009) treats `no_profile` as "a new account, ask for a name". After the name, the
device's keys are owned by this uid (`hs_pf_sync.owner === uid`), so the case is "same", and the device's
progress is pushed. "This cannot be undone" is then untrue on the server.

Fix: a device whose sync state says this uid has been on the server (`owner === uid` and `ver > 0` or
`pushed`) but whose `hs_profile_get` answers `no_profile` has lost its account elsewhere. Before the name card,
clear the synced keys and the account's traces exactly as pfDeleteAccount does, minus the server call, and show
the gate's deleted line. Test: probe `pA` as a flow in platform.js (13del, desk and ses).

### 2. major: a second tab writes the deleted account's progress back to the device, and it returns on the next sign-in

Evidence: probe `pB` (desk). Two tabs of one browser are on the map. Tab 1 deletes the account. Tab 2 knows
nothing about it: there is no `storage` listener for the platform's keys anywhere in the page (`grep -n
'addEventListener("storage"' index.html` finds none). When tab 2 wins a battle, it writes the records and its
in-memory `hs_pf_sync` (owner = the deleted uid, `ver` 3, dirty) back to localStorage. When the same person
signs in again and chooses a name, all of it goes to the server:

```
probeB device storage after tab 2 played: {"rec":"{\"tushpa\":{...},\"erebuni\":{...}}","sync":"{\"owner\":\"4be7f1c3-...\",\"dirty\":true,...,\"ver\":3,...}","auth":false}
probeB server save after naming again: {"tushpa":{...},"erebuni":{...}}
FAIL probeB two tabs: the deleted account's progress came back from the second tab
FAIL probeB two tabs: the second tab wrote the deleted account's progress back to the device
```

So "removed from our server and from this device" is false whenever the game is open in a second tab.

Fix: listen for `storage` events on the platform's keys. When `hs_pf_auth` is removed, or a `hs_pf_gone` mark
(set by pfDeleteAccount with the uid) appears, a tab of that account does this: `CS.ready = false`, clear its
timers, drop `CS.st` so it does not write the old owner back, and reload. The fix for finding 1 also covers the
sign-in that follows. Test: probe `pB` as a flow.

### 3. major: the owner's "remove my sign-in too" says the game's rows cascade; the visits, rate counters and a ruleset's publisher stay

Evidence: docs/specs/owner/p8-privacy-checklist.md line 106: "The game's rows of that account go with it on
their own (their foreign keys cascade), so the game needs nothing more." Some do not:

- `highland.hs_sessions.uid` has no foreign key (001_schema_tables.up.sql line 111: `uid uuid,`), so the
  visits, and their events, stay with the uid.
- `hs_rulesets.published_by` has no foreign key either (line 47).
- The rate counters are keyed by text.
- No migration has a trigger (`grep -in trigger deploy/supabase/migrations/*.up.sql` finds none).

An owner who follows the paragraph to remove a person's sign-in leaves that person's counts in place. The
privacy page says counts go on deletion.

Fix: in section 3, "Remove my sign-in too": first run the block of the first case (the game's data), then remove
the user in Studio. Strike the cascade sentence, or say that only the profile, saves, runs, scores, board rows
and the admin row cascade.

### 4. major: the privacy page promises to delete a child's account; the checklist deletes only the game data

Evidence: the page's Children part says: "If you believe a younger child has an account here, write to us and we
will delete it." The checklist (line 108) says only: "Remove the game data as in the first case." The child's
email address and provider identity then stay in the shared sign-in service. The page itself names those as kept
by that service. A child's email address is exactly what a parent who writes in wants gone.

Fix: for a child, the checklist should have the owner remove the game data (the block) and then the sign-in
account (Studio, Authentication, Users, Delete user), after checking that no other app of his relies on it.
If the owner will not do that, the page's sentence must say only the game data is deleted. That second choice
is the owner's call, so it is a line in the checklist's section 1 either way.

### 5. minor: a deletion that timed out says "Nothing was deleted", which may be false

Evidence: index.html 81365 calls `pfRpc("hs_delete_account", {}, { auth: true, timeout: 30000 })`. The
function's own `statement_timeout` is also 30 s (005 up, line 16). pfApi answers `status: 0` both for no
connection and for its own timeout after the request has left (79466). Line 81370 maps status 0 to "offline",
and line 81334 then says "there is no connection. Nothing was deleted." A slow server that commits at 29 s,
answering after the page gave up, gets that line. The player believes the account is still there.

Fix: a client timeout longer than the server's (for example 40 s). Treat a timeout, as opposed to an offline
browser (`navigator.onLine === false`, or a fetch that failed at once), as unknown: "We could not hear back
from the server. Your account may already be deleted. Try again: it is safe to." Retrying is safe, since
hs_delete_account on an account with no rows answers ok.

### 6. minor: two deletion rules have no test that fails when they break

Evidence (mutants of 005 up, full suites run on each):

| mutant | sql-tests | isolation |
| --- | --- | --- |
| M1: no `_game_session()` check | 3 failed (caught) | 3 failed (caught; the run then stops, A being gone) |
| M2: no delete of the devices' rate counters | 1 failed (caught) | 0 failed |
| M4: `delete from highland.hs_sessions where uid is null` (every visitor's anonymous visits, on every device) | **0 failed** | **0 failed** |
| M5: delete the rate counters of every device in hs_sessions (B's devices too) | 1 failed (only M2's assertion) | 0 failed |
| page M6: no csClearKeys, no `pfEvQ = null` | platform.js --flows=13del --sizes=desk: 3 failed (caught) | |

M4 would wipe every visitor's analytics on each deletion, and nothing notices. M5 shows that "B's devices'
counters stay" (sql-tests.js 1086 to 1089) is vacuous: B's devices have no counter keyed by their aid at that
point (a print added in the mutant worktree shows `bRate = 0`).

Fix: in sql-tests' delete group, add a visitor's anonymous visit on a third device (D3) and a `hs_track` by B
on his own device before the deletion. Then assert that D3's visit and B's aid counter are still there, with
`ok(bRate > 0)` before the deletion. In isolation.js, count every `uid is null` visit before and after A's
deletion: only A's devices' visits may go.

### 7. minor: flow 13del never takes the offline path, and does not check three of the keys it says are cleared

Evidence: platform.js flow13del's failure case uses `S.control("rest", { mode: "down" })`. The stack answers
that with 503 (stack.js line 260), so only the "failed" words are seen. The "no connection" words (status 0)
are never shown in a test. The device check after the deletion lists `hs_pf_auth, hs_pf_me, hs_pf_run,
hs_pf_stash, hs_pf_pkce`. pfDeleteAccount also drops `hs_pf_out`, `hs_pf_daily` and `hs_pf_evq` (the unsent
events, which the comment calls essential), and none of these three is checked.

Fix: one more failure case with `rest: "hang"` and a shortened client timeout, or `page.route` aborting the
call. Add the three keys to the list.

### 8. minor: the self-test check of 10.5 (item 1) is not built and not named for the gameplay track

Evidence: spec 8.1 says "a selftest check holds the page to having `#privacyPage` with its `#delete` part
(10.5)". 10.5 item 1 puts it in the second suite (gameplay's). `grep -n privacyPage` in index.html of pf, gp
and next finds no check, only the runtime lines. The builder's report does not name it for the other track.
platform.js flows 1 and 10 do hold the page to `#delete`, so the risk is small.

Fix: name it in the report for gameplay: one check in suite 2 that `#privacyPage section#delete` exists, and that
`#gate` exists and is hidden under the harness.

### 9. minor: with HS_ANON_ID "visit", the deletion writes a new device id to localStorage

Evidence: index.html 81387 `pfWrite("hs_pf_aid", pfUuid());` runs whatever the mode. In "visit" mode (RULINGS
D4's other answer), the id is kept on the device only after the visitor chooses (pfAidKeep). After a deletion, the
next visitor on that device gets a kept id they never chose.

Fix: `if (HS_ANON_ID === "device") pfWrite("hs_pf_aid", pfUuid()); else pfDrop("hs_pf_aid");` (the session
copy is already removed).

### 10. minor: "What we count" leaves out one thing the visit carries

Evidence: pfEvContext (index.html 80713) sends `standalone` (whether the game runs from the Home Screen),
stored in `hs_sessions.standalone`, along with build, ruleset and channel. The page names the device kind,
system, browser, window size, language and referrer, but not the Home Screen flag. Build, ruleset and channel
are the game's own facts, not the player's, so they need no line.

Fix: "... its system and browser, whether the game was added to the Home Screen, the size of its window ...".

## What was checked and found right

- **Deletion, server.** 005 up removes, for the caller only: the profile, saves, runs, scores, board rows, the
  visits carrying the uid and the same devices' anonymous visits, with their events (cascade), the uid's and
  those devices' rate counters, an admin's row, and the publisher's name on a ruleset. auth.users,
  auth.identities and the log are untouched (sql-tests' delete group, isolation, flow 13del, owner-delete-check).
  A password session is refused, and so are service_role and anon; an outsider's call removes nothing of a
  player's. 005 down is 002's body exactly. search_path is pinned, and every DELETE and UPDATE has a WHERE.
  The signature is unchanged, so 003's grant stands.
- **Deletion, page, one tab.** The save sync is stopped and an in-flight write is awaited. The device is cleared
  only on `ok`. The session keys, synced keys, `hs_run`, this account's stash, hs_pf_cfg's traces and the unsent
  events are dropped. The aid is replaced and a local logout is sent. The page reloads to the gate with its line,
  and account_deleted arrives as a visitor's on the new id (flow 13del, and mutant M6 shows the flow catches
  a missing clear). Keep my account comes first and has the focus. Both failure lines say nothing was deleted.
- **Privacy page.** It is the spec's text, plus the builder's additions, all true to the code: the save
  document does carry the Council, the heroes and the device label (`p_device`), and the context carries the
  browser. Static HTML, z-index 70. Back to the game goes to `location.pathname` (so /next/ stays /next/).
  `?privacy#delete` scrolls to the part. The game's keys are shut out (Platform.blocking), and sound is never
  made, since Snd.init only runs on the game's own buttons and keys. The photos at 667 x 320 and 393 x 659 read
  well, and nothing is clipped.
- **Off means off.** The committed page has both constants empty. With the platform off, the Account tab is not
  pushed, pfBoot never runs, and ?privacy is shown from the body by Platform.boot's off branch. Its `track`
  only queues. flow 10 holds it to no request.
- **Words.** No long dash in the diff or the commit message, American spelling, short sentences, nothing
  historical. The commit message ends with the two required lines.

## What I reran (each to its end)

Builder's figures matched wherever the run was quiet enough. Load is the other track's full run-all, which ran
at the same time (a 1-minute load of 7 to 17).

| command | result |
| --- | --- |
| `node deploy/check-page.js index.html` | OK, exit 0 |
| `timeout 900 node tools/selftest.js --suite=all` (load about 17) | every check passed (suite 1: 151, suite 2: 30), but both suites were over budget: 242.2 s and 151.3 s of 125. That was load (see the two runs alone below) |
| `--suite=1` alone (load 4 to 7) | PASS, 151 checks, 125.0 s of 125 (right at the budget) |
| `--suite=2` alone | PASS, 30 checks, 48.2 s |
| `node tools/run-fixtures.js check` (with NODE_PATH) | PASS, 8 fixtures. (A first try without NODE_PATH was killed by me, not counted.) |
| `node tools/town-isolation.js` | PASS, 9 cases |
| `node tools/platform/p0.js` | PASS, 347.8 s |
| `node tools/platform/sql-tests.js` | 817 assertions, 0 failed |
| `node tools/platform/isolation.js` | 333 checks, 0 failed |
| `bash deploy/supabase/restore-rehearsal.sh` | 22 passed, 0 failed |
| `node tools/platform/unit.js` | 300 checks, 0 failed (2 subjects wait for P5, P6) |
| `bash tools/platform/test-update.sh` | PASS, 36 cases |
| `bash tools/platform/guide-check.sh` | 17 passed, 0 failed |
| `node tools/platform/owner-delete-check.js` | PASS |
| `node tools/regress/run-all.js --quick` (load about 10) | 9/11 in 2181 s. dance10 failed 2 (touch 1194x834: erebuni "a tap at 9645 ms ended the dance"; sis "a tap at -1 ms ended the horn call"). platform failed 1 (flow 11 at 667x320: "the checking card stayed 6.3 s") |
| `run-all.js --quick --only=dance10` alone | PASS, 61 s. Load failure (the dance10 tap near 9.5 s, reported as asked) |
| `platform.js --flows=11 --sizes=ses` alone | PASS, 26.9 s. Load failure, the same one as in P3 and the builder's run |
| `platform.js` every flow (1 to 6, 10, 11, 13 with 13del, 14) at desk, ipad, ses, i15h, i15u, `--photos` | PASS, 0 fails, 1494 s, 73 audited states |
| probe `pA`, `pB` (desk) | FAIL, findings 1 and 2 |
| mutants M1, M2, M4, M5 (sql-tests, isolation), M6 (platform.js 13del desk) | finding 6 |

Photos from my platform.js run are in
`/tmp/claude-0/-home-user/169f7cc7-9178-569c-b36f-88a849db13cf/scratchpad/top/build/review/P8/shots/`
(privacy-*, privacy-delete-*, delete-ask-*, delete-done-*, delete-fail-desk and -ses, at all five sizes). I looked
at privacy-ses, delete-ask-ses, delete-ask-i15u, delete-ask-ipad, delete-done-ses, delete-fail-ses and
privacy-delete-desk (the builder's and mine): nothing is clipped, and every control is in reach.

## What I could not check

- Real Supabase: whether a refreshed GoTrue token keeps `amr: oauth`, which 005 relies on. A refreshed
  session would otherwise be refused deletion. The stack mimics it. It needs a check on the owner's server
  (a delete after an hour's play).
- Safari and a real iPhone: the scroll to `#delete` on an iPhone, and `-webkit-overflow-scrolling`.
- Meta's acceptance of the instructions URL. That is the owner's console.
- The legal reading of the page (the owner's, per the checklist).

## For the other track and the owner

- Gameplay: finding 8 asks for one check in suite 2 (10.5 item 1). No gameplay line or line of table 0.4 is
  touched by P8.
- Owner: findings 3 and 4 change what you do when someone writes in, so read them before you answer such a
  letter. Migration 005 is still yours to apply. After it, try one deletion on /next/ after an hour of play (the
  refreshed-token case above).
