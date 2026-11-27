# Independent reviews of the explainer videos, group B

The films of Van, Musa Dagh, Sardarapat, Stepanakert (1991 to 1992), Shushi and Stepanakert (2022 to 2023), made the way the first four were (reviews.md). The goal set for this group: every cut scores 8 or more in every category (history, pacing, picture, sound, subtitles) from two fresh, independent reviewers.

How a round works is as in reviews.md: tools/explainer/review.sh makes each cut's review pack and asks two fresh `claude -p` sessions, given only tools/explainer/review-brief.md, the pack and read access to the repository, to score it. The defects below are theirs, shortened.

What this group adds to the tools, without changing what the first four use: its scripts, sources and pictures sit in files of their own (scripts-b.json, sources-b.json, films-b.js), which tts.py, measure.py, gen-docs.py and films.js add to their own; build.py has each battlefield's music bed (the battlefield's own opening tune in the game, REC_OPEN); film-page.js can draw a flag of three bands on a page (the First Republic's tricolor); tools/regress/film.js reads the page's own list of films, so a film made and not yet wired in is checked for its files without failing the run.

The history of these battlefields is told only from their own texts in index.html (chronicle, tag, hero, date, facts, victory text) and the chapters' stories, in their own words for the Genocide, the wars and the events of 2023: docs/history has nothing on them.
