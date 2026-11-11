# Setting up accounts for Highland Stand

This guide is for the game's owner. No programming is needed. Each step says what to click or paste, and ends
with a **Check**: what you should see when the step worked. Do the steps in order, and do not go on past a check
that does not give what it says.

The game's page will talk to **your own Supabase**, the one already running on the same server as the game. The
guide makes a small part of that Supabase reachable from the internet, lets players sign in with Google, Facebook
and Discord, creates the game's tables, and ends with a checklist to try everything on the staging address,
`https://highland.avunjian.com/next/`, before any of it reaches the live game.

**How the commands are marked.** Every command in this guide carries one of two marks:

- **[tried]**: the builder ran it, as written, on a test copy of this setup (a local Supabase stand-in and a real
  nginx on the builder's machine, `tools/platform/guide-check.sh`), and it gave the answer the guide says.
- **[your server]**: it can only run on your server or in your accounts (Docker, your `.env`, a provider's
  console), so it was written with care but could not be tried.

Words used below:

- **the Supabase address**: the public https address your Supabase will have. This guide writes
  `https://supabase.avunjian.com`. If you choose another name, use yours everywhere.
- **the callback address**: `https://supabase.avunjian.com/auth/v1/callback`. Each provider asks for it.
- **the Supabase folder**: the folder on the server that holds Supabase's `docker-compose.yml` and `.env`.

## Where each secret goes

Some values are secret and some are public by design. Keep them apart:

| value | where it lives | never |
| --- | --- | --- |
| Google's, Facebook's and Discord's **client secrets** | the Supabase folder's `.env` on the server, as `GOOGLE_SECRET`, `FACEBOOK_SECRET`, `DISCORD_SECRET` (step 3) | in a chat, an email, the game's repository, the game's page |
| the **JWT secret**, the **service role key**, the **database password**, the **dashboard password** | already in that same `.env`. Nothing in this guide needs you to copy them anywhere | anywhere else at all |
| the providers' **client ids** | beside their secrets in the same `.env` (they are not secret, but they belong there) | |
| the **Supabase address** and the **anon key** | public: the builder puts them into the game's page, which every player's browser loads | |

The builder needs exactly two values from you: the Supabase address and the anon key (step 5). Nothing else.
If anyone asks you for a secret from the first two rows, the answer is no, including the builder.

---

## Step 0. Before anything is public

Until now your Supabase may only have been used from the server itself. This guide makes a small part of it
reachable from the internet, and the game's page carries its anon key for everyone to read. That key is not
only the game's: it is the key of **every project in that Supabase**. Check three things first. They protect
your other projects, not only the game.

1. **The secrets are your own, not the example's.** On the server, in the Supabase folder, run these four
   lines **[tried]**. Each must print `0`:

   <!-- guide-check: step0-greps -->
   ```
   grep -c 'your-super-secret-jwt-token-with-at-least-32-characters-long' .env
   grep -c 'your-super-secret-and-long-postgres-password' .env
   grep -c 'this_password_is_insecure_and_should_be_updated' .env
   grep '^ANON_KEY=' .env | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | grep -c supabase-demo
   ```

   The first three are the passwords printed in Supabase's own example file. The last looks inside the anon
   key: `1` there means the keys are the published examples, and then anyone can make an all-powerful key for
   your database. If any line prints `1`, stop and make new keys first **[your server]**: newer installs have
   `sh utils/generate-keys.sh` in the Supabase folder, and Supabase's self-hosting guide ("Securing your
   services") explains it. Your other projects' users are signed out by it, and their apps need the new anon key.

   **Check:** four lines, each `0`.
2. **The gateway's own ports are closed from outside.** Supabase's gateway listens on port 8000, and on
   installs with the Kong gateway also on port 8443 (https with a certificate of its own). Either one serves the
   whole Supabase, every project's tables included, past the narrow address of step 1. From a computer that is
   **not** the server **[your server]**:

   ```
   curl -m 5 -I http://76.13.121.176:8000/auth/v1/settings
   curl -k -m 5 -I https://76.13.121.176:8443/auth/v1/settings
   ```

   Each should fail or time out. If the first answers: in `.env` set `KONG_HTTP_PORT=127.0.0.1:8000` (newer
   installs: `API_GW_HTTP_PORT=127.0.0.1:8000`). If the second answers: set `KONG_HTTPS_PORT=127.0.0.1:8443`.
   Then run `docker compose up -d` in the Supabase folder **[your server]**, and try both `curl` lines again. (A
   firewall rule is not enough: Docker goes round `ufw`.)

   The database itself may also answer from outside, on 5432 and on 6543 (newer installs, through its pooler).
   Those need the database password, not the anon key, so the game does not change them. If nothing outside the
   server needs them, have them closed the same way.

   **Check:** both `curl` lines fail or time out.
3. **The dashboard's password is strong.** In `.env`, `DASHBOARD_PASSWORD` is long and not used anywhere
   else. Step 4 also has a query that shows what of your other projects the anon key could reach.

   **Check:** you changed it, or you are sure it is strong.

---

## Step 1. Give the Supabase a narrow public https address

The game needs two things from the Supabase and nothing else: the sign-in service (`/auth/v1/`) and the game's
own functions (`/rest/v1/rpc/hs_...`). The public address serves those two and answers "not found" for
everything else: the dashboard, your other projects' tables, storage and the rest stay where they are today.

**If your Supabase is already public** because another project of yours uses it (try
`curl -I https://<its address>/auth/v1/` **[your server]**): leave that address as it is, and still add the
narrow one below for the game under a name of its own. Narrowing the existing address would break the other
project. Tell the builder which case you are in.

1. **DNS.** Where avunjian.com's DNS is managed, add an A record: name `supabase`, value `76.13.121.176` (the
   same server as the game) **[your server]**.
2. **The web server.** The game's server already runs a web server with https (nginx or Caddy). Add the
   Supabase to it. Supabase's own gateway listens on port 8000 of the server.

   If it runs **nginx**: put this one line into the `http { ... }` part of `/etc/nginx/nginx.conf` **[tried]**
   (it keeps one counter per visitor's address, so nobody can flood the game's functions):

   <!-- guide-check: nginx-zone -->
   ```
   limit_req_zone $binary_remote_addr zone=hs_rpc:10m rate=10r/s;
   ```

   Then create the file `/etc/nginx/sites-available/supabase` with this text **[tried]**:

   <!-- guide-check: nginx-site -->
   ```
   server {
       listen 80;
       server_name supabase.avunjian.com;
       client_max_body_size 512k;

       # a path written to mean one thing to this server and another to the gateway behind it is refused
       if ($request_uri ~* "^[^?]*(%2e|%2f|%5c|\.\.|//)") { return 404; }

       # sign-in: only what the game's page uses. Supabase's other sign-in addresses make accounts, sign in
       # with a password, or send mail and texts to any address: they are not served on this name
       location ~ ^/auth/v1/(settings|authorize|callback|logout|health)$ {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $remote_addr;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       # a finished sign-in's token, and its renewal; no other kind of token
       location = /auth/v1/token {
           if ($arg_grant_type !~ "^(pkce|refresh_token)$") { return 404; }
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $remote_addr;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       # who is signed in: read only (a change of email or password is not served)
       location = /auth/v1/user {
           limit_except GET OPTIONS { deny all; }
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $remote_addr;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       # the game's functions, and only those
       location /rest/v1/rpc/hs_ {
           limit_req zone=hs_rpc burst=40 nodelay;
           limit_req_status 429;
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $remote_addr;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       # nothing else of the Supabase is served on this name
       location / { return 404; }
   }
   ```

   Then link it, get its certificate and reload **[your server]**:

   ```
   ln -s /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/supabase
   nginx -t
   certbot --nginx -d supabase.avunjian.com
   systemctl reload nginx
   ```

   `nginx -t` must say `syntax is ok` and `test is successful` before you go on.

   If the server runs **Caddy**, add this to `/etc/caddy/Caddyfile` and run `systemctl reload caddy`
   **[your server]** (Caddy could not be installed on the builder's machine, so this block was written and not
   tried; the check below tells you whether it works):

   ```
   supabase.avunjian.com {
       request_body {
           max_size 512KB
       }
       @signin path /auth/v1/settings /auth/v1/authorize /auth/v1/callback /auth/v1/logout /auth/v1/health
       handle @signin {
           reverse_proxy localhost:8000
       }
       @token {
           path /auth/v1/token
           query grant_type=pkce grant_type=refresh_token
       }
       handle @token {
           reverse_proxy localhost:8000
       }
       @user {
           path /auth/v1/user
           method GET HEAD OPTIONS
       }
       handle @user {
           reverse_proxy localhost:8000
       }
       @game path /rest/v1/rpc/hs_*
       handle @game {
           reverse_proxy localhost:8000
       }
       handle {
           respond 404
       }
   }
   ```

   (Caddy has no limit per visitor's address built in, and this block has no counterpart of the nginx line that
   refuses paths written to slip past it. The game's database has limits of its own, so these are second lines
   of defense you do without on Caddy. The checks below and the builder's test of step 5 tell you whether the
   block works as meant.)
3. **Tell Supabase its address.** In the Supabase folder's `.env`, set these three lines **[your server]**.
   **If another project already uses this Supabase, do not change the first two**: they are that project's, and
   the providers' callback of step 2 is then that address, not the new one.

   ```
   SUPABASE_PUBLIC_URL=https://supabase.avunjian.com
   API_EXTERNAL_URL=https://supabase.avunjian.com/auth/v1
   SITE_URL=https://highland.avunjian.com
   ```

   `SITE_URL` is the **game's** address, not the Supabase's: it is where players are sent back after signing in,
   and it covers the staging address `/next/` too. If another project already has its own `SITE_URL`, keep it
   and add the game instead: `ADDITIONAL_REDIRECT_URLS=https://highland.avunjian.com/**`. If the game is also
   served under a second name (hyeland.avunjian.com), add it to the same line, separated by a comma.
4. **Restart Supabase** from its folder so it reads the new lines **[your server]**: `docker compose up -d`
   (newer installs have a helper for the same: `sh run.sh start`).
5. The dashboard (Studio) is **not** on the new address. Reach it as you do today. If today that is
   `http://<server>:8000`, which step 0 has just closed, open it through a tunnel from your own computer
   **[your server]**: `ssh -L 8000:127.0.0.1:8000 root@76.13.121.176`, then `http://localhost:8000` in your
   browser.

**Check.** On any computer other than the server **[tried]**:

<!-- guide-check: step1-check -->
```
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.avunjian.com/auth/v1/settings
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.avunjian.com/
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.avunjian.com/rest/v1/
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.avunjian.com/pg/
```

You should see `401` (the sign-in service answered and wants a key), then `404`, `404`, `404`.

And these, which would make accounts or send mail through the game's address, must be refused too **[tried]**:

<!-- guide-check: step1-auth-closed -->
```
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://supabase.avunjian.com/auth/v1/signup
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://supabase.avunjian.com/auth/v1/otp
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://supabase.avunjian.com/auth/v1/token?grant_type=password"
curl -s -o /dev/null -w "%{http_code}\n" -X PUT https://supabase.avunjian.com/auth/v1/user
```

You should see `404`, `404`, `404`, then `403` on nginx (or `404` on Caddy).

---

## Step 2. Make the three provider apps

Each provider needs to know the callback address, and gives you an **id** and a **secret**. Keep the secrets for
step 3, and only there. You can do one provider now and the others later: the game shows a button only for the
providers that are switched on. All of this step is in the providers' consoles **[your server]**.

### Google

1. Go to console.cloud.google.com. Create a project named "Highland Stand".
2. Open "APIs & Services", then "OAuth consent screen". Choose **External**. Fill in the app name (Highland
   Stand), your support email, and your contact email.
3. Under branding or app domain: home page `https://highland.avunjian.com`, privacy policy
   `https://highland.avunjian.com/?privacy`, authorized domain `avunjian.com`.
4. Scopes: leave only the basic ones (email, profile, openid). Add nothing.
5. Open "Credentials", "Create credentials", "OAuth client ID". Type: **Web application**. Under "Authorized
   redirect URIs" add the callback address: `https://supabase.avunjian.com/auth/v1/callback`
6. Copy the **client ID** and the **client secret** straight into the `.env` of step 3.
7. Back on the consent screen (or "Audience"), press **Publish app** so the status reads "In production". While
   it reads "Testing", only people you list can sign in.

Google's sign-in screen will say "to continue to supabase.avunjian.com". To show the game's name and logo there
instead, Google asks for a verification of the brand; it is optional.

### Facebook

1. Go to developers.facebook.com, "My Apps", "Create App". Choose the use case **Authenticate and request data
   from users with Facebook Login**.
2. In the use case's permissions, make sure both `public_profile` and `email` are added. Without `email`,
   sign-in fails.
3. Under "Facebook Login", "Settings", put the callback address into **Valid OAuth Redirect URIs**.
4. Under "App settings", "Basic": an app icon, a category (Games), **Privacy Policy URL**
   `https://highland.avunjian.com/?privacy`, and under **User data deletion** choose "Data deletion
   instructions URL" and enter `https://highland.avunjian.com/?privacy#delete`.
5. Copy the **App ID** and the **App secret** (Basic settings) into the `.env` of step 3.
6. Switch the app from **Development** to **Live** (the switch at the top). In Development only you and the
   testers you add can sign in. Meta may ask for a review or a business verification before it lets the app go
   live; follow what its dashboard says. Until then, the game can open with Google and Discord only.

### Discord

1. Go to discord.com/developers/applications. "New Application", name it Highland Stand.
2. Open "OAuth2". Under "Redirects" add the callback address. Save.
3. Copy the **Client ID** and the **Client Secret** (press "Reset Secret" to see it once) into the `.env` of
   step 3.

**Check:** each provider you made shows the callback address exactly as written above, with `https` and no
slash at the end.

---

## Step 3. Put the ids and secrets on the server

This is the only place the providers' secrets go.

1. Open the Supabase folder's `.env` and add, with your values **[your server]**:

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

   A provider you have not made yet gets `..._ENABLED=false` and no other lines.
2. Open `docker-compose.yml` in the same folder. Find the `auth:` service and its `environment:` list. The
   Google lines are already there with a `#` in front: remove the `#`. Add the same four lines for Facebook and
   Discord, and one more for each of those two (it lets people sign in whose Facebook or Discord account has no
   email address) **[your server]**:

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

   Keep the indentation of the lines around them. The `${...}` parts are names, not values: the secrets stay in
   `.env` and are not copied into this file.
3. Restart the sign-in service from the Supabase folder **[your server]**: `sh run.sh recreate auth` (older
   installs: `docker compose up -d --force-recreate auth`).

**Check.** Find the anon key: it is the line `ANON_KEY=...` in `.env` (newer installs may call it
`SUPABASE_PUBLISHABLE_KEY`). Then, on any computer **[tried]**:

<!-- guide-check: step3-settings -->
```
curl -H "apikey: PASTE_THE_ANON_KEY" https://supabase.avunjian.com/auth/v1/settings
```

In the answer, under `"external"`, you should see `"google":true`, `"facebook":true`, `"discord":true`. A
provider that reads `false` is not switched on: look at its lines in both files again.

**Look for one more word in the same answer: `"mailer_autoconfirm"`. It must read `false`.**

If it reads `true`, your Supabase accepts an email address without checking it. That is common on installs
without a mail server. For this game it is dangerous with Discord: someone can make a Discord account with
**your** email address, never confirm it, press "Continue with Discord", and be let into **your** account, which
step 6 makes the admin. The game's page protects you by itself: while the word reads `true` it shows no Discord
button, and the stats page says so in red. To have Discord, choose one **[your server]**:

- set `ENABLE_EMAIL_AUTOCONFIRM=false` in `.env` and restart the sign-in service. Your other projects' sign-ups
  by email and password then need a working mail server (the `SMTP_` lines) to confirm addresses. If another
  project relies on sign-ups without confirmation, do not change it, and instead
- leave Discord off (`DISCORD_ENABLED=false`): Google and Facebook are not affected.

Two more checks that the game's page will be allowed to call the Supabase **[tried]**:

<!-- guide-check: step3-preflight -->
```
curl -i -X OPTIONS https://supabase.avunjian.com/rest/v1/rpc/hs_config \
  -H "Origin: https://highland.avunjian.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: apikey,authorization,content-type"
```

You should see a `200` or `204` and a line `access-control-allow-origin`.

<!-- guide-check: step3-authorize -->
```
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://supabase.avunjian.com/auth/v1/authorize?provider=google"
```

You should see `302` and an address that begins `https://accounts.google.com/`. (If you see `401`, the gateway
of your install wants the key on this address too: tell the builder.)

---

## Step 4. Create the game's tables

1. Open the dashboard as you do today (step 1, item 5), sign in, open **SQL Editor**.
2. Open the file `deploy/supabase/schema.sql` from the game's repository, copy all of it, paste it into the
   editor and press **Run** **[tried]**.
3. You should see "Success". Running it again later is safe: it only adds what is missing and replaces the
   game's own functions.

The file may print up to three warnings. Each begins with the word `WARNING`. Copy any you see to the builder:
that "Delete my account" will fail (the role the editor runs as may not delete accounts on your install); that
the name rule does not read letters as expected; that some functions are owned by a superuser.

If the editor says `permission denied to set role "postgres"`, tell the builder: your editor runs as a role
that cannot hand its work to the `postgres` role, and one line is needed.

Do **not** run `schema-handoff.sql`, which lies beside it, unless the builder asks you to after step 6.

**Check.** In the editor run **[tried]**:

<!-- guide-check: step4-config -->
```sql
select public.hs_config();
```

It answers with one small line that contains `"now"`.

**The audit of your other projects.** Run this in the same editor **[tried]**. It lists every table that anyone
holding the anon key can read or change because it has no row level security, and every function such a visitor
may run that is not the game's:

<!-- guide-check: step4-audit -->
```sql
select 'table without row level security' as what, n.nspname || '.' || c.relname as name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('public', 'graphql_public', 'storage') and not c.relrowsecurity
  and exists (select 1 from (values ('anon'), ('authenticated')) r(role), (values ('select'), ('insert'), ('update'), ('delete')) q(priv)
              where has_table_privilege(r.role, c.oid, q.priv))
union all
select 'policy to read (' || p.cmd || ' for ' || array_to_string(p.roles, ', ') || ')', p.schemaname || '.' || p.tablename || ': ' || p.policyname
from pg_policies p
where p.schemaname in ('public', 'graphql_public', 'storage') and p.roles && array['public', 'anon', 'authenticated']::name[]
union all
select 'function a visitor may run', n.nspname || '.' || p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname not like 'hs\_%' and has_function_privilege('anon', p.oid, 'execute')
order by 1, 2;
```

It looks at three things: tables anyone with the key can read, add to, change or delete from because row level
security is off; the rules (policies) that let visitors or signed-in people into a table where it is on; and
functions a visitor may run. The schema `storage` is Supabase's file storage.

No rows: none of those three exists. That is a good sign, not a full audit: whether some other part of a project
is safe only its author can say. Rows: those belong to your other projects (the game's own tables have row level
security, no policies, and are not listed). They were just as exposed before, to anyone who had the key and an
address that reaches this Supabase; the game makes the key easy to find. A table listed without row level
security: switch it on (`alter table <name> enable row level security;` and then the policies that project
needs), or ask whoever built that project. A policy: read it with its author, since it may let in more than it
should. The narrow address of step 1 keeps all of them unreachable **through the game's address** only.

---

## Step 5. Hand over the two public values

Send the builder exactly these two things. They are safe to send in any way you like, chat included: they end up
in the page that every player's browser loads.

- the Supabase address: `https://supabase.avunjian.com`
- the anon key (the long `ANON_KEY` value)

**Do not send** the `SERVICE_ROLE_KEY`, the `JWT_SECRET`, a provider's secret, the database password or the
dashboard password. Nobody needs them, the builder included.

The same day the builder runs a test from outside with only those two values **[tried]**:

<!-- guide-check: step5-smoke -->
```
node tools/platform/smoke.js https://supabase.avunjian.com PASTE_THE_ANON_KEY
```

It makes thirteen checks: that the key is not an example key, that sign-in answers, that the address is narrow
(nothing but what the game uses, no sign-up and no mail), that no table can be read, that the gateway's ports
8000 and 8443 are closed and the certificate valid. It changes nothing on
your server but one counted visit marked as a test. You get its lines back; anything marked FAIL comes with what
to do.

The builder then puts the two values into the game on the branch `next`. Within a few minutes the staging
address shows it: **https://highland.avunjian.com/next/** . The live game does not change. What you do on the
staging address is kept apart from the live game: its saves, its scores and its counts are its own. Use a
private window for it anyway, so the staging page and the live game do not share a browser's memory.

**Check:** the builder has said the smoke test passed, and `https://highland.avunjian.com/next/` opens the game.

---

## Step 6. Sign in, and make yourself the admin

1. **On your iPhone first.** Open `https://highland.avunjian.com/next/` in Safari, tap Share, "Add to Home
   Screen", open the game from the Home Screen icon, and sign in there with Google. Then tell the builder which
   of these happened:
   - the game on the Home Screen said "Welcome" (this is the good case, and nothing more is built for it), or
   - Safari or a sheet opened and said "Sign-in did not finish here", and the Home Screen game still shows the
     sign-in page. (Then the builder adds a small piece that hands the sign-in back to the Home Screen game, and
     you run one more file, `schema-handoff.sql`, the same way as step 4.)
2. On a computer, open `https://highland.avunjian.com/next/` and sign in with the account you want to be the
   admin. First make sure step 3's `"mailer_autoconfirm"` reads `false`, or that Discord is off.
3. In the dashboard's SQL Editor run this, with the email address of that account **[tried]**:

   <!-- guide-check: step6-admin -->
   ```sql
   insert into public.hs_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   It should say one row was added. (If it says zero, the address is not the one you signed in with. Look under
   **Authentication**, **Users** in the dashboard for the address it has.)
4. Open `https://highland.avunjian.com/next/?stats`.

**Check:** you see the stats page. Anyone else sees "This page is for the game's owner."

---

## Step 7. Publish the ruleset (from the second release on)

The first release has accounts, saved progress and the stats page, and no leaderboards yet: skip this step until
the builder says the boards are in.

On the stats page, under **Rulesets**, press **Publish ruleset**. This tells the server the rules of the battles
in this version of the game, so it can check scores. Do it again whenever the stats page says a new version's
ruleset is waiting (after an update that changes the battles). Until it is published, battles work but scores
are not ranked. The staging page publishes its own ruleset the same way, from `/next/?stats`; its boards are its
own.

**Check:** the stats page no longer says a ruleset is waiting.

---

## Step 8. The checklist

Try each line on `https://highland.avunjian.com/next/`. Tick it when it does what it says. Lines marked
"(second release)" or "(third release)" wait until the builder says those are in.

Signing in:

- [ ] On a computer, in Chrome or Edge: Continue with Google signs you in and shows "Welcome".
- [ ] The same with Facebook, and with Discord.
- [ ] On an iPhone in Safari: each of the three.
- [ ] On the iPhone, open the game from its Home Screen icon and sign in (step 6 tried this once; try each
      provider now). The Home Screen game keeps its own sign-in, apart from Safari's.
- [ ] Press Google's button, and on Google's page press the browser's Back button. The game shows "Sign-in did
      not finish". Do it a second time: the game offers **Play now**, and Play now works.
- [ ] In Safari's settings switch on "Block All Cookies" (or open the page in a browser with this site's data
      blocked): the game says "This browser is not keeping this site's data" and **Play now** works. Switch it
      back.
- [ ] On an iPad, and on an Android phone.
- [ ] Open the staging address from a link inside the Facebook or Instagram app: the page says to open it in
      Safari or Chrome for Google, and the Facebook button works. Try **Open in browser** there and tell the
      builder whether it opened Safari or Chrome.
- [ ] A name already taken is refused; a name with `<` in it, or with a star or a smiley, is refused; your name
      in Armenian letters is accepted.

Playing on:

- [ ] Play two waves on the computer and close the tab. Open the staging page on the phone with the same
      account: the first button says "Resume: ..., Wave 3", and it resumes that battle.
- [ ] (Second release) Win a battle: the victory page shows a score and a place; the Leaderboard button shows
      your name. Share makes a picture with the battlefield, the stars and the score.
- [ ] (Third release) The Hall's Daily tab shows today's challenge; playing it puts you on today's board.

When things go wrong:

- [ ] On the server, in the Supabase folder, stop the sign-in service **[your server]**: `docker compose stop auth`.
      Open the staging page in a private window: it says "Sign-in is not answering" and **Play now** lets you
      play. Start it again **[your server]**: `docker compose start auth`.
- [ ] Turn the phone's airplane mode on in the middle of a battle, clear a wave, turn it off: the Account tab
      says "Saved to your account" within a minute.

Your data:

- [ ] Account, **Sign out**: the game returns to the sign-in page.
- [ ] Sign in again, then Account, **Delete my account**: in the dashboard, under Authentication, Users, the
      account is gone. (Then sign in again and repeat step 6, because the admin went with the account. Do this
      test with a second account if you prefer.)
- [ ] `https://highland.avunjian.com/next/?privacy` shows the privacy page with your name, contact and country
      filled in.

The stats page:

- [ ] The page opens with its cards. (Visits to `/next/` are left out of every card, so the funnel fills only once
      the live game has visitors.) The gate switch changes to "optional" and a private window then offers
      "Play as a guest" **the first time it opens the page**; change it back to the mode you want.
- [ ] The Health card at the top shows nothing in red.

**Check:** every line of the release at hand is ticked. Then tell the builder.

---

## Step 9. Going live, and keeping it well

**Going live.** When the checklist is ticked, tell the builder to merge `next` into `master`. Two minutes later
the live game has accounts. Players who already have progress on a device keep it: the first time they sign in,
it is saved to their account.

**Each week.** Open `https://highland.avunjian.com/?stats`. Look at the funnel (how many visitors sign in), at
"Where players quit", and at "Scores to look at": remove a score that cannot be real, or hide the player.

**Names.** The game refuses its own name and words like "admin" in player names. Add the words you want refused
in the SQL Editor (lower case, no spaces) **[tried]**:

<!-- guide-check: step9-names -->
```sql
insert into public.hs_name_blocklist (pattern) values ('someword'), ('anotherword');
```

**Backups.** The players' accounts, progress and scores now live in your Supabase database. If it is not backed
up yet, make a daily copy. First write a small script, by pasting this whole block on the server **[your
server]**:

```
cat > /root/backup-highland.sh <<'END'
#!/bin/sh
# a copy of the Supabase database each day, the last eight days kept
set -e
mkdir -p /root/backups
docker exec supabase-db pg_dump -U postgres -d postgres -Fc -f /tmp/highland.dump
docker cp supabase-db:/tmp/highland.dump "/root/backups/highland-$(date +%F).dump"
docker exec supabase-db rm -f /tmp/highland.dump
find /root/backups -name 'highland-*.dump' -mtime +7 -delete
END
chmod 700 /root/backup-highland.sh
/root/backup-highland.sh && ls -l /root/backups
```

**Check:** the last line lists one file, `highland-` and today's date, of more than a few kilobytes. (If
`pg_dump` says "permission denied", change `-U postgres` to `-U supabase_admin` in the script and run it
again.)

Then have it run every night: run `crontab -e` and add this line at the end **[your server]**:

```
17 3 * * * /root/backup-highland.sh >> /root/backup-highland.log 2>&1
```

(The line has no `%` sign, which cron would read as a line break, and the script makes its folder itself, so it
runs at night as it did by hand. Keep a copy somewhere off the server now and then too. A backup holds the
players' email addresses: keep it as private as the server.)

**Old counts.** Nothing to do: the game removes visits older than 180 days by itself, a few at a time, as new
ones arrive. The stats page shows how full the counts are and has a button, "Remove old events", for when you
want it done at once (press it again while it says there is more). The counts can never grow past the ceiling
set under Switches (1 GB to begin with): when they reach it, visitors who are not signed in are no longer counted
until old visits have left.

**The privacy page.** Fill in its bracketed places: your name, a contact address, the country of the server, and
the number of days your web server keeps its access logs (nginx's default with `logrotate` is 14 weekly files;
say what yours is, or set it). Have the page read by someone who knows your country's law, and ask that person
one question in particular: may the game keep a random number in a visitor's browser to count visits before the
visitor has chosen anything? If the answer is no, tell the builder (one setting changes it).

**Turning things off in a hurry.** On the stats page, under Switches: the gate can be set to `off` (nobody is
asked to sign in), and boards or the daily can be switched off. To switch the whole account system off for every
player without a new version of the game, run in the SQL Editor **[tried]**:

<!-- guide-check: step9-cloud-off -->
```sql
insert into public.hs_config (key, value) values ('cloud', 'false')
on conflict (key) do update set value = excluded.value;
```

The game then plays as it did before accounts. Delete that row to switch it on again **[tried]**:

<!-- guide-check: step9-cloud-on -->
```sql
delete from public.hs_config where key = 'cloud';
```

**If a provider's secret leaks.** Make a new secret in that provider's console, put it into `.env`, and run
`sh run.sh recreate auth` **[your server]**. Players stay signed in.

**If the anon key or the JWT secret must change.** Making new keys (step 0) signs every player out once; they
sign in again and have everything back. Send the builder the new anon key (step 5).
