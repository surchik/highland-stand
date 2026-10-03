// One-shot patch: historical accuracy pass on battlefield chronicles, rosters and labels.
// Each replacement must match exactly once, or the script aborts without writing.
const fs = require("fs");
const file = require("path").join(__dirname, "..", "index.html");
let src = fs.readFileSync(file, "utf8");
const T = require(process.argv[2]);
function rep(from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error("expected 1 match, got " + n + " for: " + from.slice(0, 90));
  src = src.replace(from, () => to);
}
const js = s => JSON.stringify(s);
// replace a level's history block (from `history:` up to the next `path:`/`paths:` line)
function history(name, text) {
  const start = src.indexOf("name: " + js(name));
  if (start < 0) throw new Error("level not found: " + name);
  const h = src.indexOf("history:", start);
  const end = src.indexOf("\n    path", h);
  src = src.slice(0, h) + "history: " + js(text) + "," + src.slice(end);
}

// ---- battlefields ----
history("Erebuni Rise", T.erebuni);
rep(`era: 0, date: "782 BC",`, `era: 0, date: "782 BC", year: -782,
    hero: { name: "Argishti I", title: "King of Urartu" },
    units: {
      raider:  { name: "Etiuni Raiders" },
      boss:    { name: "Shamshi-ilu the Turtan" },
    },`);

history("Vale of Tushpa", T.tushpa);
rep(`era: 0, date: "714 BC",`, `era: 0, date: "735 BC", year: -735,
    hero: { name: "Sarduri II", title: "King of Urartu" },
    units: {
      raider:  { name: "Itu'aean Archers" },
    },`);

rep(`name: "Araxes Crossing",
    tag: "The plain of Avarayr — faith against the Immortals.",
    era: 1, date: "451 AD",`, `name: "Avarayr Plain",
    tag: "On the Tghmut banks, faith against the shahanshah.",
    era: 1, date: "451 AD", year: 451,
    hero: { name: "Vardan Mamikonian", title: "Sparapet of Armenia" },`);
history("Avarayr Plain", T.avarayr);

rep(`era: 2, date: "640 AD",`, `era: 2, date: "640 AD", year: 640,
    hero: { name: "Theodoros Rshtuni", title: "Prince of Rshtunik" },
    foe: "Arab",
    units: {
      raider:   { name: "Arab Raiders" },
      spearman: { name: "Arab Spearmen", variant: "arab" },
      cavalry:  { name: "Arab Horsemen" },
    },`);
history("Dvin Gates", T.dvin);

rep(`name: "Lori Gates",
    tag: "Two forest roads converge below the monastery.",
    era: 2, date: "910 AD",`, `name: "Tashir Gates",
    tag: "Two forest roads converge in the gorges of Tashir.",
    era: 2, date: "914 AD", year: 914,
    hero: { name: "Ashot II", title: "Son of King Smbat" },
    foe: "Sajid",
    units: {
      raider:   { name: "Sajid Raiders" },
      spearman: { name: "Sajid Spearmen", variant: "arab" },
      cavalry:  { name: "Ghulam Horsemen" },
      boss:     { name: "Sajid Garrison Captain" },
    },`);
history("Tashir Gates", T.tashir);

rep(`era: 2, date: "921 AD",`, `era: 2, date: "921 AD", year: 921,
    hero: { name: "Ashot II Erkat", title: "The Iron King" },
    foe: "Sajid",
    units: {
      raider:   { name: "Sajid Skirmishers" },
      spearman: { name: "Sajid Spearmen", variant: "arab" },
      cavalry:  { name: "Sajid Horsemen" },
      boss:     { name: "Beshir, Sajid General" },
    },`);
history("Sevan Shores", T.sevan);

rep(`tag: "The stone city beneath snowbound Aragats.",
    era: 3, date: "1579 AD",`, `tag: "The frontier plain beneath snowbound Aragats.",
    era: 3, date: "1579 AD", year: 1579,
    hero: { name: "Captain of Shirak", title: "Highland defender" },`);
history("Gyumri Road", T.gyumri);

// ---- era rosters ----
rep(`name: "Assyrian Invasion", period: "8th century BC", icon: "🏹", hpMult: 1.0, bounty: 1.0,
    story: "Kingdom of Urartu, 8th century BC. Sargon's armies march north across the highlands toward the fortress of Tushpa on the shore of Lake Van.",`,
`name: "Assyrian Invasion", period: "8th century BC", icon: "🏹", hpMult: 1.0, bounty: 1.0, foe: "Assyrian",
    story: "Kingdom of Urartu, 8th century BC. Again and again the kings of Assyria march north against Biainili, forerunner kingdom of the Armenian highlands, and its forts by Lake Van. Hold the walls.",`);
rep(`raider:   { name: "Cimmerian Raiders",      color: "#b05a3a", trim: "#e8b27a" },
      spearman: { name: "Assyrian Spearmen",`, `raider:   { name: "Aramean Skirmishers",    color: "#b05a3a", trim: "#e8b27a" },
      spearman: { name: "Assyrian Spearmen",`);
rep(`cavalry:  { name: "Median Cavalry",         color: "#8a5f8f", trim: "#d9b2de" },
      ram:      { name: "Siege Ram",`, `cavalry:  { name: "Assyrian Horsemen",      color: "#8a5f8f", trim: "#d9b2de" },
      ram:      { name: "Siege Ram",`);
rep(`boss:     { name: "Sargon, King of Assyria",color: "#8f2f2a", trim: "#ffd27a" },
      flyer:    { name: "War Falcons",`, `boss:     { name: "Tiglath-Pileser III",    color: "#8f2f2a", trim: "#ffd27a" },
      flyer:    { name: "Hunting Hawks",`);

rep(`name: "Persian Invasion", period: "451 AD — Avarayr", icon: "🐘", hpMult: 1.18, bounty: 1.12,
    story: "451 AD. The Sasanian shahanshah sends the Savaran and his war elephants to bend Armenia's faith. Hold the line as Vardan held it at Avarayr.",`,
`name: "Persian Invasion", period: "451 AD, Avarayr", icon: "🐘", hpMult: 1.18, bounty: 1.12, foe: "Sasanian",
    story: "451 AD. The Sasanian shahanshah sends the savaran and his war elephants to bend Armenia's faith. Stand as Vardan stood at Avarayr.",`);
rep(`spearman: { name: "Immortal Spearmen",     color: "#5d4a7d", trim: "#c9b6ea" },
      shield:   { name: "Savaran Shieldbearers", color: "#4a5d7d", trim: "#ffd27a" },
      cavalry:  { name: "Cataphracts",`, `spearman: { name: "Paygan Spearmen",       color: "#5d4a7d", trim: "#c9b6ea" },
      shield:   { name: "Sasanian Shieldmen",    color: "#4a5d7d", trim: "#ffd27a" },
      cavalry:  { name: "Savaran Cataphracts",`);
rep(`boss:     { name: "Yazdegerd II",          color: "#5d3a8f", trim: "#ffd27a" },
      flyer:    { name: "Simurgh Fledglings",`, `boss:     { name: "Mushkan Niusalavurt",   color: "#5d3a8f", trim: "#ffd27a" },
      flyer:    { name: "Royal Hawks",`);

rep(`name: "Arab Invasion", period: "7th century AD", icon: "🌙", hpMult: 1.35, bounty: 1.22,
    story: "7th century. The armies of the Caliphate sweep up from the south, and the naxarar lords look to your towers. The highlands must not break.",`,
`name: "Caliphate Invasion", period: "7th to 10th century AD", icon: "🌙", hpMult: 1.35, bounty: 1.22, foe: "Caliphate",
    story: "640 to 921 AD. First the Caliphate's Arab armies, then the Sajid emirs ruling in the Caliph's name, strike at Armenia, and the naxarar lords look to your towers. The highlands must not break.",`);
rep(`raider:   { name: "Desert Skirmishers",  color: "#b08a4a", trim: "#f0e0b0" },`,
    `raider:   { name: "Caliphate Raiders",   color: "#b08a4a", trim: "#f0e0b0" },`);
rep(`cavalry:  { name: "Camel Riders",        color: "#b89a5a", trim: "#3f7a55", variant: "camel", spdMult: 0.92 },`,
    `cavalry:  { name: "Caliphate Horsemen",  color: "#b89a5a", trim: "#3f7a55", spdMult: 0.92 },`);
rep(`flyer:    { name: "Desert Hawks",        color: "#a08050", trim: "#f0ead0", variant: "flyer" },`,
    `flyer:    { name: "Saker Falcons",       color: "#a08050", trim: "#f0ead0", variant: "flyer" },`);

rep(`name: "Ottoman Invasion", period: "16th century AD", icon: "💣", hpMult: 1.55, bounty: 1.32,
    story: "16th century. Janissaries drill in the valley and the Sultan's great bombards roll up the mountain road. Old stone against new gunpowder.",`,
`name: "Ottoman Invasion", period: "16th century AD", icon: "💣", hpMult: 1.55, bounty: 1.32, foe: "Ottoman",
    story: "16th century. The wars of Sultan and Shah sweep over the Armenian highlands. Janissaries drill in the valley and the Sultan's siege guns roll up the mountain road. Hold the old stone walls.",`);
rep(`spearman: { name: "Janissaries",          color: "#7d2f35", trim: "#f2f0ea", variant: "janissary" },`,
    `spearman: { name: "Janissary Musketeers", color: "#7d2f35", trim: "#f2f0ea", variant: "janissary" },`);
rep(`ram:      { name: "Great Bombard",        color: "#4a4a52", trim: "#c9a86a", variant: "cannon", spdMult: 0.9 },
      boss:     { name: "The Sultan's Champion",color: "#7d1f2f", trim: "#ffd27a" },`,
    `ram:      { name: "Siege Cannon",         color: "#4a4a52", trim: "#c9a86a", variant: "cannon", spdMult: 0.9 },
      boss:     { name: "Lala Mustafa Pasha",   color: "#7d1f2f", trim: "#ffd27a" },`);

fs.writeFileSync(file, src);
console.log("patched");
