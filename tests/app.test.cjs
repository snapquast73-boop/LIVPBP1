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
  assert.equal(doc.querySelector('#banner').textContent, '1 game feed unavailable.');
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
  const replay = game.liveData.plays.allPlays.find(play => play.reviewDetails?.reviewType === 'MV');
  assert.ok(replay, 'archived game carries a structured non-ABS review');
  const review = [...view.doc.querySelectorAll('#reviews-wrap article')].find(row => row.textContent.includes('Replay review · MV'));
  assert.ok(review.textContent.includes(replay.result.description));
  assert.equal(review.lastChild.href, gameUrl);
  console.log('Official responses checked:', scheduleUrl, gameUrl);
});


test('replay filters use structured reviews, independent pitch challenges and pending codes', async () => {
  const fixture = {
    gamePk: 123,
    liveData: { plays: { allPlays: [{
      about: { atBatIndex: 0 },
      result: { description: 'Scoring is pending.', eventType: 'os_ruling_pending_primary' },
      reviewDetails: { reviewType: 'MV', inProgress: true },
      playEvents: [
        { details: { description: 'A non-review mentions a challenge.' } },
        { index: 1, details: { description: 'First pitch' }, reviewDetails: { reviewType: 'MJ', inProgress: false, isOverturned: true, challengeTeamId: 7 } },
        { details: { description: 'Second pitch' }, reviewDetails: { reviewType: 'MJ', inProgress: false } },
      ],
    }] } },
  };
  const requests = [];
  const { doc } = setup('reviews.html', url => { requests.push(url); return ok(url.includes('/schedule?') ? schedule : fixture); });
  await settle();
  const articles = () => [...doc.querySelectorAll('#feed-list article')];
  const select = filter => doc.querySelector(`[data-filter="${filter}"]`).click();
  assert.equal(articles().length, 4);
  assert.ok(articles().every(row => row.lastChild.href === 'https://statsapi.mlb.com/api/v1.1/game/123/feed/live'));
  select('abs');
  assert.deepEqual(articles().map(row => row.textContent.includes('unverified')), [true, false]);
  assert.match(articles()[1].textContent, /Overturned · First pitch/);
  select('pending');
  assert.equal(articles().length, 1);
  assert.match(articles()[0].textContent, /Official Scorer Ruling Pending/);
  select('active');
  assert.equal(articles().length, 1);
  assert.match(articles()[0].textContent, /MV · Under review/);
  assert.equal(doc.querySelector('[data-filter="active"]').getAttribute('aria-pressed'), 'true');
  assert.equal(requests.length, 2, 'filters do not rescan');
});

test('a mismatched game response suppresses totals without hiding good rows', async () => {
  const twoGames = { dates: [{ date: '2024-10-30', games: [{ gamePk: 123 }, { gamePk: 456 }] }] };
  const game = { gamePk: 123, liveData: { plays: { allPlays: [{ reviewDetails: { reviewType: 'MV' } }] } } };
  const { doc } = setup('reviews.html', url => ok(url.includes('/schedule?') ? twoGames : game));
  await settle();
  assert.equal(doc.querySelectorAll('#feed-list article').length, 1);
  assert.match(doc.querySelector('#feed-stats').textContent, /Totals unverified/);
  assert.match(doc.querySelector('#status-line').textContent, /Scanned 1\/2/);
});

test('game challenge counters use only reported values and flag missing fields', async () => {
  const fixture = { gameData: { review: { home: { used: 0 } } }, liveData: { plays: { allPlays: [] } } };
  const { doc } = setup('game.html', () => ok(fixture), '?gamePk=123');
  await settle();
  const rows = [...doc.querySelectorAll('#reviews-wrap article')];
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /home\) · used: 0 · remaining:  · Missing values unverified/);
  assert.equal(rows[0].lastChild.href, 'https://statsapi.mlb.com/api/v1.1/game/123/feed/live');
});

test('official day and feed contain the rendered ABS rows and reported counters', { skip: !process.env.OFFICIAL_MLB_CHECK }, async () => {
  const gamePk = 822974, day = '2026-06-01';
  const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${day}&hydrate=linescore`;
  const gameUrl = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
  const read = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.ok, true);
    return response.json();
  };
  const [sourceSchedule, sourceGame] = await Promise.all([read(scheduleUrl), read(gameUrl)]);
  const dayRecord = sourceSchedule.dates.find(d => d.date === day);
  const gameRecord = dayRecord.games.find(g => g.gamePk === gamePk);
  assert.ok(gameRecord);
  assert.equal(sourceGame.gamePk, gamePk);
  const expected = [];
  for (const play of [...sourceGame.liveData.plays.allPlays].reverse()) {
    if (play.reviewDetails?.reviewType === 'MJ') expected.push([play.reviewDetails, play.result]);
    for (const event of [...play.playEvents].reverse()) {
      if (event.reviewDetails?.reviewType === 'MJ') expected.push([event.reviewDetails, event.details]);
    }
  }
  assert.ok(expected.length > 1);
  const { doc } = setup('reviews.html', url => {
    assert.ok([scheduleUrl, gameUrl].includes(url));
    return ok(url === scheduleUrl ? { dates: [{ ...dayRecord, games: [gameRecord] }] } : sourceGame);
  }, `?date=${day}`);
  await settle();
  doc.querySelector('[data-filter="abs"]').click();
  const rows = [...doc.querySelectorAll('#feed-list article')];
  assert.equal(rows.length, expected.length);
  expected.forEach(([review, detail], i) => {
    assert.equal(rows[i].lastChild.href, gameUrl);
    assert.match(rows[i].textContent, /ABS challenge · MJ/);
    if (review.inProgress === false && typeof review.isOverturned === 'boolean')
      assert.ok(rows[i].textContent.includes(review.isOverturned ? ' · Overturned' : ' · Not overturned'));
    if (detail?.description) assert.ok(rows[i].textContent.includes(detail.description));
    assert.ok(rows[i].textContent.includes(`Challenging team ID: ${review.challengeTeamId}`));
  });
  const view = setup('game.html', () => ok(sourceGame), `?gamePk=${gamePk}`);
  await settle();
  const counters = [...view.doc.querySelectorAll('#reviews-wrap article')].slice(-4);
  const feedCounters = [...doc.querySelectorAll('#feed-stats details article')];
  assert.deepEqual(feedCounters.map(r => r.firstChild.textContent), counters.map(r => r.firstChild.textContent));
  assert.ok(feedCounters.every(r => r.lastChild.href === gameUrl));
  for (const [i, key] of ['review', 'absChallenges'].entries()) {
    for (const [j, side] of ['away', 'home'].entries()) {
      assert.equal(counters[i * 2 + j].lastChild.href, gameUrl);
      const fields = key === 'review' ? { used: 'used' } : { usedSuccessful: 'successful', usedFailed: 'unsuccessful' };
      for (const [field, label] of Object.entries({ ...fields, remaining: 'remaining' })) {
        assert.ok(counters[i * 2 + j].textContent.includes(`${label}: ${sourceGame.gameData[key][side][field]}`));
      }
    }
  }
  console.log('Official replay sources checked:', scheduleUrl, gameUrl);
});
