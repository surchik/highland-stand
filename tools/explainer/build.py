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
# the bed of each battlefield: one of the owner's recordings, from this second of it
MUSIC = {"erebuni": ("hov-arek-sarer-jan.mp3", 20), "tushpa": ("sheyk-sar.mp3", 30), "avarayr": ("sev-gakavik.mp3", 30), "dvin": ("na-mi-naz.mp3", 20)}
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

def parts_of(s):
    """The cues of a sentence: set by hand in scripts.json ("cues", a line break inside a cue as a newline), or
    the whole sentence when it fits one line."""
    return s.get("cues") or [s["text"]]

def envelope(path):
    import numpy as np
    a, sr = measure.read(path)
    n = int(sr * 0.01); k = len(a) // n
    return np.sqrt((a[:k * n].reshape(k, n) ** 2).mean(1)), 0.01

def cues(meta, heard_words, script, wav):
    """Cue times. A sentence's own start and end are exact (tts.py). A cue that begins inside a sentence begins at
    the pause before its first word: the recognizer's time for that word (the script's words matched to the heard
    words) finds the place, and the quietest moment of the narration just before it is the pause; where there is
    no pause, a tenth of a second before the recognizer's time; where the recognizer missed the word, in
    proportion to the letters."""
    import numpy as np
    env, hop = envelope(wav)
    loud = float(np.median(env[env > 0.01])) if (env > 0.01).any() else 0.05
    ref = []
    for sc in script:
        for part in parts_of(sc): ref += measure.norm(part)
    hyp = [w for hw in heard_words for w in measure.norm(hw["w"])]
    hyt = [hw for hw in heard_words for _ in measure.norm(hw["w"])]
    match = {}
    for a, b, n in difflib.SequenceMatcher(None, ref, hyp, autojunk=False).get_matching_blocks():
        for k in range(n): match[a + k] = hyt[b + k]
    out, pos = [], 0
    for s, sc in zip(meta["sentences"], script):
        parts = parts_of(sc); n = len(parts); total = sum(len(p) for p in parts); acc = 0; starts = []
        for j, part in enumerate(parts):
            nw = len(measure.norm(part)); h = match[pos]["s"] if pos in match else None
            if j == 0: starts.append((s["start"], "sentence", h))
            else:
                guess = h if h is not None and s["start"] < h < s["end"] else s["start"] + (s["end"] - s["start"]) * acc / total
                i0, i1 = max(0, int((guess - 0.45) / hop)), int((guess + 0.12) / hop)
                k = i0 + int(np.argmin(env[i0:i1]))
                if env[k] < 0.3 * loud:
                    k0 = k
                    while k0 > i0 and env[k0 - 1] < 0.3 * loud: k0 -= 1                                  # where the pause begins
                    while k + 1 < len(env) and k + 1 < i1 + 20 and env[k + 1] < 0.3 * loud: k += 1   # and where it ends: the words begin here
                    t = (k + 1) * hop
                    if h is not None and k0 * hop <= h < t: t = h    # the recognizer heard the word a little sooner: take its time
                    starts.append((t, "pause", h))
                else: starts.append((guess - 0.1, "heard" if h is not None else "proportion", h))
            acc += len(part); pos += nw
        for j, part in enumerate(parts):
            a = starts[j][0] - 0.1
            b = starts[j + 1][0] - 0.12 if j + 1 < n else s["end"] + 0.3
            out.append({"start": round(max(0, a), 3), "end": round(b, 3), "text": part, "how": starts[j][1], "sentence": s["i"], "speech": round(starts[j][0], 3), "heard_at": starts[j][2]})
    for i, c in enumerate(out):   # long enough to read: at least 1.6 s and at most 17 letters a second, taken from the silence after it
        need = max(1.6, len(c["text"]) / 17.0)
        room = (out[i + 1]["start"] - 0.04) if i + 1 < len(out) else meta["duration"] - 0.1
        if c["end"] - c["start"] < need: c["end"] = round(min(room, c["start"] + need), 3)
        if c["end"] > room: c["end"] = round(room, 3)
    return out

def main():
    cut = sys.argv[1]
    if cut == "--cues":   # print how every script would be cut into cues
        for c, segs in tts.SCRIPTS["cuts"].items():
            print("==", c)
            for sg in segs:
                for part in parts_of(sg): print("   " + part.replace("\n", " / "))
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
    cs = cues(meta, q["heard_words"], tts.SCRIPTS["cuts"][cut], W + ".narr.wav")
    with open(os.path.join(outdir, shape + ".vtt"), "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for i, c in enumerate(cs): f.write("%d\n%s --> %s\n%s\n\n" % (i + 1, stamp(c["start"]), stamp(c["end"]), c["text"]))
    # how far the moment each cue's speech begins (as the cue was timed) is from where the recognizer heard its first word
    errs = [round(abs(c["speech"] - c["heard_at"]), 3) for c in cs if c["heard_at"] is not None]
    json.dump(cs, open(W + ".cues.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # 3 picture
    if "--skip-narration" in sys.argv: pass
    if "--skip-film" not in sys.argv or not os.path.exists(W + ".mkv"):
        run("node", os.path.join(HERE, "film.js"), cut, W + ".narr.wav.json", W + ".mkv")
    # 4 sound
    if "--no-music" in sys.argv:
        ff("-i", W + ".narr.wav", "-af", "pan=stereo|c0=c0|c1=c0", W + ".mix0.wav")
    else:
        track, off = MUSIC[field]
        # the bed: set to an even level, lowered while the voice speaks, in under the title and out with the closing
        # card (it ends with the film, not before it)
        # (the bed is levelled from three seconds before its first note used, so the levelling has settled by then)
        fc = ("[1:a]atrim=%s:%s,asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,highpass=f=80,dynaudnorm=f=400:g=31:m=6,loudnorm=I=-24:TP=-4:LRA=6,"
              "atrim=start=3,asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=%s:d=1.3:curve=qsin[m];"
              "[0:a]pan=stereo|c0=c0|c1=c0,asplit=2[v][k];[m][k]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=500:makeup=1[d];"
              "[v][d]amix=inputs=2:normalize=0:duration=first[o]") % (off - 3, off + dur + 0.5, dur - 1.32)
        ff("-i", W + ".narr.wav", "-i", os.path.join(ROOT, "assets", "music", track), "-filter_complex", fc, "-map", "[o]", "-ar", "48000", W + ".mix0.wav")
    loudnorm2(W + ".mix0.wav", W + ".mix.wav")
    # 5 files
    cap = CAP[shape]
    mp4 = os.path.join(outdir, shape + ".mp4"); webm = os.path.join(outdir, shape + ".webm")
    abr = 80000
    # two passes at the bit rate that fills the size aim (and no more than 1400 kbit/s: past that nothing is gained)
    vbr = int(min(1400e3, cap * 0.93 * 8 / dur - abr - 6000))
    common = ["-c:v", "libx264", "-preset", "slow", "-b:v", str(vbr), "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p", "-g", "72", "-x264-params", "aq-mode=3"]
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
          "cue_how": {h: sum(1 for c in cs if c["how"] == h) for h in ("sentence", "pause", "heard", "proportion")},
          "shortest_cue_s": round(min(c["end"] - c["start"] for c in cs), 2),
          "longest_line": max(len(l) for c in cs for l in c["text"].split("\n")), "reading_rate_cps_max": round(max(len(c["text"]) / (c["end"] - c["start"]) for c in cs), 1),
          "narration": q, "final_mix": final, "ssim_vs_master": ssim, "music": None if "--no-music" in sys.argv else MUSIC[field][0]}
    json.dump(qc, open(W + ".qc.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(cut, "%.1f s" % dur, "mp4 %.2f MB at %d kbit/s video" % (os.path.getsize(mp4) / 1e6, crf / 1000), "webm kept" if keep_webm else "no webm", "LUFS", final["lufs"], "TP", final["true_peak_db"], "WER", q["wer"], "names", q["name_score"], "ssim", ssim, "cue err max", qc["cue_start_error_s"]["max"])

if __name__ == "__main__":
    main()
