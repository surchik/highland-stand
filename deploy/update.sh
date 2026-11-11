#!/bin/bash
# Pull the newest commit and publish index.html (and og.jpg, its share picture) if it changed. Run by cron every
# two minutes.
# Before publishing, deploy/check-page.js makes sure every inline script of the page parses. A page that
# fails is not published: the failure goes to the log once, the clone goes back to the commit that is live
# (so a re-run of setup-server.sh publishes that same page), and the next push is tried as usual. When the
# check itself cannot run (check-page.js exits 2 on an error of its own, or node is killed), nothing is
# published and the same commit is tried again on the next run. (HS_REPO, HS_WEB and HS_NODE override the
# paths, to try this on a copy.) The body is one block, read whole before it runs, because the resets below
# rewrite this very file. So the run that pulls a new version of this file is still the old version: the new
# one runs from the next run on.
#
# The staging channel (docs/specs/platform.final.md 9.3): when the repository has a branch named "next", its
# index.html (and og.jpg) goes out at <web root>/next/ the same way, after the same check, without touching the
# clone's checkout (the files are read straight from the branch with git show; the clone stays on master). A
# page on next that fails its check is not published and is logged once; /next/ keeps what it had. A page on
# next that lacks the staging namespace line (const HS_CHANNEL = ) is refused the same way: it shares the live
# game's origin, and without that line it would read and write the live game's saves. When the branch is
# deleted, /next/ is removed. Only a branch named exactly next counts (not feature/next), and a folder named next
# in the web root that this script did not make is never written into or removed. The live page never depends on the staging channel: the two flows run apart, and
# the script exits with the live flow's status, so what it publishes and reports for master is what it always
# did.
{
set -eu
REPO=${HS_REPO:-/opt/highland-stand}
WEB=${HS_WEB:-/var/www/highland}
cd "$REPO"
# cron's PATH is short: look for node where installers usually put it too, and take the first one new
# enough to know the syntax the page is written in (Node.js 18 or later)
node_ok() { [ -n "$1" ] && [ -x "$1" ] && "$1" -e 'process.exit(parseInt(process.versions.node, 10) >= 18 ? 0 : 1)' 2>/dev/null; }
NODE=${HS_NODE:-}
if [ -z "$NODE" ]; then
  for n in "$(command -v node || true)" "$(command -v nodejs || true)" /usr/local/bin/node /usr/bin/node /usr/bin/nodejs /opt/node*/bin/node /root/.nvm/versions/node/*/bin/node; do
    if node_ok "$n"; then NODE=$n; break; fi
  done
fi

# the share picture (og.jpg, which the page's og:image names) goes out beside the page whenever the clone has one
# the web root lacks or holds in another version. It is checked on every run, not only with a new commit: the run
# that pulls a commit is still the update.sh from before it (the block is read whole first), so a picture that
# older script did not know goes out on the run after
publish_og() {
  if [ -f og.jpg ] && ! cmp -s og.jpg "$WEB/og.jpg"; then
    install -m 644 og.jpg "$WEB/og.jpg.new"
    mv "$WEB/og.jpg.new" "$WEB/og.jpg"
    echo "$(date -Is) published og.jpg"
  fi
}

# the live game: exactly the steps this script always took
publish_master() {
git fetch -q origin master
NEW=$(git rev-parse origin/master)
if [ "$(git rev-parse HEAD)" = "$NEW" ]; then publish_og; return 0; fi
# a commit already turned away is not checked and logged again every two minutes (the clone is back on the live one)
if [ "$(cat .git/hs-rejected 2>/dev/null || true)" = "$NEW" ]; then publish_og; return 0; fi
PREV=$(git rev-parse HEAD)
git reset -q --hard origin/master
REV=$(git rev-parse --short HEAD)

if node_ok "$NODE"; then
  VER=$("$NODE" -v)
  st=0
  report=$("$NODE" deploy/check-page.js index.html 2>&1) || st=$?
  if [ "$st" -ne 0 ]; then
    git reset -q --hard "$PREV"
    if [ "$st" -eq 1 ]; then
      echo "$NEW" > .git/hs-rejected
      echo "$(date -Is) NOT published $REV: the page failed its check (node $VER); the page already live stays live"
    else
      echo "$(date -Is) NOT published $REV: the check could not run (node $VER, exit $st); the page already live stays live, and $REV is tried again next run"
    fi
    if [ -n "$report" ]; then printf '%s\n' "$report" | sed 's/^/    /'; fi
    return 1
  fi
else
  echo "$(date -Is) warning: no Node.js 18 or newer found${NODE:+ ($NODE: $("$NODE" -v 2>/dev/null || echo "does not run"))}, so $REV goes out without its syntax check (see deploy/README.md)"
  VER=""
fi
# the share picture goes out with the page, a moment before it
publish_og
install -m 644 index.html "$WEB/index.html.new"
mv "$WEB/index.html.new" "$WEB/index.html"
rm -f .git/hs-rejected
echo "$(date -Is) published $REV${VER:+ (checked with node $VER)}"
return 0
}

# the staging channel (see the header). .git/hs-next-live holds the commit published at /next/, and
# .git/hs-next-rejected the last one turned away, so neither is checked or logged again every two minutes.
# .git/hs-next-dir says this script made the folder <web root>/next: a folder of that name it did not make (the
# owner's own) is never written into or removed, and that is logged once (.git/hs-next-foreign).
# .git/hs-next-nonode holds the commit last held back for want of Node.js, so that is logged once too.
NEXT_TMP=""
publish_next() {
  local heads rev short st report
  # the folder is removed by the subshell's end whatever stops it (an error under set -e included)
  trap '[ -z "$NEXT_TMP" ] || rm -rf "$NEXT_TMP"' EXIT
  # a folder or file at <web root>/next that this script did not make is the owner's: leave it alone
  if [ -e "$WEB/next" ] && [ ! -f .git/hs-next-dir ]; then
    if [ ! -f .git/hs-next-foreign ]; then
      : > .git/hs-next-foreign
      echo "$(date -Is) staging is off: $WEB/next was not made by this script, so it is left as it is (move it away to turn staging on)"
    fi
    return 0
  fi
  rm -f .git/hs-next-foreign
  # the branch named exactly next as the remote has it (a pattern alone would also match feature/next); a remote
  # that does not answer leaves /next/ as it is
  heads=$(git ls-remote origin refs/heads/next 2>/dev/null) || return 0
  heads=$(printf '%s\n' "$heads" | awk '$2 == "refs/heads/next" { print $1; exit }')
  if [ -z "$heads" ]; then
    if [ -f .git/hs-next-dir ]; then
      rm -rf "$WEB/next"
      rm -f .git/hs-next-dir
      echo "$(date -Is) removed /next/: the branch next is gone"
    fi
    rm -f .git/hs-next-live .git/hs-next-rejected .git/hs-next-nonode
    return 0
  fi
  rev=$heads
  if [ "$(cat .git/hs-next-live 2>/dev/null || true)" = "$rev" ] && [ -f "$WEB/next/index.html" ]; then return 0; fi
  if [ "$(cat .git/hs-next-rejected 2>/dev/null || true)" = "$rev" ]; then return 0; fi
  if ! node_ok "$NODE"; then
    # unlike master, an unchecked page never goes out at /next/: nobody is waiting for it. Said once per commit
    if [ "$(cat .git/hs-next-nonode 2>/dev/null || true)" != "$rev" ]; then
      echo "$rev" > .git/hs-next-nonode
      echo "$(date -Is) NOT published next $(printf '%.7s' "$rev"): no Node.js 18 or newer found to check it; tried again each run"
    fi
    return 0
  fi
  rm -f .git/hs-next-nonode
  git fetch -q origin refs/heads/next 2>/dev/null || return 0
  short=$(git rev-parse --short "$rev" 2>/dev/null) || return 0
  NEXT_TMP=$(mktemp -d) || return 0
  if ! git show "$rev:index.html" > "$NEXT_TMP/index.html" 2>/dev/null; then
    echo "$rev" > .git/hs-next-rejected
    echo "$(date -Is) NOT published next $short: the branch has no index.html; /next/ stays as it was"
    return 0
  fi
  st=0
  report=$("$NODE" deploy/check-page.js "$NEXT_TMP/index.html" 2>&1) || st=$?
  if [ "$st" -ne 0 ]; then
    if [ "$st" -eq 1 ]; then
      echo "$rev" > .git/hs-next-rejected
      echo "$(date -Is) NOT published next $short: the page failed its check; /next/ stays as it was"
    else
      echo "$(date -Is) NOT published next $short: the check could not run (exit $st); /next/ stays as it was, and $short is tried again next run"
    fi
    if [ -n "$report" ]; then printf '%s\n' "$report" | sed 's/^/    /'; fi
    return 0
  fi
  # the page on /next/ shares its origin with the live game: one without the staging namespace (PF-0's
  # "const HS_CHANNEL = " line) would read and write the live game's saves and sign-in, so it never goes out
  if ! grep -q 'const HS_CHANNEL = ' "$NEXT_TMP/index.html"; then
    echo "$rev" > .git/hs-next-rejected
    echo "$(date -Is) NOT published next $short: the page lacks the staging namespace (const HS_CHANNEL); /next/ stays as it was"
    return 0
  fi
  if [ ! -d "$WEB/next" ]; then mkdir "$WEB/next"; fi
  : > .git/hs-next-dir
  # its share picture first, as for the live page; a branch without one leaves none behind
  if git show "$rev:og.jpg" > "$NEXT_TMP/og.jpg" 2>/dev/null; then
    if ! cmp -s "$NEXT_TMP/og.jpg" "$WEB/next/og.jpg"; then
      install -m 644 "$NEXT_TMP/og.jpg" "$WEB/next/og.jpg.new"
      mv "$WEB/next/og.jpg.new" "$WEB/next/og.jpg"
    fi
  else
    rm -f "$WEB/next/og.jpg"
  fi
  install -m 644 "$NEXT_TMP/index.html" "$WEB/next/index.html.new"
  mv "$WEB/next/index.html.new" "$WEB/next/index.html"
  echo "$rev" > .git/hs-next-live
  rm -f .git/hs-next-rejected
  echo "$(date -Is) published next $short at /next/"
}

# each flow runs in a subshell of its own with set -e, so an error stops that flow at once (as it always stopped
# this script) and the staging channel can never change what the live flow does or reports; the script exits
# with the live flow's status
set +e
( set -e; publish_master ); rc=$?
( set -e; publish_next )
exit "$rc"
}
