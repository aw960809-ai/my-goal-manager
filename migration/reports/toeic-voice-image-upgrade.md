# TOEIC GitHub listening / image upgrade

- Added prebuilt Part 1 image bank under `apps/toeic/assets/part1/`.
- Added `apps/toeic/data/part1-bank.json` so Part 1 no longer relies on inline placeholder scenes.
- Added `apps/toeic/audio/manifest.json` and playback pipeline:
  1. Recorded clip if present in manifest.
  2. Browser SpeechSynthesis fallback using saved accent/rate.
- Added `apps/toeic/voice-image-upgrade.js` to override Part 1 question generation and question playback without rewriting the whole TOEIC app.
- Added TOEIC settings card for accent/rate testing and persistence.
- Current state: richer static image bank + TTS fallback ready.
- Future extension: drop MP3 / OGG files into `apps/toeic/audio/` and register them in manifest for true prebuilt listening packs.
