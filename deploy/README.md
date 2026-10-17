# Deploying Highland Stand to highland.avunjian.com

The whole game is `index.html`. DNS for highland.avunjian.com points at 76.13.121.176.

**One-time setup** (after the server's read-only deploy key is added to the GitHub repo): run the one-line
command from the chat, which clones this repository to `/opt/highland-stand` and runs `deploy/setup-server.sh`.
That script serves the game over HTTPS with the web server already on the machine (or installs nginx) and adds
a cron job running `deploy/update.sh` every two minutes.

**Updates:** push to `master`. The server publishes the new `index.html` within two minutes.
Log: `/var/log/highland-update.log`.

Before it publishes, `update.sh` runs `node deploy/check-page.js index.html`, which makes sure every inline
script parses as the browser will parse it (you can run the same line locally before pushing). A page that fails
is not published: the page already live stays live, the log names the commit, the Node.js version and the line
that broke, and the next push is tried as usual. A commit that fails is logged once, not every two minutes, and
the clone on the server goes back to the commit that is live, so running `setup-server.sh` again publishes that
same page. If the check itself cannot run (node is killed, say, or `check-page.js` stops on an error of its own and
exits 2), nothing is published and the same commit is tried again two minutes later.

The check needs **Node.js 18 or newer** on the server (an older one does not know the syntax the page is written
in). `update.sh` takes the first such node it finds on the PATH or in the usual install folders
(`/usr/local/bin`, `/usr/bin`, `/opt/node*/bin`, root's nvm); if it finds none, it publishes without the check and
logs a warning. For a node somewhere else, link it as `/usr/local/bin/node`. (`HS_NODE=/path/to/node` before the
command in `/etc/cron.d/highland-update` works too, but a re-run of `setup-server.sh` rewrites that line and drops
it.)

`deploy.sh`, `nginx-highland.conf` and `Caddyfile` are the manual alternatives.

**Another name for the same game** (e.g. hyeland.avunjian.com): point the name's DNS A record at 76.13.121.176,
then on the server run `bash /opt/highland-stand/deploy/add-domain.sh hyeland.avunjian.com`.
