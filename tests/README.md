# Browser acceptance checks

These compare what a real headless browser actually renders against official MLB
responses downloaded independently at check time. They are what makes the
"verified against MLB" claims on the site mean something; the network-free
fixture tests live in `../tools/`.

Each one is run by a matching workflow:

| Check | Workflow | Command | Official Source |
| --- | --- | --- | --- |
| Scoreboard cards | `check.yml` | `python3 tests/verify_schedule.py <schedule.json> <rendered.html> <date>` | [MLB Schedule (`2024-10-30`)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore,review) |
| Game view rows | `game-acceptance.yml` | `node tests/verify-game.mjs <feed.json> <rendered.html> <gamePk>` | [MLB Live Feed (`775296`)](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live) |
| Replay Feed | `reviews-acceptance.yml` | `node tests/verify-reviews.mjs <date> <schedule.json> <feeds-dir> <rendered.html>` | [MLB Schedule (`2024-10-30`)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=team,linescore,review) · [MLB Live Feed (`775296`)](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live) |

Each verifier fails closed: a value the official payload does not contain must
render blank, a row must carry its MLB source link, and anything the page shows
that cannot be reproduced from the official response fails the check. Each was
confirmed to fail on injected corruptions before being trusted — see the
"Verification performed" section of `flagged.html`.

`tests/check.py` is a separate, network-free guard that fails if any local
`href`/`src` in any page points to a file that does not exist.

The synthetic jsdom suite that used to live here (`app.test.cjs`) tested the
superseded stopgap client `assets/app.js`. That client was removed when the real
modular client was restored; the equivalent — and larger — coverage now lives in
`../tools/` and runs as part of `npm test`.
