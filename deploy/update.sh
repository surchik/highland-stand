#!/bin/bash
# Pull the newest commit and publish index.html if it changed. Run by cron every two minutes.
# Before publishing, deploy/check-page.js runs `node --check` on the page's inline scripts. A page that
# fails is not published: the failure goes to the log, the page already live stays live, and the next
# push is tried as usual. (HS_REPO, HS_WEB and HS_NODE override the paths, to try this on a copy.)
# The body is one block, read whole before it runs, because the reset below rewrites this very file.
{
set -eu
REPO=${HS_REPO:-/opt/highland-stand}
WEB=${HS_WEB:-/var/www/highland}
cd "$REPO"
git fetch -q origin master
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)" ] && exit 0
git reset -q --hard origin/master
REV=$(git rev-parse --short HEAD)

# cron's PATH is short: look for node where installers usually put it too
NODE=${HS_NODE:-}
if [ -z "$NODE" ]; then
  NODE=$(command -v node || command -v nodejs || true)
  for n in /usr/local/bin/node /usr/bin/node /usr/bin/nodejs /opt/node*/bin/node /root/.nvm/versions/node/*/bin/node; do
    [ -n "$NODE" ] && break
    [ -x "$n" ] && NODE=$n
  done
fi

if [ -n "$NODE" ] && [ -x "$NODE" ]; then
  if ! report=$("$NODE" deploy/check-page.js index.html 2>&1); then
    echo "$(date -Is) NOT published $REV: the page failed its check; the page already live stays live"
    printf '%s\n' "$report" | sed 's/^/    /'
    exit 1
  fi
else
  echo "$(date -Is) warning: node not found, so $REV goes out without its syntax check (set HS_NODE in the cron line)"
fi
install -m 644 index.html "$WEB/index.html.new"
mv "$WEB/index.html.new" "$WEB/index.html"
echo "$(date -Is) published $REV"
exit 0
}
