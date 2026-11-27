# Explainer video: Avarayr Plain (451 AD)

Battlefield id `avarayr`. Files: `assets/explainer/avarayr/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 0.94 (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html, which were themselves checked against docs/history. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html (LEVELS[...].chronicle)
- `V / D`: the battlefield's victory / defeat epilogue in index.html
- `hero / tag`: the battlefield's hero and tag line in index.html
- `TA<n>.<k>`: docs/history/text-audit.json, entry n (0 Erebuni, 1 Tushpa, 2 Avarayr, 3 Dvin), claims[k]
- `ED<e>.<k>`: docs/history/era-dossier.json, eras[e] (0 Urartu, 1 Avarayr, 2 the Arab raids), claims[k]
- `TH.<k>`: docs/history/town-history.json, ages[0].core_claims[k]

## Landscape cut (123 words)

### Script (true spelling: this is the subtitle text)

Armenia had taken Christianity as its faith early in the fourth century.

In 449 Yazdegerd II, shahanshah of Sasanian Persia, commanded the Armenians to renounce Christianity for Zoroastrianism.

In 450 much of Armenia rose. At the head of the rising stood Vardan Mamikonian, sparapet, the hereditary commander of Armenia's army.

In 451 the Persian army came, with its elite cavalry and a corps of war elephants. Vardan drew up his army on the plain of Avarayr, by the river Tghmut.

The Armenians won the first clashes. Then the Persian reserves surrounded Vardan's men, and Vardan fell there.

The field was lost, yet the faith held: in 484 his nephew Vahan won freedom of worship by the Treaty of Nvarsak.

Stand where Vardan stood.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Armenia had taken Christianity as its faith early in the fourth century.
   - engine: `Armenia had taken Christianity as its faith early in the fourth century.`
   - sources: C1 (first sentence)
2. In 449 Yazdegerd II, shahanshah of Sasanian Persia, commanded the Armenians to renounce Christianity for Zoroastrianism.
   - engine: `In four forty-nine [[jˈæzdəɡɚd]] the Second, [[ʃˌɑːhɑːnʃˈɑː]] of [[sæsˈeɪniən]] Persia, commanded the Armenians to renounce Christianity for [[zˌɔːɹoʊˈæstɹiənˌɪzəm]].`
   - sources: C1 (third sentence); ED1.0; TA2.3
3. In 450 much of Armenia rose.
   - engine: `In four fifty much of Armenia rose.`
   - sources: C2 (second sentence: in 450 much of Armenia rose)
4. At the head of the rising stood Vardan Mamikonian, sparapet, the hereditary commander of Armenia's army.
   - engine: `At the head of the rising stood [[vɑːɹdˈɑːn]] [[mˌɑːmɪkoʊnjˈɑːn]], [[spˌɑːɹɑːpˈɛt]], the hereditary commander of Armenia's army.`
   - sources: C2 (fourth sentence); hero (Vardan Mamikonian, Sparapet of Armenia); ED1.26; ED1.28; TA2.4
5. In 451 the Persian army came, with its elite cavalry and a corps of war elephants.
   - engine: `In four fifty-one the Persian army came, with its elite cavalry and a corps of war elephants.`
   - sources: C3 (first sentence); ED1.9; TA2.7; TA2.8
6. Vardan drew up his army on the plain of Avarayr, by the river Tghmut.
   - engine: `[[vɑːɹdˈɑːn]] drew up his army on the plain of [[ˌɑːvɑːɹˈaɪɹ]], by the river [[təɣmˈuːt]].`
   - sources: C3 (second sentence); tag; ED1.5; TA2.0
7. The Armenians won the first clashes.
   - engine: `The Armenians won the first clashes.`
   - sources: C3 (The Armenians won the first clashes); ED1.13
8. Then the Persian reserves surrounded Vardan's men, and Vardan fell there.
   - engine: `Then the Persian reserves surrounded [[vɑːɹdˈɑːnz]] men, and [[vɑːɹdˈɑːn]] fell there.`
   - sources: C3 (Then the Persian reserves surrounded Vardan's men. Vardan fell there); D; TA2.9
9. The field was lost, yet the faith held: in 484 his nephew Vahan won freedom of worship by the Treaty of Nvarsak.
   - engine: `The field was lost, yet the faith held: in four eighty-four his nephew [[vɑːhˈɑːn]] won freedom of worship by the Treaty of [[nvɑːɹsˈɑːk]].`
   - sources: C4 (The field was lost; Yet the faith held; in 484 he won freedom of worship by the Treaty of Nvarsak); V; ED1.32; TA2.10
10. Stand where Vardan stood.
   - engine: `Stand where [[vɑːɹdˈɑːn]] stood.`
   - sources: C4 (Stand where Vardan stood)

## Vertical cut (58 words)

### Script (true spelling: this is the subtitle text)

In 449 Yazdegerd II of Sasanian Persia commanded the Armenians to renounce Christianity. In 450 much of Armenia rose, led by Vardan Mamikonian.

In 451 the armies met on the plain of Avarayr. Vardan fell there, and the field was lost.

Yet the faith held: in 484 his nephew Vahan won freedom of worship.

Stand where Vardan stood.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 449 Yazdegerd II of Sasanian Persia commanded the Armenians to renounce Christianity.
   - engine: `In four forty-nine [[jˈæzdəɡɚd]] the Second of [[sæsˈeɪniən]] Persia commanded the Armenians to renounce Christianity.`
   - sources: C1 (third sentence); ED1.0; TA2.3
2. In 450 much of Armenia rose, led by Vardan Mamikonian.
   - engine: `In four fifty much of Armenia rose, led by [[vɑːɹdˈɑːn]] [[mˌɑːmɪkoʊnjˈɑːn]].`
   - sources: C2 (second and fourth sentences); TA2.4
3. In 451 the armies met on the plain of Avarayr.
   - engine: `In four fifty-one the armies met on the plain of [[ˌɑːvɑːɹˈaɪɹ]].`
   - sources: C3 (first two sentences); TA2.2; ED1.5
4. Vardan fell there, and the field was lost.
   - engine: `[[vɑːɹdˈɑːn]] fell there, and the field was lost.`
   - sources: C3 (Vardan fell there); C4 (The field was lost); TA2.9
5. Yet the faith held: in 484 his nephew Vahan won freedom of worship.
   - engine: `Yet the faith held: in four eighty-four his nephew [[vɑːhˈɑːn]] won freedom of worship.`
   - sources: C4 (Yet the faith held; in 484 he won freedom of worship); V; ED1.32; ED1.33; TA2.10
6. Stand where Vardan stood.
   - engine: `Stand where [[vɑːɹdˈɑːn]] stood.`
   - sources: C4

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Yazdegerd | `jˈæzdəɡɚd` | YAZ-deh-gerd |
| shahanshah | `ʃˌɑːhɑːnʃˈɑː` | shah-hahn-SHAH |
| Sasanian | `sæsˈeɪniən` | sa-SAY-nee-an |
| Vardan | `vɑːɹdˈɑːn` | var-DAHN |
| Mamikonian | `mˌɑːmɪkoʊnjˈɑːn` | mah-mee-kon-YAHN |
| sparapet | `spˌɑːɹɑːpˈɛt` | spah-rah-PET |
| Avarayr | `ˌɑːvɑːɹˈaɪɹ` | ah-vah-RYRE |
| Tghmut | `təɣmˈuːt` | tuh-gh-MOOT (gh as in Armenian, a soft sound at the back of the throat) |
| Vahan | `vɑːhˈɑːn` | vah-HAHN |
| Nvarsak | `nvɑːɹsˈɑːk` | nvar-SAHK. The n runs straight into the v, with no vowel between: with one, a recognizer heard 'Navar Sak'. |
| Zoroastrianism | `zˌɔːɹoʊˈæstɹiənˌɪzəm` | zor-oh-AS-tree-an-izm (an English word the engines' dictionary gets wrong) |
