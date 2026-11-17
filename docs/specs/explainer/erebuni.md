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

## Landscape cut (127 words)

### Script (true spelling: this is the subtitle text)

In the eighth century BC, the kings of Urartu ruled the highlands around Lake Van from their rock citadel at Tushpa. They called their land Biainili.

Under Argishti I, son of Menua, the kingdom stood near the height of its power. He pushed north of the Araxes.

There, in 782 BC by the date most often given, he raised a new fortress on the hill of Arin Berd, and named it Erebuni.

His founding inscription, cut in cuneiform, was found on the hill in 1950.

Argishti also fought Assyria, but those wars were fought far from Erebuni. No siege of it is recorded: the march you are about to face is an invention of the game.

Yet the name lives on in Yerevan.

Defend the young city.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In the eighth century BC, the kings of Urartu ruled the highlands around Lake Van from their rock citadel at Tushpa.
   - engine: `In the eighth century B C, the kings of [[uːɹˈɑːɹtuː]] ruled the highlands around Lake Van from their rock citadel at [[tˈuːʃpɑː]].`
   - sources: C1 (first sentence); TA1.0
2. They called their land Biainili.
   - engine: `They called their land [[bˌiːaɪnˈiːli]].`
   - sources: C1 (second sentence); TH.1; TA1.1
3. Under Argishti I, son of Menua, the kingdom stood near the height of its power.
   - engine: `Under [[ɑːɹɡˈɪʃti]] the First, son of [[mɛnˈuːɑː]], the kingdom stood near the height of its power.`
   - sources: C1 (third sentence); TA0.1
4. He pushed north of the Araxes.
   - engine: `He pushed north of the [[ɐɹˈæksiːz]].`
   - sources: C1 (fourth sentence: he pushed further than the kings before him into the lands north of the Araxes)
5. There, in 782 BC by the date most often given, he raised a new fortress on the hill of Arin Berd, and named it Erebuni.
   - engine: `There, in seven eighty-two B C by the date most often given, he raised a new fortress on the hill of [[ɑːɹˈiːn bˈɛɹd]], and named it [[ˌɛɹɛbˈuːni]].`
   - sources: C1 (fifth sentence); TA0.0; TA0.1; TH.0
6. His founding inscription, cut in cuneiform, was found on the hill in 1950.
   - engine: `His founding inscription, cut in [[kjuːnˈiːɪfˌɔːɹm]], was found on the hill in nineteen fifty.`
   - sources: C2 (first two sentences); TA0.3
7. Argishti also fought Assyria, but those wars were fought far from Erebuni.
   - engine: `[[ɑːɹɡˈɪʃti]] also fought Assyria, but those wars were fought far from [[ˌɛɹɛbˈuːni]].`
   - sources: C4 (first three sentences); TA0.6
8. No siege of it is recorded: the march you are about to face is an invention of the game.
   - engine: `No siege of it is recorded: the march you are about to face is an invention of the game.`
   - sources: C4 (third sentence: no siege of it is recorded: the turtan's march here is the game's invention); V; D; TA0.6
9. Yet the name lives on in Yerevan.
   - engine: `Yet the name lives on in [[jˌɛɹɛvˈɑːn]].`
   - sources: C4 (Yet the name lives on in Yerevan); V; TA0.4
10. Defend the young city.
   - engine: `Defend the young city.`
   - sources: C4 (Defend the young city)

## Vertical cut (64 words)

### Script (true spelling: this is the subtitle text)

In 782 BC, by the date most often given, Argishti I, king of Urartu, raised a new fortress on the hill of Arin Berd. He named it Erebuni.

His founding inscription, cut in cuneiform, still tells the story.

No siege of Erebuni is recorded: the battle ahead is an invention of the game.

Yet the name lives on in Yerevan.

Defend the young city.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 782 BC, by the date most often given, Argishti I, king of Urartu, raised a new fortress on the hill of Arin Berd.
   - engine: `In seven eighty-two B C, by the date most often given, [[ɑːɹɡˈɪʃti]] the First, king of [[uːɹˈɑːɹtuː]], raised a new fortress on the hill of [[ɑːɹˈiːn bˈɛɹd]].`
   - sources: C1 (fourth and fifth sentences); hero (Argishti I, King of Urartu); TA0.0; TA0.1; TH.0
2. He named it Erebuni.
   - engine: `He named it [[ˌɛɹɛbˈuːni]].`
   - sources: C1 (and named it Erebuni); C2 (Argishti built the fortress and named it Erebuni); TA0.1
3. His founding inscription, cut in cuneiform, still tells the story.
   - engine: `His founding inscription, cut in [[kjuːnˈiːɪfˌɔːɹm]], still tells the story.`
   - sources: C2 (first sentence); TA0.3
4. No siege of Erebuni is recorded: the battle ahead is an invention of the game.
   - engine: `No siege of [[ˌɛɹɛbˈuːni]] is recorded: the battle ahead is an invention of the game.`
   - sources: C4 (third sentence); V; D; TA0.6
5. Yet the name lives on in Yerevan.
   - engine: `Yet the name lives on in [[jˌɛɹɛvˈɑːn]].`
   - sources: C4; V; TA0.4
6. Defend the young city.
   - engine: `Defend the young city.`
   - sources: C4

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Urartu | `uːɹˈɑːɹtuː` | oo-RAR-too |
| Tushpa | `tˈuːʃpɑː` | TOOSH-pah |
| Biainili | `bˌiːaɪnˈiːli` | bee-eye-NEE-lee. A recognizer that has never met the name writes 'Biaineli': the same sounds. |
| Argishti | `ɑːɹɡˈɪʃti` | ar-GISH-tee |
| Menua | `mɛnˈuːɑː` | meh-NOO-ah |
| Araxes | `ɐɹˈæksiːz` | uh-RAK-seez |
| Arin Berd | `ɑːɹˈiːn bˈɛɹd` | ah-REEN BERD. Berd has the short e of 'bed' before the r. A recognizer writes that sound with the English spelling 'Baird'; said as 'bird' it would be spelled right and sound wrong. |
| Erebuni | `ˌɛɹɛbˈuːni` | eh-reh-BOO-nee |
| Yerevan | `jˌɛɹɛvˈɑːn` | yeh-reh-VAHN |
| cuneiform | `kjuːnˈiːɪfˌɔːɹm` | kyoo-NEE-i-form (an English word the engines' dictionary gets wrong) |
