/* Compare a real Chrome render of the deployed game page with the official MLB
 * feed fetched separately in the same run.
 *
 *   node tests/verify-game.mjs <feed.json> <rendered-dom.html> <gamePk>
 *
 * Nothing here is typed in from memory: every expected string is read out of the
 * official feed JSON that was downloaded moments earlier, and every expected
 * value is looked for in the DOM that Chrome rendered from the public page.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const [jsonPath, htmlPath, gamePk] = process.argv.slice(2);
assert.ok(jsonPath && htmlPath && gamePk, 'usage: verify-game.mjs <feed.json> <dom.html> <gamePk>');

const feed = JSON.parse(readFileSync(jsonPath, 'utf8'));
assert.equal(String(feed.gamePk), String(gamePk), 'MLB did not return the requested game');

const source = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
const doc = new JSDOM(readFileSync(htmlPath, 'utf8')).window.document;
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
const id = (name) => text(doc.getElementById(name));

const gd = feed.gameData;
const ld = feed.liveData;

assert.equal(id('banner'), '', 'the game page did not finish loading');

/* header */
for (const side of ['away', 'home']) {
  const team = gd.teams[side];
  const runs = ld.linescore?.teams?.[side]?.runs;
  const header = id(`header-${side}`);
  assert.ok(header.includes(team.name), `${side} header missing ${team.name}: ${header}`);
  assert.ok(header.includes(team.abbreviation), `${side} header missing ${team.abbreviation}: ${header}`);
  if (typeof runs === 'number') {
    assert.ok(id('header-center').includes(String(runs)), `${side} runs ${runs} not in the header score`);
  }
}
assert.ok(id('header-center').includes(gd.status.detailedState), 'header missing the official status');

/* decisions */
const decisions = text(doc.getElementById('header-decisions'));
for (const key of ['winner', 'loser', 'save']) {
  const p = ld.decisions?.[key];
  if (p?.fullName) assert.ok(decisions.includes(p.fullName), `${key} ${p.fullName} not shown: ${decisions}`);
}

/* linescore: every inning cell and every R/H/E/LOB total */
const innings = ld.linescore?.innings ?? [];
const rows = [...doc.querySelectorAll('#linescore-wrap tbody tr')];
assert.equal(rows.length, 2, 'expected one linescore row per team');
for (const [i, side] of ['away', 'home'].entries()) {
  const cells = [...rows[i].querySelectorAll('td')].map((td) => text(td));
  const shown = cells.slice(1, 1 + innings.length).map((c) => (c === '·' ? null : Number(c)));
  assert.deepEqual(shown, innings.map((inn) => inn[side]?.runs ?? null), `${side} inning runs`);
  const totals = ld.linescore.teams[side];
  assert.deepEqual(
    cells.slice(1 + innings.length, 5 + innings.length).map(Number),
    [totals.runs, totals.hits, totals.errors, totals.leftOnBase],
    `${side} R/H/E/LOB`,
  );
}

/* play-by-play: every description, in the order the page renders it */
const plays = [...doc.querySelectorAll('#plays-wrap .play-desc')].map((el) => text(el));
const expected = (ld.plays?.allPlays ?? []).map((p) => p.result?.description).filter(Boolean).reverse();
assert.equal(plays.length, expected.length, 'play row count');
assert.deepEqual(plays, expected, 'play descriptions or their order differ from the official feed');

/* box score: every batter and pitcher line */
function tableRows(table) {
  const heads = [...table.querySelectorAll('thead th')].map((th) => text(th).toLowerCase());
  return [...table.querySelectorAll('tbody tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => text(td));
    const row = {};
    heads.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}
const batRows = [...doc.querySelectorAll('#boxscore-wrap .boxscore-table:not(.pitching-table)')]
  .flatMap(tableRows);
const pitRows = [...doc.querySelectorAll('#boxscore-wrap .pitching-table')].flatMap(tableRows);
for (const side of ['away', 'home']) {
  const box = ld.boxscore.teams[side];
  for (const pid of box.batters ?? []) {
    const p = box.players[`ID${pid}`];
    if (!p) continue;
    const row = batRows.find((r) => r.batter === p.person.fullName);
    assert.ok(row, `missing batting row for ${p.person.fullName}`);
    assert.equal(Number(row.ab), p.stats.batting.atBats, `${p.person.fullName} AB`);
    assert.equal(Number(row.h), p.stats.batting.hits, `${p.person.fullName} H`);
  }
  for (const pid of box.pitchers ?? []) {
    const p = box.players[`ID${pid}`];
    if (!p) continue;
    const row = pitRows.find((r) => r.pitcher === p.person.fullName);
    assert.ok(row, `missing pitching row for ${p.person.fullName}`);
    assert.equal(row.ip, String(p.stats.pitching.inningsPitched), `${p.person.fullName} IP`);
  }
}

/* every review record the official feed carries is on the page */
const records = [];
for (const play of ld.plays.allPlays ?? []) {
  if (play.reviewDetails) records.push(play.reviewDetails);
  for (const ev of play.playEvents ?? []) if (ev.reviewDetails) records.push(ev.reviewDetails);
}
const reviewCards = [...doc.querySelectorAll('#reviews-wrap .feed-card')];
assert.equal(reviewCards.length, records.length,
  `page shows ${reviewCards.length} review cards, the official feed carries ${records.length}`);
const absOfficial = records.filter((r) => r.reviewType === 'MJ').length;
if (absOfficial) {
  const absShown = reviewCards.filter((c) => /ABS/i.test(c.textContent)).length;
  assert.equal(absShown, absOfficial, `page shows ${absShown} ABS cards, official has ${absOfficial}`);
}

/* every table row that claims a source must point at the official feed */
const sourced = [...doc.querySelectorAll(
  '#linescore-wrap a[target="_blank"], #boxscore-wrap a[target="_blank"], #reviews-wrap a[target="_blank"]')];
assert.ok(sourced.length > 0, 'no rows carry an MLB source link');
for (const a of sourced) assert.equal(a.getAttribute('href'), source);

console.log(`Verified game ${gamePk}: header, ${innings.length} innings, ${plays.length} plays, ` +
  `${batRows.length} batting and ${pitRows.length} pitching lines, ${records.length} review records ` +
  `against ${source}`);
