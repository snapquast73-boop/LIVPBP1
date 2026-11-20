# MLB Live PBP

[Open the scoreboard](https://snapquast73-boop.github.io/LIVPBP1/) · [Flagged for Review](https://snapquast73-boop.github.io/LIVPBP1/flagged.html)

GitHub Pages serves the static HTML, CSS and JavaScript from the root of `main`. No installation, API key or Node server is required. For local use run `python3 -m http.server 8000` and open the scoreboard. Select a date, then a game, or use Replay Feed to scan the selected date’s MLB review records. Filter by replay review, ABS challenge, scorer-pending event, or explicitly active review. Open “MLB challenge counters” on the Replay Feed, or use the game’s Challenges & Reviews tab, to see the counters MLB reports.

Data comes directly from the [MLB schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1) and each game's linked MLB live feed. The optional inherited Node server is not run on Pages. The [original upload and documentation](https://github.com/snapquast73-boop/LIVPBP1/tree/dad37b4cf86c008e68320bc027d3a51001f4d710) describe additional features whose implementation was missing.

## Verification and reliability

Run `npm ci --ignore-scripts && npm test` for DOM regression tests and local HTML link checks. Development dependencies are used only for tests; the deployed site still needs no installation. Synthetic test data is explicitly not evidence of real game results. CI also runs `OFFICIAL_MLB_CHECK=1 node --test tests/app.test.cjs` against the official historical MLB schedule and game feed, comparing every rendered play description with that response and checking row source links. This checks that response at test time, not every future live result.

The active client is `assets/app.js`; alternate files in `assets/js/` are not loaded by the HTML. Requests time out after 15 seconds. Manual/date refreshes cancel superseded requests and reset the 30-second polling timer. Changing dates clears old rows immediately, so a failed request cannot mislabel yesterday's data as today's. Missing reported values remain blank; see Flagged for Review for unverified functionality.

The source-backed replay checks use [MLB’s Tigers–Rays game feed](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live) and the [official ABS highlight](https://www.mlb.com/rays/video/garrett-cleavinger-ball-to-jahmai-jones-capture-review). Partial scans leave totals unverified; unavailable alerts, scoring history, and other parity gaps are listed on [Flagged for Review](flagged.html).
