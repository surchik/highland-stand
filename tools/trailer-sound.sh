#!/usr/bin/env bash
# The trailer's soundtrack (stage 6, the owner's request "the video playing should have audio"): a music bed cut from
# one of the owner's recordings (assets/music/sheyk-sar.mp3, its first half minute: a quiet opening that builds to the
# full band as the title comes) under a short English voice-over read by Kokoro (Kokoro-82M, an open, local
# text-to-speech under the Apache-2.0 licence, through kokoro-onnx; the voice am_michael), the music ducked under the voice, the whole mix moved to -16 LUFS, muxed into trailer.mp4 (AAC
# 128 kbit/s) and trailer.webm (Opus 96 kbit/s) with the pictures copied as they are.
#
#   PY=/path/to/python KOKORO=/path/to/models bash tools/trailer-sound.sh [--out=DIR] [--voice=am_michael]
#
# PY: a python with kokoro-onnx and soundfile (pip install kokoro-onnx soundfile); KOKORO: a folder holding
# kokoro-v1.0.onnx and voices-v1.0.bin (github.com/thewh1teagle/kokoro-onnx, release model-files-v1.0); the line is
# read by tools/tts-kokoro.py. --out: where the two videos are written (default: the repository's
# root, in place of the files there). Needs ffmpeg. The lines and their times are below; docs/specs/owner-requests-stage6.md
# keeps them for the owner.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT"; VOICE="am_michael"
for a in "$@"; do case "$a" in --out=*) OUT="${a#--out=}";; --voice=*) VOICE="${a#--voice=}";; *) echo "unknown option $a" >&2; exit 2;; esac; done
PY="${PY:-python3}"; KOKORO="${KOKORO:-.}"
command -v ffmpeg > /dev/null || { echo "ffmpeg is needed" >&2; exit 2; }
[ -f "$KOKORO/kokoro-v1.0.onnx" ] && [ -f "$KOKORO/voices-v1.0.bin" ] || { echo "no Kokoro model in $KOKORO" >&2; exit 2; }
T="$(mktemp -d)"; trap 'rm -r -- "$T"' EXIT

# the four lines, each with the second it begins at (the captions they meet: "17 battlefields. 5 eras." at 6 s,
# "Every wave counts." at 17 s, the title at 26 s)
LINES=(
  "0.4|From Erebuni to Artsakh, for twenty-eight centuries, Armenians have held these highlands."
  "6.4|Seventeen battlefields. Five eras. Raise your towers on the mountain roads."
  "17.0|Every wave counts. Hold the line."
  "26.4|Highland Stand. Hold the highlands."
)
inputs=(); filters=""; n=0
for l in "${LINES[@]}"; do
  at="${l%%|*}"; text="${l#*|}"
  printf '%s\n' "$text" | "$PY" "$ROOT/tools/tts-kokoro.py" "$KOKORO" "$VOICE" 1.0 "$T/vo$n.wav" > /dev/null 2>&1
  ms=$(awk -v s="$at" 'BEGIN { printf "%d", s * 1000 }')
  inputs+=(-i "$T/vo$n.wav")
  filters+="[$n:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms}:all=1[v$n];"
  n=$((n + 1))
done
# the voice: the four lines on one track, its rumble taken off, a gentle compressor, a touch of the hall
filters+="$(for i in $(seq 0 $((n - 1))); do printf '[v%d]' "$i"; done)amix=inputs=$n:normalize=0,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,aecho=0.8:0.5:40:0.12,apad=whole_dur=30,atrim=0:30,asplit=2[vo][key];"
# the music: Sheyk Sar from 1 s to 31 s, in over half a second, out over the last 1.6 s, ducked under the voice
filters+="[$n:a]atrim=1:31,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.5,afade=t=out:st=28.4:d=1.6[mus];"
filters+="[mus][key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=450:makeup=1[bed];"
filters+="[bed][vo]amix=inputs=2:normalize=0:weights=0.55 1,atrim=0:30[out]"
ffmpeg -v error -y "${inputs[@]}" -i "$ROOT/assets/music/sheyk-sar.mp3" -filter_complex "$filters" -map "[out]" -ac 2 -ar 48000 "$T/raw.wav"
# the whole mix moved as one to -16 LUFS (a linear gain, so the music's build and the voice's place in it stay as
# mixed), a limiter keeping its peaks under -1.5 dB
I=$(ffmpeg -nostats -i "$T/raw.wav" -af ebur128 -f null - 2>&1 | awk '/^ +I:/ { v = $2 } END { print v }')
ffmpeg -v error -y -i "$T/raw.wav" -af "volume=$(awk -v i="$I" 'BEGIN { printf "%.2f", -16 - i }')dB,alimiter=limit=0.84:level=false" -ar 48000 "$T/mix.wav"

# the pictures: the trailer's own video streams, copied (any sound they have already is left out, so a second run
# gives the same files)
cp "$ROOT/trailer.mp4" "$T/silent.mp4"; cp "$ROOT/trailer.webm" "$T/silent.webm"
mkdir -p "$OUT"
ffmpeg -v error -y -i "$T/silent.mp4" -i "$T/mix.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -ac 2 -shortest -movflags +faststart "$OUT/trailer.mp4"
ffmpeg -v error -y -i "$T/silent.webm" -i "$T/mix.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a libopus -b:a 96k -ac 2 -shortest "$OUT/trailer.webm"
for f in trailer.mp4 trailer.webm; do
  printf '%s: %s bytes, ' "$f" "$(stat -c %s "$OUT/$f")"
  ffmpeg -nostats -i "$OUT/$f" -map 0:a -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I|Peak):' | tr -s ' ' | tr '\n' ' '
  echo
done
