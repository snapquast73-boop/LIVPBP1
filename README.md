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
working copy of this same codebase, whose `index.html` and `game.html` are
byte-identical to this repository's original upload apart from the
"Flagged for Review" footer link. The stopgap client was removed; its contents
remain in git history. See [Flagged for Review](flagged.html) for the full audit,
including what could and could not be verified.

## Pages

- **Scoreboard** (`index.html`) — every game for any date: live scores, inning,
  records, venue, W/L/S decisions and probable pitchers, as a card per game.
- **Game view** (`game.html`) — who's at bat and who's pitching, count, outs and
  runners, pitch counts, last play, inning-by-inning linescore, full box score,
  the complete play-by-play, a two-sided hit forecast, and a Challenges &
  Reviews tab.
- **Replay Feed** (`reviews.html`) — a chat-style feed of replay reviews,
  manager/crew-chief/umpire challenges and ABS pitch challenges across **every
  game on the schedule**, with an Under Review strip, per-type filters, day
  summary, the official challenge counters, and an optional run-at-risk alert.

## Data sources

Data comes directly from the official [MLB StatsAPI](https://statsapi.mlb.com):

- [`GET /api/v1/schedule`](https://statsapi.mlb.com/api/v1/schedule?sportId=1)
  with `hydrate=team,linescore,probablePitcher,decisions,review,flags` — the
  slate, records, decisions, probable pitchers and manager-challenge counters;
- `GET /api/v1.1/game/{gamePk}/feed/live` — the live game state, linescore, box
  score, plays and structured review records for that game.

Every displayed data row links to the MLB response it came from. A value MLB does
not report is shown blank rather than as `0`, and blank always means "not
reported", never "zero".

## Verification

```bash
npm ci --ignore-scripts && npm test
```

`npm test` runs, with no network access:

- `node --check` on all eight modules and `server.mjs`;
- the client's own 48-check suite — `tools/page-render-test.mjs` (renders each
  page in jsdom, 0 failures), `tools/review-test.mjs`,
  `tools/reviews-feed-test.mjs`, `tools/feed-fields-test.mjs` and
  `tools/hit-model-test.mjs`;
- `tools/check-local-links.py` and `tests/check.py`, which fail if any local
  `href`/`src` in any page points at a missing file.

Synthetic fixtures are **not** evidence of real game results. The claims about
actual MLB data are checked in CI against freshly downloaded official responses:

| Check | Workflow | Compares |
| --- | --- | --- |
| Scoreboard | `check.yml` | every game card (teams, records, scores, status, venue) against the [official schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore) |
| Game view | `game-acceptance.yml` | header, every linescore cell, every batting/pitching row and every play description against that game's `feed/live` |
| Replay Feed | `reviews-acceptance.yml` | scan coverage, team abbreviations, summary boxes and every official challenge counter against the [official schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=linescore) and each linked feed |
| API shape | `feed-shape.yml` | the archived 2024-10-30 game's schedule, counters, feed contract and `eventTypes` registry |
| Deployed files | `live-check.yml` | every published page and module is actually served and parses |

These checks pin the archived sample responses and the deployed files. They do
not certify future live data; see [Flagged for Review](flagged.html).

## Local development

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
```

`server.mjs` is inherited from the original upload and is **not** used by GitHub
Pages. It writes feed logs to a git-ignored `data/` directory. It is
unauthenticated, so run it on localhost only — see the security note on
[Flagged for Review](flagged.html).

## Attribution

Unofficial fan project. Data via the public MLB StatsAPI, the same feeds that
power [MLB.com](https://www.mlb.com) Gameday. Not affiliated with MLB or MLB
Advanced Media. Review descriptions belong to MLB.
