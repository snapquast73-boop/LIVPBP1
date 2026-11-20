// Compare actual Chrome-rendered game rows with an independently downloaded MLB feed.
// Usage: node tests/verify-game.mjs <feed.json> <rendered.html> <gamePk>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const [json, html, gamePk] = process.argv.slice(2);
const { gamePk: reportedPk, gameData, liveData } = JSON.parse(readFileSync(json));
assert.equal(String(reportedPk), gamePk, 'MLB did not return the requested game');
const source = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
const doc = new JSDOM(readFileSync(html, 'utf8')).window.document;
const value = id => doc.getElementById(id).textContent;
assert.equal(value('banner'), '', 'game did not finish loading');
assert.equal(doc.querySelector('#header-meta a')?.href, source);
for (const side of ['away', 'home']) {
  const name = gameData.teams[side].name;
  const runs = liveData.linescore.teams[side].runs;
  assert.equal(value('header-' + side), [name, runs].filter(x => x != null).join(' '));
}
assert.equal(value('header-center'), gameData.status.detailedState ?? '');
assert.equal(value('live-panel'), liveData.plays.currentPlay?.result?.description ?? '');

function checkRows(id, expected) {
  assert.ok(expected.length, `Historical feed lacks the ${id} sample`);
  const rows = [...doc.querySelectorAll(`#${id} article`)];
  assert.equal(rows.length, expected.length, `${id} row count`);
  rows.forEach((row, i) => {
    const links = row.querySelectorAll('a');
    assert.equal(links.length, 1, `${id} row ${i + 1} source count`);
    assert.equal(links[0].href, source, `${id} row ${i + 1} source`);
    links[0].remove();
    assert.equal(row.textContent.trimEnd(), expected[i].trimEnd(), `${id} row ${i + 1}`);
  });
  console.log(`Verified ${rows.length} ${id} rows against ${source}`);
}
checkRows('linescore-wrap', liveData.linescore.innings.map(inning =>
  `Inning ${inning.num ?? ''}: ${inning.away?.runs ?? ''} – ${inning.home?.runs ?? ''}`));
const batters = [];
for (const side of ['away', 'home']) {
  for (const player of Object.values(liveData.boxscore.teams[side].players)) {
    const stat = player.stats?.batting;
    if (stat?.atBats != null) batters.push(`${player.person?.fullName ?? ''} · AB ${stat.atBats} · H ${stat.hits ?? ''}`);
  }
}
checkRows('boxscore-wrap', batters);
checkRows('plays-wrap', liveData.plays.allPlays.map(p => p.result?.description).filter(Boolean).reverse());
