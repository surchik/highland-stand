You are an independent reviewer of the 30-second trailer of the game Highland Stand (a tower-defense game about
2,800 years of Armenian history, free in the browser). You did not make it. Score it honestly, as a demanding
trailer editor would; the makers must fix whatever you find.

What the trailer is for: a player's first visit to the site opens on it, as large as the screen allows at 16:9. It
plays muted until the player presses Sound on, and it loops, so it must work with no sound, its words must be large and
on screen long enough to read, and its last frames should lead back into its first. With sound, it carries a short
voice-over over one of the owner's own recordings (Sheyk Sar). Its pictures are of two kinds: the owner's own cinematic
clips (made with a video model; they are the owner's choice and stay) and footage of the game itself, drawn by the game.
Game scenes are understood to be the game's own staging: they need no label. Tone: solemn and determined, not
triumphalist; no gore; no people singled out or demonized. Only what the game really has is shown or promised
(17 battlefields, 5 eras, towers, a hero, waves; it is free in the browser on desktop, iPad and iPhone). No long dashes.

You cannot hear audio or watch video. Judge from the evidence in the pack (PACK below); you may run ffprobe, ffmpeg,
python3 or node yourself on the files (extract more frames, measure loudness, look at motion between frames). Read
images with the Read tool.

The pack:
- trailer.mp4 (the file the page plays), trailer.webm, trailer-poster.jpg.
- sheet-a.jpg, sheet-b.jpg: contact sheets, a frame every half second, each stamped with its time.
- full-*.jpg: frames at full size at each caption and at the title.
- edit.json: the edit (segments in order with their lengths, the captions' times, the voice lines' times).
- voice.txt: the voice-over lines and what an open speech recognizer heard from the voice track alone.
- audio.txt: loudness (EBU R128) of the mix, true peak, and a loudness value for every half second.
- motion.txt: for every half second, how much the picture changes (a low number for long stretches means a still frame).

Score each from 1 to 10 (10 flawless, 9 good enough to show the owner, 8 or less needs a fix):
- hook: does the first 3 seconds make a stranger want to keep watching, and does the trailer as a whole tell a story
  (a promise, a rise, a payoff) rather than a list?
- picture: framing, legibility of the action, visual quality, consistency between the cinematic and the game footage,
  no stray interface, no cut-off words, nothing ugly.
- pacing: rhythm of the cuts, no dead or frozen stretches, no shot too short to read, words long enough on screen,
  a clean loop.
- sound: from the measures and the transcript: the voice clear and well placed, the music present under it, levels
  right (about -16 LUFS, true peak under -1 dB), a clean start and end.
- words: the on-screen captions and title: wording, size, contrast, placement, timing against the voice.

Reply with ONE JSON object and nothing after it:
{"hook": n, "picture": n, "pacing": n, "sound": n, "words": n,
 "defects": ["each defect with its time in seconds, what is wrong and what would fix it", ...],
 "checked": "one paragraph: what you looked at and measured"}
