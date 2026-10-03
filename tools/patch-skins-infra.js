// Infrastructure for era tower skins, outflankers and the smoke mechanic.
const fs = require("fs");
const file = require("path").join(__dirname, "..", "index.html");
let s = fs.readFileSync(file, "utf8");
function rep(a, b, all) {
  const n = s.split(a).length - 1;
  if (!n || (!all && n !== 1)) throw new Error(n + " matches: " + a.slice(0, 100));
  s = all ? s.split(a).join(b) : s.replace(a, () => b);
}
function between(startMarker, endMarker, replacement) {
  const a = s.indexOf(startMarker), b = s.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error("markers not found: " + startMarker.slice(0, 60));
  s = s.slice(0, a) + replacement + s.slice(b);
}

// ---------- 1. names: every slot, mastery and spell as each age knew it ----------
between("// tower, mastery and spell names that fit each age", "\nfunction waveGroups(w) {", `// ---------- tower skins: each age mans the same five slots with its own engines ----------
// Gameplay lives in TOWER_DEFS and never changes with the era; only what stands on the pad does.
// A skin registers its painter (baked once per rank, like every structure), its live parts
// (drawn each frame in screen space) and its projectile in SKIN_ART, in its own section below.
const TOWER_SKINS = {
  archer:   ["archer", "archer", "archer", "archer"],
  ballista: ["javelin", "ballista", "ballista", "musket"],
  catapult: ["hurlers", "catapult", "trebuchet", "hurlers"],
  fire:     ["beacon", "cauldron", "cauldron", "cauldron"],
  drums:    ["standard", "exhort", "banner", "drums"],
};
const SKIN_ART = {};      // skin id -> { box, scale, paint, variant, live, footing, proj, projSpeed, sound, onFire, kickDrop }
const PROJ_ART = {};      // projectile kind -> painter, for kinds the first arsenal lacked
function towerSkin(type, era) {
  const row = TOWER_SKINS[type], e = era == null ? curEra : era;
  return (row && row[Math.max(0, Math.min(3, e | 0))]) || type;
}
function skinArt(type) { return SKIN_ART[towerSkin(type)] || null; }

// what each slot is called in each age. Urartu: no mechanical artillery before c. 400 BC, and
// hill-top fire beacons are attested; Haldi was the god of war and state, Teisheba of storm.
// 451: no fire altar on the Christian side. 1579: gunpowder, and the defenders' guns are few.
const SLOT_NAMES = {
  archer:   ["Biainili Bowmen", "Nakharar Bowmen", "Nakharar Bowmen", "Highland Bowmen"],
  ballista: ["Javelin Bastion", "Field Ballista", "Bolt-Thrower", "Musket Nest"],
  catapult: ["Stone-Hurlers", "Onager", "Traction Trebuchet", "Stone-Hurlers"],
  fire:     ["Beacon Fire", "Pitch Cauldron", "Pitch Cauldron", "Pitch Cauldron"],
  drums:    ["Standard of Haldi", "Ghevond's Exhortation", "Prince's Banner", "Village Drums"],
};
const SKIN_BLURB = {
  archer: "Fast arrows, single target. Reliable.",
  javelin: "Hurled javelins. Long reach, pierces armor.",
  ballista: "Long range bolt. Pierces armor.",
  musket: "Matchlock fire. Long reach, pierces armor.",
  hurlers: "Hurled stones, splash damage.",
  catapult: "Lobbed stone, splash damage.",
  trebuchet: "Pull-crew engine: lobbed stone, splash damage.",
  beacon: "Beacon flames slow and burn nearby foes.",
  cauldron: "Boiling pitch slows and burns nearby foes.",
  standard: "Inspire nearby towers: faster, harder strikes.",
  exhort: "Inspire nearby towers: faster, harder strikes.",
  banner: "Inspire nearby towers: faster, harder strikes.",
  drums: "Inspire nearby towers: faster, harder strikes.",
};
// mastery names that fit the engine; their numbers always come from TOWER_DEFS
const SKIN_SPECS = {
  javelin:  { a: ["Heavy Javelins", "One great armor-splitting javelin"], b: ["Twin Throwers", "Two javelins, two targets"] },
  musket:   { a: ["Long Muskets", "One heavy armor-splitting ball"], b: ["Double Volley", "Two volleys, two targets"] },
  hurlers:  { a: ["Great Boulders", "Massive stones, huge blast"], b: ["Firepots", "Burning pitch clings to the enemy"] },
  trebuchet: { a: ["Great Beam", "Massive stone, huge blast"] },
  beacon:   { a: ["Sacred Inferno"], b: ["Wrath of Haldi", "Every 5s the god stuns all foes near"] },
  cauldron: { a: ["Naphtha Fire"], b: ["Fire Burst", "Every 5s a blast of fire stuns all foes near"] },
  standard: { b: ["Standards of Haldi"] },
  exhort:   { b: ["Battle Standards"] },
  banner:   { b: ["Battle Standards"] },
  drums:    { b: ["Battle Standards"] },
};
const WRATH_NAMES = ["Teisheba's Storm", "Highland Storm", "Highland Storm", "Highland Storm"];
function towerName(type) {
  const row = SLOT_NAMES[type];
  return (row && row[Math.max(0, Math.min(3, curEra | 0))]) || TOWER_DEFS[type].name;
}
function specInfo(type, key) {
  const sp = TOWER_DEFS[type].specs[key], own = (SKIN_SPECS[towerSkin(type)] || {})[key];
  if (!own) return sp;
  return Object.assign({}, sp, { name: own[0] }, own[1] ? { desc: own[1] } : null);
}
// rewrite every era-dependent label in the tray and spell bar for the battlefield now chosen
function applyEraLabels() {
  document.querySelectorAll("#shop .card").forEach(card => {
    const type = card.dataset.type;
    if (!TOWER_DEFS[type]) return;
    const nm = card.querySelector(".nm"), ds = card.querySelector(".ds");
    if (nm) nm.textContent = towerName(type);
    if (ds) {
      ds.textContent = "";
      const b = document.createElement("b");
      b.textContent = towerName(type);
      ds.appendChild(b);
      ds.appendChild(document.createTextNode(SKIN_BLURB[towerSkin(type)] || ""));
    }
  });
  const wb = document.querySelector('#spellbar .spell[data-spell="wrath"]');
  if (wb) wb.title = WRATH_NAMES[curEra] + ": lightning strike (E)";
  const hb = $("heroBtn");
  if (hb) hb.title = heroName() + ": select, then click the field to march to that spot (R)";
  if (eraLabelsDrawn !== curEra && typeof renderShopPortraits === "function") {
    eraLabelsDrawn = curEra;
    try { renderShopPortraits(); } catch (err) { /* portraits are decoration */ }
  }
}
let eraLabelsDrawn = -1;
`);

// ---------- 2. tower drawing goes through the skin ----------
rep(`function towerReach(type) {
  const b = TOWER_BOX[type] || TOWER_BOX.archer, k = STRUCT_K * (TOWER_SCALE[type] || 1);`,
`function towerReach(type) {
  const art = skinArt(type);
  const b = (art && art.box) || TOWER_BOX[type] || TOWER_BOX.archer, k = STRUCT_K * ((art && art.scale) || TOWER_SCALE[type] || 1);`);

rep(`  const type = TOWER_BOX[t.type] ? t.type : "archer";
  const lvl = structClamp(t.level | 0, 0, 2);
  const spec = t.spec ? (t.spec === "b" ? "b" : "a") : null;
  const k = s * STRUCT_K * (TOWER_SCALE[type] || 1);`,
`  const type = TOWER_BOX[t.type] ? t.type : "archer";
  // what stands on the pad follows the age; the slot's numbers do not
  const skin = towerSkin(type), art = SKIN_ART[skin] || null;
  const lvl = structClamp(t.level | 0, 0, 2);
  const spec = t.spec ? (t.spec === "b" ? "b" : "a") : null;
  const k = s * STRUCT_K * ((art && art.scale) || TOWER_SCALE[type] || 1);`);

rep(`  const variant = type === "archer" ? (Math.cos(aim) < 0 ? 1 : 0)
    : type === "catapult" ? (t.cd > rate * 0.6 ? 1 : 0) : 0;
  const sited = t.pad >= 0;
  const key = type + lvl + (spec || "-") + variant + THEME.backdrop + Math.round(glow * 4) + "|" + Math.round(pxu * 256);
  const sp = structSprite(key, pxu, TOWER_BOX[type], () => paintTowerBody(type, lvl, spec, variant), glow);`,
`  const variant = art && art.variant ? art.variant(t, aim, rate)
    : skin === "archer" ? (Math.cos(aim) < 0 ? 1 : 0)
    : skin === "catapult" ? (t.cd > rate * 0.6 ? 1 : 0) : 0;
  const sited = t.pad >= 0;
  const key = skin + lvl + (spec || "-") + variant + THEME.backdrop + Math.round(glow * 4) + "|" + Math.round(pxu * 256);
  const sp = structSprite(key, pxu, (art && art.box) || TOWER_BOX[type],
    art ? () => art.paint(lvl, spec, variant) : () => paintTowerBody(type, lvl, spec, variant), glow);`);

rep(`    const foot = towerFooting(type, lvl, spec);
    fit.half = foot.round ? foot.rx : foot.w / 2 + foot.d * OBQ.dx / 2;`,
`    const foot = art && art.footing ? art.footing(lvl, spec) : towerFooting(type, lvl, spec);
    fit.half = foot.round ? foot.rx : foot.w / 2 + foot.d * OBQ.dx / 2;`);

rep(`  const sy = y - (type === "catapult" ? kick * 1.2 * k : 0);
  blitStructSprite(ctx, sp, x, sy, k, m);
  noteNightLit(sp, x, sy, k, glow * fade);
  if (kick > 0 && type === "catapult") {`,
`  const drop = skin === "catapult" ? 1.2 : (art && art.kickDrop) || 0;
  const sy = y - kick * drop * k;
  blitStructSprite(ctx, sp, x, sy, k, m);
  noteNightLit(sp, x, sy, k, glow * fade);
  if (kick > 0 && drop > 0) {`);

rep(`  if (type === "ballista" && fit.pivot) {`, `  if (art && art.live) {
    // a skin draws its own moving parts: crews, flames, smoke, the engine at its aim
    art.live(t, { x, y, k, s, fit, time, kick, fade, aim, lvl, spec, pxu, m, glow });
  } else if (skin === "ballista" && fit.pivot) {`);
rep(`  } else if (type === "catapult" && fit.brazier) {`, `  } else if (skin === "catapult" && fit.brazier) {`);
rep(`  } else if (type === "fire" && fit.flame) {`, `  } else if (skin === "fire" && fit.flame) {`);
rep(`  } else if (type === "drums") {
    // each drummer's two mallets`, `  } else if (skin === "drums" && fit.drummers) {
    // each drummer's two mallets`);
rep(`  for (const pn of fit.pennants) {
    drawPennant(`, `  for (const pn of fit.pennants || []) {
    drawPennant(`);

// ---------- 3. projectiles and their sounds follow the skin ----------
rep(`  const dmg = Math.round(st.dmg * dmgMult);
  if (def.proj === "stone") {`, `  const dmg = Math.round(st.dmg * dmgMult);
  const art = skinArt(t.type), kind = (art && art.proj) || def.proj;
  if (kind === "stone") {`);
rep(`      fiery: t.spec === "b" && t.type === "catapult",
    });
    Snd.play("catapult");
  } else {
    projectiles.push({
      kind: def.proj, x: t.x, y: t.y - 28, target, src: t,
      speed: def.proj === "bolt" ? 560 : 430, dmg, pierce: !!def.pierce,
    });
    Snd.play(def.proj);
  }`, `      fiery: t.spec === "b" && t.type === "catapult",
    });
    Snd.play((art && art.sound) || "catapult");
  } else {
    projectiles.push({
      kind, x: t.x, y: t.y - 28, target, src: t,
      speed: (art && art.projSpeed) || (kind === "bolt" ? 560 : 430), dmg, pierce: !!def.pierce,
    });
    Snd.play((art && art.sound) || kind);
  }
  if (art && art.onFire) art.onFire(t, target);`);
rep(`function drawProjectile(pr) {
  if (pr.kind === "stone") {`, `function drawProjectile(pr) {
  const own = PROJ_ART[pr.kind];
  if (own) { own(pr); return; }
  if (pr.kind === "stone") {`);
rep(`    const throttle = { arrow: 70, bolt: 90, coin: 90, impact: 60, uiTick: 70 }[name] || 0;`,
    `    const throttle = { arrow: 70, bolt: 90, javelin: 80, musket: 110, hurl: 90, coin: 90, impact: 60, uiTick: 70 }[name] || 0;`);
rep(`      case "catapult": this.tone(70, 0.25, "sawtooth", 0.18, 45); this.noise(0.2, 700, 0.2); break;`,
`      case "catapult": this.tone(70, 0.25, "sawtooth", 0.18, 45); this.noise(0.2, 700, 0.2); break;
      case "javelin": this.noise(0.12, 1800, 0.24, "bandpass"); this.tone(420, 0.11, "triangle", 0.07, 170); break;
      case "musket": this.noise(0.16, 2600, 0.5); this.noise(0.45, 480, 0.32); this.tone(105, 0.22, "square", 0.12, 48); break;
      case "hurl": this.noise(0.1, 900, 0.22); this.tone(170, 0.12, "triangle", 0.08, 90); break;`);

// ---------- 4. the skin sections, one fenced region per skin, after the original painters ----------
const section = (id, title, body) => `
// ======================================================================================
// SKIN SECTION: ${id}. ${title}
// Everything this skin needs lives between this banner and its END banner.
// ======================================================================================
${body}
// ====================================== END SKIN SECTION: ${id} ======================================

`;
const stub = (id, slot, painter, extra) => `SKIN_ART.${id} = {
  // placeholder until the art lands: the slot's original engine stands in
  box: TOWER_BOX.${slot},
  scale: TOWER_SCALE.${slot},
  paint(lvl, spec, variant) { ${painter} },${extra || ""}
};`;
rep(`
// ---- the fortress: its architecture follows the map's site and era ----`,
section("javelin", "Urartu, ballista slot: a bastion of javelin-throwers", stub("javelin", "ballista", "paintBallistaBase(lvl, spec);", `
  proj: "javelin", projSpeed: 520, sound: "javelin",`)) +
section("musket", "1579, ballista slot: a musketeers' loopholed nest", stub("musket", "ballista", "paintBallistaBase(lvl, spec);", `
  proj: "ball", projSpeed: 900, sound: "musket",`)) +
section("hurlers", "Urartu and 1579, catapult slot: a parapet of stone-hurlers", stub("hurlers", "catapult", "paintCatapult(lvl, spec, !!variant);", `
  variant(t, aim, rate) { return t.cd > rate * 0.6 ? 1 : 0; },
  sound: "hurl",`)) +
section("trebuchet", "Caliphate era, catapult slot: a pull-crew traction trebuchet", stub("trebuchet", "catapult", "paintCatapult(lvl, spec, !!variant);", `
  variant(t, aim, rate) { return t.cd > rate * 0.6 ? 1 : 0; },
  kickDrop: 1.2,`)) +
section("beacon", "Urartu, fire slot: a hill-top fire beacon", stub("beacon", "fire", "paintFireAltar(lvl, spec);")) +
section("cauldron", "451 to 1579, fire slot: a cauldron of boiling pitch", stub("cauldron", "fire", "paintFireAltar(lvl, spec);")) +
section("standard", "Urartu, drums slot: the standard of Haldi", stub("standard", "drums", "paintWarDrums(lvl, spec);")) +
section("banner", "Caliphate era, drums slot: a prince's banner with horn-blowers", stub("banner", "drums", "paintWarDrums(lvl, spec);")) +
section("exhort", "451, drums slot: Ghevond the priest exhorts the army", stub("exhort", "drums", "paintWarDrums(lvl, spec);")) + `
// ---- the fortress: its architecture follows the map's site and era ----`);

// ---------- 5. outflankers: the flyer role is light troops who leave the road ----------
rep(`const UNIT_FLYER_LOOKS = [UNIT_LOOKS.bird, UNIT_LOOKS.simurgh, UNIT_LOOKS.vulture, UNIT_LOOKS.kite];`,
`const UNIT_FLYER_LOOKS = [UNIT_LOOKS.bird, UNIT_LOOKS.simurgh, UNIT_LOOKS.vulture, UNIT_LOOKS.kite];
${section("outflank", "the outflankers: light troops who leave the road and strike cross-country", `// No age had flying troops. The flyer role is men who leave the road and cut across broken
// ground straight for the fortress; only direct fire (bows, bolts, javelins, muskets) can pick
// them out, while lobbed stones and fire on the road miss them.
const OUTFLANK_LOOKS = [UNIT_LOOKS.foot, UNIT_LOOKS.foot, UNIT_LOOKS.foot, UNIT_LOOKS.horse];
function drawOutflanker(e, p, k, d, dir) {
  // placeholder until the art lands
  if (unitEra(e, d) === 3) { drawHorse(e, p, k, dir, d); return; }
  unitFace(dir);
  drawSoldier(e, k, d, Math.sin(unitPhase), "side");
}`)}
${section("ladder", "Caliphate era siege role: the smoke-and-ladder party", `// Sebeos: Dvin fell in 640 to smoke, arrows and ladders scaled over the wall. The party carries
// a ladder and smoke pots; near a tower it lights one, and the smoke blinds the towers inside it.
const LADDER_LOOKS = { side: UNIT_LOOKS.foot, end: UNIT_LOOKS.footEnd };
function drawLadderParty(e, p, k, d, dir) {
  // placeholder until the art lands
  const view = unitView(p);
  if (view === "side") unitFace(dir); else unitLit = 1;
  drawSoldier(e, k, d, Math.sin(unitPhase), view);
}`)}`);
rep(`  if (e.fly) return UNIT_FLYER_LOOKS[era] || UNIT_LOOKS.bird;`,
    `  if (e.fly) return OUTFLANK_LOOKS[era] || UNIT_LOOKS.foot;
  if (d.variant === "ladder") return unitView(p) !== "side" ? LADDER_LOOKS.end : LADDER_LOOKS.side;`);
rep(`  if (e.fly) {
    drawFlyer(e, 1, d, dir);
  } else if (d.variant === "elephant") {`, `  if (e.fly) {
    drawOutflanker(e, p, 1, d, dir);
  } else if (d.variant === "ladder") {
    drawLadderParty(e, p, 1, d, dir);
  } else if (d.variant === "elephant") {`);
// they are on the ground now: sorted by depth, veiled by towers, lit by fires, frozen by frost
rep(`objs.push({ y: p.y + (e.fly ? 900 : 0), fn: () => drawEnemy(e, p) });`, `objs.push({ y: p.y, fn: () => drawEnemy(e, p) });`);
rep(`    if (e.seenAt === drawStamp && !e.fly && e.seenY < y) test(`, `    if (e.seenAt === drawStamp && e.seenY < y) test(`);
rep(`  for (const e of enemies) {
    if (e.fly) continue;
    const p = enemyPos(e);
    walker(p.x, p.y, e.r || 11);`, `  for (const e of enemies) {
    const p = enemyPos(e);
    walker(p.x, p.y, e.r || 11);`);
rep(`      if (e.fly || !e.iceVis) continue;`, `      if (!e.iceVis) continue;`);
rep(`      const dx = p.x - pr.x, dy = (p.y - (e.fly ? 34 : 12)) - pr.y;`, `      const dx = p.x - pr.x, dy = (p.y - 12) - pr.y;`);
rep(`    if (!e.fly && moveMult > 0 && Math.random() < dt * 2.2) {`, `    if (moveMult > 0 && Math.random() < dt * 2.2) {`);
rep(`      if (!e.fly) corpses.push(`, `      corpses.push(`);
rep(`      if (e.fly && !def.air) continue;        // catapults cannot reach the sky`, `      if (e.fly && !def.air) continue;        // lobbed stones cannot find men in broken ground`);
rep(`          if (e.fly) continue;               // ground blasts miss the birds`, `          if (e.fly) continue;               // the blast is on the road; outflankers are off it`);
rep(`      if (e.fly) continue;   // sacred flames stay on the ground`, `      if (e.fly) continue;   // the fire guards the road; outflankers go round it`);
rep(`statRow("wing", "", def.air ? "Strikes flyers" : "Ground only")`, `statRow("wing", "", def.air ? "Hits outflankers" : "Road only")`);

// era rosters: the flyer role becomes outflanking troops, the era-2 ram a smoke-and-ladder party
rep(`      flyer:    { name: "Hunting Hawks",            color: "#8a6a42", trim: "#f0e0c0", variant: "flyer" },`,
    `      flyer:    { name: "Assyrian Scouts",          color: "#8a6a42", trim: "#f0e0c0", variant: "flyer" },`);
rep(`      flyer:    { name: "Royal Hawks",    color: "#7a5a8f", trim: "#ffd27a", variant: "flyer", hpMult: 1.1 },`,
    `      flyer:    { name: "Tghmut Fording Party",  color: "#7a5a8f", trim: "#ffd27a", variant: "flyer", hpMult: 1.1 },`);
rep(`      flyer:    { name: "Saker Falcons",       color: "#a08050", trim: "#f0ead0", variant: "flyer" },`,
    `      flyer:    { name: "Ridge Climbers",      color: "#a08050", trim: "#f0ead0", variant: "flyer" },`);
rep(`      flyer:    { name: "Imperial Falcons",     color: "#7d3a3a", trim: "#f0d0a0", variant: "flyer" },`,
    `      flyer:    { name: "Kurdish Horsemen",     color: "#7d3a3a", trim: "#f0d0a0", variant: "flyer" },`);
rep(`      ram:      { name: "Battering Ram",       color: "#7a5a35", trim: "#c9a86a", variant: "ram" },`,
    `      ram:      { name: "Smoke-and-Ladder Party", color: "#7a5a35", trim: "#c9a86a", variant: "ladder", hpMult: 0.6, spdMult: 1.4, armorAdd: -6 },`);
// Tushpa's outflankers cross Lake Van on inflated skins (Assyrian reliefs show the practice)
rep(`      raider:  { name: "Itu'aean Archers" },
    },`, `      raider:  { name: "Itu'aean Archers" },
      flyer:   { name: "Skin-Float Raiders" },
    },`);

// ---------- 6. smoke replaces the fog ----------
rep(`let sandActive = false;`, `let sandActive = false;   // retired: the Caliphate era's power is now the ladder parties' smoke
let smokeClouds = [];     // { x, y, r, t, dur }: world-space smoke the ladder parties light`);
rep(`  sandActive = false;
  corpses = [];`, `  sandActive = false;
  smokeClouds = [];
  corpses = [];`);
rep(`  if (curEra === 2 && waveIdx % 4 === 0) msg += " Mountain fog rolls in with them!";`,
    `  if (curEra === 2 && waveGroups(waveIdx).some(g => g.type === "ram")) msg += " Smoke parties carry ladders and fire pots!";`);
rep(`  sandActive = curEra === 2 && phase === "wave" && waveIdx % 4 === 0;`, `  sandActive = false;
  for (const c of smokeClouds) c.t += dt;
  smokeClouds = smokeClouds.filter(c => c.t < c.dur);`);
rep(`    const rangeMult = sandActive ? 0.8 : 1;   // mountain fog blinds the towers`,
    `    const rangeMult = towerInSmoke(t) ? 0.7 : 1;   // smoke blinds the towers inside it`);
rep(`      } else if (curEra === 3) {
        e.mechT += dt;
        if (e.mechT >= 6) { e.mechT = 0; bombardVolley(e); }
      }`, `      } else if (curEra === 2) {
        // the ladder party lights a smoke pot whenever it comes up under a tower
        e.mechT += dt;
        if (e.mechT >= 0) {
          const p = enemyPos(e);
          if (towers.some(t => inGroundRange(p.x, p.y, t.x, t.y, 150))) {
            smokeClouds.push({ x: p.x, y: p.y, r: 105, t: 0, dur: 9 });
            e.mechT = -12;
          }
        }
      } else if (curEra === 3) {
        e.mechT += dt;
        if (e.mechT >= 6) { e.mechT = 0; bombardVolley(e); }
      }`);
rep(`function bombardVolley(e) {`, `// a tower stands in smoke while any live cloud covers its pad; a thinning cloud still counts
function towerInSmoke(t) {
  for (const c of smokeClouds) {
    if (c.t < c.dur && inGroundRange(c.x, c.y, t.x, t.y, c.r * smokeSwell(c))) return true;
  }
  return false;
}
// a cloud billows out over its first two seconds and keeps that reach until it lifts
function smokeSwell(c) { return Math.min(1, 0.35 + c.t / 2); }
function bombardVolley(e) {`);
// frost: a cold wind off Aragats scatters the smoke under the spell
rep(`  } else if (key === "frost") {
    spellFx.push({ type: "frostRing", x, y, t: 0 });`, `  } else if (key === "frost") {
    spellFx.push({ type: "frostRing", x, y, t: 0 });
    smokeClouds = smokeClouds.filter(c => !inGroundRange(x, y, c.x, c.y, S.radius + c.r * 0.5));`);
// draw the clouds where the fog was
rep(`  if (sandActive && overlayEl.classList.contains("hidden")) {
    // mountain fog:`, `  if (smokeClouds.length) drawSmokeClouds(time);
  if (false) {
    // retired mountain fog:`);
rep(`function drawAtmosphere(time) {`, `${section("smoke", "Caliphate era: the smoke clouds the ladder parties light", `// drawn over the field from the clouds in smokeClouds (world units); reach is c.r * smokeSwell(c)
function drawSmokeClouds(time) {
  // placeholder until the art lands: soft grey puffs
  for (const c of smokeClouds) {
    const fade = Math.min(1, (c.dur - c.t) / 2), pp = proj(c.x, c.y), R = c.r * smokeSwell(c) * pp.s;
    ctx.save();
    ctx.translate(pp.x, pp.y - 20 * pp.s);
    ctx.scale(1, ELLIPSE);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, "rgba(96, 92, 88, " + (0.55 * fade).toFixed(3) + ")");
    g.addColorStop(1, "rgba(96, 92, 88, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}`)}
function drawAtmosphere(time) {`);

// ---------- 7. harness: the tower sheet can be shot in any battlefield's age ----------
rep(`function photoSheet(kind) {
  curLevel = 1; curDiff = 1;
  resetGame();`, `function photoSheet(kind) {
  curLevel = HARNESS.has("lv") ? Math.max(0, Math.min(LEVELS.length - 1, Number(HARNESS.get("lv")) | 0)) : 1;
  curDiff = 1;
  resetGame();`);

fs.writeFileSync(file, s);
console.log("infrastructure patched");
