# Explainer video: Sevan Shores (921 AD)

Battlefield id `sevan`. Files: `assets/explainer/sevan/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

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

## Landscape cut (128 words)

### Script (true spelling: this is the subtitle text)

In 914 the Sajid emir Yusuf had King Smbat I put to death, and his son Ashot II inherited a ruined kingdom. Year after year he fought on against rebels, rivals and invaders, and Armenians remember him as Erkat, the Iron.

In 921 the Sajid general Beshir marched on Lake Sevan. The king had withdrawn to the island, where the monastery of Sevanavank stood. Beshir's host gathered on the shore facing it.

The king put seventy of his best archers into boats, and they made for the shore. Their arrows fell on the ranks massed at the water's edge, and Beshir's men broke and fled.

The Iron King beat back attack after attack, and died in 929 still master of his kingdom.

String the bows, launch the boats.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 914 the Sajid emir Yusuf had King Smbat I put to death, and his son Ashot II inherited a ruined kingdom.
   - engine: `In nine fourteen the [[sˈɑːdʒɪd]] emir [[jˈuːsʊf]] had King [[smbˈɑːt]] the First put to death, and his son [[ɑːʃˈoʊt]] the Second inherited a ruined kingdom.`
   - sources: C1 (In 914 Yusuf, the Sajid emir, had King Smbat I put to death; Smbat's son Ashot II inherited a ruined kingdom)
2. Year after year he fought on against rebels, rivals and invaders, and Armenians remember him as Erkat, the Iron.
   - engine: `Year after year he fought on against rebels, rivals and invaders, and Armenians remember him as [[ɛɹkˈɑːt]], the Iron.`
   - sources: C1 (year after year he fought on against rebels, rivals and invaders; Armenians remember him as Erkat, 'the Iron')
3. In 921 the Sajid general Beshir marched on Lake Sevan.
   - engine: `In nine twenty-one the [[sˈɑːdʒɪd]] general [[bɛʃˈiːɹ]] marched on Lake [[sɛvˈɑːn]].`
   - sources: C2 (In 921, though some sources say 924, Beshir, a Sajid general, marched on Lake Sevan)
4. The king had withdrawn to the island, where the monastery of Sevanavank stood.
   - engine: `The king had withdrawn to the island, where the monastery of [[sɛvˌɑːnɑːvˈɑːŋk]] stood.`
   - sources: C2 (the king had withdrawn to the island where the monastery of Sevanavank stood); F1
5. Beshir's host gathered on the shore facing it.
   - engine: `[[bɛʃˈiːɹz]] host gathered on the shore facing it.`
   - sources: C2 (Beshir's host gathered on the shore facing the island)
6. The king put seventy of his best archers into boats, and they made for the shore.
   - engine: `The king put seventy of his best archers into boats, and they made for the shore.`
   - sources: C3 (the king put seventy of his best archers into boats, and they made for the shore); V
7. Their arrows fell on the ranks massed at the water's edge, and Beshir's men broke and fled.
   - engine: `Their arrows fell on the ranks massed at the water's edge, and [[bɛʃˈiːɹz]] men broke and fled.`
   - sources: C3 (a heavy barrage of arrows into the ranks massed at the water's edge; Beshir's men broke and fled); V
8. The Iron King beat back attack after attack, and died in 929 still master of his kingdom.
   - engine: `The Iron King beat back attack after attack, and died in nine twenty-nine still master of his kingdom.`
   - sources: C4 (the Iron King beat back attack after attack and died in 929 still master of his kingdom)
9. String the bows, launch the boats.
   - engine: `String the bows, launch the boats.`
   - sources: C4 (String the bows, launch the boats)

## Vertical cut (55 words)

### Script (true spelling: this is the subtitle text)

In 921 the Sajid general Beshir marched on Lake Sevan, where King Ashot II, the Iron King, had withdrawn to the island. The king put seventy of his best archers into boats. Their arrows drove Beshir's host from the shore.

Ashot died in 929 still master of his kingdom.

String the bows, launch the boats.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 921 the Sajid general Beshir marched on Lake Sevan, where King Ashot II, the Iron King, had withdrawn to the island.
   - engine: `In nine twenty-one the [[sˈɑːdʒɪd]] general [[bɛʃˈiːɹ]] marched on Lake [[sɛvˈɑːn]], where King [[ɑːʃˈoʊt]] the Second, the Iron King, had withdrawn to the island.`
   - sources: C2 (In 921 Beshir, a Sajid general, marched on Lake Sevan; the king had withdrawn to the island); hero (Ashot II Erkat, the Iron King)
2. The king put seventy of his best archers into boats.
   - engine: `The king put seventy of his best archers into boats.`
   - sources: C3; V (Ashot put seventy of his best archers into boats)
3. Their arrows drove Beshir's host from the shore.
   - engine: `Their arrows drove [[bɛʃˈiːɹz]] host from the shore.`
   - sources: V (their arrows drove Beshir's host from the shore of Lake Sevan)
4. Ashot died in 929 still master of his kingdom.
   - engine: `[[ɑːʃˈoʊt]] died in nine twenty-nine still master of his kingdom.`
   - sources: C4 (died in 929 still master of his kingdom)
5. String the bows, launch the boats.
   - engine: `String the bows, launch the boats.`
   - sources: C4 (String the bows, launch the boats)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Sevan | `sɛvˈɑːn` | seh-VAHN |
| Smbat | `smbˈɑːt` | smm-BAHT. No vowel before the m, as in Armenian; a recognizer writes 'Sambaat'. |
| Sajid | `sˈɑːdʒɪd` | SAH-jid |
| Yusuf | `jˈuːsʊf` | YOO-suf |
| Ashot | `ɑːʃˈoʊt` | ah-SHOT |
| Erkat | `ɛɹkˈɑːt` | er-KAHT |
| Beshir | `bɛʃˈiːɹ` | beh-SHEER |
| Sevanavank | `sɛvˌɑːnɑːvˈɑːŋk` | seh-vah-nah-VAHNK |
