# Explainer video: Tashir Gates (914 AD)

Battlefield id `tashir`. Files: `assets/explainer/tashir/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

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

To the north lay Tashir, a land of forest and deep gorges in the valleys of the Debed. In 890 Smbat I became king of Armenia.

But the Sajid emir Yusuf claimed Armenia in the caliph's name. About 913 he besieged the king in Kapuyt Berd, the Blue Fortress, and Smbat gave himself up. Yusuf did not spare him; Armenians remember him as Smbat the Martyr.

But his son Ashot would not yield. He drove the emir's men from many of the strongholds they had seized. The Georgian king Adarnase, his close ally, set the crown of Armenia on his head. Ashot came to be called Erkat, the Iron.

Within two generations, the monasteries of Sanahin and Haghpat rose above the Debed canyon.

Hold the forest roads.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. To the north lay Tashir, a land of forest and deep gorges in the valleys of the Debed.
   - engine: `To the north lay [[tɑːʃˈiːɹ]], a land of forest and deep gorges in the valleys of the [[dɛbˈɛd]].`
   - sources: C1 (To the north lay Tashir, a canton of Gugark in the valleys of the Debed, a country of forest and deep gorges)
2. In 890 Smbat I became king of Armenia.
   - engine: `In eight ninety [[smbˈɑːt]] the First became king of Armenia.`
   - sources: C1 (a Bagratuni prince restored the crown; his son Smbat I succeeded him in 890); CH2.1
3. But the Sajid emir Yusuf claimed Armenia in the caliph's name.
   - engine: `But the [[sˈɑːdʒɪd]] emir [[jˈuːsʊf]] claimed Armenia in the caliph's name.`
   - sources: C2 (the Sajid emir Yusuf ibn Abi'l-Saj claimed authority over Armenia in the caliph's name)
4. About 913 he besieged the king in Kapuyt Berd, the Blue Fortress, and Smbat gave himself up.
   - engine: `About nine thirteen he besieged the king in [[kɑːpˈuːjt bˈɛɹd]], the Blue Fortress, and [[smbˈɑːt]] gave himself up.`
   - sources: C2 (about 913 Yusuf besieged the king in Kapuyt Berd, the Blue Fortress, and at last Smbat gave himself up)
5. Yusuf did not spare him; Armenians remember him as Smbat the Martyr.
   - engine: `[[jˈuːsʊf]] did not spare him; Armenians remember him as [[smbˈɑːt]] the Martyr.`
   - sources: C3 (Yusuf did not spare the king; Armenians remember him as Smbat the Martyr)
6. But his son Ashot would not yield.
   - engine: `But his son [[ɑːʃˈoʊt]] would not yield.`
   - sources: C3 (Smbat's son Ashot would not yield); hero (Ashot II, son of King Smbat)
7. He drove the emir's men from many of the strongholds they had seized.
   - engine: `He drove the emir's men from many of the strongholds they had seized.`
   - sources: C3 (he drove the emir's men from many of the strongholds they had seized); V
8. The Georgian king Adarnase, his close ally, set the crown of Armenia on his head.
   - engine: `The Georgian king [[ˌɑːdɑːɹnˈɑːseɪ]], his close ally, set the crown of Armenia on his head.`
   - sources: C3 (a close alliance with Adarnase, king of the Iberians; the Georgian king set the crown of Armenia on his head)
9. Ashot came to be called Erkat, the Iron.
   - engine: `[[ɑːʃˈoʊt]] came to be called [[ɛɹkˈɑːt]], the Iron.`
   - sources: C3 (Ashot came to be called Erkat, 'the Iron')
10. Within two generations, the monasteries of Sanahin and Haghpat rose above the Debed canyon.
   - engine: `Within two generations, the monasteries of [[sˌɑːnɑːhˈiːn]] and [[hɑːɣpˈɑːt]] rose above the [[dɛbˈɛd]] canyon.`
   - sources: V (within two generations the monasteries of Sanahin and Haghpat rose above the Debed canyon); C4
11. Hold the forest roads.
   - engine: `Hold the forest roads.`
   - sources: C4 (Hold the forest roads, defender)

## Vertical cut (59 words)

### Script (true spelling: this is the subtitle text)

In 914 the Sajid emir Yusuf had King Smbat I put to death. But Smbat's son Ashot would not yield.

He drove the emir's men from many of the strongholds they had seized. The Georgian king set the crown of Armenia on his head, and Ashot came to be called Erkat, the Iron.

Hold the forest roads of Tashir.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 914 the Sajid emir Yusuf had King Smbat I put to death.
   - engine: `In nine fourteen the [[sˈɑːdʒɪd]] emir [[jˈuːsʊf]] had King [[smbˈɑːt]] the First put to death.`
   - sources: C3 (Smbat put to death; usually dated to 914); D (after King Smbat I was put to death); C2 (the Sajid emir Yusuf)
2. But Smbat's son Ashot would not yield.
   - engine: `But [[smbˈɑːtz]] son [[ɑːʃˈoʊt]] would not yield.`
   - sources: C3 (Smbat's son Ashot would not yield)
3. He drove the emir's men from many of the strongholds they had seized.
   - engine: `He drove the emir's men from many of the strongholds they had seized.`
   - sources: C3; V; D (his son Ashot drove the emir's men from many of the strongholds they had seized)
4. The Georgian king set the crown of Armenia on his head, and Ashot came to be called Erkat, the Iron.
   - engine: `The Georgian king set the crown of Armenia on his head, and [[ɑːʃˈoʊt]] came to be called [[ɛɹkˈɑːt]], the Iron.`
   - sources: C3 (the Georgian king set the crown of Armenia on his head; Ashot came to be called Erkat, 'the Iron')
5. Hold the forest roads of Tashir.
   - engine: `Hold the forest roads of [[tɑːʃˈiːɹ]].`
   - sources: C4 (Hold the forest roads); tag (the gorges of Tashir)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Tashir | `tɑːʃˈiːɹ` | tah-SHEER |
| Debed | `dɛbˈɛd` | deh-BED |
| Smbat | `smbˈɑːt` | smm-BAHT. No vowel before the m, as in Armenian; a recognizer writes 'Sambaat'. |
| Sajid | `sˈɑːdʒɪd` | SAH-jid |
| Yusuf | `jˈuːsʊf` | YOO-suf |
| Kapuyt Berd | `kɑːpˈuːjt bˈɛɹd` | kah-POOYT BERD |
| Ashot | `ɑːʃˈoʊt` | ah-SHOT |
| Adarnase | `ˌɑːdɑːɹnˈɑːseɪ` | ah-dar-NAH-say |
| Erkat | `ɛɹkˈɑːt` | er-KAHT |
| Sanahin | `sˌɑːnɑːhˈiːn` | sah-nah-HEEN |
| Haghpat | `hɑːɣpˈɑːt` | hagh-PAHT (gh as in Armenian) |
