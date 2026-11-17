#!/bin/bash
# Makes the review pack of one cut: review-pack.sh <cut> <work dir> <pack dir>   (see review-brief.md)
set -eu
cut=$1; work=$2; pack=$3; here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
field=${cut%-*}; shape=${cut#*-}
rm -rf "$pack"; mkdir -p "$pack"
cp "$root/assets/explainer/$field/$shape.mp4" "$pack/cut.mp4"
cp "$root/assets/explainer/$field/$shape.vtt" "$pack/cut.vtt"
cp "$root/docs/specs/explainer/$field.md" "$pack/script.md"
cp "$work/$cut.qc.json" "$pack/qc.json"
cp "$work/$cut.mkv.scenes.json" "$pack/scenes.json"
python3 -c "import json,sys; j=json.load(open(sys.argv[1])); json.dump([{k:s[k] for k in ('i','start','end','text')} for s in j['sentences']], open(sys.argv[2],'w'), ensure_ascii=False, indent=1)" "$work/$cut.narr.wav.json" "$pack/sentences.json"
if [ "$shape" = landscape ]; then sw=480; tile=4x4; per=16; else sw=270; tile=6x2; per=12; fi
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$pack/cut.mp4")
n=$(python3 -c "import math; print(math.ceil($dur/2/$per))")
for k in $(seq 0 $((n-1))); do
  ffmpeg -y -hide_banner -loglevel error -ss $((k*per*2)) -i "$pack/cut.mp4" -vf "fps=1/2,scale=$sw:-1,drawtext=text='%{pts\:hms}':x=6:y=h-22:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6,tile=$tile" -frames:v 1 -q:v 3 "$pack/sheet-$((k+1)).jpg"
done
# full frames: the title, the middle of every plaque, the closing card
python3 - "$pack" <<'P'
import json, subprocess, sys
pack = sys.argv[1]; sc = json.load(open(pack + "/scenes.json"))
times = [2.6] + [round((o["t0"] + o["t1"]) / 2, 2) for o in sc["overlays"] if o["kind"] == "chip"] + [round(sc["dur"] - 0.6, 2)]
for i, t in enumerate(times):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(t), "-i", pack + "/cut.mp4", "-frames:v", "1", "-q:v", "3", "%s/full-%02d-at-%05.1fs.jpg" % (pack, i + 1, t)], check=True)
P
# the subtitle preview: the cue drawn as the page will draw it
node "$here/subs-preview.js" "$pack/cut.mp4" "$pack/cut.vtt" "$pack" 5
echo "pack: $pack"
