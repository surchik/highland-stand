# Explainer video: Stepanakert 2023 (2022 to 2023)

Battlefield id `stepanakert23`. Files: `assets/explainer/stepanakert23/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 1.08 (landscape) and 0.94 (upright) (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html (its chronicle, tag, hero, date, facts, victory and defeat texts) and its chapter's story. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html
- `V / D`: the battlefield's victory / defeat text
- `hero / tag / date / facts / towers / units`: the battlefield's own fields in index.html
- `chapter V intro`: CHAPTERS (Artsakh).intro in index.html

## Landscape cut (114 words)

### Script (true spelling: this is the subtitle text)

On 12 December 2022, Azerbaijani protesters, widely seen as backed by their government, blocked the Lachin corridor, the only road from Artsakh to Armenia. Some 120,000 people were cut off.

From mid-June, even Red Cross deliveries were stopped. Food, medicine and fuel ran short, and families queued for bread.

In February 2023, the International Court of Justice ordered Azerbaijan to ensure unimpeded movement along the corridor, but the road stayed closed.

On 19 September, Azerbaijan opened an offensive, and a ceasefire the next day ended Artsakh's defense.

Almost the whole population took the open corridor to Armenia, in cars, trucks and buses.

Endure, defender. Carry the people and their memory out of the valley.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. On 12 December 2022, Azerbaijani protesters, widely seen as backed by their government, blocked the Lachin corridor, the only road from Artsakh to Armenia.
   - engine: `On 12 December 2022, Azerbaijani protesters, widely seen as backed by their government, blocked the [[lɑːtʃˈiːn]] corridor, the only road from [[ˈɑːɹtsɑːk]] to Armenia.`
   - sources: C1 (first sentence); facts
2. Some 120,000 people were cut off.
   - engine: `Some a hundred and twenty thousand people were cut off.`
   - sources: C1 (second sentence)
3. From mid-June, even Red Cross deliveries were stopped.
   - engine: `From mid June, even Red Cross deliveries were stopped.`
   - sources: C1 (fourth sentence)
4. Food, medicine and fuel ran short, and families queued for bread.
   - engine: `Food, medicine and fuel ran short, and families queued for bread.`
   - sources: C1 (fifth sentence)
5. In February 2023, the International Court of Justice ordered Azerbaijan to ensure unimpeded movement along the corridor, but the road stayed closed.
   - engine: `In February 2023, the International Court of Justice ordered Azerbaijan to ensure unimpeded movement along the corridor, but the road stayed closed.`
   - sources: C2 (first sentence: on 22 February 2023 the International Court of Justice ordered Azerbaijan to ensure unimpeded movement of persons, vehicles and cargo along the corridor in both directions); C2 (second sentence: the road stayed closed); facts
6. On 19 September, Azerbaijan opened an offensive, and a ceasefire the next day ended Artsakh's defense.
   - engine: `On 19 September, Azerbaijan opened an offensive, and a ceasefire the next day ended [[ˈɑːɹtsɑːkz]] defense.`
   - sources: C2 (last sentence: a ceasefire on 20 September ended Artsakh's defense)
7. Almost the whole population took the open corridor to Armenia, in cars, trucks and buses.
   - engine: `Almost the whole population took the open corridor to Armenia, in cars, trucks and buses.`
   - sources: C3 (from 24 September almost the whole population took the open corridor to Armenia, in cars, trucks and buses)
8. Endure, defender.
   - engine: `Endure, defender.`
   - sources: C4 (last sentences)
9. Carry the people and their memory out of the valley.
   - engine: `Carry the people and their memory out of the valley.`
   - sources: C4 (last sentence)

## Vertical cut (54 words)

### Script (true spelling: this is the subtitle text)

In December 2022, the only road from Artsakh to Armenia, the Lachin corridor, was closed. Food, medicine and fuel ran short.

In September 2023, a final offensive forced the surrender of Artsakh. Within about a week, more than 100,000 people had fled to Armenia.

Carry the people and their memory out of the valley.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In December 2022, the only road from Artsakh to Armenia, the Lachin corridor, was closed.
   - engine: `In December 2022, the only road from [[ˈɑːɹtsɑːk]] to Armenia, the [[lɑːtʃˈiːn]] corridor, was closed.`
   - sources: chapter V intro (in December 2022 the only road to Armenia, the Lachin corridor, was closed); C1
2. Food, medicine and fuel ran short.
   - engine: `Food, medicine and fuel ran short.`
   - sources: C1 (fifth sentence); V (nine months of blockade)
3. In September 2023, a final offensive forced the surrender of Artsakh.
   - engine: `In September 2023, a final offensive forced the surrender of [[ˈɑːɹtsɑːk]].`
   - sources: chapter V intro (in September 2023 a final offensive forced the surrender of Artsakh); C2 (last sentence)
4. Within about a week, more than 100,000 people had fled to Armenia.
   - engine: `Within about a week, more than a hundred thousand people had fled to Armenia.`
   - sources: chapter V intro (within about a week more than 100,000 people, nearly its entire Armenian population, had fled to Armenia); V
5. Carry the people and their memory out of the valley.
   - engine: `Carry the people and their memory out of the valley.`
   - sources: C4 (last sentence)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Artsakh | `ˈɑːɹtsɑːk` | AHRT-sahk |
| Lachin | `lɑːtʃˈiːn` | lah-CHEEN |
