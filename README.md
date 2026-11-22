# ⚾ MLB Live PBP — Live MLB Scoreboard & Play-by-Play

[Open the scoreboard](https://snapquast73-boop.github.io/LIVPBP1/) ·
[Replay Feed](https://snapquast73-boop.github.io/LIVPBP1/reviews.html) ·
[Flagged for Review](https://snapquast73-boop.github.io/LIVPBP1/flagged.html)

A zero-dependency static web app that pulls **live MLB data** straight from the
public MLB StatsAPI and renders it Gameday-style. GitHub Pages serves the HTML,
CSS and JavaScript from the root of `main`. No installation, no API key and no
Node server are required.

## What happened to this repository, and how it was fixed

The original upload to this repository was **incomplete**: it contained the HTML
pages, `server.mjs` and documentation, but **none of the `assets/js/*.js` modules
or `assets/css/style.css` that the pages load**. Earlier restoration attempts
wrote a small replacement client (`assets/app.js`) so the site would render at
all, which is why this deployment looked reduced compared with the working copies
of the same project.

The real module set has now been restored from
**[snapquast73-boop/LIVPBP2](https://github.com/snapquast73-boop/LIVPBP2)** — a
working copy of this same codebase. The evidence is structural, not a similarity
judgement: `server.mjs` in this upload is byte-identical (Git blob
`3daa71433da3d50cbba323ee31d0231eb9961c05`) to LIVPBP2's, and the uploaded
`index.html`/`game.html`/`reviews.html` differ from LIVPBP2's only by the
"Flagged for Review" footer link. The stopgap client was removed; its contents
remain in git history. See [Flagged for Review](flagged.html) for the full audit,
including what could and could not be verified, and
[docs/verification-report.md](docs/verification-report.md) for the row-by-row
source log.

What is still **not** provable is byte-identity with the original author's
private implementation — the upstream repository
([`buffedlizard55-lab/MLB-Live-PBP`](https://github.com/buffedlizard55-lab/MLB-Live-PBP))
returns HTTP 404. That limit is recorded, with its source link, on
[Flagged for Review](flagged.html).

## Pages

- **Scoreboard** (`index.html`) — every game for any date: live scores, inning,
  count, outs, records, venue, W/L/S decisions and probable pitchers, as a card
  per game, with a live "under review now" banner.
- **Game view** (`game.html`) — who's at bat and who's pitching, count, outs and
  runners, on-deck/in-the-hole hitters, pitch counts, last play,
  inning-by-inning linescore, full box score, the complete play-by-play, a
  two-sided hit forecast, and a Challenges & Reviews tab with the score tracker.
- **Replay Feed** (`reviews.html`) — a chat-style feed of replay reviews,
  manager/crew-chief/umpire challenges, boundary calls, ABS pitch challenges,
  official-scorer-pending rulings and detected scoring changes across **every
  game on the schedule**, with an Under Review strip, per-type filters
  (All · ABS · Challenges · Reviews · Boundary Calls · Under Review · Runs at
  Risk · Scoring Changes · Flagged), day summary stats, the official challenge
  counters, and an optional run-at-risk alert.
- **[Flagged for Review](flagged.html)** — every irregularity and every value
  that could not be confirmed from an official source, each with the link that
  was checked.

## Data sources

Data comes directly from the official [MLB StatsAPI](https://statsapi.mlb.com):

- [`GET /api/v1/schedule`](https://statsapi.mlb.com/api/v1/schedule?sportId=1)
  with `hydrate=team,linescore,probablePitcher,decisions,review,flags` — the
  slate, records, decisions, probable pitchers and manager-challenge counters;
- `GET /api/v1.1/game/{gamePk}/feed/live` — the live game state, linescore, box
  score, plays and structured review records for that game;
- [`GET /api/v1/gameStatus`](https://statsapi.mlb.com/api/v1/gameStatus) and
  [`GET /api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes) — the
  official review-status and event-type registries used to classify records.

Every displayed data row links to the MLB response it came from. A value MLB does
not report is shown blank rather than as `0`, and blank always means "not
reported", never "zero".

## Verification

```bash
npm ci --ignore-scripts
npm test              # syntax + deterministic suites + link checks (offline)
npm run test:pages    # official-payload page test (needs network; runs in CI)
npm run test:links    # markdown + HTML link checks only
```

`npm test` runs with no network access:

- `node --check` on all eight modules, `server.mjs`, and every file under
  `tools/` and `tests/`;
- the client's own 48-check suite — `tools/page-render-test.mjs` (renders each
  page in jsdom, 0 failures), `tools/review-test.mjs`,
  `tools/reviews-feed-test.mjs`, `tools/feed-fields-test.mjs` and
  `tools/hit-model-test.mjs`;
- `tools/link-check.mjs`, `tools/check-local-links.py` and `tests/check.py`,
  which fail if any local `href`/`src` in any page or Markdown doc points at a
  missing file.

Synthetic fixtures are **not** evidence of real game results. The claims about
actual MLB data are checked in CI against freshly downloaded official responses:

| Check | Workflow | Compares |
| --- | --- | --- |
| Scoreboard | `check.yml` | every game card (teams, records, scores, status, venue) against the [official schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore,review) |
| Official-payload page test | `check.yml` (`npm run test:pages`) | every rendered value of all three pages against the official schedule, `feed/live`, `gameStatus` and `eventTypes` responses fetched in the same run — no hand-typed expected values |
| Game view | `game-acceptance.yml` | header, every linescore cell, every batting/pitching row (each with its source link) and every play description against that game's `feed/live` |
| Replay Feed | `reviews-acceptance.yml` | scan coverage, team abbreviations, summary boxes and every official challenge counter against the [official schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=linescore) and each linked feed |
| API shape | `feed-shape.yml` | the archived 2024-10-30 game's schedule, counters, feed contract and `eventTypes` registry |
| Deployed files | `live-check.yml` | every published page and module is actually served and parses; after each deployment the deployed site is also driven end to end in a real browser against the live API (`tests/live-e2e.mjs`) |

The official-payload page test (`tests/official-e2e.mjs`) does **not** contain a
single hand-typed expected value. Every expectation is read out of the response
it just fetched — scores, records, venue, decisions, every inning, every play
description, every batter and pitcher line, every review record, ABS outcome and
counter, and the replay feed's tab membership. If the site renders something MLB
did not report, the test fails. CI runs it on every pull request, push to `main`
and on a nightly schedule (`.github/workflows/check.yml`), so an upstream
contract change shows up even with no open pull request.

These checks pin the archived sample responses and the deployed files. They do
not certify future live data; see [Flagged for Review](flagged.html).

## How values are handled

- A value MLB did not report is rendered **blank**, never as `0`.
- Challenge counters are quoted from `gameData.review.{away,home}` and
  `gameData.absChallenges.{away,home}` — never derived by counting feed events,
  never zero-filled. A counter is shown on a review row only for the side the
  payload credits with the challenge.
- Review classification uses MLB's own `/gameStatus` registry codes (`M*`, `N*`,
  `MJ`/`NJ`, `IH`) rather than matching the words "challenge" or "review" in
  text.
- "Runs at risk" is a conditional lower bound taken from scoring movements the
  payload attributes to the reviewed event. It is never a prediction of the
  ruling or of runner placement.
- Scoring changes are detected by diffing consecutive polls; the payload carries
  no marker for them, so changes that happened while no page was open cannot be
  reconstructed. MLB's own
  [scoring changes log](https://www.mlb.com/official-information/scoring-changes)
  is the authority.
- A scan that fails or is incomplete labels its totals stale/partial instead of
  presenting old numbers as current.

## Layout

```
index.html · game.html · reviews.html · 404.html · flagged.html   # the site
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
tests/official-e2e.mjs                                           # official-payload page test (network)
tests/live-e2e.mjs                                               # deployed-site browser test (network + Chrome)
tests/verify_schedule.py · verify-game.mjs · verify-reviews.mjs   # row-by-row Chrome acceptance vs official JSON
docs/api-compliance.md · docs/scoring-changes.md · docs/verification-report.md
COORDINATION.md                                                  # shared task board
```

## Local development

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
node server.mjs               # optional: adds cross-browser persistence
```

`server.mjs` is inherited from the original upload and is **not** used by GitHub
Pages. It writes feed logs to a git-ignored `data/` directory. It is
unauthenticated, so run it on localhost only — see the security note on
[Flagged for Review](flagged.html).

## Deploy

Pages is configured to publish `main` from `/ (root)`, which needs no workflow.
Every push to `main` republishes the site. See GitHub's documentation on
[configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Terms

The MLB StatsAPI is unofficial, keyless and may change without notice; the
client degrades gracefully when a field or endpoint disappears. It self-limits:
pages pause while the tab is hidden and honour HTTP 429 with a quiet period.
`docs/api-compliance.md` records the request budget and the governing terms.
Team logos, headshots and all data are © MLB Advanced Media / MLB and their
respective owners. This is an unofficial fan project, not affiliated with or
endorsed by MLB.

## Attribution

Unofficial fan project. Data via the public MLB StatsAPI, the same feeds that
power [MLB.com](https://www.mlb.com) Gameday. Not affiliated with MLB or MLB
Advanced Media. Review descriptions belong to MLB.

## License

[MIT](LICENSE)
