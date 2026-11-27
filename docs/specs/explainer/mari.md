# Explainer video: Mari (August 1266)

Battlefield id `mari`. Files: `assets/explainer/mari/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

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

Far to the southwest, in Cilicia, Armenians built a new kingdom. King Hethum I bound it to the rising power of the Mongols.

But in 1260 the Mamluks of Egypt defeated the Mongols, and soon their new sultan, Baybars, turned against the Mongols' allies.

In 1266, while Hethum hurried to the Mongols for help, his sons Leo and Thoros led the defense. Baybars sent a Mamluk army against them. By one account, it went around the guarded pass.

In the battle remembered as Mari, the chronicler Vahram writes, the princes stood their ground. Thoros was killed, and Leo was taken prisoner. The invaders burned Sis, yet, he says, the forts held.

In 1268 Leo came home, and the next year he became king.

Hold the way into Cilicia.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Far to the southwest, in Cilicia, Armenians built a new kingdom.
   - engine: `Far to the southwest, in Cilicia, Armenians built a new kingdom.`
   - sources: C1 (many Armenians settled far to the southwest, in Cilicia; a new Armenian state grew there); CH3.3
2. King Hethum I bound it to the rising power of the Mongols.
   - engine: `King [[hɛθˈuːm]] the First bound it to the rising power of the Mongols.`
   - sources: C1 (King Hethum I bound his kingdom to the rising power of the Mongols)
3. But in 1260 the Mamluks of Egypt defeated the Mongols, and soon their new sultan, Baybars, turned against the Mongols' allies.
   - engine: `But in twelve sixty the Mamluks of Egypt defeated the Mongols, and soon their new sultan, [[bˈaɪbɑːɹz]], turned against the Mongols' allies.`
   - sources: C1 (in 1260 the Mamluks of Egypt defeated the Mongols at Ain Jalut; soon afterwards the emir Baybars became sultan, and he turned against the Mongols' allies)
4. In 1266, while Hethum hurried to the Mongols for help, his sons Leo and Thoros led the defense.
   - engine: `In twelve sixty-six, while [[hɛθˈuːm]] hurried to the Mongols for help, his sons Leo and [[θˈɔːɹoʊs]] led the defense.`
   - sources: C2 (the king hurried to the Mongols for help; while he was away his sons Leo and Thoros led the defense); hero
5. Baybars sent a Mamluk army against them.
   - engine: `[[bˈaɪbɑːɹz]] sent a Mamluk army against them.`
   - sources: C2 (In August Baybars sent a Mamluk army); date (August 1266)
6. By one account, it went around the guarded pass.
   - engine: `By one account, it went around the guarded pass.`
   - sources: C2 (one account says Leo held the pass and the army went around it); V (by one account going around it)
7. In the battle remembered as Mari, the chronicler Vahram writes, the princes stood their ground.
   - engine: `In the battle remembered as [[mˈɑːɹi]], the chronicler [[vɑːhɹˈɑːm]] writes, the princes stood their ground.`
   - sources: C3 (the battle remembered as the Battle of Mari; Vahram, who later served Leo as his secretary, writes that the princes stood their ground)
8. Thoros was killed, and Leo was taken prisoner.
   - engine: `[[θˈɔːɹoʊs]] was killed, and Leo was taken prisoner.`
   - sources: C3 (Thoros was killed; Leo was taken prisoner)
9. The invaders burned Sis, yet, he says, the forts held.
   - engine: `The invaders burned [[sˈɪs]], yet, he says, the forts held.`
   - sources: C3 (the invaders burned Sis; yet Vahram says the forts held)
10. In 1268 Leo came home, and the next year he became king.
   - engine: `In twelve sixty-eight Leo came home, and the next year he became king.`
   - sources: C4 (In 1268 Leo came home; in 1269 Hethum gave up the throne to him); V
11. Hold the way into Cilicia.
   - engine: `Hold the way into Cilicia.`
   - sources: C4 (Hold the way into Cilicia)

## Vertical cut (60 words)

### Script (true spelling: this is the subtitle text)

In 1266 King Hethum I hurried to the Mongols for help. His sons Leo and Thoros led the defense against a Mamluk army.

In the battle remembered as Mari, Vahram writes, the princes stood their ground. Thoros was killed, and Leo was taken prisoner.

Leo came home in 1268, and became king the next year.

Hold the way into Cilicia.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 1266 King Hethum I hurried to the Mongols for help.
   - engine: `In twelve sixty-six King [[hɛθˈuːm]] the First hurried to the Mongols for help.`
   - sources: C2 (by 1266 ... the king hurried to the Mongols for help); C1 (King Hethum I)
2. His sons Leo and Thoros led the defense against a Mamluk army.
   - engine: `His sons Leo and [[θˈɔːɹoʊs]] led the defense against a Mamluk army.`
   - sources: C2 (while the king was away, his sons Leo and Thoros led the defense; Baybars sent a Mamluk army)
3. In the battle remembered as Mari, Vahram writes, the princes stood their ground.
   - engine: `In the battle remembered as [[mˈɑːɹi]], [[vɑːhɹˈɑːm]] writes, the princes stood their ground.`
   - sources: C3 (the battle remembered as the Battle of Mari; Vahram writes that the princes stood their ground)
4. Thoros was killed, and Leo was taken prisoner.
   - engine: `[[θˈɔːɹoʊs]] was killed, and Leo was taken prisoner.`
   - sources: C3 (Thoros was killed; Leo was taken prisoner); D
5. Leo came home in 1268, and became king the next year.
   - engine: `Leo came home in twelve sixty-eight, and became king the next year.`
   - sources: V (Leo came home in 1268, and in 1269 his father gave up the throne to him)
6. Hold the way into Cilicia.
   - engine: `Hold the way into Cilicia.`
   - sources: C4 (Hold the way into Cilicia)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Vahram | `vɑːhɹˈɑːm` | vah-RAHM |
| Hethum | `hɛθˈuːm` | heh-THOOM. Said with the English th, a recognizer writes it as spelled; with a plain t it wrote 'Hetun'. |
| Baybars | `bˈaɪbɑːɹz` | BYE-barz |
| Thoros | `θˈɔːɹoʊs` | THOR-os. With a plain t a recognizer wrote 'Tauros'. |
| Mari | `mˈɑːɹi` | MAH-ree |
| Sis | `sˈɪs` | SISS. With a long ee a recognizer wrote 'cease'. |
