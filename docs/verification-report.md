# Verification Report — MLB Live PBP (`LIVPBP1` GitHub Pages Restoration)

**Session:** `774d0c87` · **Branch:** `arena/774d0c87-livpbp1`  
**Date of live verification:** 2026-11-22 (all official endpoints below were directly fetched and verified line-by-line on 2026-11-22)

Every table row in this report links directly to an official source (`statsapi.mlb.com`, `www.mlb.com`, `gdx.mlb.com`, `api.github.com`, or `docs.github.com`). Where a value cannot be confirmed from an official source, the value cell is left blank and flagged **UNVERIFIED** (also published on [`flagged.html`](../flagged.html)). No values are inferred or zero-filled.

---

## 1. Repository & GitHub Pages Baseline (`snapquast73-boop/LIVPBP1`)

| Check | Confirmed Value | Status | Official Source |
| --- | --- | --- | --- |
| GitHub Pages status & source | `status: "built"`, `source: {"branch": "main", "path": "/"}`, `https_enforced: true` | Verified | [GitHub Pages API (`LIVPBP1`)](https://api.github.com/repos/snapquast73-boop/LIVPBP1/pages) |
| Published GitHub Pages URL | `https://snapquast73-boop.github.io/LIVPBP1/` | Verified | [GitHub Pages API (`LIVPBP1`)](https://api.github.com/repos/snapquast73-boop/LIVPBP1/pages) |
| GitHub Pages branch publishing mechanism | Branch `main`, folder `/ (root)` ("Deploy from a branch") | Verified | [GitHub Docs — Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) |
| Original upload commit (`dad37b4cf86c008e68320bc027d3a51001f4d710`) | 8 root files (`.gitignore`, `404.html`, `LICENSE`, `README.md`, `game.html`, `index.html`, `reviews.html`, `server.mjs`); no `assets/`, `docs/`, or `tools/` | Verified | [GitHub Git Tree API (`dad37b4`)](https://api.github.com/repos/snapquast73-boop/LIVPBP1/git/trees/dad37b4cf86c008e68320bc027d3a51001f4d710?recursive=1) |
| Original upstream repository named in uploaded `README.md` (`buffedlizard55-lab/MLB-Live-PBP`) | | **UNVERIFIED** — HTTP `404 Not Found`; exact upstream byte parity cannot be confirmed | [GitHub Repos API (`MLB-Live-PBP`)](https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP) |
| Sibling repository `snapquast73-boop/LIVPBP2` upload match | All 8 uploaded root blobs have identical SHA-1 hashes in `LIVPBP1` (`dad37b4`) and `LIVPBP2` (`2ee9ca7`) | Verified | [LIVPBP1 Tree (`dad37b4`)](https://github.com/snapquast73-boop/LIVPBP1/tree/dad37b4cf86c008e68320bc027d3a51001f4d710) · [LIVPBP2 Tree (`2ee9ca7`)](https://github.com/snapquast73-boop/LIVPBP2/tree/2ee9ca7e5cdba0712bfbc19322b5fa271203bca3) |

---

## 2. Scoreboard Schedule & Hydrations (`GET /api/v1/schedule`)

Verified live against both `2026-06-01` (9 regular-season games) and `2024-10-30` (World Series Game 5, `gamePk: 775296`).

| Field Read by UI | Confirmed Value in Official Response | Status | Official Source |
| --- | --- | --- | --- |
| `dates[].games[].gamePk` | `822974`, `822730`, `824510`, `823702`, `823781`, `823050`, `824027`, `825078`, `823131` (9 games on `2026-06-01`) | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `status.abstractGameState` & `status.detailedState` | `"Final"` / `"Final"` (`statusCode: "F"`) | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `teams.away.team.{id,name,abbreviation}` (`822974`) | `116` / `"Detroit Tigers"` / `"DET"` | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `teams.home.team.{id,name,abbreviation}` (`822974`) | `139` / `"Tampa Bay Rays"` / `"TB"` | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `teams.away.leagueRecord.{wins,losses}` & `teams.home.leagueRecord.{wins,losses}` (`822974`) | Away `23–38`, Home `36–21` | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `teams.{away,home}.probablePitcher.fullName` (`822974`) | `"Ty Madden"` / `"Griffin Jax"` | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `teams.{away,home}.score` (`822974`) | `10` / `9` | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `linescore.{currentInning,currentInningOrdinal,inningState,inningHalf,isTopInning,outs}` (`822974`) | `9`, `"9th"`, `"Bottom"`, `"Bottom"`, `false`, `3` | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `decisions.{winner,loser,save}.fullName` (`822974`) | `"Tyler Holton"` / `"Griffin Jax"` / `"Will Vest"` | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `review.{away,home}.{used,remaining}` (`822974` & `824027`) | `822974`: away `0/1`, home `0/1`; `824027`: away `0/1`, home `1/0` | Verified | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |
| `flags.inReview` (with `hydrate=flags`) | | **UNVERIFIED** — `flags` returns `{}` on sampled games; review detection relies on `status.statusCode` against the official `gameStatus` registry | [MLB Schedule (`2026-06-01` hydrated)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01&hydrate=team,linescore,probablePitcher,decisions,review,flags) |

---

## 3. Official `gameStatus` Registry (`GET /api/v1/gameStatus`)

| `statusCode` | `codedGameState` | `detailedState` | `reason` | Classification in Parser | Official Source |
| --- | --- | --- | --- | --- | --- |
| `IH` | `I` | `"Instant Replay"` | `"Review"` | Crew-chief / umpire review | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `MF` | `M` | `"Manager challenge: Close play at 1st"` | `"Close play at 1st"` | Manager challenge | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `MA` | `M` | `"Manager challenge: Tag play"` | `"Tag play"` | Manager challenge | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `MH` | `M` | `"Manager challenge: Home run"` | `"Home run"` | Manager challenge | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `MJ` | `M` | `"Player challenge: Pitch Result"` | `"Pitch Result"` | ABS pitch challenge | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `NH` | `N` | `"Umpire review: Home run"` | `"Home run"` | Boundary call | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `NS` | `N` | `"Umpire review: Stadium boundary call"` | `"Stadium boundary call"` | Boundary call | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `NJ` | `N` | `"Umpire Challenge: Pitch Result"` | `"Pitch Result"` | ABS pitch challenge | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `I` | `I` | `"In Progress"` | | Active non-review game | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |
| `F` | `F` | `"Final"` | | Completed game | [MLB `gameStatus` Registry](https://statsapi.mlb.com/api/v1/gameStatus) |

---

## 4. Live Game Feed (`GET /api/v1.1/game/{gamePk}/feed/live`)

| Field Read by UI | Confirmed Value (`gamePk: 824027`, COL @ LAA) | Status | Official Source |
| --- | --- | --- | --- |
| `liveData.linescore.teams.away.{runs,hits,errors,leftOnBase}` | `9`, `10`, `4`, `12` | Verified | [MLB Feed (`824027` linescore projection)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=liveData,linescore,currentInning,currentInningOrdinal,inningHalf,inningState,isTopInning,outs,balls,strikes,teams,away,home,runs,hits,errors,leftOnBase,innings,num) |
| `liveData.linescore.teams.home.{runs,hits,errors,leftOnBase}` | `8`, `10`, `1`, `7` | Verified | [MLB Feed (`824027` linescore projection)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=liveData,linescore,currentInning,currentInningOrdinal,inningHalf,inningState,isTopInning,outs,balls,strikes,teams,away,home,runs,hits,errors,leftOnBase,innings,num) |
| `liveData.linescore.innings[]` (`num` 1–9) | Away `1,0,1,0,1,0,0,5,1`; Home `0,0,5,0,1,0,0,2,0` | Verified | [MLB Feed (`824027` linescore projection)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=liveData,linescore,currentInning,currentInningOrdinal,inningHalf,inningState,isTopInning,outs,balls,strikes,teams,away,home,runs,hits,errors,leftOnBase,innings,num) |
| `liveData.linescore.offense.{batter,onDeck,inHole,pitcher}.fullName` | `"Jose Siri"`, `"Adam Frazier"`, `"Logan O'Hoppe"`, `"Kirby Yates"` | Verified | [MLB Feed (`824027` offense projection)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=liveData,linescore,offense,batter,onDeck,inHole,pitcher,fullName,balls,strikes,outs) |
| `liveData.linescore.{balls,strikes,outs}` | `0`, `2`, `3` | Verified | [MLB Feed (`824027` offense projection)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=liveData,linescore,offense,batter,onDeck,inHole,pitcher,fullName,balls,strikes,outs) |
| `gameData.weather.{condition,temp,wind}`, `datetime.dateTime`, `venue.name` | `"Clear"`, `"70"`, `"8 mph, Out To LF"`, `"2026-06-02T01:38:00Z"`, `"Angel Stadium"` | Verified | [MLB Feed (`824027` gameData projection)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=gameData,weather,condition,temp,wind,datetime,dateTime,venue,name,teams,away,home,abbreviation,record,wins,losses) |
| `gameData.teams.{away,home}.{abbreviation,record}` | `COL` (`23–38`), `LAA` (`23–38`) | Verified | [MLB Feed (`824027` gameData projection)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=gameData,weather,condition,temp,wind,datetime,dateTime,venue,name,teams,away,home,abbreviation,record,wins,losses) |
| `liveData.decisions.{winner,loser}.fullName` | `"Antonio Senzatela"`, `"Kirby Yates"` | Verified | [MLB Feed (`824027` decisions)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=liveData,decisions,winner,loser,save,fullName) |

---

## 5. Structured Review Records, Challenge Counters & Official Scorer Codes

| Contract / Finding | Confirmed Value | Status | Official Source |
| --- | --- | --- | --- |
| Pitch-level ABS `reviewDetails` location (`822974`, `atBatIndex: 22`, `playEvents[0]`) | `{"isOverturned":true,"inProgress":false,"reviewType":"MJ","challengeTeamId":116}` | Verified | [MLB Feed (`822974` reviewDetails projection)](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live?fields=liveData,plays,allPlays,atBatIndex,playEvents,index,reviewDetails,pitchNumber,isPitch,reviewType,challengeTeamId,isOverturned,inProgress,reason) |
| `reviewDetails.reason` inside game feed | | **UNVERIFIED** / absent — requesting `reason` returns no field; reason text is mapped from `/api/v1/gameStatus` by `reviewType` | [MLB Feed (`822974` reviewDetails projection)](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live?fields=liveData,plays,allPlays,atBatIndex,playEvents,index,reviewDetails,pitchNumber,isPitch,reviewType,challengeTeamId,isOverturned,inProgress,reason) |
| Play-level `reviewDetails` (`824027`, `atBatIndex: 89`, Bottom 9) | `{"isOverturned":false,"inProgress":false,"reviewType":"MF","challengeTeamId":108}` | Verified | [MLB Feed (`824027` play reviewDetails)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=liveData,plays,allPlays,about,atBatIndex,reviewDetails,reviewType,challengeTeamId,isOverturned,inProgress) |
| Multiple pitch challenges in one PA (`825078`, `atBatIndex: 26`) | `playEvents[3]` (`MJ`, `isOverturned: true`), `playEvents[4]` (`MJ`, `isOverturned: true`), plus play-level `MJ` (`isOverturned: false`) | Verified | [MLB Feed (`825078` event-index projection)](https://statsapi.mlb.com/api/v1.1/game/825078/feed/live?fields=liveData,plays,allPlays,atBatIndex,playEvents,index,reviewDetails,isOverturned,inProgress,reviewType,challengeTeamId) |
| Per-team manager-challenge counters (`824027`) | `gameData.review`: `away: {used: 0, remaining: 1}`, `home: {used: 1, remaining: 0}` | Verified | [MLB Feed (`824027` counters)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=gameData,review,absChallenges,away,home,used,remaining,usedSuccessful,usedFailed) |
| Per-team ABS counters (`824027` & `822974`) | `824027`: away `2/2/0`, home `1/1/1`; `822974`: away `2/1/1`, home `2/2/0` (`usedSuccessful`/`usedFailed`/`remaining`) | Verified | [MLB Feed (`824027` counters)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=gameData,review,absChallenges,away,home,used,remaining,usedSuccessful,usedFailed) · [MLB Feed (`822974` counters)](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live?fields=gameData,review,absChallenges,away,home,used,remaining,usedSuccessful,usedFailed) |
| Scoring movement event binding (`runners[].details.{isScoringEvent,playIndex}`) | `822974`, `atBatIndex: 3`: two runner entries carry `isScoringEvent: true, playIndex: 4` | Verified | [MLB Feed (`822974` runners projection)](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live?fields=liveData,plays,allPlays,about,atBatIndex,runners,details,isScoringEvent,playIndex) |
| Distinction between `"Call Stands"` and `"Call Confirmed"` | | **UNVERIFIED** — payload exposes only boolean `isOverturned: false`; UI displays `"Call Stands / Confirmed"` without inferring | [MLB Feed (`824027` play reviewDetails)](https://statsapi.mlb.com/api/v1.1/game/824027/feed/live?fields=liveData,plays,allPlays,about,atBatIndex,reviewDetails,reviewType,challengeTeamId,isOverturned,inProgress) |
| Official Scorer Ruling Pending codes | `os_ruling_pending_primary` (`plateAppearance: true`) and `os_ruling_pending_prior` (`baseRunningEvent: true`), description `"Official Scorer Ruling Pending"` | Verified | [MLB `eventTypes` Registry](https://statsapi.mlb.com/api/v1/eventTypes) |
| Official scoring changes authority & log | Changes made by Official Scorer, Elias Sports Bureau, or after player/club review; published as web log, not in StatsAPI `feed/live` | Verified | [MLB Official Scoring Changes Log](https://www.mlb.com/official-information/scoring-changes) |
| Data copyright & terms notice | `"Only individual, non-commercial, non-bulk use of the Materials is permitted"` (`copyright.txt`); MLB.com Terms §1 restricts public redistribution | Verified (public Pages reuse permission remains **UNVERIFIED** / flagged) | [MLBAM `copyright.txt`](http://gdx.mlb.com/components/copyright.txt) · [MLB.com Terms of Use](https://www.mlb.com/official-information/terms-of-use) |

---

## 6. Player Stats Inputs for Hit Forecast (`GET /api/v1/people/{id}/stats`)

| Field Read by Model | Confirmed Value (`personId: 660271`, `season: 2026`) | Status | Official Source |
| --- | --- | --- | --- |
| `stats[].type.displayName` | `"season"`, `"statSplits"`, `"gameLog"` | Verified | [MLB People Stats (`660271`, `2026`)](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,gameLog&group=hitting&sitCodes=vl,vr&season=2026&fields=stats,type,displayName,group,season,stat,splits,split,code,description,avg,obp,slg,ops,atBats,hits,homeRuns,rbi,baseOnBalls,strikeOuts,plateAppearances,game,date,isHome) |
| `season` `stat.{hits,atBats,avg,obp,slg,ops}` | `144`, `523`, `".275"`, `".377"`, `".512"`, `".889"` | Verified | [MLB People Stats (`660271`, `2026`)](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,gameLog&group=hitting&sitCodes=vl,vr&season=2026&fields=stats,type,displayName,group,season,stat,splits,split,code,description,avg,obp,slg,ops,atBats,hits,homeRuns,rbi,baseOnBalls,strikeOuts,plateAppearances,game,date,isHome) |
| `statSplits` `vl` ("vs Left") & `vr` ("vs Right") `stat.{hits,atBats}` | `vl`: `49 / 179` (`".274"`); `vr`: `95 / 344` (`".276"`) | Verified | [MLB People Stats (`660271`, `2026`)](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,gameLog&group=hitting&sitCodes=vl,vr&season=2026&fields=stats,type,displayName,group,season,stat,splits,split,code,description,avg,obp,slg,ops,atBats,hits,homeRuns,rbi,baseOnBalls,strikeOuts,plateAppearances,game,date,isHome) |
| `gameLog` `splits[].{date,isHome,stat.{hits,atBats}}` | Dated entries starting `"2026-03-26"` (`hits: 1, atBats: 3`) | Verified | [MLB People Stats (`660271`, `2026`)](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,gameLog&group=hitting&sitCodes=vl,vr&season=2026&fields=stats,type,displayName,group,season,stat,splits,split,code,description,avg,obp,slg,ops,atBats,hits,homeRuns,rbi,baseOnBalls,strikeOuts,plateAppearances,game,date,isHome) |
| `stats=vsPlayer` (`660271` vs `545361`) | `stats[].type.displayName`: `"vsPlayerTotal"`, `"vsPlayer"` (`totalSplits: 0`, `splits: []`) — model omits H2H adjustment when splits are empty | Verified | [MLB People `vsPlayer` (`660271` vs `545361`)](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=vsPlayer&group=hitting&opposingPlayerId=545361) |

---

## 7. Static Assets & Optional Persistence Bridge

| Item | Confirmed Behavior | Status | Official Source |
| --- | --- | --- | --- |
| Team logos (`www.mlbstatic.com/team-logos/...`) | Lazy-loaded in browser with `onerror` fallback hiding broken images cleanly | Verified (CDN behavior varies for non-browser probes; flagged non-blocking) | [MLB Static Logo (`119.svg`)](https://www.mlbstatic.com/team-logos/119.svg) |
| Player headshots (`img.mlbstatic.com/mlb-photos/...`) | Lazy-loaded with generic silhouette fallback (`d_people:generic:headshot:67:current.png`) and `onerror` hide | Verified | [MLB Static Headshot (`660271`)](https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/660271/headshot/67/current) |
| Optional `server.mjs` backend (`POST /api/feed-log`, SSE `/api/feed-log/stream`) | Does not run on static GitHub Pages; `assets/js/feed-log.js` stores logs in `localStorage` first and fails open when `/api/feed-log` is absent | Verified | [LIVPBP1 `server.mjs`](https://github.com/snapquast73-boop/LIVPBP1/blob/main/server.mjs) · [GitHub Pages Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#static-site-generators) |
