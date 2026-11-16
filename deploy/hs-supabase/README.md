# Highland Stand's own Supabase (a second, separate stack)

This folder installs a Supabase for the game alone on the owner's server, beside the one the other apps use. It
has its own Postgres, its own JWT secret and its own accounts: nothing is shared with the existing stack, so the
other app's sign-up hook cannot refuse the game's players and a provider sign-in can never link to an account of
another app.

| | the existing stack (never touched) | the game's own (this folder) |
| --- | --- | --- |
| folder | `~/supabase-project` | `~/highland-supabase` |
| compose project | `supabase` | `highland` |
| containers | `supabase-db`, `supabase-auth`, `supabase-rest`, `supabase-envoy`, ... | `hs-db`, `hs-auth`, `hs-rest`, `hs-gw` |
| network, volumes | its own | `highland-net`; `highland-db-data`, `highland-db-config` |
| gateway | `127.0.0.1:8000` | `127.0.0.1:8200` |
| Postgres | `127.0.0.1:5432` (pooler) | `127.0.0.1:55632` (straight to the database, for the migrations) |
| public name | `https://db.avunjian.com` | `https://hs-db.avunjian.com` |

It is a **slim** stack: the database, Auth (GoTrue), the REST API (PostgREST) and the API gateway (Envoy). No
Studio, Realtime, Storage, imgproxy, postgres-meta, Edge Functions, Supavisor or analytics: the game uses none.

**The rules these scripts keep.** They never touch `~/supabase-project`, the existing containers, networks or
volumes, sshd, UFW or fail2ban. Every port is bound to `127.0.0.1`. No script prints a secret: the secrets are made
on the server and live only in `~/highland-supabase/.env` (mode 600). The one shared file that is changed, the
Caddyfile, is copied with a timestamp first, and only one marked block is added to it.

## Getting the folder to the server

From your computer, in the game's repository (nothing in this folder is secret):

```
scp -r deploy/hs-supabase deploy@31.220.31.85:~/hs-installer
ssh deploy@31.220.31.85
cd ~/hs-installer
```

## The order

Run each as the user `deploy` and read what it prints before the next. Each can be run again safely.

| # | command | what it changes | to undo |
| --- | --- | --- | --- |
| 1 | `./install.sh` | makes `~/highland-supabase` (the official files at a pinned commit, the compose file, the `.env` with new secrets), pulls four images, starts the four containers | `./uninstall.sh` |
| 2 | `./migrate.sh` | clones the game (branch `next`) into `~/highland-supabase/game`, applies its migrations: the schema `highland` in the new database | `HS_GAME_DIR=~/highland-supabase/game` then the tool's own `down 0 --yes` (below) |
| 3 | `./caddy.sh` | **the shared Caddyfile**: a timestamped copy, one new block for `hs-db.avunjian.com`, `caddy validate`, `systemctl reload caddy` (asks for your sudo password). Run it once the DNS record points at the server | `./caddy.sh --remove` |
| 4 | `./providers.sh google` | asks for Google's client ID and secret at hidden prompts, writes them to the `.env` (after a copy of it), recreates only `hs-auth` | `./providers.sh google --off`, or put the `.env.bak-<time>` back |
| 5 | `./show-public.sh` | nothing: prints the address and the anon key, the two public values for the page | |

`./status.sh` shows the containers, the published ports and the Auth service's public settings at any time.

### 1. `./install.sh`

It checks that nothing else holds ports 8200 and 55632 or the four container names, fetches twelve files of
`supabase/supabase` at commit `d17e66f202f95c2cb7d99b4effdba5d5d83e0131` (folder `docker/`) and refuses any whose
sha256 is not the one read when this installer was written, writes the compose file and the `.env`, starts the
stack, waits for the four containers to be healthy, and prints their states and the answer of
`GET /auth/v1/settings` (public information). **Check:** four containers `healthy`; the settings say
`"disable_signup":false`, `"mailer_autoconfirm":false` and `false` for every provider and for `email` and `phone`.

What is in the `.env` (names only): `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`,
`DASHBOARD_PASSWORD` (made on the server, never shown); `SITE_URL=https://highland.avunjian.com`,
`API_EXTERNAL_URL=https://hs-db.avunjian.com/auth/v1` (this version of Supabase wants the `/auth/v1` on it: the
providers' callback is that plus `/callback`), `SUPABASE_PUBLIC_URL=https://hs-db.avunjian.com`,
`ADDITIONAL_REDIRECT_URLS=https://highland.avunjian.com/**,https://highland.avunjian.com/next/**`,
`PGRST_DB_SCHEMAS=public,graphql_public,highland`, `DISABLE_SIGNUP=false`, and email, phone and anonymous sign-up
off. There are no hooks and no mail.

Run again: with the stack stopped it starts it; with the stack running it changes nothing and says so (exit 3).
`./install.sh --force-recreate-config` rewrites the files from this folder (after copies of the `.env` and the
compose file) and recreates only the containers whose configuration changed. It never makes a secret again and
never removes a volume. `./install.sh --prepare-only` writes the folder and starts nothing.

### 2. `./migrate.sh`

`status`, a dry run, `up`, `status`, then a call of `hs_config` through the gateway. If the repository is private
the clone fails with what to do (GitHub's CLI, a deploy key, or a checkout you copy over and name with
`HS_GAME_DIR=...`); it never asks for a token. **Check:** `highland at 5 of 5` (or however many migrations the
branch has) and `POST /rest/v1/rpc/hs_config answers 200`.

To roll the schema back (this removes **all the game's data**; `migrate.sh` dumps the schema into
`~/highland-supabase/backups` before it changes an existing one, and you can make a dump any time, below):

```
cd ~/highland-supabase/game
read -rs PGPASSWORD && export PGPASSWORD      # type the database password; or leave this to the builder
node tools/platform/migrate.js down 0 --yes --dsn=postgres://postgres@127.0.0.1:55632/postgres
unset PGPASSWORD
```

### 3. `./caddy.sh`

It refuses to start while `hs-db.avunjian.com` does not point at `31.220.31.85` (Caddy would fail to get the
certificate), and when the Caddyfile as it is does not pass `caddy validate` (then a validation after the change
would prove nothing). It adds the block of `caddy-block.txt` between two marks, only if the name is not in the
Caddyfile yet, and checks that no other line differs. If `caddy validate` or the reload fails, the copy is put
back. **Check:** `https://hs-db.avunjian.com/auth/v1/settings answers 401 without a key`.

There are two blocks:

- `caddy-block.txt` (the default): everything on the name goes to the gateway, like the block of
  `db.avunjian.com`. The gateway asks for the API key on every route but the three a browser is sent to
  (`authorize`, `callback`, `verify`).
- `caddy-block-narrow.txt`: only the Auth routes the page uses (`settings`, `authorize`, `callback`, `logout`,
  `health`, `token` for `pkce` and `refresh_token`, `user` to read) and `/rest/v1/rpc/hs_*`; everything else
  answers 404. This is the block the game's design asks for on a Supabase of its own
  (`docs/specs/platform.final.md`), and the one with which the smoke test's check 11 passes. Put it in once a
  sign-in has worked with the plain one: `./caddy.sh --narrow` (and `./caddy.sh --plain` to go back).

### 4. `./providers.sh google` (later `facebook`, `discord`)

First, in the provider's console, make the app with the callback address
**`https://hs-db.avunjian.com/auth/v1/callback`** (home page `https://highland.avunjian.com`, privacy
`https://highland.avunjian.com/?privacy`; the rest is in `deploy/supabase/README.md`, step 4c). Then run the
script and paste the client ID and the client secret at its two hidden prompts. **Check:** it ends with
`"google":true` and `sends the browser to: https://accounts.google.com`.

### 5. `./show-public.sh`

Prints `HS_SUPABASE_URL` and `HS_SUPABASE_ANON_KEY`. Both are public: the anon key is in the page every visitor
loads. Send the two lines to the builder. Never send anything else from the `.env`.

## Afterwards

- The builder's smoke test, from any computer: `node tools/platform/smoke.js https://hs-db.avunjian.com THE_ANON_KEY`.
  With the plain Caddy block check 11 fails (the whole API is on the name); with the narrow one it should pass.
- Make yourself the admin, after signing in on `https://highland.avunjian.com/next/` and choosing a name (the
  database's container holds its own password, so none is typed):

  ```
  docker exec -it hs-db psql -U postgres -h 127.0.0.1 -d postgres
  insert into highland.hs_admins (user_id) select id from auth.users where email = 'you@example.com';
  ```

- A copy of the game's schema, any time, and each night if you add it to cron:

  ```
  docker exec hs-db pg_dump -U postgres -h 127.0.0.1 -d postgres -n highland -Fc > ~/highland-supabase/backups/highland-$(date +%F).dump
  ```

  On this stack the accounts (`auth.users`) are the game's alone, so a full restore needs them as well:
  `docker exec hs-db pg_dump -U postgres -h 127.0.0.1 -d postgres -n highland -n auth -Fc`. That file holds
  every player's email: keep it on the server, mode 600.

## Rolling everything back

1. `./caddy.sh --remove` (the Caddyfile is as it was; each change also left `/etc/caddy/Caddyfile.bak-hs-<time>`).
2. `./uninstall.sh` (type `remove highland`): the four containers, the network and the two volumes of the project
   `highland` go, the database with them. The folder, its `.env` and a copy of the `.env` stay.
3. `rm -rf ~/highland-supabase ~/hs-installer` when you want the files gone too. The images stay in Docker's
   cache (`docker image ls`); three of the four are the existing stack's as well, so leave them.

The existing stack is not involved in any step, forward or back.

## How the slim stack was made from the official files

`docker-compose.slim.yml` is the official `docker/docker-compose.yml` of the pinned commit with seven services
taken out; its header lists every difference. What the missing services leave behind:

- **The gateway** waited for Studio (`depends_on: studio`); here it waits for Auth. Its configuration
  (`envoy.yaml`, `cds.yaml`, `lds.template.yaml`, `docker-entrypoint.sh`) is the official one, with **one line
  changed** (below). It still has routes and clusters for the services that are not here (`/storage/v1/`,
  `/functions/v1/`, `/realtime/v1/`, `/pg/`, and `/` for Studio behind a password). Their host names resolve to
  nothing on this stack's network, so those routes answer 503. They were left in on purpose: a hand-cut copy of
  a 1,276-line configuration could not be tried here (no Docker daemon, and no Envoy to load it), while the
  official file is known to start with upstreams missing (in the official stack Envoy starts before the
  functions container exists). The narrow Caddy block keeps all of them off the public name.
- **The database** keeps all seven official init scripts, so it is the same database as any self-hosted
  Supabase's: an empty schema `_realtime`, an empty database `_supabase` (with `_analytics` and `_supavisor`),
  and `supabase_functions`. They cost nothing and are needed if a service is ever added. The official stack
  publishes Postgres through Supavisor; here the database's own port is published, on `127.0.0.1:55632` only.
- **The one changed line.** The official gateway answers a browser's preflight with
  `access-control-allow-headers: *`. By the Fetch standard the wildcard does not cover `Authorization`, which
  the page sends on every call, and browsers are moving to enforce that. The installer writes
  `authorization,apikey,content-type,accept,accept-profile,content-profile,prefer,range,x-client-info,x-supabase-api-version,*`
  instead: every header the page sends by name, then the wildcard for any other. The result's sha256 is checked.
- **The keys** are made by `gen-env.js` with Node's crypto, not by the official `utils/generate-keys.sh`: that
  script prints every secret to the terminal, and makes ten values this stack does not use. The signing is the
  same (HS256; `role`, `iss: "supabase"`, `iat`, `exp`), with ten years to run. The passwords and the JWT secret
  are hex, so they are safe inside a `postgres://` address and a `.env` line.

What the gateway does with a request, read from the configuration:

| request | route | asks for |
| --- | --- | --- |
| `/auth/v1/authorize`, `/auth/v1/callback`, `/auth/v1/verify` | Auth | nothing (the browser arrives without a key) |
| `/auth/v1/...` (the rest: `settings`, `token`, `logout`, `user`) | Auth | `apikey` equal to the anon or the service key, else `401 Unauthorized` |
| `/rest/v1/` exactly (the API's description) | PostgREST | the service key |
| `/rest/v1/...` | PostgREST | `apikey` as above; when no `Authorization: Bearer <JWT>` came, the key is sent on as one |
| an `OPTIONS` preflight, any route but `/functions/v1/` | answered by the gateway | any origin; the headers above; remembered for an hour |

`Accept-Profile` and `Content-Profile` pass through to PostgREST untouched.

## What could not be verified without the server

Tried here: every script with `bash -n` and shellcheck; the compose file with `docker compose config` (four
services, container names `hs-*`, only `127.0.0.1:8200` and `127.0.0.1:55632` published, none of the ports in
use on the server); the keys' signatures, also against `openssl` as the official script signs; the pinned files
fetched and their sha256; the scripts' flow against a stand-in for the Docker CLI (first install, a second run,
`--force-recreate-config`, a foreign container of the same name, a busy port, an unhealthy container with its
log redacted, a port published beyond 127.0.0.1); `migrate.sh` against a throwaway PostgreSQL 16 with Supabase's
stand-ins on 127.0.0.1:55632; `providers.sh` and `caddy.sh` against stand-ins (add, add twice, narrow, plain,
remove, a failing validation, a failing reload).

Not tried, because no container could be started and neither Envoy, GoTrue, PostgREST nor Caddy could be run:

1. That the four images start together with this compose file: the database's first start, GoTrue's own
   migrations, PostgREST starting while the schema `highland` does not exist yet (`migrate.sh` restarts it if
   the API does not serve the schema after the migrations).
2. That Envoy starts with the clusters of the missing services (expected: yes, see above) and accepts the
   changed CORS line (it is a plain string to Envoy).
3. That `postgres` connects over `127.0.0.1:55632` with `POSTGRES_PASSWORD` and is not a superuser there, as on
   the existing stack, which runs the same database image (`migrate.js` stops if it is one), that it may
   create a schema in the database `postgres`, and that it holds the rights on `auth.users` and
   `auth.identities` the migrations need (all standard on Supabase).
4. That GoTrue starts with email sign-up off and the placeholder mail settings, and that
   `GOTRUE_EXTERNAL_<NAME>_EMAIL_OPTIONAL` is honoured by this version for Facebook and Discord.
5. The two Caddy blocks against the real Caddy (`caddy validate` runs on the server before the reload, and the
   copy is put back if it fails), and that `sudo caddy validate` by hand sees what the service sees (if the
   Caddyfile reads variables the service sets, the script stops before changing anything).
6. A real sign-in: Google's consent, the return to `/next/` with `code=`, the token's `amr` holding `oauth`.
7. The browser's preflight against the real gateway (the smoke test's check 4 asks it).
