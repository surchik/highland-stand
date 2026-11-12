# Review of P3, cloud saves (platform track)

Reviewed: branch `pf/work`, commit 73a4e27 (one commit on top of 44689a2). Reviewer: an independent agent that did not
build it. Specs read: RULINGS.md whole; platform.final.md 0.1 to 0.5, 1.5, 3.9, 4 whole, 5.5's Account tab, 10.3 to
10.5, 11.2's P3 row. The package's whole diff (index.html, unit.js, platform.js, run-all.js, README) was read line by
line.

The probes written for this review are outside the repo, under the build's scratch folder
`top/build/review/P3/`: `sim.js` (a model of two devices and the server that drives the page's own `Cloud` from its
PURE block), `probe.js` (a copy of `tools/regress/platform.js` with six extra flows, p1 to p6, run against the stack
with `--flows=pN --sizes=desk`), `mutate.js` (21 changes that each break one rule of `Cloud`, each run through
`unit.js`), and two mutated pages for the browser flows (`mut-hook.html`, `mut-rec.html`).

## Findings

### 1. BLOCKER: a stash that joins while a battle is on the field is thrown away, with the stars in it

`csJoin` (index.html 79948 to 79955) merges this account's `hs_pf_stash` into the device, then removes the stash. The
merge is applied by `csApply`, which does nothing while `battleLive()` (79717: "never under a battle"). The stash is
removed anyway, and `csTake` then merges the device's keys, which lack the stash, with the cloud. The other-account
branch above it waits for a battle's end (`csRejoin(p, 5000)`); this branch does not. A join under a battle is a
normal path: a join that failed (the database not answering) is tried again by `csRejoin` and by the `online`
listener, and by then the player is playing.

Evidence (probe p5, desk): a player wins Tushpa while the database is down, signs out, "Sign out anyway" (the stash
holds Tushpa); signs in again with Auth up and the database still down; goes to the map and begins a battle; the
database comes back; the join runs in the battle.

```
stash after sign-out anyway: true
in battle: true
after the join in battle: {"live":true,"ready":true,"stash":false,"dev":false} server has tushpa: false
after the battle: server tushpa false device tushpa false
FAIL probe5: the stash's Tushpa victory is lost: the stash was dropped while a battle was on the field
```

Tushpa's three stars are gone from the device, the stash and the account.

Fix: in `csJoin`, when a stash for this account waits and `battleLive()`, do as the other-account branch does
(`csRejoin(p, 5000); return { failed: true }`) before anything is read or removed; and remove `hs_pf_stash` only
after `csApply` returned true (or after the join's push succeeded). Add the case to flow 13: the second sign-in
with the database down, a battle begun, the database back, and the stash's record on the server after the battle.

### 2. MAJOR: a battle ended on one device drops a different battle saved on another device, with a false toast

Rule 2 (79250) lets a device with a live battle replace the cloud's battle, whatever it was. Rule 3 (79251) then
lets the "no battle" mark of that device's end win over any older battle. The mark says only "no battle as of
`at`"; it does not say which battle ended. So a battle that never left the other device is dropped by the end of a
battle it has nothing to do with, and that device is told "That battle was finished on your iPhone." The spec's
rules 2 and 3 as written have the same hole (they assume one battle slot), so this is also a spec gap; the
builder's "held" (DIFFERS 1) was meant to keep both battles, and this undoes it.

Evidence (probe p1, desk, everything online; and the pure model `sim.js` for the offline variant):

```
B welcome: Welcome back, Aram. ... Resume: Vale of Tushpa, Wave 2 Campaign Map
B hs_run is tushpa: true
server run after A's abandon: {"at":1794514626649,"dev":"Bmoo","tok":null,"val":null,"label":"this browser"}
B hs_run after its pull: null toast: That battle was finished on another device.
FAIL probe1: B's own Tushpa battle, never played on A, was dropped by A's abandon of Avarayr
```

(`sim.js`: an iPad's Dvin battle in the cloud, the phone's own Avarayr held on the phone, the phone wins Avarayr:
the iPad's Dvin is removed with "That battle was finished on your iPhone".)

Fix: give the mark the battle it ends. `csHear` runs inside `track`, before the game clears `hs_run`, so it can read
the run there: `Cloud.ended(st, now, Cloud.tag(csGet("hs_run")))` stores `end: tag`. In `mergeRun`, a mark whose
`end` is set and differs from the other side's battle's tag, from a device other than that battle's, does not
drop it: that battle is the result (how "theirs" or "mine" as it falls). A mark with no `end` (older documents) keeps
today's rule. Rule 2 may still put the live battle in the cloud's one slot, but the device whose battle it
replaced keeps its own, since the later mark names another battle, and the question of rule 4 comes at its next
welcome card as with "held". Add unit cases (a mark with `end` against the same battle and against another one) and
probe p1 to flow 5. Tell the spec's owner that 4.5's rules 2 and 3 need the mark to name its battle.

### 3. MAJOR: the two-battles question is left pending when no welcome card follows, and then nothing is saved for the whole load

`csJoin` passes `gateUp` as "the player can be asked" (79957). `csTake` then sets `CS.ask` (79825) and pushes
nothing. Only the welcome card clears `CS.ask` (its buttons, or `csAskDrop` when the answer came late). Two paths
leave the gate with no welcome card: the gate mode "off" (80548) and a sign-in begun on the Account tab (the
`justIn.back === "hall"` branch). From then on `csPush` returns false at once (79834: `|| CS.ask`), for every
change, every battle's end and the page's close, until the page is loaded again. The Account tab still says "Saved
to your account just now." (`csLine` reads the pull's time), and Sign out says the progress "could not be saved".

Evidence (probe p2, desk: two fresh battles, the gate "off" through `__HS_PLATFORM_TEST.gate`, the profile answer
held 2.5 s so the save's answer comes first, as it does on any slow profile call):

```
B after load with the gate off: {"ask":true,"ready":true,"ver":5,"dirty":true,"gateUp":false,"line":"Saved to your account just now."}
a change on B's map: server version 5 -> 5 {"ask":true,"dirty":true,"line":"Saved to your account just now."}
FAIL probe2: with no welcome card the question stays pending and nothing is pushed for the whole load
```

(Without the delay the save's answer came after the gate left, `ask` was false, and the probe passed: it is a race
that the profile call's speed decides.)

Fix: in `on()` of `pfWithSession`, the two branches that skip the welcome card call `csAskDrop()` after
`gateLeave`; and `csJoin`, after `csTake`, drops a question no welcome card can show:
`if (CS.ask && !gateUp) csAskDrop();` (and the same in a `.then` of the join registered by those two branches, for an
answer that comes after them). `csLine` says "Waiting for a connection..." while
`CS.ask` or `CS.stopped` holds (see 10). Add p2 to flow 5 at desk.

### 4. MAJOR: the closing page's write can overwrite another device's save without merging it

`csPush(true)` sends the keepalive write with `p_expected = ver + 1` when a write of this page is still out (79861).
The comment says "if the one out was turned away after all, so is this one". That is not so: the one out is turned
away exactly when another device took version `ver + 1`, and then the keepalive write, expecting `ver + 1`, matches
that device's version and is accepted (002_functions.up.sql, `hs_save_put`: `if r.version <> coalesce(p_expected, 0)`
is the only check). The other device's document, which this page never merged, is replaced. Its keys come back only
if that device still holds them and pushes again; a device that pushed and then signed out (its keys cleared) has
lost that progress, and a key with the `newer` rule or the battle in progress can be lost even without a sign-out.
Not reproduced in a browser (the window is the time of one write); the reasoning is the server function's own
check.

Fix: the keepalive write always expects `s.ver`, the version its merge was built on. If the write that was out
lands first, the keepalive is refused, `dirty` stays set in `hs_pf_sync`, and the next load sends the change: slower,
never lossy. Flow 4 still passes (its close waits for the write out to end first).

### 5. MAJOR: sign-out after a load that could not reach the save leaves the account's progress on the device

`pfSignOut` treats the progress as the account's only when `CS.ready` (80025). `CS.ready` is false whenever the
load's join failed (the database or the network down), even though `hs_pf_sync.owner` is this account (the keys were
synced on an earlier load). Then sign-out says "Your progress stays on this device.", keeps every synced key and
keeps `owner`, so the next person on a shared tablet sees and plays on that player's progress (spec 1.5 and the end
of 4.6: "a shared tablet starts fresh for the next person"). DIFFERS 7 meant progress that never became the
account's; this progress is the account's.

Evidence (probe p6, desk): a player's Erebuni record reaches the server; the database goes down; reload; Account,
Sign out:

```
line: Waiting for a connection. Your progress is safe on this device. | words: Sign out? Your progress stays on this device. Sign out Stay signed in | left: {"rec":"{\"erebuni\":{...}}","owner":"caeb4d7d-..."}
FAIL probe6: sign-out left the account's progress on the device (the next person sees it)
```

Fix: `ours = !!s && PF.on && csState().owner === s.uid` (owner, not readiness). When `ours` and not ready, the
push cannot go: show the spec's "Your latest progress could not be saved yet. Sign out anyway?" and, on anyway, stash
what is dirty and clear. Keep DIFFERS 7 for `owner === ""` only.

### 6. MINOR: flow 4's "the change goes with the page" passes with the storage hook removed

With `if (PF_ON) csHook();` changed to `if (false) csHook();` (mut-hook.html), flow 4 at desk passes:

```
note: the save sent as the page closed: the write with the closing page did not land; the next load sends it
RESULT platform PASS {"fails":0,...,"flows":{"4@desk":"pass 30s"},"closeLost":1}
```

`closeSends` falls back to a reload whenever the close's write did not land, and the reload's join sends the save,
so the close itself is never held to anything. (Flow 13 does fail on the same mutation, through the sync line, so
the suite as a whole notices a missing hook; a keepalive that never goes would not be noticed by anything.)

Fix: in flow 4, check that `hs_pf_sync.dirty` is true before the close and that an `hs_save_put` request began
after `pagehide` (page.on("request") with a flag set by an init script's `pagehide` listener); count a lost close as
a pass only when that request was made. Fail the run when every close of the run fell back to a load.

### 7. MINOR: unit.js does not check `changed`

`mutate.js` caught 20 of 21 mutations of `Cloud`; the one missed is `const changed = false && ...` (79292): a merge
that never says the cloud's side must be sent. Fix: unit cases for `changed` (no cloud document; equal documents;
a key only this device has; a run that changed; a `keysAt` that changed).

### 8. MINOR: another account's stash is written and then removed in the same join

In `csJoin`, the stash of this account is read first (`stashed`), then another account's unsent progress is written
to the same slot (79935), then `pfDrop("hs_pf_stash")` removes the slot after this account's stash joins: the other
account's progress, just set aside, is gone. Rare (it needs both a stash for U and V's unsent progress on the
device), but it is the stash's whole purpose. Fix: remove this account's stash before writing the other one, or
remove the slot only when it still holds `uid`.

### 9. MINOR: a save over 200 KB is never sent, never backed off, and sends `sync_fail` on every try

`csPush` (79849 to 79855): over 200 KB with the run left out, it returns false with no `csFailed`, so no backoff,
`dirty` stays set for good, and `track("sync_fail", { why: "size" })` is sent on every push, every 2 s on a menu
page. Only the player's own (unknown) keys can make a document that big, so it is self-inflicted, but the events
flood. Fix: one `sync_fail size` a load, `csFailed`'s backoff, and the sync line's waiting words.

### 10. MINOR: the sync line says "Saved to your account ..." when nothing is being saved

`csLine` (80009) reads only `ready`, `dirty`, the failures and `navigator.onLine`. With the sync stopped by a newer
format (`CS.stopped`) or a question pending (`CS.ask`, finding 3), it still says "Saved to your account N minutes
ago." Fix: the waiting words while `CS.stopped || CS.ask`, or for `stopped` the newer-version sentence.

### 11. MINOR: a live-game endless record joined with a newer one loses waves

`Cloud.records` merges each field alone. A row from today's live game has `endless` and no `beyond` (the guest
upload of 4.6 is exactly that); a row of this build has both. The merge keeps the larger `endless` but the only
`beyond` there is, and `levelRecord` reads `beyond` first:

```
records({erebuni:{endless:[0,30,0]}}, {erebuni:{endless:[0,25,0],beyond:[0,5,0]}})
-> {"erebuni":{...,"endless":[0,30,0],"beyond":[0,5,0]}}     levelRecord then says 5 waves beyond, not 10
```

Fix: when one side has `endless` and no `beyond`, take its `beyond` as `max(0, endless - 20)` (gameplay's
`SCRIPT_LEN`, which the pure block can be handed in `o`) before the max. Gameplay should confirm the rule.

## What differs from the spec, as the builder reported it

1 (held), 2 (`drop`), 3 (the device that last saved), 4 (a first visit's own keys are not progress), 5 (keepalive
best effort), 6 (the 2.5 s from the pull's start) and 7 (sign-out of a guest's progress) are reasonable and kept,
with two limits found here: 1 does not protect a held battle from the other device's mark (finding 2), and 7 must
not cover an account's own progress on a load that could not reach the server (finding 5). 5's comment about the
version is wrong (finding 4).

## Checked and found sound

- Off means off (probe p3): the committed page served over http with the constants empty: `PF_ON` false,
  `__hsSaveKick` undefined, `Storage.prototype.setItem` is only the quota guard, no `hs_pf_sync` or `hs_pf_dev`
  written, one request (the page itself). On file:// and under the harness `PF_ON` is false by its definition.
- Every `Cloud` rule is held by `unit.js`: 20 of 21 mutations caught (finding 7 is the one missed). In the browser,
  a broken `records` rule fails flow 6 (5 fails) and a missing hook fails flow 13.
- The hook is installed (79674) before the page's migrations run (81384 on); it acts only for the page's
  `localStorage` (sessionStorage shares the prototype); the staging `next:` object and the memory fallback are
  wrapped where they are.
- The seam: no gameplay function and no line of table 0.4 changed; the only PF-0 change is one line in `track`.
  `hs_council` and `hs_heroes` merge through their own functions, `hs_towers_seen` by union, `beyond` by the records
  rule; `onSavesChanged()` is called after a merge that changed a key and never under a battle;
  `hs_profile_set_name` sends `pfAidNow`. The selftest is unedited.
- Isolation: P3 adds no SQL; `hs_save_get` and `hs_save_put` take the account from `_member()` (a player in a game
  session) and no caller-supplied id; the tables carry no grant. `isolation.js` covers both functions across two
  players, an outsider and anon (rerun below).
- The push rate: a battle with a change every 3 s and waves cleared made 3 writes in 3 minutes (probe p4); a change
  in battle waits for 25 s of quiet and waves go at most every 25 s, so a player stays far under the server's 240
  writes an hour. A refused write (429) only backs off; nothing is lost.
- Photos: prompt-, sync- and sync-wait- at desk, ipad and ses are in `top/build/shots/p3/`; looked at (prompt-desk,
  prompt-ses, sync-wait-ses): the question, its two buttons and "The other one is dropped." read cleanly at 667x320.

## What was rerun, and the results

RESULTS_PLACEHOLDER

## What could not be checked

- The keepalive race of finding 4 in a real browser (the window is one write's flight); argued from the server
  function's own check.
- The real Supabase (only the local stack), Safari and a real iPhone (Chromium with an iPhone's size and user agent).
- Iteration on the probes at sizes other than 1600x900: p1, p2, p5 and p6 ran at desk only; the faults are in
  logic that has no size.

## For the other track and the owner

- Gameplay: `councilMerge` keeps the whole side with the larger change count `n` when the two differ, so two
  devices buying different tiers offline keep only one device's tiers (the stars stay unspent, so nothing is spent
  twice). That is gameplay's rule; "two devices in turn" never meets it, devices offline at once do. And finding 11
  (`beyond` against an old `endless`) is a rule for gameplay to confirm.
- The spec's owner: 4.5's rules 2 and 3 need the mark to name the battle it ended (finding 2).
