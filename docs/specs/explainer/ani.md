# Explainer video: Ani (c. 1041 to 1044)

Battlefield id `ani`. Files: `assets/explainer/ani/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

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

In 961 Ani became the capital of Bagratid Armenia, a city on a plateau above the Akhurian gorge. King Hovhannes-Smbat had no son, and he willed that after his death, Ani would pass to the empire.

He died around 1041, and imperial troops came to take the city. Armenian chroniclers tell how the sparapet Vahram Pahlavuni led the Armenians out and routed an imperial army under the walls. He raised the late king's young nephew, Gagik II, to the throne.

The emperor's armies came again, and failed to take the city. No Byzantine army ever took Ani by storm. But in 1045, while Gagik was held in Constantinople, Ani was handed over to the empire.

Stand with Vahram, and keep the young king's crown.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 961 Ani became the capital of Bagratid Armenia, a city on a plateau above the Akhurian gorge.
   - engine: `In nine sixty-one [[ɑːnˈiː]] became the capital of [[bˈæɡɹətɪd]] Armenia, a city on a plateau above the [[ˌɑːkuːɹiˈɑːn]] gorge.`
   - sources: C1 (In 961 King Ashot III made Ani the capital of Bagratid Armenia; a triangular plateau guarded on the east by the gorge of the Akhurian); CH3.1
2. King Hovhannes-Smbat had no son, and he willed that after his death, Ani would pass to the empire.
   - engine: `King [[hˌoʊvhɑːnˈɛs smbˈɑːt]] had no son, and he willed that after his death, [[ɑːnˈiː]] would pass to the empire.`
   - sources: C1 (Hovhannes-Smbat had no son to succeed him; his written testament: after his death, Ani would pass to the empire); CH3.2
3. He died around 1041, and imperial troops came to take the city.
   - engine: `He died around ten forty-one, and imperial troops came to take the city.`
   - sources: C2 (Hovhannes-Smbat died around 1041; imperial troops came to take possession of Ani)
4. Armenian chroniclers tell how the sparapet Vahram Pahlavuni led the Armenians out and routed an imperial army under the walls.
   - engine: `Armenian chroniclers tell how the [[spˌɑːɹɑːpˈɛt]] [[vɑːhɹˈɑːm]] [[pˌɑːhlɑːvˈuːni]] led the Armenians out and routed an imperial army under the walls.`
   - sources: C2 (Armenian chroniclers tell how the sparapet Vahram Pahlavuni led the Armenians out and routed an imperial army under the walls); hero
5. He raised the late king's young nephew, Gagik II, to the throne.
   - engine: `He raised the late king's young nephew, [[ɡɑːɡˈiːk]] the Second, to the throne.`
   - sources: C2 (Vahram and his followers raised the late king's teenage nephew Gagik to the throne); CH3.2 (the young Gagik II)
6. The emperor's armies came again, and failed to take the city.
   - engine: `The emperor's armies came again, and failed to take the city.`
   - sources: C3 (Constantine IX's armies came again and failed to take the city)
7. No Byzantine army ever took Ani by storm.
   - engine: `No Byzantine army ever took [[ɑːnˈiː]] by storm.`
   - sources: D (no Byzantine army ever took Ani by storm); CH3.2
8. But in 1045, while Gagik was held in Constantinople, Ani was handed over to the empire.
   - engine: `But in ten forty-five, while [[ɡɑːɡˈiːk]] was held in Constantinople, [[ɑːnˈiː]] was handed over to the empire.`
   - sources: C4 (In 1045, while Gagik was held in Constantinople, Ani was handed over to the emperor's envoy); D
9. Stand with Vahram, and keep the young king's crown.
   - engine: `Stand with [[vɑːhɹˈɑːm]], and keep the young king's crown.`
   - sources: C4 (Stand with Vahram, and keep the young king's crown)

## Vertical cut (54 words)

### Script (true spelling: this is the subtitle text)

Around 1041 the Byzantine Empire came to claim Ani, the Bagratid capital. The sparapet Vahram Pahlavuni led the Armenians out and routed an imperial army. No Byzantine army ever took Ani by storm.

But in 1045, while its young king was kept in Constantinople, the city was handed over.

Keep the young king's crown.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Around 1041 the Byzantine Empire came to claim Ani, the Bagratid capital.
   - engine: `Around ten forty-one the Byzantine Empire came to claim [[ɑːnˈiː]], the [[bˈæɡɹətɪd]] capital.`
   - sources: C2 (Hovhannes-Smbat died around 1041; imperial troops came to take possession of Ani); tag (the Bagratid capital)
2. The sparapet Vahram Pahlavuni led the Armenians out and routed an imperial army.
   - engine: `The [[spˌɑːɹɑːpˈɛt]] [[vɑːhɹˈɑːm]] [[pˌɑːhlɑːvˈuːni]] led the Armenians out and routed an imperial army.`
   - sources: C2 (Armenian chroniclers tell how the sparapet Vahram Pahlavuni led the Armenians out and routed an imperial army under the walls)
3. No Byzantine army ever took Ani by storm.
   - engine: `No Byzantine army ever took [[ɑːnˈiː]] by storm.`
   - sources: D (no Byzantine army ever took Ani by storm)
4. But in 1045, while its young king was kept in Constantinople, the city was handed over.
   - engine: `But in ten forty-five, while its young king was kept in Constantinople, the city was handed over.`
   - sources: D (handed over in 1045, while its young king was kept in Constantinople); C4
5. Keep the young king's crown.
   - engine: `Keep the young king's crown.`
   - sources: C4 (keep the young king's crown)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| sparapet | `spˌɑːɹɑːpˈɛt` | spah-rah-PET |
| Hovhannes-Smbat | `hˌoʊvhɑːnˈɛs smbˈɑːt` | hov-hah-NES smm-BAHT |
| Bagratid | `bˈæɡɹətɪd` | BAG-ra-tid |
| Ani | `ɑːnˈiː` | ah-NEE |
| Akhurian | `ˌɑːkuːɹiˈɑːn` | ah-koo-ree-AHN. The Armenian kh is softened to k: with it, a recognizer wrote 'Ahuryan'. |
| Vahram | `vɑːhɹˈɑːm` | vah-RAHM |
| Pahlavuni | `pˌɑːhlɑːvˈuːni` | pah-hlah-VOO-nee |
| Gagik | `ɡɑːɡˈiːk` | gah-GEEK |
