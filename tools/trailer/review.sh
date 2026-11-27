#!/bin/bash
# One round of independent review of the trailer: review.sh <build dir> <round dir> [reviewers...]
# Makes the pack from the build (trailer.mp4 etc. in <build dir>) and asks fresh `claude -p` reviewers (a, b by
# default) to score it from review-brief.md. Replies land in <round dir>/<who>.json.
set -u
build=$1; out=$2; shift 2; who=${@:-a b}
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
pack=$out/pack; mkdir -p "$pack"
cp "$build"/trailer.mp4 "$build"/trailer.webm "$build"/trailer-poster.jpg "$root/tools/trailer/edit.json" "$pack/"
st="drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='%{pts\:gmtime\:0\:%M\\\\\:%S}.%{eif\:mod(t*10\,10)\:d}':x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.7"
ffmpeg -v error -y -i "$pack/trailer.mp4" -vf "fps=2,$st,scale=400:-1,tile=6x5" -frames:v 1 "$pack/sheet-a.jpg"
ffmpeg -v error -y -ss 15 -i "$pack/trailer.mp4" -vf "fps=2,setpts=PTS+15/TB,$st,scale=400:-1,tile=6x5" -frames:v 1 "$pack/sheet-b.jpg"
python3 - "$pack" <<'P'
import json, subprocess, sys
pk = sys.argv[1]; E = json.load(open(pk + "/edit.json"))
for cid, t0, t1 in E["captions"]:
    t = (t0 + t1) / 2
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", pk + "/trailer.mp4", "-frames:v", "1", "-q:v", "2", f"{pk}/full-{cid}-at-{t:.1f}s.jpg"], check=True)
P
{ ffmpeg -nostats -i "$pack/trailer.mp4" -map 0:a -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p'
  echo "loudness every half second (momentary, LUFS):"
  ffmpeg -nostats -i "$pack/trailer.mp4" -map 0:a -af ebur128 -f null - 2>&1 | grep -oE "t: *[0-9.]+ .*M: *-?[0-9.]+" | awk '{t=$2; m=$NF; k=int(t*2); if(!(k in s)){s[k]=1; printf "%5.1f s  %s\n", t, m}}'
} > "$pack/audio.txt"
ffmpeg -v error -i "$pack/trailer.mp4" -vf "fps=10,scale=160:90,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - 2>/dev/null |
  awk '/pts_time/{split($0,a,"pts_time:"); t=a[2]} /YAVG/{split($0,b,"="); k=int(t*2); s[k]+=b[2]; n[k]++} END{for(k=0;k<60;k++) if(n[k]) printf "%5.1f s  %.2f\n", k/2, s[k]/n[k]}' > "$pack/motion.txt"
cp "$build/voice.txt" "$pack/voice.txt" 2>/dev/null
one() {
  prompt="$(cat "$here/review-brief.md")

PACK = $pack"
  (cd "$pack" && timeout 1500 claude -p "$prompt" --allowedTools "Read,Grep,Glob,Bash" > "$out/$1.txt" 2> "$out/$1.err")
  python3 - "$out/$1.txt" "$out/$1.json" <<'P'
import json, re, sys
t = open(sys.argv[1]).read(); m = re.search(r"\{.*\}", t, re.S)
try: j = json.loads(m.group(0))
except Exception: j = {"error": "no JSON", "raw": t[-600:]}
json.dump(j, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(sys.argv[2].split("/")[-1], {k: j.get(k) for k in ("hook", "picture", "pacing", "sound", "words")})
P
}
for w in $who; do one "$w" & done; wait
echo REVIEW DONE
