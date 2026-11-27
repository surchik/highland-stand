# Explainer video: Stepanakert (1991 to 1992)

Battlefield id `stepanakert92`. Files: `assets/explainer/stepanakert92/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 1.0 (landscape) and 1.0 (upright) (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html (its chronicle, tag, hero, date, facts, victory and defeat texts) and its chapter's story. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html
- `V / D`: the battlefield's victory / defeat text
- `hero / tag / date / facts / towers / units`: the battlefield's own fields in index.html
- `chapter V intro`: CHAPTERS (Artsakh).intro in index.html

## Landscape cut (122 words)

### Script (true spelling: this is the subtitle text)

From late 1991, Stepanakert lay under siege. Azerbaijani forces held Shushi on the heights above, and from there they fired on the city below.

The chief weapon was the BM-21 Grad, a truck-mounted launcher that throws a ripple of forty rockets at once. Rockets struck houses, schools, the silk factory and the maternity hospital. Families moved into basements, and the city lived by candle and radio.

The war had grown from the Karabakh movement of 1988, and every side lost civilians.

On the night of 8 May 1992, Armenian units under Arkady Ter-Tadevosyan attacked Shushi up the cliffs and roads. By 9 May the town was taken, and the bombardment of Stepanakert ended.

Keep the basements safe until the heights are won.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. From late 1991, Stepanakert lay under siege.
   - engine: `From late 1991, [[stˌɛpənəkˈɛɹt]] lay under siege.`
   - sources: C1 (first sentence)
2. Azerbaijani forces held Shushi on the heights above, and from there they fired on the city below.
   - engine: `Azerbaijani forces held [[ʃˈuːʃi]] on the heights above, and from there they fired on the city below.`
   - sources: C1 (second sentence)
3. The chief weapon was the BM-21 Grad, a truck-mounted launcher that throws a ripple of forty rockets at once.
   - engine: `The chief weapon was the B M twenty-one [[ɡɹˈæd]], a truck-mounted launcher that throws a ripple of forty rockets at once.`
   - sources: C1 (third sentence); units (boss: BM-21 Grad battery)
4. Rockets struck houses, schools, the silk factory and the maternity hospital.
   - engine: `Rockets struck houses, schools, the silk factory and the maternity hospital.`
   - sources: C1 (fourth sentence)
5. Families moved into basements, and the city lived by candle and radio.
   - engine: `Families moved into basements, and the city lived by candle and radio.`
   - sources: C1 (last sentence)
6. The war had grown from the Karabakh movement of 1988, and every side lost civilians.
   - engine: `The war had grown from the [[kˌɑːɹɑːbˈɑːk]] movement of 1988, and every side lost civilians.`
   - sources: C2
7. On the night of 8 May 1992, Armenian units under Arkady Ter-Tadevosyan attacked Shushi up the cliffs and roads.
   - engine: `On the night of 8 May 1992, Armenian units under [[ɑːɹkˈɑːdi]] [[tˈɛɹ tˌɑːdɛvɔːsjˈɑːn]] attacked [[ʃˈuːʃi]] up the cliffs and roads.`
   - sources: C3 (second sentence: Armenian units under Arkady Ter-Tadevosyan, known as Komandos, attacked the fortress town from several directions up the cliffs and roads); hero
8. By 9 May the town was taken, and the bombardment of Stepanakert ended.
   - engine: `By 9 May the town was taken, and the bombardment of [[stˌɛpənəkˈɛɹt]] ended.`
   - sources: C3 (third sentence); V
9. Keep the basements safe until the heights are won.
   - engine: `Keep the basements safe until the heights are won.`
   - sources: C4 (last sentence)

## Vertical cut (55 words)

### Script (true spelling: this is the subtitle text)

From late 1991, Stepanakert lay under siege, under the guns of the Shushi plateau. Grad rockets struck houses and schools, and families lived in basements.

On 8 May 1992, Armenian units attacked Shushi, and by 9 May the town was taken. The bombardment of Stepanakert ended.

Keep the basements safe until the heights are won.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. From late 1991, Stepanakert lay under siege, under the guns of the Shushi plateau.
   - engine: `From late 1991, [[stˌɛpənəkˈɛɹt]] lay under siege, under the guns of the [[ʃˈuːʃi]] plateau.`
   - sources: C1 (first two sentences); chapter V intro (Stepanakert lay in a valley under the guns of the Shushi plateau)
2. Grad rockets struck houses and schools, and families lived in basements.
   - engine: `[[ɡɹˈæd]] rockets struck houses and schools, and families lived in basements.`
   - sources: C1 (third to last sentences)
3. On 8 May 1992, Armenian units attacked Shushi, and by 9 May the town was taken.
   - engine: `On 8 May 1992, Armenian units attacked [[ʃˈuːʃi]], and by 9 May the town was taken.`
   - sources: C3 (second and third sentences); V
4. The bombardment of Stepanakert ended.
   - engine: `The bombardment of [[stˌɛpənəkˈɛɹt]] ended.`
   - sources: C3 (third sentence); V (the Grad fire on Stepanakert ended)
5. Keep the basements safe until the heights are won.
   - engine: `Keep the basements safe until the heights are won.`
   - sources: C4 (last sentence)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Stepanakert | `stˌɛpənəkˈɛɹt` | steh-pah-nah-KERT |
| Shushi | `ʃˈuːʃi` | SHOO-shee |
| Grad | `ɡɹˈæd` | GRAD |
| Arkady | `ɑːɹkˈɑːdi` | ar-KAH-dee |
| Ter-Tadevosyan | `tˈɛɹ tˌɑːdɛvɔːsjˈɑːn` | TER tah-deh-vo-SYAHN |
| Karabakh | `kˌɑːɹɑːbˈɑːk` | kah-rah-BAHK |
