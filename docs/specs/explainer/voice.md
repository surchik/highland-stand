# The narrator's voice (stage 5)

## The pick

**Kokoro-82M, voice `am_michael`, speed 0.92** (through kokoro-onnx 0.6.1; model files kokoro-v1.0.onnx and voices-v1.0.bin).

Licence: Kokoro-82M and its voices are published under Apache-2.0 (huggingface.co/hexgrad/Kokoro-82M: "Apache-licensed
weights ... can be deployed anywhere from production environments to personal projects"). Apache-2.0 allows commercial use
of the model and puts no claim on the audio it produces. kokoro-onnx is MIT. The phonemizer behind it (espeak-ng, GPL-3.0)
is a tool run in the build sandbox; nothing of it ships with the game.

Why this one. Nobody in the build could listen, so the choice rests on what can be measured, and the owner should check it
by ear with the three samples in voice-samples/ (the first 18 seconds of the Erebuni landscape script by the three best):

- A speech recognizer (faster-whisper, model medium.en, no prompt) wrote back the Erebuni script from am_michael with
  2.0% of words wrong, 0.8% once the names are set aside, and wrote 9 of the 11 names letter for letter (Argishti, Menua,
  Araxes, Erebuni, Haldi, Tushpa, Yerevan among them). After the audition the first vowel of Urartu was lengthened, the
  one name it had misheard in one of two places.
- It needs the least slowing of the low voices to reach a documentary pace: 0.92 gives 144 words a minute with pauses.
  am_fenrir and am_onyx had to be slowed to 0.83 and 0.80, where a synthetic voice starts to drag.
- Its median pitch is 115 Hz, a low and warm male voice, with a moderate rise and fall (5 semitones between the quarter
  marks): calmer than am_fenrir and bm_fable (7), livelier than am_onyx (2, close to a monotone).
- Kokoro's own notes on its voices (VOICES.md) grade am_michael and am_fenrir highest of the English male voices for
  training data and quality (C+), above bm_fable and bm_george (C), bm_lewis (D+) and am_onyx (D).
- It is an American voice, and the names are handed to the engine as American-style IPA; the British voices read the same
  IPA with a little less agreement (bm_george 94% on names).

Runners-up, kept as samples: `bm_fable` (British, every plain word right, 122 Hz) and `am_fenrir` (best on names, a
higher and more animated voice).

## The audition

One script (Erebuni, landscape, 141 words) read by twelve voices. Each was first read at speed 1, then at the speed that
brings it nearest 140 words a minute (within 0.80 to 1.25), set to -16 LUFS with a true peak of at most -1.5 dB, and
measured (tools/explainer/audition.py and measure.py). Full numbers and transcripts: voice-audition.json.

| Voice | Speed set | Words a minute | Word error rate | Without names | Names heard right | LUFS | True peak dB | Clipped samples | Median pitch Hz | Pitch spread (semitones) |
|---|---|---|---|---|---|---|---|---|---|---|
| kokoro:am_michael | 0.92 | 144 | 2.0% | 0.8% | 97% | -16.9 | -1.5 | 0 | 115.5 | 4.94 |
| kokoro:am_fenrir | 0.83 | 144 | 1.4% | 0.8% | 98% | -16.6 | -1.5 | 0 | 136.8 | 7.44 |
| kokoro:bm_george | 0.96 | 142 | 2.7% | 0.8% | 94% | -16.1 | -1.5 | 0 | 141.6 | 3.63 |
| kokoro:bm_fable | 0.89 | 145 | 2.0% | 0.0% | 97% | -17.1 | -1.5 | 0 | 121.7 | 6.7 |
| kokoro:am_onyx | 0.80 | 142 | 2.7% | 1.5% | 97% | -17.2 | -1.5 | 0 | 87.0 | 2.27 |
| kokoro:bm_lewis | 0.91 | 143 | 2.0% | 0.8% | 97% | -17.2 | -1.5 | 0 | 97.0 | 6.8 |
| kokoro:am_eric | 0.80 | 154 | 2.7% | 0.8% | 96% | -16.0 | -1.5 | 0 | 155.3 | 5.03 |
| piper:en_US-joe-medium | 0.80 | 170 | 10.9% | 6.8% | 80% | -17.0 | -1.5 | 0 | 91.4 | 4.26 |
| piper:en_US-norman-medium | 0.80 | 165 | 14.3% | 12.0% | 67% | -16.8 | -1.5 | 0 | 103.2 | 4.42 |
| piper:en_US-john-medium | 0.90 | 148 | 14.3% | 9.8% | 80% | -16.1 | -1.5 | 0 | 120.3 | 3.86 |
| piper:en_US-bryce-medium | 1.01 | 141 | 8.8% | 6.1% | 82% | -16.3 | -1.5 | 0 | 131.1 | 3.6 |
| piper:en_GB-northern_english_male-medium | 0.80 | 180 | 8.8% | 3.8% | 83% | -16.8 | -1.5 | 0 | 109.6 | 2.74 |

Reading the table: "Names heard right" is, for each name in the script, how many of its letters the recognizer wrote
(100% is the name spelled exactly); a recognizer that has never seen "Biainili" writing "Biaineli" counts as 88%. Pitch
spread is the distance between the 25th and 75th percentile of the voice's pitch.

The Piper voices (piper-tts 1.8.0) fell short on every measure that matters here: 9% to 14% of words wrong, the names
least of all, and three of the five too fast even at the slowest setting allowed.

## Licences checked

| Voice | Licence of the voice | Usable here |
|---|---|---|
| Kokoro-82M (all voices above) | Apache-2.0 | yes |
| Piper en_US-joe-medium | dataset CC0 | yes |
| Piper en_US-norman-medium, en_US-john-medium, en_US-bryce-medium | dataset public domain (LibriVox) | yes |
| Piper en_GB-northern_english_male-medium | dataset CC BY-SA 4.0 | yes, with credit |
| Piper en_US-ryan-high | dataset CC BY-NC-SA 4.0 | no (non-commercial): not auditioned |
| Piper en_US-hfc_male-medium | dataset CC BY-NC-SA 4.0 | no (non-commercial): not auditioned |
| Piper en_US-lessac-high | Blizzard 2013 research licence | no: not auditioned |
| Piper en_GB-alan-medium | model card gives no licence | no: not auditioned |

(The Piper licences are those stated in each voice's MODEL_CARD at huggingface.co/rhasspy/piper-voices. piper-tts itself
is GPL-3.0, which covers the program, not the audio.)

## How the names are said

The engines guess Armenian and Urartian names badly from their spelling ("Argishti" comes out "Arjishti", "Erebuni"
"Iribuni"), and get two English words wrong as well (cuneiform, Zoroastrianism). So every such word is handed to the
engine as IPA from one table (tools/explainer/scripts.json, "lexicon"), and numbers are spelled out ("782 BC" is read
"seven eighty-two B C"). The subtitles keep the true spelling. Each battlefield's page here lists its names, the IPA and a
rough respelling.
