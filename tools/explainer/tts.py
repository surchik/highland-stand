#!/usr/bin/env python3
"""Narration for the explainer videos (stage 5).

  tts.py <cut> <voice> <out.wav> [--speed 1.0] [--models DIR]

<voice> is kokoro:<name> (Kokoro-82M through kokoro-onnx) or piper:<model name> (a Piper .onnx voice).
Each sentence of the cut (scripts.json) is synthesized by itself and the sentences are joined with set pauses,
so the start and end of every sentence is known exactly: they are written beside the wav as <out>.json.
Numbers are spelled out for the engine (scripts.json "spoken") and every name in the lexicon is handed to the
engine as IPA, never as spelling: the engines' own guesses at the Armenian names are wrong (Argishti comes out
"Arjishti"). The subtitles keep the true spelling.
"""
import json, os, re, sys, wave, argparse
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = json.load(open(os.path.join(HERE, "scripts.json"), encoding="utf-8"))
# more cuts in files of their own beside it (scripts-<group>.json: cuts, lexicon and spoken forms, added to these)
import glob as _glob
for _p in sorted(_glob.glob(os.path.join(HERE, "scripts-*.json"))):
    _x = json.load(open(_p, encoding="utf-8"))
    SCRIPTS["cuts"].update(_x.get("cuts", {})); SCRIPTS["lexicon"].update(_x.get("lexicon", {})); SCRIPTS["spoken"] += _x.get("spoken", [])
    SCRIPTS.setdefault("speed_by_cut", {}).update(_x.get("speed_by_cut", {}))   # (its cuts' speeds, beside voice.json's)
PAUSE_SENTENCE, PAUSE_BEAT, LEAD_IN, LEAD_OUT = 0.44, 0.76, 2.6, 2.8
TALL = {"PAUSE_SENTENCE": 0.38, "PAUSE_BEAT": 0.64, "LEAD_IN": 2.1, "LEAD_OUT": 2.3}   # the upright cuts are half the length: tighter   # the title has the first seconds, the closing card the last
RATE = 48000

def spoken(text):
    for a, b in SCRIPTS["spoken"]:
        text = text.replace(a, b)
    return text

NAMES = sorted(SCRIPTS["lexicon"], key=len, reverse=True)
NAME_RE = re.compile(r"\b(" + "|".join(re.escape(n) for n in NAMES) + r")('s)?(?![A-Za-z])")

def pieces(text, lex=None):
    """[(kind, value)]: kind 'text' (plain words) or 'ipa' (a lexicon name, 's kept as z). lex: a sentence's own
    IPA for a name where it sits differently (scripts.json "lex": a name that opens a sentence)."""
    out, pos = [], 0
    for m in NAME_RE.finditer(text):
        if m.start() > pos:
            out.append(("text", text[pos:m.start()]))
        out.append(("ipa", (lex or {}).get(m.group(1), SCRIPTS["lexicon"][m.group(1)]["ipa"]) + ("z" if m.group(2) else "")))
        pos = m.end()
    if pos < len(text):
        out.append(("text", text[pos:]))
    return out

def engine_text(text, style, lex=None):
    """What the engine is fed, as a readable string (docs): names as [[ipa]]."""
    return "".join(v if k == "text" else "[[" + v + "]]" for k, v in pieces(spoken(text), lex))

class KokoroVoice:
    def __init__(self, name, models):
        from kokoro_onnx import Kokoro
        self.k = Kokoro(os.path.join(models, "kokoro", "kokoro-v1.0.onnx"), os.path.join(models, "kokoro", "voices-v1.0.bin"))
        self.name = name
        self.lang = "en-gb" if name[0] == "b" else "en-us"
    def phonemes(self, text, lex=None):
        out = ""
        for kind, v in pieces(spoken(text), lex):
            if kind == "ipa":
                out += v
            else:
                lead = " " if v[:1] == " " else ""
                tail = " " if v[-1:] == " " else ""
                core = v.strip()
                if not core:
                    out += " "
                    continue
                if re.fullmatch(r"[\W_]+", core):
                    out += lead + core + tail
                    continue
                # punctuation at the very start of a piece (", king of") must survive the phonemizer
                m = re.match(r"^([,.:;!?]+)\s*(.*)$", core, re.S)
                pre = ""
                if m:
                    pre, core = m.group(1) + " ", m.group(2)
                ph = self.k.tokenizer.phonemize(core, self.lang) if core else ""
                out += lead + pre + ph + tail
        return re.sub(r"\s+", " ", out).strip()
    def say(self, text, speed, lex=None):
        ph = self.phonemes(text, lex)
        vocab = self.k.tokenizer.vocab if hasattr(self.k.tokenizer, "vocab") else None
        if vocab:
            bad = sorted(set(c for c in ph if c not in vocab))
            if bad:
                raise SystemExit("phonemes outside the model's vocabulary: %r in %r" % (bad, ph))
        audio, sr = self.k.create(ph, voice=self.name, speed=speed, lang=self.lang, is_phonemes=True, trim=True)
        return np.asarray(audio, dtype=np.float32), sr, ph

class PiperVoiceW:
    def __init__(self, name, models):
        from piper import PiperVoice
        self.v = PiperVoice.load(os.path.join(models, "piper", name + ".onnx"))
        self.name = name
    def say(self, text, speed, lex=None):
        from piper import SynthesisConfig
        t = engine_text(text, "piper", lex)
        cfg = SynthesisConfig(length_scale=1.0 / speed)
        chunks = list(self.v.synthesize(t, syn_config=cfg))
        audio = np.concatenate([c.audio_float_array for c in chunks])
        return audio.astype(np.float32), chunks[0].sample_rate, t

def load_voice(spec, models):
    eng, name = spec.split(":", 1)
    return KokoroVoice(name, models) if eng == "kokoro" else PiperVoiceW(name, models)

def trim(a, sr, thresh=0.004):
    """Cut leading and trailing near-silence, leaving 15 ms."""
    idx = np.where(np.abs(a) > thresh)[0]
    if not len(idx):
        return a
    pad = int(sr * 0.015)
    return a[max(0, idx[0] - pad): min(len(a), idx[-1] + pad)]

def resample(a, sr, to):
    if sr == to:
        return a
    n = int(round(len(a) * to / sr))
    x = np.linspace(0, len(a) - 1, n)
    return np.interp(x, np.arange(len(a)), a).astype(np.float32)

def build(cut, voice, speed):
    segs = SCRIPTS["cuts"][cut]
    tall = cut.endswith("vertical")
    LEAD_IN, LEAD_OUT = (TALL["LEAD_IN"], TALL["LEAD_OUT"]) if tall else (globals()["LEAD_IN"], globals()["LEAD_OUT"])
    PAUSE_SENTENCE, PAUSE_BEAT = (TALL["PAUSE_SENTENCE"], TALL["PAUSE_BEAT"]) if tall else (globals()["PAUSE_SENTENCE"], globals()["PAUSE_BEAT"])
    out, marks, t = [np.zeros(int(RATE * LEAD_IN), np.float32)], [], LEAD_IN
    for i, s in enumerate(segs):
        if i:
            gap = PAUSE_BEAT if s.get("beat") else PAUSE_SENTENCE
            gap = s.get("gap", gap)
            out.append(np.zeros(int(RATE * gap), np.float32)); t += int(RATE * gap) / RATE
        a, sr, fed = voice.say(s["text"], speed, s.get("lex"))
        a = resample(trim(a, sr), sr, RATE)
        fade = int(RATE * 0.008)
        a[:fade] *= np.linspace(0, 1, fade); a[-fade:] *= np.linspace(1, 0, fade)
        marks.append({"i": i, "beat": bool(s.get("beat")), "text": s["text"], "fed": fed, "start": round(t, 3), "end": round(t + len(a) / RATE, 3)})
        out.append(a); t += len(a) / RATE
    out.append(np.zeros(int(RATE * LEAD_OUT), np.float32))
    return np.concatenate(out), marks

def write_wav(path, a):
    a = np.clip(a, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((a * 32767).astype("<i2").tobytes())

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cut"); ap.add_argument("voice"); ap.add_argument("out")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--models", default=os.environ.get("TTS_MODELS", "models"))
    o = ap.parse_args()
    v = load_voice(o.voice, o.models)
    a, marks = build(o.cut, v, o.speed)
    write_wav(o.out, a)
    words = sum(len(m["text"].split()) for m in marks)
    json.dump({"cut": o.cut, "voice": o.voice, "speed": o.speed, "duration": round(len(a) / RATE, 3), "words": words, "peak": float(np.max(np.abs(a))), "sentences": marks},
              open(o.out + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(o.cut, o.voice, "%.2f s" % (len(a) / RATE), words, "words", "%.0f wpm" % (words / (len(a) / RATE - LEAD_IN - LEAD_OUT) * 60))
