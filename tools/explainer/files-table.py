#!/usr/bin/env python3
"""Writes docs/specs/explainer/files.md (every file, its length, size and measures) from a work folder's *.qc.json,
and puts the short table at the end of integration.md:  files-table.py <work dir>"""
import json, os, sys, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); work = sys.argv[1]
D = os.path.join(ROOT, "docs", "specs", "explainer")
rows, short = [], []
for f in ("erebuni", "tushpa", "avarayr", "dvin"):
    for sh in ("landscape", "vertical"):
        q = json.load(open(os.path.join(work, f + "-" + sh + ".qc.json"))); n = q["narration"]
        base = "assets/explainer/%s/%s" % (f, sh)
        vtt = os.path.getsize(os.path.join(ROOT, base + ".vtt"))
        short.append("| %s.mp4 | %.1f s | %.2f MB | %d KB | %.1f KB |" % (base, q["duration"], q["mp4_bytes"] / 1e6, q["poster_bytes"] / 1000, vtt / 1000))
        rows.append("| %s-%s | %.1f s | %.2f MB | %d | %.0f | %.1f%% | %.0f%% | %.1f | %.1f | %d | %.2f s | %d | %.1f | %.3f | %s |" % (
            f, sh, q["duration"], q["mp4_bytes"] / 1e6, n["words"], n["wpm_with_pauses"], n["wer"] * 100, n["name_score"] * 100, q["final_mix"]["lufs"], q["final_mix"]["true_peak_db"],
            q["vtt_cues"], q["cue_start_error_s"]["max"] or 0, q["longest_line"], q["reading_rate_cps_max"], q["ssim_vs_master"], q["music"]))
head = "| File | Length | Size | Poster | Subtitles |\n|---|---|---|---|---|\n"
total = sum(float(r.split("|")[3].split()[0]) for r in short)
tbl = head + "\n".join(short) + "\n\nAll eight films together: %.1f MB. A player downloads one of them per chronicle, only when it opens.\n" % total
p = os.path.join(D, "integration.md"); s = open(p, encoding="utf-8").read()
s = s[:s.index("## 10. The files")] + "## 10. The files\n\n" + tbl
open(p, "w", encoding="utf-8").write(s)
open(os.path.join(D, "files.md"), "w", encoding="utf-8").write("# The files and their measures\n\n" + tbl + "\n## Measures\n\n"
    "| Cut | Length | mp4 | Words | Words a minute | Word error rate | Names heard right | LUFS | True peak dB | Cues | Largest cue start error | Longest line | Fastest cue (letters/s) | SSIM | Music bed |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n"
    + "\n".join(rows) + "\n\nWord error rate and names: what faster-whisper (medium.en) wrote down from the narration, against the script. LUFS and true peak: the finished sound track in the mp4. "
    "Cue start error: the distance between a subtitle cue's start and the moment the recognizer heard its first word (cues are set to appear about a tenth of a second early). "
    "SSIM: the mp4's picture against the uncompressed master (1 is identical).\n")
print(tbl)
