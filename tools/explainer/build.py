#!/usr/bin/env python3
"""Builds one cut of an explainer video, start to end:  build.py <cut> [--work DIR] [--skip-film] [--no-music]

  1 narration   tts.py's build with the chosen voice (voice.json), set to -16 LUFS (two-pass loudnorm)
  2 subtitles   <id>/<cut>.vtt: the script in its true spelling, cue times from a speech recognizer's word times
  3 picture     film.js (the game's own page draws every frame)
  4 sound       the narration over a quiet music bed (assets/music), the bed ducked under the voice
  5 files       assets/explainer/<battlefield>/<landscape|vertical>.mp4 (+ .webm when smaller), -poster.jpg, .vtt
  6 measures    <work>/<cut>.qc.json: sizes, durations, loudness, what the recognizer heard, cue timing error

Needs TTS_MODELS (the folder with kokoro/ and piper/), ffmpeg, node with playwright, and the Python packages
kokoro-onnx, piper-tts, faster-whisper."""
import json, os, re, subprocess, sys, difflib
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import tts, measure

VOICE = json.load(open(os.path.join(HERE, "voice.json")))
MUSIC = {"erebuni": ("hov-arek-sarer-jan.mp3", 0), "tushpa": ("sheyk-sar.mp3", 0), "avarayr": ("sev-gakavik.mp3", 0), "dvin": ("na-mi-naz.mp3", 0)}
CAP = {"landscape": 6.0e6, "vertical": 3.0e6}

def run(*a, **k):
    return subprocess.run(list(a), check=True, **k)
def ff(*a):
    run("ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *a)

def loudnorm2(src, dst, extra=""):
    """To -16 LUFS with a true peak of at most -1.5 dB: a plain gain, then a limiter for the few peaks above it
    (two rounds, since the limiter takes a little loudness back)."""
    gain = 0.0
    for _ in range(3):
        ff("-i", src, "-af", extra + "volume=%.2fdB,alimiter=limit=0.80:attack=4:release=60:level=false" % gain, "-ar", "48000", "-c:a", "pcm_s16le", dst)
        got = measure.loudness(dst)["lufs"]
        if abs(got + 16) < 0.15: break
        gain += -16 - got

def stamp(t):
    return "%02d:%02d:%06.3f" % (t // 3600, t % 3600 // 60, t % 60)

WEAK = re.compile(r"^(the|a|an|of|in|on|to|and|by|its|his|their|for|from|at|with|into|not|St\.)$", re.I)
TIED = re.compile(r"^(I|II|III|thousand|BC|AD)[,.:;]?$")
def chunks(text, limit=74):
    """A sentence cut into cues of at most two lines of 37 letters. Of all the ways to cut it, the one that breaks at
    commas and colons where it can, never after a small word or inside a name and its numeral, and keeps the cues
    near an even length."""
    if len(text) <= 56: return [text]
    w = text.split(); n = len(w)
    best = [None] * (n + 1); best[0] = (0, [])
    for j in range(1, n + 1):
        for i in range(j):
            if best[i] is None: continue
            cue = " ".join(w[i:j])
            if len(cue) > limit: continue
            cost = best[i][0] + ((len(cue) - 46) ** 2) / 60 + (18 if len(cue) < 22 else 0)
            if j < n:
                tail = re.split(r"[,:;] ", cue)[-1].split()   # a comma two words after the last one is a list, not a clause
                cost += 0 if w[j - 1][-1] in ",:;" and len(tail) >= 3 else 14
                if WEAK.match(w[j - 1]): cost += 25
                if TIED.match(w[j]): cost += 60
            if best[j] is None or cost < best[j][0]: best[j] = (cost, best[i][1] + [cue])
    return best[n][1]

def two_lines(text, width=37):
    if len(text) <= width: return text
    words, best = text.split(), None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        score = -abs(len(a) - len(b)) - (40 if max(len(a), len(b)) > width + 2 else 0) + (3 if a[-1] in ",:;" else 0)
        if WEAK.match(words[i - 1]): score -= 6
        if TIED.match(words[i]): score -= 30
        if best is None or score > best[0]: best = (score, a, b)
    return best[1] + "\n" + best[2]

def cues(meta, heard_words):
    """Cue times: each sentence's own start and end are exact (tts.py); a cue that begins inside a sentence begins
    where the recognizer heard its first word (the script's words matched to the heard words), or in proportion."""
    ref, owner = [], []
    for s in meta["sentences"]:
        for part in chunks(s["text"]):
            for k, w in enumerate(measure.norm(part)):
                ref.append(w); owner.append((s["i"], part, k == 0))
    hyp = [w for hw in heard_words for w in measure.norm(hw["w"])]
    hyt = [hw for hw in heard_words for _ in measure.norm(hw["w"])]
    match = {}
    for a, b, n in difflib.SequenceMatcher(None, ref, hyp, autojunk=False).get_matching_blocks():
        for k in range(n): match[a + k] = hyt[b + k]
    out, pos = [], 0
    for s in meta["sentences"]:
        parts = chunks(s["text"]); n = len(parts); total = sum(len(p) for p in parts); acc = 0; starts = []
        for j, part in enumerate(parts):
            nw = len(measure.norm(part))
            if j == 0: starts.append((s["start"], "sentence"))
            elif pos in match and s["start"] < match[pos]["s"] < s["end"]: starts.append((match[pos]["s"], "heard"))
            else: starts.append((s["start"] + (s["end"] - s["start"]) * acc / total, "proportion"))
            acc += len(part); pos += nw
        for j, part in enumerate(parts):
            a = starts[j][0] - (0.06 if j else 0.12)
            b = starts[j + 1][0] - 0.06 if j + 1 < n else s["end"] + 0.25
            out.append({"start": round(max(0, a), 3), "end": round(b, 3), "text": two_lines(part), "how": starts[j][1], "sentence": s["i"]})
    for a, b in zip(out, out[1:]):   # no two cues on screen at once
        if a["end"] > b["start"] - 0.02: a["end"] = round(b["start"] - 0.02, 3)
    return out

def main():
    cut = sys.argv[1]
    if cut == "--cues":   # print how every script would be cut into cues
        for c, segs in tts.SCRIPTS["cuts"].items():
            print("==", c)
            for sg in segs:
                for part in chunks(sg["text"]): print("   " + two_lines(part).replace("\n", " / "))
        return
    field, shape = cut.split("-")
    work = sys.argv[sys.argv.index("--work") + 1] if "--work" in sys.argv else os.path.join(ROOT, ".explainer-work")
    os.makedirs(work, exist_ok=True)
    outdir = os.path.join(ROOT, "assets", "explainer", field); os.makedirs(outdir, exist_ok=True)
    W = os.path.join(work, cut)
    # 1 narration
    v = tts.load_voice(VOICE["voice"], os.environ.get("TTS_MODELS", "models"))
    speed = VOICE.get("speed_by_cut", {}).get(cut, VOICE["speed"])
    a, marks = tts.build(cut, v, speed)
    tts.write_wav(W + ".raw.wav", a)
    loudnorm2(W + ".raw.wav", W + ".narr.wav")
    dur = round(len(a) / tts.RATE, 3)
    meta = {"cut": cut, "voice": VOICE["voice"], "speed": speed, "duration": dur, "words": sum(len(m["text"].split()) for m in marks), "sentences": marks}
    json.dump(meta, open(W + ".narr.wav.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # 2 subtitles (and what the recognizer heard)
    q = measure.measure(W + ".narr.wav")
    cs = cues(meta, q["heard_words"])
    with open(os.path.join(outdir, shape + ".vtt"), "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for i, c in enumerate(cs): f.write("%d\n%s --> %s\n%s\n\n" % (i + 1, stamp(c["start"]), stamp(c["end"]), c["text"]))
    # how far each cue's start is from where the recognizer heard its first word
    errs = []
    hw = q["heard_words"]
    for c in cs:
        first = measure.norm(c["text"])[0]
        near = [w for w in hw if measure.norm(w["w"])[:1] == [first] and abs(w["s"] - c["start"]) < 1.5]
        if near: errs.append(round(min(abs(w["s"] - c["start"]) for w in near), 3))
    # 3 picture
    if "--skip-narration" in sys.argv: pass
    if "--skip-film" not in sys.argv or not os.path.exists(W + ".mkv"):
        run("node", os.path.join(HERE, "film.js"), cut, W + ".narr.wav.json", W + ".mkv")
    # 4 sound
    if "--no-music" in sys.argv:
        ff("-i", W + ".narr.wav", "-ac", "2", W + ".mix0.wav")
    else:
        track, off = MUSIC[field]
        fc = ("[1:a]atrim=%s:%s,asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,highpass=f=90,lowpass=f=9000,loudnorm=I=-27:TP=-6:LRA=7,afade=t=in:d=1.2,afade=t=out:st=%s:d=2.2[m];"
              "[0:a]aformat=channel_layouts=stereo,asplit=2[v][k];[m][k]sidechaincompress=threshold=0.015:ratio=9:attack=60:release=700:makeup=1[d];"
              "[v][d]amix=inputs=2:normalize=0:duration=first[o]") % (off, off + dur, dur - 2.3)
        ff("-i", W + ".narr.wav", "-i", os.path.join(ROOT, "assets", "music", track), "-filter_complex", fc, "-map", "[o]", "-ar", "48000", W + ".mix0.wav")
    loudnorm2(W + ".mix0.wav", W + ".mix.wav")
    # 5 files
    cap = CAP[shape]
    mp4 = os.path.join(outdir, shape + ".mp4"); webm = os.path.join(outdir, shape + ".webm")
    abr = 96000
    # two passes at the bit rate that fills the size aim (and no more than 1400 kbit/s: past that nothing is gained)
    vbr = int(min(1400e3, cap * 0.955 * 8 / dur - abr - 6000))
    common = ["-c:v", "libx264", "-preset", "slow", "-b:v", str(vbr), "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p", "-g", "90", "-x264-params", "aq-mode=3"]
    ff("-i", W + ".mkv", "-an", *common, "-pass", "1", "-passlogfile", W + ".pass", "-f", "null", "/dev/null")
    ff("-i", W + ".mkv", "-i", W + ".mix.wav", "-map", "0:v", "-map", "1:a", *common, "-pass", "2", "-passlogfile", W + ".pass",
       "-c:a", "aac", "-b:a", str(abr), "-movflags", "+faststart", "-t", str(dur), mp4)
    crf = vbr
    if "--webm" in sys.argv:
        ff("-i", W + ".mkv", "-i", W + ".mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "libvpx-vp9", "-b:v", str(int(vbr * 0.8)), "-row-mt", "1", "-cpu-used", "3", "-g", "90",
           "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "72k", "-t", str(dur), webm)
    keep_webm = os.path.exists(webm) and os.path.getsize(webm) < os.path.getsize(mp4)
    if os.path.exists(webm) and not keep_webm: os.remove(webm)
    poster = os.path.join(outdir, shape + "-poster.jpg")
    ff("-ss", "2.6", "-i", W + ".mkv", "-frames:v", "1", "-q:v", "4", poster)
    # 6 measures
    ff("-i", mp4, "-vn", "-ar", "48000", W + ".final.wav")
    final = measure.loudness(W + ".final.wav")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", W + ".mkv", "-i", mp4, "-lavfi", "ssim", "-f", "null", "-"], capture_output=True, text=True).stderr
    ssim = float(re.search(r"All:([\d.]+)", r).group(1))
    for k in ("heard_words",): q.pop(k)
    qc = {"cut": cut, "duration": dur, "video_bitrate": crf, "mp4_bytes": os.path.getsize(mp4), "webm_bytes": os.path.getsize(webm) if keep_webm else None, "poster_bytes": os.path.getsize(poster),
          "vtt_cues": len(cs), "cue_start_error_s": {"max": max(errs) if errs else None, "mean": round(sum(errs) / len(errs), 3) if errs else None, "checked": len(errs)},
          "cue_how": {h: sum(1 for c in cs if c["how"] == h) for h in ("sentence", "heard", "proportion")},
          "longest_line": max(len(l) for c in cs for l in c["text"].split("\n")), "reading_rate_cps_max": round(max(len(c["text"]) / (c["end"] - c["start"]) for c in cs), 1),
          "narration": q, "final_mix": final, "ssim_vs_master": ssim, "music": None if "--no-music" in sys.argv else MUSIC[field][0]}
    json.dump(qc, open(W + ".qc.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(cut, "%.1f s" % dur, "mp4 %.2f MB at %d kbit/s video" % (os.path.getsize(mp4) / 1e6, crf / 1000), "webm kept" if keep_webm else "no webm", "LUFS", final["lufs"], "TP", final["true_peak_db"], "WER", q["wer"], "names", q["name_score"], "ssim", ssim, "cue err max", qc["cue_start_error_s"]["max"])

if __name__ == "__main__":
    main()
