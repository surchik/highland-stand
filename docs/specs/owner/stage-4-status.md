# Where the build stands: stage 4

This is for you, the owner. It says what is new on the staging branch `next`, what goes live when `master` takes
`next`, every step on your server in order, the balance questions only you can settle, and what is still open.

Where things stand today: the live game (`master`) is stage 3, and since November 17 its page carries your game's
own Supabase (`https://hs-db.avunjian.com`), so sign-in is on at https://highland.avunjian.com. Nothing of stage 4
has reached it. This branch `next` was built and tested with the two public values empty, as the build's rules
ask; see section 2 for what that means once `master` takes it.

Date: November 17, 2026.

---

## 1. What is new on `next`

Stage 3 gave cloud saves, the privacy page, the Garrison Post and the daily's battle. Stage 4 adds nine pieces of
work.

**One new tower for each era (G7a to G7e).** Each opens on its era's battlefields and sits in the tray beside the
six towers and the Garrison Post:

| era | tower | battlefields | what it does |
| --- | --- | --- | --- |
| I | Horse Lines (110 gold, two at most) | Erebuni, Tushpa, Avarayr | riders charge down the road at a crowd, strike every foe on it and throw it back |
| II, III | Stores (160 gold, two at most) | Dvin, Tashir, Sevan, Ani, Mari, Sis | pays gold after each wave; a long wave pays more; one mastery, the Field Forge, mends towers nearby |
| IV | Powder Mine (80 gold) | Gyumri Road, Halidzor | a charge laid on the road; the player fires it with a tap (a click with a mouse) once it is armed |
| IV | Aid Post (60 gold, one) | Van, Musa Dagh, Sardarapat | after a wave with no defender lost, one lost defender returns to the walls, a few in a battle at most |
| V | Observation Post (90 gold, one) | Stepanakert 1992, Shushi, Stepanakert 2023 | marks a foe so every tower hits it harder; its mastery shells the marked foe |

Every one has its own art for each era, a card the first time it is met, a panel, two masteries, and its line in
the War Council's Captains tiers. The towers came out of review with their faults fixed; the balance questions
the bot raised are in section 4.

**The leaderboards (P5).** A signed-in player's victory gets a score, and the score goes on boards:

- a strip on the victory page says the score and the rank ("Score 9,075 · #1 of 1 this week"), or why it is not
  ranked ("Sign in to post it", "Choose a name", "The boards for this version open soon");
- the Hall's Leaderboards tab shows each battlefield's board, this week and all time, and the map has its door;
- a result that is lost to a closed tab or a dropped connection waits on the device and is sent later, and only
  ever as the account that won it;
- the stats page has a switch to close the boards (no new battle is ranked; the boards stay to read), and a card of
  scores to look at (too fast, or perfect), each with Remove and Hide player, for you alone.

**The share card (P7).** After a victory, Share makes a picture of the battle (1200 x 630) with the battlefield's
name, the stars, the defenders kept, the time, the score and rank when there is one, and the player's name. The
sheet offers Save picture, Copy picture and Copy text; an iPhone or iPad shares the file to its own sheet.

**The daily's board and its tab (P6).** The Hall's Daily tab shows today's battlefield and twist, the attempts left
(three ranked attempts a day; one sitting each), today's board, and yesterday's battle with its first three. A
player who is not signed in, or has no name, plays it as practice. The day turns at midnight UTC.

**Your Players view (P10).** As superadmin, `?stats` has a Players tab: every player of the game with email and
names, sign-in provider, first and last seen, visits, time on page and battle clock, battlefields won per
difficulty and held, stars, furthest battlefield, heroes, Council tiers and devices. It sorts, searches and pages,
and each player has a page with his battles and recent visits. Every look you take is written to an audit table.
Only the superadmin sees it; an admin who is not superadmin, a player, another app's user and a visitor are all
refused (tested).

**With the two public values empty**, which is how the page is committed, `next` is exactly the game: no sign-in
card, no request to any server, no score strip, no Share button, no boards and no Players tab.

---

## 2. What goes live when `master` takes `next`

**`master` keeps its own two values.** `next` leaves the two lines untouched, so a merge of `next` into `master`
keeps your address and anon key, and sign-in stays on. Everything of section 1 then goes live at once: the
five towers, the boards, the share card, the daily's board and your Players view.

So the server must be ready **before** that merge: your game's database at migration **8 of 8** (step 1 below).
A stage 4 page talking to a stage 3 database (5 of 5) would ask for functions that are not there yet.

Players' saves keep working: the saves made by today's game (8 kinds, between waves and mid-wave) all resume on
the merged page, and the cloud saves of stage 3 are read as they are (no table changed).

With the two values empty (how `next` is committed and tested) the page is exactly the game: no sign-in card, no
request to any server, no score strip, no Share button, no boards and no Players tab.

**The published `next` is ahead of this one.** GitHub's `next` has 7 commits this branch does not: your staging
page's two values (commit `1860633`), your recordings under `assets/music` and `assets/victory`, and your requests
in `owner-requests-stage6.md`. They were left out of this merge on purpose (this build keeps the values empty);
they must be merged in before this `next` is published, or the publish is refused.

---

## 3. Your server, in order

You chose a Supabase of the game's own (`deploy/hs-supabase/README.md`, `hs-db.avunjian.com`). On it:

1. **The migrations.** `./migrate.sh` clones branch `next` from GitHub and applies what it finds. Run it only once
   this stage's `next` is published there (until then it finds 5 of 5), or point it at a checkout of it with
   `HS_GAME_DIR=...`. It dumps the schema first. Stage 4 brings three: `006_superadmin`, `007_scores` and
   `008_daily`. **Check:** `highland at 8 of 8`, and `POST /rest/v1/rpc/hs_config answers 200`. Each has its
   rollback (the tool's `down 5 --yes` goes back to stage 3's five).
2. **Then** merge `next` into `master` (section 2).
3. **Make yourself the superadmin** (`docs/specs/owner/superadmin.md`). Sign in to the game with Google, Facebook
   or Discord under your address (not by email and password: the Players view refuses such a sign-in) and choose a
   name. Then on the server open `psql` with its history off:

   ```
   docker exec -it -e PSQL_HISTORY=/dev/null hs-db psql -U postgres -h 127.0.0.1 -d postgres -X
   ```

   and in it, typing your address only when it asks:

   ```sql
   \prompt 'Your address: ' addr
   select highland.hs_grant_superadmin_by_email(:'addr');
   ```

   As a single line, the command is `select highland.hs_grant_superadmin_by_email('THE_ADDRESS');`, with
   `THE_ADDRESS` your address. Never type it in a file, a script or a shell command. If `show log_statement;` says
   `all`, run `set log_statement = 'none';` first in the same `psql`. **Check:** it answers
   `superadmin: account <id> (game name ...)`, and `?stats` shows the Players tab. It makes you an admin too.
4. **Open the boards** (`deploy/supabase/README.md`, step 7): on `/next/?stats` press **Publish ruleset 2** on the
   Rulesets card (the staging page publishes its own, `2-next`, kept apart from the live game's), and on `/?stats`
   once the live page is stage 4. Do it again after every build whose Health card says the server does not have its
   ruleset. Until then every victory says "The boards for this version open soon".
5. **Try it on `/next/`** before the merge of step 2 if you can: sign in, win a battle, see the score and the
   board, the share card, the Daily tab, and the Players tab.

No shared setting of the other apps' Supabase is needed: your game's own stack has its own. **If you ever move the
game to the shared Supabase instead**, its steps are in `deploy/supabase/README.md` and
`docs/specs/owner/shared-supabase-plan.md`: the migrations (8 of 8), then three shared changes, each with your yes,
alone, one at a time, each a short blip of sign-in for every app: (a) serve the schema `highland`, (b) add the
game's two return addresses, (c) a sign-in provider that is off, one provider per yes.

---

## 4. Balance cells for you to rule on

The bot measured every new tower against the plan's bounds (gameplay spec 5.2). These miss them. Each builder
left the numbers as they are and recommends a ruling. The tables are in `docs/specs/balance/README.md`, in each
package's "close" section.

**From stage 3, still open (the Garrison Post, G5):** the mixed build with the post keeps 0.8 more defenders on
average (the plan wants 1 to 3), much more on Van (+9.3) and Musa Dagh (+7.0); a board of half posts keeps too
many on Tashir; Tushpa 17.3 on Normal; the full Council gains more than 6 on Van and Halidzor.

**Horse Lines (G7a):**
- They are in no battlefield's best build (0 of 3 on Normal; the plan wants a third). The review's tuning pass
  (reach 150 to 180, a price of 80) did not change that. Rule: accept, or name a knob.
- The endless stand: the mixed build falls 0 to 2 waves beyond the chronicle on Erebuni and 2 to 3 on Avarayr, 20 on Tushpa (the plan
  wants 8 to 20). The cause is the Garrison Post's board, not the horse.

**Stores (G7b):**
- Tashir is a trap at 160 gold: the greedy build ends 4.3 defenders under the mix. The candidate fix: the first
  Stores at 120, the second at 200 (greedy then wins 3 of 3, 1.3 under the mix). It is not in the page.
- Not met: the Stores in the best build on a third of their fields (1 of 6 on Normal), the gold earned (6 to 10%
  above the mix on 4 of 6), greedy's end on Tashir and Mari, and the endless stand.
- The War Council's margin on the six Stores battlefields is 0.04 of a defender.

**Powder Mine (G7c):**
- A commander counts as three foes for the mine's blast (`MINE_RULES.boss`). This is new behavior; rule on keeping
  it. Counted as one, no mine build is ever the best.
- A mastered mine is the strongest tower per gold in the bot's hands (about twice a mastered catapult). Worth
  watching in the stats.

**Aid Post (G7d):**
- Musa Dagh misses the post's row on Normal (+4.0) and Easy (+3.0): the mix there holds its last commander with
  0.1% of the road to spare. The review recommends reading the row only where the mix holds with a margin.
- The bot's own rules for the post (its pad, when it ranks it, cut prices) differ from the spec. Rule whether they
  stand.

**Observation Post (G7e):**
- The endless stand on Stepanakert 1992: 4 waves beyond against 8 to 20 (not caused by the post).
- The post is worth about 5 defenders to a board that builds it but never earns its pad in the best build. The
  knob is its price (90).
- The daily's "aid" twist gives +6.0 on Stepanakert 2023 (reported; the plan sets no bound).

**The daily (G6 and P6):** the same twist can come two days running (7 times in 136 days), and "Iron ranks"
barely changes a battle. Options: Iron ranks at +5 armor, or a different walk through the twists (the server's SQL
changes with it).

**Two smaller rulings (P7):** victories won with help (the test purse, test mode) and endless stands get no share
card; and whether the share card may read the game's field box to draw the battle. Both builders' readings are in
the page now.

---

## 5. What is open

**The rulings of section 4**, ideally before the boards open: a change of balance after the boards open starts
new boards for the battlefields it touches.

**The page's first self-test is over its time limit.** All 151 of its checks pass, but it takes 134 to 137 seconds
against its 125. The page from before this stage takes as long on the same machine (135 s), so this stage did not
cause it; the build machine has grown slower since stage 3 (109 s then). It needs either a faster test or a new
limit; nothing in the game is wrong.

**Four packages carry no "done" mark** because of that test's time alone (the Daily board, the Observation Post),
or because their close was cut short (the Horse Lines: its last checks were never run by its builder; the Aid Post:
Musa Dagh's cell above). This merge ran the whole list on all of them together, and it passed (section 6).

**Owner requests queued after this stage:** remove the Standard battle switch (and say how the boards should rank
then); a real kef or zurna recording for the victory music, under a license you hold; the explainer videos of
stage 5.

**Not tried yet:** stage 4 on your real server (the boards, the daily's board, the share card and the Players view
were tried only on the build's stand-in of Supabase), real Safari and a real iPhone. Step 5 of section 3 is the
first such test.

---

## 6. How this stage was checked

Every check below was run to its end on the merged page, on a quiet build machine (no other build running):

- The page's own checks: the second self-test suite (57 checks) passed; the first (151 checks) passed every check
  but missed its time limit, as said in section 5. The saves of today's players (8 kinds) all resume. The hidden
  town stays hidden (9 cases).
- The whole regression suite, 11 scripts in 92 minutes, all passed. Among them: every battlefield won by press at
  three sizes, 797 screens at ten iPhone sizes, every wave of all 17 battlefields, every new tower placed, pressed
  and fought, and every platform flow (sign-in, saves, deletion, the boards, the share card, the daily's board, the
  Players view) at five sizes: 182 screens checked.
- The bot on Normal, one seed, on Erebuni, Avarayr, Tashir, Gyumri Road, Van, Stepanakert 1992 and Sis: every one
  is held by the mixed builds, and every cell is the same as on the gameplay track's own page.
- The server side on the test stand-in of your server: the database rules (1,040 checks), the walls between
  players, an outsider, visitors and an admin who is not superadmin (448 checks), the restore of a backup (22
  checks), the eight migrations applied, rolled back to 7, to nothing, and applied again with the same result, the
  guide's own commands (23 checks), the by-hand deletion of the privacy checklist, and `update.sh` (36 cases).
- By hand, through the test stand-in with the two values filled, at 1600 x 900 with a mouse, 1194 x 834 by touch
  and 667 x 320 as an iPhone: sign in with Google and choose a name, build the Horse Lines on Erebuni and fight a
  wave with them, win and see the score posted ("Score 9,075 · #1 of 1 this week"), see the board, open the share
  sheet and save the picture, open the Daily tab (today: Erebuni, Forced march), fight a ranked attempt and see the
  daily's board, then grant the superadmin through the stand-in's database and open the Players tab and the
  player's page.
- With the two values empty: no sign-in card and no request to any server, at `/` and at `/next/`, at all three
  sizes; at `/next/` every saved key starts with `next:`.
