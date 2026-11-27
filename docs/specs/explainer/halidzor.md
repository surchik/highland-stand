# Explainer video: Halidzor (late winter 1727)

Battlefield id `halidzor`. Files: `assets/explainer/halidzor/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

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

## Landscape cut (127 words)

### Script (true spelling: this is the subtitle text)

When the Safavid state fell apart in 1722, Ottoman armies marched east to seize Persia's Caucasian lands. In Syunik, the Armenians rose under Davit Bek. He made the fortress of Halidzor, on a ridge above the Voghji River, his headquarters.

In the late winter of 1727, a large Ottoman army closed around it. The defenders were badly outnumbered. A secret tunnel ran down to the river, and it is said to have kept them in water.

As food ran low, Davit Bek led the garrison down the hill in a sudden sortie, and the besieging army broke and fled. His men drove the Ottomans from Ghapan, and the shah recognized him as ruler of the district.

Man the walls, watch the tunnel, and charge with Davit Bek.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. When the Safavid state fell apart in 1722, Ottoman armies marched east to seize Persia's Caucasian lands.
   - engine: `When the Safavid state fell apart in seventeen twenty-two, Ottoman armies marched east to seize Persia's Caucasian lands.`
   - sources: C1 (when the Safavid state fell apart in 1722, the Ottoman Empire sent its armies east to seize Persia's Caucasian lands)
2. In Syunik, the Armenians rose under Davit Bek.
   - engine: `In [[sjuːnˈiːk]], the Armenians rose under [[dɑːvˈiːt bˈɛk]].`
   - sources: C1 (in Syunik the Armenian meliks and villagers rose under Davit Bek); hero
3. He made the fortress of Halidzor, on a ridge above the Voghji River, his headquarters.
   - engine: `He made the fortress of [[hˌɑːlɪdzˈɔːɹ]], on a ridge above the [[vˈoʊɣdʒi]] River, his headquarters.`
   - sources: C1 (he made the fortress of Halidzor, on a ridge above the Voghji River, his headquarters)
4. In the late winter of 1727, a large Ottoman army closed around it.
   - engine: `In the late winter of seventeen twenty-seven, a large Ottoman army closed around it.`
   - sources: C2 (in the late winter of 1727 a large Ottoman army closed around Halidzor)
5. The defenders were badly outnumbered.
   - engine: `The defenders were badly outnumbered.`
   - sources: C2 (the defenders were badly outnumbered)
6. A secret tunnel ran down to the river, and it is said to have kept them in water.
   - engine: `A secret tunnel ran down to the river, and it is said to have kept them in water.`
   - sources: C2 (a secret tunnel ran from the fortress down to the river; it is said to have kept the garrison in water); F2
7. As food ran low, Davit Bek led the garrison down the hill in a sudden sortie, and the besieging army broke and fled.
   - engine: `As food ran low, [[dɑːvˈiːt bˈɛk]] led the garrison down the hill in a sudden sortie, and the besieging army broke and fled.`
   - sources: C3 (as food ran low, Davit Bek led the garrison down the hill in a sudden sortie, and the besieging army broke and fled); V
8. His men drove the Ottomans from Ghapan, and the shah recognized him as ruler of the district.
   - engine: `His men drove the Ottomans from [[ɣɑːpˈɑːn]], and the shah recognized him as ruler of the district.`
   - sources: C3 (drove the Ottomans from Ghapan; Shah Tahmasp II recognized him as ruler of the district); V
9. Man the walls, watch the tunnel, and charge with Davit Bek.
   - engine: `Man the walls, watch the tunnel, and charge with [[dɑːvˈiːt bˈɛk]].`
   - sources: C4 (Man the walls, watch the tunnel, and charge with Davit Bek)

## Vertical cut (53 words)

### Script (true spelling: this is the subtitle text)

In 1727 a large Ottoman army besieged Davit Bek in his fortress of Halidzor, in the gorges of Syunik. As food ran low, he led the garrison out in a sudden sortie, and the besiegers broke and fled.

His men drove the Ottomans from Ghapan.

Man the walls, and charge with Davit Bek.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 1727 a large Ottoman army besieged Davit Bek in his fortress of Halidzor, in the gorges of Syunik.
   - engine: `In seventeen twenty-seven a large Ottoman army besieged [[dɑːvˈiːt bˈɛk]] in his fortress of [[hˌɑːlɪdzˈɔːɹ]], in the gorges of [[sjuːnˈiːk]].`
   - sources: C2 (in 1727 a large Ottoman army closed around Halidzor; Armenian accounts date the siege); tag (Davit Bek's fortress in the gorges of Syunik)
2. As food ran low, he led the garrison out in a sudden sortie, and the besiegers broke and fled.
   - engine: `As food ran low, he led the garrison out in a sudden sortie, and the besiegers broke and fled.`
   - sources: C3 (as food ran low he led the garrison in a sudden sortie, and the besieging army broke and fled); V
3. His men drove the Ottomans from Ghapan.
   - engine: `His men drove the Ottomans from [[ɣɑːpˈɑːn]].`
   - sources: C3; V (drove the Ottomans from Ghapan)
4. Man the walls, and charge with Davit Bek.
   - engine: `Man the walls, and charge with [[dɑːvˈiːt bˈɛk]].`
   - sources: C4 (Man the walls, and charge with Davit Bek)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Syunik | `sjuːnˈiːk` | syoo-NEEK |
| Davit Bek | `dɑːvˈiːt bˈɛk` | dah-VEET BEK |
| Halidzor | `hˌɑːlɪdzˈɔːɹ` | hah-lid-ZOR |
| Voghji | `vˈoʊɣdʒi` | VOGH-jee (gh as in Armenian) |
| Ghapan | `ɣɑːpˈɑːn` | ghah-PAHN (gh as in Armenian) |
