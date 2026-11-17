// The picture of each cut: scenes and plaques, placed by the narration's sentences (scripts.json).
// A position p is a sentence's index; its fraction is how far through that sentence (3.5: half way through the
// fourth). film.js turns positions into seconds from the narration's own timings, so the picture follows the
// voice whatever the voice's pace.
//   scene: { at: p, kind: "map" | "field" | "art", a: [cx, cy, zoom], b: [...] }  the camera moves a to b
//     map: chart units (720 x 400), markers: [{ node | xy, name, hy, sub, at: p }]
//     field: the battlefield's own units (1280 x 720); stage: { mode: "empty" | "garrison" | "battle", wave, live, spawn };
//            keep: true goes on with the stage before it; follow: { type: "hero" | <a foe's role> }
//            mode "march" is a column on the road and nothing else (no towers, no hero)
//     art: the chronicle's painting (1600 x 1600)
//            mode "fall" is the game's own picture of a lost stand (its defeat beat: the citadel burning at dusk)
//            stage.level looks at another battlefield of the campaign (Erebuni's film shows Tushpa's rock)
//     card: a page of parchment with a rubric, a title and lines, where the game has no picture of the place
//     stone: an illustration of the founding inscription (1600 x 1000; a block with wedge marks, no real text copied)
//     zoom 1 is the plate covering the frame
//   chip: { from: p, to: p, text, sub }  the plaque in the top left corner (to: a whole number is that sentence's end)
// Over every look at the battlefield film.js adds a small "Scenes from the game" in the top right corner.
// date: the date on the title and closing card, where the battlefield's own date needs its caveat.
// Avarayr is marked a little south of the campaign's node, off the Araxes (text-audit entry 2, claim 0: the field lay
// on the Tghmut, not at a crossing of the Araxes).
// The chart's Mt. Ararat label lies at y 380: cameras keep their lower edge above 366 so it is never cut.
// Tushpa is marked on the eastern shore of Lake Van (text-audit entry 1, claim 11), not at the campaign's node.
// Every word on a plaque comes from the battlefield's own texts in index.html (its name, date, hero, chronicle).
const T = (name, sub, extra) => Object.assign({ name, sub }, extra || {});
const HY = { erebuni: "Էրեբունի", tushpa: "Տուշպա", avarayr: "Ավարայր", dvin: "Դվին" };   // HY_NAMES.field in index.html

const VAN = [108, 282], ARAXES = [300, 226], AVA = [476, 314];
const TUSHPA = { xy: VAN, name: "Tushpa", sub: "By Lake Van", above: true };
module.exports = {
  "erebuni-landscape": {
    level: "erebuni", date: "782 BC, the usual date",
    scenes: [
      { at: 0, kind: "map", a: [330, 200, 1.2], b: [240, 215, 1.5], markers: [Object.assign({ at: 0.2 }, TUSHPA)] },
      { at: 0.5, kind: "field", stage: { mode: "empty", wave: 0, level: "tushpa" }, a: [560, 170, 1.9], b: [560, 125, 2.5] },
      { at: 2, kind: "art", level: "tushpa", a: [800, 740, 1.0], b: [800, 620, 1.3] },
      { at: 3, kind: "map", a: [400, 200, 1.3], b: [385, 195, 1.75], markers: [{ xy: [330, 228], label: "Araxes", rot: 0.06, at: 3 }, { arrow: [[352, 262], [369, 184]], at: 3.15 }, { node: "erebuni", name: "Arin Berd", sub: "782 BC, by the usual date", at: 4.05, big: true }] },
      { at: 4.5, kind: "art", a: [800, 700, 1.0], b: [800, 590, 1.3] },
      { at: 5, kind: "stone", a: [800, 520, 1.0], b: [800, 480, 1.3] },
      { at: 6, kind: "map", a: [372, 195, 1.7], b: [258, 222, 1.45], markers: [{ node: "erebuni", name: "Erebuni", hy: HY.erebuni, at: 6, until: 6.55 }, Object.assign({ at: 6.3 }, TUSHPA), { arrow: [[160, 322], [160, 354]], at: 6.5 }, { xy: [160, 308], label: "To Assyria", at: 6.5 }] },
      { at: 7, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 2, role: "spearman", n: 2 }, { at: 5, role: "shield" }] }, a: [600, 380, 1.5], b: [770, 370, 1.8] },
      { at: 8, kind: "field", stage: { mode: "garrison", wave: 1, noHero: true }, a: [470, 240, 1.6], b: [640, 340, 1.05] },
    ],
    chips: [
      { from: 0.3, to: 1, text: "8th century BC", sub: "Urartu, Biainili to its kings" },
      { from: 2, to: 2, text: "Argishti I", sub: "King of Urartu, son of Menua" },
      { from: 3, to: 3, text: "North of the Araxes" },
      { from: 4, to: 4.8, text: "782 BC, by the date most often given", sub: "A new fortress on the hill of Arin Berd" },
      { from: 4.8, to: 4, text: "Erebuni", sub: "The fortress of Argishti I" },
      { from: 5, to: 5, text: "The founding inscription", sub: "Found on Arin Berd in 1950 (an illustration)" },
      { from: 6, to: 6, text: "Assyria, Urartu's great rival", sub: "Far to the south, beyond Lake Van" },
      { from: 7, to: 7, text: "No siege of Erebuni is recorded", sub: "This battle is the game's invention" },
    ],
    end: { from: 9 },
  },
  "erebuni-vertical": {
    level: "erebuni", date: "782 BC, the usual date",
    scenes: [
      { at: 0, kind: "map", a: [372, 199, 1.2], b: [372, 180, 1.45], markers: [{ node: "erebuni", name: "Erebuni", hy: HY.erebuni, sub: "782 BC, by the usual date", at: 0, big: true }] },
      { at: 0.42, kind: "field", stage: { mode: "empty", wave: 0 }, a: [430, 330, 1.0], b: [420, 235, 1.5] },
      { at: 0.85, kind: "art", a: [800, 780, 1.0], b: [800, 660, 1.25] },
      { at: 2, kind: "stone", a: [800, 500, 1.0], b: [800, 480, 1.25] },
      { at: 3, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 1.5, role: "spearman", n: 2 }, { at: 4, role: "shield" }] }, a: [700, 300, 1.25], b: [820, 300, 1.3] },
      { at: 4, kind: "field", stage: { mode: "garrison", wave: 1, noHero: true }, a: [430, 300, 1.4], b: [420, 340, 1.05] },
    ],
    chips: [
      { from: 0.42, to: 0.85, text: "Arin Berd", sub: "The hill of the new fortress" },
      { from: 1, to: 1, text: "Erebuni", sub: "The fortress of Argishti I" },
      { from: 2, to: 2, text: "The founding inscription", sub: "Cut in cuneiform (an illustration)" },
      { from: 3, to: 3, text: "No siege is recorded", sub: "This battle is the game's invention" },
    ],
    end: { from: 5 },
  },
  "tushpa-landscape": {
    level: "tushpa",
    scenes: [
      { at: 0, kind: "map", a: [300, 215, 1.3], b: [200, 258, 1.9], markers: [{ xy: VAN, name: "Tushpa", hy: HY.tushpa, sub: "By Lake Van", above: true, at: 0.2, big: true }] },
      { at: 1, kind: "field", stage: { mode: "empty", wave: 0 }, a: [560, 170, 1.9], b: [560, 125, 2.6] },
      { at: 2, kind: "art", a: [800, 740, 1.0], b: [800, 600, 1.4] },
      { at: 3, kind: "field", stage: { mode: "march", wave: 6, live: true, head: 0.5, spread: 0.45 }, a: [330, 420, 1.7], b: [450, 430, 1.7] },
      { at: 4, kind: "card", rubric: "743 BC", title: "By the Euphrates", lines: ["Tiglath-pileser III breaks", "Sarduri and his allies"], a: [200, 230, 1.6], b: [150, 250, 1.8] },
      { at: 5, kind: "field", stage: { mode: "march", wave: 6, live: true, head: 0.62, spread: 0.45 }, a: [330, 250, 1.7], b: [480, 300, 1.7] },
      { at: 6, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 2, role: "spearman", n: 2 }, { at: 4, role: "ram" }, { at: 7, role: "shield", n: 2 }] }, a: [700, 300, 1.5], b: [900, 290, 1.9] },
      { at: 7, kind: "field", keep: true, stage: { live: true }, a: [560, 180, 2.2], b: [560, 140, 1.9] },
      { at: 8, kind: "field", keep: true, stage: { live: true }, a: [820, 320, 1.6], b: [640, 340, 1.05] },
    ],
    chips: [
      { from: 0.3, to: 0, text: "Urartu", sub: "Biainili to its kings" },
      { from: 1, to: 1, text: "The Rock of Van", sub: "The citadel of Tushpa" },
      { from: 2, to: 2, text: "Sarduri II", sub: "King of Urartu" },
      { from: 3, to: 3, text: "Tiglath-pileser III", sub: "King of Assyria from 745 BC" },
      { from: 5, to: 5, text: "735 BC", sub: "The Assyrian army in the heart of Biainili" },
      { from: 6, to: 6, text: "Before the gates of Tushpa", sub: "As the Assyrian inscriptions tell it" },
      { from: 7, to: 7, text: "The citadel did not fall" },
    ],
    end: { from: 9 },
  },
  "tushpa-vertical": {
    level: "tushpa",
    scenes: [
      { at: 0, kind: "map", a: [100, 225, 1.4], b: [92, 262, 2.0], markers: [{ xy: VAN, name: "Tushpa", hy: HY.tushpa, sub: "By Lake Van", above: true, at: 0, big: true }] },
      { at: 1, kind: "field", stage: { mode: "empty", wave: 0 }, a: [560, 200, 1.9], b: [560, 170, 2.6] },
      { at: 2, kind: "field", stage: { mode: "march", wave: 6, live: true, head: 0.62, spread: 0.45 }, a: [400, 300, 1.0], b: [470, 310, 1.25] },
      { at: 2.5, kind: "field", keep: true, stage: { live: true }, a: [620, 330, 1.5], b: [720, 330, 1.4] },
      { at: 3, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 2, role: "spearman", n: 2 }, { at: 4, role: "ram" }, { at: 7, role: "shield", n: 2 }] }, a: [860, 340, 1.2], b: [985, 320, 1.7] },
      { at: 4, kind: "field", keep: true, stage: { live: true }, a: [560, 230, 1.9], b: [560, 260, 1.5] },
      { at: 5, kind: "field", keep: true, stage: { live: true }, a: [985, 330, 1.5], b: [900, 340, 1.1] },
    ],
    chips: [
      { from: 0.3, to: 0, text: "Tushpa", sub: "The capital of Urartu" },
      { from: 1, to: 1, text: "The Rock of Van", sub: "The citadel of Tushpa" },
      { from: 2, to: 2, text: "735 BC", sub: "Tiglath-pileser III of Assyria" },
      { from: 3, to: 3, text: "Sarduri II, King of Urartu", sub: "Shut up in Tushpa, the inscriptions say" },
      { from: 4, to: 4, text: "The citadel did not fall" },
    ],
    end: { from: 5 },
  },
  "avarayr-landscape": {
    level: "avarayr",
    scenes: [
      { at: 0, kind: "map", a: [330, 206, 1.25], b: [373, 232, 1.5], markers: [{ xy: AVA, name: "Avarayr", hy: HY.avarayr, sub: "451 AD", above: true, at: 0.2, big: true }] },
      { at: 1, kind: "card", rubric: "449", title: "The command of Yazdegerd II", lines: ["Shahanshah of Sasanian Persia"] },
      { at: 1.5, kind: "art", a: [800, 780, 1.0], b: [800, 640, 1.3] },
      { at: 2, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [330, 330, 1.5], b: [220, 340, 2.0] },
      { at: 3, kind: "field", keep: true, follow: { type: "hero", dy: 6 }, a: [640, 300, 2.4], b: [640, 300, 2.7] },
      { at: 4, kind: "field", stage: { mode: "march", wave: 2, live: true, head: 0.5, spread: 0.4, roles: ["ram", "cavalry", "cavalry", "spearman", "ram", "shield", "spearman", "cavalry"] }, follow: { type: "ram", dy: -6 }, a: [975, 350, 1.9], b: [975, 350, 1.9] },
      { at: 5, kind: "field", stage: { mode: "battle", wave: 4, live: true, spawn: [{ at: 1, role: "spearman", n: 2 }, { at: 3, role: "shield", n: 2 }] }, a: [720, 430, 1.3], b: [580, 450, 1.12] },
      { at: 6, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 0.5, role: "cavalry", n: 2 }] }, a: [900, 290, 1.9], b: [700, 360, 1.8] },
      { at: 7, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 0.3, role: "spearman", n: 3 }, { at: 1.5, role: "ram" }] }, a: [700, 360, 1.8], b: [560, 420, 1.6] },
      { at: 7.6, kind: "field", stage: { mode: "fall", wave: 8 }, a: [640, 340, 1.25], b: [400, 340, 1.5] },
      { at: 8.36, kind: "card", rubric: "484", title: "The Treaty of Nvarsak", lines: ["Vardan's nephew Vahan Mamikonian", "wins freedom of worship"] },
      { at: 9, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [300, 340, 1.7], b: [640, 345, 1.05] },
    ],
    chips: [
      { from: 0.4, to: 0, text: "Armenia", sub: "Christian since early in the fourth century" },
      { from: 1.5, to: 1, text: "449", sub: "The Armenians are to renounce Christianity" },
      { from: 2, to: 2, text: "450", sub: "Much of Armenia rises" },
      { from: 3, to: 3, text: "Vardan Mamikonian", sub: "Sparapet of Armenia" },
      { from: 4, to: 4, text: "451", sub: "The Persian army, with its war elephants" },
      { from: 5, to: 5, text: "The plain of Avarayr", sub: "By the river Tghmut" },
      { from: 7, to: 7.6, text: "451", sub: "The Persian reserves surround Vardan's men" },
      { from: 7.6, to: 8.36, text: "The field was lost" },
    ],
    end: { from: 9 },
  },
  "avarayr-vertical": {
    level: "avarayr",
    scenes: [
      { at: 0, kind: "map", a: [476, 215, 1.25], b: [476, 232, 1.5], markers: [{ xy: AVA, name: "Avarayr", hy: HY.avarayr, sub: "451 AD", above: true, at: 0, big: true }] },
      { at: 0.3, kind: "card", rubric: "449", title: "Yazdegerd II", lines: ["of Sasanian Persia commands", "the Armenians", "to renounce Christianity"] },
      { at: 1, kind: "field", stage: { mode: "garrison", wave: 1 }, follow: { type: "hero", dy: 30 }, a: [640, 300, 1.6], b: [640, 300, 1.9] },
      { at: 2, kind: "field", stage: { mode: "battle", wave: 5, live: true, spawn: [{ at: 1, role: "ram" }, { at: 3, role: "cavalry", n: 2 }] }, a: [960, 330, 1.25], b: [860, 340, 1.15] },
      { at: 3, kind: "field", stage: { mode: "fall", wave: 8 }, a: [420, 340, 1.1], b: [230, 360, 1.45] },
      { at: 4, kind: "card", rubric: "484", title: "Freedom of worship", lines: ["won by Vahan Mamikonian,", "Vardan's nephew"] },
      { at: 5, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [230, 400, 1.5], b: [250, 380, 1.05] },
    ],
    chips: [
      { from: 1, to: 1, text: "Vardan Mamikonian", sub: "Sparapet of Armenia" },
      { from: 2, to: 2, text: "451", sub: "The plain of Avarayr" },
      { from: 3, to: 3, text: "The field was lost" },
    ],
    end: { from: 5 },
  },
  "dvin-landscape": {
    level: "dvin",
    scenes: [
      { at: 0, kind: "map", a: [470, 200, 1.2], b: [545, 215, 1.5], markers: [{ node: "dvin", name: "Dvin", hy: HY.dvin, sub: "The plain of Ayrarat", at: 0.2, big: true }] },
      { at: 1, kind: "field", stage: { mode: "empty", wave: 0 }, a: [640, 300, 1.25], b: [420, 135, 2.4] },
      { at: 2, kind: "card", rubric: "Far to the south", title: "A new power", lines: ["Under the caliph Umar, Arab armies", "conquer Syria and Mesopotamia"] },
      { at: 3.52, kind: "field", stage: { mode: "march", wave: 2, live: true, head: 0.5, spread: 0.42, roles: ["raider", "cavalry", "spearman", "raider", "cavalry", "spearman", "raider", "spearman"] }, a: [300, 300, 1.5], b: [470, 320, 1.5] },
      { at: 4, kind: "field", stage: { mode: "garrison", wave: 1 }, follow: { type: "hero", dy: 6 }, a: [640, 300, 2.4], b: [640, 300, 2.7] },
      { at: 5, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 1, role: "raider", n: 2 }, { at: 3, role: "cavalry", n: 2 }, { at: 6, role: "spearman", n: 2 }] }, a: [330, 340, 1.7], b: [640, 350, 1.5] },
      { at: 6, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 1, role: "spearman", n: 2 }] }, a: [800, 400, 1.6], b: [990, 360, 2.1] },
      { at: 7, kind: "field", stage: { mode: "fall", wave: 8 }, a: [940, 340, 1.5], b: [640, 340, 1.15] },
      { at: 8, kind: "art", a: [800, 760, 1.0], b: [800, 600, 1.35] },
      { at: 9, kind: "field", stage: { mode: "battle", wave: 3, live: true, spawn: [{ at: 0.5, role: "raider", n: 3 }, { at: 2, role: "spearman", n: 2 }, { at: 4, role: "cavalry", n: 2 }] }, a: [380, 400, 1.45], b: [640, 345, 1.05] },
    ],
    chips: [
      { from: 0.4, to: 0, text: "Dvin", sub: "About 35 kilometers south of modern Yerevan" },
      { from: 1, to: 1, text: "Seat of the catholicos", sub: "Head of the Armenian Church" },
      { from: 3.52, to: 3, text: "640", sub: "The first Arab armies come north into Armenia" },
      { from: 4, to: 4, text: "Theodoros Rshtuni", sub: "Commander of the Armenian forces" },
      { from: 5, to: 5, text: "The raiders reach Dvin" },
      { from: 7, to: 7, text: "640", sub: "The Armenian histories tell of 35,000 captives" },
      { from: 8, to: 8, text: "A raid, not yet a conquest", sub: "Dvin rose again" },
    ],
    end: { from: 10 },
  },
  "dvin-vertical": {
    level: "dvin",
    scenes: [
      { at: 0, kind: "map", a: [590, 199, 1.2], b: [590, 215, 1.5], markers: [{ node: "dvin", name: "Dvin", hy: HY.dvin, sub: "The plain of Ayrarat", at: 0, big: true }] },
      { at: 0.45, kind: "field", stage: { mode: "empty", wave: 0 }, a: [420, 300, 1.0], b: [380, 215, 1.6] },
      { at: 1, kind: "field", stage: { mode: "march", wave: 2, live: true, head: 0.5, spread: 0.42, roles: ["raider", "cavalry", "spearman", "raider", "cavalry", "spearman", "raider", "spearman"] }, a: [330, 330, 1.0], b: [480, 350, 1.1] },
      { at: 2, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 1, role: "raider", n: 2 }, { at: 3, role: "cavalry", n: 2 }] }, a: [600, 360, 1.0], b: [760, 370, 1.1] },
      { at: 2.47, kind: "field", keep: true, stage: { live: true }, a: [860, 380, 1.15], b: [960, 370, 1.4] },
      { at: 2.78, kind: "field", stage: { mode: "fall", wave: 8 }, a: [960, 360, 1.3], b: [1000, 360, 1.6] },
      { at: 3, kind: "art", a: [800, 800, 1.0], b: [800, 680, 1.25] },
      { at: 4, kind: "field", stage: { mode: "garrison", wave: 1, noHero: true }, a: [1000, 420, 1.5], b: [990, 390, 1.05] },
    ],
    chips: [
      { from: 0.45, to: 0, text: "Dvin", sub: "Seat of the catholicos" },
      { from: 1, to: 1, text: "640", sub: "The first Arab armies in Armenia" },
      { from: 2, to: 2.47, text: "Theodoros Rshtuni", sub: "Commander of the Armenian forces" },
      { from: 3, to: 3, text: "A raid, not yet a conquest", sub: "Dvin rose again" },
    ],
    end: { from: 4 },
  },
};
