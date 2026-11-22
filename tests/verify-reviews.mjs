// Compare actual Chrome-rendered Replay Feed rows, filter tabs and summary stats
// with independently downloaded official MLB schedule and game-feed JSON payloads.
// Every rendered row must match an official review record of its game — no inferred
// rows, no substituted values. The default All tab excludes ABS rows (uploaded
// README, verbatim), so ABS records are verified through the ABS Challenges stat.
// Usage: node tests/verify-reviews.mjs <date> <schedule.json> <feeds-dir> <rendered.html>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const [date, schedulePath, feedsDir, htmlPath] = process.argv.slice(2);
const schedule = JSON.parse(readFileSync(schedulePath, 'utf8'));
const games = (schedule.dates ?? []).flatMap(d => d.games ?? []);
assert.ok(games.length > 0, `Schedule for ${date} has no games`);
const doc = new JSDOM(readFileSync(htmlPath, 'utf8')).window.document;

// ---- expected entries, read straight from the official feeds ----------------
const OS_PENDING = new Set(['os_ruling_pending_primary', 'os_ruling_pending_prior']);
function reviewRecords(feed) {
  const out = [];
  for (const play of feed.liveData?.plays?.allPlays ?? []) {
    const seen = new Set();
    const push = (rd, scope, playIndex) => {
      if (!rd || typeof rd !== 'object') return;
      const key = [rd.reviewType || '', scope, playIndex, rd.inProgress === true ? 'in' : 'done'].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ rd, play });
    };
    if (play.reviewDetails) push(play.reviewDetails, 'play', null);
    for (const ev of play.playEvents ?? []) {
      if (!ev) continue;
      const idx = typeof ev.index === 'number' ? ev.index
        : (ev.details && typeof ev.details.playIndex === 'number' ? ev.details.playIndex : null);
      if (ev.reviewDetails) push(ev.reviewDetails, 'event', idx);
      if (ev.details && ev.details.reviewDetails) push(ev.details.reviewDetails, 'event', idx);
    }
  }
  return out;
}
function outcome(rd) {
  if (rd.inProgress === true) return 'Under Review';
  if (rd.isOverturned === true) return 'Overturned';
  if (rd.isOverturned === false) return 'Call Stands / Confirmed';
  return rd.inProgress === false ? 'Resolved' : 'Unknown';
}
const expected = []; // { gamePk, outcome, body, abs }
let gamesScanned = 0;
for (const game of games) {
  if (!game.status || game.status.abstractGameState === 'Preview') continue;
  gamesScanned += 1;
  const feed = JSON.parse(readFileSync(join(feedsDir, `${game.gamePk}.json`), 'utf8'));
  assert.equal(String(feed.gamePk), String(game.gamePk), `feed ${game.gamePk} identity`);
  for (const { rd, play } of reviewRecords(feed)) {
    expected.push({
      gamePk: String(game.gamePk),
      outcome: outcome(rd),
      body: (play.result?.description || rd.reason || '').slice(0, 40),
      abs: rd.reviewType === 'MJ' || rd.reviewType === 'NJ',
      inProgress: rd.inProgress === true,
    });
  }
  for (const play of feed.liveData?.plays?.allPlays ?? []) {
    for (const ev of play.playEvents ?? []) {
      const type = ev?.details?.eventType;
      if (type && OS_PENDING.has(type)) {
        expected.push({
          gamePk: String(game.gamePk),
          outcome: 'Pending',
          body: (ev.details.description || play.result?.description || '').slice(0, 40),
          abs: false,
          inProgress: true,
        });
      }
    }
  }
}
assert.ok(gamesScanned > 0, 'no scannable games');

// ---- rendered rows (default All tab: every category except ABS and Flagged) -
const rows = [...doc.querySelectorAll('#feed-list article.feed-card')];
const rowsByGame = new Map();
for (const row of rows) {
  const link = row.querySelector('a[href^="game.html?gamePk="]');
  assert.ok(link, 'every feed row links its game');
  const pk = new URL(link.href, 'https://x/').searchParams.get('gamePk');
  if (!rowsByGame.has(pk)) rowsByGame.set(pk, []);
  rowsByGame.get(pk).push(row);
}
const expectedAll = expected.filter(e => !e.abs);
const matchedByGame = new Map();
for (const entry of expectedAll) {
  const gameRows = rowsByGame.get(entry.gamePk) ?? [];
  const used = matchedByGame.get(entry.gamePk) ?? new Set();
  const match = gameRows.findIndex((row, j) => {
    if (used.has(j)) return false;
    const text = row.textContent;
    return text.includes(entry.outcome) && (!entry.body || text.includes(entry.body));
  });
  assert.notEqual(match, -1,
    `game ${entry.gamePk}: no row with outcome "${entry.outcome}" and body "${entry.body}"`);
  used.add(match);
  matchedByGame.set(entry.gamePk, used);
}
assert.equal(rows.length, expectedAll.length,
  `All-tab rows (${rows.length}) vs official non-ABS records (${expectedAll.length})`);
if (!expectedAll.length) {
  assert.ok(doc.querySelector('#feed-list .empty-state'), 'empty state when nothing tracked');
}

// ---- filter tabs and summary stats -----------------------------------------
const TABS = ['All', 'ABS', 'Challenges', 'Reviews', 'Boundary Calls', 'Under Review',
  '⚠️ Runs at Risk', '✏️ Scoring Changes', 'Flagged'];
const tabButtons = [...doc.querySelectorAll('#feed-tabs .tab-btn')];
assert.deepEqual(tabButtons.map(b => b.textContent), TABS, 'filter tabs');
assert.ok(tabButtons.some(b => b.classList.contains('tab-on')), 'a filter tab is active');

const stats = new Map([...doc.querySelectorAll('#feed-stats .stat-box')].map(box => [
  box.querySelector('.stat-lbl').textContent,
  box.querySelector('.stat-val').textContent,
]));
const count = { abs: expected.filter(e => e.abs).length };
assert.equal(stats.get('ABS Challenges'), String(count.abs), 'ABS Challenges stat vs official MJ/NJ records');
assert.equal(stats.get('Reviews & Challenges'),
  String(expected.filter(e => !e.abs).length), 'Reviews & Challenges stat');
assert.equal(stats.get('Under Review'),
  String(expected.filter(e => e.inProgress).length), 'Under Review stat');
for (const label of ['Runs at Risk', '✏️ Scoring Changes', 'Flagged']) {
  assert.ok(stats.has(label), `summary stat "${label}"`);
}
console.log(`Verified Replay Feed for ${date}: ${rows.length} All-tab rows and ${count.abs} ABS record(s) over ${gamesScanned} scanned game(s) match the official feeds; tabs 9/9.`);
