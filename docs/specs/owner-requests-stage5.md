# Stage 5 requested by the owner (Nov 16): chronicle explainer videos

After stage 4 is merged, tested and deployed.

- For each of the first four battlefields of the campaign, the chronicle's text before the battle is replaced
  by an explainer video of that battlefield's history. One video per battlefield.
- It plays by itself when the chronicle opens (autoplay; browsers allow sound only after a tap, which the
  player has already made to open the battlefield; fall back to muted with subtitles, and a Skip button).
- Voice-over: an open text-to-speech voice installed in the build sandbox (the owner's ruling, Nov 16: "feel
  free to do 3 and pick a good voice for this game"; his local voicestudio is not reachable). Audition
  several voices (Piper and Kokoro both install and their models download here) on one battlefield's script;
  pick a calm, warm documentary narrator that says the Armenian names right (spell them phonetically for the
  engine where needed; the subtitles keep the true spelling); check the voice's license allows this use.
  The narration's text is shown as subtitles at the bottom.
- Two cuts each: landscape, about 60 seconds; vertical, about 30 seconds (phones held upright).
- History only from docs/history/*.json and the battlefield's own texts; neutral toward every people.
- Quality: independent reviewers score each cut (history, pacing, picture, sound, subtitles); loop until
  every score is 9 of 10 or more, then show the owner.
- The text chronicle stays as the fallback (video fails to load, reduced data, the player skips).
- File size and the first-visit trailer's lessons apply (deploy/update.sh publishes the media files).
