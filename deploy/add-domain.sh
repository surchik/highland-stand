#!/bin/bash
# Serve the game under another name as well: bash /opt/highland-stand/deploy/add-domain.sh hyelands.avunjian.com
# The name's DNS A record must already point at this server, so Caddy can fetch its HTTPS certificate.
# The new name joins highland.avunjian.com's site block in the Caddyfile; the other sites there are untouched.
set -euo pipefail
NEW="${1:?usage: add-domain.sh new.domain.name}"
CF=/etc/caddy/Caddyfile
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
systemctl is-active --quiet caddy || { echo "Caddy is not running; this script only knows the Caddy setup"; exit 1; }
if grep -qE "(^|[ ,])$(printf %s "$NEW" | sed 's/\./\\./g')([ ,{]|$)" "$CF"; then
  echo "$NEW is already in $CF"
else
  cp "$CF" "$CF.bak.$(date +%s)"
  # "highland.avunjian.com {"  ->  "highland.avunjian.com, hyelands.avunjian.com {"
  sed -i -E "s/^(highland\.avunjian\.com([^{]*[^ {])?)[[:space:]]*\{/\1, $NEW {/" "$CF"
  grep -q "$NEW" "$CF" || { echo "could not find the highland.avunjian.com block in $CF"; exit 1; }
  caddy validate --config "$CF" --adapter caddyfile
  systemctl reload caddy
fi
echo "DNS: $(getent hosts "$NEW" || echo 'no A record yet')"
echo "Waiting for the certificate..."
for i in $(seq 1 12); do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "https://$NEW" 2>/dev/null || true)
  [ "$code" = 200 ] && { echo "https://$NEW is live (200)"; exit 0; }
  sleep 5
done
echo "Not answering yet (last status: ${code:-none}). Check: journalctl -u caddy --since '5 min ago' | grep -i $NEW"
