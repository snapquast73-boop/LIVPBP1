// Compare actual Chrome-rendered game rows with an independently downloaded MLB feed.
// Every rendered table row must carry its Source link to the official feed, values must
// match the feed exactly, and blanks must stay blank (never zero-filled).
// Usage: node tests/verify-game.mjs <feed.json> <rendered.html> <gamePk>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const [json, html, gamePk] = process.argv.slice(2);
const { gamePk: reportedPk, gameData, liveData } = JSON.parse(readFileSync(json, 'utf8'));
assert.equal(String(reportedPk), gamePk, 'MLB did not return the requested game');
const source = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
const doc = new JSDOM(readFileSync(html, 'utf8')).window.document;

const txt = el => (el ? el.textContent : null);
const val = v => (v === null || v === undefined || v === '' ? '' : String(v));
const reported = v => v !== null && v !== undefined && v !== '';

// ---- game header (data values; markup is the client's own) ------------------
const teams = gameData.teams;
for (const side of ['away', 'home']) {
  assert.equal(txt(doc.querySelector(`#header-${side} .team-title`)), teams[side].name, `header-${side} team name`);
}
const ls = liveData.linescore || {};
const runs = s => (ls.teams && ls.teams[s] && typeof ls.teams[s].runs === 'number' ? String(ls.teams[s].runs) : '-');
assert.equal(txt(doc.querySelector('#header-center .header-score')), `${runs('away')} – ${runs('home')}`, 'header score');
assert.equal(txt(doc.querySelector('#header-center .muted')), gameData.status.detailedState ?? '', 'header status');

const d = liveData.decisions || {};
const parts = [];
if (d.winner && d.winner.fullName) parts.push('W: ' + d.winner.fullName);
if (d.loser && d.loser.fullName) parts.push('L: ' + d.loser.fullName);
if (d.save && d.save.fullName) parts.push('SV: ' + d.save.fullName);
assert.equal(txt(doc.getElementById('header-decisions')), parts.join(' · '), 'decisions line');

// ---- every table row: exact feed values + Source link to the official feed --
// `annotated` mirrors the client's Source cell rule: the annotation appears when
// any value attributed to that row is absent from the payload (never zero-filled).
function checkRow(row, expectedCells, annotated, label) {
  const cells = [...row.querySelectorAll('td')];
  assert.equal(cells.length, expectedCells.length + 1, `${label}: cell count (incl. Source)`);
  expectedCells.forEach((want, i) => {
    assert.equal(cells[i].textContent.trim(), want, `${label}: cell ${i + 1}`);
  });
  const link = cells[cells.length - 1].querySelector('a');
  assert.ok(link, `${label}: Source link present`);
  assert.equal(link.href, source, `${label}: Source link target`);
  assert.equal(cells[cells.length - 1].textContent.includes('blank = not in payload'),
    annotated, `${label}: blank annotation`);
}
const realRows = table => [...table.querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('td[colspan]'));

// linescore: Team | innings | R H E LOB | Source
const innings = ls.innings || [];
const lineWrap = doc.getElementById('linescore-wrap');
const lineRows = realRows(lineWrap.querySelector('table'));
assert.equal(lineRows.length, 2, 'linescore rows (away, home)');
['away', 'home'].forEach((side, i) => {
  const abbr = teams[side].abbreviation || (side === 'away' ? 'AWY' : 'HOM');
  const rawInnings = innings.map(inn => (inn[side] && typeof inn[side].runs === 'number' ? inn[side].runs : null));
  const perInning = rawInnings.map(r => (r === null ? '·' : String(r)));
  const t = ls.teams ? (ls.teams[side] || {}) : {};
  const rawTotals = [t.runs, t.hits, t.errors, t.leftOnBase];
  const totals = rawTotals.map(val);
  const annotated = rawInnings.some(r => r === null) || rawTotals.some(v => !reported(v));
  checkRow(lineRows[i], [abbr, ...perInning, ...totals], annotated, `linescore ${side}`);
});

// boxscore: batting (battingOrder) and pitching lines for both teams
function battingOrderValue(p) {
  const n = Number(p.battingOrder);
  return Number.isFinite(n) ? n : 9999;
}
function battingExpected(side) {
  const team = liveData.boxscore.teams[side];
  return team.batters.map(id => team.players['ID' + id]).filter(Boolean)
    .sort((a, b) => battingOrderValue(a) - battingOrderValue(b))
    .map(p => {
      const s = (p.stats && p.stats.batting) || {};
      const order = Number(p.battingOrder);
      const slot = Number.isFinite(order) ? String(Math.round(order / 100)) : '';
      const stats = [s.atBats, s.runs, s.hits, s.rbi, s.baseOnBalls, s.strikeOuts];
      return { cells: [slot, p.person.fullName, val(p.position && p.position.abbreviation), ...stats.map(val)],
        annotated: stats.some(v => !reported(v)) };
    });
}
function pitchingExpected(side) {
  const team = liveData.boxscore.teams[side];
  return team.pitchers.map(id => team.players['ID' + id]).filter(Boolean)
    .map(p => {
      const s = (p.stats && p.stats.pitching) || {};
      const stats = [s.inningsPitched, s.hits, s.runs, s.earnedRuns, s.baseOnBalls, s.strikeOuts];
      return { cells: ['', p.person.fullName, val((p.position && p.position.abbreviation) || 'P'), ...stats.map(val)],
        annotated: stats.some(v => !reported(v)) };
    });
}
const boxTables = [...doc.querySelectorAll('#boxscore-wrap table')];
assert.equal(boxTables.length, 4, 'boxscore tables (batting+pitching × away+home)');
let checked = 0;
['away', 'home'].forEach((side, si) => {
  for (const [kind, exp] of [['batting', battingExpected(side)], ['pitching', pitchingExpected(side)]]) {
    const table = boxTables[si * 2 + (kind === 'pitching' ? 1 : 0)];
    const rows = realRows(table);
    assert.equal(rows.length, exp.length, `${side} ${kind} rows`);
    rows.forEach((tr, i) => checkRow(tr, exp[i].cells, exp[i].annotated, `${side} ${kind} ${i + 1}`));
    checked += rows.length;
  }
});

// play-by-play: one row per play, newest first, description exactly as reported
const plays = liveData.plays.allPlays || [];
const playRows = [...doc.querySelectorAll('#plays-wrap .play-item')];
assert.equal(playRows.length, plays.length, 'play rows');
playRows.forEach((row, i) => {
  const play = plays[plays.length - 1 - i];
  assert.equal(txt(row.querySelector('.play-desc')), play.result.description || 'In progress…', `play ${i + 1} description`);
});

// ---- review cards: one per official review record (order is the client's) --
function records(feed) {
  const out = [];
  for (const play of feed.liveData.plays.allPlays) {
    const seen = new Set();
    const push = (rd, scope, playIndex) => {
      if (!rd || typeof rd !== 'object') return;
      const key = [rd.reviewType || '', scope, playIndex, rd.inProgress === true ? 'in' : 'done'].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ rd, play });
    };
    if (play.reviewDetails) push(play.reviewDetails, 'play', null);
    for (const ev of play.playEvents || []) {
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
const expReviews = records({ liveData });
const reviewRows = [...doc.querySelectorAll('#reviews-wrap .feed-card')];
assert.equal(reviewRows.length, expReviews.length, 'review cards');
const used = new Set();
expReviews.forEach(({ rd, play }, i) => {
  const body = (play.result.description || rd.reason || '').slice(0, 40);
  const match = reviewRows.findIndex((row, j) => {
    if (used.has(j)) return false;
    const text = row.textContent;
    return text.includes(outcome(rd)) && (!body || text.includes(body));
  });
  assert.notEqual(match, -1, `review ${i + 1}: row with outcome "${outcome(rd)}" and body "${body}"`);
  used.add(match);
});

console.log(`Verified game ${gamePk} against ${source}`);
console.log(`  header + 2 linescore rows + ${checked} box rows + ${playRows.length} plays + ${reviewRows.length} reviews; every table row links ${source}`);
