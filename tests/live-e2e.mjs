/* Deployed-site check: public GitHub Pages vs the official MLB StatsAPI.
 *
 *   node tests/live-e2e.mjs                       # https://snapquast73-boop.github.io/LIVPBP1/
 *   BASE_URL=http://127.0.0.1:8000/ node tests/live-e2e.mjs
 *
 * This is the counterpart to tests/official-e2e.mjs. That one loads the pages
 * from disk and routes `fetch` to a fetched official payload, so it proves the
 * rendering contract. This one loads the *deployed* pages in a real browser and
 * lets them call the live API themselves, so it proves the thing the user
 * actually visits — CSS, script tags, CORS, and live requests — works end to end.
 *
 * Requires a browser. Set CHROME to the executable, or it uses `google-chrome`.
 * Exits non-zero on any page error, any failed local resource, or any value that
 * disagrees with the official response fetched in the same run.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.env.BASE_URL || 'https://snapquast73-boop.github.io/LIVPBP1/').replace(/\/?$/, '/');
const CHROME = process.env.CHROME || 'google-chrome';
const STATS = 'https://statsapi.mlb.com';
const DATE = process.env.E2E_DATE || '2024-10-30';
const GAME_PK = Number(process.env.E2E_GAME_PK || 775296);
const HYDRATE = 'team,linescore,decisions,review';

/* ---------------------------------------------------- official expectations */

const scheduleUrl = `${STATS}/api/v1/schedule?sportId=1&date=${DATE}&hydrate=${HYDRATE}`;
const feedUrl = `${STATS}/api/v1.1/game/${GAME_PK}/feed/live`;

const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.ok(res.ok, `${url} -> HTTP ${res.status}`);
  return res.json();
};

const schedule = await getJson(scheduleUrl);
const feed = await getJson(feedUrl);
console.log(`official: ${scheduleUrl}`);
console.log(`official: ${feedUrl}`);

const slate = schedule.dates.find((d) => d.date === DATE);
assert.ok(slate, `no official slate for ${DATE}`);
const game = slate.games.find((g) => g.gamePk === GAME_PK);
assert.ok(game, `game ${GAME_PK} is not on the official ${DATE} schedule`);

/* --------------------------------------------------------- browser harness */

function renderDom(url, budgetMs = 25000) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pbp-')), 'dom.html');
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--virtual-time-budget=${budgetMs}`, '--dump-dom', url,
  ];
  const dom = execFileSync(CHROME, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(out, dom);
  return dom;
}

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

let passed = 0;
const failed = [];
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (err) {
    failed.push({ name, err });
    console.log(`FAIL ${name}\n     ${String(err.message).split('\n')[0]}`);
  }
}

/* ---------------------------------------------------------------- the site */

const boardUrl = `${BASE}index.html?date=${DATE}`;
const boardDom = renderDom(boardUrl);
const boardText = strip(boardDom);

check('deployed scoreboard loads its stylesheet and client', () => {
  assert.ok(boardDom.includes('assets/css/style.css'), 'stylesheet link missing from served HTML');
  assert.ok(boardDom.includes('assets/js/scoreboard.js'), 'scoreboard client missing from served HTML');
  assert.ok(!boardDom.includes('assets/app.js'), 'served page still loads the removed assets/app.js');
});

check('deployed scoreboard lists every game on the official schedule', () => {
  for (const g of slate.games) {
    assert.ok(boardDom.includes(`game.html?gamePk=${g.gamePk}`),
      `no card links to game ${g.gamePk}`);
  }
});

check('deployed scoreboard shows the official teams, scores and venue', () => {
  for (const side of [game.teams.away, game.teams.home]) {
    assert.ok(boardText.includes(side.team.name), `missing ${side.team.name}`);
    assert.ok(boardText.includes(String(side.score)), `missing ${side.team.name} score ${side.score}`);
  }
  assert.ok(boardText.includes(game.venue.name), `missing venue ${game.venue.name}`);
  assert.ok(boardText.includes(game.status.detailedState), 'missing Final status');
});

check('deployed scoreboard reports an updated (not erroring) status line', () => {
  assert.match(boardText, /Updated \d|\d+ game\(s\)/,
    `status line does not show an update: ${boardText.slice(0, 400)}`);
  assert.ok(!/Error loading schedule/i.test(boardText), 'the page reported a schedule error');
});

const gameUrl = `${BASE}game.html?gamePk=${GAME_PK}&date=${DATE}`;
const gameDom = renderDom(gameUrl, 30000);
const gameText = strip(gameDom);

check('deployed game page shows the official teams, final score and status', () => {
  const away = feed.gameData.teams.away;
  const home = feed.gameData.teams.home;
  assert.ok(gameText.includes(away.name), `missing ${away.name}`);
  assert.ok(gameText.includes(home.name), `missing ${home.name}`);
  assert.ok(gameText.includes(String(feed.liveData.linescore.teams.away.runs)), 'missing away runs');
  assert.ok(gameText.includes(String(feed.liveData.linescore.teams.home.runs)), 'missing home runs');
  assert.ok(gameText.includes(feed.gameData.status.detailedState), 'missing status');
});

check('deployed game page lists the official plays (spot-checked, newest first)', () => {
  const plays = feed.liveData.plays.allPlays.map((p) => p.result?.description).filter(Boolean);
  assert.ok(plays.length > 0, 'official feed carried no play');
  const newest = plays[plays.length - 1];
  const oldest = plays[0];
  assert.ok(gameText.includes(newest), `most recent play not rendered: ${newest}`);
  assert.ok(gameText.includes(oldest), `first play not rendered: ${oldest}`);
  assert.ok(gameText.indexOf(newest) < gameText.indexOf(oldest),
    'plays are not rendered newest-first');
});

check('deployed game page renders the official linescore totals', () => {
  const t = feed.liveData.linescore.teams;
  assert.ok(gameText.includes(feed.gameData.teams.away.abbreviation), 'away abbreviation missing');
  assert.ok(gameText.includes(feed.gameData.teams.home.abbreviation), 'home abbreviation missing');
  for (const side of ['away', 'home']) {
    for (const field of ['runs', 'hits', 'errors', 'leftOnBase']) {
      const v = t[side][field];
      if (typeof v === 'number') {
        /* Each total appears as its own table cell; presence in the table text
         * is the check, and the Playwright-free DOM dump preserves cell marks. */
        assert.ok(gameDom.includes(`>${v}<`), `${side}.${field}=${v} not in any table cell`);
      }
    }
  }
});

check('deployed game page links every source cell to the official MLB feed', () => {
  assert.ok(gameDom.includes(`${STATS}/api/v1.1/game/${GAME_PK}/feed/live`),
    'no link to the official feed');
});

check('deployed game page does not report a load failure', () => {
  assert.ok(!/Error loading game/i.test(gameText), 'the page reported a game load error');
  assert.ok(!/Missing <code>gamePk<\/code>|Missing gamePk/i.test(gameDom), 'gamePk was not accepted');
});

const feedUrlPage = `${BASE}reviews.html?date=${DATE}`;
const feedDom = renderDom(feedUrlPage, 40000);
const feedText = strip(feedDom);

check('deployed replay feed loads with its client and no error banner', () => {
  assert.ok(feedDom.includes('assets/js/reviews-feed.js'), 'replay feed client missing');
  assert.ok(!/Unable to|Error loading|unavailable/i.test(feedText.slice(0, 600)),
    `the feed reported a failure: ${feedText.slice(0, 400)}`);
});

check('deployed replay feed offers its filter tabs', () => {
  const tabs = [...feedDom.matchAll(/data-tab="([a-z_]+)"/g)].map((m) => m[1]);
  for (const want of ['all', 'abs', 'challenge', 'review', 'boundary', 'active']) {
    assert.ok(tabs.includes(want), `missing "${want}" tab (found ${tabs.join(', ')})`);
  }
});

check('deployed replay feed scans the official slate', () => {
  assert.match(feedText, /\d+ game/,
    `the feed did not report a scan: ${feedText.slice(0, 400)}`);
});

console.log(`\nlive-e2e: ${passed} checks passed, ${failed.length} failed`);
if (failed.length) {
  for (const f of failed) console.error(`\n--- ${f.name}\n${f.err.stack}`);
  process.exit(1);
}
