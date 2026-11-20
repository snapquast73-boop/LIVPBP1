// Synthetic fixtures test client behavior, not the accuracy of MLB results.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const app = fs.readFileSync('assets/app.js', 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
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

test('replay feed uses structured reviews rather than descriptions and leaves missing fields blank', async () => {
  const fixture = { gameData: {
    teams: { away: { name: 'Away' }, home: { name: 'Home' } },
    review: { away: { remaining: 0 } }
  }, liveData: { plays: { allPlays: [
    { result: { description: 'This description mentions a challenge but is not structured.' } },
    { atBatIndex: 0, reviewDetails: { reviewType: 'test', isOverturned: true, challengeTeamId: 7 }, playEvents: [
      { index: 0, reviewDetails: { reviewType: 'test', isOverturned: false, challengeTeamId: 7 }, details: { description: 'Called strike' } },
      { index: 1, reviewDetails: { reviewType: 'test' }, details: { description: 'Ball' } }
    ] }
  ] } } };
  const { doc } = setup('reviews.html', url => ok(url.includes('/schedule?') ? schedule : fixture));
  await settle();
  const rows = [...doc.querySelectorAll('#feed-list article')];
  assert.equal(rows.length, 3);
  assert.match(rows[0].textContent, /At-bat index: 0 · Event index: 1 · MLB type code: test · Challenging team ID:  · Overturned:  · MLB description: Ball · Missing fields: unverified/);
  assert.match(rows[1].textContent, /Event index: 0 .*Overturned: No · MLB description: Called strike/);
  assert.match(rows[2].textContent, /Play review .*Overturned: Yes · MLB description:/);
  const balances = [...doc.querySelectorAll('#feed-stats article')];
  assert.equal(balances.length, 1);
  assert.match(balances[0].textContent, /Away: Away · Replay remaining: 0 · ABS remaining:  · Missing fields: unverified/);
  for (const row of [...rows, ...balances]) assert.equal(row.lastChild.href, 'https://statsapi.mlb.com/api/v1.1/game/123/feed/live');
});

test('official game 822974: each replay and challenge balance matches the MLB source', { skip: !process.env.OFFICIAL_MLB_CHECK }, async () => {
  const date = '2026-06-01';
  const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore`;
  const gameUrl = 'https://statsapi.mlb.com/api/v1.1/game/822974/feed/live';
  const read = async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    assert.ok(response.ok, url);
    return response.json();
  };
  const [data, game] = await Promise.all([read(scheduleUrl), read(gameUrl)]);
  const selectedDay = data.dates.find(day => day.date === date);
  const selectedGame = selectedDay.games.find(g => g.gamePk === game.gamePk);
  assert.equal(`https://statsapi.mlb.com${selectedGame.link}`, gameUrl);
  // Check both views against separately enumerated records from the official feed.
  const expected = [
    [84, 3, 139, false], [81, 6, 116, true], [81, 4, 139, true],
    [79, 1, 116, false], [72, 4, 139, false], [51, null, 139, true], [22, 0, 116, true]
  ];
  const scoreboardDate = `?date=${date}`;
  const replay = setup('reviews.html', url => {
    if (url === scheduleUrl) return ok({ dates: [{ ...selectedDay, games: [selectedGame] }] });
    assert.equal(url, gameUrl);
    return ok(game);
  }, scoreboardDate);
  const singleGame = setup('game.html', (url) => {
    assert.equal(url, gameUrl);
    return ok(game);
  }, `${scoreboardDate}&gamePk=822974`);
  await settle();
  const { away, home } = game.gameData.teams;
  for (const [view, root, prefix] of [
    [replay, '#feed-list', `${away.name} at ${home.name} · `], [singleGame, '#reviews-wrap', '']
  ]) {
    const rows = [...view.doc.querySelectorAll(`${root} article`)];
    assert.equal(rows.length, expected.length);
    expected.forEach(([atBat, index, id, overturned], i) => {
      const play = game.liveData.plays.allPlays.find(p => p.atBatIndex === atBat);
      const event = play.playEvents.find(e => e.index === index);
      const source = index === null ? play : event;
      assert.deepEqual([source.reviewDetails.reviewType, source.reviewDetails.challengeTeamId, source.reviewDetails.isOverturned], ['MJ', id, overturned]);
      const location = index === null ? `Play review · At-bat index: ${atBat}` : `Event review · At-bat index: ${atBat} · Event index: ${index}`;
      const description = (index === null ? play.result.description : event.details.description) ?? '';
      assert.equal(rows[i].firstChild.textContent, `${prefix}${location} · MLB type code: MJ · Challenging team ID: ${id} · Overturned: ${overturned ? 'Yes' : 'No'} · MLB description: ${description} `);
      assert.equal(rows[i].lastChild.href, gameUrl);
    });
  }
  assert.equal(singleGame.doc.querySelector('#reviews-tab-count').textContent, '7');
  for (const [view, root] of [[replay, '#feed-stats'], [singleGame, '#live-review-banner-wrap']]) {
    const rows = [...view.doc.querySelectorAll(`${root} article`)];
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(r => r.firstChild.textContent), [
      'Away: Detroit Tigers · Replay remaining: 1 · ABS remaining: 1 ',
      'Home: Tampa Bay Rays · Replay remaining: 1 · ABS remaining: 0 '
    ]);
    for (const row of rows) assert.equal(row.lastChild.href, gameUrl);
  }
  console.log('Official replay and balances verified:', scheduleUrl, gameUrl);
});
