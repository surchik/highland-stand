#!/bin/bash
# Builds the tests' stand-in for pg-safeupdate (safeupdate.c) into /var/tmp/hs-stack-lib/safeupdate.so, where
# tools/platform/pgtemp.js finds it and loads it for the API's sessions (the authenticator role), as the shared
# Supabase does. Optional: without it the tests rely on the static check (tools/platform/sqlcheck.js) alone.
#
#   bash tools/platform/safeupdate/build.sh [path/to/server/include]
#
# It needs gcc and PostgreSQL 16's server headers: the package postgresql-server-dev-16, or that package unpacked
# without installing it (apt-get download postgresql-server-dev-16; dpkg -x <the .deb> <folder>; then pass
# <folder>/usr/include/postgresql/16/server).
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
INC=${1:-$(/usr/lib/postgresql/16/bin/pg_config --includedir-server)}
[ -f "$INC/postgres.h" ] || { echo "no PostgreSQL server headers at $INC (see the comment at the top of this file)"; exit 1; }
OUT=${HS_SAFEUPDATE_DIR:-/var/tmp/hs-stack-lib}
mkdir -p "$OUT"
gcc -O2 -Wall -fPIC -shared -I "$INC" -o "$OUT/safeupdate.so" "$HERE/safeupdate.c"
chmod 755 "$OUT" "$OUT/safeupdate.so"
echo "built $OUT/safeupdate.so"
