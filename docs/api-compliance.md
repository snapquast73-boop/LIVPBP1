# API Compliance and Request Budget

## 1. Governing Notices Verified Against Official Sources (2026-11-22)

Every MLB StatsAPI JSON payload carries the following copyright header (verified live on `2026-11-22` at [`GET https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=linescore`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=linescore)):

> `"Copyright 2026 MLB Advanced Media, L.P.  Use of any content on this page acknowledges agreement to the terms posted here http://gdx.mlb.com/components/copyright.txt"`

The linked MLBAM copyright notice ([`http://gdx.mlb.com/components/copyright.txt`](http://gdx.mlb.com/components/copyright.txt), verified live `2026-11-22`) states verbatim:

> `"The accounts, descriptions, data and presentation in the referring page (the \"Materials\") are proprietary content of MLB Advanced Media, L.P (\"MLBAM\"). Only individual, non-commercial, non-bulk use of the Materials is permitted and any other use of the Materials is prohibited without prior written authorization from MLBAM."`

MLB.com's Terms of Use §1 ([`https://www.mlb.com/official-information/terms-of-use`](https://www.mlb.com/official-information/terms-of-use), verified live `2026-11-22`) further states:

> `"Except for downloading one copy of the MLB Digital Properties on any single device for your personal, non-commercial home use, you must not reproduce, prepare derivative works based upon, distribute, perform or display the MLB Digital Properties without first obtaining the written permission of MLB or otherwise as expressly set forth in the terms and conditions of the MLB Digital Properties."`

**Flagged for review:** Whether public GitHub Pages hosting falls within individual non-commercial use without separate written authorization is **UNVERIFIED** and cannot be resolved by software; this open legal question is published on [`flagged.html`](../flagged.html) with links to both official documents.

---

## 2. Enforced Request Budget

| Surface | Polling Cadence | Requests per Poll | Official Endpoint |
| --- | --- | --- | --- |
| `index.html` scoreboard (hydrated) | Every **20 s** while any game is `Live`; **60 s** otherwise (`LIVE_POLL_MS` / `IDLE_POLL_MS` in `assets/js/scoreboard.js`) | 1 | [MLB Schedule Hydrated](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `index.html` status sweep | Every **5 s** while any game is `Live` (`STATUS_SWEEP_MS` in `assets/js/scoreboard.js`) | 1 (projected) | [MLB Schedule Status Projection](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&fields=dates,games,gamePk,status,statusCode,detailedState,abstractGameState,reason) |
| `game.html` game view | Every **3 s** while `Live`; **30 s** for `Preview` / `Final` (`LIVE_POLL_MS` / `FINAL_POLL_MS` in `assets/js/game.js`) | 1 | [MLB Live Game Feed](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live) |
| `reviews.html` Replay Feed | Every **20 s** while any game is `Live`; **60 s** otherwise (`LIVE_POLL_MS` / `IDLE_POLL_MS` in `assets/js/reviews-feed.js`) | 1 schedule + *N* active/completed `fields`-projected feeds | [MLB Projected Review Feed](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live?fields=gamePk,gameData,review,absChallenges,away,home,used,remaining,usedSuccessful,usedFailed,liveData,plays,allPlays,about,atBatIndex,reviewDetails,reviewType,challengeTeamId,isOverturned,inProgress,playEvents,index) |
| `gameStatus` registry lookup | Once per page load (`MLBAPI.getGameStatusRegistry()`), cached in memory | 1 | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| Hit-forecast player inputs | On-demand when active matchup or `Props & Matchup` tab is visible; cached 10 minutes in memory | Up to 3 per active batter/pitcher pair | [MLB People Stats](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,gameLog&group=hitting&sitCodes=vl,vr&season=2026) |

---

## 3. Built-in Rate-Limit & Polite-Client Guards

- **Hidden tab = zero requests:** Every page listens to `document.visibilitychange` and pauses timers whenever `document.hidden` is `true`.
- **HTTP 429 backoff:** `assets/js/api.js` honours `Retry-After` (clamped between `1 s` and `5 min`, defaulting to `60 s`) and suppresses outbound requests during the quiet window.
- **Bounded retries & timeouts:** Requests abort at `15 s` and perform at most one `350 ms` retry outside quiet periods.
- **No scraping, no API keys, no server proxy:** Browser requests go directly to `https://statsapi.mlb.com`; the optional local `server.mjs` only persists the client's own per-date review log and never contacts MLB servers.
