#!/bin/bash
# Tries deploy/update.sh on a throwaway copy: a bare "origin", a clone standing in for /opt/highland-stand and
# a folder standing in for the web root (the script honors HS_REPO and HS_WEB). Nothing outside the temporary
# folder is touched. Usage: bash test-update.sh path/to/update.sh [path/to/check-page.js]
set -eu
UPD=$(readlink -f "${1:?usage: test-update.sh path/to/update.sh [check-page.js]}")
CHK=$(readlink -f "${2:-$(dirname "$UPD")/check-page.js}")
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail() { echo "FAIL: $*"; exit 1; }
page() { printf '<!doctype html><title>%s</title><script>"use strict"; const v = "%s";</script>\n' "$1" "$1"; }
# a page as the staging channel wants it: it carries the namespace line of PF-0
npage() { printf '<!doctype html><title>%s</title><script>"use strict"; const HS_CHANNEL = "next"; const v = "%s";</script>\n' "$1" "$1"; }
git init -q --bare "$T/origin.git"
git clone -q "$T/origin.git" "$T/work" 2>/dev/null
cd "$T/work"; git config user.email t@example.com; git config user.name t; git config push.negotiate false; git checkout -q -b master
mkdir deploy; cp "$UPD" deploy/update.sh; cp "$CHK" deploy/check-page.js
page live1 > index.html; printf 'jpg1' > og.jpg
git add -A; git commit -q -m one; git push -q origin master
git clone -q "$T/origin.git" "$T/repo"; mkdir "$T/web"
run() { HS_REPO="$T/repo" HS_WEB="$T/web" bash "$T/repo/deploy/update.sh" >> "$T/log" 2>&1 || true; }

# 1. no branch next: the live page goes out as before, and no /next/ appears
page live2 > index.html; git commit -q -am two; git push -q origin master
run
grep -q live2 "$T/web/index.html" || fail "master was not published"
[ ! -e "$T/web/next" ] || fail "/next/ appeared without a branch"
# 2. a branch next: published at /next/, the live page untouched, the clone still on master
git checkout -q -b next; npage next1 > index.html; printf 'jpg-next' > og.jpg; git commit -q -am n1; git push -q origin next
run
grep -q next1 "$T/web/next/index.html" || fail "next was not published"
grep -q live2 "$T/web/index.html" || fail "the live page changed with next"
[ "$(cat "$T/web/next/og.jpg")" = jpg-next ] || fail "next's og.jpg"
[ "$(git -C "$T/repo" rev-parse HEAD)" = "$(git -C "$T/repo" rev-parse origin/master)" ] || fail "the clone left master"
# 3. a broken page on next: not published, logged once, and master still goes out on the same run
printf '<script>const = ;</script>\n' > index.html; git commit -q -am broken; git push -q origin next
git checkout -q master; page live3 > index.html; git commit -q -am three; git push -q origin master
run; run; run
grep -q next1 "$T/web/next/index.html" || fail "a broken next replaced the staged page"
grep -q live3 "$T/web/index.html" || fail "master was held back by a broken next"
[ "$(grep -c 'NOT published next' "$T/log")" = 1 ] || fail "the broken next was logged $(grep -c 'NOT published next' "$T/log") times"
# 4. next mended: published again
git checkout -q next; npage next2 > index.html; git commit -q -am n2; git push -q origin next
run
grep -q next2 "$T/web/next/index.html" || fail "the mended next was not published"
# 4b. a page on next without the staging namespace: refused once (it would share the live game's saves), then mended
page next3 > index.html; git commit -q -am n3; git push -q origin next
run; run
grep -q next2 "$T/web/next/index.html" || fail "a page without the staging namespace was published at /next/"
[ "$(grep -c 'lacks the staging namespace' "$T/log")" = 1 ] || fail "the page without the namespace was logged $(grep -c 'lacks the staging namespace' "$T/log") times"
npage next2 > index.html; git commit -q -am n4; git push -q origin next
run
# 5. a broken page on master: the live page stays, next is still served
git checkout -q master; printf '<script>const = ;</script>\n' > index.html; git commit -q -am bad; git push -q origin master
run
grep -q live3 "$T/web/index.html" || fail "a broken master replaced the live page"
grep -q next2 "$T/web/next/index.html" || fail "next was lost with a broken master"
page live4 > index.html; git commit -q -am four; git push -q origin master
run
grep -q live4 "$T/web/index.html" || fail "master did not recover"
# 6. the branch deleted: /next/ is removed
git push -q origin --delete next
run
[ ! -e "$T/web/next" ] || fail "/next/ stayed after the branch was deleted"
grep -q live4 "$T/web/index.html" || fail "the live page changed when next was deleted"
echo "PASS: update.sh publishes master as before and next at /next/ (7 cases)"
