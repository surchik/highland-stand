#!/usr/bin/env python3
"""Writes docs/specs/explainer/<battlefield>.md (script, what the engine is fed, sources) from scripts.json and
sources.json, and voice.md from an audition's audition.json:  gen-docs.py [audition.json]"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import tts
S = tts.SCRIPTS; SRC = json.load(open(os.path.join(HERE, "sources.json"), encoding="utf-8")); V = json.load(open(os.path.join(HERE, "voice.json")))
OUT = os.path.join(ROOT, "docs", "specs", "explainer"); os.makedirs(OUT, exist_ok=True)
NAMES = {"erebuni": "Erebuni Rise (782 BC)", "tushpa": "Vale of Tushpa (735 BC)", "avarayr": "Avarayr Plain (451 AD)", "dvin": "Dvin Gates (640 AD)"}
for f, title in NAMES.items():
    L = ["# Explainer video: " + title, "",
         "Battlefield id `" + f + "`. Files: `assets/explainer/" + f + "/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.", "",
         "Voice: " + V["voice"] + " at speed " + str(V["speed"]) + " (" + V["engine"] + "; " + V["licence"] + "). See voice.md.", "",
         "Every line is taken from the battlefield's own texts in index.html, which were themselves checked against docs/history. Source keys:", ""]
    for k, v in SRC["key"].items(): L.append("- `" + k + "`: " + v)
    used = set()
    for shape in ("landscape", "vertical"):
        cut = f + "-" + shape; segs = S["cuts"][cut]
        L += ["", "## " + shape.capitalize() + " cut (" + str(sum(len(s["text"].split()) for s in segs)) + " words)", "", "### Script (true spelling: this is the subtitle text)", ""]
        para = []
        for s in segs:
            if s.get("beat") and para: L += [" ".join(para), ""]; para = []
            para.append(s["text"])
        L += [" ".join(para), "", "### Line by line: what the engine is fed, and where the line comes from", "",
              "Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.", ""]
        for i, s in enumerate(segs):
            L += [str(i + 1) + ". " + s["text"], "   - engine: `" + tts.engine_text(s["text"], "", s.get("lex")) + "`", "   - sources: " + "; ".join(SRC[cut][i])]
            for m in tts.NAME_RE.finditer(tts.spoken(s["text"])): used.add(m.group(1))
    L += ["", "## Names and how they are said", "", "| In the subtitles | IPA fed to the engine | Roughly |", "|---|---|---|"]
    for n in S["lexicon"]:
        if n in used: L.append("| " + n + " | `" + S["lexicon"][n]["ipa"] + "` | " + S["lexicon"][n]["say"] + (" (" + S["lexicon"][n]["fix"] + ")" if "fix" in S["lexicon"][n] else "") + (". " + S["lexicon"][n]["note"] if "note" in S["lexicon"][n] else "") + " |")
    open(os.path.join(OUT, f + ".md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
if len(sys.argv) > 1:
    A = json.load(open(sys.argv[1], encoding="utf-8"))
    rows = ["| Voice | Speed set | Words a minute | Word error rate | Without names | Names heard right | LUFS | True peak dB | Clipped samples | Median pitch Hz | Pitch spread (semitones) |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for m in A:
        rows.append("| %s | %.2f | %.0f | %.1f%% | %.1f%% | %.0f%% | %.1f | %.1f | %d | %s | %s |" % (m["voice"], m["speed"], m["wpm_with_pauses"], m["wer"] * 100, m["wer_without_names"] * 100, m["name_score"] * 100, m["lufs"], m["true_peak_db"], m["clipped_samples"], m.get("f0_median_hz", ""), m.get("f0_iqr_semitones", "")))
    open(os.path.join(OUT, "voice-audition-table.md"), "w", encoding="utf-8").write("\n".join(rows) + "\n")
print("docs written")
