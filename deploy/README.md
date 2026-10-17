# Deploying Highland Stand to highland.avunjian.com

The whole game is `index.html`. DNS for highland.avunjian.com points at 76.13.121.176.

**One-time setup** (after the server's read-only deploy key is added to the GitHub repo): run the one-line
command from the chat, which clones this repository to `/opt/highland-stand` and runs `deploy/setup-server.sh`.
That script serves the game over HTTPS with the web server already on the machine (or installs nginx) and adds
a cron job running `deploy/update.sh` every two minutes.

**Updates:** push to `master`. The server publishes the new `index.html` within two minutes.
Log: `/var/log/highland-update.log`.

Before it publishes, `update.sh` runs `node deploy/check-page.js index.html`, which puts every inline script
through `node --check` (you can run the same line locally before pushing). A page that fails is not published:
the page already live stays live, the log names the commit and the line that broke, and the next push is tried
as usual. The check needs Node.js on the server. `update.sh` looks for it on the PATH and in the usual install
folders; if it finds none, it publishes without the check and logs a warning. Point it at a node elsewhere with
`HS_NODE=/path/to/node` before the command in `/etc/cron.d/highland-update`.

`deploy.sh`, `nginx-highland.conf` and `Caddyfile` are the manual alternatives.

**Another name for the same game** (e.g. hyeland.avunjian.com): point the name's DNS A record at 76.13.121.176,
then on the server run `bash /opt/highland-stand/deploy/add-domain.sh hyeland.avunjian.com`.
