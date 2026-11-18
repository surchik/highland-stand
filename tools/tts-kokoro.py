# One line of speech by Kokoro (Kokoro-82M, Apache-2.0, through kokoro-onnx): tools/trailer-sound.sh's voice.
#   python tools/tts-kokoro.py <folder with kokoro-v1.0.onnx and voices-v1.0.bin> <voice> <speed> <out.wav> [lang] < text
# (pip install kokoro-onnx soundfile; the two model files from github.com/thewh1teagle/kokoro-onnx, release
# model-files-v1.0). Prints the line's length in seconds.
import sys
import soundfile as sf
from kokoro_onnx import Kokoro

k = Kokoro(sys.argv[1] + "/kokoro-v1.0.onnx", sys.argv[1] + "/voices-v1.0.bin")
voice, speed, out = sys.argv[2], float(sys.argv[3]), sys.argv[4]
lang = sys.argv[5] if len(sys.argv) > 5 else ("en-gb" if voice.startswith("b") else "en-us")
samples, sr = k.create(sys.stdin.read().strip(), voice=voice, speed=speed, lang=lang)
sf.write(out, samples, sr)
print(round(len(samples) / sr, 2))
