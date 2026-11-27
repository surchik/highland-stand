# Explainer video: Sis (early 1375)

Battlefield id `sis`. Files: `assets/explainer/sis/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 0.94 (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html, which were themselves checked against docs/history. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html (LEVELS[...].chronicle)
- `V / D`: the battlefield's victory / defeat epilogue in index.html
- `hero / tag`: the battlefield's hero and tag line in index.html
- `TA<n>.<k>`: docs/history/text-audit.json, entry n (0 Erebuni, 1 Tushpa, 2 Avarayr, 3 Dvin), claims[k]
- `ED<e>.<k>`: docs/history/era-dossier.json, eras[e] (0 Urartu, 1 Avarayr, 2 the Arab raids), claims[k]
- `TH.<k>`: docs/history/town-history.json, ages[0].core_claims[k]
- `CH<c>.<n>`: chapter c's intro in index.html (CHAPTERS[c - 1].intro), paragraph n (II Faith and Crown, III The Last Crowns, IV The Long Night)
- `F<n>`: the battlefield's facts in index.html (LEVELS[...].facts), item n, counted from 1

## Landscape cut (124 words)

### Script (true spelling: this is the subtitle text)

A century after Mari, the Armenian Kingdom of Cilicia had lost most of its lands. Mamluk armies had taken its port and its cities, and their raids had reached the capital, Sis.

In 1374 the crown went to Leo of Lusignan, a prince from Cyprus, and he and his queen were crowned at Sis. Within months the Mamluk armies were in Cilicia, and the town of Sis fell.

The king held out behind the castle walls. Appeals for help to Europe had failed.

In April 1375, promised his life, he accepted terms, and was taken to Cairo as a prisoner. So ended the Armenian Kingdom of Cilicia. Freed in 1382, Leo died in Paris in 1393.

Hold the castle for the newly crowned king.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. A century after Mari, the Armenian Kingdom of Cilicia had lost most of its lands.
   - engine: `A century after [[mˈɑːɹi]], the Armenian Kingdom of Cilicia had lost most of its lands.`
   - sources: C1 (A century after Mari, the Armenian Kingdom of Cilicia had lost most of its lands)
2. Mamluk armies had taken its port and its cities, and their raids had reached the capital, Sis.
   - engine: `Mamluk armies had taken its port and its cities, and their raids had reached the capital, [[sˈɪs]].`
   - sources: C1 (Mamluk armies had taken the port of Ayas and the cities of Adana and Tarsus; their raids had reached the capital, Sis)
3. In 1374 the crown went to Leo of Lusignan, a prince from Cyprus, and he and his queen were crowned at Sis.
   - engine: `In thirteen seventy-four the crown went to Leo of [[lˈuːzinjɑːn]], a prince from Cyprus, and he and his queen were crowned at [[sˈɪs]].`
   - sources: C1 (the crown offered to Leo of Lusignan, a prince who lived in Cyprus; he and his queen were crowned at Sis in 1374); hero (last king crowned at Sis)
4. Within months the Mamluk armies were in Cilicia, and the town of Sis fell.
   - engine: `Within months the Mamluk armies were in Cilicia, and the town of [[sˈɪs]] fell.`
   - sources: C2 (within months the armies of the Mamluk sultan were in Cilicia; the town of Sis fell)
5. The king held out behind the castle walls.
   - engine: `The king held out behind the castle walls.`
   - sources: C2 (King Leo held out behind castle walls)
6. Appeals for help to Europe had failed.
   - engine: `Appeals for help to Europe had failed.`
   - sources: C2 (appeals for help to Europe had failed)
7. In April 1375, promised his life, he accepted terms, and was taken to Cairo as a prisoner.
   - engine: `In April thirteen seventy-five, promised his life, he accepted terms, and was taken to Cairo as a prisoner.`
   - sources: C3 (In April 1375, promised his life, the king accepted terms and was taken to Cairo as a prisoner); V
8. So ended the Armenian Kingdom of Cilicia.
   - engine: `So ended the Armenian Kingdom of Cilicia.`
   - sources: C3 (the Armenian Kingdom of Cilicia came to an end); CH3.5 (So ended the Armenian Kingdom of Cilicia)
9. Freed in 1382, Leo died in Paris in 1393.
   - engine: `Freed in thirteen eighty-two, Leo died in Paris in thirteen ninety-three.`
   - sources: V (freed in 1382; died in Paris in 1393); C4
10. Hold the castle for the newly crowned king.
   - engine: `Hold the castle for the newly crowned king.`
   - sources: C4 (Hold the castle for the newly crowned king)

## Vertical cut (58 words)

### Script (true spelling: this is the subtitle text)

In 1374 Leo V was crowned at Sis, the capital of Armenian Cilicia. Within months a Mamluk army took the town, and the king held out behind the castle walls.

In April 1375 he accepted terms, and the kingdom came to an end. Freed in 1382, he died in Paris in 1393.

Hold the castle for the king.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 1374 Leo V was crowned at Sis, the capital of Armenian Cilicia.
   - engine: `In thirteen seventy-four Leo the Fifth was crowned at [[sˈɪs]], the capital of Armenian Cilicia.`
   - sources: CH3.5 (Leo V crowned at Sis in September 1374); C1 (Sis, the capital)
2. Within months a Mamluk army took the town, and the king held out behind the castle walls.
   - engine: `Within months a Mamluk army took the town, and the king held out behind the castle walls.`
   - sources: C2 (the Mamluk armies were in Cilicia; the town of Sis fell; the king held out behind castle walls); CH3.5 (a Mamluk army took the town of Sis)
3. In April 1375 he accepted terms, and the kingdom came to an end.
   - engine: `In April thirteen seventy-five he accepted terms, and the kingdom came to an end.`
   - sources: C3 (In April 1375 the king accepted terms; the kingdom came to an end)
4. Freed in 1382, he died in Paris in 1393.
   - engine: `Freed in thirteen eighty-two, he died in Paris in thirteen ninety-three.`
   - sources: V (freed in 1382; died in Paris in 1393)
5. Hold the castle for the king.
   - engine: `Hold the castle for the king.`
   - sources: C4 (Hold the castle for the newly crowned king)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Mari | `mˈɑːɹi` | MAH-ree |
| Sis | `sˈɪs` | SISS. With a long ee a recognizer wrote 'cease'. |
| Lusignan | `lˈuːzinjɑːn` | LOO-zeen-yahn |
