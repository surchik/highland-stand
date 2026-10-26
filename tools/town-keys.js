// Under Ararat (WP4 post-P): the keyboard and focus audit on desktop, by real key presses: the keys of spec 9.14,
// Tab and Shift+Tab stay in the room and in an open card (the room inert under it), no keydown reaches the page's
// own listeners while the town is open (M and S pass, as Nardi's do), Escape's chain, the focus back on the door.
// Usage: NODE_PATH=$(npm root -g) node tools/town-keys.js     (GAME=path/index.html); prints RESULT PASS or FAIL
const { chromium } = require(process.env.PW_PATH || "playwright");
const path = require("path");
const FILE = path.resolve(process.env.GAME || path.join(__dirname, "..", "index.html"));
const out = [], fails = [];
const ok = (c, m) => { out.push((c ? "ok   " : "FAIL ") + m); if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file://" + FILE);
  await page.waitForTimeout(1500);
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { for (const k of ["hs_town", "hs_town_run", "hs_town_bless"]) localStorage.removeItem(k); if (menuMode === "chapter") $("startBtn").click(); });
  await page.waitForTimeout(300);
  // a spy on the page's own levels: nothing may reach it while the town is open
  await ev(() => { window.__leak = []; for (const t of [document, document.body, $("overlay")]) t.addEventListener("keydown", e => window.__leak.push(e.code)); window.addEventListener("keydown", e => window.__leak.push("w:" + e.code)); });
  await page.focus("#townBtn"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok(await ev(() => Town.isOpen() && Town.test.card() === "start"), "Enter on the door opens the start card");
  await ev(() => { window.__leak = []; });
  const act = () => ev(() => { const a = document.activeElement; return a ? (a.id || a.dataset.act || a.dataset.a || a.dataset.b || a.dataset.diff || a.tagName) + (Town.test.root().contains(a) ? "" : "!OUT") : "none"; });
  ok((await act()) === "begin", "the primary button has the focus: " + await act());
  // Tab around the start card: the focus never leaves it
  const seen = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); seen.push(await act()); }
  ok(seen.every(s => !s.includes("!OUT")) && await ev(() => Town.test.root().querySelector("#twCard").contains(document.activeElement)), "Tab stays in the start card: " + seen.join(","));
  ok((await ev(() => window.__leak.length)) === 0, "no key reached the page under the town: " + await ev(() => window.__leak.join(",")));
  await page.focus("#twCard [data-act=begin]"); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
  ok(await ev(() => Town.test.card() === "age"), "Begin by Enter: the age card");
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  ok(await ev(() => Town.test.card() === ""), "Escape closes the age card");
  ok(await ev(() => Town.test.root().contains(document.activeElement)), "the focus is in the room after the card");
  // the game keys
  const st = () => ev(() => ({ mode: Town.test.mode(), sheet: Town.test.sheet(), sel: Town.test.sel(), card: Town.test.card(), held: [...Town.test.held()], zoom: Town.test.view().zoom, x: Town.test.view().x, ghost: Town.test.ghost() }));
  await page.keyboard.press("Digit1"); let s = await st();
  ok(s.mode === "place" && s.ghost && s.ghost.type === "house", "1: a House ghost");
  const gx = s.ghost.x; await page.keyboard.press("ArrowRight"); s = await st();
  ok(s.ghost.x === gx + 1, "ArrowRight moves the ghost a tile");
  await page.keyboard.press("Escape"); s = await st(); ok(s.mode === "none", "Escape cancels the ghost");
  for (const [k, t] of [["Digit2", "field"], ["Digit3", "store"], ["Digit4", "barracks"], ["Digit9", "tower"]]) { await page.keyboard.press(k); s = await st(); ok(s.ghost && s.ghost.type === t, k + ": " + t); await page.keyboard.press("Escape"); }
  await page.keyboard.press("KeyW"); s = await st(); ok(s.mode === "wall", "W: wall mode");
  await page.keyboard.press("Space"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Space");
  ok(await ev(() => Town.test.strokes() === 1 && Town.test.wall().length >= 3), "Space, arrows, Space: a stroke of 3 tiles");
  await page.keyboard.press("Escape"); s = await st(); ok(s.mode === "none", "Escape leaves wall mode");
  await page.keyboard.press("KeyT"); s = await st(); ok(s.sheet === "age", "T opens the age sheet");
  await page.keyboard.press("Escape"); s = await st(); ok(s.sheet === "", "Escape closes the sheet");
  await page.keyboard.press("KeyH"); s = await st(); ok(s.sel && s.sel.kind === "bld", "H selects the palace");
  ok(await ev(() => /Royal Palace/.test(Town.test.root().querySelector("#twInfo").textContent)), "the info panel names it");
  await page.keyboard.press("Escape"); s = await st(); ok(!s.sel, "Escape deselects");
  await page.keyboard.press("KeyG"); ok(await ev(() => Town.test.garOpen()), "G opens the garrison");
  await page.keyboard.press("Escape"); ok(await ev(() => !Town.test.garOpen()), "Escape closes the garrison");
  const z0 = (await st()).zoom; await page.keyboard.press("Equal"); const z1 = (await st()).zoom; await page.keyboard.press("Minus"); const z2 = (await st()).zoom;
  ok(z1 > z0 && z2 === z0, "+ and - zoom: " + [z0, z1, z2]);
  const x0 = (await st()).x; await page.keyboard.press("ArrowRight"); const x1 = (await st()).x; ok(x1 > x0, "ArrowRight pans");
  await page.keyboard.press("KeyF"); ok(await ev(() => Town.test.root().querySelector("#twSpeed").textContent === "2x"), "F: 2x");
  await page.keyboard.press("Shift+KeyF"); ok(await ev(() => Town.test.root().querySelector("#twSpeed").textContent === "4x"), "Shift+F: 4x");
  await page.keyboard.press("KeyF"); await page.keyboard.press("KeyF");
  await page.keyboard.press("KeyP"); s = await st(); ok(s.held.includes("plan"), "P: plan while paused");
  await page.keyboard.press("Space"); s = await st(); ok(!s.held.length, "Space resumes plan mode");
  await page.keyboard.press("Space"); s = await st(); ok(s.card === "pause", "Space: the pause card");
  ok(await ev(() => [...Town.test.root().children].filter(c => c.id !== "twCardWrap" && c.id !== "twTitle").every(c => c.inert)), "under the pause card the room is inert");
  const seen2 = []; for (let i = 0; i < 14; i++) { await page.keyboard.press("Tab"); seen2.push(await act()); }
  ok(await ev(() => Town.test.root().querySelector("#twCard").contains(document.activeElement)) && seen2.every(x => !x.includes("!OUT")), "Tab stays in the pause card: " + seen2.join(","));
  await page.keyboard.press("Escape"); s = await st(); ok(s.card === "", "Escape closes the pause card");
  ok(await ev(() => [...Town.test.root().children].every(c => !c.inert)), "the room is live again");
  await page.keyboard.press("Period"); s = await st();
  await page.keyboard.press("KeyA"); // no raid: nothing
  for (let i = 0; i < 4 && (await st()).card !== "leave"; i++) await page.keyboard.press("Escape");
  s = await st(); ok(s.card === "leave", "Escape, after what is open is closed: the leave card");
  await page.keyboard.press("Escape"); s = await st(); ok(s.card === "", "Escape on the leave card: keep playing");
  // M and S pass to the page's own handler (music and sound)
  const m0 = await ev(() => Snd.musicOn); await page.keyboard.press("KeyM"); const m1 = await ev(() => Snd.musicOn); await page.keyboard.press("KeyM");
  ok(m0 !== m1, "M toggles the music (passed through)");
  const leak = await ev(() => window.__leak.filter(c => !/KeyM|KeyS/.test(c)));
  ok(leak.length === 0, "no other key reached the page: " + leak.join(","));
  // Tab through the HUD: every stop is inside the room
  const seen3 = []; for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); seen3.push(await act()); }
  ok(seen3.every(x => !x.includes("!OUT")), "Tab stays in the room: " + seen3.slice(0, 40).join(","));
  // leave by keys: the focus back on the door
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  s = await st(); if (s.card !== "leave") { await page.keyboard.press("Escape"); s = await st(); }
  await ev(() => Town.test.button("card:leave").focus()); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
  ok(await ev(() => !Town.isOpen() && document.activeElement && document.activeElement.id === "townBtn" && !overlayEl.hasAttribute("inert")), "Leave: closed, focus on the door, the map live");
  await ev(() => { window.__leak = []; });
  await page.keyboard.press("ArrowRight");
  ok((await ev(() => window.__leak.length)) > 0, "with the town closed, keys reach the page again");
  console.log(out.join("\n"));
  console.log(errs.length ? "PAGE ERRORS " + errs.join(" | ") : "no page errors");
  console.log("RESULT " + (fails.length ? "FAIL " + fails.length : "PASS"));
  await b.close();
})();
