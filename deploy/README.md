# Deploying Highland Stand to highland.avunjian.com

The whole game is `index.html`. DNS for highland.avunjian.com points at 76.13.121.176.

**One-time setup** (after the server's read-only deploy key is added to the GitHub repo): run the one-line
command from the chat, which clones this repository to `/opt/highland-stand` and runs `deploy/setup-server.sh`.
That script serves the game over HTTPS with the web server already on the machine (or installs nginx) and adds
a cron job running `deploy/update.sh` every two minutes.

**Updates:** push to `master`. The server publishes the new `index.html` within two minutes, with `og.jpg`
beside it when the repository has one. Log: `/var/log/highland-update.log`. The picture is checked on every run
and copied whenever the web root lacks it or holds another version, so a commit that first brings it (or changes
how it is published) gets it out on the run after the one that pulls it: that first run is still the old script.

**The share preview:** the page's `og:` and `twitter:` tags name `https://highland.avunjian.com/og.jpg`, a
1200 x 630 JPEG kept at the repository's root, under 200 KB so messengers that skip large pictures still show it.
To take it again from the game itself:
`NODE_PATH=$(npm root -g) node tools/shot.js "shot=battle&lv=ani&wave=15&zoom=1.7&cx=640&cy=300&nohud&title" og.jpg 1200 630`
(`lv` takes the battlefield's id, so a battlefield inserted before it moves nothing; `nohud` leaves out the header,
the tray and the spell bar; `title` sets the game's name over the field; a `.jpg` file is written at quality 88).

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
