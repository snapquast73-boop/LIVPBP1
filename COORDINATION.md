# COORDINATION.md — Shared Task Board

Repository: `snapquast73-boop/LIVPBP1`
Live GitHub Pages URL: `https://snapquast73-boop.github.io/LIVPBP1/`

## Tasks

| Task | Status | Session ID | Branch | Files | Notes |
| --- | --- | --- | --- | --- | --- |
| T1: Audit repo & restore missing `assets/css/style.css` | in progress | `arena-e4bf03da` | `arena/e4bf03da-livpbp1` | `assets/css/style.css` | Stylesheet for `index.html`, `game.html`, `reviews.html`, `404.html`, `flagged.html` |
| T2: Restore `assets/js/api.js` & `assets/js/ui.js` | in progress | `arena-e4bf03da` | `arena/e4bf03da-livpbp1` | `assets/js/api.js`, `assets/js/ui.js` | MLB StatsAPI (`statsapi.mlb.com`) client and shared UI helpers |
| T3: Restore `assets/js/reviews.js` & `assets/js/feed-log.js` | in progress | `arena-e4bf03da` | `arena/e4bf03da-livpbp1` | `assets/js/reviews.js`, `assets/js/feed-log.js` | Replay review detection, ABS/manager challenge counters, localStorage feed log |
| T4: Restore `assets/js/scoreboard.js`, `assets/js/props.js`, `assets/js/game.js`, `assets/js/reviews-feed.js` | in progress | `arena-e4bf03da` | `arena/e4bf03da-livpbp1` | `assets/js/scoreboard.js`, `assets/js/props.js`, `assets/js/game.js`, `assets/js/reviews-feed.js` | Page controllers for scoreboard, game view, and replay feed |
| T5: Add `flagged.html` & verify build, links, and GitHub Pages deploy | unclaimed | `arena-e4bf03da` | `arena/e4bf03da-livpbp1` | `flagged.html`, `COORDINATION.md` | Flagged for Review page + PR & merge to `main` |

## Log
- `2026-11-20`: Session `arena-e4bf03da` initialized `COORDINATION.md` on branch `arena/e4bf03da-livpbp1`. Found that `assets/` directory (`assets/css/style.css` and `assets/js/*.js`) is missing from the uploaded repo, causing all pages (`index.html`, `game.html`, `reviews.html`, `404.html`) to load unstyled and without JS functionality.
