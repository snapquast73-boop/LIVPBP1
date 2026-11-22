# Official Scoring Changes — Detection, Scope, and Verification Limits

## 1. Official Definition & Source

An **official scoring change** reclassifies a completed play (for example, changing a hit to a fielding error or vice versa, changing a fielder's choice to a single, changing an earned run to unearned, or changing defensive indifference to a stolen base).

MLB publishes official post-game scoring changes on [`https://www.mlb.com/official-information/scoring-changes`](https://www.mlb.com/official-information/scoring-changes) (verified live `2026-11-22`), stating verbatim:

> `"The below details all Official Scoring changes that have occurred following the conclusion of the listed games. Changes can be made by the Official Scorer, Elias Sports Bureau, or following a review initiated by a player or club."`

That page is a human-readable log rather than a JSON endpoint, and the MLB StatsAPI `feed/live` payload carries **no dedicated scoring-change flag** (verified against [`https://statsapi.mlb.com/api/v1.1/game/822974/feed/live`](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live) and [`https://statsapi.mlb.com/api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes)). Separately, undecided in-game rulings carry explicit official event codes `os_ruling_pending_primary` and `os_ruling_pending_prior` (`"Official Scorer Ruling Pending"` in [`GET /api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes)).

---

## 2. Consecutive-Poll Snapshot Diffing (`assets/js/reviews.js`)

Because the StatsAPI exposes no historical diff marker inside a single snapshot, `Reviews.snapshotPlays` records the official classification fields of each completed play on each poll and `Reviews.diffSnapshots` compares consecutive polls:

| Compared Field / Condition | What Is Detected | Official Source |
| --- | --- | --- |
| `result.eventType`, `result.isOut`, `count.outs`, `runners[].details.movementReason` | Official play reclassification (`scoring_change` row showing observed initial call, observed final ruling, and official `awayScore`/`homeScore` after the play) | [MLB Live Feed Schema (`822974`)](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live?fields=liveData,plays,allPlays,about,atBatIndex,result,event,eventType,isOut,awayScore,homeScore,count,outs,runners,details,movementReason) · [MLB Scoring Changes Log](https://www.mlb.com/official-information/scoring-changes) |
| `result.eventType` or `playEvents[].details.eventType` in `{"os_ruling_pending_primary", "os_ruling_pending_prior"}` | Active `"Official Scorer Ruling Pending"` notice (never removes a run from the score) | [MLB `eventTypes` Registry](https://statsapi.mlb.com/api/v1/eventTypes) |
| Payload description / RBI / score edit with **no** classification change | Flagged as an **irregularity** (`"payload edit without reclassification"`), never silently rewritten or inferred | [MLB Live Feed (`824027`)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live) |
| Previously observed `atBatIndex` absent on a later poll | Flagged as an **irregularity** (`"play disappeared from payload"`), never hidden | [MLB Live Feed (`824027`)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live) |

---

## 3. UI Surfaces & Persistence

| Surface | Rendered Output | Official Source |
| --- | --- | --- |
| `reviews.html` → **✏️ Scoring Changes** & **All** tabs | Observed `Initial call` → `Final ruling`, official `Score after play`, attribution note, and link to game/feed | [Published Replay Feed (`LIVPBP1`)](https://snapquast73-boop.github.io/LIVPBP1/reviews.html) · [MLB Scoring Changes Log](https://www.mlb.com/official-information/scoring-changes) |
| `reviews.html` → **Flagged** tab | Payload edits without reclassification, vanished plays, or backwards-moving challenge counters | [Published Replay Feed (`LIVPBP1`)](https://snapquast73-boop.github.io/LIVPBP1/reviews.html) · [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `game.html` → **Challenges & Reviews** tab | Structured reviews, Official Scorer Ruling Pending entries, and tab badge count | [Published Game View (`LIVPBP1`)](https://snapquast73-boop.github.io/LIVPBP1/game.html?gamePk=775296) · [MLB Feed (`775296`)](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live) |
| `index.html` → Scoreboard cards | `✏️ N scoring change(s)` badge read from persisted per-date `FeedLog` | [Published Scoreboard (`LIVPBP1`)](https://snapquast73-boop.github.io/LIVPBP1/) · [MLB Schedule (`2024-10-30`)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=linescore) |

### Explicit Verification Limits

1. **Observation window required:** A scoring change can only be detected if the browser observed the play's earlier classification before MLB updated the payload. Opening a Final game after a ruling has already been applied shows the final official play state, not a synthetic historical diff.
2. **Static Pages persistence:** On GitHub Pages (`https://snapquast73-boop.github.io/LIVPBP1/`), `assets/js/feed-log.js` persists up to 7 dates / 500 entries in browser `localStorage`; the optional local `server.mjs` disk/SSE bridge is not active on static Pages hosting and fails open cleanly.
