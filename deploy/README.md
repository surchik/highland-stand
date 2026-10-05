# Deploying Highland Stand to highland.avunjian.com

The whole game is `index.html`. The DNS record for highland.avunjian.com already points at 76.13.121.176.

1. **Web server, once.** Use `nginx-highland.conf` (then run certbot for HTTPS) or the `Caddyfile` block.
2. **Every update.** From the repository folder run `./deploy/deploy.sh` (or `./deploy/deploy.sh user@76.13.121.176 /var/www/highland` for another login or folder).
