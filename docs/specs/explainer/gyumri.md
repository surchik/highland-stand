# Explainer video: Gyumri Road (1579 AD)

Battlefield id `gyumri`. Files: `assets/explainer/gyumri/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

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

## Landscape cut (115 words)

### Script (true spelling: this is the subtitle text)

Kumayri, today's Gyumri, was an old village on the plain of Shirak, beneath Mount Aragats. In the sixteenth century the highlands became the battlefield of two empires, Ottoman and Safavid. In 1555 the Peace of Amasya split Armenia between them.

In 1578 the war began again. In 1579 the Ottoman commander Lala Mustafa Pasha refortified Kars, west of Kumayri. That October, Ottoman raiders struck Erivan.

No fighting at Kumayri itself is recorded that year, but the war stood on both sides of it. For Shirak, it meant armies on the road, again and again.

From 1604 Shah Abbas deported whole Armenian communities to Persia, and Shirak was among the lands emptied.

Hold the winter road.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Kumayri, today's Gyumri, was an old village on the plain of Shirak, beneath Mount Aragats.
   - engine: `[[kuːmˈaɪɹi]], today's [[ɡjˈuːmɹi]], was an old village on the plain of [[ʃiːɹˈɑːk]], beneath Mount [[ˌɑːɹɑːɡˈɑːts]].`
   - sources: C1 (Kumayri, today's Gyumri, an old village on the plain of Shirak beneath Mount Aragats); tag
2. In the sixteenth century the highlands became the battlefield of two empires, Ottoman and Safavid.
   - engine: `In the sixteenth century the highlands became the battlefield of two empires, Ottoman and Safavid.`
   - sources: C1 (in the 16th century the highlands became the battlefield of two empires, Ottoman and Safavid)
3. In 1555 the Peace of Amasya split Armenia between them.
   - engine: `In fifteen fifty-five the Peace of [[ɑːmˈɑːsjɑː]] split Armenia between them.`
   - sources: C1 (in 1555 the Peace of Amasya split Armenia between the empires); F2
4. In 1578 the war began again.
   - engine: `In fifteen seventy-eight the war began again.`
   - sources: C2 (In 1578 the Ottomans went to war again); CH3.6
5. In 1579 the Ottoman commander Lala Mustafa Pasha refortified Kars, west of Kumayri.
   - engine: `In fifteen seventy-nine the Ottoman commander [[lˈɑːlə mˈʊstəfə pˈɑːʃə]] refortified [[kˈɑːɹs]], west of [[kuːmˈaɪɹi]].`
   - sources: C2 (In 1579 Lala Mustafa Pasha, commander-in-chief, refortified Kars; the sultan's new frontier base stood west of Kumayri); F1
6. That October, Ottoman raiders struck Erivan.
   - engine: `That October, Ottoman raiders struck [[ˌɛɹɪvˈɑːn]].`
   - sources: C3 (In October 1579 Ottoman raiders struck Erivan)
7. No fighting at Kumayri itself is recorded that year, but the war stood on both sides of it.
   - engine: `No fighting at [[kuːmˈaɪɹi]] itself is recorded that year, but the war stood on both sides of it.`
   - sources: C3 (No fighting at Kumayri itself is recorded that year, but the war stood on both sides of it); V
8. For Shirak, it meant armies on the road, again and again.
   - engine: `For [[ʃiːɹˈɑːk]], it meant armies on the road, again and again.`
   - sources: C3 (For Shirak it meant armies on the road); C1 (their armies crossed Shirak again and again)
9. From 1604 Shah Abbas deported whole Armenian communities to Persia, and Shirak was among the lands emptied.
   - engine: `From sixteen oh four Shah [[ɑːbˈɑːs]] deported whole Armenian communities to Persia, and [[ʃiːɹˈɑːk]] was among the lands emptied.`
   - sources: C4 (from 1604 Shah Abbas deported whole Armenian communities to Persia; Zakaria of Kanaker names Shirak among the lands emptied); D
10. Hold the winter road.
   - engine: `Hold the winter road.`
   - sources: C4 (Hold the winter road)

## Vertical cut (55 words)

### Script (true spelling: this is the subtitle text)

In 1579 two empires, Ottoman and Safavid, were at war across the Armenian highlands. Their armies crossed the plain of Shirak, beneath Mount Aragats, again and again.

From 1604 Shah Abbas deported whole Armenian communities, and Shirak was among the lands emptied.

Hold the winter road for the villagers in the path of both empires.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In 1579 two empires, Ottoman and Safavid, were at war across the Armenian highlands.
   - engine: `In fifteen seventy-nine two empires, Ottoman and Safavid, were at war across the Armenian highlands.`
   - sources: C1 (two empires, Ottoman and Safavid); C2 (the war of 1578 and 1579)
2. Their armies crossed the plain of Shirak, beneath Mount Aragats, again and again.
   - engine: `Their armies crossed the plain of [[ʃiːɹˈɑːk]], beneath Mount [[ˌɑːɹɑːɡˈɑːts]], again and again.`
   - sources: C1 (their armies crossed Shirak again and again; the plain of Shirak beneath Mount Aragats); V
3. From 1604 Shah Abbas deported whole Armenian communities, and Shirak was among the lands emptied.
   - engine: `From sixteen oh four Shah [[ɑːbˈɑːs]] deported whole Armenian communities, and [[ʃiːɹˈɑːk]] was among the lands emptied.`
   - sources: C4; D (from 1604 Shah Abbas deported whole Armenian communities; Shirak among the lands emptied)
4. Hold the winter road for the villagers in the path of both empires.
   - engine: `Hold the winter road for the villagers in the path of both empires.`
   - sources: C4 (Hold the winter road); V (the villagers who lived in the path of both empires)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Kumayri | `kuːmˈaɪɹi` | koo-MY-ree |
| Gyumri | `ɡjˈuːmɹi` | GYOOM-ree |
| Shirak | `ʃiːɹˈɑːk` | shee-RAHK |
| Aragats | `ˌɑːɹɑːɡˈɑːts` | ah-rah-GAHTS |
| Amasya | `ɑːmˈɑːsjɑː` | ah-MAH-syah |
| Lala Mustafa Pasha | `lˈɑːlə mˈʊstəfə pˈɑːʃə` | LAH-lah MOO-stah-fah PAH-shah |
| Kars | `kˈɑːɹs` | KARS |
| Erivan | `ˌɛɹɪvˈɑːn` | eh-ri-VAHN |
| Abbas | `ɑːbˈɑːs` | ah-BAHS |
