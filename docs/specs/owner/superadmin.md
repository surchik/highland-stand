# The superadmin and the Players view: the owner's page

You asked (November 12) for a superadmin account that sees "everything happening with the game, all the users and
how far they have played it, how much time they are spending", and said yes (November 16) to showing each
player's email and name there. This page says how to switch it on, what it shows, and what it never does.

Your address is never written in the game's files. You type it once, on your server, in the command below.

## 1. Before the command

1. Migration 006 is on your server: `node tools/platform/migrate.js status --dsn="$HS_DB_URL"` says
   `highland at 6 of 6` (`docs/specs/owner/shared-supabase-plan.md`, section 2).
2. Sign in to the game (`https://highland.avunjian.com/next/` first) with Google, Facebook or Discord **under the
   address you will make superadmin**, and choose a player name. The command refuses an account that never signed
   in with one of the three (an account made by another app's email sign-up cannot become superadmin).

## 2. The command

Through the SSH tunnel, as `postgres` (the password only in `PGPASSWORD`, as for the migrations), with `psql`'s
history file turned off, so that the address you type is not kept in `~/.psql_history`:

```
PSQL_HISTORY=/dev/null psql "$HS_DB_URL" -X
```

then, in it, type your address when it asks for it:

```sql
\prompt 'Your address: ' addr
select highland.hs_grant_superadmin_by_email(:'addr');
```

That is the command `select highland.hs_grant_superadmin_by_email('THE_ADDRESS');` with your address in place of
`THE_ADDRESS`; the prompt only keeps the address out of anything written down. Do not put the address in a file,
a script or a shell command (the shell keeps its own history). If `show log_statement;` says `all`, the server's
log keeps every statement, the address too: run `set log_statement = 'none';` in the same `psql` first, and if it
is refused, ask the server's builder.

It answers `superadmin: account <the account's id> (game name ...). Open ?stats and choose Players.` It names the
account by its id, never by its address. It also makes that account an admin (the stats page's other cards), if it
was not one already. Running it twice changes nothing.

What it can answer instead:

| answer | what it means |
| --- | --- |
| `no_account` | No account has that address yet: sign in to the game with it first, then run it again. |
| `not_game_account` | The account never signed in with Google, Facebook or Discord. |
| `two_accounts` | Two accounts share that address (it should not happen). Ask the game's builder. |
| `email_invalid` | What was typed is not an address. |
| `owner_only` | It was run through the API, not on the database itself. |

**To take it away:**

```sql
\prompt 'Your address: ' addr
select highland.hs_revoke_superadmin_by_email(:'addr');
```

It removes the superadmin and the admin row the grant gave with it (an admin row you made yourself stays).

Nobody can run either command through the game's API: not a visitor, not a player, not an admin, and not the
service key. Only `postgres`, on the database, through your tunnel.

## 3. What you see

Open `https://highland.avunjian.com/?stats` (or `/next/?stats`) signed in with that account. The page has two tabs,
**Numbers** (the stats page you know) and **Players**.

**Players** lists every player of the game (an account that chose a player name), 25 to a page, and never another
app's accounts on the shared server. Each column can be sorted by pressing its name; the search finds a player by
game name, by the name his provider gives, or by email (case does not matter). **Live game** and **Staging** switch
between the visits and saves of `/` and of `/next/`.

| column | where it comes from |
| --- | --- |
| Name | the player name, and under it the name Google, Facebook or Discord gives |
| Email | the address the provider gave (only on this page) |
| Sign-in | the providers the account used |
| First seen | the day he chose his name, or his first signed-in visit if that came first |
| Last seen | the last event of his latest signed-in visit, or his last save |
| Visits | page loads while signed in |
| Time on page | for each visit, the time the page was in view, as the page told it when it was hidden or closed (a build before this one told the time since it loaded, hidden time included); else the time between the visit's first and last event; at most 12 hours a visit |
| Battle clock | the battle clock of every battle he won or lost while signed in, from the battles' events (a battle left unfinished adds nothing) |
| Won E / N / H, Stars, Furthest, Heroes, Council | from his save: the page adds a summary of his progress to each save it sends. A battlefield won before the game kept stars for each difficulty counts on no difficulty; when there are such, the column adds how many battlefields are held in all |
| Devices | how many browsers he signed in from, and their kinds |

Pressing a name opens **his page**: who he is, his play time, his progress, his last 50 battles (won, lost or left),
his ranked runs (once the leaderboards are on), his last 30 visits and his devices.

A player whose last save came from a build before this one shows dashes for his progress until he plays again.
Counts of visits and battles go back as far as the events are kept (180 days by default).

## 4. What is written down, and what never is

- Every time the list or a player's page is opened, one row is written in `highland.hs_super_audit`: who opened it,
  when, which player, and the list's sort, page and channel. A search's words are never kept, only that a search
  was made. The grant and the revoke are written there too. To read it, through the tunnel:
  `select at, what, player, args from highland.hs_super_audit order by id desc limit 50;`
- The emails and names appear only on this page. They are not written to your browser's storage, to any log, to
  the game's events, or into any other function's answer (the admin's stats included).
- When a player deletes his account, his rows go as before; the audit's rows about him stay but no longer name him.
- The privacy page says, in plain sentences, that the game's owner can see each player's email, name, progress and
  play time.
