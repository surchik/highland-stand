# Where the build stands: stage 4

This is for you, the owner. It says what is new on the staging branch `next` (and so at `/next/` once it is
published there), what goes live when `master` takes `next`, every step on your server in order, the balance
questions only you can settle, and what is still open. Nothing here has reached the live game: `master` and
https://highland.avunjian.com are unchanged.

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
| II, III | Stores (160 gold, two at most) | Dvin, Tashir, Sevan, Ani, Mari, Sis | pays gold after each wave; a long wave pays more; its forge mends nearby towers |
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

With the two public values left empty, the live game gets everything of the gameplay track from stages 2 to 4 and
nothing that needs a server:

- the heroes and the Call, battlefields of 10 to 20 waves, the War Council and its Standard switch;
- the Garrison Post and the five new towers of section 1;
- the daily challenge, played on the device (no attempts counted, no board);
- the privacy page.

Players' saves keep working: the saves made by today's game (8 kinds, between waves and mid-wave) all resume on
the merged page. Sign-in, cloud saves, scores, boards, the share card, the daily's board and the Players view
switch on only when you hand over the two public values and they are put in the page.

---

## 3. Your server, in order

There are two ways to give the game its database. Choose one.

- **The shared Supabase** (the plan of stage 2): the game lives in its own schema `highland` beside the other apps.
  Guide: `deploy/supabase/README.md`; checklist: `docs/specs/owner/shared-supabase-plan.md`.
- **A Supabase of the game's own** (added Nov 16): a second, slim stack beside the existing one, which it never
  touches. Guide: `deploy/hs-supabase/README.md` (`install.sh`, `migrate.sh`, `caddy.sh`, `providers.sh`,
  `show-public.sh`, in that order). Its steps replace steps 3 to 5 below; steps 1, 2 and 6 to 9 are the same.

On the shared Supabase, in this order:

1. **Look first, read only** (guide step 0): nothing is changed.
2. **The tunnel and a backup** of the schema `highland` before every change (guide steps 1 and 2).
3. **The migrations** (guide step 3), from the game's repository on your computer:
   `node tools/platform/migrate.js status --dsn="$HS_DB_URL"`, then
   `node tools/platform/migrate.js up --dsn="$HS_DB_URL"`. Stage 4 brings three new ones:
   `006_superadmin`, `007_scores` and `008_daily`. **Check:** `status` says `highland at 8 of 8`. Each has its
   rollback (`migrate.js down 5 --dsn=... --yes` goes back to stage 3's five).
4. **The shared changes, each with your yes, alone, one at a time** (guide step 4; a backup of the two files
   before each; each restart blips sign-in and the REST API of every app for a few seconds):
   - a. serve the schema `highland` (append it to `PGRST_DB_SCHEMAS`);
   - b. add the game's two return addresses to `ADDITIONAL_REDIRECT_URLS`;
   - c. a sign-in provider, only one that is off, one provider per yes.
5. **Hand over the two public values** (the address and the anon key; guide step 5). Never the service key, the
   JWT secret, a provider's secret or a password.
6. **Make yourself the admin** (guide step 6): sign in on `/next/`, choose a name, then through the tunnel
   `insert into highland.hs_admins (user_id) select id from auth.users where email = 'you@example.com';`
   (or skip this and do step 7, which makes you admin too).
7. **Make yourself the superadmin** (`docs/specs/owner/superadmin.md`). Sign in to the game with Google, Facebook
   or Discord under your address and choose a name. Then, through the tunnel:

   ```
   PSQL_HISTORY=/dev/null psql "$HS_DB_URL" -X
   ```

   and in it, typing your address only when it asks:

   ```sql
   \prompt 'Your address: ' addr
   select highland.hs_grant_superadmin_by_email(:'addr');
   ```

   As a single line, the command is `select highland.hs_grant_superadmin_by_email('THE_ADDRESS');`, with
   `THE_ADDRESS` your address. Never type it in a file, a script or a shell command. If `show log_statement;` says
   `all`, run `set log_statement = 'none';` first in the same `psql`. **Check:** it answers
   `superadmin: account <id> (game name ...)`, and `/next/?stats` shows the Players tab.
8. **Open the boards** (guide step 7): on `/next/?stats` press **Publish ruleset 2** on the Rulesets card (the
   staging page publishes its own, `2-next`, kept apart from the live game's). Do it again on `/?stats` once the
   game is live there, and after every build whose Health card says the server does not have its ruleset.
9. **Try the checklists on `/next/`:** `docs/specs/owner/p2-signin-checklist.md` (sign-in) and
   `docs/specs/owner/p8-privacy-checklist.md` (section 1, the six places to fill on the privacy page; section 4,
   the deletion; it now also removes a superadmin's row).

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

RESULTS_OPEN

---

## 6. How this stage was checked

RESULTS_CHECKED
