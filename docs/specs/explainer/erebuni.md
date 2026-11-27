# Explainer video: Erebuni Rise (782 BC)

Battlefield id `erebuni`. Files: `assets/explainer/erebuni/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 0.94 (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html, which were themselves checked against docs/history. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html (LEVELS[...].chronicle)
- `V / D`: the battlefield's victory / defeat epilogue in index.html
- `hero / tag`: the battlefield's hero and tag line in index.html
- `TA<n>.<k>`: docs/history/text-audit.json, entry n (0 Erebuni, 1 Tushpa, 2 Avarayr, 3 Dvin), claims[k]
- `ED<e>.<k>`: docs/history/era-dossier.json, eras[e] (0 Urartu, 1 Avarayr, 2 the Arab raids), claims[k]
- `TH.<k>`: docs/history/town-history.json, ages[0].core_claims[k]

## Landscape cut (119 words)

### Script (true spelling: this is the subtitle text)

In the eighth century BC, the kings of Urartu ruled the highlands around Lake Van from their rock citadel at Tushpa. They called their land Biainili.

Under Argishti I, son of Menua, the kingdom stood near the height of its power. He pushed north of the Araxes.

There, in 782 BC, he raised a new fortress on the hill of Arin Berd, and named it Erebuni.

His founding inscription, cut in cuneiform, was found on the hill in 1950.

Argishti also fought Assyria, but those wars were fought far from Erebuni. From its walls, Urartu's kings struck north toward Lake Sevan.

Yet the name lives on in Yerevan, which counts its birth from Argishti's stone.

Defend the young city.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In the eighth century BC, the kings of Urartu ruled the highlands around Lake Van from their rock citadel at Tushpa.
   - engine: `In the eighth century B C, the kings of [[uːɹˈɑːɹtuː]] ruled the highlands around Lake Van from their rock citadel at [[tˈuːʃpɑː]].`
   - sources: C1 (first sentence); TA1.0
2. They called their land Biainili.
   - engine: `They called their land [[bjˌaɪnˈiːli]].`
   - sources: C1 (second sentence); TH.1; TA1.1
3. Under Argishti I, son of Menua, the kingdom stood near the height of its power.
   - engine: `Under [[ɑːɹɡˈɪʃti]] the First, son of [[mɛnˈuːɑː]], the kingdom stood near the height of its power.`
   - sources: C1 (third sentence); TA0.1
4. He pushed north of the Araxes.
   - engine: `He pushed north of the [[ɑːɹˈæksiːz]].`
   - sources: C1 (fourth sentence: he pushed further than the kings before him into the lands north of the Araxes)
5. There, in 782 BC, he raised a new fortress on the hill of Arin Berd, and named it Erebuni.
   - engine: `There, in seven eighty-two B C, he raised a new fortress on the hill of [[ɑːɹˈiːn bˈɛɹd]], and named it [[ˌɛɹˌɛbuːnˈiː]].`
   - sources: C1 (fifth sentence); tag (the newborn fortress of Argishti on Arin Berd); TA0.0; TA0.1; TH.0
6. His founding inscription, cut in cuneiform, was found on the hill in 1950.
   - engine: `His founding inscription, cut in [[kjuːnˈiːɪfˌɔːɹm]], was found on the hill in nineteen fifty.`
   - sources: C2 (first two sentences); TA0.3
7. Argishti also fought Assyria, but those wars were fought far from Erebuni.
   - engine: `[[ɑːɹɡˈɪʃti]] also fought Assyria, but those wars were fought far from [[ˌɛɹˌɛbuːnˈiː]].`
   - sources: C4 (first three sentences); TA0.6
8. From its walls, Urartu's kings struck north toward Lake Sevan.
   - engine: `From its walls, [[uːɹˈɑːɹtuːz]] kings struck north toward Lake [[sɛvˈɑːn]].`
   - sources: V (from its walls Urartu's kings struck north toward Etiuni and Lake Sevan); C3 (from Erebuni he struck north toward Etiuni and Lake Sevan; Sarduri II and Rusa I set out from it to conquer lands to the north); TA0.6
9. Yet the name lives on in Yerevan, which counts its birth from Argishti's stone.
   - engine: `Yet the name lives on in [[jˌɛɹɛvˈɑːn]], which counts its birth from [[ɑːɹɡˈɪʃtiz]] stone.`
   - sources: C4 (Yet the name lives on in Yerevan, which counts its birth from Argishti's stone); V; TA0.4
10. Defend the young city.
   - engine: `Defend the young city.`
   - sources: C4 (Defend the young city)

## Vertical cut (55 words)

### Script (true spelling: this is the subtitle text)

In 782 BC, Argishti I, king of Urartu, raised a new fortress on the hill of Arin Berd. He named it Erebuni.

His founding inscription, cut in cuneiform, still tells the story.

From its walls, the kings of Urartu struck north toward Lake Sevan.

Yet the name lives on in Yerevan.

Defend the young city.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 782 BC, Argishti I, king of Urartu, raised a new fortress on the hill of Arin Berd.
   - engine: `In seven eighty-two B C, [[ɑːɹɡˈɪʃti]] the First, king of [[uːɹˈɑːɹtuː]], raised a new fortress on the hill of [[ɑːɹˈiːn bˈɛɹd]].`
   - sources: C1 (fourth and fifth sentences); hero (Argishti I, King of Urartu); TA0.0; TA0.1; TH.0
2. He named it Erebuni.
   - engine: `He named it [[ˌɛɹˌɛbuːnˈiː]].`
   - sources: C1 (and named it Erebuni); C2 (Argishti built the fortress and named it Erebuni); TA0.1
3. His founding inscription, cut in cuneiform, still tells the story.
   - engine: `His founding inscription, cut in [[kjuːnˈiːɪfˌɔːɹm]], still tells the story.`
   - sources: C2 (first sentence); TA0.3
4. From its walls, the kings of Urartu struck north toward Lake Sevan.
   - engine: `From its walls, the kings of [[uːɹˈɑːɹtuː]] struck north toward Lake [[sɛvˈɑːn]].`
   - sources: V (from its walls Urartu's kings struck north toward Etiuni and Lake Sevan); C3 (from Erebuni he struck north toward Etiuni and Lake Sevan); TA0.6
5. Yet the name lives on in Yerevan.
   - engine: `Yet the name lives on in [[jˌɛɹɛvˈɑːn]].`
   - sources: C4 (Yet the name lives on in Yerevan, which counts its birth from Argishti's stone); V; TA0.4
6. Defend the young city.
   - engine: `Defend the young city.`
   - sources: C4

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Urartu | `uːɹˈɑːɹtuː` | oo-RAR-too |
| Tushpa | `tˈuːʃpɑː` | TOOSH-pah |
| Biainili | `bjˌaɪnˈiːli` | byai-NEE-lee. The first two vowels run together. Said as bee-eye-NEE-lee, a recognizer wrote the letters 'B.I. Neeley'; this way it writes 'Biainiili' (the same sounds). |
| Argishti | `ɑːɹɡˈɪʃti` | ar-GISH-tee |
| Menua | `mɛnˈuːɑː` | meh-NOO-ah |
| Araxes | `ɑːɹˈæksiːz` | ah-RAK-seez |
| Arin Berd | `ɑːɹˈiːn bˈɛɹd` | ah-REEN BERD. Berd has the short e of 'bed' before the r. A recognizer writes that sound with the English spelling 'Baird'; said as 'bird' it would be spelled right and sound wrong. |
| Erebuni | `ˌɛɹˌɛbuːnˈiː` | eh-reh-boo-NEE. The stress on the last syllable, as Armenian puts it. Said with the stress on BOO, a recognizer heard the short sentence 'He named it Erebuni' as 'Arabuni'; this way it writes 'Ereboni' (the same sounds) wherever the name falls. |
| Yerevan | `jˌɛɹɛvˈɑːn` | yeh-reh-VAHN |
| cuneiform | `kjuːnˈiːɪfˌɔːɹm` | kyoo-NEE-i-form (an English word the engines' dictionary gets wrong) |
| Sevan | `sɛvˈɑːn` | seh-VAHN |
