# Signing in on the staging page: your checklist

This is for you, the owner. It is the first time the game's sign-in meets your own Supabase and the real Google,
Facebook and Discord. Everything here happens on the staging address, **https://highland.avunjian.com/next/**.
The live game does not change, and nothing you do here touches it.

Plan about 30 minutes, with a computer, your iPhone, and (if you have them) an iPad and an Android phone.

At the end there is **one question** for you. Its answer decides whether one more piece of work is built.

---

## Before you start

- [ ] Steps 0 to 5 of the setup guide (`deploy/supabase/README.md`) are done.
- [ ] The builder has said the smoke test passed and that the two public values are in the staging page.
- [ ] `https://highland.avunjian.com/next/` opens the game.
- [ ] Step 3's check reads `"mailer_autoconfirm": false`. If it reads `true`, the game hides the Discord button
      on purpose (an email that Discord never checked must not open someone else's account). Fix it as step 3
      says, or try only Google and Facebook today.

Use a private window on the computer, so the staging page and the live game do not share the browser's memory.

What this version has: sign-in, the name you choose, the welcome card, the Account tab with **Sign out**. What it
does not have yet: your progress saved to your account (it stays on each device for now), the stats page,
"Delete my account" and the full privacy page. Those come in the next pieces of work.

---

## 1. On a computer (Chrome, Edge, Firefox or Safari)

For each of Google, Facebook and Discord:

1. Open `https://highland.avunjian.com/next/` in a private window.
   **You see** the map, dimmed, with a card on it: "Sign in to take command." and three buttons, Continue with
   Google, Continue with Facebook, Continue with Discord (only those your server has switched on). Nothing on the
   map answers a click while the card is up.
2. Press the provider's button.
   **You see** the provider's own page (Google's account chooser, Facebook's login, Discord's authorize page).
3. Sign in there and allow it.
   **You see** the game again, and the address bar shows only `https://highland.avunjian.com/next/`: no `code=`,
   no `hsh=`, nothing after a `#`. The first time with an account, a card asks you to "Choose your player name",
   filled with "Defender" and six digits.
4. Type a name and press **Save name**.
   **You see** "Welcome, <your name>." with your stars and battlefields, a green button ("Begin: Erebuni Rise,
   782 BC", or "Continue: ..." or "Resume: ..." when this browser has progress) and **Campaign Map**.
5. Press **Campaign Map**, then the gear, then **Account and boards**.
   **You see** the Hall on its Account tab: your name, "Signed in with <provider>.", **Change name** and
   **Sign out**.
6. Press **Sign out**, then **Sign out** again.
   **You see** the sign-in card again. The button you used carries a small "Last used" tag.

Then try these once each:

- [ ] Press Google's button, and on Google's page press the browser's **Back** button.
      **You see** "Sign-in did not finish. Try again, or use another account."
      Do it a second time: the card adds "Sign-in is giving trouble." and a **Play now** button, and Play now
      opens the map and lets you play.
- [ ] On the name card, try a name with `<` in it, a name of two letters, and a name somebody already took.
      **You see** a short line under the field each time, and the name is not saved.
- [ ] Reload the page while signed in.
      **You see** "Welcome back, <your name>." straight away, with no sign-in.
- [ ] Sign out, get **Play now** as above, then open the gear, **Account and boards**, and sign in from the
      Account tab's buttons.
      **You see** the Hall again on its Account tab, signed in, with no welcome card in between.
- [ ] The privacy link under the buttons opens a short privacy page, and "Back to the game" returns.
      (The full privacy page, with your name, contact and country, comes later.)

---

## 2. On the iPhone, in Safari

Repeat steps 1 to 6 above in Safari on the iPhone, held sideways, for each of the three providers.

- [ ] Each provider signs you in and shows "Welcome".
- [ ] The cards fit the screen held sideways: nothing cut off, every button reachable.
- [ ] Held upright, the card also fits (the game itself asks you to turn the phone once you are past the card).

---

## 3. On the iPhone, from the Home Screen (the one that matters most)

The game opened from a Home Screen icon is, for iPhone, a separate browser with its own memory. Nobody knows for
sure where today's iPhones send you back after signing in from there. This test finds out.

1. In Safari open `https://highland.avunjian.com/next/`, tap **Share**, then **Add to Home Screen**, then **Add**.
2. Close Safari. Open the game from the new icon on the Home Screen.
   **You see** the sign-in card, full screen, with no Safari bars.
3. Tap **Continue with Google** and sign in.
4. Watch closely what happens, and where. Then go back to the Home Screen game (swipe or tap its icon).

**What you may see:**

- **A.** You stay inside the Home Screen game the whole time (Google's page shows inside it), and it ends on
  "Choose your player name" or "Welcome". This is the good case.
- **B.** Google's page opens in Safari (or in a sheet that slides over the game). Afterwards that Safari page or
  sheet shows the game with **"Sign-in did not finish here. Try again."** Back in the Home Screen game you see
  "Sign-in did not finish. Try again, or use another account." (or still "Opening Google...", with a Back button).
- **C.** Google's page opens in a sheet over the game, the sheet ends on the game's "Choose your player name" or
  "Welcome", and when you close the sheet the Home Screen game is signed in too (it shows the name card or
  "Welcome").
- **D.** Something else. Write down what you saw.

Then, if Facebook and Discord are switched on, try them the same way from the Home Screen game.

Nobody is ever locked out in any of these cases: after two sign-ins that do not finish, the Home Screen game
offers **Play now**.

---

## 4. Other devices and browsers (if you have them)

- [ ] An iPad, in Safari: each provider signs you in.
- [ ] An Android phone, in Chrome: each provider signs you in.
- [ ] Open the staging address from a link inside the Facebook or Instagram app (send it to yourself in a
      message). **You see** "This app's browser can block sign-in. For Google, open ... in Safari or Chrome.",
      with **Copy link** and **Open in browser**, and no Google button. The Facebook button works. Tell the
      builder what **Open in browser** did on your phone (opened Safari or Chrome, or nothing).
- [ ] In Safari's settings switch on **Block All Cookies**, and open the staging page.
      **You see** "This browser is not keeping this site's data", no provider buttons, and **Play now**, which
      lets you play. Switch the setting back afterwards.

---

## 5. When the sign-in service is down

- [ ] On your server, in the Supabase folder, stop the sign-in service: `docker compose stop auth`. Open the
      staging page in a private window.
      **You see**, after at most about 4 seconds, "Sign-in is not answering. You can play now." with
      **Play now** and **Try again**. Play now lets you play.
- [ ] Start it again: `docker compose start auth`. Press **Try again** (or reload): the sign-in card comes back.
- [ ] While signed in on another browser, stop the service again and reload that browser.
      **You see** your "Welcome back" card within about 4 seconds, and you can play. This holds even when more
      than an hour has passed since you signed in there (the sign-in's one-hour pass cannot be renewed while the
      service is down, and the game keeps you signed in anyway). Start the service again afterwards, reload, and
      you are still signed in.

---

## The one question

**When you signed in from the Home Screen game (part 3), where did you land: A, B, C or D?**

Send the builder the letter (and, for D, what you saw). Also say which iPhone and which iOS version it was
(Settings, General, About).

- **A** or **C**: nothing more is built. The Home Screen game signs in as it is.
- **B**: the builder adds a small piece (work package P2b, "the handoff") that brings the finished sign-in back
  to the Home Screen game, and you then run one more file on the server, `schema-handoff.sql`, the same way as
  setup step 4. Until then, players who use the Home Screen game get "Play now" after two tries, and nobody is
  locked out.
- **D**: the builder looks at what you saw before deciding.

---

## What else to send the builder

- [ ] Each line above that did not do what it says, with the device, the browser and the provider.
- [ ] What **Open in browser** did inside the Facebook or Instagram app.
- [ ] A screenshot of any card that did not fit the screen.
