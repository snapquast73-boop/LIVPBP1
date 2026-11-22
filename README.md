# ⚾ MLB Live PBP — scoreboard, game view and replay feed

[Open the site](https://snapquast73-boop.github.io/LIVPBP1/) ·
[Flagged for Review](https://snapquast73-boop.github.io/LIVPBP1/flagged.html)

A static, zero-build web app that reads live MLB data straight from the public MLB StatsAPI and renders
it in a Gameday-style scoreboard, a per-game view, and an all-games replay-review feed. GitHub Pages serves
the repository root; nothing is compiled, no API key is needed, and `server.mjs` is optional and is never
run on Pages.

- **Scoreboard** (`index.html`) — every game for any date: scores, inning, count, outs, probable pitchers,
  W/L/S decisions, and a live "under review now" banner.
- **Game view** (`game.html?gamePk=<id>`) — header with score and decisions, live at-bat module, inning
  linescore, full play-by-play, box score, the two-sided hit forecast, and a **Challenges & Reviews** tab.
- **Replay Feed** (`reviews.html?date=YYYY-MM-DD`) — a chat-style feed of every review record on the
  slate: manager challenges, crew-chief and umpire reviews, boundary calls, ABS pitch challenges,
  official-scorer-pending rulings, under-review items, runs at risk, and detected scoring changes.
- **[Flagged for Review](flagged.html)** — every irregularity and every value that could not be confirmed
  from an official source, each with the link that was checked.

## What this repository is

This project was uploaded to GitHub **without its client**. The uploaded pages load eight scripts and a
stylesheet under `assets/`, and none of those files were in the upload, so Pages served an inert page. The
original author's repository is gone (`buffedlizard55-lab/MLB-Live-PBP` returns 404), so it could not be
copied back.

The client here is **not** a fresh re-implementation. `server.mjs` in this upload is byte-identical to the
one in this owner's rebuild of the same project,
[`snapquast73-boop/LIVPBP2`](https://github.com/snapquast73-boop/LIVPBP2), and the three uploaded pages
differ from that rebuild's only by an added "Flagged for Review" footer link. The client files are taken
from that rebuild, so this site runs the same code as the working site rather than an approximation of it.
The page markup is the uploaded markup, restored byte-for-byte, so the site's structure is exactly what
was uploaded.

What is still **not** provable is byte-identity with the original author's private implementation. That is
recorded, with its source link, on [Flagged for Review](flagged.html).

## Verification

```bash
npm ci --ignore-scripts
npm test          # deterministic suites + official-payload page test
npm run test:links
```

`npm test` runs two groups:

| Group | Command | What it proves |
| --- | --- | --- |
| Deterministic suites | `npm run test:unit` | Pure-function behaviour (review classification, counters, scoring-change diffs, feed-log round-trips, hit model) and a jsdom render of all three pages against small fixtures. No network. |
| Official page test | `npm run test:pages` | Fetches the official MLB endpoints below, loads each published page from disk with that page's real `<script src>` files, routes `fetch` to the official bodies, and compares every rendered value with what MLB reported. |

The page test (`tests/official-e2e.mjs`) does **not** contain a single hand-typed expected value. Every
expectation is read out of the response it just fetched — scores, records, venue, decisions, every inning,
every play description, every batter and pitcher line, every review record, ABS outcome and counter, and
the replay feed's tab membership. If the site renders something MLB did not report, the test fails.

Official endpoints used, all public and keyless:

- <https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore,decisions,review>
- <https://statsapi.mlb.com/api/v1.1/game/775296/feed/live>
- <https://statsapi.mlb.com/api/v1/gameStatus>
- <https://statsapi.mlb.com/api/v1/eventTypes>

CI runs the same test on every pull request (`.github/workflows/check.yml`) and again against the deployed
site after each Pages deployment (`.github/workflows/live-check.yml`). A scheduled run catches an upstream
contract change even when nobody has opened a pull request.

## How values are handled

- A value MLB did not report is rendered **blank**, never as `0`.
- Challenge counters are quoted from `gameData.review.{away,home}` and
  `gameData.absChallenges.{away,home}` — never derived by counting feed events, never zero-filled.
  A counter is shown on a review row only for the side the payload credits with the challenge.
- Review classification uses MLB's own `/gameStatus` registry codes (`M*`, `N*`, `MJ`/`NJ`, `IH`) rather
  than matching the words "challenge" or "review" in text.
- "Runs at risk" is a conditional lower bound taken from scoring movements the payload attributes to the
  reviewed event. It is never a prediction of the ruling or of runner placement.
- Scoring changes are detected by diffing consecutive polls; the payload carries no marker for them, so
  changes that happened while no page was open cannot be reconstructed. MLB's own
  [scoring changes log](https://www.mlb.com/official-information/scoring-changes) is the authority.

## Layout

```
index.html · game.html · reviews.html · 404.html · flagged.html   # the site (uploaded markup)
assets/css/style.css                                             # theme
assets/js/api.js                                                 # MLB StatsAPI client (timeouts, 429 backoff)
assets/js/ui.js                                                  # escaping, dates, logos, count, base diamond
assets/js/reviews.js                                             # review/pending-ruling parser, counters, diffs
assets/js/reviews-feed.js                                        # the all-games Replay Feed page
assets/js/scoreboard.js                                          # the scoreboard page
assets/js/game.js                                                # the game page
assets/js/props.js                                               # two-sided hit forecast
assets/js/feed-log.js                                            # browser-local feed log
server.mjs                                                       # OPTIONAL local persistence server (not on Pages)
tools/                                                           # deterministic, network-free test suites + fixtures
tests/official-e2e.mjs                                           # official-payload page test
tests/check.py                                                   # local href/src check
docs/api-compliance.md · docs/scoring-changes.md · docs/verification-report.md
COORDINATION.md                                                  # shared task board
```

Run it locally with any static server:

```bash
python3 -m http.server 8000      # then open http://localhost:8000/
node server.mjs                  # optional: adds cross-browser persistence
```

## Deploy

Pages is configured to publish `main` from `/ (root)`, which needs no workflow. Every push to `main`
republishes the site. See GitHub's documentation on
[configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Terms

The MLB StatsAPI is unofficial, keyless and may change without notice; the client degrades gracefully when
a field or endpoint disappears. It self-limits: pages pause while the tab is hidden and honour HTTP 429
with a quiet period. `docs/api-compliance.md` records the request budget and the governing terms. Team
logos, headshots and all data are © MLB Advanced Media / MLB and their respective owners. This is an
unofficial fan project, not affiliated with or endorsed by MLB.

## License

[MIT](LICENSE)
