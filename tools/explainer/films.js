// The picture of each cut: scenes and plaques, placed by the narration's sentences (scripts.json).
// A position p is a sentence's index; its fraction is how far through that sentence (3.5: half way through the
// fourth); "s/c" is the moment the words of part c of sentence s begin (its cues as scripts.json sets them, timed as
// the subtitles are), "s/c+0.6" a little after. film.js turns positions into seconds from the narration's own
// timings, so the picture follows the voice whatever the voice's pace.
//   scene: { at: p, kind: "map" | "field" | "art" | "card" | "stone", a: [cx, cy, zoom], b: [...] }  the camera moves a to b
//     map: chart units (720 x 400), markers: [{ node | xy, name, hy, sub, at: p, until: p }], an arrow { arrow: [[x, y], [x, y]] }
//          that grows as a march, a name in the chart's hand { xy, label, land (a land's name, spaced capitals), size }
//     field: the battlefield's own units (1280 x 720); stage: { mode: "empty" | "garrison" | "battle" | "march" | "fall", wave,
//            live, spawn: [{ at, role, n, d, road }], heroTo: [x, y] (he walks there), fallAt: p (he falls there),
//            corpses: [{ role, d, dx, dy, color }] (the dead of a lost field), noHero, level (another battlefield) }
//            keep: true goes on with the stage before it; follow: { type: "hero" | "boss" | <a foe's role>, dx, dy }
//            mode "march" is a column on the road and nothing else (no towers, no hero); "garrison" at a late wave is dusk
//            mode "fall" is the game's own picture of a lost stand (its defeat beat: the citadel burning at dusk)
//     art: the chronicle's painting (1600 x 1600), level: another battlefield's
//     card: a page of parchment with a rubric, a title and lines (lineAt: when each comes in), where the game has no
//           picture of the place; scroll: it unrolls; seal: "crown" | "cross" pressed at sealAt; emblem; bg: "map" | "dark" | "art"
//     stone: a block of cuneiform (1600 x 1000; wedge marks, no real text copied); tone: "pale" for limestone
//     any scene: tag (and tagSub): the place on screen named in a small plaque in the top right corner
//     zoom 1 is the plate covering the frame
//   chip: { from: p, to: p, text, sub }  the plaque in the top left corner (to: a whole number is that sentence's end)
// The title has the first seconds before the voice; the closing card comes up once the last line has been said.
// Avarayr is marked a little south of the campaign's node, off the Araxes (text-audit entry 2, claim 0: the field lay
// on the Tghmut, not at a crossing of the Araxes).
// The chart's Mt. Ararat label lies at y 380: cameras keep their lower edge above 366 so it is never cut.
// Tushpa is marked on the eastern shore of Lake Van (text-audit entry 1, claim 11), not at the campaign's node.
// Nothing important is set in the lowest fifth of the frame: the subtitles are drawn there.
// Every word on a plaque comes from the battlefield's own texts in index.html (its name, date, hero, chronicle, facts).
const T = (name, sub, extra) => Object.assign({ name, sub }, extra || {});
const HY = { erebuni: "Էրեբունի", tushpa: "Տուշպա", avarayr: "Ավարայր", dvin: "Դվին" };   // HY_NAMES.field in index.html

const VAN = [108, 282], ARAXES = [300, 226], AVA = [476, 314];
const TUSHPA = { xy: VAN, name: "Tushpa", sub: "By Lake Van", above: true };
module.exports = {
  "erebuni-landscape": {
    level: "erebuni",
    scenes: [
      { at: 0, kind: "map", a: [340, 195, 1.2], b: [175, 252, 1.75], markers: [Object.assign({ at: "0/0+1.0" }, TUSHPA)] },
      { at: "0/1+0.9", kind: "field", stage: { mode: "empty", wave: 0, level: "tushpa" }, a: [470, 175, 1.9], b: [600, 120, 2.6], tag: "Tushpa", tagSub: "The rock citadel" },
      { at: 1, kind: "map", a: [360, 210, 1.15], b: [290, 222, 1.4], markers: [{ xy: [215, 205], label: "Biainili", land: true, size: 36, at: "1/0+0.9" }] },
      { at: 2, kind: "art", level: "tushpa", a: [860, 780, 1.0], b: [620, 580, 1.5], tag: "Tushpa", tagSub: "The royal seat" },
      { at: 3, kind: "map", a: [400, 200, 1.3], b: [385, 195, 1.75], markers: [{ xy: [330, 228], label: "Araxes", rot: 0.06, at: 3 }, { arrow: [[352, 262], [369, 184]], at: 3.15 }, ]},
      { at: 4, kind: "field", stage: { mode: "empty", wave: 0 }, a: [330, 150, 2.3], b: [420, 110, 2.9] },
      { at: "4/1", kind: "map", a: [372, 190, 1.9], b: [372, 176, 2.25], markers: [{ node: "erebuni", name: "Arin Berd", sub: "782 BC", at: "4/1+0.2", big: true }] },
      { at: "4/2", kind: "art", a: [800, 700, 1.0], b: [800, 590, 1.3] },
      { at: 5, kind: "stone", a: [820, 560, 1.0], b: [640, 460, 1.5] },
      { at: 6, kind: "map", a: [372, 190, 1.7], b: [262, 236, 1.45], markers: [{ node: "erebuni", name: "Erebuni", hy: HY.erebuni, at: 6, until: "6/1" }, Object.assign({ at: 6.3 }, TUSHPA), { arrow: [[182, 276], [182, 306]], at: "6/1" }, { xy: [182, 264], label: "To Assyria", at: "6/1" }] },
      { at: 7, kind: "art", a: [700, 720, 1.5], b: [900, 700, 1.75] },
      { at: 7.32, kind: "map", a: [405, 175, 1.6], b: [520, 150, 1.75], markers: [{ node: "erebuni", name: "Erebuni", hy: HY.erebuni, at: 0 }, { arrow: [[392, 150], [606, 128]], at: 0.2 }] },
      { at: 8, kind: "field", stage: { mode: "garrison", wave: 1, noHero: true }, a: [470, 240, 1.6], b: [600, 170, 2.1] },
      { at: "8/1", kind: "stone", a: [560, 440, 1.6], b: [980, 420, 1.85] },
      { at: 9, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 0.2, role: "spearman", n: 2, d: 0.3 }, { at: 0.6, role: "shield", d: 0.25 }] }, a: [600, 380, 1.5], b: [700, 370, 1.65] },
    ],
    chips: [
      { from: 0.1, to: 0.7, text: "8th century BC", sub: "The kingdom of Urartu" },
      { from: 1, to: 1, text: "Urartu", sub: "Biainili to its kings" },
      { from: 2, to: 2, text: "Argishti I", sub: "King of Urartu, son of Menua" },
      { from: 3, to: 3, text: "North of the Araxes" },
      { from: 4, to: "4/2", text: "782 BC", sub: "A new fortress on the hill of Arin Berd" },
      { from: "4/2", to: 4, text: "Erebuni", sub: "The fortress of Argishti I" },
      { from: 5, to: 5, text: "The founding inscription", sub: "Found on Arin Berd in 1950" },
      { from: 6, to: 6, text: "Assyria, Urartu's great rival", sub: "Far to the south, beyond Lake Van" },
      { from: 7.32, to: 7, text: "Toward Lake Sevan", sub: "Urartu's kings march north from Erebuni" },
      { from: 8, to: "8/1", text: "Yerevan", sub: "The city keeps Erebuni's name" },
      { from: "8/1", to: 8, text: "2,800 years in 2018", sub: "Yerevan's age, counted from the stone" },
    ],
  },
  "erebuni-vertical": {
    level: "erebuni",
    scenes: [
      { at: 0, kind: "field", stage: { mode: "empty", wave: 0 }, a: [430, 460, 1.05], b: [425, 230, 1.7] },
      { at: "0/0+1.1", kind: "field", stage: { mode: "garrison", wave: 1, live: true, heroTo: [360, 330] }, follow: { type: "hero", dy: 40 }, a: [300, 360, 1.6], b: [300, 360, 2.4] },
      { at: "0/1", kind: "map", a: [372, 210, 1.3], b: [372, 178, 1.6], markers: [{ node: "erebuni", name: "Arin Berd", sub: "782 BC", at: "0/1+0.8", big: true }] },
      { at: 1, kind: "art", a: [800, 780, 1.0], b: [800, 660, 1.25] },
      { at: 2, kind: "stone", a: [980, 560, 1.0], b: [640, 450, 1.45] },
      { at: 3, kind: "art", a: [700, 700, 1.6], b: [880, 700, 1.8] },
      { at: "3/1", kind: "map", a: [400, 165, 1.0], b: [595, 140, 1.0], markers: [{ node: "erebuni", name: "Erebuni", at: 0 }, { arrow: [[384, 156], [606, 128]], at: 0.1, grow: 3.0 }] },
      { at: 4, kind: "map", a: [384, 192, 1.2], b: [372, 172, 1.7], markers: [{ node: "erebuni", name: "Yerevan", sub: "Arin Berd on its southeastern edge", at: 0.3, big: true }] },
      { at: 5, kind: "field", stage: { mode: "battle", wave: 3, live: true, spawn: [{ at: 0.1, role: "spearman", n: 2, d: 0.47 }, { at: 0.5, role: "shield", d: 0.44 }] }, a: [760, 250, 1.7], b: [800, 240, 1.85] },
    ],
    chips: [
      { from: "0/0+1.1", to: "0/1", text: "Argishti I", sub: "King of Urartu" },
      { from: 1, to: 1, text: "Erebuni", sub: "The fortress of Argishti I" },
      { from: 2, to: 2, text: "The founding inscription", sub: "Cut in cuneiform" },
      { from: "3/1", to: 3, text: "Toward Lake Sevan", sub: "Campaigns north from Erebuni" },
      { from: 4, to: 4, text: "2,800 years in 2018", sub: "Yerevan's age, counted from the stone" },
    ],
  },
  "tushpa-landscape": {
    level: "tushpa",
    scenes: [
      { at: 0, kind: "map", a: [340, 200, 1.2], b: [160, 262, 2.1], markers: [{ xy: VAN, name: "Tushpa", hy: HY.tushpa, sub: "By Lake Van", above: true, at: "0/1+1.5", big: true }] },
      { at: 1, kind: "rock", a: [800, 600, 1.0], b: [720, 560, 1.3] },
      { at: "1/1", kind: "rock", a: [480, 570, 1.65], b: [1120, 540, 1.65] },
      { at: 2, kind: "art", a: [800, 740, 1.0], b: [700, 620, 1.4] },
      { at: "2/1", kind: "field", stage: { mode: "garrison", wave: 1, live: true, heroTo: [300, 330] }, follow: { type: "hero", dy: 0 }, a: [200, 300, 1.8], b: [200, 300, 2.5] },
      { at: 3, kind: "field", stage: { mode: "march", wave: 6, live: true, head: 0.3, spread: 0, roles: ["boss"] }, follow: { type: "boss", dy: -14 }, a: [450, 430, 2.2], b: [450, 430, 3.0] },
      { at: "4/0", kind: "card", bg: "dark", rubric: "743 BC", title: "By the Euphrates", lines: ["Tiglath-pileser III breaks", "Sarduri and his allies"], lineAt: ["4/0+1.0", "4/1"] },
      { at: "4/1+1.3", kind: "field", stage: { mode: "march", wave: 6, live: true, head: 0.62, spread: 0.45 }, a: [300, 250, 1.6], b: [480, 290, 1.8] },
      { at: "5/1", kind: "field", keep: true, stage: { live: true }, a: [560, 300, 1.5], b: [580, 200, 1.9] },
      { at: 6, kind: "stone", tone: "soft", a: [980, 560, 1.15], b: [620, 440, 1.6] },
      { at: "6/1", kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 0.05, role: "spearman", n: 3, d: 0.95, gap: 0.01 }, { at: 0.3, role: "ram", d: 0.93 }, { at: 0.8, role: "shield", n: 2, d: 0.96 }, { at: 1.5, role: "spearman", n: 3, d: 0.94 }] }, a: [1050, 420, 1.8], b: [1060, 420, 1.9] },
      { at: 7, kind: "rock", a: [800, 600, 1.05], b: [790, 500, 1.6] },
      { at: 8, fade: 0.3, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 0.1, role: "spearman", n: 3, d: 0.45 }, { at: 0.6, role: "shield", n: 2, d: 0.5 }] }, a: [560, 360, 1.1], b: [620, 330, 1.25] },
      { at: 9, kind: "field", keep: true, stage: { live: true }, a: [860, 430, 1.4], b: [940, 420, 1.6] },
    ],
    chips: [
      { from: 0, to: 0, text: "Urartu", sub: "Biainili to its kings" },
      { from: 1, to: 1, text: "The Rock of Van", sub: "The citadel of Tushpa" },
      { from: "2/1", to: 2, text: "Sarduri II", sub: "King of Urartu" },
      { from: 3, to: 3, text: "Tiglath-pileser III", sub: "King of Assyria from 745 BC" },
      { from: 5, to: 5, text: "735 BC", sub: "The Assyrian army in the heart of Biainili" },
      { from: 6, to: "6/1", text: "As the Assyrian inscriptions tell it", sub: "Sarduri shut up in Tushpa" },
      { from: "6/1", to: 6, text: "Before the gates of Tushpa", sub: "Sarduri defeated, by their account" },
      { from: "7/1", to: 7, text: "The citadel did not fall" },
    ],
  },
  "tushpa-vertical": {
    level: "tushpa",
    scenes: [
      { at: 0, kind: "map", a: [100, 225, 1.4], b: [92, 262, 2.0], markers: [{ xy: VAN, name: "Tushpa", hy: HY.tushpa, sub: "By Lake Van", above: true, at: 0, big: true }] },
      { at: 1, kind: "art", level: "van", hires: true, a: [360, 740, 3.4], b: [440, 720, 3.8] },
      { at: 2, kind: "field", stage: { mode: "march", wave: 6, live: true, head: 0.42, spread: 0.36, roles: ["boss", "spearman", "shield", "spearman", "cavalry", "spearman", "shield", "spearman"] }, follow: { type: "boss", dy: 20 }, a: [450, 430, 1.3], b: [450, 430, 2.2] },
      { at: "2/0+2.5", kind: "field", keep: true, stage: { live: true }, a: [420, 400, 1.05], b: [520, 360, 1.25] },
      { at: "2/1", kind: "map", a: [150, 262, 1.25], b: [120, 262, 1.45], markers: [{ xy: VAN, name: "Tushpa", above: true, at: 0 }, { arrow: [[130, 334], [117, 300]], at: 0.15 }] },
      { at: 3, kind: "stone", tone: "pale", a: [1100, 600, 1.0], b: [520, 420, 1.7] },
      { at: "3/1", kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 0.1, role: "spearman", n: 3, d: 0.86 }, { at: 0.5, role: "ram", d: 0.8 }, { at: 2, role: "shield", n: 2, d: 0.75 }, { at: 3, role: "spearman", n: 3, d: 0.7 }] }, a: [985, 400, 1.4], b: [985, 420, 1.6] },
      { at: 4, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 0.2, role: "spearman", n: 3, d: 0.62 }] }, a: [640, 240, 1.5], b: [600, 200, 1.75] },
      { at: 5, kind: "field", keep: true, stage: { live: true }, a: [900, 420, 1.4], b: [960, 400, 1.6] },
    ],
    chips: [
      { from: 0, to: 0, text: "Tushpa", sub: "The capital of Urartu" },
      { from: 1, to: 1, text: "The Rock of Van", sub: "The citadel of Tushpa" },
      { from: 2, to: 2, text: "735 BC", sub: "Tiglath-pileser III of Assyria" },
      { from: 3, to: 3, text: "Sarduri II, King of Urartu", sub: "Shut up in Tushpa, the inscriptions say" },
      { from: 4, to: 4, text: "The citadel did not fall" },
    ],
  },
  "avarayr-landscape": {
    level: "avarayr",
    scenes: [
      { at: 0, kind: "field", stage: { mode: "empty", wave: 0 }, a: [520, 270, 1.5], b: [330, 150, 2.3] },
      { at: "1/0", kind: "map", a: [360, 190, 1.1], b: [470, 215, 1.55], markers: [{ xy: [330, 186], label: "Armenia", land: true, size: 36, at: 0.2 }, { arrow: [[585, 232], [700, 288]], at: "1/0+1.4" }, { xy: [600, 268], label: "To Sasanian Persia", at: "1/0+1.6" }] },
      { at: "1/1+0.3", kind: "card", scroll: true, emblem: "crown", rubric: "449 \u00b7 Yazdegerd II", title: "The command", lines: ["Renounce Christianity", "for Zoroastrianism,", "the faith of his court"], lineAt: ["1/1+0.8", "1/2", "1/2+0.4"], seal: "crown", sealAt: "1/2+0.9", a: [520, 300, 1.6], b: [600, 320, 1.75] },
      { at: "1/2+1.75", kind: "field", stage: { mode: "garrison", wave: 5, live: true, heroTo: [700, 300] }, a: [330, 330, 1.5], b: [760, 290, 1.8] },
      { at: 3, kind: "field", stage: { mode: "garrison", wave: 5, live: true, heroTo: [640, 330] }, follow: { type: "hero", dy: 4 }, a: [640, 300, 1.6], b: [640, 300, 2.7] },
      { at: "3/1", kind: "field", keep: true, stage: { live: true }, a: [420, 300, 1.35], b: [900, 270, 1.6] },
      { at: 4, kind: "field", stage: { mode: "march", wave: 2, live: true, head: 0.24, spread: 0.2, roles: ["boss", "cavalry", "ram", "cavalry", "spearman", "ram", "shield", "cavalry"] }, follow: { type: "ram", dy: 55 }, a: [975, 350, 1.7], b: [975, 350, 2.1] },
      { at: "4/1", kind: "field", keep: true, stage: { live: true }, a: [900, 260, 1.3], b: [1010, 300, 1.5] },
      { at: 5, kind: "field", stage: { mode: "garrison", wave: 5 }, a: [500, 330, 1.4], b: [740, 380, 1.55] },
      { at: "5/1", kind: "field", keep: true, a: [560, 614, 3.4], b: [760, 614, 3.4] },
      { at: 6, kind: "field", stage: { mode: "battle", wave: 4, live: true, heroTo: [1020, 315], spawn: [{ at: 0.2, role: "spearman", n: 2, d: 0.22 }, { at: 0.6, role: "shield", n: 2, d: 0.26 }] }, a: [900, 380, 1.5], b: [820, 420, 1.6] },
      { at: 7, kind: "field", keep: true, stage: { live: true, heroTo: [1020, 315], fallAt: "7/1", spawn: [{ at: 0.05, role: "spearman", n: 4, d: 0.2, gap: 0.008 }, { at: 0.1, role: "shield", n: 3, d: 0.25, gap: 0.008 }, { at: 0.15, role: "spearman", n: 4, d: 0.31, gap: 0.008 }, { at: 0.6, role: "cavalry", n: 3, d: 0.18, gap: 0.01 }, { at: 1.3, role: "spearman", n: 4, d: 0.19, gap: 0.008 }] }, follow: { type: "hero", dy: 10 }, a: [1020, 315, 1.9], b: [1020, 315, 2.25] },
      { at: "8/0", kind: "field", stage: { mode: "garrison", wave: 8, noHero: true, corpses: [{ role: "spearman", d: 0.21 }, { role: "cavalry", d: 0.235, dx: 24 }, { role: "spearman", d: 0.25, color: "#a8231c", dx: -18 }, { role: "shield", d: 0.27, dy: 14 }, { role: "spearman", d: 0.29, color: "#a8231c", dx: 16 }] }, a: [860, 330, 1.7], b: [1000, 290, 2.1] },
      { at: "8/0+1.5", kind: "field", keep: true, a: [380, 165, 1.9], b: [320, 148, 2.25] },
      { at: "8/1", kind: "card", scroll: true, emblem: "cross", rubric: "484", title: "Freedom of worship", lines: ["won by Vahan Mamikonian,", "Vardan's nephew"], lineAt: ["8/1+0.5", "8/1+1.3"], seal: "cross", sealAt: "8/1+2.1", a: [470, 300, 1.5], b: [400, 260, 1.7] },
      { at: "8/2", kind: "field", stage: { mode: "garrison", wave: 5 }, a: [520, 260, 1.4], b: [330, 150, 2.2] },
      { at: 9, kind: "field", keep: true, a: [700, 320, 1.5], b: [860, 290, 2.2] },
    ],
    chips: [
      { from: 0.3, to: 0, text: "Armenia", sub: "Christian since early in the fourth century" },
      { from: 1, to: "1/1", text: "449", sub: "Yazdegerd II, Shahanshah of Sasanian Persia" },
      { from: 2, to: 2, text: "450", sub: "Much of Armenia rises" },
      { from: 3, to: 3, text: "Vardan Mamikonian", sub: "Sparapet of Armenia" },
      { from: 4, to: 4, text: "451", sub: "The Persian army, with its war elephants" },
      { from: 5, to: 5, text: "The plain of Avarayr", sub: "By the river Tghmut" },
      { from: 6, to: 6, text: "The first clashes", sub: "Won by the Armenians" },
      { from: 7, to: "7/1", text: "The Persian reserves", sub: "Vardan's men surrounded" },
      { from: "7/1", to: "8/0+1.5", text: "Vardan falls", sub: "And eight of his commanders with him" },
      { from: "8/0+1.5", to: "8/1", text: "Yet the faith held" },
      { from: "8/2", to: 8, text: "484: the Treaty of Nvarsak", sub: "Freedom of worship" },
    ],
  },
  "avarayr-vertical": {
    level: "avarayr",
    scenes: [
      { at: 0, kind: "field", stage: { mode: "empty", wave: 0 }, a: [330, 160, 2.2], b: [300, 135, 2.8] },
      { at: "0/0+0.5", kind: "card", scroll: true, emblem: "crown", rubric: "449", title: "Yazdegerd II", lines: ["Shahanshah of Sasanian Persia"], lineAt: ["0/0+1.0"], seal: "crown", sealAt: "0/0+2.0", a: [420, 250, 1.4], b: [520, 300, 1.6] },
      { at: "0/1", kind: "field", stage: { mode: "garrison", wave: 5 }, a: [700, 455, 3.2], b: [700, 470, 4.2] },
      { at: 1, kind: "field", stage: { mode: "garrison", wave: 5 }, a: [430, 330, 1.4], b: [700, 300, 1.6] },
      { at: "1/1", kind: "field", stage: { mode: "garrison", wave: 5, live: true, heroTo: [640, 330] }, follow: { type: "hero", dy: 60 }, a: [640, 300, 1.4], b: [640, 300, 2.0] },
      { at: 2, kind: "field", stage: { mode: "battle", wave: 5, live: true, spawn: [{ at: 0.1, role: "ram", d: 0.23 }, { at: 0.5, role: "cavalry", n: 2, d: 0.21 }, { at: 1.2, role: "spearman", n: 3, d: 0.2 }] }, a: [1000, 330, 1.4], b: [960, 300, 1.55] },
      { at: 3, kind: "field", keep: true, stage: { live: true, heroTo: [990, 300], fallAt: "3/0+0.3", spawn: [{ at: 0.05, role: "spearman", n: 4, d: 0.23 }, { at: 0.2, role: "cavalry", n: 2, d: 0.21 }] }, follow: { type: "hero", dy: 60 }, a: [900, 330, 1.7], b: [900, 330, 2.0] },
      { at: 3.45, kind: "field", stage: { mode: "garrison", wave: 8, noHero: true, corpses: [{ role: "spearman", d: 0.21 }, { role: "cavalry", d: 0.235, dx: 24 }, { role: "spearman", d: 0.25, color: "#a8231c", dx: -18 }, { role: "shield", d: 0.27, dy: 14 }, { role: "spearman", d: 0.29, color: "#a8231c", dx: 16 }] }, a: [990, 300, 1.7], b: [1010, 280, 2.0] },
      { at: 4, kind: "field", keep: true, a: [700, 455, 3.0], b: [700, 470, 3.8] },
      { at: "4/1", kind: "card", scroll: true, emblem: "cross", rubric: "484", title: "Freedom of worship", lines: ["won by Vahan Mamikonian,", "Vardan's nephew,", "by the Treaty of Nvarsak"], lineAt: ["4/1+0.4", "4/1+1.2", "4/1+2.0"], seal: "cross", sealAt: "4/1+2.6", a: [470, 300, 1.5], b: [400, 260, 1.7] },
      { at: 5, kind: "field", stage: { mode: "garrison", wave: 5 }, follow: { type: "hero", dy: 50 }, a: [860, 330, 1.4], b: [900, 300, 2.1] },
    ],
    chips: [
      { from: "0/1", to: 0, text: "449", sub: "The Armenians are to renounce Christianity" },
      { from: 1, to: "1/1", text: "450", sub: "Much of Armenia rises" },
      { from: "1/1", to: 1, text: "Vardan Mamikonian", sub: "Sparapet of Armenia" },
      { from: 2, to: 2, text: "451", sub: "The plain of Avarayr" },
      { from: 3, to: 3, text: "Vardan falls", sub: "The field is lost" },
      { from: 4, to: "4/1", text: "Yet the faith held" },
    ],
  },
  "dvin-landscape": {
    level: "dvin",
    scenes: [
      { at: 0, kind: "map", a: [450, 190, 1.2], b: [585, 232, 1.9], markers: [{ node: "dvin", name: "Dvin", hy: HY.dvin, sub: "The plain of Ayrarat", at: "0/0+0.2", above: true, big: true }] },
      { at: 1, kind: "art", a: [820, 640, 1.45], b: [560, 540, 1.75], tag: "Dvin" },
      { at: 2, kind: "map", a: [520, 240, 1.6], b: [560, 236, 1.8], markers: [{ node: "dvin", name: "Dvin", above: true, at: 0 }, { arrow: [[586, 302], [589, 262]], at: 0.3 }, { xy: [648, 292], label: "From the south", at: 0.6 }] },
      { at: "3/0+0.2", kind: "card", bg: "dark", rubric: "Under the caliph Umar", title: "A new power", lines: ["Arab armies conquer", "Syria and Mesopotamia"], lineAt: ["3/1", "3/1+0.9"] },
      { at: "3/2", kind: "field", stage: { mode: "march", wave: 2, live: true, head: 0.5, spread: 0.42, roles: ["raider", "cavalry", "spearman", "raider", "cavalry", "spearman", "raider", "spearman"] }, a: [300, 300, 1.5], b: [470, 320, 1.6] },
      { at: 4, kind: "field", stage: { mode: "battle", wave: 5, live: true, heroTo: [430, 380], spawn: [{ at: 0.1, role: "raider", n: 3, d: 0.47 }, { at: 0.8, role: "cavalry", n: 2, d: 0.45 }] }, follow: { type: "hero", dy: 30 }, a: [640, 300, 1.6], b: [640, 300, 2.3] },
      { at: 5, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 0.2, role: "raider", n: 3, d: 0.55 }, { at: 0.8, role: "cavalry", n: 2, d: 0.5 }, { at: 1.2, role: "spearman", n: 3, d: 0.6, road: 1 }] }, a: [560, 320, 1.5], b: [700, 330, 1.6] },
      { at: "5/1", kind: "field", keep: true, stage: { live: true, spawn: [{ at: 0.1, role: "raider", n: 3, d: 0.86 }, { at: 0.6, role: "spearman", n: 3, d: 0.84, road: 1 }] }, a: [960, 360, 1.7], b: [1000, 340, 1.9] },
      { at: 6, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 0.1, role: "cavalry", n: 2, d: 0.88 }, { at: 0.8, role: "raider", n: 3, d: 0.9, road: 1 }] }, a: [1010, 340, 2.0], b: [1000, 340, 2.3] },
      { at: 7, kind: "field", stage: { mode: "fall", wave: 8, lift: 0.08 }, a: [1000, 330, 2.4], b: [700, 300, 1.15] },
      { at: 8, kind: "field", stage: { mode: "garrison", wave: 1, noHero: true }, a: [470, 120, 2.4], b: [380, 105, 3.0] },
      { at: 9, kind: "field", stage: { mode: "battle", wave: 3, live: true, spawn: [{ at: 0.1, role: "raider", n: 3, d: 0.3 }, { at: 0.4, role: "spearman", n: 3, d: 0.3, road: 1 }, { at: 1.4, role: "cavalry", n: 2, d: 0.35 }, { at: 1.8, role: "raider", n: 2, d: 0.35, road: 1 }] }, a: [380, 420, 1.3], b: [560, 400, 1.4] },
      { at: 10, kind: "field", keep: true, stage: { live: true }, a: [1000, 360, 1.6], b: [1010, 340, 1.8] },
    ],
    chips: [
      { from: 0.3, to: 0, text: "Dvin", sub: "About 35 kilometers south of modern Yerevan" },
      { from: 1, to: 1, text: "Seat of the catholicos", sub: "Head of the Armenian Church" },
      { from: "3/2", to: 3, text: "640", sub: "The first Arab armies come north into Armenia" },
      { from: 4, to: 4, text: "Theodoros Rshtuni", sub: "Commander of the Armenian forces" },
      { from: "5/1", to: 5, text: "The raiders reach Dvin" },
      { from: 6, to: 6, text: "A stubborn defense", sub: "The capital is taken" },
      { from: 7, to: 7, text: "35,000 captives", sub: "As the Armenian histories tell it" },
      { from: 8, to: 8, text: "A raid, not yet a conquest", sub: "Dvin rose again" },
      { from: 9, to: 9, text: "Both roads at once" },
    ],
  },
  "dvin-vertical": {
    level: "dvin",
    scenes: [
      { at: 0, kind: "art", a: [800, 820, 1.0], b: [800, 700, 1.25] },
      { at: "0/0", kind: "map", a: [600, 212, 1.12], b: [592, 232, 1.4], markers: [{ node: "dvin", name: "Dvin", hy: HY.dvin, at: "0/0+0.1", big: true }, { xy: [560, 205], label: "Ayrarat", land: true, size: 34, at: "0/0+0.9" }] },
      { at: "0/1", kind: "art", a: [920, 760, 1.2], b: [560, 560, 1.8] },
      { at: 1, kind: "field", stage: { mode: "march", wave: 2, live: true, head: 0.5, spread: 0.42, roles: ["raider", "cavalry", "spearman", "raider", "cavalry", "spearman", "raider", "spearman"] }, a: [330, 330, 1.2], b: [480, 340, 1.3] },
      { at: 2, kind: "field", stage: { mode: "battle", wave: 6, live: true, heroTo: [430, 380], spawn: [{ at: 0.2, role: "raider", n: 3, d: 0.47 }, { at: 0.8, role: "cavalry", n: 2, d: 0.45 }] }, follow: { type: "hero", dy: 50 }, a: [640, 330, 1.5], b: [640, 330, 1.9] },
      { at: 3, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 0.1, role: "raider", n: 3, d: 0.9 }, { at: 0.4, role: "spearman", n: 2, d: 0.93, road: 1 }] }, a: [1000, 330, 1.7], b: [1010, 320, 1.9] },
      { at: "3/1", kind: "field", stage: { mode: "fall", wave: 8, lift: 0.08 }, a: [1010, 330, 2.1], b: [1000, 320, 1.6] },
      { at: 4, kind: "field", stage: { mode: "garrison", wave: 1, noHero: true }, a: [700, 340, 1.3], b: [1000, 330, 1.8] },
      { at: 5, kind: "field", stage: { mode: "battle", wave: 3, live: true, spawn: [{ at: 0.05, role: "raider", n: 4, d: 0.88 }, { at: 0.1, role: "spearman", n: 3, d: 0.9, road: 1 }, { at: 0.5, role: "cavalry", n: 2, d: 0.86 }] }, a: [1000, 290, 1.9], b: [1010, 280, 2.1] },
    ],
    chips: [
      { from: "0/1", to: 0, text: "Seat of the catholicos", sub: "Head of the Armenian Church" },
      { from: 1, to: 1, text: "640", sub: "The first Arab armies in Armenia" },
      { from: 2, to: 2, text: "Theodoros Rshtuni", sub: "Commander of the Armenian forces" },
      { from: 3, to: 3, text: "The raiders reach Dvin", sub: "The capital is taken" },
      { from: 4, to: 4, text: "A raid, not yet a conquest", sub: "Dvin rose again" },
    ],
  },
};
