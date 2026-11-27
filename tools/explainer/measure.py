#!/usr/bin/env python3
"""Objective measures of a narration wav: loudness, true peak, pace, pitch, and what a speech recognizer hears.

  measure.py <wav> [--model medium.en]   (the wav's <wav>.json from tts.py gives the script)

Prints one JSON object. Used by audition.py and by the build (qc)."""
import json, os, re, subprocess, sys, wave
import numpy as np

def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = r[r.rfind("Summary:"):]
    g = lambda k: float(re.search(k + r":\s*(-?[\d.]+)", tail).group(1))
    return {"lufs": g("I"), "lra": g("LRA"), "true_peak_db": g("Peak")}

def read(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768
        if w.getnchannels() == 2: a = a.reshape(-1, 2).mean(1)
        return a, w.getframerate()

def pitch(a, sr):
    """Median and spread of the voice's fundamental (autocorrelation, voiced 40 ms frames, 60 to 320 Hz)."""
    step = int(sr / 16000) or 1
    a = a[::step]; sr = sr // step
    n = int(sr * 0.04); f0 = []
    lo, hi = int(sr / 320), int(sr / 60)
    for i in range(0, len(a) - n, n // 2):
        x = a[i:i + n]
        if np.sqrt(np.mean(x * x)) < 0.02: continue
        x = x - x.mean()
        c = np.correlate(x, x, "full")[n - 1:]
        if c[0] <= 0: continue
        k = lo + int(np.argmax(c[lo:hi]))
        if c[k] / c[0] > 0.5: f0.append(sr / k)
    f0 = np.array(f0)
    if not len(f0): return {}
    return {"f0_median_hz": round(float(np.median(f0)), 1), "f0_iqr_semitones": round(float(12 * np.log2(np.percentile(f0, 75) / np.percentile(f0, 25))), 2)}

ROMAN = {"i": "the first", "ii": "the second", "iii": "the third"}
NUM = {"428": "four twenty eight", "449": "four forty nine", "450": "four fifty", "451": "four fifty one", "484": "four eighty four", "640": "six forty",
       "782": "seven eighty two", "743": "seven forty three", "735": "seven thirty five", "1950": "nineteen fifty", "35": "thirty five", "35,000": "thirty five thousand",
       "8th": "eighth", "6th": "sixth", "4th": "fourth", "st": "saint", "st.": "saint", "bc": "b c", "manoeuvre": "maneuver", "defence": "defense", "kilometres": "kilometers"}
def norm(t):
    t = t.lower().replace("’", "'").replace("-", " ")
    t = re.sub(r"(\d),(\d)", r"\1\2", t)
    t = re.sub(r"\b35000\b", "thirty five thousand", t)
    t = re.sub(r"\b(\d+)\s?bc\b", r"\1 b c", t)
    t = re.sub(r"\bb\.c\.?", "b c", t)
    t = re.sub(r"[^a-z0-9' ]", " ", t)
    out = []
    for w in t.split():
        w = NUM.get(w, w)
        out += w.split()
    out2 = []
    for i, w in enumerate(out):   # a roman numeral after a name
        out2 += ROMAN[w].split() if w in ROMAN and i and w != "i" or (w == "i" and i and out[i - 1] in ("argishti",)) else [w]
    return out2

def lev(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[-1]

def transcribe(path, model="medium.en", sentences=None):
    """What the recognizer writes down, with each word's time. Given the sentences' own times (tts.py), it hears one
    sentence at a time, cut from the narration with a quarter second of margin: over a whole minute its word times
    drift and a short last line after a pause is misheard; one sentence at a time they do not."""
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=4)
    words, text = [], ""
    if not sentences:
        segs, _ = m.transcribe(path, beam_size=5, word_timestamps=True, condition_on_previous_text=False, vad_filter=False)
        for s in segs:
            text += s.text
            for w in s.words: words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
        return text.strip(), words
    a, sr = read(path)
    step = sr // 16000
    for st in sentences:
        t0 = max(0.0, st["start"] - 0.25)
        x = a[int(t0 * sr): int((st["end"] + 0.25) * sr)]
        x = x[:len(x) // step * step].reshape(-1, step).mean(1).astype(np.float32)
        segs, _ = m.transcribe(x, beam_size=5, word_timestamps=True, condition_on_previous_text=False, vad_filter=False)
        for s in segs:
            text += s.text
            for w in s.words: words.append({"w": w.word.strip(), "s": round(w.start + t0, 3), "e": round(w.end + t0, 3)})
    return text.strip(), words

def names_heard(script_text, heard, lexicon):
    """For every lexicon name in the script: how close the nearest thing the recognizer wrote is (1 = same letters)."""
    h = re.sub(r"[^a-z' ]", " ", heard.lower().replace("-", " ")).split()
    grams = set(h) | set(" ".join(h[i:i + 2]) for i in range(len(h) - 1)) | set("".join(h[i:i + 2]) for i in range(len(h) - 1))
    res = {}
    for name in lexicon:
        if not re.search(r"\b" + re.escape(name) + r"\b", script_text): continue
        n = name.lower().replace("-", " ")
        best = max(grams, key=lambda g: 1 - lev(n, g) / max(len(n), len(g)))
        res[name] = {"heard": best, "score": round(1 - lev(n, best) / max(len(n), len(best)), 2)}
    return res

def measure(path, model="medium.en", asr=True):
    meta = json.load(open(path + ".json", encoding="utf-8")) if os.path.exists(path + ".json") else None
    a, sr = read(path)
    out = {"file": os.path.basename(path), "duration": round(len(a) / sr, 2), "sample_peak": round(float(np.max(np.abs(a))), 4),
           "clipped_samples": int(np.sum(np.abs(a) >= 0.999))}
    out.update(loudness(path)); out.update(pitch(a, sr))
    if meta:
        speech = sum(s["end"] - s["start"] for s in meta["sentences"])
        span = meta["sentences"][-1]["end"] - meta["sentences"][0]["start"]
        out["words"] = meta["words"]
        out["wpm_with_pauses"] = round(meta["words"] / span * 60, 1)
        out["wpm_speech_only"] = round(meta["words"] / speech * 60, 1)
    if asr:
        heard, words = transcribe(path, model, meta["sentences"] if meta else None)
        out["heard"] = heard; out["heard_words"] = words
        if meta:
            ref = " ".join(s["text"] for s in meta["sentences"])
            r, h = norm(ref), norm(heard)
            out["wer"] = round(lev(r, h) / len(r), 4)
            lex = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts.json"), encoding="utf-8"))["lexicon"]
            import glob   # (and the lexicons of the scripts-<group>.json files, as tts.py merges them)
            for p in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts-*.json"))): lex.update(json.load(open(p, encoding="utf-8")).get("lexicon", {}))
            nh = names_heard(ref, heard, lex)
            out["names"] = nh
            out["name_score"] = round(sum(v["score"] for v in nh.values()) / max(1, len(nh)), 3)
            # the error rate with every name taken out of both sides: what is left is plain English
            drop = set(w for n in nh for w in norm(n)) | set(w for v in nh.values() for w in v["heard"].split())
            r2, h2 = [w for w in r if w not in drop], [w for w in h if w not in drop]
            out["wer_without_names"] = round(lev(r2, h2) / len(r2), 4)
    return out

if __name__ == "__main__":
    model = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else "medium.en"
    print(json.dumps(measure(sys.argv[1], model), ensure_ascii=False, indent=1))
