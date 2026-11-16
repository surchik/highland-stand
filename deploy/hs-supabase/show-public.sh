#!/usr/bin/env bash
# Prints the two PUBLIC values the game's page needs, and nothing else:
#   the address  https://hs-db.avunjian.com
#   the anon key (ANON_KEY)
# The anon key is public by design: it is written into the page every visitor loads, and by itself it allows only
# what the role "anon" is granted (for the game: four functions). It is safe to paste to the builder.
# The service role key, the JWT secret and the database password are never read or printed here.
#   ./show-public.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"
guard_home
need node
[ -f "$HS_ENV" ] || die "no $HS_ENV: the stack is not installed (install.sh)"
anon="$(env_get ANON_KEY)" || die "no ANON_KEY in $HS_ENV"
# print it only if it really is an anon key: a JWT whose role is "anon" (never the service key by a slip of the file)
role="$(HS_K="$anon" node -e 'try { const p = JSON.parse(Buffer.from(process.env.HS_K.split(".")[1], "base64url").toString()); process.stdout.write(String(p.role)); } catch (e) { process.stdout.write("?"); }')"
[ "$role" = anon ] || die "ANON_KEY in the .env is not an anon key (its role reads '$role'). Nothing was printed."
printf 'HS_SUPABASE_URL=%s\n' "$HS_PUBLIC_URL"
printf 'HS_SUPABASE_ANON_KEY=%s\n' "$anon"
