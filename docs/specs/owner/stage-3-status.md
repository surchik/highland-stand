# Where the build stands: stage 3

This is for you, the owner. It says what is new on the staging branch `next` (and so at `/next/` once it is
published there), what needs your server, what you must fill on the privacy page, and what is still to build.
Nothing here has reached the live game: `master` and https://highland.avunjian.com are unchanged.

Date: November 16, 2026.

---

## 1. What is new on `next`

Stage 2 gave sign-in, the stats page, heroes and battlefields of 10 to 20 waves. Stage 3 adds four pieces of work.

**Cloud saves (P3).** Once a player is signed in, his progress follows his account to every device:

- the battlefields won and their stars, the War Council's tiers, the heroes' levels, and the battle in progress;
- a battle saves to the server after each wave, and again as the page is closed;
- a second device signed in to the same account picks up where the first one left off;
- a guest who has played before signing in keeps what he won: it is joined with the account, the best of both;
- if two devices each hold a different battle in progress, the welcome card asks which one to keep;
- a device's own settings (music, sound) stay on that device;
- sign-out saves first, then clears the device. With no connection it asks before it signs out.

**The privacy page and "Delete my account" (P8).**

- `?privacy` is the full privacy page: what the game counts, what it keeps, where, for how long, and how to
  delete it. It works with the platform off too.
- The Hall's Account tab has **Delete my account**. It asks once, then removes the player's name, progress,
  scores and counts from your server and from the device. As you approved (ruling S10), it never touches the
  sign-in account itself, which belongs to every app on your server.
- If the account is deleted on one device, another device or another open tab signed in to it clears itself too,
  so the progress cannot come back.

**The Garrison Post (G5).** The tower that blocks the road:

- It sends a few men onto the road in its reach. They hold the foes they meet until they fall, then come back.
- The player can move their rally point with a tap.
- It opens with Tushpa and costs 70. Each era gives it its own soldiers and its own name.
- Commanders take only a small part of the men's blows, so a board of posts alone does not win.
- The tray now holds the six towers plus the post. The War Council's Captains tiers name the post.

**The daily challenge (G6).** One battle a day, the same for everyone:

- A horn on the campaign map opens it once Erebuni is won. On a phone it carries the word "Daily".
- Every daily is 12 waves on Normal, in the standard loadout (no Council), with one twist of the day, such as
  No Rock Fall or Thin purse.
- It gives no stars and keeps no records. It gives the hero experience, once a day.
- A lost daily's end page says how many of the 12 waves were held.

**With the two public values empty**, which is how the page is committed, `next` plays like the game you know,
plus heroes, the new lengths, the Garrison Post and the daily: no sign-in card, and no request to any server.

---

## 2. What needs your server

Nothing new is needed on your server beyond what `docs/specs/owner/shared-supabase-plan.md` already lists, but
the list now ends at migration **5 of 5**:

1. The game's own schema: `node tools/platform/migrate.js up` (section 2 of that plan). Migration 005 is P8's
   deletion. `migrate.js status` must say `highland at 5 of 5`.
2. The shared changes of its section 3, each with your yes, one at a time: serve the schema `highland`, add the two
   return addresses, and a provider where one is off.
3. Then hand over the two public values (the address and the anon key). Never hand over the service key, the JWT
   secret, a provider's secret or a password.
4. Then try the checklists on `/next/`:
   - `docs/specs/owner/p2-signin-checklist.md` (sign-in);
   - `docs/specs/owner/p8-privacy-checklist.md`, section 4 (the deletion, with a second device in step 7).

What only your real server can show is in section 5 of the plan. After a token refresh, the sign-in service must
still mark the session as a Google, Facebook or Discord sign-in, or the game refuses the player's calls.

---

## 3. What you must fill on the privacy page

Before the sign-in is switched on for everyone, fill the six marked places on `?privacy`
(`docs/specs/owner/p8-privacy-checklist.md`, section 1). Each shows with a dashed outline until it is filled:

| place | what to put there |
| --- | --- |
| `name` | your name, or the name you publish the game under |
| `email` | the address people write to about their data |
| `days` (twice) | how many days your web server keeps its access logs |
| `country` | the country your server stands in |
| `date` | the day you publish the filled page |

Two decisions of yours go with it:

- **A child's account.** The checklist's section 1 asks you to choose: remove a child's game data and then his
  sign-in account (after checking your other apps), or change the page's sentence on children.
- **"Remove my sign-in too".** If someone asks for that, follow section 3's order: the game's data first, then
  the sign-in account.

Have the page read by someone who knows your country's law. This is not legal advice.

---

## 4. What is still to build

**Platform track**

- **P5:** a score on the victory page, and the leaderboards.
- **P6:** the daily challenge's board, and the daily's door in the Hall.
- **P7:** the share card.
- **P2b**, only if your sign-in checklist's last answer asks for it.
- Stage 4 (queued): your superadmin Players view.

**Gameplay track**

- **G7a to G7e:** one new tower per era (Horse Lines, Stores, Powder Mine, Aid Post, Observation Post).

**Your rulings, wanted before the leaderboards open**

The bot measured the Garrison Post against the plan's bounds. These miss them; the builders recommend accepting
them or naming a knob to turn:

- The mixed build with the post keeps on average 0.8 more defenders than without it (the plan wanted 1 to 3).
  It is much stronger on Van (+9.3) and Musa Dagh (+7.0), and weaker on Mari (-10) and Sis (-5).
- A board of half posts keeps too many defenders on Tashir (19.3 on Normal, 13.0 on Hard) and on Musa Dagh on
  Hard (9.0, the band is 2 to 8). It is a Tashir cell, not the post's price.
- Tushpa keeps 17.3 on Normal (above the band of 16). Erebuni's and Tushpa's waves take 16% to 18% longer.
- With the full War Council, Van (+6.7) and Halidzor (+6.3) gain more than the 6 the plan allows on one field.
- The daily's twist **Iron ranks** barely changes a battle and is served most often (28 of 136 days), and the
  same twist comes two days running 7 times in 136 days. Options: Iron ranks at +5 armor, or a different
  walk through the twists (that needs the server's SQL changed with it).
- Two devices that buy different Council tiers offline at the same time keep only one device's tiers.

**What has not been tried**

Nothing has been tried yet on real Safari, a real iPhone, your real Supabase or the real providers. Your two
checklists are the first such test.

---

## 5. How this stage was checked

TESTS_GO_HERE
