// The picture of each cut: scenes and plaques, placed by the narration's sentences (scripts.json).
// A position p is a sentence's index; its fraction is how far through that sentence (3.5: half way through the
// fourth). film.js turns positions into seconds from the narration's own timings, so the picture follows the
// voice whatever the voice's pace.
//   scene: { at: p, kind: "map" | "field" | "art", a: [cx, cy, zoom], b: [...] }  the camera moves a to b
//     map: chart units (720 x 400), markers: [{ node | xy, name, hy, sub, at: p }]
//     field: the battlefield's own units (1280 x 720); stage: { mode: "empty" | "garrison" | "battle", wave, live, spawn };
//            keep: true goes on with the stage before it; follow: { type: "hero" | <a foe's role> }
//     art: the chronicle's painting (1600 x 1600)
//     zoom 1 is the plate covering the frame
//   chip: { from: p, to: p, text, sub }  the plaque in the top left corner
// Every word on a plaque comes from the battlefield's own texts in index.html (its name, date, hero, chronicle).
const T = (name, sub, extra) => Object.assign({ name, sub }, extra || {});
const HY = { erebuni: "Էրեբունի", tushpa: "Տուշպա", avarayr: "Ավարայր", dvin: "Դվին" };   // HY_NAMES.field in index.html

module.exports = {
  "erebuni-landscape": {
    level: "erebuni",
    scenes: [
      { at: 0, kind: "map", a: [300, 215, 1.12], b: [205, 262, 1.85], markers: [{ node: "tushpa", name: "Tushpa", sub: "Rock citadel on Lake Van", at: 0.55 }] },
      { at: 2, kind: "map", a: [205, 262, 1.85], b: [366, 172, 1.95], markers: [{ node: "tushpa", name: "Tushpa", sub: "Rock citadel on Lake Van", at: 0, until: 2.6 }, { node: "erebuni", name: "Erebuni", hy: HY.erebuni, sub: "782 BC", at: 3.35, big: true }] },
      { at: 3.74, kind: "art", a: [800, 700, 1.0], b: [800, 520, 1.5] },
      { at: 4, kind: "field", stage: { mode: "empty", wave: 0 }, a: [440, 190, 1.55], b: [420, 118, 2.7] },
      { at: 5, kind: "field", keep: true, a: [1120, 400, 1.7], b: [1160, 350, 2.7] },
      { at: 6, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 2, role: "spearman", n: 2 }, { at: 5, role: "shield" }, { at: 8, role: "cavalry" }] }, a: [600, 420, 1.45], b: [820, 400, 1.75] },
      { at: 8, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [1080, 340, 1.9], b: [640, 360, 1.0] },
    ],
    chips: [
      { from: 0.45, to: 1, text: "8th century BC", sub: "The kingdom of Urartu, Biainili to its kings" },
      { from: 2, to: 3, text: "Argishti I", sub: "King of Urartu" },
      { from: 4, to: 4, text: "Arin Berd", sub: "The founding inscription, found in 1950" },
      { from: 5, to: 5, text: "Erebuni", sub: "A palace and a temple of Haldi" },
      { from: 7, to: 7, text: "No siege of Erebuni is recorded", sub: "This battle is the game's invention" },
    ],
    end: { from: 9 },
  },
  "erebuni-vertical": {
    level: "erebuni",
    scenes: [
      { at: 0, kind: "map", a: [345, 215, 1.0], b: [372, 178, 1.5], markers: [{ node: "erebuni", name: "Erebuni", hy: HY.erebuni, sub: "782 BC", at: 0.3, big: true }] },
      { at: 0.66, kind: "art", a: [800, 800, 1.0], b: [800, 640, 1.3] },
      { at: 1, kind: "field", stage: { mode: "empty", wave: 0 }, a: [440, 330, 1.0], b: [420, 240, 1.55] },
      { at: 2, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 1.5, role: "spearman", n: 2 }, { at: 4, role: "shield" }] }, a: [760, 360, 1.0], b: [860, 400, 1.2] },
      { at: 3, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [1150, 400, 1.6], b: [1130, 360, 1.05] },
    ],
    chips: [
      { from: 0.3, to: 0, text: "Argishti I", sub: "King of Urartu" },
      { from: 1, to: 1, text: "Arin Berd", sub: "The founding inscription" },
      { from: 2, to: 2, text: "No siege is recorded", sub: "This battle is the game's invention" },
    ],
    end: { from: 4 },
  },
  "tushpa-landscape": {
    level: "tushpa",
    scenes: [
      { at: 0, kind: "map", a: [300, 225, 1.12], b: [196, 268, 1.95], markers: [{ node: "tushpa", name: "Tushpa", hy: HY.tushpa, sub: "By Lake Van", at: 0.5, big: true }] },
      { at: 1, kind: "field", stage: { mode: "empty", wave: 0 }, a: [600, 200, 1.5], b: [560, 122, 2.6] },
      { at: 2, kind: "art", a: [800, 760, 1.0], b: [800, 560, 1.45] },
      { at: 3, kind: "field", stage: { mode: "battle", wave: 2, live: true, noHero: true, spawn: [{ at: 1, role: "spearman", n: 2 }, { at: 3, role: "shield", n: 2 }, { at: 5, role: "cavalry" }, { at: 7, role: "spearman", n: 2 }] }, a: [250, 250, 2.0], b: [420, 330, 2.0] },
      { at: 5, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 2, role: "spearman", n: 2 }, { at: 4, role: "ram" }, { at: 7, role: "shield", n: 2 }] }, a: [600, 330, 1.35], b: [930, 300, 2.0] },
      { at: 7, kind: "field", keep: true, stage: { live: true }, a: [600, 170, 2.3], b: [560, 130, 1.9] },
      { at: 8, kind: "field", keep: true, stage: { live: true }, a: [820, 330, 1.6], b: [640, 360, 1.0] },
    ],
    chips: [
      { from: 0.5, to: 0, text: "Urartu", sub: "Biainili to its kings" },
      { from: 1, to: 1, text: "The Rock of Van", sub: "The citadel of Tushpa" },
      { from: 2, to: 2, text: "Sarduri II", sub: "King of Urartu, mid-8th century BC" },
      { from: 3, to: 4, text: "743 BC", sub: "Tiglath-pileser III of Assyria breaks Sarduri and his allies" },
      { from: 5, to: 6, text: "735 BC", sub: "The Assyrian army before the gates of Tushpa" },
      { from: 7, to: 7, text: "The citadel did not fall" },
    ],
    end: { from: 9 },
  },
  "tushpa-vertical": {
    level: "tushpa",
    scenes: [
      { at: 0, kind: "map", a: [215, 235, 1.0], b: [188, 262, 1.5], markers: [{ node: "tushpa", name: "Tushpa", hy: HY.tushpa, sub: "By Lake Van", at: 0.3, big: true }] },
      { at: 1, kind: "field", stage: { mode: "empty", wave: 0 }, a: [580, 300, 1.0], b: [560, 210, 1.6] },
      { at: 2, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 2, role: "spearman", n: 2 }, { at: 4, role: "ram" }, { at: 7, role: "shield", n: 2 }, { at: 10, role: "spearman", n: 2 }] }, a: [470, 350, 1.0], b: [760, 330, 1.15] },
      { at: 3.4, kind: "field", keep: true, stage: { live: true }, a: [860, 330, 1.2], b: [985, 300, 1.7] },
      { at: 4, kind: "field", keep: true, stage: { live: true }, a: [570, 250, 1.7], b: [560, 300, 1.05] },
    ],
    chips: [
      { from: 0.3, to: 0, text: "Tushpa", sub: "The capital of Urartu" },
      { from: 1, to: 1, text: "The Rock of Van" },
      { from: 2, to: 3, text: "735 BC", sub: "Tiglath-pileser III of Assyria" },
      { from: 4, to: 4, text: "The citadel did not fall" },
    ],
    end: { from: 5 },
  },
  "avarayr-landscape": {
    level: "avarayr",
    scenes: [
      { at: 0, kind: "map", a: [330, 200, 1.1], b: [440, 262, 1.6], markers: [{ node: "avarayr", name: "Avarayr", hy: HY.avarayr, sub: "451 AD", at: 0.3, big: true }] },
      { at: 1, kind: "art", a: [800, 780, 1.0], b: [800, 600, 1.4] },
      { at: 2, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [330, 340, 1.5], b: [220, 350, 2.1] },
      { at: 3, kind: "field", keep: true, follow: { type: "hero", dy: -18 }, a: [640, 300, 2.6], b: [640, 300, 3.0] },
      { at: 4, kind: "field", stage: { mode: "battle", wave: 5, live: true, spawn: [{ at: 1, role: "ram" }, { at: 2, role: "cavalry", n: 2 }, { at: 5, role: "spearman", n: 2 }] }, follow: { type: "ram", dy: -30 }, a: [975, 350, 2.2], b: [975, 350, 2.2] },
      { at: 5, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 1, role: "spearman", n: 2 }, { at: 2, role: "shield", n: 2 }] }, a: [760, 430, 1.5], b: [560, 440, 1.12] },
      { at: 6, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 0.5, role: "cavalry", n: 2 }, { at: 2, role: "spearman", n: 3 }, { at: 5, role: "ram" }] }, a: [900, 300, 1.9], b: [560, 420, 1.7] },
      { at: 8, kind: "field", stage: { mode: "empty", wave: 7 }, a: [820, 250, 1.7], b: [700, 300, 1.3] },
      { at: 9, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [300, 350, 1.7], b: [640, 360, 1.0] },
    ],
    chips: [
      { from: 1, to: 1, text: "449", sub: "The command of Yazdegerd II, shahanshah of Sasanian Persia" },
      { from: 3, to: 3, text: "Vardan Mamikonian", sub: "Sparapet of Armenia" },
      { from: 4, to: 5, text: "451", sub: "The plain of Avarayr, by the river Tghmut" },
      { from: 8, to: 8, text: "484", sub: "The Treaty of Nvarsak: freedom of worship" },
    ],
    end: { from: 9 },
  },
  "avarayr-vertical": {
    level: "avarayr",
    scenes: [
      { at: 0, kind: "map", a: [440, 240, 1.0], b: [466, 280, 1.45], markers: [{ node: "avarayr", name: "Avarayr", hy: HY.avarayr, sub: "451 AD", at: 0.35, big: true }] },
      { at: 1, kind: "field", stage: { mode: "garrison", wave: 1 }, follow: { type: "hero", dy: -30 }, a: [640, 300, 1.7], b: [640, 300, 2.0] },
      { at: 2, kind: "field", stage: { mode: "battle", wave: 5, live: true, spawn: [{ at: 1, role: "ram" }, { at: 3, role: "cavalry", n: 2 }, { at: 5, role: "spearman", n: 2 }] }, a: [960, 380, 1.15], b: [860, 400, 1.0] },
      { at: 4, kind: "field", stage: { mode: "empty", wave: 7 }, a: [860, 300, 1.25], b: [760, 330, 1.0] },
      { at: 5, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [230, 380, 1.5], b: [250, 360, 1.05] },
    ],
    chips: [
      { from: 0.35, to: 0, text: "449", sub: "The command of Yazdegerd II" },
      { from: 1, to: 1, text: "Vardan Mamikonian", sub: "Sparapet of Armenia" },
      { from: 2, to: 3, text: "451", sub: "The plain of Avarayr" },
      { from: 4, to: 4, text: "484", sub: "Freedom of worship" },
    ],
    end: { from: 5 },
  },
  "dvin-landscape": {
    level: "dvin",
    scenes: [
      { at: 0, kind: "map", a: [470, 215, 1.15], b: [572, 246, 1.95], markers: [{ node: "dvin", name: "Dvin", hy: HY.dvin, sub: "The plain of Ayrarat", at: 0.42, big: true }] },
      { at: 1, kind: "field", stage: { mode: "empty", wave: 0 }, a: [640, 330, 1.2], b: [480, 170, 1.9] },
      { at: 2, kind: "field", keep: true, a: [440, 150, 2.2], b: [372, 95, 3.1] },
      { at: 3, kind: "map", a: [575, 345, 1.75], b: [588, 262, 1.9], markers: [{ node: "dvin", name: "Dvin", hy: HY.dvin, at: 4.3 }] },
      { at: 5, kind: "field", stage: { mode: "garrison", wave: 1 }, follow: { type: "hero", dy: -18 }, a: [640, 300, 2.5], b: [640, 300, 2.9] },
      { at: 6, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 1, role: "raider", n: 2 }, { at: 3, role: "cavalry", n: 2 }, { at: 6, role: "spearman", n: 2 }, { at: 9, role: "raider", n: 2 }] }, a: [330, 330, 1.7], b: [640, 350, 1.5] },
      { at: 7, kind: "field", keep: true, stage: { live: true, spawn: [{ at: 1, role: "spearman", n: 2 }, { at: 4, role: "cavalry", n: 2 }] }, a: [800, 400, 1.6], b: [990, 350, 2.2] },
      { at: 9, kind: "art", a: [800, 760, 1.0], b: [800, 560, 1.4] },
      { at: 10, kind: "field", stage: { mode: "battle", wave: 3, live: true, spawn: [{ at: 0.5, role: "raider", n: 3 }, { at: 2, role: "spearman", n: 2 }, { at: 4, role: "cavalry", n: 2 }] }, a: [380, 400, 1.45], b: [640, 360, 1.0] },
    ],
    chips: [
      { from: 1, to: 1, text: "Dvin", sub: "Seat of the catholicos, head of the Armenian Church" },
      { from: 2, to: 2, text: "Dvin", sub: "The cathedral of St. Gregory" },
      { from: 4, to: 4, text: "640", sub: "The first Arab armies come north into Armenia" },
      { from: 5, to: 5, text: "Theodoros Rshtuni", sub: "Commander of the Armenian forces" },
      { from: 8, to: 8, text: "640", sub: "The Armenian histories tell of 35,000 captives" },
      { from: 9, to: 9, text: "A raid, not yet a conquest", sub: "Dvin rose again" },
    ],
    end: { from: 11 },
  },
  "dvin-vertical": {
    level: "dvin",
    scenes: [
      { at: 0, kind: "map", a: [560, 225, 1.0], b: [588, 250, 1.5], markers: [{ node: "dvin", name: "Dvin", hy: HY.dvin, sub: "The plain of Ayrarat", at: 0.2, big: true }] },
      { at: 0.55, kind: "field", stage: { mode: "empty", wave: 0 }, a: [420, 300, 1.0], b: [380, 215, 1.6] },
      { at: 1, kind: "field", stage: { mode: "battle", wave: 6, live: true, spawn: [{ at: 1, role: "raider", n: 2 }, { at: 3, role: "cavalry", n: 2 }, { at: 6, role: "spearman", n: 2 }, { at: 9, role: "raider", n: 2 }] }, a: [380, 330, 1.0], b: [560, 350, 1.1] },
      { at: 2.45, kind: "field", keep: true, stage: { live: true }, a: [860, 380, 1.15], b: [1000, 350, 1.6] },
      { at: 3, kind: "art", a: [800, 800, 1.0], b: [800, 660, 1.25] },
      { at: 4, kind: "field", stage: { mode: "garrison", wave: 1 }, a: [1000, 400, 1.5], b: [990, 370, 1.05] },
    ],
    chips: [
      { from: 0.55, to: 0, text: "Dvin", sub: "Seat of the catholicos" },
      { from: 1, to: 2, text: "640", sub: "The first Arab armies in Armenia" },
      { from: 3, to: 3, text: "A raid, not yet a conquest", sub: "Dvin rose again" },
    ],
    end: { from: 4 },
  },
};
