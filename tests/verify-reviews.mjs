// Compare actual Chrome-rendered Replay Feed rows and challenge counters with
// independently downloaded official MLB schedule and game-feed JSON payloads.
// Usage: node tests/verify-reviews.mjs <date> <schedule.json> <feeds-dir> <rendered.html>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const [date, schedulePath, feedsDir, htmlPath] = process.argv.slice(2);
const schedule = JSON.parse(readFileSync(schedulePath, 'utf8'));
const games = (schedule.dates ?? []).flatMap(d => d.games ?? []);
assert.ok(games.length > 0, `Schedule for ${date} has no games`);

const reportedNumber = value => (Number.isSafeInteger(value) && value >= 0 ? value : '');
const reportedText = value => (typeof value === 'string' ? value : '');
const pendingCodes = new Set(['os_ruling_pending_primary', 'os_ruling_pending_prior']);

function expectedFromFeed(data, gamePk) {
  const source = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
  const entries = [];
  const teams = data.gameData?.teams;
  const plays = data.liveData?.plays?.allPlays ?? [];
  for (const p of plays.slice().reverse()) {
    const seen = new Set();
    const context = [teams?.away?.name, teams?.home?.name].filter(Boolean).join(' at ');
    const inning = [p.about?.halfInning, p.about?.inning].filter(x => x != null).join(' ');
    const atBat = reportedNumber(p.about?.atBatIndex);
    const add = (details, info, event) => {
      for (const d of Array.isArray(details) ? details : [details]) {
        if (!d || typeof d !== 'object' || !Object.keys(d).length) continue;
        if (d.id != null) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
        }
        const code = reportedText(d.reviewType);
        const kind = code === 'MJ' ? 'abs' : 'replay';
        const active = d.inProgress === true;
        const outcome = active
          ? 'Under review'
          : d.inProgress === false
            ? d.isOverturned === true
              ? 'Overturned'
              : d.isOverturned === false
                ? 'Not overturned'
                : ''
            : '';
        const team = reportedNumber(d.challengeTeamId);
        const index = reportedNumber(event?.index);
        const description = reportedText(info?.description);
        const location = `At-bat index: ${atBat}${event ? ` · Event index: ${index}` : ''} · Challenging team ID: ${team}`;
        const missing = !outcome || !description || !code || atBat === '' || team === '' || (event && index === '');
        const label = { replay: 'Replay review', abs: 'ABS challenge', pending: 'Official Scorer Ruling Pending' }[kind];
        const text = [
          context,
          inning,
          label,
          code,
          outcome,
          description,
          location,
          missing ? 'Some fields unverified or not reported' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        entries.push({ text, gamePk, source, kind, active });
      }
      if (pendingCodes.has(info?.eventType)) {
        const missing = !info.description;
        const text = [
          context,
          inning,
          'Official Scorer Ruling Pending',
          info.eventType,
          info.description,
          missing ? 'Some fields unverified or not reported' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        entries.push({ text, gamePk, source, kind: 'pending', active: false });
      }
    };
    add(p.reviewDetails, p.result);
    for (const event of (p.playEvents ?? []).slice().reverse()) {
      add(event.reviewDetails, event.details, event);
    }
  }

  const balances = [];
  for (const [key, label, fields] of [
    ['review', 'Replay challenge counters', [['used', 'used'], ['remaining', 'remaining']]],
    [
      'absChallenges',
      'ABS challenge counters',
      [['usedSuccessful', 'successful'], ['usedFailed', 'unsuccessful'], ['remaining', 'remaining']],
    ],
  ]) {
    for (const side of ['away', 'home']) {
      const values = data.gameData?.[key]?.[side];
      const present = ([field]) => Number.isSafeInteger(values?.[field]) && values[field] >= 0;
      if (!fields.some(present)) continue;
      const counters = fields.map(([field, caption]) => `${caption}: ${present([field]) ? values[field] : ''}`).join(' · ');
      const name = reportedText(data.gameData?.teams?.[side]?.name);
      const text = `${label} (${side})${name ? ` · ${name}` : ''} · ${counters}${fields.every(present) ? '' : ' · Missing values unverified'}`;
      balances.push({ text, gamePk, source });
    }
  }

  return { entries, balances };
}

const expectedEntries = [];
const expectedBalances = [];
for (const g of games) {
  const pk = g.gamePk;
  const feedData = JSON.parse(readFileSync(join(feedsDir, `${pk}.json`), 'utf8'));
  assert.equal(feedData.gamePk, pk, `Feed gamePk mismatch for ${pk}`);
  const { entries, balances } = expectedFromFeed(feedData, pk);
  expectedEntries.push(...entries);
  expectedBalances.push(...balances);
}

const doc = new JSDOM(readFileSync(htmlPath, 'utf8')).window.document;
assert.equal(doc.getElementById('banner')?.textContent ?? '', '', 'Replay feed banner should be empty after clean scan');
assert.equal(doc.getElementById('date-label')?.textContent ?? '', date, 'Replay feed date-label mismatch');
assert.match(
  doc.getElementById('status-line')?.textContent ?? '',
  new RegExp(`Scanned ${games.length}/${games.length} games`),
  'Replay feed status-line did not confirm full scan'
);

const tabButtons = [...doc.querySelectorAll('#feed-tabs button')];
assert.deepEqual(
  tabButtons.map(b => b.dataset.filter),
  ['all', 'replay', 'abs', 'pending', 'active'],
  'Replay feed filter tabs mismatch'
);
assert.equal(tabButtons[0].getAttribute('aria-pressed'), 'true', 'All filter tab should be pressed by default');

function verifyArticles(nodes, expected, sectionName) {
  assert.equal(nodes.length, expected.length, `${sectionName} row count mismatch`);
  nodes.forEach((node, i) => {
    const clone = node.cloneNode(true);
    const links = [...clone.querySelectorAll('a')];
    assert.equal(links.length, 2, `${sectionName} row ${i + 1} link count`);
    assert.equal(
      links[0].getAttribute('href'),
      `game.html?gamePk=${expected[i].gamePk}&date=${date}`,
      `${sectionName} row ${i + 1} game details link`
    );
    assert.equal(links[1].getAttribute('href'), expected[i].source, `${sectionName} row ${i + 1} MLB source link`);
    links.forEach(a => a.remove());
    assert.equal(clone.textContent.trimEnd(), expected[i].text.trimEnd(), `${sectionName} row ${i + 1} text`);
  });
}

const renderedRows = [...doc.querySelectorAll('#feed-list article')];
verifyArticles(renderedRows, expectedEntries, 'feed-list');

const renderedBalances = [...doc.querySelectorAll('#feed-stats details article')];
verifyArticles(renderedBalances, expectedBalances, 'feed-stats-balances');

console.log(
  `Verified ${renderedRows.length} replay row(s) and ${renderedBalances.length} challenge-counter row(s) for ${date}`
);
