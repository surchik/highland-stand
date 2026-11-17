#!/usr/bin/env python3
"""Audition voices on one cut: audition.py <cut> <outdir> voice [voice ...]

Each voice reads the cut at speed 1, then again at the speed that brings it to about 140 words a minute
(pauses counted), is set to -16 LUFS (ffmpeg loudnorm, true peak at most -1.5 dB), and is measured (measure.py).
Writes <outdir>/<voice>.wav, .json and audition.json."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts, measure

def normalize(src, dst):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:linear=true", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", dst], check=True)

cut, outdir, voices = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(outdir, exist_ok=True)
models = os.environ.get("TTS_MODELS", "models")
res = []
for spec in voices:
    v = tts.load_voice(spec, models)
    a, marks = tts.build(cut, v, 1.0)
    words = sum(len(m["text"].split()) for m in marks)
    span = marks[-1]["end"] - marks[0]["start"]
    wpm1 = words / span * 60
    pauses = span - sum(m["end"] - m["start"] for m in marks)
    speed = max(0.8, min(1.25, (words / 140 * 60 - pauses) and (sum(m["end"] - m["start"] for m in marks)) / (words / 140 * 60 - pauses)))
    a, marks = tts.build(cut, v, speed)
    name = spec.replace(":", "_")
    raw = os.path.join(outdir, name + ".raw.wav"); out = os.path.join(outdir, name + ".wav")
    tts.write_wav(raw, a)
    rawm = measure.loudness(raw)
    normalize(raw, out)
    json.dump({"cut": cut, "voice": spec, "speed": speed, "words": words, "sentences": marks}, open(out + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    m = measure.measure(out)
    m.update({"voice": spec, "speed": round(speed, 3), "wpm_at_speed_1": round(wpm1, 1), "raw_lufs": rawm["lufs"], "raw_true_peak_db": rawm["true_peak_db"]})
    res.append(m)
    print(spec, "speed %.2f" % speed, "wpm", m["wpm_with_pauses"], "WER", m["wer"], "no-names", m["wer_without_names"], "names", m["name_score"], "LUFS", m["lufs"], "TP", m["true_peak_db"], "f0", m.get("f0_median_hz"), m.get("f0_iqr_semitones"), flush=True)
    json.dump(res, open(os.path.join(outdir, "audition.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
