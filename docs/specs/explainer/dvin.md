# Explainer video: Dvin Gates (640 AD)

Battlefield id `dvin`. Files: `assets/explainer/dvin/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 0.92 (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html, which were themselves checked against docs/history. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html (LEVELS[...].chronicle)
- `V / D`: the battlefield's victory / defeat epilogue in index.html
- `hero / tag`: the battlefield's hero and tag line in index.html
- `TA<n>.<k>`: docs/history/text-audit.json, entry n (0 Erebuni, 1 Tushpa, 2 Avarayr, 3 Dvin), claims[k]
- `ED<e>.<k>`: docs/history/era-dossier.json, eras[e] (0 Urartu, 1 Avarayr, 2 the Arab raids), claims[k]
- `TH.<k>`: docs/history/town-history.json, ages[0].core_claims[k]

## Landscape cut (134 words)

### Script (true spelling: this is the subtitle text)

Dvin stood on the plain of Ayrarat, about thirty-five kilometers south of modern Yerevan. By the sixth century it was the seat of the catholicos, head of the Armenian Church. In its central square stood the cathedral of St. Gregory.

Far to the south a new power had risen. Under the caliph Umar, Arab armies conquered Syria and Mesopotamia, and in 640 the first of them came north into Armenia.

Theodoros Rshtuni, commander of the Armenian forces, took the field against them. But a maneuver went wrong, and the raiders reached Dvin.

They took the capital despite a stubborn defense. The Armenian histories tell of thirty-five thousand carried into captivity.

It was a raid, not yet a conquest, and Dvin rose again.

Now the raiders come down both roads at once. Man the walls.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Dvin stood on the plain of Ayrarat, about thirty-five kilometers south of modern Yerevan.
   - engine: `[[dvˈiːn]] stood on the plain of [[ˌaɪɹɑːɹˈɑːt]], about thirty-five kilometers south of modern [[jˌɛɹɛvˈɑːn]].`
   - sources: C1 (first sentence); ED2.59
2. By the sixth century it was the seat of the catholicos, head of the Armenian Church.
   - engine: `By the sixth century it was the seat of the [[kɐθˈɑːlɪkoʊs]], head of the Armenian Church.`
   - sources: C1 (fourth sentence); TA3.1
3. In its central square stood the cathedral of St. Gregory.
   - engine: `In its central square stood the cathedral of Saint Gregory.`
   - sources: C1 (last sentence); TA3.3
4. Far to the south a new power had risen.
   - engine: `Far to the south a new power had risen.`
   - sources: C2 (first sentence)
5. Under the caliph Umar, Arab armies conquered Syria and Mesopotamia, and in 640 the first of them came north into Armenia.
   - engine: `Under the caliph [[ˈuːmɑːɹ]], Arab armies conquered Syria and Mesopotamia, and in six forty the first of them came north into Armenia.`
   - sources: C2 (second sentence); TA3.5; ED2.2
6. Theodoros Rshtuni, commander of the Armenian forces, took the field against them.
   - engine: `[[θˌeɪoʊdˈɔːɹoʊs]] [[ɹəʃtˈuːni]], commander of the Armenian forces, took the field against them.`
   - sources: C2 (fifth sentence: Theodoros Rshtuni ... commander of the Armenian forces, took the field against them); ED2.16
7. But a maneuver went wrong, and the raiders reached Dvin.
   - engine: `But a maneuver went wrong, and the raiders reached [[dvˈiːn]].`
   - sources: C2 (last sentence); ED2.16
8. They took the capital despite a stubborn defense.
   - engine: `They took the capital despite a stubborn defense.`
   - sources: C3 (first sentence); V; TA3.7
9. The Armenian histories tell of thirty-five thousand carried into captivity.
   - engine: `The Armenian histories tell of thirty-five thousand carried into captivity.`
   - sources: C3 (The Armenian histories tell of thirty-five thousand carried into captivity); ED2.1; TA3.8
10. It was a raid, not yet a conquest, and Dvin rose again.
   - engine: `It was a raid, not yet a conquest, and [[dvˈiːn]] rose again.`
   - sources: C4 (first sentence); TA3.5; TA3.10
11. Now the raiders come down both roads at once.
   - engine: `Now the raiders come down both roads at once.`
   - sources: C4 (Now the raiders come down both roads at once); tag
12. Man the walls.
   - engine: `Man the walls.`
   - sources: C4 (Man the walls)

## Vertical cut (61 words)

### Script (true spelling: this is the subtitle text)

Dvin, on the plain of Ayrarat, was the seat of the catholicos, head of the Armenian Church.

In 640 the first Arab armies came north into Armenia. Theodoros Rshtuni took the field against them, but the raiders reached Dvin and took it, despite a stubborn defense.

It was a raid, not yet a conquest, and Dvin rose again. Man the walls.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Dvin, on the plain of Ayrarat, was the seat of the catholicos, head of the Armenian Church.
   - engine: `[[dvˈiːn]], on the plain of [[ˌaɪɹɑːɹˈɑːt]], was the seat of the [[kɐθˈɑːlɪkoʊs]], head of the Armenian Church.`
   - sources: C1 (first and fourth sentences); TA3.1
2. In 640 the first Arab armies came north into Armenia.
   - engine: `In six forty the first Arab armies came north into Armenia.`
   - sources: C2 (second sentence); TA3.5; ED2.2
3. Theodoros Rshtuni took the field against them, but the raiders reached Dvin and took it, despite a stubborn defense.
   - engine: `[[θˌeɪoʊdˈɔːɹoʊs]] [[ɹəʃtˈuːni]] took the field against them, but the raiders reached [[dvˈiːn]] and took it, despite a stubborn defense.`
   - sources: C2 (last two sentences); C3 (first sentence); ED2.16; TA3.7
4. It was a raid, not yet a conquest, and Dvin rose again.
   - engine: `It was a raid, not yet a conquest, and [[dvˈiːn]] rose again.`
   - sources: C4 (first sentence); TA3.5; TA3.10
5. Man the walls.
   - engine: `Man the walls.`
   - sources: C4

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Yerevan | `jˌɛɹɛvˈɑːn` | yeh-reh-VAHN |
| Dvin | `dvˈiːn` | DVEEN |
| Ayrarat | `ˌaɪɹɑːɹˈɑːt` | eye-rah-RAHT |
| catholicos | `kɐθˈɑːlɪkoʊs` | ka-THOL-i-kos |
| Umar | `ˈuːmɑːɹ` | OO-mar |
| Theodoros | `θˌeɪoʊdˈɔːɹoʊs` | theh-oh-DOR-os |
| Rshtuni | `ɹəʃtˈuːni` | rush-TOO-nee |
