# 2048 AI for PewPlay

This directory contains the original static game adapted for the PewPlay game template. Open `index.html` to play.

`game.json` holds the game page text. `preview.png` and `cover.png` provide the page images. The PewPlay workflow checks pushes to `preview` and `main`.

The page is watch-only: the AI plays every move, and the viewer picks its mode, speed and tile generator, pauses it or starts a new game.

## Update (October 2026)

- Files moved from `2048 AI_files/` to `js/` and `style/`; jQuery is no longer needed and has been removed.
- New responsive layout: board in the middle with the score/statistics panel and the settings panel at its sides in landscape, stacked in portrait; no page scroll; touch-friendly segmented buttons.
- AI loop rewritten: it pauses while the page is hidden, the "Try again" wait shows a countdown and can be skipped, speed changes no longer leave stray timers, Space/P pauses and N starts a new game.
- Statistics (highest tile per game) and settings are now remembered.
- Storage keys are prefixed with `2048-with-ai:` (old unprefixed saves are not imported).
- New preview layout (same subject and colours, icon moved inside the safe area), new cover and screenshots.
