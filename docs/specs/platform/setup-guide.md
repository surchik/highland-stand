# Setting up accounts for Highland Stand

(Draft of `deploy/supabase/README.md`. Written for the game's owner. No programming is needed: each step says
what to click or paste, and what you should see when it worked.)

The game's page talks to **your own Supabase**, the one already running on the same server as the game. This
guide makes that Supabase reachable from the game, lets players sign in with Google, Facebook and Discord,
creates the game's tables, and ends with a checklist to try it all on the staging address before it goes live.

Words used below:

- **the Supabase address**: the public https address of your Supabase. This guide writes
  `https://supabase.avunjian.com`. If yours is different, use yours everywhere.
- **the callback address**: `https://supabase.avunjian.com/auth/v1/callback`. Each provider asks for it.
- **the Supabase folder**: the folder on the server that holds Supabase's `docker-compose.yml` and `.env`.

Two rules about secrets:

1. A provider's **client secret**, the **JWT secret**, the **service role key** and the database password
   live only in the Supabase folder's `.env` file on the server. Never paste them into a chat, an email, the
   game's repository or the game's page.
2. Two values are **public by design** and are the only ones the game's builder needs from you: the Supabase
   address and the **anon key**.

---

## Step 1. Give the Supabase a public https address

Skip this step if `https://supabase.avunjian.com/auth/v1/` already answers (try the check at its end).

1. **DNS.** Where avunjian.com's DNS is managed, add an A record: name `supabase`, value `76.13.121.176`
   (the same server as the game).
2. **The web server.** The game's server already runs a web server with https (Caddy or nginx). Add the
   Supabase to it. Supabase's own gateway listens on port 8000 of the server.

   If the server runs **Caddy**, add to `/etc/caddy/Caddyfile` and run `systemctl reload caddy`:

   ```
   supabase.avunjian.com {
       reverse_proxy localhost:8000
   }
   ```

   If it runs **nginx**, create `/etc/nginx/sites-available/supabase`, link it into `sites-enabled`, then run
   `certbot --nginx -d supabase.avunjian.com` and `systemctl reload nginx`:

   ```
   server {
       listen 80;
       server_name supabase.avunjian.com;
       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

   (Supabase's own guide offers a ready-made Caddy or nginx container instead: "Configure Reverse Proxy and
   HTTPS" in its self-hosting docs. Either way works.)
3. **Tell Supabase its address.** In the Supabase folder's `.env`, set these three lines:

   ```
   SUPABASE_PUBLIC_URL=https://supabase.avunjian.com
   API_EXTERNAL_URL=https://supabase.avunjian.com/auth/v1
   SITE_URL=https://highland.avunjian.com
   ```

   `SITE_URL` is the **game's** address, not the Supabase's: it is where players are sent back after signing
   in. If the game is also served under a second name (hyeland.avunjian.com), add:
   `ADDITIONAL_REDIRECT_URLS=https://hyeland.avunjian.com/**`
4. **Restart Supabase** from its folder so it reads the new lines: `docker compose up -d`
   (newer installs have a helper for the same: `sh run.sh start`).
5. The dashboard (Studio) is now reachable at the same address behind its user name and password
   (`DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` in `.env`). Make sure that password is a strong one.

**Check.** On any computer:

```
curl -I https://supabase.avunjian.com/auth/v1/
```

You should see `HTTP/2 401`. (401 is right: it means the service answered and wants a key.)

---

## Step 2. Make the three provider apps

Each provider needs to know the callback address, and gives you an **id** and a **secret**. Keep the secrets
for step 3. You can do one provider now and the others later: the game shows a button only for the providers
that are switched on.

### Google

1. Go to console.cloud.google.com. Create a project named "Highland Stand".
2. Open "APIs & Services", then "OAuth consent screen". Choose **External**. Fill in the app name (Highland
   Stand), your support email, and your contact email.
3. Under branding or app domain: home page `https://highland.avunjian.com`, privacy policy
   `https://highland.avunjian.com/?privacy`, authorized domain `avunjian.com`.
4. Scopes: leave only the basic ones (email, profile, openid). Add nothing.
5. Open "Credentials", "Create credentials", "OAuth client ID". Type: **Web application**. Under "Authorized
   redirect URIs" add the callback address: `https://supabase.avunjian.com/auth/v1/callback`
6. Copy the **client ID** and the **client secret**.
7. Back on the consent screen (or "Audience"), press **Publish app** so the status reads "In production".
   While it reads "Testing", only people you list can sign in.

Google's sign-in screen will say "to continue to supabase.avunjian.com". To show the game's name and logo
there instead, Google asks for a verification of the brand; it is optional.

### Facebook

1. Go to developers.facebook.com, "My Apps", "Create App". Choose the use case **Authenticate and request
   data from users with Facebook Login**.
2. In the use case's permissions, make sure both `public_profile` and `email` are added. Without `email`,
   sign-in fails.
3. Under "Facebook Login", "Settings", put the callback address into **Valid OAuth Redirect URIs**.
4. Under "App settings", "Basic": an app icon, a category (Games), **Privacy Policy URL**
   `https://highland.avunjian.com/?privacy`, and under **User data deletion** choose "Data deletion
   instructions URL" and enter `https://highland.avunjian.com/?privacy#delete`.
5. Copy the **App ID** and the **App secret** (Basic settings).
6. Switch the app from **Development** to **Live** (the switch at the top). In Development only you and the
   testers you add can sign in. Meta may ask for a review or a business verification before it lets the app
   go live; follow what its dashboard says.

### Discord

1. Go to discord.com/developers/applications. "New Application", name it Highland Stand.
2. Open "OAuth2". Under "Redirects" add the callback address. Save.
3. Copy the **Client ID** and the **Client Secret** (press "Reset Secret" to see it once).

---

## Step 3. Put the ids and secrets on the server

1. Open the Supabase folder's `.env` and add (with your values):

   ```
   GOOGLE_ENABLED=true
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_SECRET=...

   FACEBOOK_ENABLED=true
   FACEBOOK_CLIENT_ID=...
   FACEBOOK_SECRET=...

   DISCORD_ENABLED=true
   DISCORD_CLIENT_ID=...
   DISCORD_SECRET=...
   ```

2. Open `docker-compose.yml` in the same folder. Find the `auth:` service and its `environment:` list. The
   Google lines are already there with a `#` in front: remove the `#`. Add the same four lines for Facebook
   and Discord, and one more for each of those two (it lets people sign in whose Facebook or Discord account
   has no email address):

   ```
         GOTRUE_EXTERNAL_GOOGLE_ENABLED: ${GOOGLE_ENABLED}
         GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
         GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET}
         GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/callback

         GOTRUE_EXTERNAL_FACEBOOK_ENABLED: ${FACEBOOK_ENABLED}
         GOTRUE_EXTERNAL_FACEBOOK_CLIENT_ID: ${FACEBOOK_CLIENT_ID}
         GOTRUE_EXTERNAL_FACEBOOK_SECRET: ${FACEBOOK_SECRET}
         GOTRUE_EXTERNAL_FACEBOOK_REDIRECT_URI: ${API_EXTERNAL_URL}/callback
         GOTRUE_EXTERNAL_FACEBOOK_EMAIL_OPTIONAL: "true"

         GOTRUE_EXTERNAL_DISCORD_ENABLED: ${DISCORD_ENABLED}
         GOTRUE_EXTERNAL_DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID}
         GOTRUE_EXTERNAL_DISCORD_SECRET: ${DISCORD_SECRET}
         GOTRUE_EXTERNAL_DISCORD_REDIRECT_URI: ${API_EXTERNAL_URL}/callback
         GOTRUE_EXTERNAL_DISCORD_EMAIL_OPTIONAL: "true"
   ```

   Keep the indentation of the lines around them.
3. Restart the sign-in service from the Supabase folder: `sh run.sh recreate auth`
   (older installs: `docker compose up -d --force-recreate auth`).

**Check.** Find the anon key: it is the line `ANON_KEY=...` in `.env` (newer installs may call it
`SUPABASE_PUBLISHABLE_KEY`). Then:

```
curl -H "apikey: PASTE_THE_ANON_KEY" https://supabase.avunjian.com/auth/v1/settings
```

In the answer, under `"external"`, you should see `"google":true`, `"facebook":true`, `"discord":true`. A
provider that reads `false` is not switched on: look at its lines in both files again.

Two more checks that the game's page will be allowed to call the Supabase:

```
curl -i -X OPTIONS https://supabase.avunjian.com/rest/v1/rpc/hs_config \
  -H "Origin: https://highland.avunjian.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: apikey,authorization,content-type"
```

You should see a `200` or `204` and a line `access-control-allow-origin`.

```
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://supabase.avunjian.com/auth/v1/authorize?provider=google"
```

You should see `302` and an address that begins `https://accounts.google.com/`. (If you see `401`, the
gateway of your install wants the key on this address too: tell the game's builder.)

---

## Step 4. Create the game's tables

1. Open the dashboard: `https://supabase.avunjian.com`, sign in, open **SQL Editor**.
2. Open the file `deploy/supabase/schema.sql` from the game's repository, copy all of it, paste it into the
   editor and press **Run**.
3. You should see "Success". Running it again later is safe: it only adds what is missing.

If you see a warning that says `"Delete my account" will fail`, tell the game's builder: the role the editor
runs as may not delete accounts on your install, and one more line is needed.

**Check.** In the editor run `select public.hs_config();`. It answers with one small line that contains `"now"`.

---

## Step 5. Hand over the two public values

Send the game's builder exactly these two things (they are safe to send; they end up in the page that every
player's browser loads):

- the Supabase address: `https://supabase.avunjian.com`
- the anon key (the long `ANON_KEY` value)

**Do not send** the `SERVICE_ROLE_KEY`, the `JWT_SECRET`, a provider's secret or the database password. Nobody
needs them.

The builder puts the two values into the game on the branch `next`. Within a few minutes the staging address
shows it: **https://highland.avunjian.com/next/** . The live game does not change yet. What you do on the
staging address is kept apart from the live game: its saves, its scores and its counts are its own.

---

## Step 6. Sign in, and make yourself the admin

1. Open `https://highland.avunjian.com/next/` and sign in with the account you want to be the admin.
2. In the dashboard's SQL Editor run this, with the email address of that account:

   ```sql
   insert into public.hs_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   It should say one row was added. (If it says zero, the address is not the one you signed in with. Look
   under **Authentication**, **Users** in the dashboard for the address it has.)
3. Open `https://highland.avunjian.com/next/?stats`. You should see the stats page. Anyone else sees "This
   page is for the game's owner."

---

## Step 7. Publish the ruleset

On the stats page, under **Rulesets**, press **Publish ruleset**. This tells the server the rules of the
battles in this version of the game, so it can check scores. Do it again whenever the stats page says a new
version's ruleset is waiting (after an update that changes the battles). Until it is published, battles work
but scores are not ranked.

---

## Step 8. The checklist

Try each line on `https://highland.avunjian.com/next/`. Tick it when it does what it says.

Signing in:

- [ ] On a computer, in Chrome or Edge: Continue with Google signs you in and shows "Welcome".
- [ ] The same with Facebook, and with Discord.
- [ ] On an iPhone in Safari: each of the three.
- [ ] On the iPhone, add the staging page to the Home Screen, open it from there, and sign in. (The Home
      Screen app keeps its own sign-in, apart from Safari's.) If a browser sheet or Safari opens, finish
      there and go back to the Home Screen app: it should say "Welcome" within a few seconds.
- [ ] On an iPad, and on an Android phone.
- [ ] Open the staging address from a link inside the Facebook or Instagram app: the page says to open it in
      Safari or Chrome for Google, and the Facebook button works.
- [ ] A name already taken is refused; a name with `<` in it is refused.

Playing on:

- [ ] Play two waves on the computer and close the tab. Open the staging page on the phone with the same
      account: the first button says "Resume: ..., Wave 3", and it resumes that battle.
- [ ] Win a battle: the victory page shows a score and a place; the Leaderboard button shows your name.
- [ ] Share makes a picture with the battlefield, the stars and the score.
- [ ] The Hall's Daily tab shows today's challenge; playing it puts you on today's board.

When things go wrong:

- [ ] On the server, in the Supabase folder, stop the sign-in service: `docker compose stop auth`. Open the
      staging page in a private window: it says "Sign-in is not answering" and **Play now** lets you play.
      Start it again: `docker compose start auth`.
- [ ] Turn the phone's airplane mode on in the middle of a battle, clear a wave, turn it off: the Account
      tab says "Saved to your account" within a minute.

Your data:

- [ ] Account, **Sign out**: the game returns to the sign-in page.
- [ ] Sign in again, then Account, **Delete my account**: in the dashboard, under Authentication, Users, the
      account is gone. (Then sign in again and repeat step 6, because the admin went with the account. Do this
      test with a second account if you prefer.)
- [ ] `https://highland.avunjian.com/next/?privacy` shows the privacy page with your name, contact and
      country filled in.

The stats page:

- [ ] The funnel shows your own visits; the gate switch changes to "optional" and a private window then
      offers "Play as a guest"; change it back to the mode you want.

---

## Step 9. Going live, and keeping it well

**Going live.** When the checklist is ticked, tell the builder to merge `next` into `master`. Two minutes
later the live game has accounts. Players who already have progress on a device keep it: the first time they
sign in, it is saved to their account.

**Each week.** Open `https://highland.avunjian.com/?stats`. Look at the funnel (how many visitors sign in),
at "Where players quit", and at "Scores to look at": remove a score that cannot be real, or hide the player.

**Names.** The game refuses its own name and words like "admin" in player names. Add the words you want
refused in the SQL Editor (lower case, no spaces):

```sql
insert into public.hs_name_blocklist (pattern) values ('someword'), ('anotherword');
```

**Backups.** The players' accounts, progress and scores now live in your Supabase database. If it is not
backed up yet, make a daily copy from the Supabase folder:

```
docker exec supabase-db pg_dump -U postgres -d postgres -Fc -f /tmp/highland.dump
docker cp supabase-db:/tmp/highland.dump /root/backups/highland-$(date +%F).dump
```

(Put those two lines in a daily cron job, and keep a week of copies somewhere off the server.)

**Old counts.** The stats page has a button "Remove events older than 180 days". Press it now and then, or
schedule it in the SQL Editor once (if your install has the `pg_cron` extension):

```sql
select cron.schedule('highland-purge', '15 4 * * 0',
  $$delete from public.hs_sessions where started_at < now() - interval '180 days'$$);
```

**Turning things off in a hurry.** On the stats page, under Switches: the gate can be set to `off` (nobody is
asked to sign in), and boards or the daily can be switched off. To switch the whole account system off for
every player without a new version of the game, run in the SQL Editor:

```sql
insert into public.hs_config (key, value) values ('cloud', 'false')
on conflict (key) do update set value = excluded.value;
```

The game then plays as it did before accounts, on each player's next visit. Delete that row to switch it on
again.

**If a provider's secret leaks.** Make a new secret in that provider's console, put it into `.env`, and run
`sh run.sh recreate auth`. Players stay signed in.
