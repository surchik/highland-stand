#!/usr/bin/env python3
"""The trailer, cut from its parts: python3 tools/trailer/build.py <clips dir> <captions dir> <voice dir> <gemini.mp4> <out dir>

clips: tools/trailer/shots.js's game shots; captions: tools/trailer/captions.js's PNGs; voice: l0.wav .. l4.wav
(tools/tts-kokoro.py, am_michael at 0.95, the lines in tools/trailer/README.md); gemini: the owner's cinematic clip.
Writes trailer.mp4 (H.264 + AAC), trailer.webm (VP9 + Opus) and trailer-poster.jpg, 1920x1080 at 30 fps, 30 s.
The music is the owner's Sheyk Sar (assets/music/sheyk-sar.mp3), ducked under the voice; the mix at -16 LUFS."""
import json, os, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
clips, caps, vo, gem, out = sys.argv[1:6]
E = json.load(open(os.path.join(ROOT, "tools/trailer/edit.json")))
os.makedirs(out, exist_ok=True)
FPS, DUR = 30, 30.0

def run(a): subprocess.run(a, check=True)

# 1. the picture: every segment trimmed, graded and set to 1280x720 at 30 fps, then joined
inputs, f = [], []
cur, L = None, 0.0
for i, seg in enumerate(E["segments"]):
    clip, ss, d = seg[:3]; sp = seg[3] if len(seg) > 3 else 1.0; x = seg[4] if len(seg) > 4 else 0; pu = seg[5] if len(seg) > 5 else 0
    src = gem if clip == "gemini" else os.path.join(clips, clip + ".mkv")
    if clip != "gemini":   # a clip shorter than its segment would shift every later cut
        have = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], capture_output=True, text=True).stdout)
        if have < ss + d * (sp or 1) - 0.01: raise SystemExit(f"{clip}.mkv is {have:.2f} s, the edit needs {ss + d:.2f} s")
    # speed 0: the in point's frame, held (the loop's last frames land on the first one)
    inputs += ["-ss", str(ss), "-t", str(d * (sp or 0) + 0.2) if sp else "0.1", "-i", src]
    if clip == "gemini":
        # the owner's clip: its burned-in words (bottom) and its wave counter (top right) cropped away
        g = "crop=1024:576:170:36,scale=1920:1080:flags=lanczos,eq=saturation=0.92,unsharp=5:5:0.6"
    elif clip == "endfield":   # the title's ground: a battlefield at dusk, dimmed, under a slow push
        g = "fps=30,eq=brightness=-0.1:contrast=1.0:saturation=0.8,vignette=angle=PI/4.5"
    elif clip in ("map", "endmap"):
        # the chart at dusk: darker and warmer than the page's parchment, so the words on it carry
        g = "fps=30,eq=brightness=-0.13:contrast=1.12:saturation=0.85:gamma_r=1.04:gamma_b=0.92,vignette=angle=PI/3.8"
    elif clip == "stepanakert":   # a night field: lifted to sit with the others
        g = "fps=30,eq=brightness=0.13:contrast=1.06:saturation=1.18:gamma=1.08,vignette=angle=PI/9"
    else:
        g = "fps=30,eq=brightness=0.07:contrast=1.05:saturation=1.12,vignette=angle=PI/7"
    if pu:   # a slow push in over the segment (the frame grows by pu)
        g += f",scale=w='2*trunc(960*(1+{pu}*t/{d}))':h='2*trunc(540*(1+{pu}*t/{d}))':eval=frame:flags=bicubic,crop=1920:1080"
    if sp and sp < 1:   # slowed: motion-compensated frames in between, not repeated ones
        f.append(f"[{i}:v]{g},setpts=(PTS-STARTPTS)/{sp},minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,setsar=1,trim=duration={d},setpts=PTS-STARTPTS,settb=AVTB,format=yuv420p[s{i}]")
    elif sp:
        f.append(f"[{i}:v]{g},setpts=(PTS-STARTPTS)/{sp},fps=30,setsar=1,trim=duration={d},setpts=PTS-STARTPTS,settb=AVTB,format=yuv420p[s{i}]")
    else:
        f.append(f"[{i}:v]{g},trim=end_frame=1,tpad=stop_mode=clone:stop_duration={d},fps=30,setsar=1,trim=duration={d},setpts=PTS-STARTPTS,settb=AVTB,format=yuv420p[s{i}]")
    if cur is None: cur, L = f"s{i}", d; continue
    o = f"j{i}"
    if x: f.append(f"[{cur}][s{i}]xfade=transition=fade:duration={x}:offset={L - x:.3f}[{o}]"); L += d - x
    else: f.append(f"[{cur}][s{i}]concat=n=2:v=1:a=0[{o}]"); L += d
    cur = o
n = len(E["segments"])
print("picture length", round(L, 2))
f.append(f"[{cur}]trim=duration={DUR},setpts=PTS-STARTPTS[base]")
last = "base"
for k, (cid, t0, t1) in enumerate(E["captions"]):
    j = n + k
    inputs += ["-loop", "1", "-t", str(DUR), "-i", os.path.join(caps, cid + ".png")]
    fi, fo = (0.08, 0.08) if cid.startswith("t_") else (0.3, 0.3) if not cid.startswith("title") else (0.7, 0.4)
    f.append(f"[{j}:v]scale=1920:1080,format=rgba,fade=t=in:st={t0}:d={fi}:alpha=1,fade=t=out:st={t1 - fo}:d={fo}:alpha=1[c{k}]")
    f.append(f"[{last}][c{k}]overlay=0:0:enable='between(t,{t0},{t1})'[v{k}]")
    last = f"v{k}"
f.append(f"[{last}]format=yuv420p[vout]")
run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(f), "-map", "[vout]", "-r", str(FPS), "-c:v", "libx264", "-crf", "12", "-preset", "medium", os.path.join(out, "master.mkv")])

# 2. the sound: the voice lines at their times, the music ducked under them, the whole at -16 LUFS
ai, af = [], []
for k, (w, at, *gain) in enumerate(E["voice"]):
    ai += ["-i", os.path.join(vo, w + ".wav")]
    af.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=mono,volume={(gain or [0])[0]}dB,adelay={int(at * 1000)}:all=1[v{k}]")
m = len(E["voice"])
af.append("".join(f"[v{k}]" for k in range(m)) + f"amix=inputs={m}:normalize=0,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,aecho=0.8:0.5:40:0.1,apad=whole_dur={DUR},atrim=0:{DUR},asplit=2[vo][key]")
ai += ["-i", os.path.join(ROOT, "assets/music/sheyk-sar.mp3")]
af.append(f"[{m}:a]atrim=1:{DUR + 1},asetpts=PTS-STARTPTS,aresample=48000,acompressor=threshold=-26dB:ratio=4:attack=30:release=400:makeup=4,equalizer=f=2200:width_type=o:width=1.6:g=-5,volume='(1-0.2*min(max((t-18)/2\\,0)\\,1))*(1-0.35*min(max((t-1.9)/0.3\\,0)\\,1)*min(max((4.4-t)/0.3\\,0)\\,1))*(1-0.35*min(max((t-7.05)/0.25\\,0)\\,1)*min(max((9.6-t)/0.3\\,0)\\,1))*(1-0.6*min(max((t-25.5)/0.25\\,0)\\,1)*min(max((27.2-t)/0.3\\,0)\\,1))*(1-0.35*min(max((t-27.6)/0.8\\,0)\\,1))':eval=frame,afade=t=in:d=0.06,afade=t=out:st={DUR - 0.12}:d=0.1[mus]")
af.append("[mus][key]sidechaincompress=threshold=0.012:ratio=14:attack=8:release=300:makeup=1[bed]")
af.append(f"[bed][vo]amix=inputs=2:normalize=0:weights=0.42 1.25,atrim=0:{DUR}[out]")
raw = os.path.join(out, "raw.wav")
run(["ffmpeg", "-v", "error", "-y", *ai, "-filter_complex", ";".join(af), "-map", "[out]", "-ac", "2", "-ar", "48000", raw])
I = None
for line in subprocess.run(["ffmpeg", "-nostats", "-i", raw, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr.splitlines():
    if line.strip().startswith("I:"): I = float(line.split()[1])
mix = os.path.join(out, "mix.wav")
run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", f"volume={-16 - I:.2f}dB,alimiter=limit=0.6:level=false:attack=1:release=40", "-ar", "48000", mix])

# 3. the files the page loads
m4 = os.path.join(out, "trailer.mp4")
run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(out, "master.mkv"), "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-b:v", "1900k", "-maxrate", "2800k", "-bufsize", "5600k", "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", str(DUR), m4])
run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(out, "master.mkv"), "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "libvpx-vp9", "-b:v", "1150k", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-c:a", "libopus", "-b:a", "96k", "-t", str(DUR), os.path.join(out, "trailer.webm")])
run(["ffmpeg", "-v", "error", "-y", "-ss", "27.0", "-i", os.path.join(out, "master.mkv"), "-frames:v", "1", "-q:v", "3", os.path.join(out, "trailer-poster.jpg")])
for x in ("trailer.mp4", "trailer.webm", "trailer-poster.jpg"): print(x, os.path.getsize(os.path.join(out, x)))
