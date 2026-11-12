#!/bin/bash
# Tries deploy/update.sh on throwaway copies (docs/specs/platform.final.md 9.3): a bare "origin", clones standing in
# for /opt/highland-stand and folders standing in for the web root (the script honors HS_REPO, HS_WEB and HS_NODE).
# Nothing outside the temporary folder is touched.
#
#   bash tools/platform/test-update.sh [path/to/update.sh] [path/to/the/old/update.sh] [path/to/check-page.js]
#
# The new script defaults to deploy/update.sh; the old one to deploy/update.sh as master had it before the
# staging channel reached it (git show f905f4a:deploy/update.sh), the script the server handed over from; check-page.js to deploy/check-page.js.
#
# Part A, the live flow is what it was: the old and the new script are run side by side on twin clones, through
# the same pushes to master with no branch next, and must leave byte for byte the same web root, the same log
# (time stamps aside), the same exit status, the same commit checked out and the same marker files, in every case
# the old script knows: a first publish, nothing new, a new page and picture, a broken page (refused, logged
# once), mended, no Node.js found, a check that cannot run (exit 2), the remote gone.
# Part B, the staging channel: the owner's own folder named next (never removed or written into, said once); no
# branch next while a branch feature/next exists (not taken for next); a good next published at /next/ with its og.jpg, the live page
# untouched and the clone still on master with a clean tree; a next that fails check-page not published, the live
# page untouched, logged once over three runs, master still published on the same run; next mended; a next without
# the staging namespace line refused once; a next without og.jpg leaves none behind; a check that cannot run is
# tried again; no Node.js (said once over three runs); a failure halfway through (no temporary folder left, which
# every run checks); a broken master while /next/ stays served; the remote unreachable; the branch deleted (/next/
# removed, said once).
# Part C, the hand-over: a server running the old script from its own clone gets the commit that brings the new
# one. That first run is still the old script and publishes master only; the run after it is the new script and
# publishes /next/.
# Part D: bash -n on the new script.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
NEW=$(readlink -f "${1:-$ROOT/deploy/update.sh}")
CHK=$(readlink -f "${3:-$ROOT/deploy/check-page.js}")
T=$(mktemp -d); trap 'chmod -R u+w "$T" 2>/dev/null; rm -rf "$T"' EXIT
if [ -n "${2:-}" ]; then OLD=$(readlink -f "$2"); else OLD=$T/old-update.sh; git -C "$ROOT" show f905f4a:deploy/update.sh > "$OLD"; fi
NODE_BIN=$(command -v node)
fails=0; cases=0
fail() { echo "FAIL: $*"; fails=$((fails + 1)); }
pass() { cases=$((cases + 1)); echo "ok   $*"; }
page() { printf '<!doctype html><title>%s</title><script>"use strict"; const v = "%s";</script>\n' "$1" "$1"; }
# a page as the staging channel wants it: it carries the namespace line of PF-0
npage() { printf '<!doctype html><title>%s</title><script>"use strict"; const HS_CHANNEL = "next"; const v = "%s";</script>\n' "$1" "$1"; }
broken() { printf '<script>const = ;</script>\n'; }
# a node that passes the version test but whose check-page.js run stops on an error of its own (exit 2)
cat > "$T/node2" <<EOF
#!/bin/bash
if [ "\$1" = "-e" ]; then exec "$NODE_BIN" "\$@"; fi
if [ "\$1" = "-v" ]; then exec "$NODE_BIN" -v; fi
exit 2
EOF
chmod +x "$T/node2"

# ------------------------------------------------------------------ the shared origin and a working copy
git init -q --bare "$T/origin.git"
git clone -q "$T/origin.git" "$T/work" 2>/dev/null
cd "$T/work"; git config user.email t@example.com; git config user.name t; git config push.negotiate false; git checkout -q -b master
mkdir deploy; cp "$CHK" deploy/check-page.js; cp "$NEW" deploy/update.sh
page live1 > index.html; printf 'jpg1' > og.jpg
git add -A; git commit -q -m one; git push -q origin master
commit() { git add -A; git commit -q -m "$1"; git push -q "${2:-origin}" "$(git rev-parse --abbrev-ref HEAD)"; }

# ------------------------------------------------------------------ part A: the live flow is byte for byte today's
for w in old new; do git clone -q "$T/origin.git" "$T/repo-$w"; mkdir "$T/web-$w"; done
twin() {   # run both scripts once, each from outside its clone (so a reset cannot swap the script under test)
  local w s
  for w in old new; do
    s=$OLD; [ $w = new ] && s=$NEW
    set +e; env HS_REPO="$T/repo-$w" HS_WEB="$T/web-$w" "$@" bash "$s" > "$T/out-$w" 2>&1; echo $? > "$T/rc-$w"; set -e
    sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+[+-][0-9:]+ //' "$T/out-$w" >> "$T/log-$w"
    cat "$T/rc-$w" >> "$T/log-$w"
  done
}
same() {   # the two twins agree on everything the live server can see
  local what=$1 d
  d=$( (cd "$T/web-old" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) ; echo ---; (cd "$T/web-new" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) )
  if [ "$(echo "$d" | sed -n '1,/^---$/p' | sed '$d')" != "$(echo "$d" | sed -n '/^---$/,$p' | sed '1d')" ]; then fail "$what: the web roots differ"; return; fi
  if ! cmp -s "$T/log-old" "$T/log-new"; then fail "$what: the logs differ"; diff "$T/log-old" "$T/log-new" | head -10; return; fi
  if [ "$(git -C "$T/repo-old" rev-parse HEAD)" != "$(git -C "$T/repo-new" rev-parse HEAD)" ]; then fail "$what: the clones are on different commits"; return; fi
  if [ "$(cat "$T/repo-old/.git/hs-rejected" 2>/dev/null)" != "$(cat "$T/repo-new/.git/hs-rejected" 2>/dev/null)" ]; then fail "$what: the rejected markers differ"; return; fi
  if [ -n "$(git -C "$T/repo-new" status --porcelain)" ] || [ -e "$T/web-new/next" ] || ls "$T/repo-new/.git" | grep -q hs-next; then fail "$what: the new script left staging traces with no branch next"; return; fi
  pass "A. $what: the same web root, log, exit status, commit and markers as today's script"
}
twin; same "a first publish"
twin; twin; same "nothing new, twice"
page live2 > index.html; printf 'jpg2' > og.jpg; commit two; twin; same "a new page and a new picture"
broken > index.html; commit bad1; twin; twin; twin; same "a broken page: refused, logged once over three runs"
grep -q 'NOT published' "$T/log-new" || fail "A. the broken page was not reported"
page live3 > index.html; commit three; twin; same "the page mended"
page live4 > index.html; commit four; twin HS_NODE=/nonexistent/node; same "no Node.js found: published unchecked with a warning"
page live5 > index.html; commit five; twin HS_NODE="$T/node2"; twin HS_NODE="$T/node2"; same "a check that cannot run: nothing published, tried again"
twin; same "and published once it can run"
mv "$T/origin.git" "$T/origin.gone"; twin; same "the remote gone: the same failure"
mv "$T/origin.gone" "$T/origin.git"
[ "$(tail -1 "$T/log-new")" != 0 ] || fail "A. the remote gone did not end in an error"
twin; same "the remote back"
cp "$T/log-new" "$T/partA.log"

# ------------------------------------------------------------------ part B: the staging channel
git clone -q "$T/origin.git" "$T/repo"; mkdir "$T/web"
# every run gets a TMPDIR of its own: a temporary folder left in it afterward is a leak
mkdir "$T/tmpd"
run() { local rc=0; env HS_REPO="$T/repo" HS_WEB="$T/web" TMPDIR="$T/tmpd" "$@" bash "$NEW" >> "$T/log" 2>&1 || rc=$?; echo $rc >> "$T/rcs"
  if [ -n "$(ls -A "$T/tmpd")" ]; then fail "B. a run left a temporary folder behind: $(ls -A "$T/tmpd")"; rm -rf "${T:?}/tmpd/"*; fi; }
lastrc() { tail -1 "$T/rcs"; }
cnt() { grep -c "$1" "$T/log" || true; }
onmaster() { [ "$(git -C "$T/repo" rev-parse HEAD)" = "$(git -C "$T/repo" rev-parse origin/master)" ] && [ -z "$(git -C "$T/repo" status --porcelain)" ]; }
# 0. the owner's own folder named next, made before this script: never removed or written into, said once
mkdir "$T/web/next"; echo "the owner's own" > "$T/web/next/notes.txt"
run; run
if [ "$(cat "$T/web/next/notes.txt" 2>/dev/null)" = "the owner's own" ] && [ "$(cnt 'staging is off')" = 1 ] && [ "$(lastrc)" = 0 ]; then
  pass "B0. a folder next the script did not make, no branch next: kept, said once"
else fail "B0: kept $(ls "$T/web/next" 2>&1), said $(cnt 'staging is off') times"; fi
# 1. no branch next; branches whose names only end in next (feature/next) are not the staging branch
git checkout -q -b feature/next; npage feat > index.html; commit feat; git checkout -q master
page live6 > index.html; commit six; run
if grep -q live6 "$T/web/index.html" && [ "$(ls "$T/web/next")" = notes.txt ] && [ "$(lastrc)" = 0 ] && [ "$(cnt 'staging is off')" = 1 ]; then
  pass "B1. no branch next, a branch feature/next: master published, the owner's folder untouched"
else fail "B1"; fi
mv "$T/web/next" "$T/owner-next"; run
if [ ! -e "$T/web/next" ] && [ "$(cnt 'next')" = "$(cnt 'staging is off')" ]; then pass "B1b. the owner's folder moved away, still no branch next: feature/next is not published, nothing said"; else fail "B1b"; cat "$T/log"; fi
# 2. a good next, with its picture (beside feature/next, which the remote may list first)
git checkout -q -b next master; npage next1 > index.html; printf 'jpg-next' > og.jpg; commit n1; run
if grep -q next1 "$T/web/next/index.html" && [ "$(cat "$T/web/next/og.jpg")" = jpg-next ] && grep -q live6 "$T/web/index.html" \
   && [ "$(cat "$T/web/og.jpg")" = jpg2 ] && onmaster && [ "$(lastrc)" = 0 ] && [ "$(cnt 'published next')" = 1 ]; then
  pass "B2. a good next: published at /next/ with its og.jpg; the live page and picture untouched; the clone on master, clean"
else fail "B2"; fi
run; run
[ "$(cnt 'published next')" = 1 ] && pass "B2b. the same next is not published or logged again" || fail "B2b: logged $(cnt 'published next') times"
# 3. a next that fails check-page, while master moves on the same run
broken > index.html; commit nbad
git checkout -q master; page live7 > index.html; commit seven
run; run; run
if grep -q next1 "$T/web/next/index.html" && grep -q live7 "$T/web/index.html" && [ "$(cnt 'NOT published next')" = 1 ] && onmaster && [ "$(lastrc)" = 0 ]; then
  pass "B3. a next that fails its check: not published, /next/ keeps what it had, logged once over three runs; master published on the same run"
else fail "B3: logged $(cnt 'NOT published next') times"; fi
grep -q 'NOT published next .*failed its check' "$T/log" || fail "B3: the failure does not say why"
# 4. next mended
git checkout -q next; npage next2 > index.html; commit n2; run
grep -q next2 "$T/web/next/index.html" && pass "B4. next mended: published" || fail "B4"
# 5. a next without the staging namespace
page next3 > index.html; commit n3; run; run
if grep -q next2 "$T/web/next/index.html" && [ "$(cnt 'lacks the staging namespace')" = 1 ]; then pass "B5. a next without the namespace line: refused once"; else fail "B5"; fi
# 6. a next without og.jpg leaves none behind
npage next4 > index.html; git rm -q og.jpg; commit n4; run
if grep -q next4 "$T/web/next/index.html" && [ ! -e "$T/web/next/og.jpg" ] && [ "$(cat "$T/web/og.jpg")" = jpg2 ]; then pass "B6. a next without og.jpg: none left at /next/, the live one untouched"; else fail "B6"; fi
# 7. a check that cannot run is tried again, and never marks the commit refused
npage next5 > index.html; printf 'jpg-next5' > og.jpg; commit n5; run HS_NODE="$T/node2"; run HS_NODE="$T/node2"
if grep -q next4 "$T/web/next/index.html" && [ "$(cnt 'check could not run (exit 2)')" = 2 ] && [ "$(lastrc)" = 0 ]; then pass "B7. a check that cannot run: nothing published, tried again each run"; else fail "B7"; fi
run
if grep -q next5 "$T/web/next/index.html" && [ "$(cat "$T/web/next/og.jpg")" = jpg-next5 ]; then pass "B7b. and published once it can"; else fail "B7b"; fi
# 8. no node at all: master goes out unchecked as always, next does not go out
npage next6 > index.html; commit n6; run HS_NODE=/nonexistent/node; run HS_NODE=/nonexistent/node; run HS_NODE=/nonexistent/node
if grep -q next5 "$T/web/next/index.html" && [ "$(cnt 'no Node.js 18 or newer found to check it')" = 1 ]; then pass "B8. no Node.js: next is not published unchecked, said once over three runs"; else fail "B8: said $(cnt 'no Node.js 18 or newer found to check it') times"; fi
run
grep -q next6 "$T/web/next/index.html" && pass "B8b. and goes out once node is back" || fail "B8b"
# 8c. a failure halfway through publishing (a file where the folder was) stops the staging flow and leaves no
# temporary folder (run() checks), and the live flow is not touched
git checkout -q next; npage next6b > index.html; commit n6b
rm -rf "$T/web/next"; echo x > "$T/web/next"; run; run
if [ "$(cat "$T/web/next")" = x ] && [ "$(lastrc)" = 0 ]; then pass "B8c. a failure halfway through: nothing left in TMPDIR, the exit status master's"; else fail "B8c"; fi
rm -f "$T/web/next"; run
grep -q next6b "$T/web/next/index.html" && pass "B8d. and published once the way is clear" || fail "B8d"
git checkout -q next; npage next6 > index.html; commit n6c; run
# 9. a broken master while /next/ stays served
git checkout -q master; broken > index.html; commit bad2; run
if grep -q live7 "$T/web/index.html" && grep -q next6 "$T/web/next/index.html" && [ "$(lastrc)" = 1 ]; then pass "B9. a broken master: the live page stays, /next/ stays, the run reports master's failure"; else fail "B9"; fi
page live8 > index.html; commit eight; run
grep -q live8 "$T/web/index.html" && [ "$(lastrc)" = 0 ] && pass "B9b. master mended" || fail "B9b"
# 10. a next whose problem could hide master's: the exit status is master's alone
git checkout -q next; broken > index.html; commit nbad2; run
[ "$(lastrc)" = 0 ] && pass "B10. a broken next never changes the run's exit status" || fail "B10"
npage next7 > index.html; commit n7; run
# 11. the remote unreachable: /next/ left as it is
mv "$T/origin.git" "$T/origin.gone"; run; mv "$T/origin.gone" "$T/origin.git"
if grep -q next7 "$T/web/next/index.html" && grep -q live8 "$T/web/index.html"; then pass "B11. the remote unreachable: /next/ and the live page left as they are"; else fail "B11"; fi
# 12. the branch deleted
git checkout -q master; git push -q origin --delete next; run; run
if [ ! -e "$T/web/next" ] && grep -q live8 "$T/web/index.html" && [ "$(cnt 'removed /next/')" = 1 ] && [ ! -e "$T/repo/.git/hs-next-live" ]; then
  pass "B12. the branch deleted: /next/ removed, said once, the live page untouched"
else fail "B12"; fi
# 12b. feature/next alone left on the remote: still nothing at /next/
[ -n "$(git ls-remote "$T/origin.git" refs/heads/feature/next)" ] && [ ! -e "$T/web/next" ] && pass "B12b. with only feature/next left, /next/ stays away" || fail "B12b"

onmaster && pass "B13. through all of it the clone stayed on master with a clean tree" || fail "B13"
cp "$T/log" "$T/partB.log"

# ------------------------------------------------------------------ part C: the hand-over from the old script to the new
git init -q --bare "$T/o2.git"
git clone -q "$T/o2.git" "$T/w2" 2>/dev/null
cd "$T/w2"; git config user.email t@example.com; git config user.name t; git config push.negotiate false; git checkout -q -b master
mkdir deploy; cp "$CHK" deploy/check-page.js; cp "$OLD" deploy/update.sh; chmod +x deploy/update.sh
page h1 > index.html; printf 'jpgh' > og.jpg; git add -A; git commit -q -m h1; git push -q origin master
git clone -q "$T/o2.git" "$T/srv"; mkdir "$T/www"
install -m 644 "$T/srv/og.jpg" "$T/www/og.jpg"; install -m 644 "$T/srv/index.html" "$T/www/index.html"   # as setup-server.sh does once
cron() { local rc=0; (cd / && HS_REPO="$T/srv" HS_WEB="$T/www" "$T/srv/deploy/update.sh" >> "$T/log2" 2>&1) || rc=$?; echo $rc >> "$T/rc2"; }   # as cron runs it: the clone's own copy
cron
grep -q h1 "$T/www/index.html" && [ ! -s "$T/log2" ] || fail "C. the old script's quiet run"
# branch next exists already when the new script arrives on master
git checkout -q -b next; npage hn1 > index.html; git add -A; git commit -q -m hn1; git push -q origin next
git checkout -q master; cp "$NEW" deploy/update.sh; page h2 > index.html; git add -A; git commit -q -m "the new update.sh"; git push -q origin master
cron
if grep -q h2 "$T/www/index.html" && [ ! -e "$T/www/next" ] && cmp -s "$T/srv/deploy/update.sh" "$NEW"; then
  pass "C1. the run that pulls the new script is still the old one: master published, no /next/ yet, the new script in place"
else fail "C1"; fi
cron
if grep -q hn1 "$T/www/next/index.html" && grep -q h2 "$T/www/index.html" && [ "$(tail -1 "$T/rc2")" = 0 ]; then pass "C2. the run after it is the new script: /next/ published"; else fail "C2"; fi
cron
[ "$(grep -c 'published next' "$T/log2")" = 1 ] && pass "C3. and is quiet after that" || fail "C3"
cp "$T/log2" "$T/partC.log"

# ------------------------------------------------------------------ part D
if bash -n "$NEW"; then pass "D. bash -n $(basename "$NEW")"; else fail "D. bash -n"; fi

if [ "${VERBOSE:-}" = 1 ]; then for f in partA partB partC; do echo "--- $f log"; cat "$T/$f.log"; done; fi
if [ "$fails" = 0 ]; then echo "PASS: update.sh publishes master as before and next at /next/ ($cases cases)"; else echo "FAIL: $fails of $((cases + fails)) cases"; exit 1; fi
