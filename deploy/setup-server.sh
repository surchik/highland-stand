#!/bin/bash
# One-time server setup for highland.avunjian.com. Run as root on the VPS from the clone in /opt/highland-stand.
# It serves the game over HTTPS with whichever web server is already there (Caddy, nginx or Apache; nginx is
# installed if there is none), and installs a two-minute job that pulls new commits and publishes index.html.
# Safe to run again. Other sites on the server are left alone: only a site for this one domain is added.
set -euo pipefail
DOMAIN=highland.avunjian.com
REPO=/opt/highland-stand
WEB=/var/www/highland
say() { printf '\n== %s\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
[ -d "$REPO/.git" ] || { echo "no clone at $REPO"; exit 1; }

say "Publishing the game to $WEB"
# only index.html is public; the repository itself (.git, tools, docs) stays out of the web root
mkdir -p "$WEB"
install -m 644 "$REPO/index.html" "$WEB/index.html"

say "Auto-update every two minutes"
chmod +x "$REPO/deploy/update.sh"
echo "*/2 * * * * root $REPO/deploy/update.sh >> /var/log/highland-update.log 2>&1" > /etc/cron.d/highland-update
chmod 644 /etc/cron.d/highland-update

active() { systemctl is-active --quiet "$1" 2>/dev/null; }
have() { command -v "$1" >/dev/null 2>&1; }

if active caddy; then
  say "Caddy is running: adding a site block (Caddy fetches the HTTPS certificate itself)"
  CF=/etc/caddy/Caddyfile
  if ! grep -q "^$DOMAIN" "$CF" 2>/dev/null; then
    printf '\n%s {\n    root * %s\n    encode gzip\n    header Cache-Control "no-cache"\n    file_server\n}\n' "$DOMAIN" "$WEB" >> "$CF"
  fi
  caddy validate --config "$CF" --adapter caddyfile
  systemctl reload caddy
elif active apache2 || active httpd; then
  say "Apache is running: adding a virtual host"
  have certbot || { apt-get update -qq; apt-get install -y -qq certbot python3-certbot-apache; }
  cat > /etc/apache2/sites-available/highland.conf <<CONF
<VirtualHost *:80>
    ServerName $DOMAIN
    DocumentRoot $WEB
    <Directory $WEB>
        Require all granted
        Options -Indexes
    </Directory>
    Header set Cache-Control "no-cache"
</VirtualHost>
CONF
  a2enmod headers >/dev/null
  a2ensite highland >/dev/null
  apache2ctl configtest
  systemctl reload apache2
  certbot --apache -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
else
  if ! have nginx; then
    # something else holding port 80 (Docker, Traefik, another proxy) needs a human decision
    if ss -ltnp 2>/dev/null | grep -q ':80 '; then
      echo "Port 80 is held by something that is not nginx, Caddy or Apache:"; ss -ltnp | grep ':80 '; exit 2
    fi
    say "No web server found: installing nginx and certbot"
    apt-get update -qq
    apt-get install -y -qq nginx
  fi
  have certbot && certbot plugins 2>/dev/null | grep -q nginx || { apt-get update -qq; apt-get install -y -qq certbot python3-certbot-nginx; }
  say "nginx: adding a site for $DOMAIN"
  cat > /etc/nginx/sites-available/highland <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    root $WEB;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
    gzip on;
    gzip_types text/html;
}
CONF
  ln -sf /etc/nginx/sites-available/highland /etc/nginx/sites-enabled/highland
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
  say "HTTPS certificate"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

if have ufw && ufw status | grep -q "Status: active"; then
  say "Firewall: opening 80 and 443"
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

say "Done: https://$DOMAIN"
curl -sS -o /dev/null -w "HTTPS status %{http_code}\n" "https://$DOMAIN" || true
