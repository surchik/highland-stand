#!/bin/bash
# Pull the newest commit and publish index.html (and og.png, its share picture) if it changed. Run by cron every
# two minutes.
# Before publishing, deploy/check-page.js makes sure every inline script of the page parses. A page that
# fails is not published: the failure goes to the log once, the clone goes back to the commit that is live
# (so a re-run of setup-server.sh publishes that same page), and the next push is tried as usual. When the
# check itself cannot run (check-page.js exits 2 on an error of its own, or node is killed), nothing is
# published and the same commit is tried again on the next run. (HS_REPO, HS_WEB and HS_NODE override the
# paths, to try this on a copy.) The body is one block, read whole before it runs, because the resets below
# rewrite this very file.
{
set -eu
REPO=${HS_REPO:-/opt/highland-stand}
WEB=${HS_WEB:-/var/www/highland}
cd "$REPO"
git fetch -q origin master
NEW=$(git rev-parse origin/master)
[ "$(git rev-parse HEAD)" = "$NEW" ] && exit 0
# a commit already turned away is not checked and logged again every two minutes
[ "$(cat .git/hs-rejected 2>/dev/null || true)" = "$NEW" ] && exit 0
PREV=$(git rev-parse HEAD)
git reset -q --hard origin/master
REV=$(git rev-parse --short HEAD)

# cron's PATH is short: look for node where installers usually put it too, and take the first one new
# enough to know the syntax the page is written in (Node.js 18 or later)
node_ok() { [ -n "$1" ] && [ -x "$1" ] && "$1" -e 'process.exit(parseInt(process.versions.node, 10) >= 18 ? 0 : 1)' 2>/dev/null; }
NODE=${HS_NODE:-}
if [ -z "$NODE" ]; then
  for n in "$(command -v node || true)" "$(command -v nodejs || true)" /usr/local/bin/node /usr/bin/node /usr/bin/nodejs /opt/node*/bin/node /root/.nvm/versions/node/*/bin/node; do
    if node_ok "$n"; then NODE=$n; break; fi
  done
fi

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
    exit 1
  fi
else
  echo "$(date -Is) warning: no Node.js 18 or newer found${NODE:+ ($NODE: $("$NODE" -v 2>/dev/null || echo "does not run"))}, so $REV goes out without its syntax check (see deploy/README.md)"
  VER=""
fi
# the share picture (og.png, which the page's og:image names) goes out with the page, a moment before it, when the
# repository has one
if [ -f og.png ]; then
  install -m 644 og.png "$WEB/og.png.new"
  mv "$WEB/og.png.new" "$WEB/og.png"
fi
install -m 644 index.html "$WEB/index.html.new"
mv "$WEB/index.html.new" "$WEB/index.html"
rm -f .git/hs-rejected
echo "$(date -Is) published $REV${VER:+ (checked with node $VER)}"
exit 0
}
