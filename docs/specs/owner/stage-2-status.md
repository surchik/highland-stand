# Where the build stands: stage 2

This is for you, the owner. It says what is now on the staging branch `next`, what you can try once your
Supabase is set up, what the builders need from you, and what is still to build. Nothing here has reached the
live game: `master` and https://highland.avunjian.com are unchanged.

Date: November 12, 2026.

---

## 1. What now exists on `next`

Stage 1 gave the base: the Hall (the page behind the star tally), the War Council, the battle's own clock, the
test stack, your setup guide and the staging address `/next/`. Stage 2 adds four pieces of work.

**Sign-in (P2).**

- With the two public values filled in, a visitor sees a card over the map: "Sign in to take command.", with
  Google, Facebook and Discord. Only the buttons your server has switched on are shown.
- After the provider, a new player picks a name. Then a welcome card leads him in, or back to where he was.
- The Hall gains an **Account** tab: who is signed in, change name, sign out.
- The gate can never trap anyone. If your server is down, slow, or the phone is offline, or the browser keeps
  no site data, the card says so and offers **Play now**. Inside the Instagram or Facebook app (where Google
  refuses to sign in) the card says how to open the game in a real browser.

**Counting what players do, and your stats page (P4).**

- The game tells your server what happens: a page opened, a sign-in, a battle begun, each wave held, a victory,
  stars won, a hero's new level, the Council opened and a tier bought, and so on. No name, no email and no free
  text goes with them.
- Robots, test browsers and the committed page (with the two values empty) send nothing at all.
- `/next/?stats` is your page, and only yours: the first-visit funnel (how many visitors sign in, begin a battle,
  win it), the gate's numbers per provider, who comes back, where players quit, each battlefield's wins, devices,
  and switches (the gate's setting, how long counts are kept). Anyone else who opens it reads "This page is for
  the game's owner."

**Heroes (G3).**

- Each chapter has its captains, who share one level from 1 to 5. They learn from every battle won in their
  chapter. You see them in the War Council tab, under **Captains**.
- In battle the hero has one order, the **Call** (key T, or a second tap on his medallion): for a few seconds
  he holds the foes around him.

**Battlefields of 10 to 20 waves (G4).**

- Each battlefield now has its own length: Erebuni 10, Tushpa 12, and up to 20 on the longest. The brief and
  the map say the length.
- The coached first battle on Erebuni is a little gentler after wave 3.
- Easy and Hard were retuned.
- A battle saved by today's live game (20 waves) still resumes and is fought under its old numbers.

With the two values empty, which is how the page is committed, `next` plays exactly like the game you know, plus
heroes and the new lengths: no sign-in card, and no request to any server.

---

## 2. What you can try on `/next/` once your Supabase is set up

1. Follow the setup guide, `deploy/supabase/README.md`, steps 0 to 5. It takes the longest of anything in the
   program, so it is worth starting now.
2. Hand over the two public values (section 3 below). The builder puts them in the staging page only.
3. Work through `docs/specs/owner/p2-signin-checklist.md`: about 30 minutes, on a computer, your iPhone, and an
   iPad or Android phone if you have them. It walks you through each provider, the name card, the welcome card,
   the Account tab and sign-out, and the cases where the gate must let a player through anyway.
4. Then step 6 of the guide: sign in, make yourself the admin, and open `https://highland.avunjian.com/next/?stats`.
   Play a battle or two on another device and watch the numbers arrive. Your own visits to `?stats` and anyone's to
   `?privacy` are not counted in the funnel.

The checklist ends with **one question** (where an iPhone's Home Screen app lands after a sign-in). Your answer
decides whether one small extra piece (P2b) is built.

What you will not find yet: your progress following you to another device, leaderboards, the share card, the
daily challenge, "Delete my account" and the full privacy page.

---

## 3. What you must hand over, and what you must never hand over

Hand over only these two values (step 5 of the guide):

- the **public https address** of your Supabase, for example `https://supabase.avunjian.com`;
- the **anon key** (Supabase calls it "anon" or "public"). It is meant to be in a web page.

Never hand over, paste in a chat, or put in any file:

- the **service_role key**;
- the **JWT secret**;
- the Google, Facebook or Discord **client secrets**;
- any database password or private key.

These stay on your server only, where steps 3 and 4 of the guide put them. If one of them is ever shared by
mistake, change it on your server at once. The guide says how.

---

## 4. What is still to build

**Platform track**

- **P3, cloud saves:** progress, the Council, the heroes and the battle in progress follow the player's account
  to every device. Sign-out will also save and clear the device, with the words of the spec.
- **P8:** the full privacy page and "Delete my account".
- **P5:** a score on the victory page and leaderboards.
- **P7:** the share card.
- **P6:** the daily challenge's board.
- **P2b**, only if your checklist answer asks for it.

**Gameplay track**

- **G5:** the tray of towers and the Garrison Post (the tower that blocks the road).
- **G6:** the daily challenge's battle, 12 waves.
- **G7a to G7e:** one new tower per era (Horse Lines, Stores, Powder Mine, Aid Post, Observation Post).

**Your rulings, wanted before any leaderboard opens**

- **The War Council is too strong** for the bounds the plan set. With the Council full, the best builds keep
  about 3 more defenders than without it; the bound is 2, and Halidzor is the worst, at 8. Halving every Council
  effect is still not enough. Two ways forward: cut the Council harder, or accept that a full Council makes
  battles easier. Leaderboards wait for this answer.
- **A few battlefields sit outside their difficulty band.** On Normal, Dvin and Sevan each have one test seed
  outside it. On Easy, Erebuni, Dvin and Avarayr keep more defenders than the plan's "about 22 to 27" of 30.
  Accept these, or ask for a new tuning knob.
- The open questions of the rulings still stand, each with its default built: the gate is `required`, the counts
  are kept 180 days, and Discord is held back while email auto-confirm is on.

**Known test flakiness (not a fault in the game)**

- One timing test, `dance10`, fails now and then on the build machine, on every version, the live one included.
  It checks that a tap during the victory dance ends it. Its timing is being looked at.
- Nothing has been tried yet on real Safari, a real iPhone, a real Supabase or the real providers. Your
  checklist is the first such test.
