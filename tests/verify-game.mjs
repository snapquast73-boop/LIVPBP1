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
