# Verification report — MLB Live PBP (GitHub Pages restoration)

**Session:** `d108a53a` · **Branch:** `arena/d108a53a-livpbp1`
**Date of checks:** 2026-11-22 (UTC)
**Scope:** the whole published site — `index.html`, `game.html`, `reviews.html`, `404.html`,
`flagged.html`, `assets/**`, `docs/**`, `tools/**`, `tests/**`.

Every row below states what was checked and links the source. Where a value could not be confirmed,
the row says **UNVERIFIED** and the item is also on the site's
[Flagged for Review](https://snapquast73-boop.github.io/LIVPBP1/flagged.html) page. Nothing here is
filled in from memory or inferred from another site.

---

## 1. The upload, as received

| Check | Result | Evidence |
| --- | --- | --- |
| Files in the upload | Ten root files. No `assets/`, no `docs/`, no `tools/`, no tests. | [uploaded tree `dad37b4`](https://api.github.com/repos/snapquast73-boop/LIVPBP1/git/trees/dad37b4cf86c008e68320bc027d3a51001f4d710?recursive=1) |
| Client the uploaded pages require | `assets/css/style.css` plus eight files under `assets/js/` (api, ui, reviews, feed-log, scoreboard, props, game, reviews-feed) | [index.html](https://github.com/snapquast73-boop/LIVPBP1/blob/dad37b4cf86c008e68320bc027d3a51001f4d710/index.html), [game.html](https://github.com/snapquast73-boop/LIVPBP1/blob/dad37b4cf86c008e68320bc027d3a51001f4d710/game.html), [reviews.html](https://github.com/snapquast73-boop/LIVPBP1/blob/dad37b4cf86c008e68320bc027d3a51001f4d710/reviews.html) |
| Were those files present? | **No.** Every page loaded inert and unstyled. | same tree listing |
| Original author's repository | `GET https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP` → `{"message":"Not Found"}` | [GitHub API lookup](https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP) |

## 2. Where the restored client came from, and why that is evidence

The decisive check is a **blob-identity** comparison, not a similarity judgement.

| Check | Result | Evidence |
| --- | --- | --- |
| `server.mjs` in this upload vs `snapquast73-boop/LIVPBP2` | **Identical.** Blob `3daa71433da3d50cbba323ee31d0231eb9961c05` in both. | [this repo's upload](https://api.github.com/repos/snapquast73-boop/LIVPBP1/contents/server.mjs?ref=dad37b4cf86c008e68320bc027d3a51001f4d710), [LIVPBP2 server.mjs](https://api.github.com/repos/snapquast73-boop/LIVPBP2/contents/server.mjs) |
| `index.html`, `game.html`, `reviews.html` vs LIVPBP2 | Differ **only** by the added “Flagged for Review” footer link (a three-line diff, re-checked with `diff -u`). | [LIVPBP2 index.html](https://github.com/snapquast73-boop/LIVPBP2/blob/main/index.html) |
| Conclusion | LIVPBP2 is the same project, rebuilt by the same owner, with its `assets/` intact. Its client is a faithful restoration of exactly the files this upload's pages ask for — not a re-implementation written from scratch. | [LIVPBP2 repository](https://github.com/snapquast73-boop/LIVPBP2) |
| What this does **not** prove | Byte-identity with the original author's private implementation. **UNVERIFIED.** | [Flagged for Review §2](https://snapquast73-boop.github.io/LIVPBP1/flagged.html) |

The three uploaded pages and `404.html` were restored from the upload commit itself, so the published
markup is byte-for-byte the uploaded markup.

## 3. Scoreboard — official schedule response

Request the site makes:

```
GET https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=<date>
    &hydrate=team,linescore,probablePitcher(note),decisions,review
```

Evidence: <https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore,probablePitcher(note),decisions,flags,review,game(content(summary))>

| Field the UI reads | Value in that response | Status |
| --- | --- | --- |
| `dates[].games[].gamePk` | `775296` | verified |
| `status.abstractGameState` / `detailedState` | `Final` / `Final` | verified |
| `teams.away.team.name` · `abbreviation` · `score` | `Los Angeles Dodgers` · `LAD` · `7` | verified |
| `teams.home.team.name` · `abbreviation` · `score` | `New York Yankees` · `NYY` · `6` | verified |
| `teams.*.leagueRecord.wins/losses` | `4-1` (LAD), `1-4` (NYY) | verified |
| `decisions.winner` / `loser` / `save` | `Blake Treinen` / `Tommy Kahnle` / `Walker Buehler` | verified |
| `venue.name` | `Yankee Stadium` | verified |
| `review.away.used/remaining`, `review.home.used/remaining` | `0/2`, `1/1` | verified |
| `linescore.innings[].{away,home}.runs` | 9 innings; LAD `0,0,0,0,5,0,0,2,0`, NYY `3,1,1,0,0,1,0,0,0` | verified |
| `linescore.teams.*.{runs,hits,errors,leftOnBase}` | LAD `7/7/0/10`, NYY `6/8/2/12` | verified |
| `flags.inReview` | **not present** in any sampled response | UNVERIFIED — review detection therefore uses `status.statusCode` against the registry |

## 4. Review detection — the official game-status registry

Evidence: <https://statsapi.mlb.com/api/v1/gameStatus>

| Code | `detailedState` | `reason` | Used for |
| --- | --- | --- | --- |
| `MF` | Manager challenge: Close play at 1st | Close play at 1st | Manager challenge |
| `MA` | Manager challenge: Tag play | Tag play | Manager challenge |
| `MH` | Manager challenge: Home run | Home run | Manager challenge |
| `MS` | Manager challenge: Stadium boundary call | Stadium boundary call | Manager challenge |
| `MJ` | Player challenge: Pitch Result | Pitch Result | ABS pitch challenge |
| `NJ` | Umpire Challenge: Pitch Result | Pitch Result | ABS pitch challenge |
| `IH` | Instant Replay | Review | Crew-chief / umpire review |
| `NH` | Umpire review: Home run | Home run | Boundary call |
| `NS` | Umpire review: Stadium boundary call | Stadium boundary call | Boundary call |
| `I` | In Progress | — | control case: **not** a review |
| `F` | Final | — | control case: **not** a review |

The client tests `reviewDetails.reviewType` against this registry (`/^M[A-Z0-9]$/`, `/^N[A-Z0-9]$/`,
`MJ`/`NJ`, `IH`) instead of matching the words “challenge”/“review” in a description. That is why a
crew-chief review, whose `detailedState` is the text “Instant Replay”, is not missed.

## 5. Review records and counters — official live feed

Evidence: <https://statsapi.mlb.com/api/v1.1/game/822974/feed/live?fields=gamePk,gameData,teams,away,home,name,review,absChallenges,used,remaining,usedSuccessful,usedFailed,liveData,plays,allPlays,about,atBatIndex,inning,halfInning,playEvents,details,reviewDetails,reviewType,challengeTeamId,isOverturned,inProgress,index>

| Field | Value in that response | Status |
| --- | --- | --- |
| `gameData.review.away` / `.home` | `{used:0, remaining:1}` / `{used:0, remaining:1}` | verified |
| `gameData.absChallenges.away` | `{usedSuccessful:2, usedFailed:1, remaining:1}` | verified |
| `gameData.absChallenges.home` | `{usedSuccessful:2, usedFailed:2, remaining:0}` | verified |
| `reviewDetails` location | on `liveData.plays.allPlays[].playEvents[]`, one object per challenged pitch | verified |
| `reviewDetails.reviewType` | `"MJ"` on every record in this sample | verified |
| `reviewDetails.isOverturned` | `true` on atBatIndex 81 events 4 and 6; `false` on 79/1 and 84/3 | verified |
| `reviewDetails.challengeTeamId` | `139` (TB) and `116` (DET), including both values inside one plate appearance | **semantics UNVERIFIED** — undocumented; the UI reports it as the challenging team and shows counters only for that side |
| `reviewDetails.id` uniqueness | **no `id` field** in this sample | the client de-duplicates on `reviewType|scope|playIndex|state`, not on an id |
| “call stands” vs “call confirmed” | not distinguishable: only `isOverturned` is exposed | **UNVERIFIED distinction** — rows read “Call Stands / Confirmed” |
| Runs removed by an overturn | no field reports this | **not claimed** — only runs attributed to the reviewed event are counted as “at risk” |

## 6. Official-scorer-pending rulings — the event-type registry

Evidence: <https://statsapi.mlb.com/api/v1/eventTypes>

| Code | `description` | Status |
| --- | --- | --- |
| `os_ruling_pending_primary` | `Official Scorer Ruling Pending` | verified |
| `os_ruling_pending_prior` | `Official Scorer Ruling Pending` | verified |

## 7. What the page test proves, and what it does not

`tests/official-e2e.mjs` fetches the four official endpoints in §3–§6, loads each published page from
disk with that page's own `<script src>` files, routes `fetch` to the official bodies, and compares the
rendered DOM with the response. It contains **no hand-typed expected value**.

| Suite | Result (2026-11-22) |
| --- | --- |
| `node tools/review-test.mjs` | 14 checks passed |
| `node tools/hit-model-test.mjs` | 12 checks passed |
| `node tools/reviews-feed-test.mjs` | 6 checks passed |
| `node tools/feed-fields-test.mjs` | 9 checks passed |
| `node tools/page-render-test.mjs` | 7 pages checked, 0 failed |
| `node tests/official-e2e.mjs` | 34 checks passed, 0 failed |
| `python3 tests/check.py` | all local `href`/`src` references exist |
| `node tools/link-check.mjs` | 0 broken internal links |

The page test was also run against **deliberately injected regressions** (a hard-coded score, and
truncated play descriptions). It failed both, so the suite is not vacuous.

**What it does not prove:** that the original author's site looked or polled identically. The polling
cadence in the uploaded README (500 ms live / 250 ms during a review / 125 ms status watcher) is **not
reproduced**; the client polls at the rates in [`docs/api-compliance.md`](api-compliance.md) for the stated
request-budget reason. A headless run cannot confirm audible alert chimes or desktop notifications.
And no test can prove a live game's *future* values — it proves the rendering contract against the
official response captured at run time.

## 8. Deployment

| Check | Result | Evidence |
| --- | --- | --- |
| Pages publishes `main` from `/ (root)` | confirmed | [Pages API](https://api.github.com/repos/snapquast73-boop/LIVPBP1/pages) |
| Live URL | `https://snapquast73-boop.github.io/LIVPBP1/` | the API's own `html_url` |
| Post-deployment probes | run by `.github/workflows/live-check.yml` after each `github-pages` deployment | workflow file in this repository |

## 9. Reconciliation with the parallel session that landed the same restoration

While this session was working, a parallel session merged PR #26 ("Restore the original modular MLB client")
to `main`. Both sessions reached the **same root cause** and the **same fix**: the upload's pages require
`assets/css/style.css` + eight `assets/js/*.js` files that were never uploaded, and the previous
“assets/app.js” stopgap was removed. Their client and this session's are byte-identical except
`assets/js/reviews-feed.js` and `assets/css/style.css`, where **`main` is newer** (it adds scan-health
reporting so a failed refresh cannot present stale totals as current).

This branch therefore keeps **`main`'s** site code and adds only what `main` did not have:

- `tests/official-e2e.mjs` — the page-level official-payload test (§7): every rendered value compared with
  the official response, with no hand-typed expected value. It passes against `main`'s client.
- `tests/live-e2e.mjs` — the same idea against the **deployed** site in a real browser.
- `tests/verify-game.mjs` — rewritten to read each expected value out of the official feed and to verify
  the review cards, rather than asserting a fixed DOM shape.
- `docs/` and `flagged.html` — the diagnosis, the blob-identity evidence, and every unverified item, each
  with its source link.
- One CI step in `check.yml` (`npm run -s test:pages`) and one in `live-check.yml` (the deployed-site run).

No file from the other session was discarded. The board records the overlap.
