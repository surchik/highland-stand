# Explainer video: Shushi (2020)

Battlefield id `shushi`. Files: `assets/explainer/shushi/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 0.94 (landscape) and 1.02 (upright) (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html (its chronicle, tag, hero, date, facts, victory and defeat texts) and its chapter's story. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html
- `V / D`: the battlefield's victory / defeat text
- `hero / tag / date / facts / towers / units`: the battlefield's own fields in index.html
- `chapter V intro`: CHAPTERS (Artsakh).intro in index.html

## Landscape cut (122 words)

### Script (true spelling: this is the subtitle text)

On 27 September 2020, Azerbaijan launched an offensive along the whole line of contact, and war returned to Artsakh after a quarter century.

This war was fought from the sky. Bayraktar drones and loitering munitions such as the Harop hunted air defense radars, tanks and artillery.

Civilians were struck on both sides, and Ghazanchetsots Cathedral in Shushi was struck twice.

In early November, Azerbaijani special forces climbed through the forests to the Shushi plateau. After days of fighting, the town fell.

On 9 November a statement ended the fighting, and Shushi passed to Azerbaijan. The war was lost, but young conscripts and volunteers had held the line for 44 days.

Hold the heights, defender, for as long as they can be held.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. On 27 September 2020, Azerbaijan launched an offensive along the whole line of contact, and war returned to Artsakh after a quarter century.
   - engine: `On 27 September 2020, Azerbaijan launched an offensive along the whole line of contact, and war returned to [[ˈɑːɹtsɑːk]] after a quarter century.`
   - sources: C1 (first sentence)
2. This war was fought from the sky.
   - engine: `This war was fought from the sky.`
   - sources: C1 (second sentence)
3. Bayraktar drones and loitering munitions such as the Harop hunted air defense radars, tanks and artillery.
   - engine: `[[bˌaɪɹɑːktˈɑːɹ]] drones and loitering munitions such as the [[hˈæɹɑːp]] hunted air defense radars, tanks and artillery.`
   - sources: C1 (third sentence: Turkish-made Bayraktar TB2 drones and Israeli-made loitering munitions such as the Harop hunted air defense radars, tanks and artillery)
4. Civilians were struck on both sides, and Ghazanchetsots Cathedral in Shushi was struck twice.
   - engine: `Civilians were struck on both sides, and [[ɡˌɑːzɑːntʃɛtsˈɔːts]] Cathedral in [[ʃˈuːʃi]] was struck twice.`
   - sources: C2 (first sentence; on 8 October Ghazanchetsots Cathedral in Shushi was struck twice); facts
5. In early November, Azerbaijani special forces climbed through the forests to the Shushi plateau.
   - engine: `In early November, Azerbaijani special forces climbed through the forests to the [[ʃˈuːʃi]] plateau.`
   - sources: C3 (last sentence)
6. After days of fighting, the town fell.
   - engine: `After days of fighting, the town fell.`
   - sources: C3 (last sentence: after days of fighting the town fell around 8 November); D
7. On 9 November a statement ended the fighting, and Shushi passed to Azerbaijan.
   - engine: `On 9 November a statement ended the fighting, and [[ʃˈuːʃi]] passed to Azerbaijan.`
   - sources: C4 (first two sentences); V
8. The war was lost, but young conscripts and volunteers had held the line for 44 days.
   - engine: `The war was lost, but young conscripts and volunteers had held the line for 44 days.`
   - sources: C4 (fifth sentence); V
9. Hold the heights, defender, for as long as they can be held.
   - engine: `Hold the heights, defender, for as long as they can be held.`
   - sources: C4 (last sentence)

## Vertical cut (62 words)

### Script (true spelling: this is the subtitle text)

In the autumn of 2020, war returned to Artsakh for 44 days, fought with drones above the ridgelines.

Civilians were struck on both sides, and Ghazanchetsots Cathedral in Shushi was struck twice.

In early November, Azerbaijani special forces climbed to the Shushi plateau, and the town fell. Young conscripts and volunteers had held the line to the end.

Hold the heights, defender.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In the autumn of 2020, war returned to Artsakh for 44 days, fought with drones above the ridgelines.
   - engine: `In the autumn of 2020, war returned to [[ˈɑːɹtsɑːk]] for 44 days, fought with drones above the ridgelines.`
   - sources: chapter V intro (in autumn 2020 war returned for 44 days, fought with drones above the ridgelines); C1
2. Civilians were struck on both sides, and Ghazanchetsots Cathedral in Shushi was struck twice.
   - engine: `Civilians were struck on both sides, and [[ɡˌɑːzɑːntʃɛtsˈɔːts]] Cathedral in [[ʃˈuːʃi]] was struck twice.`
   - sources: C2 (first sentence; on 8 October Ghazanchetsots Cathedral in Shushi was struck twice); facts
3. In early November, Azerbaijani special forces climbed to the Shushi plateau, and the town fell.
   - engine: `In early November, Azerbaijani special forces climbed to the [[ʃˈuːʃi]] plateau, and the town fell.`
   - sources: C3 (last sentence)
4. Young conscripts and volunteers had held the line to the end.
   - engine: `Young conscripts and volunteers had held the line to the end.`
   - sources: C4 (young conscripts and volunteers had held the line for 44 days); V (the conscripts and volunteers who defended the plateau to the end)
5. Hold the heights, defender.
   - engine: `Hold the heights, defender.`
   - sources: C4 (last sentence)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Shushi | `ʃˈuːʃi` | SHOO-shee |
| Artsakh | `ˈɑːɹtsɑːk` | AHRT-sahk |
| Ghazanchetsots | `ɡˌɑːzɑːntʃɛtsˈɔːts` | gah-zahn-chet-SOTS |
| Bayraktar | `bˌaɪɹɑːktˈɑːɹ` | bai-rahk-TAR |
| Harop | `hˈæɹɑːp` | HA-rop |
