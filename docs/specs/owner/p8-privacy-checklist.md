# The privacy page and "Delete my account": your checklist

This is for you, the owner. The game now has its full privacy page (`?privacy`) and a **Delete my account**
button on the Hall's Account tab. Two things are yours alone: the few places on the privacy page that only you
can fill, and answering a person who writes to you about their data. This page lists both, and a short check
of the deletion on the staging address.

This page is not legal advice. Have the privacy page read by someone who knows your country's law before the
sign-in is switched on for everyone.

---

## 1. Fill the privacy page's places (before step 4c of the setup guide)

The page is plain text in `index.html`, inside `<div id="privacyPage">`. Each place to fill is a `<span>` with
the class `pvFill` and a `data-fill` name. The game shows them with a dashed outline, so a place left unfilled
is easy to see on `?privacy`. To list them:

```
grep -n 'class="pvFill"' index.html
```

| `data-fill` | what it says now | what to put there |
| --- | --- | --- |
| `name` | [owner's name] | your name, or the name you publish the game under |
| `email` | [contact email] | the address people write to about their data. It is shown as text; if you want it to be a link, replace the span with `<a href="mailto:you@example.com">you@example.com</a>` |
| `days` (twice) | [number] | how many days your web server keeps its access logs (see below) |
| `country` | [country] | the country your server stands in |
| `date` | [date] | the day you publish the filled page, for example "December 1, 2026". Change it whenever the page changes |

When a place is filled, take its span away and keep only the words, for example
`made by <span class="pvFill" data-fill="name">[owner's name]</span>` becomes `made by Your Name`. Then
`grep -c 'pvFill' index.html` counts what is left; the style rule for `.pvFill` may stay.

**How many days your web server keeps its logs.** On Ubuntu, nginx's logs are turned over by logrotate:

```
ssh server 'grep -E "daily|weekly|rotate" /etc/logrotate.d/nginx'
```

`daily` with `rotate 14` means 14 days; `weekly` with `rotate 52` means about a year. Also look at the Supabase
containers: Docker keeps each container's log (Kong's lines carry IP addresses) until the container is made
again, unless the log has a size limit. If you want the page's number to hold for those too, give the
containers a limit (`"log-opts": {"max-size": "10m", "max-file": "3"}` in `/etc/docker/daemon.json`, then
recreate them) or write the larger number.

**Where the page is.** The live game shows it at `https://highland.avunjian.com/?privacy` once `master` has
this build. Until then it is at `https://highland.avunjian.com/next/?privacy`. The page works with the platform
off too (it needs no server), so the providers' consoles can be given the live address as soon as `master` has it.

- [ ] Every `pvFill` place filled, and `grep -c 'pvFill' index.html` shows only the style rule's lines.
- [ ] The page read by someone who knows your country's law.
- [ ] `?privacy` and `?privacy#delete` open on a computer and on your iPhone, held both ways. `#delete` opens at
      "How to delete your data".

## 2. The providers' consoles

The addresses each provider asks for (the setup guide's step 4c and the spec's section 8.2):

| | Google | Facebook | Discord |
| --- | --- | --- | --- |
| privacy policy | `https://highland.avunjian.com/?privacy` | `https://highland.avunjian.com/?privacy` (Basic settings, Privacy Policy URL) | optional: `https://highland.avunjian.com/?privacy` |
| deletion | (none asked) | User data deletion: **Data deletion instructions URL** `https://highland.avunjian.com/?privacy#delete` | (none asked) |

- [ ] Google: privacy link and home page filled on the OAuth consent screen; the app published ("In production").
- [ ] Facebook: Privacy Policy URL and the data deletion instructions URL filled; the app switched to Live.
- [ ] Discord: nothing required.

## 3. When someone writes to you about their data

The privacy page promises three things. Here is how to keep each one.

**"Delete my data, I cannot sign in any more."** Their game data can be removed without them. Find the account
by the address they wrote from, then remove its game data exactly as the button does. Run it in `psql` through
the SSH tunnel of the setup guide (step 1), as `postgres`, after a backup (step 2). **[tried]** on the local
stack by `node tools/platform/owner-delete-check.js`:

```
\set email 'the.person@example.com'
begin;
select id, email, created_at from auth.users where lower(email) = lower(:'email');
-- check that exactly one row came back and it is the person who wrote, then:
select set_config('hs.del', (select id::text from auth.users where lower(email) = lower(:'email')), true);
delete from highland.hs_sessions where uid is null and aid in (select aid from highland.hs_sessions where uid = current_setting('hs.del')::uuid);
delete from highland.hs_rate where key in (select aid::text from highland.hs_sessions where uid = current_setting('hs.del')::uuid);
delete from highland.hs_sessions where uid = current_setting('hs.del')::uuid;
delete from highland.hs_rate where key = current_setting('hs.del');
delete from highland.hs_score_best where user_id = current_setting('hs.del')::uuid;
delete from highland.hs_scores where user_id = current_setting('hs.del')::uuid;
delete from highland.hs_runs where user_id = current_setting('hs.del')::uuid;
delete from highland.hs_saves where user_id = current_setting('hs.del')::uuid;
delete from highland.hs_admins where user_id = current_setting('hs.del')::uuid;
update highland.hs_rulesets set published_by = null where published_by = current_setting('hs.del')::uuid;
delete from highland.hs_profiles where user_id = current_setting('hs.del')::uuid;
commit;
```

If the first `select` finds no row or more than one, type `rollback;` and stop. A person may have signed in with
two providers that gave two addresses: ask which.

**"Remove my sign-in too."** The sign-in account belongs to the shared sign-in service, which your other apps
(PathStream, ReqStream) use as well. The game never removes it by itself. Removing it signs the person out of
every app on the server and removes what those apps keep for that account where their tables say so. Only you
can judge that. If you do remove it, do it in Supabase Studio (Authentication, Users, the person, Delete user),
or in `psql` with `delete from auth.users where id = '...';`. The game's rows of that account go with it on their
own (their foreign keys cascade), so the game needs nothing more.

**"A child under 13 has an account."** Remove the game data as in the first case. Say in your answer that it
is done.

Answer each from the address on the privacy page, and keep a note of the day you did it.

## 4. Try the deletion on the staging address

On `https://highland.avunjian.com/next/`, with an account you made for trying (not your admin account, unless
you want its admin row gone too):

1. Sign in, play the first battle, wait until the Account tab says "Saved to your account just now."
2. Press **Delete my account**.
   **You see** "Delete your account? Your player name, your progress, your scores and the counts of your play
   are removed from our server and from this device. This cannot be undone.", a line about the sign-in staying
   with the sign-in service, **Keep my account** (it has the focus) and **Delete everything**.
3. Press **Keep my account**: the tab comes back as it was.
4. Press **Delete my account**, then **Delete everything**.
   **You see** the sign-in card, with "Your account is deleted. Its name, progress and scores are gone from our
   server and from this device." The map behind it is a new player's.
5. In `psql`: `select count(*) from highland.hs_profiles where user_id = '<that id>';` gives 0, and
   `select count(*) from auth.users where id = '<that id>';` still gives 1.
6. Sign in again with the same provider: the game asks for a name, as for a new player.

- [ ] Steps 1 to 6 as written, on the computer.
- [ ] Steps 2 to 4 on the iPhone held sideways (the buttons fit and answer a finger).

## 5. What changed on the server

Migration `005_delete_game_session` (apply it with `node tools/platform/migrate.js up`, as in step 3 of the
guide; `status` then says `highland at 5 of 5`). "Delete my account" now asks for a session begun with Google,
Facebook or Discord: the same account signed in by password through the shared email sign-in can no longer
delete a player's data. It also removes the rate counters of the devices whose visits it removes. Its rollback
(`migrate.js down 4 --yes`) puts back the version before.
