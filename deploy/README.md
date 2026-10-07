# Deploying Highland Stand to highland.avunjian.com

The whole game is `index.html`. DNS for highland.avunjian.com points at 76.13.121.176.

**One-time setup** (after the server's read-only deploy key is added to the GitHub repo): run the one-line
command from the chat, which clones this repository to `/opt/highland-stand` and runs `deploy/setup-server.sh`.
That script serves the game over HTTPS with the web server already on the machine (or installs nginx) and adds
a cron job running `deploy/update.sh` every two minutes.

**Updates:** push to `master`. The server publishes the new `index.html` within two minutes.
Log: `/var/log/highland-update.log`.

`deploy.sh`, `nginx-highland.conf` and `Caddyfile` are the manual alternatives.

**Another name for the same game** (e.g. hyelands.avunjian.com): point the name's DNS A record at 76.13.121.176,
then on the server run `bash /opt/highland-stand/deploy/add-domain.sh hyelands.avunjian.com`.
