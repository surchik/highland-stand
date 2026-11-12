# The game on the shared Supabase: the owner's checklist

Everything the game needs on `https://db.avunjian.com`, in order. The full guide, with the reasons, is
`deploy/supabase/README.md`. Nothing here prints a secret. Data on this host stays synthetic or non-PHI.

## 1. Look first (read only, no secret printed)

```
ssh server 'cd ~/supabase-project && docker compose ps --format "{{.Service}} {{.State}}"'
ssh server 'cd ~/supabase-project && grep -E "^(PGRST_DB_SCHEMAS|ADDITIONAL_REDIRECT_URLS|SITE_URL|API_EXTERNAL_URL|ENABLE_EMAIL_SIGNUP|ENABLE_EMAIL_AUTOCONFIRM|DISABLE_SIGNUP|SMTP_HOST|SMTP_SENDER_NAME|SMTP_ADMIN_EMAIL)=" .env'
ssh server 'cd ~/supabase-project && grep -oE "^[A-Z_]*(GOOGLE|FACEBOOK|DISCORD)[A-Z_]*_ENABLED=[a-z]*" .env; grep -nE "GOTRUE_EXTERNAL_(GOOGLE|FACEBOOK|DISCORD)_[A-Z_]+" docker-compose.yml | cut -d: -f1-2'
ssh server 'cd ~/supabase-project && grep -nE "GOTRUE_HOOK_[A-Z_]+_(ENABLED|URI)" docker-compose.yml .env'
ssh server 'docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}" supabase-db'
curl -s -H "apikey: THE_ANON_KEY" https://db.avunjian.com/auth/v1/settings
```

Then, through the tunnel (`ssh -N -L 127.0.0.1:55622:<the address>:5432 server`, the password only in
`PGPASSWORD`), the guide's step 0 queries: `postgres` is not a superuser, may read `auth.users` and
`auth.identities`, and there is no schema `highland` yet.

If a `GOTRUE_HOOK_...` is on (PathStream's), read the hook it names (`\sf <function>` in psql) and check it lets
in a Google, Facebook or Discord account PathStream has never seen and keeps the token's `sub`, `role` and `amr`.

## 2. The game's own schema (no other app is touched; no yes needed beyond starting)

| do | backup first | rollback |
| --- | --- | --- |
| `node tools/platform/migrate.js up --dsn="$HS_DB_URL"` | `pg_dump "$HS_DB_URL" -n highland -Fc -f highland-$(date +%Y%m%d-%H%M%S).dump` (nothing to copy the very first time) | `node tools/platform/migrate.js down 0 --dsn="$HS_DB_URL" --yes` (removes the schema `highland` and all its data, nothing else) |

Check: `migrate.js status` says `highland at 4 of 4`; `select highland.hs_config();` answers with `"now"`.

## 3. The shared changes: each one needs the owner's yes, alone, at the time

Before each, the backup of the two files:

```
ssh server 'cd ~/supabase-project && t=$(date +%Y%m%d-%H%M%S) && cp -p .env .env.bak-$t && cp -p docker-compose.yml docker-compose.yml.bak-$t && ls -l .env.bak-$t docker-compose.yml.bak-$t'
```

After each: `ssh server 'cd ~/supabase-project && docker compose up -d rest auth'`. **This blips sign-in and the
REST API for every app for a few seconds.**

Rollback of each: `ssh server 'cd ~/supabase-project && cp -p .env.bak-THE_TIME .env && cp -p docker-compose.yml.bak-THE_TIME docker-compose.yml && docker compose up -d rest auth'`.

- [ ] **a. Serve the schema.** `PGRST_DB_SCHEMAS=public,graphql_public,reqstream` becomes
      `public,graphql_public,reqstream,highland` (append only; `public` stays first, so the other apps' calls are
      unchanged). The guide's step 4a has the exact `sed`. Check: `POST /rest/v1/rpc/hs_config` with
      `Content-Profile: highland` answers `"now"`; `GET /rest/v1/hs_saves` with `Accept-Profile: highland`
      answers 401.
- [ ] **b. Let the sign-in come back.** Append `https://highland.avunjian.com/**` and
      `https://highland.avunjian.com/next/**` to `ADDITIONAL_REDIRECT_URLS`, keeping every existing entry. The
      page returns to `https://highland.avunjian.com/?hsh=...`, `/next/?hsh=...`, `/?stats&hsh=...` and
      `/next/?stats&hsh=...`; `/**` covers all four, `/next/**` the staging two. Check: a sign-in on `/next/`
      comes back to `/next/` with `code=`, not to the other app.
- [ ] **c. A provider, only if step 1 shows it off.** One change per provider (Google, Facebook, Discord): its app
      in the provider's console with the callback `https://db.avunjian.com/auth/v1/callback`; its three values
      in `.env` typed in an editor on the server; its `GOTRUE_EXTERNAL_<NAME>_...` lines in `docker-compose.yml`
      (guide, step 4c). A provider already on for another app needs nothing. Check: `/auth/v1/settings` says
      `true` for it.

Nothing else is changed: not `SITE_URL`, not `ENABLE_EMAIL_AUTOCONFIRM`, not the mail, not another app's hook,
schema or grants.

## 4. Afterwards

- [ ] Send the builder the public address and the anon key: the only two values that go into the page.
- [ ] Sign in on `https://highland.avunjian.com/next/`, choose a name, then through the tunnel:
      `insert into highland.hs_admins (user_id) select id from auth.users where email = 'you@example.com';`
- [ ] The nightly backup of `highland` alone (guide, step 2); a restore rehearsed on a computer with
      `bash deploy/supabase/restore-rehearsal.sh highland-THE_TIME.dump`.

## 5. What only the real server can show (to try once 2 and 3 are done)

- Kong passing `Accept-Profile` and `Content-Profile` through and allowing them in its CORS answer (the smoke
  test's check 4 and the step 4a check).
- GoTrue's access token after a Google sign-in carrying `amr` with `oauth`, after a refresh too (the game refuses
  a player's functions to a session without it).
- GoTrue matching the two redirect patterns against the page's four return addresses.
- `postgres` reading `auth.identities`; pg-safeupdate loaded for the API (every UPDATE and DELETE of the
  migrations has a WHERE, so it changes nothing for the game).
- PathStream's hooks letting the game's players through.
- The smoke test: `node tools/platform/smoke.js https://db.avunjian.com THE_ANON_KEY`. Check 11 fails by design on
  a server that serves the whole API; every other check must pass (12 and 13 are answered only from outside).
- The checklist of `docs/specs/owner/p2-signin-checklist.md` on `/next/`.
