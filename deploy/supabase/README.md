# Highland Stand on the shared Supabase

This guide is for the game's owner. It puts the game's accounts, cloud saves, boards and counts on the Supabase
the owner already runs for his other apps, at `https://db.avunjian.com`, without installing anything new and
without touching what the other apps own. Each step ends with a **Check**. Do the steps in order and do not go
past a check that does not give what it says. The short owner's checklist of every shared change, with its
backup and its rollback, is `docs/specs/owner/shared-supabase-plan.md`.

**What is on that server.** One self-hosted Supabase (Postgres 17, GoTrue for sign-in, PostgREST behind Kong) in
`~/supabase-project`, with the whole REST API public: `/rest/v1`, `/auth/v1`, `/storage/v1`, `/realtime/v1`,
`/functions/v1`, `/graphql/v1`. Other apps own other schemas: **PathStream owns `public`**, **ReqStream owns
`reqstream` and `reqstream_meta`**. There is **one `auth.users` for every app**, and its email sign-up is open
(anyone can make an account; the anon key is public in every app's page). The API runs `pg-safeupdate` (an
UPDATE or DELETE without a WHERE is refused). `SITE_URL` points at another app.

**What the game owns there.** One schema, `highland`, and nothing else: 13 tables, 17 functions the page may call
(`hs_...`), 27 helpers no one may call (`_...`), and 5 views. It is made and removed by numbered migrations
(`deploy/supabase/migrations/`), applied by `tools/platform/migrate.js`. No API role may read or write a table of
it; the page goes through the `hs_` functions only, naming the schema in two headers (`Accept-Profile` and
`Content-Profile: highland`).

**How the commands are marked.**

- **[tried]**: run as written on this machine against a local stand-in of the server (a throwaway PostgreSQL with
  Supabase's roles and default privileges, and a stand-in for PostgREST and GoTrue), by
  `tools/platform/guide-check.sh`, which reads the commands out of this file.
- **[your server]**: it can only run on the server (Docker, `~/supabase-project`, the real gateway), so it was
  written with care but could not be tried.
- **[asks first]**: a change to something the other apps share. Each one needs the owner's explicit yes, on its
  own, at the time, after its backup (step 4).

Words used below:

- **the server**: the machine that runs the Supabase. `ssh server` stands for however you reach it.
- **the Supabase folder**: `~/supabase-project` on the server (its `.env` and `docker-compose.yml`).
- **the tunnel**: an SSH tunnel from your computer to the database container (step 1). The database is never
  opened to the internet for this.
- **the callback address**: `https://db.avunjian.com/auth/v1/callback`. Each sign-in provider asks for it.

## Where each secret goes

| value | where it lives | never |
| --- | --- | --- |
| the **database password** (`POSTGRES_PASSWORD`) | the Supabase folder's `.env`; on your computer only in the variable `PGPASSWORD` for the length of a session (step 1) | on a command line, in a DSN, in a file of the repository, in a chat, in a log |
| the **JWT secret**, the **service role key**, the **dashboard password**, SMTP and hook secrets | the same `.env`. Nothing in this guide copies them anywhere, and no command here prints them | anywhere else at all. The game never uses the service key |
| Google's, Facebook's and Discord's **client secrets** | the same `.env`, if and when step 4c adds them | in the page, the repository, a chat |
| the **public address** `https://db.avunjian.com` and the **anon key** | the only two values that go into the game's page | |

The commands that read `.env` below print only names and public values (`cut -d= -f1`, or a line that holds no
secret). If you ever see a secret printed, stop, and change that secret.

**Data on this host is synthetic or non-PHI only.** The server holds no health information, and the game adds
none: it keeps player names, progress, scores and anonymous counts. Never load real people's data from another
system into it, and test with made-up accounts.

---

## Step 0. Look before changing anything (read only)

Each of these reads and prints no secret **[your server]**. Keep the answers: step 4 needs them, and the
builder may ask for them.

```
ssh server 'cd ~/supabase-project && docker compose ps --format "{{.Service}} {{.State}}"'
ssh server 'cd ~/supabase-project && grep -E "^(PGRST_DB_SCHEMAS|ADDITIONAL_REDIRECT_URLS|SITE_URL|API_EXTERNAL_URL|ENABLE_EMAIL_SIGNUP|ENABLE_EMAIL_AUTOCONFIRM|DISABLE_SIGNUP|SMTP_HOST|SMTP_SENDER_NAME|SMTP_ADMIN_EMAIL)=" .env'
ssh server 'cd ~/supabase-project && grep -oE "^[A-Z_]*(GOOGLE|FACEBOOK|DISCORD)[A-Z_]*_ENABLED=[a-z]*" .env; grep -nE "GOTRUE_EXTERNAL_(GOOGLE|FACEBOOK|DISCORD)_[A-Z_]+" docker-compose.yml | cut -d: -f1-2'
ssh server 'cd ~/supabase-project && grep -nE "GOTRUE_HOOK_[A-Z_]+_(ENABLED|URI)" docker-compose.yml .env'
curl -s -H "apikey: THE_ANON_KEY" https://db.avunjian.com/auth/v1/settings
```

What to look for:

- `PGRST_DB_SCHEMAS` should read `public,graphql_public,reqstream` (step 4a appends `highland`).
- `ADDITIONAL_REDIRECT_URLS`: the other apps' return addresses (step 4b appends the game's two).
- In the settings answer: `"external"` says which of `google`, `facebook`, `discord` are on (step 4c),
  `"mailer_autoconfirm"` whether email addresses are trusted without a mail (see "The mail" below), and
  `"disable_signup": false` that sign-up is open, as expected.
- `GOTRUE_HOOK_...`: a hook another app set on sign-in (see "PathStream's hooks" below). The secrets of a hook
  are in lines named `..._SECRETS`, which these commands do not print.

Then, through the tunnel of step 1, in `psql` **[tried]**:

<!-- guide-check: survey-sql -->
```sql
select version();
select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('postgres', 'anon', 'authenticated', 'service_role', 'authenticator') order by 1;
select nspname from pg_namespace where nspname !~ '^pg_' and nspname <> 'information_schema' order by 1;
select to_regnamespace('highland') is not null as highland_exists;
select has_table_privilege('postgres', 'auth.users', 'select') as users, has_table_privilege('postgres', 'auth.identities', 'select') as identities;
select count(*) as global_default_grants from pg_default_acl where defaclnamespace = 0;
select exists (select 1 from pg_collation where collname = 'und-x-icu') as icu;
```

**Check:** `postgres` is not a superuser (`rolsuper` false); `highland_exists` is false before step 3; `postgres`
may select from `auth.users` and `auth.identities` (the game reads both, never writes them); the list of schemas
holds `public`, `reqstream` and `reqstream_meta`, which nothing below touches.

---

## Step 1. The tunnel

The database container has an address on the server's Docker network only. Find it **[your server]**:

```
ssh server 'docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}" supabase-db'
```

It prints one address such as `172.18.0.4`. Open the tunnel from your computer to that address's port 5432, on
your computer's port 55622, and leave it open in its own window **[your server]**:

```
ssh -N -L 127.0.0.1:55622:172.18.0.4:5432 server
```

(It goes straight to the database, not through Supavisor's pooler, so the plain user name `postgres` works.)
Then, in the window you will work in, give the password to the tools without it ever showing on screen or in
your shell's history. Either type it **[your server]**:

```
read -rs PGPASSWORD && export PGPASSWORD
```

or read it from the server's `.env` straight into the variable **[your server]**:

```
export PGPASSWORD="$(ssh server "grep -m1 '^POSTGRES_PASSWORD=' ~/supabase-project/.env | cut -d= -f2-")"
```

The address of the database, for every command below, has no password in it:

```
export HS_DB_URL=postgres://postgres@127.0.0.1:55622/postgres
psql "$HS_DB_URL" -c 'select current_user'
```

**Check:** the last line answers `postgres`. When you are done, `unset PGPASSWORD` and close the tunnel.

---

## Step 2. A backup of the game's schema, before every change

Before applying or rolling back a migration, and before restoring, take a copy of the schema `highland` alone,
through the tunnel **[tried]**:

<!-- guide-check: backup -->
```
pg_dump "$HS_DB_URL" -n highland -Fc -f "highland-$(date +%Y%m%d-%H%M%S).dump"
```

(Before the first migration there is nothing to copy: `pg_dump` says no schema matched. That is expected.) Use a
`pg_dump` of version 17 or newer against the server's Postgres 17. Never dump `auth` or the whole database for
the game: `auth.users` is every app's, with every person's email.

**Each night**, on the server, the same copy from inside the container **[your server]**:

```
cat > ~/backup-highland.sh <<'END'
#!/bin/sh
# the game's schema each night, the last eight kept. The schema highland only: never auth, never another app's.
set -e
mkdir -p ~/backups
docker exec supabase-db pg_dump -U postgres -d postgres -n highland -Fc -f /tmp/highland.dump
docker cp supabase-db:/tmp/highland.dump ~/backups/highland-$(date +%F).dump
docker exec supabase-db rm -f /tmp/highland.dump
find ~/backups -name 'highland-*.dump' -mtime +7 -delete
END
chmod 700 ~/backup-highland.sh && ~/backup-highland.sh && ls -l ~/backups
```

and `crontab -e` with the line `17 3 * * * ~/backup-highland.sh >> ~/backup-highland.log 2>&1`.

---

## Step 3. The migrations

From the game's repository on your computer, with the tunnel and `PGPASSWORD` of step 1 (once:
`npm install --prefix tools/platform`). First see where the database stands **[tried]**:

<!-- guide-check: migrate-status -->
```
node tools/platform/migrate.js status --dsn="$HS_DB_URL"
```

Then apply them all **[tried]**:

<!-- guide-check: migrate-up -->
```
node tools/platform/migrate.js up --dsn="$HS_DB_URL"
```

The five migrations, each in one transaction of its own, each followed by the lockdown (the file
`migrations/lockdown.sql`: every object of `highland` taken away from PUBLIC, `anon`, `authenticated` and
`service_role`) and, once 003 is in, 003's grants again:

| migration | up | down |
| --- | --- | --- |
| `001_schema_tables` | the schema `highland`, the bookkeeping table `highland.schema_migrations`, the 12 tables and their indexes, row level security switched on | drops them, by name, without cascade, then the schema. **All the game's data goes**: back up first |
| `002_functions` | the 17 `hs_` functions, the 27 helpers (`_...`) and the 5 views; nothing granted | drops each by its full signature |
| `003_grants_policies` | USAGE on the schema to `anon` and `authenticated`; EXECUTE on the 4 open functions to both and on the 13 others to `authenticated`; `service_role` nothing; the policies; per-schema default privileges revoked | takes every grant back and drops the policies |
| `004_seed` | the analytics' three ceilings and the name filter's words | deletes those rows |
| `005_delete_game_session` | "Delete my account" asks for a session of the game's own sign-in (an account signed in by password through the shared email sign-in cannot delete a player's data), and takes the deleted visits' rate counters with them | puts back 002's "Delete my account" |

It runs as `postgres`, never a superuser (a superuser's connection is moved to `postgres`; a superuser
`postgres` stops it), takes an advisory lock so two runs cannot overlap, waits at most 10 s for any lock another
app holds, and refuses a migration whose file changed since it was applied. Nothing is created outside
`highland`: the SQL tests prove the database outside it is the same, object for object and grant for grant,
before and after every migration and every rollback.

**Check** **[tried]**:

<!-- guide-check: check-config -->
```sql
select highland.hs_config();
```

answers one small line with `"now"`, and `status` says `highland at 5 of 5`.

**Rolling back.** To a given migration, after a backup (step 2), with `--yes` **[tried]**:

<!-- guide-check: migrate-down -->
```
node tools/platform/migrate.js down 4 --dsn="$HS_DB_URL" --yes
node tools/platform/migrate.js up --dsn="$HS_DB_URL"
```

`down 0 --yes` removes the schema and everything of the game. `--dry-run` shows the plan without changing
anything. If the optional sign-in handoff (`deploy/supabase/optional/handoff.up.sql`) was ever loaded, take it
away first (`psql "$HS_DB_URL" -1 -f deploy/supabase/optional/handoff.down.sql`), since it needs 003.

**If a grant was ever given by hand** (someone typed `grant select on highland.hs_saves to authenticated` in a
SQL editor), put it right **[tried]**:

<!-- guide-check: regrant -->
```
node tools/platform/migrate.js regrant --dsn="$HS_DB_URL"
```

(Even meanwhile, the policies let a player read only his own rows of the per-player tables, and nothing of the
others, and write nothing; `service_role` bypasses row level security, so for it the missing grants are the only
wall, which is why nothing is ever granted to it.)

---

## Step 4. The shared changes (each one asks first)

These three change the Supabase every app shares. **Each needs the owner's explicit yes, given for that change
alone, at the time.** Do them one at a time, with a backup of the two files first, and check each before the
next. Each restart **blips sign-in and the REST API for every app for a few seconds**: choose a quiet moment
and tell the other apps' users if they would notice.

The backup, before each change **[your server]**:

```
ssh server 'cd ~/supabase-project && t=$(date +%Y%m%d-%H%M%S) && cp -p .env .env.bak-$t && cp -p docker-compose.yml docker-compose.yml.bak-$t && ls -l .env.bak-$t docker-compose.yml.bak-$t'
```

The rollback of any of them: put the backup back and restart the same two services **[your server]**:

```
ssh server 'cd ~/supabase-project && cp -p .env.bak-THE_TIME .env && cp -p docker-compose.yml.bak-THE_TIME docker-compose.yml && docker compose up -d rest auth'
```

### 4a. Serve the schema `highland` [asks first]

PostgREST serves only the schemas in `PGRST_DB_SCHEMAS`. Append `highland`, never removing an entry
**[your server]**:

```
ssh server 'cd ~/supabase-project && sed -i "s/^PGRST_DB_SCHEMAS=public,graphql_public,reqstream$/PGRST_DB_SCHEMAS=public,graphql_public,reqstream,highland/" .env && grep "^PGRST_DB_SCHEMAS=" .env'
ssh server 'cd ~/supabase-project && docker compose up -d rest auth'
```

The `sed` changes the line only if it reads exactly as step 0 found it; if the last line does not end
`,highland`, stop and look (the line was different). The first schema stays `public`, so PathStream's calls, which
name no schema, go on reaching `public` as before.

**Check** **[tried]**:

<!-- guide-check: check-rest -->
```
curl -s -X POST https://db.avunjian.com/rest/v1/rpc/hs_config -H "apikey: THE_ANON_KEY" -H "Content-Type: application/json" -H "Content-Profile: highland" --data '{}'
curl -s -o /dev/null -w "%{http_code}\n" https://db.avunjian.com/rest/v1/hs_saves -H "apikey: THE_ANON_KEY" -H "Accept-Profile: highland"
```

The first answers a line with `"now"`; the second `401` (the table is refused by the database itself). A
`PGRST106` answer means `highland` is not yet in the list PostgREST read.

### 4b. Let the sign-in come back to the game [asks first]

`SITE_URL` is another app's, so a sign-in returns to the game only if its address is in
`ADDITIONAL_REDIRECT_URLS`; otherwise GoTrue sends the player to that other app. The page asks to come back to
its own address with its query: `https://highland.avunjian.com/?hsh=...` from the live game,
`https://highland.avunjian.com/next/?hsh=...` from the staging page, and `/?stats&hsh=...` or
`/next/?stats&hsh=...` from the stats page. GoTrue matches the whole address against each pattern, where `*`
stops at `/` and `.` and `**` does not, so `https://highland.avunjian.com/**` covers all four and
`https://highland.avunjian.com/next/**` the staging two (it is listed as well, so the staging page keeps working
even if the first is ever narrowed). Append both, keeping the existing ones **[your server]**:

```
ssh server 'cd ~/supabase-project && grep "^ADDITIONAL_REDIRECT_URLS=" .env'
ssh server 'cd ~/supabase-project && sed -i "/^ADDITIONAL_REDIRECT_URLS=./ s|\$|,https://highland.avunjian.com/**,https://highland.avunjian.com/next/**|" .env && grep "^ADDITIONAL_REDIRECT_URLS=" .env'
ssh server 'cd ~/supabase-project && docker compose up -d rest auth'
```

(If the first line printed an empty value, `ADDITIONAL_REDIRECT_URLS=` and nothing after it, the `sed` changes
nothing: then set the line to the two addresses alone, without a leading comma.)

**Check:** after step 4c, a sign-in begun on `https://highland.avunjian.com/next/` comes back to
`/next/` with `code=` in the address, not to the other app.

### 4c. The sign-in providers, only those not already there [asks first, one provider at a time]

Step 0's settings answer says which of `google`, `facebook` and `discord` are on. A provider already on (for
another app) needs nothing but the game's callback being the same callback address, which it is, since there is
one GoTrue: leave it as it is. For each one that is off, and only with the owner's yes for that provider:

1. In the provider's console, make the app (Google: an OAuth client of type Web application; Facebook: Facebook
   Login with `email` beside `public_profile`; Discord: an application with OAuth2), with the **callback
   address** `https://db.avunjian.com/auth/v1/callback` as its redirect, home page
   `https://highland.avunjian.com`, privacy `https://highland.avunjian.com/?privacy`, and for Facebook the
   deletion instructions `https://highland.avunjian.com/?privacy#delete`. If the provider's app already exists
   for another app, the game shares it: its name is what the consent screen shows. The privacy page has places
   in square brackets for you to fill first (your name, a contact address, the country, how many days the web
   server keeps its logs, the date): `docs/specs/owner/p8-privacy-checklist.md`. Until the live game has the
   build with the full page, the same page is at `https://highland.avunjian.com/next/?privacy`.
2. Add the provider's three values to `.env` with an editor on the server (not with a command that would put the
   secret in your shell history), e.g. `DISCORD_ENABLED=true`, `DISCORD_CLIENT_ID=...`, `DISCORD_SECRET=...`
   **[your server]**.
3. In `docker-compose.yml`, under the `auth:` service's `environment:`, the provider's lines, if they are not
   there yet (for Facebook and Discord also `..._EMAIL_OPTIONAL: "true"`, which lets in an account with no
   email) **[your server]**:

   ```
         GOTRUE_EXTERNAL_DISCORD_ENABLED: ${DISCORD_ENABLED}
         GOTRUE_EXTERNAL_DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID}
         GOTRUE_EXTERNAL_DISCORD_SECRET: ${DISCORD_SECRET}
         GOTRUE_EXTERNAL_DISCORD_REDIRECT_URI: ${API_EXTERNAL_URL}/auth/v1/callback
         GOTRUE_EXTERNAL_DISCORD_EMAIL_OPTIONAL: "true"
   ```

   (`API_EXTERNAL_URL` must be `https://db.avunjian.com`; step 0 printed it. If another provider's
   `REDIRECT_URI` line in the same file is written differently, copy its form.)
4. `docker compose up -d rest auth` **[your server]**.

**Check:** the settings answer of step 0 now says `true` for that provider, and
`curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://db.avunjian.com/auth/v1/authorize?provider=discord"`
answers `302` with the provider's address.

### PathStream's hooks

If step 0 found a `GOTRUE_HOOK_..._ENABLED: "true"` line, a hook runs on every sign-in, for every app. Read what
it does before the game's players sign in, without changing it **[your server]**: its `..._URI` line names it, for
example `pg-functions://postgres/public/custom_access_token_hook`; in `psql`, `\sf public.custom_access_token_hook`
shows it. It must let a Google, Facebook or Discord account that PathStream has never seen through: a
`before_user_created` hook that refuses unknown people would stop every new player, and a
`custom_access_token` hook must keep the claims `sub`, `role` (`authenticated`) and `amr` (the game asks that a
session began with a provider: `amr` holds `oauth`). If it does not, tell the builder and PathStream's
owner; do not edit another app's hook.

### The mail

The server's mail is a placeholder (`SMTP_HOST=supabase-mail`, a fake sender): no email leaves it. The game has
no email sign-in, so it sends and needs no mail: Google, Facebook and Discord confirm the address themselves. What
it means all the same:

- Email sign-up is open but no confirmation mail arrives. If `mailer_autoconfirm` is `true`, an address typed at
  any app's sign-up counts as confirmed without anyone proving it is theirs. GoTrue links accounts that share a
  confirmed email: someone could sign up with a player's address before that player first comes with Google, and
  share the account. The game guards against what that would give: an account becomes a player only through the
  name card and only with a Google, Facebook or Discord sign-in, and every player's function asks that the session
  itself began with one of them, so a password session of the same account reaches nothing of the game. While
  `mailer_autoconfirm` is `true` the page also holds the Discord button back (a Discord account may carry an
  address Discord never checked) and the stats page says so in red. Switching it off would change the other apps'
  sign-up, so it is theirs to decide.
- No recovery or magic-link mail reaches anyone: irrelevant to the game, which has no password.
- "Delete my account" sends no mail.

---

## Step 5. Hand over the two public values

The builder needs the public address `https://db.avunjian.com` and the anon key (`ANON_KEY` in `.env`, safe to
send: it is in every app's page). Nothing else. With them he runs the smoke test from outside **[tried]**:

<!-- guide-check: smoke -->
```
node tools/platform/smoke.js https://db.avunjian.com THE_ANON_KEY
```

On the shared server **check 11 fails by design**: it was written for a Supabase of the game's own behind a narrow
public name, and this one serves the whole API, Auth's sign-up included, for the other apps. What stands in its
place: no table or helper of `highland` is granted to any API role (checks 7 and 8), every table has row level
security with policies, and an account is a player only by the game's own name card. Any other FAIL comes with
what to do.

Until the builder puts the two values into the page, the page makes no request at all and plays exactly as it
does today.

---

## Step 6. Make yourself the admin

Sign in on `https://highland.avunjian.com/next/` with the account you want to be the admin, and choose a name.
Then, through the tunnel, with that account's email **[tried]**:

<!-- guide-check: admin -->
```sql
insert into highland.hs_admins (user_id) select id from auth.users where email = 'you@example.com';
```

It should say one row was added. **Check:** `https://highland.avunjian.com/next/?stats` shows the stats page.

**Names.** Words refused in player names, lower case, no spaces **[tried]**:

<!-- guide-check: names -->
```sql
insert into highland.hs_name_blocklist (pattern) values ('someword'), ('anotherword') on conflict do nothing;
```

**Switching the accounts off in a hurry**, for every player, without a new page **[tried]**:

<!-- guide-check: cloud-off -->
```sql
insert into highland.hs_config (key, value) values ('cloud', 'false') on conflict (key) do update set value = excluded.value;
```

and on again **[tried]**:

<!-- guide-check: cloud-on -->
```sql
delete from highland.hs_config where key = 'cloud';
```

---

## Who may do what

- **A visitor** (the anon key alone): `hs_config`, `hs_track`, `hs_board`, `hs_daily_status`.
- **A signed-in account** proves who it is, nothing more. It becomes a **player** only when the game's name card
  makes its profile (`hs_profile_set_name`), which it does only for an account that signed in with Google,
  Facebook or Discord. An account made through another app's email sign-up has no profile and gets what a visitor
  gets: every player's function answers `no_profile` (403).
- **A player**, in a session begun with a provider: his own profile, saves, battles and scores, nothing of
  anyone else's. No function takes another player's id.
- **An admin** (a row in `highland.hs_admins`, step 6): the stats page and its switches. Every other caller is
  refused with `not_admin`.
- **"Delete my account"** removes the player's rows in `highland` only (profile, saves, battles, scores, board
  rows, visits and the same devices' visits from before the sign-in, rate counters, an admin's row). It asks for a
  session begun with a provider (migration 005): the same account signed in by password through the shared email
  sign-in is refused (`not_game_session`). The sign-in account in `auth.users` is shared with the other apps and
  is never touched: the person can still sign in to them, and if they sign in to the game again they start as a
  new player. To have the sign-in itself removed, a person writes to the owner; what to do then is in
  `docs/specs/owner/p8-privacy-checklist.md`.

---

## Restoring

Rehearse a restore on your computer, never on the server, from a backup of step 2 **[tried]**:

<!-- guide-check: rehearsal -->
```
bash deploy/supabase/restore-rehearsal.sh highland-THE_TIME.dump
```

(Without a file it makes a populated database of its own and backs that up.) It restores into a fresh database
that has Supabase's stand-ins, as `postgres` (not a superuser), then checks everything below and runs the
isolation tests against the restored copy. The traps it walks through, which a real restore must handle the same
way:

1. **Extensions are not in the dump.** A dump of one schema carries no `CREATE EXTENSION`. Make any extension the
   schema needs first. The game needs none (it uses PostgreSQL's own `gen_random_uuid` and `normalize`); the
   rehearsal checks the dump for calls into one.
2. **`auth.users` is not in the dump, and must never be dumped for the game.** The game's tables point at it. On
   the real server the accounts are there already. In a scratch database, the rehearsal adds stand-in rows (ids
   only) between the data and the foreign keys, restoring in three sections (`--section=pre-data`, `data`,
   `post-data`).
3. **A restore widens the grants.** Supabase's global default privileges grant everything `postgres` makes, in
   any schema, to `anon`, `authenticated` and `service_role`; restoring re-creates every table and function, so
   they are all granted again (the rehearsal counts them: dozens). The dump's own grant lines do not take that
   back. **After every restore run `node tools/platform/migrate.js regrant`** (the lockdown and 003 again). The
   rehearsal also restores a second copy without it and shows the isolation tests fail on that copy.
4. **Restore as `postgres`, with `--no-owner`.** A superuser would own what it restores, and a function owned by
   a superuser runs as one. Do not restore with `--clean` into the live database: drop the schema with the
   migrations (`down 0`) after a backup, then restore.
5. **Nothing rides on settings or schedules.** No function reads a role or database setting of its own (only
   `auth.uid()` and `auth.jwt()` read the request's claims), `search_path` is pinned to `''` on every function in
   the function itself, and there is no `pg_cron` job (old visits leave by themselves and through the stats
   page's purge). The rehearsal checks all three on the restored copy, with row level security and its policies
   on every table and `security_invoker` on every view.
6. **The bookkeeping comes with the data.** `highland.schema_migrations` is restored with the rest; `migrate.js
   status` must then say every migration is applied with a matching checksum. A dump from an older version of the
   migrations restores the older schema: apply `up` after it.

To restore for real (after the owner's yes): back up the current schema (step 2), `migrate.js down 0 --yes`,
`pg_restore -d "$HS_DB_URL" --no-owner --exit-on-error --single-transaction highland-THE_TIME.dump`, then
`migrate.js regrant` and `migrate.js status`.

---

## What only the real server can show

- That Kong passes `Accept-Profile` and `Content-Profile` to PostgREST and allows them in its CORS answer (its
  cors plugin, set with no header list, allows what a preflight asks for, and the stand-in does the same; step
  4a's check tries the call, and the smoke test's check 4 the preflight).
- That GoTrue's tokens for a Google, Facebook or Discord sign-in carry `amr` with `oauth`, after a refresh too
  (decode one access token after signing in on `/next/`; the page never shows it, so use the browser's storage
  inspector: the key ends `hs_pf_auth`).
- That `postgres` may read `auth.identities` there (step 0's survey).
- That pg-safeupdate is loaded for the API's sessions (the tests load a stand-in of it; every UPDATE and DELETE in
  the migrations has a WHERE, checked by `tools/platform/sqlcheck.js`).
- That GoTrue matches the two redirect patterns as the stand-in does (step 4b's check).
- PathStream's hooks (above).
