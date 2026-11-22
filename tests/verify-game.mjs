// Compare actual Chrome-rendered game rows with an independently downloaded official MLB feed.
//
// Usage: node tests/verify-game.mjs <feed.json> <rendered.html> <gamePk>
//
// The rendered page is the real published client (assets/js/*.js, loaded in the
// same <script> order as game.html). Every table row is matched cell by cell
// against the official StatsAPI `feed/live` payload, and every data row must
// carry exactly one source link pointing at that game's official feed URL.
// A value the payload does not contain must render blank — it is never filled in.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const [json, html, gamePk] = process.argv.slice(2);
const feed = JSON.parse(readFileSync(json, 'utf8'));
const { gameData, liveData } = feed;
assert.equal(String(feed.gamePk), gamePk, 'MLB did not return the requested game');

const source = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
const doc = new JSDOM(readFileSync(html, 'utf8')).window.document;

/** Payload value → exactly what the page must render for it (blank when absent). */
const cell = (value) => (value === null || value === undefined || value === '' ? '' : String(value));

// ---------------------------------------------------------------- page state
const statusLine = doc.getElementById('status-line')?.textContent ?? '';
assert.doesNotMatch(statusLine, /error|failed|timeout/i, 'game page reported an error');
assert.ok(doc.querySelector('#linescore-wrap table.linescore-table'), 'linescore table missing');

// ---------------------------------------------------------------- game header
assert.equal(
  doc.querySelector('#header-center .header-score')?.textContent.trim(),
  `${liveData.linescore.teams.away.runs ?? '-'} – ${liveData.linescore.teams.home.runs ?? '-'}`,
  'header score'
);
assert.equal(
  doc.querySelector('#header-center .muted')?.textContent.trim(),
  gameData.status.detailedState ?? '',
  'header game state'
);
for (const side of ['away', 'home']) {
  assert.equal(
    doc.querySelector(`#header-${side} .team-title`)?.textContent.trim(),
    gameData.teams[side].name,
    `header ${side} team name`
  );
  assert.equal(
    doc.querySelector(`#header-${side} .muted`)?.textContent.trim().split(' · ')[0],
    gameData.teams[side].abbreviation,
    `header ${side} abbreviation`
  );
}

// Every rendered row: official cells, plus one trailing MLB source link.
function checkTable(table, expected, label) {
  const rows = [...table.querySelectorAll('tbody tr')];
  assert.equal(rows.length, expected.length, `${label} row count`);
  rows.forEach((row, i) => {
    const cells = [...row.querySelectorAll('td')];
    const links = row.querySelectorAll('a');
    assert.equal(links.length, 1, `${label} row ${i + 1} source link count`);
    assert.equal(links[0].getAttribute('href'), source, `${label} row ${i + 1} source link`);
    assert.equal(cells.at(-1), links[0].closest('td'), `${label} row ${i + 1} source is last cell`);
    assert.deepEqual(
      cells.slice(0, -1).map((td) => td.textContent.trim()),
      expected[i],
      `${label} row ${i + 1} cells`
    );
  });
  console.log(`Verified ${rows.length} ${label} row(s) against ${source}`);
}

// ----------------------------------------------------------------- linescore
const innings = liveData.linescore.innings ?? [];
const linescoreRows = ['away', 'home'].map((side) => {
  const totals = liveData.linescore.teams[side];
  return [
    gameData.teams[side].abbreviation,
    ...innings.map((inning) => cell(inning[side]?.runs)),
    cell(totals.runs),
    cell(totals.hits),
    cell(totals.errors),
    cell(totals.leftOnBase),
  ];
});
checkTable(doc.querySelector('#linescore-wrap table.linescore-table'), linescoreRows, 'linescore');

// ----------------------------------------------------------------- boxscore
const BAT = ['atBats', 'runs', 'hits', 'rbi', 'baseOnBalls', 'strikeOuts'];
const PITCH = ['inningsPitched', 'hits', 'runs', 'earnedRuns', 'baseOnBalls', 'strikeOuts'];
// boxscoreTeam() emits, per side and in this order: batting table, pitching table.
const tables = [...doc.querySelectorAll('#boxscore-wrap table.boxscore-table')];
assert.equal(tables.length, 4, 'expected a batting and a pitching table for each team');

for (const [index, side] of ['away', 'home'].entries()) {
  const team = liveData.boxscore.teams[side];
  const players = team.players ?? {};

  const batting = (team.batters ?? [])
    .map((id) => players[`ID${id}`])
    .filter(Boolean)
    .sort((a, b) => Number(a.battingOrder ?? 9999) - Number(b.battingOrder ?? 9999))
    .map((p) => {
      const s = p.stats?.batting ?? {};
      const order = Number(p.battingOrder);
      return [
        Number.isFinite(order) ? String(Math.round(order / 100)) : '',
        p.person?.fullName ?? '',
        p.position?.abbreviation ?? '',
        ...BAT.map((key) => cell(s[key])),
      ];
    });
  if (batting.length) {
    checkTable(tables[index * 2], batting, `${side} batting`);
  } else {
    assert.match(
      tables[index * 2].textContent,
      /No batting lines yet\./,
      `${side} batting table must say no lines were reported`
    );
  }

  const pitching = (team.pitchers ?? [])
    .map((id) => players[`ID${id}`])
    .filter(Boolean)
    .map((p) => {
      const s = p.stats?.pitching ?? {};
      return [
        '',
        p.person?.fullName ?? '',
        p.position?.abbreviation ?? 'P',
        ...PITCH.map((key) => cell(s[key])),
      ];
    });
  if (pitching.length) {
    checkTable(tables[index * 2 + 1], pitching, `${side} pitching`);
  } else {
    assert.match(
      tables[index * 2 + 1].textContent,
      /No pitching lines yet\./,
      `${side} pitching table must say no lines were reported`
    );
  }
}

// ------------------------------------------------------------ play-by-play
// renderPlays() lists the official plays newest-first, one .play-item each.
const plays = [...doc.querySelectorAll('#plays-wrap .play-item')];
const officialPlays = (liveData.plays?.allPlays ?? []).slice().reverse();
assert.equal(plays.length, officialPlays.length, 'play-by-play row count');
plays.forEach((row, i) => {
  assert.equal(
    row.querySelector('.play-desc')?.textContent.trim(),
    (officialPlays[i].result?.description ?? 'In progress…').trim(),
    `play ${i + 1} description`
  );
});
console.log(`Verified ${plays.length} play-by-play row(s) against ${source}`);

// ------------------------------------------- challenges & reviews (tab panel)
// Mirror of the client's collectReviewDetails (assets/js/reviews.js): every
// non-empty official reviewDetails object — whole-play and pitch-level — with
// the same per-play dedup key. The tab renders exactly one card per record.
const officialReviewRecords = [];
for (const play of (liveData.plays?.allPlays ?? [])) {
  const seen = new Set();
  const push = (rd, scope, playIndex) => {
    if (!rd || typeof rd !== 'object') return;
    const key = `${rd.reviewType || ''}|${scope}|${playIndex}|` +
      `${rd.inProgress === true ? 'in' : 'done'}`;
    if (seen.has(key)) return;
    seen.add(key);
    officialReviewRecords.push({ rd, play });
  };
  if (play.reviewDetails) push(play.reviewDetails, 'play', null);
  for (const ev of (play.playEvents ?? [])) {
    if (!ev) continue;
    const idx = typeof ev.index === 'number' ? ev.index
      : (ev.details && typeof ev.details.playIndex === 'number') ? ev.details.playIndex : null;
    if (ev.reviewDetails) push(ev.reviewDetails, 'event', idx);
    if (ev.details && ev.details.reviewDetails) push(ev.details.reviewDetails, 'event', idx);
  }
}
const reviewCards = [...doc.querySelectorAll('#reviews-wrap .feed-card')];
assert.equal(
  reviewCards.length, officialReviewRecords.length,
  `Challenges & Reviews renders ${reviewCards.length} card(s) but the official feed has ` +
  `${officialReviewRecords.length} reviewDetails record(s)`
);
for (const [i, card] of reviewCards.entries()) {
  const links = [...card.querySelectorAll('a')];
  assert.equal(links.length, 1, `review card ${i + 1}: expected one source link, got ${links.length}`);
  assert.equal(links[0].getAttribute('href'), source,
    `review card ${i + 1}: source link must be the official feed`);
  assert.equal(links[0].getAttribute('target'), '_blank', `review card ${i + 1}: source link opens in a new tab`);
  assert.equal(links[0].textContent.trim(), 'MLB source', `review card ${i + 1}: source link label`);
}
for (const rec of officialReviewRecords) {
  const text = (rec.play.result?.description || rec.rd.reason || '').trim();
  if (!text) continue;
  assert.ok(reviewCards.some((c) => c.textContent.includes(text)),
    `no review card renders the official record text: ${text.slice(0, 80)}`);
}
console.log(`Verified ${reviewCards.length} challenges/reviews card(s) against ${source}`);

// ------------------------------------------------------------------ live panel
const currentPlay = doc.querySelector('#live-panel .atbat');
assert.ok(currentPlay, 'live panel missing');
const atBatName = liveData.plays?.currentPlay?.matchup?.batter?.fullName;
if (atBatName) {
  assert.ok(
    currentPlay.textContent.includes(atBatName),
    `live panel must name the current batter (${atBatName})`
  );
}

console.log(`Game ${gamePk} verified against ${source}`);
