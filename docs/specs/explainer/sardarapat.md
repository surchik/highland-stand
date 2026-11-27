# Explainer video: Sardarapat (1918)

Battlefield id `sardarapat`. Files: `assets/explainer/sardarapat/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 1.1 (landscape) and 1.06 (upright) (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html (its chronicle, tag, hero, date, facts, victory and defeat texts) and its chapter's story. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html
- `V / D`: the battlefield's victory / defeat text
- `hero / tag / date / facts / towers / units`: the battlefield's own fields in index.html
- `chapter V intro`: CHAPTERS (Artsakh).intro in index.html

## Landscape cut (125 words)

### Script (true spelling: this is the subtitle text)

In the spring of 1918, the Ottoman army marched east. Three columns pushed toward Yerevan: past Sardarapat, through Bash Abaran, and toward Karakilisa.

Behind the thin Armenian front were the last Armenian lands of the Caucasus, and hundreds of thousands of refugees from the Genocide.

General Movses Silikyan gathered what he had: Armenian regiments, volunteers, refugees and villagers, and the Yazidi horsemen of Jangir Agha. Tradition holds that the Catholicos had the church bells rung to call the people to battle.

On 22 May the Armenians counterattacked beneath Ararat, and over the next days drove the Ottoman troops back. Taken together, the May battles stopped the Ottoman drive on Yerevan.

On 28 May 1918, the First Republic of Armenia was born.

Not one step back.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In the spring of 1918, the Ottoman army marched east.
   - engine: `In the spring of 1918, the Ottoman army marched east.`
   - sources: C1 (first sentence: in spring 1918 the Russian army had dissolved and the Ottoman army marched east)
2. Three columns pushed toward Yerevan: past Sardarapat, through Bash Abaran, and toward Karakilisa.
   - engine: `Three columns pushed toward [[jˌɛɹɛvˈɑːn]]: past [[sˌɑːɹdɑːɹɑːpˈɑːt]], through [[bˈɑːʃ ˌɑːbɑːɹˈɑːn]], and toward [[kˌɑːɹɑːkˌɪlɪsˈɑː]].`
   - sources: C1 (third sentence: one along the railway past Sardarapat on the Ararat plain, one through the pass at Bash Abaran, and one toward Karakilisa)
3. Behind the thin Armenian front were the last Armenian lands of the Caucasus, and hundreds of thousands of refugees from the Genocide.
   - engine: `Behind the thin Armenian front were the last Armenian lands of the Caucasus, and hundreds of thousands of refugees from the Genocide.`
   - sources: C1 (fourth sentence)
4. General Movses Silikyan gathered what he had: Armenian regiments, volunteers, refugees and villagers, and the Yazidi horsemen of Jangir Agha.
   - engine: `General [[mˈoʊvsɛs]] [[sˌɪlɪkjˈɑːn]] gathered what he had: Armenian regiments, volunteers, refugees and villagers, and the [[jəzˈiːdi]] horsemen of [[dʒɑːŋɡˈiːɹ ˈɑːɡɑː]].`
   - sources: C2 (second sentence); hero (Movses Silikyan, Commander at Sardarapat)
5. Tradition holds that the Catholicos had the church bells rung to call the people to battle.
   - engine: `Tradition holds that the [[kɐθˈɑːlɪkoʊs]] had the church bells rung to call the people to battle.`
   - sources: C2 (third sentence: tradition holds that Catholicos Gevorg V refused to leave Etchmiadzin and ordered the church bells rung to call the people to battle); towers (Etchmiadzin Bells)
6. On 22 May the Armenians counterattacked beneath Ararat, and over the next days drove the Ottoman troops back.
   - engine: `On 22 May the Armenians counterattacked beneath Ararat, and over the next days drove the Ottoman troops back.`
   - sources: C3 (first two sentences: on 22 May the Armenians counterattacked across the plain beneath Ararat; over the next days they drove the Ottoman troops back westward); facts (the Armenian counterattack began on 22 May)
7. Taken together, the May battles stopped the Ottoman drive on Yerevan.
   - engine: `Taken together, the May battles stopped the Ottoman drive on [[jˌɛɹɛvˈɑːn]].`
   - sources: C3 (last sentence); facts (three battles at once: Sardarapat, Bash Abaran and Karakilisa)
8. On 28 May 1918, the First Republic of Armenia was born.
   - engine: `On 28 May 1918, the First Republic of Armenia was born.`
   - sources: C4 (first sentence); V; facts
9. Not one step back.
   - engine: `Not one step back.`
   - sources: C4 (last sentence)

## Vertical cut (59 words)

### Script (true spelling: this is the subtitle text)

In May 1918, three Ottoman columns pushed toward Yerevan. Behind the thin front were hundreds of thousands of refugees from the Genocide.

General Movses Silikyan gathered what he had.

On 22 May, the Armenians counterattacked beneath Ararat. The May battles stopped the Ottoman drive, and on 28 May the First Republic of Armenia was born.

Not one step back.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In May 1918, three Ottoman columns pushed toward Yerevan.
   - engine: `In May 1918, three Ottoman columns pushed toward [[jˌɛɹɛvˈɑːn]].`
   - sources: C1 (three columns now pushed toward Yerevan); date (21 to 29 May 1918)
2. Behind the thin front were hundreds of thousands of refugees from the Genocide.
   - engine: `Behind the thin front were hundreds of thousands of refugees from the Genocide.`
   - sources: C1 (fourth sentence)
3. General Movses Silikyan gathered what he had.
   - engine: `General [[mˈoʊvsɛs]] [[sˌɪlɪkjˈɑːn]] gathered what he had.`
   - sources: C2 (second sentence: General Movses Silikyan gathered what he had); hero
4. On 22 May, the Armenians counterattacked beneath Ararat.
   - engine: `On 22 May, the Armenians counterattacked beneath Ararat.`
   - sources: C3 (first sentence: on 22 May the Armenians counterattacked across the plain beneath Ararat)
5. The May battles stopped the Ottoman drive, and on 28 May the First Republic of Armenia was born.
   - engine: `The May battles stopped the Ottoman drive, and on 28 May the First Republic of Armenia was born.`
   - sources: C3 (last sentence); C4 (first sentence)
6. Not one step back.
   - engine: `Not one step back.`
   - sources: C4 (last sentence)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Yerevan | `jˌɛɹɛvˈɑːn` | yeh-reh-VAHN |
| Movses | `mˈoʊvsɛs` | MOHV-ses |
| Sardarapat | `sˌɑːɹdɑːɹɑːpˈɑːt` | sar-dah-rah-PAHT |
| Bash Abaran | `bˈɑːʃ ˌɑːbɑːɹˈɑːn` | BAHSH ah-bah-RAHN |
| Karakilisa | `kˌɑːɹɑːkˌɪlɪsˈɑː` | kah-rah-ki-li-SAH |
| Silikyan | `sˌɪlɪkjˈɑːn` | si-li-KYAHN |
| Yazidi | `jəzˈiːdi` | yuh-ZEE-dee |
| Jangir Agha | `dʒɑːŋɡˈiːɹ ˈɑːɡɑː` | jahn-GEER AH-gah |
| Catholicos | `kɐθˈɑːlɪkoʊs` | ka-THOL-i-kos |
