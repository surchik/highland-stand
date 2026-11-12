# Review of P2: sign-in and the gate

Package commit d5cb2a5 on `pf/work` (started from 5cf786b, the merge of `next` d0c334c). Reviewer: an independent
agent that did not build it. Probes and their output are kept outside the repository, under the session's
scratchpad (`top/build/review/P2/`: `probe.js`, `probe10.js`, `probe-out.txt`, `mut/`, `logs/`).

REVIEW P2: 0 blockers, 2 majors, 10 minors.

No finding makes a wall: in every state tried, a visitor reaches the map and plays. Off means off: with the two
constants empty the page is pixel for pixel the page before and makes no request. The two majors are a sign-in
that can never succeed on a device whose clock runs fast, and a session thrown away by a network failure.

## Findings

### 1. Major. A device whose clock runs more than 10 minutes fast can never sign in

`pfSignIn` stores the start time with the server's clock, `t: pfNow()` (index.html 78254). On the sign-in load
`pfClockOff` has been set by `hs_config`'s `now`. The return is a new load, and `pfTakeSignIn` checks the age
before any `hs_` call (78268, `pfNow() - pk.t < 600000`), so there `pfNow()` is the device's own clock. On a device
X minutes fast the age reads X minutes plus the real time. Past 10 minutes the verifier is thrown away as stale and
the code then fails as `no_verifier`.

Evidence (`probe.js`, `Date.now` shifted 15 minutes ahead in an init script, the stack's Google sign-in as "aram"):

```
clockfast after return: {"st":"signin","text":"... Sign-in did not finish here. Try again. ...","auth":false}
clockfast signin_error: [{"provider":"","error":"no_verifier","standalone":false}]
clockslow after return: {"st":"name","auth":true}      (15 minutes slow: works)
```

Every attempt fails the same way; after two the card offers Play now, so it is not a wall, but such a player can
never have an account. Phones with a hand-set clock, and PCs with a dead clock battery, exist.

Fix: measure a sign-in's age in one clock. Store `t: Date.now()` (the device's clock, which both loads share) and
compare with `Date.now()`; keep `pfNow()` for what is sent to the server. Also refuse an age below about -60 s (a
clock moved back) so a stale verifier is not kept forever. Add to flow 3: a context with `Date.now` 15 minutes
ahead signs in and reaches the name card.

### 2. Major. A network failure ends a signed-in player's session (1.4 and 3.6 say it must not)

In `pfWithSession` (78711 to 78716): when the access token has under 90 s left, `hs_profile_get` goes through
`pfApi(..., { auth: true })`, which refreshes first; a refresh that fails for the network makes `pfApi` answer
`{ status: 401, code: "no_session" }` (78155) without any call. The code then takes that 401 as a refusal: it tries
`pfFresh(true)`, which returns false at once because the 30 s wait has begun (78207), and then
`pfDrop("hs_pf_auth")`. The same happens when the server answers 401 for a token the device thinks fresh and the
refresh then fails for the network. Spec 1.4: "A refresh that fails with status 0 or 5xx: the session stays".
Spec 3.6, fourth row: "no gate at all: the player is treated as signed in".

The common case is exactly this one: a player who comes back more than an hour after his last visit (the access
token lives one hour) while offline or while Auth is down or slow. Evidence (`probe.js`: sign in, set
`hs_pf_auth.exp` one minute in the past, reload):

```
expired-authdown after reload: {"st":"down", "Sign-in is not answering...", "sessionKept":false, "sec":"2.7"}
expired-authdown Auth back, next load: {"st":"signin","sessionKept":false}
expired-offline after reload:  {"st":"down", "You are offline...", "sessionKept":false}
expired-authhang after reload: {"st":"down", "Sign-in is not answering...", "sessionKept":false, "sec":"10.0"}
refresh503 after reload:       {"st":"down", ..., "sessionKept":false}   (server took the token as ended; Auth 503)
```

The refresh token was still good; the player must sign in again once Auth is back. Flow 11's "signed-in player
with Auth and the database down" passes only because its token was minutes old. The owner's checklist, part 5,
last bullet, will show this bug if he waits more than an hour after signing in.

Fix: let `pfApi` tell the two apart: when `pfFresh` fails for the network (or the 30 s wait), answer
`{ ok: false, status: 0, code: "network" }`, and answer `no_session` only when the session is gone or was refused
(`pfRefreshRefused` with the access token ended). In `pfWithSession` drop the session only after a refusal the
server made (a 401 from PostgREST after a refresh that itself answered ok, or a refresh answered 4xx); for status
0 or 5xx keep it, use `hs_pf_me`'s name and show the welcome card. Add to flow 11: the same player with an access
token past its end, Auth down, and offline: welcome card, session kept, and signed in on the next load with Auth up.

### 3. Minor. The checking card stays up 10 to 12 s, not "at most 4 s" (3.1)

With a session near its end and Auth hanging, the load waits for the refresh (4 s), then `hs_profile_get` (4 s),
then a forced refresh and a second `hs_profile_get`. Measured: 11.5 s with Auth and REST hanging and a token 30 s
from its end (`probe.js` checkingtime), 10.0 s in the expired case above. The exchange of a code also has 8 s.
Nothing is a wall (each wait has a limit), but 3.1 and 3.9 promise about 4 s.

Fix: give the whole signed-in branch one deadline of 4 s (a `Promise.race` around the refresh plus profile read);
when it passes show the welcome card from `hs_pf_me` and let the calls finish behind it. The builder's report says
the exchange's 8 s is a known difference; keep it, but say so in the spec's table.

### 4. Minor. A second tab of the game opened during a sign-in ends that sign-in

`pfTakeSignIn` treats any load with a fresh `hs_pf_pkce` and no code as "came back without signing in" and drops
the verifier (78294). The verifier is shared by every tab of the origin. So a second tab opened while the first
waits on the provider's page (a second tap on a shared link, a restored tab) throws away the first tab's verifier,
and the first tab's return then fails as `no_verifier`.

```
secondtab A after return: {"st":"signin", ..., "auth":false}
```

Spec 1.2 step 4 reads the same, so this follows the letter, but it costs two failures for nothing. Fix: mark the
tab that began the sign-in in `sessionStorage` (it survives the trip to the provider in that tab and in no other)
and count "abandoned" only in a load whose `sessionStorage` holds the mark; elsewhere leave `hs_pf_pkce` alone
(its 10 minute age still clears it).

### 5. Minor. Coming back to a waiting page after 1.5 s counts an abandoned sign-in

The `visibilitychange` handler (78316) drops `hs_pf_pkce` and counts a failure when the page becomes visible in the
`leaving` state 1.5 s or more after the tap. On a slow network the browser has not yet left; a player who switches
app or tab while the provider's page loads, and comes back, loses the verifier, and the provider's return then
fails as `no_verifier`. The builder meant it for the Home Screen app (an addition to 1.6). Not reproduced in a
browser (Playwright leaves at once); found by reading.

Fix: run that branch only where it is meant, `pfStandalone()` true, and there only show the buttons again without
dropping `hs_pf_pkce` (a real return still finds it; the 10 minute age clears it otherwise).

### 6. Minor. Restored from the back-forward cache while signed in, the page shows the sign-in card

`pageshow` with `persisted` (78301): with no `hs_pf_pkce` and the gate in `leaving`, it shows the sign-in card, even
when another load of this browser has finished the sign-in into storage. The `visibilitychange` twin checks
`pfSession()` and reloads; this one does not. Found by reading. Fix: `if (pfSession()) { location.reload(); return; }`
first.

### 7. Minor. A sign-in begun on the Account tab does not come back to it

`back: "hall"` is stored (1.2 step 2) but used only in mode `off` (78730). In `required` and `optional` the return
shows the welcome card and then the map. `probe.js` hallback: `{"st":"name","hall":false}`. Fix: in `gateWelcome`,
when the sign-in just finished with `back === "hall"`, make Campaign Map (and the lead button's absence of choice)
open the Hall on Account after `onMap`, or skip the welcome card and open the Hall at once.

### 8. Minor. Tab does not cycle inside the card (3.3: "Tab cycles inside the card")

Pressing Tab 14 times on the sign-in card: `gate, gate, privacy, OUT:BODY, gate, ...`; once a round the focus
leaves the card for the document body (`probe.js` tab). Nothing of the game is reached (it is `inert`), so this is
only the promise of 3.3. Escape does nothing, as it should. Fix: a keydown handler on `#gate` for Tab and
Shift+Tab that wraps from the last focusable element to the first and back.

### 9. Minor. A framed page whose sandbox blocks pop-ups has no way forward

In a frame the provider buttons only call `window.open(location.href, "_blank", "noopener")` (78249). Inside a frame
sandboxed without `allow-popups` that does nothing (and with `noopener` the call returns null either way, so the page
cannot tell). The card then has no Play now (fails stays 0). The visitor can still open the address himself, so it
is not a wall for the game, but the frame is one. Found by reading. Fix: in a frame, render the line's "its own tab"
as a real link (`<a target="_blank" rel="noopener" href=location.href>`) and add Play now to the framed card.

### 10. Minor. An error code from the address goes into an event as it came

`signin_error.error` is `String(error).slice(0, 40)` of the address's `error_code` or `error` (78273). Anyone can
craft that address, so 40 characters of free text go into the event queue. 7.2 says props are "numbers, booleans
and ids, no free text", and the stats page will show them. Fix: keep it only when it matches `/^[a-z0-9_]{1,40}$/`,
else `"other"`.

### 11. Minor. The tests miss the state check, the clock and the expired session

Mutations of the page, each run with its flow at 1600 x 900:

| mutation | flow | result |
| --- | --- | --- |
| `history.replaceState` removed from `pfTakeReturn` | 2 | FAIL, 12 failures (caught) |
| Play now after three failures instead of two | 3 | FAIL (caught) |
| Discord not held back under `mailer_autoconfirm` | 1 | FAIL (caught) |
| `inert` not set under the gate | 1 | FAIL (caught) |
| the `hsh` check removed (`if (!pk) return fail(...)`) | 3 | **PASS** (not caught) |

No flow returns a code whose `hsh` differs from a stored sign-in's `h`, so the state check could vanish unseen.
Nor does any flow cover findings 1 and 2. Fix: in flow 3, start a sign-in, change the stored `h`, finish it: the
card must say "Sign-in did not finish here." and no session be made; add the two checks named in findings 1 and 2.

### 12. Minor. A failed write of the verifier is not noticed

`pfWrite` swallows a full or failing store. If `hs_pf_pkce` cannot be written, the browser still leaves for the
provider, the return fails as `no_verifier`, and the failure count (also a write) may not rise either, so Play now
may never come. My probe could not fill Chromium's store to the edge (the 200-byte test still found room), so this
is from reading only. Fix: in `pfSignIn` read `hs_pf_pkce` back before `location.assign`; if it is not there, show
the `nostore` card instead of leaving.

## What was checked and found sound

- PKCE: the verifier is 128 hex characters from `crypto.getRandomValues` (64 bytes), the challenge is S256 by the
  page's SHA-256 (unit.js holds it to Node's and to `crypto.subtle`'s), `hsh` is 32 random bytes, the verifier is
  used once and removed on every path; a code, `hsh`, `error*` and the fragment are wiped with `history.replaceState`
  as the script starts (before any event); after Back from a finished sign-in the history holds no code
  (`probe.js` backafter: the previous entry is the plain `/`). `redirect_to` is built from `location.origin` and
  `pathname` only. Tokens are kept only in `hs_pf_auth`; provider tokens are dropped.
- Requests go only to `PF_URL` (`credentials: "omit"`, `redirect: "error"`); the test window `__HS_PLATFORM_TEST`
  is read only on 127.0.0.1 or localhost.
- Text from the server or the address is set with `textContent` everywhere; `innerHTML` holds only constants (the
  three marks and the crest). The toasts that carry a name go through `richText`, which escapes.
- Off means off: served over http with the constants empty, `?code=abc&hsh=def#x=1` stays in the address, no
  request but the page, no `hs_pf_` key, no `pfOn`, tabs `["council"]`. compare-shots: 40 of 40 pairs the same.
- The cards at the ten iPhone sizes of `iphone.js` (sign-in, in-app sign-in, name and welcome; 40 cards) pass the
  iPhone audit (`probe10.js`), as do the five sizes of `platform.js`. Words checked against 3.3 to 3.6: they match,
  with no long dash. Android web view: no Google, `intent://` link.
- The seam: only PF-0, PF-CSS, PF-HTML and PF-MAIN changed in `index.html` (the diff's six hunks; the one git
  labels `townSelftest` is PF-MAIN's own header comment). No gameplay function edited.
  `Platform.blocking()` is true while the gate or the privacy page is up; Account is pushed after the Council
  (`tabs council,account`).

## Reruns

| command | result |
| --- | --- |
| `node deploy/check-page.js index.html` | OK |
| `timeout 900 node tools/selftest.js --suite=all` | suite 1 PASS, 151 checks, 120.2 s of 125 (machine loaded); suite 2 PASS, 22 checks |
| `node tools/run-fixtures.js check` | PASS, 2 fixtures |
| `node tools/town-isolation.js` | PASS, 9 cases |
| `node tools/platform/unit.js` | 143 checks, 0 failed |
| `node tools/platform/sql-tests.js` | 494 assertions, 0 failed |
| `bash tools/platform/test-update.sh` | PASS, 36 cases |
| `node tools/regress/platform.js --photos=...` | PASS, 20 runs (flows 1, 2, 3, 11 at 5 sizes), 45 states, 584 s |
| `node tools/platform/compare-shots.js <5cf786b page> index.html` | 40 pairs, all the same |
| `node tools/platform/p0.js` | PASS, 0 failures, 323 s |
| `node tools/regress/run-all.js --quick` | 10 of 10 PASS (padplace, plots, probe, vic, nag, dance10, live, doors, iphone, platform), 899 s; dance10 and nag passed this time |
| `node tools/regress/run-all.js --only=iphone,doors,vic` | iphone PASS (697 states, 10 sizes, 547 s); doors PASS; vic FAIL in the first run: its renderer was killed by the kernel for memory (cgroup OOM, a 7.4 GB renderer, at 1440x900 Shushi and Stepanakert) while the other track ran browsers. vic loads `file://`, where the platform is off. Rerun alone (`run-all.js --only=vic`): PASS, 17 battlefields, 773 s. A load failure. |
| `probe.js` (reviewer) | findings 1 to 4, 7, 8; the sound items above |
| `probe10.js` (reviewer) | 40 cards at the ten iPhone sizes, 0 failing |
| mutations (finding 11) | 4 caught, 1 not |
| secrets grep (`git grep` for JWT shapes, private keys, `JWT_SECRET=`, `client_secret`, provider secrets) | only Supabase's published placeholders in the guide and `guide-check.sh`; both constants empty in the page |

## Not checked

- Safari, iOS, the Home Screen app, a real Supabase and the real providers (no device or network here): findings 5,
  6 and 9 and the bfcache path are from reading only.
- A store filled to the last byte (finding 12).
- The owner's checklist was read against the spec and the code; its part 5, last bullet, fails today after an hour
  (finding 2); otherwise it says what the page does.
