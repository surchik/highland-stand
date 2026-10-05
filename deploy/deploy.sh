#!/bin/sh
# Copy the game to the VPS that serves highland.avunjian.com.
#   ./deploy/deploy.sh                 uses root@76.13.121.176 and /var/www/highland
#   ./deploy/deploy.sh me@host /srv/x  any login and folder
# The game is one static file; the server only has to hand out index.html.
set -e
HOST="${1:-root@76.13.121.176}"
DIR="${2:-/var/www/highland}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ssh "$HOST" "mkdir -p '$DIR'"
scp "$HERE/index.html" "$HOST:$DIR/index.html.new"
# swap in one step so a visitor never loads a half-copied file
ssh "$HOST" "mv '$DIR/index.html.new' '$DIR/index.html' && chmod 644 '$DIR/index.html'"
echo "Deployed. Check https://highland.avunjian.com"
