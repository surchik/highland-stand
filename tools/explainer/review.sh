#!/bin/bash
# One round of independent review: review.sh <round> <work dir> <review dir> [cut ...]
# For each cut it makes the review pack (review-pack.sh) and asks two fresh reviewers (new `claude -p` sessions that
# have seen nothing of the making) to score it from review-brief.md. Their replies land in
# <review dir>/round-<n>/<cut>.<reviewer>.json. Reviewers run in a copy of the pack, outside the repository.
set -u
round=$1; work=$2; rdir=$3; shift 3
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
cuts=${@:-erebuni-landscape erebuni-vertical tushpa-landscape tushpa-vertical avarayr-landscape avarayr-vertical dvin-landscape dvin-vertical}
out=$rdir/round-$round; mkdir -p "$out"
one() {
  cut=$1; who=$2; pack=$out/pack-$cut
  prompt="$(cat "$here/review-brief.md")

PACK = $pack
REPO = $root
The cut under review: $cut (battlefield id ${cut%-*}, ${cut#*-} cut)."
  (cd "$pack" && timeout 1500 claude -p "$prompt" --allowedTools "Read,Grep,Glob,Bash" --add-dir "$root" > "$out/$cut.$who.txt" 2> "$out/$cut.$who.err")
  python3 - "$out/$cut.$who.txt" "$out/$cut.$who.json" <<'P'
import json, re, sys
t = open(sys.argv[1]).read()
m = re.search(r"\{.*\}", t, re.S)
try: j = json.loads(m.group(0))
except Exception as e: j = {"error": "no JSON in the reply", "raw": t[-600:]}
json.dump(j, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(sys.argv[2].split("/")[-1], {k: j.get(k) for k in ("history", "pacing", "picture", "sound", "subtitles")} if "error" not in j else j["error"])
P
}
for cut in $cuts; do bash "$here/review-pack.sh" "$cut" "$work" "$out/pack-$cut" > /dev/null || echo "pack failed: $cut"; done
set -- $cuts
while [ $# -gt 0 ]; do
  one "$1" a & one "$1" b &
  if [ $# -gt 1 ]; then one "$2" a & one "$2" b & fi
  wait; shift; [ $# -gt 0 ] && shift
done
echo REVIEW DONE
