#!/usr/bin/env python3
"""Writes docs/specs/explainer/reviews.md from a review folder's round-*/<cut>.<reviewer>.json and notes.json
(what was changed after each round):  reviews-md.py <review dir>"""
import glob, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); rdir = sys.argv[1]
notes = json.load(open(os.path.join(HERE, "review-notes.json"), encoding="utf-8"))
K = ("history", "pacing", "picture", "sound", "subtitles")
L = ["# Independent reviews of the explainer videos", "",
     "The owner's rule: independent reviewers score every cut on history, pacing, picture, sound and subtitles, each out of 10, and the cut is fixed and reviewed again until every score is 9 or more.", "",
     "How a round works (tools/explainer/review.sh): for each cut a review pack is made (the mp4, the .vtt, contact sheets with a frame every two seconds, full frames of the title, every plaque and the closing card, "
     "frames with the subtitle drawn as the page will draw it, the script with its sources, the measures, the timeline of scenes and of sentences, every cue's timing). "
     "Two fresh reviewers per cut, each a new `claude -p` session that has seen nothing of the making and is given only tools/explainer/review-brief.md, the pack and read access to the repository, score it and list every defect. "
     "They cannot hear or watch: sound is judged from what a speech recognizer wrote down, the loudness and peak numbers and their own measurements of the track; picture from the frames. "
     "The reviewers' full replies are kept in the build's scratch folder; the defects below are theirs, shortened.", ""]
rounds = sorted(glob.glob(os.path.join(rdir, "round-*")), key=lambda p: int(p.split("-")[-1]))
for rd in rounds:
    n = rd.split("-")[-1]
    L += ["## Round " + n, ""]
    if notes.get(n, {}).get("before"): L += [notes[n]["before"], ""]
    L += ["| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |", "|---|---|---|---|---|---|---|"]
    files = sorted(glob.glob(os.path.join(rd, "*.json")))
    low = 10
    for f in files:
        j = json.load(open(f)); cut, who = os.path.basename(f).split(".")[:2]
        if "error" in j: L.append("| %s | %s | no reply | | | | |" % (cut, who)); continue
        L.append("| %s | %s | %s |" % (cut, who, " | ".join(str(j.get(k)) for k in K)))
        low = min([low] + [j.get(k) or 0 for k in K])
    L += ["", "Lowest score of the round: %d." % low, ""]
    if notes.get(n, {}).get("defects"): L += ["What the reviewers found (the points that cost marks):", ""] + ["- " + d for d in notes[n]["defects"]] + [""]
    if notes.get(n, {}).get("after"): L += ["What was changed after this round:", ""] + ["- " + d for d in notes[n]["after"]] + [""]
if notes.get("end"): L += ["## Where it stands", "", notes["end"], ""]
open(os.path.join(ROOT, "docs", "specs", "explainer", "reviews.md"), "w", encoding="utf-8").write("\n".join(L))
print("reviews.md written,", len(rounds), "rounds")
