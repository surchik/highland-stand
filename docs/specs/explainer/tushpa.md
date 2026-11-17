# Explainer video: Vale of Tushpa (735 BC)

Battlefield id `tushpa`. Files: `assets/explainer/tushpa/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 0.94 (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html, which were themselves checked against docs/history. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html (LEVELS[...].chronicle)
- `V / D`: the battlefield's victory / defeat epilogue in index.html
- `hero / tag`: the battlefield's hero and tag line in index.html
- `TA<n>.<k>`: docs/history/text-audit.json, entry n (0 Erebuni, 1 Tushpa, 2 Avarayr, 3 Dvin), claims[k]
- `ED<e>.<k>`: docs/history/era-dossier.json, eras[e] (0 Urartu, 1 Avarayr, 2 the Arab raids), claims[k]
- `TH.<k>`: docs/history/town-history.json, ages[0].core_claims[k]

## Landscape cut (117 words)

### Script (true spelling: this is the subtitle text)

Urartu, Biainili to its kings, ruled these highlands from Tushpa, by Lake Van. Its citadel crowned the Rock of Van, a long, narrow ridge that rises steeply from the plain.

By the middle of the eighth century BC, Sarduri II held the throne.

Then Tiglath-pileser III took the Assyrian throne. In 743 BC, by the Euphrates, he broke Sarduri and his allies.

Eight years later, in 735 BC, he marched into the heart of Biainili. His inscriptions say he shut Sarduri up in Tushpa and defeated him before the city gates.

Yet they do not claim that the citadel fell, and it did not.

Now Assyrian spears fill the vale below the rock.

Hold the royal road.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Urartu, Biainili to its kings, ruled these highlands from Tushpa, by Lake Van.
   - engine: `[[uːɹˈɑːɹtuː]], [[bˌiːaɪnˈiːliː]] to its kings, ruled these highlands from [[tˈuːʃpɑː]], by Lake Van.`
   - sources: C1 (first sentence); TA1.1; TA1.3
2. Its citadel crowned the Rock of Van, a long, narrow ridge that rises steeply from the plain.
   - engine: `Its citadel crowned the Rock of Van, a long, narrow ridge that rises steeply from the plain.`
   - sources: C1 (second sentence); TA1.3
3. By the middle of the eighth century BC, Sarduri II held the throne.
   - engine: `By the middle of the eighth century B C, [[sɑːɹdˈuːɹi]] the Second held the throne.`
   - sources: C1 (last sentence); C2 (first sentence); ED0.38; ED0.39
4. Then Tiglath-pileser III took the Assyrian throne.
   - engine: `Then [[tˌɪɡlæθpɪlˈiːzɚ]] the Third took the Assyrian throne.`
   - sources: C2 (second sentence)
5. In 743 BC, by the Euphrates, he broke Sarduri and his allies.
   - engine: `In seven forty-three B C, by the Euphrates, he broke [[sɑːɹdˈuːɹi]] and his allies.`
   - sources: C2 (fourth sentence); ED0.2
6. Eight years later, in 735 BC, he marched into the heart of Biainili.
   - engine: `Eight years later, in seven thirty-five B C, he marched into the heart of [[bˌiːaɪnˈiːliː]].`
   - sources: C3 (first sentence); ED0.4; TA1.8
7. His inscriptions say he shut Sarduri up in Tushpa and defeated him before the city gates.
   - engine: `His inscriptions say he shut [[sɑːɹdˈuːɹi]] up in [[tˈuːʃpɑː]] and defeated him before the city gates.`
   - sources: C3 (second sentence); ED0.7; TA1.8
8. Yet they do not claim that the citadel fell, and it did not.
   - engine: `Yet they do not claim that the citadel fell, and it did not.`
   - sources: C3 (last sentence); V; TA1.8; ED0.8
9. Now Assyrian spears fill the vale below the rock.
   - engine: `Now Assyrian spears fill the vale below the rock.`
   - sources: C4 (Now, in 735 BC, ... Assyrian spears fill the vale below the rock)
10. Hold the royal road.
   - engine: `Hold the royal road.`
   - sources: C4 (Hold the royal road); tag; TA1.9; TA1.11

## Vertical cut (66 words)

### Script (true spelling: this is the subtitle text)

Tushpa, by Lake Van, was the capital of Urartu. Its citadel crowned the Rock of Van.

In 735 BC the Assyrian king Tiglath-pileser III marched into the heart of the kingdom. His inscriptions say he shut King Sarduri II up in Tushpa and defeated him before the city gates.

Yet they do not claim that the citadel fell, and it did not.

Hold the royal road.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Tushpa, by Lake Van, was the capital of Urartu.
   - engine: `[[tˈuːʃpɑː]], by Lake Van, was the capital of [[uːɹˈɑːɹtuː]].`
   - sources: C1 (Urartu ... ruled these highlands from Tushpa, by Lake Van; Sarduri I, who made Tushpa his capital); TA1.0
2. Its citadel crowned the Rock of Van.
   - engine: `Its citadel crowned the Rock of Van.`
   - sources: C1 (second sentence); TA1.3
3. In 735 BC the Assyrian king Tiglath-pileser III marched into the heart of the kingdom.
   - engine: `In seven thirty-five B C the Assyrian king [[tˌɪɡlæθpɪlˈiːzɚ]] the Third marched into the heart of the kingdom.`
   - sources: C3 (first sentence); C2 (Tiglath-pileser III took the Assyrian throne); ED0.4
4. His inscriptions say he shut King Sarduri II up in Tushpa and defeated him before the city gates.
   - engine: `His inscriptions say he shut King [[sɑːɹdˈuːɹi]] the Second up in [[tˈuːʃpɑː]] and defeated him before the city gates.`
   - sources: C3 (second sentence); hero (Sarduri II, King of Urartu); ED0.7; TA1.8
5. Yet they do not claim that the citadel fell, and it did not.
   - engine: `Yet they do not claim that the citadel fell, and it did not.`
   - sources: C3 (last sentence); V; TA1.8
6. Hold the royal road.
   - engine: `Hold the royal road.`
   - sources: C4; tag

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Urartu | `uːɹˈɑːɹtuː` | oo-RAR-too |
| Tushpa | `tˈuːʃpɑː` | TOOSH-pah |
| Biainili | `bˌiːaɪnˈiːliː` | bee-eye-NEE-lee. A recognizer that has never met the name writes 'Biaineli': the same sounds. |
| Sarduri | `sɑːɹdˈuːɹi` | sar-DOO-ree |
| Tiglath-pileser | `tˌɪɡlæθpɪlˈiːzɚ` | TIG-lath-pih-LEE-zer |
