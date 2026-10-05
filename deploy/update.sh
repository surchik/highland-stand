#!/bin/bash
# Pull the newest commit and publish index.html if it changed. Run by cron every two minutes.
set -eu
REPO=/opt/highland-stand
WEB=/var/www/highland
cd "$REPO"
git fetch -q origin master
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)" ] && exit 0
git reset -q --hard origin/master
install -m 644 index.html "$WEB/index.html.new"
mv "$WEB/index.html.new" "$WEB/index.html"
echo "$(date -Is) published $(git rev-parse --short HEAD)"
