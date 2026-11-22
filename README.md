# ⚾ MLB Live PBP — Live MLB Scoreboard & Play-by-Play

[Open the Scoreboard](https://snapquast73-boop.github.io/LIVPBP1/) ·
[Replay Feed](https://snapquast73-boop.github.io/LIVPBP1/reviews.html) ·
[Flagged for Review](https://snapquast73-boop.github.io/LIVPBP1/flagged.html) ·
[Source Provenance](SOURCE-PROVENANCE.md) ·
[Verification Report](docs/verification-report.md)

A zero-dependency static web app that pulls **live MLB data** directly from the
public [MLB StatsAPI](https://statsapi.mlb.com) and renders it Gameday-style.
GitHub Pages serves the HTML, CSS, and JavaScript from the root of `main`
(`https://snapquast73-boop.github.io/LIVPBP1/`). No installation, no API key,
and no Node server are required.

---

## What Happened in Upload — and How Functional Parity Was Restored

The initial upload commit ([`dad37b4`](https://github.com/snapquast73-boop/LIVPBP1/tree/dad37b4cf86c008e68320bc027d3a51001f4d710))
included only the root HTML entry points (`index.html`, `game.html`, `reviews.html`,
`404.html`), `server.mjs`, `README.md`, `LICENSE`, and `.gitignore` — **none of
the eight `assets/js/*.js` modules, `assets/css/style.css`, `docs/`, or `tools/`
referenced by those pages were uploaded**. Earlier sessions built a small stopgap
client (`assets/app.js`) so the site would render at all, which is why the page
previously lacked features compared with the working reference sites.

All eight original client modules and stylesheet have been restored from the
upload-identical sibling copy
**[snapquast73-boop/LIVPBP2](https://github.com/snapquast73-boop/LIVPBP2)**
(where all 8 uploaded root files share identical Git blob SHA-1 hashes with
[`dad37b4`](https://github.com/snapquast73-boop/LIVPBP1/tree/dad37b4cf86c008e68320bc027d3a51001f4d710)),
preserving concurrent reliability fixes (explicit stale/incomplete scan warnings)
and adding direct per-row official source links. See
[Source Provenance](SOURCE-PROVENANCE.md),
[Verification Report](docs/verification-report.md), and
[Flagged for Review](flagged.html) for the full line-by-line audit.

---

## Pages & Features

- **Scoreboard (`index.html`)** — Every MLB game for any date (`←` / date picker / `→` / `Today`), filterable by **All**, **Live**, **Final**, **Scheduled**, and **🚨 In Review**, with team logos, W–L records, scores, inning & outs, venue, W/L/SV decisions, probable pitchers, scoring-change badges, and an active Under-Review banner.
- **Game View (`game.html?gamePk=<id>`)** — Current batter vs. pitcher matchup, balls/strikes/outs indicator dots, live bases diamond, on-deck/in-the-hole batters, inning-by-inning linescore (`R / H / E / LOB`), newest-first **Play-by-Play** with review chips, full **Batting & Pitching Box Scores**, a transparent two-sided **Hit Forecast** (`assets/js/props.js`), and a **Challenges & Reviews** tab with Before / Possible-after / Actual-after score trackers and official counters. Every linescore row, box-score row, and review card links directly to its official `feed/live` response.
- **Replay Feed (`reviews.html`)** — League-wide chat-style feed across **All** (non-ABS), **ABS**, **Challenges**, **Reviews**, **Boundary Calls**, **Under Review**, **Runs at Risk**, **✏️ Scoring Changes**, and **Flagged**, with an active Under-Review strip, summary stat bar, official manager & ABS challenge counters (never derived or zero-filled), Official Scorer Ruling Pending detection (`os_ruling_pending_primary` / `os_ruling_pending_prior`), consecutive-poll scoring-change diffing, optional sound chime & desktop notifications, 7-day `localStorage` persistence, and direct links to each game and its official `feed/live` payload.
- **Flagged for Review (`flagged.html`)** — Public audit log of every unverified item and upstream data irregularity, with blank cells where values cannot be confirmed from an official source and direct links to official endpoints.

---

## Architecture & Reference Docs

| Module / Doc | Role | Official Source / Reference |
| --- | --- | --- |
| `assets/js/api.js` | Browser client for `statsapi.mlb.com` (`/api/v1/schedule`, `/api/v1.1/game/{gamePk}/feed/live`, `/api/v1/gameStatus`, `/api/v1/people/{id}/stats`) with 12 s timeout and cache-busting | [MLB Schedule API (`2024-10-30`)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `assets/js/reviews.js` | Structured `reviewDetails` & `playEvents[].reviewDetails` parser, `/api/v1/gameStatus` code lookup (`IH`, `M*`, `N*`, `MJ`, `NJ`), event-bound `runsAtRisk`, official counter formatter, and consecutive-poll scoring-change / irregularity detector | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) · [MLB `eventTypes` Registry](https://statsapi.mlb.com/api/v1/eventTypes) |
| `assets/js/props.js` | Transparent log5 per-PA and remaining-game hit model anchored to `.245` league AVG using season, platoon (`vl`/`vr`), 14-day `gameLog`, and count adjustments | [MLB People Stats API (`660271`)](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,gameLog&group=hitting&sitCodes=vl,vr&season=2026) |
| `assets/js/scoreboard.js`, `game.js`, `reviews-feed.js`, `feed-log.js`, `ui.js` | Scoreboard, Game view, Replay Feed (`10 s` / `3 s` / `3–4 s` live polling; paused when hidden), 7-day `localStorage` log, and HTML-escaped UI helpers | [MLB Game Live Feed (`775296`)](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live) |
| [`SOURCE-PROVENANCE.md`](SOURCE-PROVENANCE.md) & [`docs/verification-report.md`](docs/verification-report.md) | Blob-level upload provenance (`LIVPBP1` vs `LIVPBP2` vs `POSTSSNALRT`) and line-by-line live StatsAPI field verification | [GitHub Tree API (`dad37b4`)](https://api.github.com/repos/snapquast73-boop/LIVPBP1/git/trees/dad37b4cf86c008e68320bc027d3a51001f4d710?recursive=1) |
| [`docs/api-compliance.md`](docs/api-compliance.md) & [`docs/scoring-changes.md`](docs/scoring-changes.md) | Request-rate budget, MLBAM copyright/Terms disclosures, Official Scorer Ruling Pending codes, and scoring-change diffing rules | [MLB Official Scoring Changes](https://www.mlb.com/official-information/scoring-changes) · [MLB.com Terms of Use](https://www.mlb.com/official-information/terms-of-use) |
| [`docs/workflows/pages.yml`](docs/workflows/pages.yml) & [`docs/workflows/smoke.yml`](docs/workflows/smoke.yml) | Reference GitHub Actions Pages & smoke workflow templates (site currently deploys directly from `main` `/`) | [GitHub Pages Config API (`LIVPBP1`)](https://api.github.com/repos/snapquast73-boop/LIVPBP1/pages) |

---

## Verification

```bash
npm ci --ignore-scripts && npm test
```

`npm test` runs offline with zero network dependencies:

- `node --check` syntax validation on all eight `assets/js/*.js` modules, `server.mjs`, and `tools/verify-table-sources.mjs`;
- `tools/page-render-test.mjs` (7 jsdom page renders, 0 failures), `tools/review-test.mjs` (14 checks), `tools/reviews-feed-test.mjs` (6 checks), `tools/feed-fields-test.mjs` (9 checks), and `tools/hit-model-test.mjs` (12 checks);
- `tools/check-local-links.py`, `tests/check.py`, and `tools/verify-table-sources.mjs`, which verify zero broken local links across all HTML and Markdown files and verify that every HTML/Markdown table row and rendered Replay Feed row carries a direct official source link.

Real-browser and live-API checks run in GitHub Actions against freshly downloaded official MLB responses and the deployed GitHub Pages site:

| Check | Workflow | Compares | Official Source |
| --- | --- | --- | --- |
| Scoreboard | `.github/workflows/check.yml` | Every game card (teams, W–L records, scores, status pill, venue) in headless Chrome against the official schedule | [MLB Schedule (`2024-10-30`)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore,review) |
| Game view | `.github/workflows/game-acceptance.yml` | Header, every linescore cell, every batting/pitching row, per-row source links, and every play description against `feed/live` | [MLB Live Feed (`775296`)](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live) |
| Replay Feed | `.github/workflows/reviews-acceptance.yml` | Scan coverage, official team abbreviations, summary boxes, official challenge counters, and per-row game + feed links | [MLB Schedule (`2024-10-30`)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore,review) · [MLB Live Feed (`775296`)](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live) |
| API shape | `.github/workflows/feed-shape.yml` | Schedule, counters, live feed contract, and `os_ruling_pending_*` codes in `/api/v1/eventTypes` | [MLB `eventTypes` Registry](https://statsapi.mlb.com/api/v1/eventTypes) |
| Deployed files | `.github/workflows/live-check.yml` | Every published HTML page, CSS stylesheet, and JS module returns HTTP 200 and parses cleanly | [GitHub Pages Site (`LIVPBP1`)](https://snapquast73-boop.github.io/LIVPBP1/) · [GitHub Pages API](https://api.github.com/repos/snapquast73-boop/LIVPBP1/pages) |

---

## Local Development

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
```

`server.mjs` is preserved from the original upload and is **never executed on GitHub Pages**. It exposes an unauthenticated local `POST /api/feed-log` endpoint writing to git-ignored `data/`; run it on `localhost` only (see [Flagged for Review](flagged.html)).

## Attribution

Unofficial fan project. Data via the public [MLB StatsAPI](https://statsapi.mlb.com), the same feeds that power [MLB.com](https://www.mlb.com) Gameday. Not affiliated with MLB or MLB Advanced Media.
