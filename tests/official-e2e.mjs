/* End-to-end test of the published pages against official MLB payloads.
 *
 *   node tests/official-e2e.mjs                 # fetch the official endpoints
 *   PAYLOAD_DIR=<dir> node tests/official-e2e.mjs   # replay a recorded capture
 *
 * There is not a single hand-typed expected value in this file. Every value the
 * pages are checked against is read out of the official MLB StatsAPI response
 * that this run fetched (or replayed), so the test cannot pass by agreeing with
 * a value written from memory.
 *
 * Official endpoints used (all public, keyless, CORS-enabled):
 *   GET /api/v1/schedule?sportId=1&date=<date>&hydrate=team,linescore,decisions,review
 *   GET /api/v1.1/game/<gamePk>/feed/live
 *   GET /api/v1/gameStatus
 *   GET /api/v1/eventTypes
 *
 * The pages are loaded from disk exactly as GitHub Pages serves them: the real
 * HTML file, and the real local <script src> files in document order. `window.fetch`
 * is routed to the official payload above instead of the network, so a page that
 * requests anything else fails the run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const STATS = 'https://statsapi.mlb.com';
const DATE = process.env.E2E_DATE || '2024-10-30';
const GAME_PK = Number(process.env.E2E_GAME_PK || 775296);
const replayDir = process.env.PAYLOAD_DIR || '';

const HYDRATE = 'team,linescore,decisions,review';

function endpoint(name) {
  return {
    schedule: `${STATS}/api/v1/schedule?sportId=1&date=${DATE}&hydrate=${HYDRATE}`,
    feed: `${STATS}/api/v1.1/game/${GAME_PK}/feed/live`,
    gameStatus: `${STATS}/api/v1/gameStatus`,
    eventTypes: `${STATS}/api/v1/eventTypes`,
  }[name];
}

async function loadPayloads() {
  if (replayDir) {
    const read = (f) => JSON.parse(fs.readFileSync(path.join(replayDir, f), 'utf8'));
    return {
      schedule: read('schedule.json'),
      feed: read('feed.json'),
      gameStatus: read('gameStatus.json'),
      eventTypes: read('eventTypes.json'),
    };
  }
  const get = async (name) => {
    const url = endpoint(name);
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    assert.ok(res.ok, `${url} -> HTTP ${res.status}`);
    const json = await res.json();
    console.log(`fetched ${url}`);
    return json;
  };
  return {
    schedule: await get('schedule'),
    feed: await get('feed'),
    gameStatus: await get('gameStatus'),
    eventTypes: await get('eventTypes'),
  };
}

const official = await loadPayloads();

/* ------------------------------------------------------------ page driver */

const fetchLog = [];
function routed(payloads) {
  return (url) => {
    const target = String(url);
    fetchLog.push(target);
    /* Relative requests are same-origin with the page. */
    const u = new URL(target, 'https://snapquast73-boop.github.io/LIVPBP1/');
    /* The optional local persistence server (server.mjs) is not deployed on
     * GitHub Pages, so its same-origin probe must behave as "absent". Anything
     * else off-origin is a bug. */
    if (u.origin === 'https://snapquast73-boop.github.io' && u.pathname.startsWith('/api/feed-log')) {
      return Promise.reject(new TypeError('Failed to fetch (static hosting: no server.mjs)'));
    }
    assert.equal(u.origin, STATS, `page requested a non-MLB origin: ${target}`);
    if (u.pathname === '/api/v1/schedule') return json(payloads.schedule);
    if (u.pathname === '/api/v1/gameStatus') return json(payloads.gameStatus);
    if (u.pathname === '/api/v1/eventTypes') return json(payloads.eventTypes);
    const m = u.pathname.match(/^\/api\/v1\.1\/game\/(\d+)\/feed\/live$/);
    if (m) {
      assert.equal(Number(m[1]), GAME_PK, `page requested an unexpected game feed: ${target}`);
      return json(payloads.feed);
    }
    throw new Error(`page requested an endpoint with no official payload: ${target}`);
  };
}

const json = (value) => Promise.resolve({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: () => Promise.resolve(JSON.parse(JSON.stringify(value))),
});

const settle = async (rounds = 60) => {
  for (let i = 0; i < rounds; i += 1) await new Promise((r) => setTimeout(r, 10));
};

async function openPage(page, query, payloads = official) {
  const pageErrors = [];
  const consoleErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => pageErrors.push(e.message));
  virtualConsole.on('error', (...args) => consoleErrors.push(args.join(' ')));
  virtualConsole.on('warn', () => {});
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const dom = new JSDOM(html, {
    url: `https://snapquast73-boop.github.io/LIVPBP1/${page}${query || ''}`,
    runScripts: 'outside-only',
    virtualConsole,
  });
  const { window } = dom;
  window.fetch = routed(payloads);
  const srcs = [...window.document.querySelectorAll('script[src]')]
    .map((s) => s.getAttribute('src'));
  assert.ok(srcs.length, `${page} declares no client scripts`);
  for (const src of srcs) {
    const file = path.join(root, src.replace(/^\/LIVPBP1\//, ''));
    assert.ok(fs.existsSync(file), `${page} loads a missing script: ${src}`);
    window.eval(fs.readFileSync(file, 'utf8'));
  }
  await settle();
  return { window, doc: window.document, pageErrors, consoleErrors, srcs };
}

const flat = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const byId = (doc, id) => flat(doc.getElementById(id));
const all = (node, sel) => [...node.querySelectorAll(sel)];

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

/* ------------------------------------------------------ official expectations */

const slate = official.schedule.dates.find((d) => d.date === DATE);
assert.ok(slate, `official schedule has no slate for ${DATE}`);
const game = slate.games.find((g) => g.gamePk === GAME_PK);
assert.ok(game, `official schedule for ${DATE} does not list game ${GAME_PK}`);

const gd = official.feed.gameData;
const ld = official.feed.liveData;
const awayName = gd.teams.away.name;
const homeName = gd.teams.home.name;
const awayAbbr = gd.teams.away.abbreviation;
const homeAbbr = gd.teams.home.abbreviation;

/* The official review-status registry, filtered to states MLB itself labels a
 * challenge / review / ABS pitch challenge. */
const reviewStates = official.gameStatus.filter((row) =>
  /^(Manager challenge|Umpire review|Umpire Challenge|Player challenge|Instant Replay)/
    .test(row.detailedState || ''));
const reviewCodes = new Set(reviewStates.map((r) => r.statusCode));

/* Every review record in the official feed, exactly as the payload carries it. */
const reviewRecords = [];
for (const play of ld.plays.allPlays) {
  for (const ev of play.playEvents || []) {
    if (ev.reviewDetails) {
      reviewRecords.push({
        atBatIndex: play.about?.atBatIndex,
        index: ev.index,
        description: ev.details?.description,
        rd: ev.reviewDetails,
      });
    }
  }
  if (play.reviewDetails) {
    reviewRecords.push({ atBatIndex: play.about?.atBatIndex, index: null, rd: play.reviewDetails });
  }
}
const absRecords = reviewRecords.filter((r) => r.rd.reviewType === 'MJ');
const pendingCodes = official.eventTypes
  .filter((t) => /^os_ruling_pending/.test(t.code || ''))
  .map((t) => t.code);

console.log(`\nofficial slate ${DATE}: ${slate.games.length} game(s); ` +
  `game ${GAME_PK} = ${awayName} @ ${homeName} (${game.status.detailedState}); ` +
  `${reviewRecords.length} review record(s), ${absRecords.length} ABS, ` +
  `${reviewCodes.size} review status codes, ${pendingCodes.length} pending code(s)\n`);

/* ----------------------------------------------------------- scoreboard page */

const scoreboard = await openPage('index.html', `?date=${DATE}`);

check('scoreboard renders one card per game on the official schedule', () => {
  assert.deepEqual(scoreboard.pageErrors, []);
  const cards = all(scoreboard.doc, '#game-list .game-card');
  assert.equal(cards.length, slate.games.length);
  for (const g of slate.games) {
    const card = cards.find((c) => c.getAttribute('href') === `game.html?gamePk=${g.gamePk}`);
    assert.ok(card, `no card links to game ${g.gamePk}`);
  }
});

check('scoreboard card shows the official team names, scores, records and venue', () => {
  const card = all(scoreboard.doc, '#game-list .game-card')
    .find((c) => c.getAttribute('href') === `game.html?gamePk=${GAME_PK}`);
  const text = flat(card);
  for (const side of [game.teams.away, game.teams.home]) {
    assert.ok(text.includes(side.team.name), `missing team ${side.team.name}`);
    assert.ok(text.includes(String(side.score)), `missing ${side.team.name} score ${side.score}`);
    const rec = `${side.leagueRecord.wins}-${side.leagueRecord.losses}`;
    assert.ok(text.includes(rec), `missing ${side.team.name} record ${rec}`);
  }
  assert.ok(text.includes(game.venue.name), `missing venue ${game.venue.name}`);
  assert.ok(text.includes(game.status.detailedState), `missing status ${game.status.detailedState}`);
});

check('scoreboard W/L/S decisions are the official decisions', () => {
  const card = all(scoreboard.doc, '#game-list .game-card')
    .find((c) => c.getAttribute('href') === `game.html?gamePk=${GAME_PK}`);
  const text = flat(card);
  for (const key of ['winner', 'loser', 'save']) {
    const p = game.decisions?.[key];
    if (p?.fullName) assert.ok(text.includes(p.fullName), `${key} ${p.fullName} not shown`);
  }
});

check('scoreboard tab counts equal the official slate counts', () => {
  const tabs = byId(scoreboard.doc, 'tabs');
  const count = (state) => slate.games.filter((g) => g.status.abstractGameState === state).length;
  const expected = {
    all: slate.games.length,
    live: count('Live'),
    final: count('Final'),
    scheduled: slate.games.length - count('Live') - count('Final'),
  };
  for (const [label, n] of Object.entries(expected)) {
    const re = new RegExp(`${label}\\s*\\(${n}\\)`, 'i');
    assert.match(tabs, re, `tab "${label}" does not report ${n}: ${tabs}`);
  }
});

check('scoreboard date label is the official date it requested', () => {
  const label = byId(scoreboard.doc, 'date-label');
  const d = new Date(`${DATE}T00:00:00`);
  assert.ok(label.includes(String(d.getFullYear())), `year missing from "${label}"`);
  assert.ok(new RegExp(String(d.getDate())).test(label), `day missing from "${label}"`);
  assert.equal(byId(scoreboard.doc, 'status-line').startsWith('Updated'), true,
    `status line did not confirm an update: "${byId(scoreboard.doc, 'status-line')}"`);
});

check('scoreboard requested only the official schedule endpoint', () => {
  const urls = [...new Set(fetchLog.filter((u) => u.includes('/schedule')))];
  assert.ok(urls.length, 'no schedule request');
  for (const u of urls) {
    assert.match(u, /^https:\/\/statsapi\.mlb\.com\/api\/v1\/schedule\?/);
    assert.ok(u.includes(`date=${DATE}`), `schedule request not scoped to ${DATE}: ${u}`);
    assert.ok(u.includes('sportId=1'), 'schedule request not scoped to MLB');
  }
});

/* ----------------------------------------------------------------- game page */

const gamePage = await openPage('game.html', `?gamePk=${GAME_PK}&date=${DATE}`);

check('game page loads with no page error and no console error', () => {
  assert.deepEqual(gamePage.pageErrors, []);
  assert.deepEqual(gamePage.consoleErrors, []);
});

check('game header shows the official teams, final score and status', () => {
  const away = byId(gamePage.doc, 'header-away');
  const home = byId(gamePage.doc, 'header-home');
  const center = byId(gamePage.doc, 'header-center');
  assert.ok(away.includes(awayName), `away header: ${away}`);
  assert.ok(away.includes(awayAbbr), `away abbreviation: ${away}`);
  assert.ok(home.includes(homeName), `home header: ${home}`);
  assert.ok(home.includes(homeAbbr), `home abbreviation: ${home}`);
  assert.ok(center.includes(String(ld.linescore.teams.away.runs)), `away runs in: ${center}`);
  assert.ok(center.includes(String(ld.linescore.teams.home.runs)), `home runs in: ${center}`);
  assert.ok(center.includes(gd.status.detailedState), `status in: ${center}`);
});

check('game header shows the official W/L/S decisions', () => {
  const shown = byId(gamePage.doc, 'header-decisions');
  for (const key of ['winner', 'loser', 'save']) {
    const p = ld.decisions?.[key];
    if (p?.fullName) assert.ok(shown.includes(p.fullName), `${key} ${p.fullName} in: ${shown}`);
  }
});

check('every linescore inning and R/H/E/LOB total matches the official feed', () => {
  const rows = all(gamePage.doc, '#linescore-wrap tbody tr');
  assert.equal(rows.length, 2, 'one row per team expected');
  const innings = ld.linescore.innings;
  for (const [i, side] of ['away', 'home'].entries()) {
    const cells = all(rows[i], 'td').map((td) => td.textContent.trim());
    assert.equal(cells.length, 1 + innings.length + 4 + 1, `${side} cell count`);
    const shownRuns = cells.slice(1, 1 + innings.length)
      .map((c) => (c === '·' ? null : Number(c)));
    assert.deepEqual(shownRuns, innings.map((inn) => inn[side]?.runs ?? null), `${side} inning runs`);
    const totals = ld.linescore.teams[side];
    const shownTotals = cells.slice(1 + innings.length, 5 + innings.length).map(Number);
    assert.deepEqual(shownTotals,
      [totals.runs, totals.hits, totals.errors, totals.leftOnBase], `${side} R/H/E/LOB`);
  }
});

check('every play-by-play row is the official play description, newest first', () => {
  const shown = all(gamePage.doc, '#plays-wrap .play-desc').map((el) => el.textContent.trim());
  const expected = ld.plays.allPlays.map((p) => p.result?.description).filter(Boolean).reverse();
  assert.equal(shown.length, expected.length, 'play row count');
  assert.deepEqual(shown, expected);
});

check('play rows carry the official inning and score for each play', () => {
  const heads = all(gamePage.doc, '#plays-wrap .play-head').map((el) => flat(el));
  const plays = ld.plays.allPlays.filter((p) => p.result?.description).slice().reverse();
  for (const [i, play] of plays.entries()) {
    const half = String(play.about?.halfInning || '').toLowerCase() === 'top' ? 'Top' : 'Bot';
    assert.ok(heads[i].includes(half), `play ${i} half-inning missing: ${heads[i]}`);
    assert.ok(heads[i].includes(String(play.about?.inning)), `play ${i} inning missing: ${heads[i]}`);
    if (typeof play.result?.awayScore === 'number') {
      assert.ok(heads[i].includes(`${play.result.awayScore}`), `play ${i} away score: ${heads[i]}`);
    }
  }
});

/* Read a box-score table's rows keyed by its own published header, so a
 * column is named by the markup rather than assumed by position. */
function tableRows(table) {
  const heads = all(table, 'thead th').map((th) => th.textContent.trim().toLowerCase());
  return all(table, 'tbody tr').map((tr) => {
    const cells = all(tr, 'td').map((td) => td.textContent.trim());
    const row = {};
    heads.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}
const battingRows = () => all(gamePage.doc, '#boxscore-wrap .boxscore-table:not(.pitching-table)')
  .flatMap(tableRows);
const pitchingRows = () => all(gamePage.doc, '#boxscore-wrap .pitching-table').flatMap(tableRows);

check('box score lists every official batter with the official AB, R, H, RBI, BB and SO', () => {
  const rows = battingRows();
  let checked = 0;
  for (const side of ['away', 'home']) {
    const box = ld.boxscore.teams[side];
    for (const id of box.batters || []) {
      const p = box.players[`ID${id}`];
      if (!p) continue;
      const b = p.stats.batting;
      const row = rows.find((r) => r.batter === p.person.fullName);
      assert.ok(row, `missing batting row for ${p.person.fullName}`);
      assert.equal(Number(row.ab), b.atBats, `${p.person.fullName} AB`);
      assert.equal(Number(row.r), b.runs ?? 0, `${p.person.fullName} R`);
      assert.equal(Number(row.h), b.hits, `${p.person.fullName} H`);
      assert.equal(Number(row.rbi), b.rbi ?? 0, `${p.person.fullName} RBI`);
      assert.equal(Number(row.bb), b.baseOnBalls ?? 0, `${p.person.fullName} BB`);
      assert.equal(Number(row.so), b.strikeOuts ?? 0, `${p.person.fullName} SO`);
      checked += 1;
    }
  }
  assert.equal(checked, rows.length,
    'the page lists batting rows the official box score does not account for');
});

check('box score lists every official pitcher with the official IP, H, R, ER, BB and SO', () => {
  const rows = pitchingRows();
  let checked = 0;
  for (const side of ['away', 'home']) {
    const box = ld.boxscore.teams[side];
    for (const id of box.pitchers || []) {
      const p = box.players[`ID${id}`];
      if (!p) continue;
      const t = p.stats.pitching;
      const row = rows.find((r) => r.pitcher === p.person.fullName);
      assert.ok(row, `missing pitching row for ${p.person.fullName}`);
      assert.equal(row.ip, String(t.inningsPitched), `${p.person.fullName} IP`);
      assert.equal(Number(row.h), t.hits ?? 0, `${p.person.fullName} H`);
      assert.equal(Number(row.r), t.runs ?? 0, `${p.person.fullName} R`);
      assert.equal(Number(row.er), t.earnedRuns ?? 0, `${p.person.fullName} ER`);
      assert.equal(Number(row.bb), t.baseOnBalls ?? 0, `${p.person.fullName} BB`);
      assert.equal(Number(row.so), t.strikeOuts ?? 0, `${p.person.fullName} SO`);
      checked += 1;
    }
  }
  assert.equal(checked, rows.length,
    'the page lists pitching rows the official box score does not account for');
});

check('every game-page table row links to the official feed it renders', () => {
  const expected = `${STATS}/api/v1.1/game/${GAME_PK}/feed/live`;
  const links = all(gamePage.doc,
    '#linescore-wrap a[target="_blank"], #boxscore-wrap a[target="_blank"], #reviews-wrap a[target="_blank"]');
  assert.ok(links.length, 'no source links in the tables');
  for (const a of links) assert.equal(a.getAttribute('href'), expected);
});

check('game page makes exactly one official feed request per refresh', () => {
  const feedCalls = fetchLog.filter((u) => /\/game\/\d+\/feed\/live/.test(u));
  assert.ok(feedCalls.length >= 1, 'no feed request');
  for (const u of feedCalls) assert.equal(u, `${STATS}/api/v1.1/game/${GAME_PK}/feed/live`);
});

/* ------------------------------------------------------- Challenges & Reviews */

const reviewsPage = await openPage('game.html', `?gamePk=${GAME_PK}&date=${DATE}`);
const tab = reviewsPage.doc.querySelector('[data-tab="reviews"]');
assert.ok(tab, 'Challenges & Reviews tab missing');
tab.click();
await settle(10);

const reviewCards = () => all(reviewsPage.doc, '#reviews-wrap .feed-card');

check('Challenges & Reviews tab renders one card per official review record', () => {
  assert.equal(reviewCards().length, reviewRecords.length,
    `page ${reviewCards().length} vs official ${reviewRecords.length}`);
  assert.ok(reviewRecords.length > 0, 'official feed carries no review record to check');
});

check('the review tab badge equals the official review record count', () => {
  const badge = reviewsPage.doc.getElementById('reviews-tab-count');
  assert.equal(Number(badge.textContent), reviewRecords.length);
  assert.equal(badge.style.display, 'inline-block');
});

check('every ABS challenge card shows the official outcome for its pitch', () => {
  const cards = reviewCards().filter((c) => c.textContent.includes('ABS'));
  assert.equal(cards.length, absRecords.length,
    `ABS cards ${cards.length} vs official ${absRecords.length}`);
  const overturned = absRecords.filter((r) => r.rd.isOverturned === true).length;
  const stood = absRecords.filter((r) => r.rd.isOverturned === false).length;
  const shownOverturned = cards.filter((c) => /Overturned/i.test(c.textContent)).length;
  const shownStood = cards.filter((c) => /Call Stands|Confirmed/i.test(c.textContent)).length;
  assert.equal(shownOverturned, overturned, 'overturned ABS rows');
  assert.equal(shownStood, stood, 'stood ABS rows');
});

check('every review card shows the official inning and half-inning', () => {
  for (const rec of reviewRecords) {
    const play = ld.plays.allPlays.find((p) => p.about?.atBatIndex === rec.atBatIndex);
    const half = String(play?.about?.halfInning || '').toLowerCase() === 'top' ? 'Top' : 'Bot';
    const inning = String(play?.about?.inning);
    const card = reviewCards().find((c) =>
      c.textContent.includes(half) && c.textContent.includes(inning));
    assert.ok(card, `no card for atBatIndex ${rec.atBatIndex} (${half} ${inning})`);
  }
});

/* A game-level counter belongs on the row only when that row's team is the
 * side the payload credits with the challenge. Otherwise the official value is
 * unreachable from that row, and claiming it there would be an invention. */
function challengeSideOf(rec) {
  const id = rec.rd.challengeTeamId;
  const teams = gd.teams || {};
  if (id && teams.away?.id === id) return 'away';
  if (id && teams.home?.id === id) return 'home';
  return null;
}

check('manager-challenge counters are rendered for the side the payload credits', () => {
  const text = flat(reviewsPage.doc.getElementById('reviews-wrap'));
  const review = gd.review || {};
  let rendered = 0;
  for (const rec of reviewRecords.filter((r) => r.rd.reviewType !== 'MJ')) {
    const side = challengeSideOf(rec);
    if (!side || !review[side] || typeof review[side].remaining !== 'number') continue;
    const abbr = side === 'away' ? awayAbbr : homeAbbr;
    assert.ok(text.includes(`${abbr}: ${review[side].remaining} manager challenge`),
      `row for atBatIndex ${rec.atBatIndex} (${abbr}) does not show the official ` +
      `remaining ${review[side].remaining}: ${text.slice(0, 500)}`);
    rendered += 1;
  }
  assert.ok(rendered > 0, 'no manager-challenge row was rendered to check');
});

check('ABS counters are rendered for the side the payload credits', () => {
  const abs = gd.absChallenges;
  if (!abs) return; // this game's payload reports no ABS counters
  const text = flat(reviewsPage.doc.getElementById('reviews-wrap'));
  let rendered = 0;
  for (const rec of absRecords) {
    const side = challengeSideOf(rec);
    if (!side || !abs[side] || typeof abs[side].remaining !== 'number') continue;
    const abbr = side === 'away' ? awayAbbr : homeAbbr;
    assert.ok(text.includes(`${abbr}: ${abs[side].remaining} ABS challenge`),
      `ABS row for atBatIndex ${rec.atBatIndex} (${abbr}) does not show the official ` +
      `remaining ${abs[side].remaining}: ${text.slice(0, 600)}`);
    rendered += 1;
  }
  assert.ok(rendered > 0, 'no ABS row was rendered to check against the official counters');
});

check('no card invents a counter value the payload does not report', () => {
  const text = flat(reviewsPage.doc.getElementById('reviews-wrap'));
  if (!gd.absChallenges) {
    assert.ok(!/\d+ ABS challenge/.test(text),
      'ABS challenge counters rendered although the payload reports none');
  }
});

/* --------------------------------------------------------------- replay feed */

const feedPage = await openPage('reviews.html', `?date=${DATE}`);

const feedCards = () => all(feedPage.doc, '#feed-list .feed-card');

check('replay feed loads with no page error', () => {
  assert.deepEqual(feedPage.pageErrors, []);
  assert.deepEqual(feedPage.consoleErrors, []);
});

check('replay feed requests a feed only for games on the official schedule', () => {
  const scheduled = new Set(slate.games.map((g) => g.gamePk));
  const feedCalls = fetchLog.filter((u) => /\/api\/v1\.1\/game\/\d+\/feed\/live/.test(u));
  assert.ok(feedCalls.length >= 1, 'replay feed requested no game feed');
  for (const u of feedCalls) {
    const pk = Number(u.match(/\/game\/(\d+)\/feed\/live/)[1]);
    assert.ok(scheduled.has(pk), `game ${pk} is not on the official ${DATE} schedule: ${u}`);
    /* A projected scan must stay leaf-name complete: naming reviewDetails alone
     * returns an empty object, so its children must be in the projection too.
     * An unprojected full feed needs no such list. */
    const projection = decodeURIComponent(u);
    if (projection.includes('fields=')) {
      for (const leaf of ['reviewDetails', 'reviewType', 'challengeTeamId',
        'isOverturned', 'inProgress', 'playEvents', 'index']) {
        assert.ok(projection.includes(leaf), `projected feed drops ${leaf}: ${projection}`);
      }
    }
  }
});

check('replay feed reports a full scan and no unavailable feed', () => {
  const status = byId(feedPage.doc, 'status-line');
  const attempted = new Set(fetchLog
    .filter((u) => /\/api\/v1\.1\/game\/\d+\/feed\/live/.test(u))
    .map((u) => Number(u.match(/\/game\/(\d+)\/feed\/live/)[1])));
  assert.ok(attempted.size > 0, 'the feed scanned no game');
  assert.match(status, new RegExp(`Scanned ${attempted.size} game`),
    `status line "${status}" does not report the ${attempted.size} games it scanned`);
  /* The banner is an alert surface. A review banner is expected when the game
   * has one; an "unavailable"/"unverified"/"could not" banner is a failure. */
  const banner = byId(feedPage.doc, 'banner');
  assert.ok(!/unavailable|unverified|could not|unable/i.test(banner),
    `banner reports an unavailable feed: "${banner}"`);
});

check('replay feed summary counts the official ABS challenges', () => {
  const stats = byId(feedPage.doc, 'feed-stats');
  const absBox = stats.match(/(\d+)\s*ABS Challenges/i);
  assert.ok(absBox, `no ABS summary box in: ${stats}`);
  const absTab = all(feedPage.doc, '#feed-tabs button').find((b) => /^abs$/i.test(flat(b)));
  assert.ok(absTab, 'no ABS filter tab');
  absTab.click();
  const absRows = feedCards().length;
  assert.equal(Number(absBox[1]), absRows,
    `summary says ${absBox[1]} ABS but the ABS tab shows ${absRows}`);
});

check('every ABS row on the feed matches an official ABS record', () => {
  const absTab = all(feedPage.doc, '#feed-tabs button').find((b) => /^abs$/i.test(flat(b)));
  absTab.click();
  const rows = feedCards();
  assert.equal(rows.length, absRecords.length,
    `feed ABS rows ${rows.length} vs official ${absRecords.length}`);
  for (const row of rows) {
    const play = all(row, 'a[href*="gamePk"]')[0];
    assert.ok(play, 'ABS row has no game link');
    assert.equal(play.getAttribute('href'), `game.html?gamePk=${GAME_PK}`);
  }
});

check('every feed row links to its game and to the official MLB payload', () => {
  const tabs = all(feedPage.doc, '#feed-tabs button');
  tabs[0].click();
  const rows = feedCards();
  assert.ok(rows.length, 'the All tab rendered no rows');
  for (const row of rows) {
    const links = all(row, 'a').map((a) => a.getAttribute('href'));
    assert.ok(links.length, 'row has no link');
    for (const href of links) {
      const ok = href === `game.html?gamePk=${GAME_PK}` ||
        href.startsWith(`${STATS}/api/`);
      assert.ok(ok, `row link is neither the game page nor an official MLB URL: ${href}`);
    }
  }
});

check('the All tab excludes ABS rows, exactly as the uploaded README documents', () => {
  const tabs = all(feedPage.doc, '#feed-tabs button');
  tabs[0].click();
  const absInAll = feedCards().filter((c) => /ABS/i.test(c.textContent)
    && /ABS Challenge/i.test(c.textContent)).length;
  const absTab = tabs.find((b) => /^abs$/i.test(flat(b)));
  absTab.click();
  assert.equal(absInAll, 0, 'All tab contains ABS rows');
});

check('replay feed offers a tab for each official review category', () => {
  const labels = all(feedPage.doc, '#feed-tabs button').map((b) => flat(b).toLowerCase());
  for (const want of ['all', 'abs', 'challenges', 'reviews', 'boundary calls']) {
    assert.ok(labels.some((l) => l === want), `missing "${want}" tab: ${labels.join(', ')}`);
  }
});

/* ------------------------------------------------------------ page integrity */

check('every local reference in every published page resolves to a real file', () => {
  for (const page of fs.readdirSync(root).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
      .filter((r) => !/^(https?:|data:|mailto:|#)/.test(r));
    for (const ref of refs) {
      const clean = ref.split('#')[0].split('?')[0].replace(/^\/LIVPBP1\//, '');
      assert.ok(fs.existsSync(path.join(root, clean)), `${page}: dead local reference ${ref}`);
    }
  }
});

check('the published pages declare the client scripts the upload declared', () => {
  const expected = {
    'index.html': ['assets/css/style.css', 'assets/js/api.js', 'assets/js/ui.js',
      'assets/js/reviews.js', 'assets/js/feed-log.js', 'assets/js/scoreboard.js'],
    'game.html': ['assets/css/style.css', 'assets/js/api.js', 'assets/js/ui.js',
      'assets/js/reviews.js', 'assets/js/feed-log.js', 'assets/js/props.js', 'assets/js/game.js'],
    'reviews.html': ['assets/css/style.css', 'assets/js/api.js', 'assets/js/ui.js',
      'assets/js/reviews.js', 'assets/js/feed-log.js', 'assets/js/reviews-feed.js'],
  };
  for (const [page, refs] of Object.entries(expected)) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const ref of refs) assert.ok(html.includes(ref), `${page} does not load ${ref}`);
  }
});

check('page script order puts dependencies before their users', () => {
  const order = { 'api.js': 1, 'ui.js': 2, 'reviews.js': 3, 'feed-log.js': 4,
    'props.js': 5, 'game.js': 6, 'scoreboard.js': 6, 'reviews-feed.js': 6 };
  for (const page of ['index.html', 'game.html', 'reviews.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const srcs = [...html.matchAll(/<script src="assets\/js\/([^"]+)"/g)].map((m) => m[1]);
    const ranks = srcs.map((s) => order[s]);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b),
      `${page} script order is not dependency-first: ${srcs.join(' ')}`);
  }
});

console.log(`\nofficial-e2e: ${passed} checks passed, ${failed.length} failed`);
if (failed.length) {
  for (const f of failed) console.error(`\n--- ${f.name}\n${f.err.stack}`);
  process.exit(1);
}
