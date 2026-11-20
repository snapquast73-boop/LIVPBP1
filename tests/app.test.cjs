// Synthetic fixtures test client behavior, not the accuracy of MLB results.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const app = fs.readFileSync('assets/app.js', 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup(page, fetch, query = '') {
  const dom = new JSDOM(fs.readFileSync(page, 'utf8'), {
    url: 'https://example.test/LIVPBP1/' + page + (query || '?date=2024-10-30'), runScripts: 'outside-only'
  });
  const timers = new Map();
  let seq = 0;
  dom.window.setTimeout = (fn, delay) => { timers.set(++seq, { fn, delay }); return seq; };
  dom.window.clearTimeout = id => timers.delete(id);
  dom.window.fetch = fetch;
  dom.window.eval(app);
  return { window: dom.window, doc: dom.window.document, timers };
}
const ok = data => Promise.resolve({ ok: true, json: async () => data });
const schedule = { dates: [{ date: '2024-10-30', games: [{ gamePk: 123, teams: { away: { team: { name: '<script>test</script>' }, score: 0 }, home: { team: { name: 'Home' } } }, status: { detailedState: 'Final' } }] }] };

test('scoreboard preserves reported zero, leaves absent score blank, escapes text and links each row', async () => {
  const { doc, timers } = setup('index.html', () => ok(schedule));
  await settle();
  const row = doc.querySelector('#game-list article');
  assert.match(row.textContent, /<script>test<\/script> 0 at Home · Final/);
  assert.equal(row.querySelector('script'), null);
  assert.equal(row.querySelector('a').getAttribute('href'), 'game.html?gamePk=123&date=2024-10-30');
  assert.match(row.lastChild.href, /^https:\/\/statsapi.mlb.com\/api\/v1\/schedule/);
  assert.deepEqual([...timers.values()].map(t => t.delay), [30000]);
});

test('date navigation aborts previous requests and prevents stale results and extra polling', async () => {
  const pending = [];
  const { window, doc, timers } = setup('index.html', (url, options) => new Promise(resolve => pending.push({ resolve, ...options })));
  window.Scoreboard.nextDay();
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ ok: true, json: async () => ({ dates: [] }) });
  await settle();
  pending[0].resolve({ ok: true, json: async () => schedule });
  await settle();
  assert.equal(doc.querySelector('#game-list').textContent, 'No games scheduled.');
  assert.equal([...timers.values()].filter(t => t.delay === 30000).length, 1);
});

test('failed date load does not display previous date results under new date', async () => {
  let count = 0;
  const { window, doc } = setup('index.html', () => ++count === 1 ? ok(schedule) : Promise.reject(Error('offline')));
  await settle();
  window.Scoreboard.nextDay();
  await settle();
  assert.equal(doc.querySelector('#game-list').children.length, 0);
  assert.match(doc.querySelector('#banner').textContent, /offline/);
});

test('stalled request times out and schedules retry', async () => {
  const { doc, timers } = setup('index.html', (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('request aborted')))));
  [...timers.values()].find(t => t.delay === 15000).fn();
  await settle();
  assert.match(doc.querySelector('#banner').textContent, /Unable to update/);
  assert.equal([...timers.values()].filter(t => t.delay === 30000).length, 1);
});

test('game view renders sourced rows, blank missing values, and working tabs', async () => {
  const fixture = { gameData: { teams: { away: { name: 'Away' }, home: { name: 'Home' } }, status: { detailedState: 'Final' } }, liveData: { linescore: { innings: [{ num: 1, away: { runs: 0 }, home: {} }] }, plays: { allPlays: [{ result: { description: 'A review occurred.' } }] }, boxscore: { teams: { home: { players: { one: { person: { fullName: 'Test player' }, stats: { batting: { atBats: 0 } } } } } } } } };
  const { doc } = setup('game.html', () => ok(fixture), '?gamePk=123');
  await settle();
  assert.equal(doc.querySelector('#linescore-wrap article').firstChild.textContent, 'Inning 1: 0 –  ');
  for (const row of doc.querySelectorAll('article')) assert.equal(row.lastChild.href, 'https://statsapi.mlb.com/api/v1.1/game/123/feed/live');
  assert.match(doc.querySelector('#header-meta a').href, /123\/feed\/live$/);
  doc.querySelector('[data-tab="boxscore"]').click();
  assert.equal(doc.querySelector('#panel-plays').style.display, 'none');
  assert.equal(doc.querySelector('#panel-boxscore').style.display, '');
});

test('replay feed distinguishes unavailable feeds from no reported reviews', async () => {
  let count = 0;
  const { doc } = setup('reviews.html', () => ++count === 1 ? ok(schedule) : Promise.reject(Error('offline')));
  await settle();
  assert.equal(doc.querySelector('#feed-list').textContent, 'No review entries loaded.');
  assert.equal(doc.querySelector('#banner').textContent, '1 game feeds unavailable.');
  assert.equal(doc.querySelector('#notify-toggle-btn').disabled, true);
});

test('invalid game link reports an error without requesting invented data', async () => {
  const { doc } = setup('game.html', () => { throw Error('must not request'); }, '?gamePk=invalid');
  await settle();
  assert.match(doc.querySelector('#banner').textContent, /Choose a game/);
});

test('official historical schedule and game render with exact source links', { skip: !process.env.OFFICIAL_MLB_CHECK }, async () => {
  const scheduleUrl = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=linescore';
  const response = await fetch(scheduleUrl, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.ok, true);
  const data = await response.json();
  const games = data.dates.flatMap(d => d.games);
  assert.ok(games.length > 0);
  const scoreboard = setup('index.html', () => ok(data));
  scoreboard.doc.querySelector('#date-picker').value = '2024-10-30';
  scoreboard.window.Scoreboard.pickDate();
  await settle();
  const rows = [...scoreboard.doc.querySelectorAll('#game-list article')];
  assert.equal(rows.length, games.length);
  games.forEach((g, i) => {
    assert.equal(rows[i].lastChild.href, scheduleUrl);
    for (const side of ['away', 'home']) {
      assert.ok(rows[i].textContent.includes(g.teams[side].team.name));
      assert.ok(rows[i].textContent.includes(String(g.teams[side].score)));
    }
  });
  const gameUrl = `https://statsapi.mlb.com/api/v1.1/game/${games[0].gamePk}/feed/live`;
  const gameResponse = await fetch(gameUrl, { signal: AbortSignal.timeout(20000) });
  assert.equal(gameResponse.ok, true);
  const game = await gameResponse.json();
  const view = setup('game.html', () => ok(game), '?gamePk=' + games[0].gamePk);
  await settle();
  const rendered = [...view.doc.querySelectorAll('#plays-wrap article')];
  const descriptions = game.liveData.plays.allPlays.slice().reverse().map(p => p.result?.description).filter(Boolean);
  assert.ok(descriptions.length > 0);
  assert.deepEqual(rendered.map(r => r.firstChild.textContent), descriptions.map(d => d + ' '));
  for (const row of view.doc.querySelectorAll('article')) assert.equal(row.lastChild.href, gameUrl);
  console.log('Official responses checked:', scheduleUrl, gameUrl);
});
