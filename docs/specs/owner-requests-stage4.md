# Stage 4 additions requested by the owner (Nov 12)

P10 Superadmin "Players" view (platform track, first in stage 4, after P3 and P4 are merged):
- Owner asked: "create a superadmin with login of <the owner's address, given in chat; keep it out of the repo> to see everything happening with the game, all the users and how far they have played it, how much time they are spending etc".
- Role: superadmin (above admin). Granted only by an owner command run through the SSH tunnel as postgres,
  e.g. select highland.hs_grant_superadmin_by_email('<address>'); never callable through the API, never
  hard-coded in the repo (the email stays out of git).
- The account must sign in with Google, Facebook or Discord under that address (RULINGS S9 game sessions).
- View inside ?stats (new tab "Players"), superadmin only: every game player (rows with hs_profiles only,
  never other apps' auth.users): game name, provider, first seen, last seen, visits, total play time (battle
  clock and time on page from sessions/events), battlefields won per difficulty, stars, furthest battlefield,
  hero levels, Council tiers, devices, daily streak later; sortable, searchable, paged; a player's detail page
  with their battle history (runs) and recent visits. Email shown only if the owner says yes (default: hidden,
  shown as provider + game name). Every superadmin read logged in a highland audit table.
- Server: new migration with rollback; isolation tests: player, outsider, anon, admin (not super) all refused.
- Privacy page (P8) must say the owner can see each player's progress and play time.
