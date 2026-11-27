# Explainer video: Van (1915)

Battlefield id `van`. Files: `assets/explainer/van/landscape.mp4`, `vertical.mp4` (and `.webm` where it is smaller), `landscape.vtt`, `vertical.vtt`, `landscape-poster.jpg`, `vertical-poster.jpg`.

Voice: kokoro:am_michael at speed 1.02 (landscape) and 0.97 (upright) (Kokoro-82M v1.0 (hexgrad), run through kokoro-onnx 0.6.1; Apache-2.0 (the model and its voices, huggingface.co/hexgrad/Kokoro-82M)). See voice.md.

Every line is taken from the battlefield's own texts in index.html (its chronicle, tag, hero, date, facts, victory and defeat texts) and its chapter's story. Source keys:

- `C<n>`: paragraph n of the battlefield's chronicle in index.html
- `V / D`: the battlefield's victory / defeat text
- `hero / tag / date / facts / towers / units`: the battlefield's own fields in index.html
- `chapter V intro`: CHAPTERS (Artsakh).intro in index.html

## Landscape cut (123 words)

### Script (true spelling: this is the subtitle text)

Early in 1915, Djevdet Bey, governor of Van, demanded 4,000 Armenian men for the army's labor battalions. Van's Armenians understood what was coming.

Two self-defense committees formed, in Aygestan, the garden quarter, and in the walled city beneath Van Rock.

Aram Manukian stood among their leaders. About 1,500 fighters had only some 300 modern rifles. From 20 April, the Ottoman guns opened on both quarters.

For four weeks, shells fell on homes, on the American mission and on Dr Ussher's hospital.

In mid-May the besiegers began to pull back, and Armenian volunteers and the Russian army rode in. The defenders saved the city's Armenians from the massacres that destroyed the villages around them.

Hold every wall and every garden until the riders come.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. Early in 1915, Djevdet Bey, governor of Van, demanded 4,000 Armenian men for the army's labor battalions.
   - engine: `Early in 1915, [[dʒˈɛvdɛt]] Bey, governor of Van, demanded four thousand Armenian men for the army's labor battalions.`
   - sources: C1 (first two sentences: Djevdet Bey ruled Van as governor; he demanded 4,000 Armenian men for the army's labor battalions)
2. Van's Armenians understood what was coming.
   - engine: `Van's Armenians understood what was coming.`
   - sources: C2 (first sentence)
3. Two self-defense committees formed, in Aygestan, the garden quarter, and in the walled city beneath Van Rock.
   - engine: `Two self-defense committees formed, in [[ˌaɪɡɛstˈɑːn]], the garden quarter, and in the walled city beneath Van Rock.`
   - sources: C2 (second sentence: one in Aygestan, the garden suburb of orchards, and one in the old walled city beneath Van Rock); facts (Aygestan, Van's garden quarter; two committees)
4. Aram Manukian stood among their leaders.
   - engine: `[[ɑːɹˈɑːm mˌɑːnuːkjˈɑːn]] stood among their leaders.`
   - sources: C2 (third sentence); hero (Aram Manukian, Organizer of Van's Self-Defense)
5. About 1,500 fighters had only some 300 modern rifles.
   - engine: `About fifteen hundred fighters had only some three hundred modern rifles.`
   - sources: C2 (fourth sentence)
6. From 20 April, the Ottoman guns opened on both quarters.
   - engine: `From 20 April, the Ottoman guns opened on both quarters.`
   - sources: C2 (last sentence)
7. For four weeks, shells fell on homes, on the American mission and on Dr Ussher's hospital.
   - engine: `For four weeks, shells fell on homes, on the American mission and on Doctor [[ˈʌʃɚz]] hospital.`
   - sources: C3 (first sentence: for four weeks shells fell on homes, on the American mission and on Dr Clarence Ussher's hospital); facts (Ussher's hospital was shelled)
8. In mid-May the besiegers began to pull back, and Armenian volunteers and the Russian army rode in.
   - engine: `In mid May the besiegers began to pull back, and Armenian volunteers and the Russian army rode in.`
   - sources: C3 (in mid-May the besiegers began to pull back; on 18 May Armenian volunteers riding as the vanguard of the Russian army reached the city); V (in mid-May 1915 Armenian volunteers and the Russian army ride in)
9. The defenders saved the city's Armenians from the massacres that destroyed the villages around them.
   - engine: `The defenders saved the city's Armenians from the massacres that destroyed the villages around them.`
   - sources: V (the defenders saved the city's Armenians from the massacres that destroyed the villages around them); C3 (Van was relieved)
10. Hold every wall and every garden until the riders come.
   - engine: `Hold every wall and every garden until the riders come.`
   - sources: C4 (last sentence)

## Vertical cut (57 words)

### Script (true spelling: this is the subtitle text)

In the spring of 1915, the Armenians of Van formed two self-defense committees. About 1,500 fighters had only some 300 modern rifles.

From 20 April the Ottoman guns opened, and for four weeks the shells fell.

In mid-May, Armenian volunteers and the Russian army rode in, and Van was relieved.

Hold every wall until the riders come.

### Line by line: what the engine is fed, and where the line comes from

Names in double square brackets are IPA handed straight to the engine; numbers are spelled out.

1. In the spring of 1915, the Armenians of Van formed two self-defense committees.
   - engine: `In the spring of 1915, the Armenians of Van formed two self-defense committees.`
   - sources: tag (the self-defense of Van, 1915); C2 (two self-defense committees formed); date (20 April to mid-May 1915)
2. About 1,500 fighters had only some 300 modern rifles.
   - engine: `About fifteen hundred fighters had only some three hundred modern rifles.`
   - sources: C2 (fourth sentence)
3. From 20 April the Ottoman guns opened, and for four weeks the shells fell.
   - engine: `From 20 April the Ottoman guns opened, and for four weeks the shells fell.`
   - sources: C2 (last sentence); C3 (for four weeks shells fell)
4. In mid-May, Armenian volunteers and the Russian army rode in, and Van was relieved.
   - engine: `In mid May, Armenian volunteers and the Russian army rode in, and Van was relieved.`
   - sources: V (in mid-May 1915 Armenian volunteers and the Russian army ride in); C3 (Van was relieved)
5. Hold every wall until the riders come.
   - engine: `Hold every wall until the riders come.`
   - sources: C4 (last sentence)

## Names and how they are said

| In the subtitles | IPA fed to the engine | Roughly |
|---|---|---|
| Djevdet | `dʒˈɛvdɛt` | JEV-det |
| Aygestan | `ˌaɪɡɛstˈɑːn` | eye-geh-STAHN |
| Aram Manukian | `ɑːɹˈɑːm mˌɑːnuːkjˈɑːn` | ah-RAHM mah-noo-KYAHN |
| Ussher | `ˈʌʃɚ` | USH-er |
