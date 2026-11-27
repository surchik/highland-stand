# Explainer video: Musa Dagh (1915)

Battlefield id `musadagh`. Files: `assets/explainer/musadagh/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 1.03 (landscape) and 1.02 (upright) (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html (its chronicle, tag, hero, date, facts, victory and defeat texts) and its chapter's story. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html
- `V / D`: the battlefield's victory / defeat text
- `hero / tag / date / facts / towers / units`: the battlefield's own fields in index.html
- `chapter V intro`: CHAPTERS (Artsakh).intro in index.html

## Landscape cut (131 words)

### Script (true spelling: this is the subtitle text)

Musa Dagh, the Mountain of Moses, rises from the Mediterranean coast north of the bay of Antioch. Below it lay six Armenian villages.

In the summer of 1915 they received the order for deportation, and they knew what deportation meant. Most villagers refused to go. More than 4,000 people drove their flocks up the mountain and dug in.

With Movses Ter-Kalustian among their leaders, some 600 fighters blocked the paths and threw the attackers back again and again.

The villagers sewed two great banners: a red cross, and the words 'Christians in distress: rescue'.

On 5 September the French cruiser Guichen saw the signals. From 12 September, five French ships carried about 4,000 Armenians to Port Said, and the mountain had never been taken.

Hold Musa Dagh until the ships come.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Musa Dagh, the Mountain of Moses, rises from the Mediterranean coast north of the bay of Antioch.
   - engine: `[[mˈuːsɑː dˈæɡ]], the Mountain of Moses, rises from the Mediterranean coast north of the bay of Antioch.`
   - sources: C1 (first sentence)
2. Below it lay six Armenian villages.
   - engine: `Below it lay six Armenian villages.`
   - sources: C1 (second sentence)
3. In the summer of 1915 they received the order for deportation, and they knew what deportation meant.
   - engine: `In the summer of 1915 they received the order for deportation, and they knew what deportation meant.`
   - sources: C1 (third and fourth sentences: the convoys of Cilicia were already moving south toward the desert)
4. Most villagers refused to go.
   - engine: `Most villagers refused to go.`
   - sources: C1 (fifth sentence)
5. More than 4,000 people drove their flocks up the mountain and dug in.
   - engine: `More than four thousand people drove their flocks up the mountain and dug in.`
   - sources: C1 (last sentence)
6. With Movses Ter-Kalustian among their leaders, some 600 fighters blocked the paths and threw the attackers back again and again.
   - engine: `With [[mˈoʊvsɛs]] [[tˈɛɹ kˌɑːluːstjˈɑːn]] among their leaders, some six hundred fighters blocked the paths and threw the attackers back again and again.`
   - sources: C2 (a defense committee formed, with Movses Ter-Kalustian among its leaders; some 600 fighters; the defenders blocked the paths and threw the attackers back again and again); hero (Movses Ter-Kalustian, Commander on Musa Dagh)
7. The villagers sewed two great banners: a red cross, and the words 'Christians in distress: rescue'.
   - engine: `The villagers sewed two great banners: a red cross, and the words 'Christians in distress: rescue'.`
   - sources: C3 (first two sentences); towers (Rescue Banners)
8. On 5 September the French cruiser Guichen saw the signals.
   - engine: `On 5 September the French cruiser [[ɡiʃˈɛn]] saw the signals.`
   - sources: C3 (third sentence); facts (the Guichen first saw the banners on 5 September 1915)
9. From 12 September, five French ships carried about 4,000 Armenians to Port Said, and the mountain had never been taken.
   - engine: `From 12 September, five French ships carried about four thousand Armenians to [[pˈɔːɹt sɑːˈiːd]], and the mountain had never been taken.`
   - sources: C3 (from 12 September five French ships carried about 4,000 Armenians to Port Said in Egypt; the mountain had never been taken); V
10. Hold Musa Dagh until the ships come.
   - engine: `Hold [[mˈuːsɑː dˈæɡ]] until the ships come.`
   - sources: C4 (last sentence)

## Vertical cut (63 words)

### Script (true spelling: this is the subtitle text)

In the summer of 1915, six Armenian villages below Musa Dagh received the order for deportation. More than 4,000 people drove their flocks up the mountain and dug in.

They held for 53 days, and sewed two great banners to call for rescue.

French ships saw the signals, and carried about 4,000 Armenians to Port Said.

Hold Musa Dagh until the ships come.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In the summer of 1915, six Armenian villages below Musa Dagh received the order for deportation.
   - engine: `In the summer of 1915, six Armenian villages below [[mˈuːsɑː dˈæɡ]] received the order for deportation.`
   - sources: C1 (second and third sentences)
2. More than 4,000 people drove their flocks up the mountain and dug in.
   - engine: `More than four thousand people drove their flocks up the mountain and dug in.`
   - sources: C1 (last sentence)
3. They held for 53 days, and sewed two great banners to call for rescue.
   - engine: `They held for 53 days, and sewed two great banners to call for rescue.`
   - sources: facts (the resistance lasted 53 days); C3 (two great banners; 'Christians in distress: rescue')
4. French ships saw the signals, and carried about 4,000 Armenians to Port Said.
   - engine: `French ships saw the signals, and carried about four thousand Armenians to [[pˈɔːɹt sɑːˈiːd]].`
   - sources: C3 (the French cruiser Guichen saw the signals; five French ships carried about 4,000 Armenians to Port Said); V
5. Hold Musa Dagh until the ships come.
   - engine: `Hold [[mˈuːsɑː dˈæɡ]] until the ships come.`
   - sources: C4 (last sentence)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Musa Dagh | `mˈuːsɑː dˈæɡ` | MOO-sah DAHG |
| Ter-Kalustian | `tˈɛɹ kˌɑːluːstjˈɑːn` | TER kah-loo-STYAHN |
| Movses | `mˈoʊvsɛs` | MOHV-ses |
| Guichen | `ɡiʃˈɛn` | gee-SHEN |
| Port Said | `pˈɔːɹt sɑːˈiːd` | port sah-EED |
