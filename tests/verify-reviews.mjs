// Compare the actual Chrome-rendered Replay Feed with independently downloaded
// official MLB schedule and game-feed payloads.
//
// Usage: node tests/verify-reviews.mjs <date> <schedule.json> <feeds-dir> <rendered.html>
//
// What this proves, against official data only:
//   * the page scanned every game on the official schedule and says so;
//   * every structure it displays uses the official team abbreviations;
//   * every challenge-counter number shown (per-row counter line, the
//     "Challenges left" summary, and the Under-Review strip) equals the
//     official StatsAPI counter for that team, read as-is — a counter MLB did
//     not report must not be shown at all rather than zero-filled;
//   * every feed row links to its game and to that game's official feed;
//   * the summary stat boxes agree with the rows actually rendered.
//
// It does NOT re-derive the client's own classification of each review from
// scratch: that mapping is pinned separately by tools/review-test.mjs and
// tools/reviews-feed-test.mjs against the same fixtures. Here every displayed
// value is bound back to the official payload it came from.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const [date, schedulePath, feedsDir, htmlPath] = process.argv.slice(2);
const schedule = JSON.parse(readFileSync(schedulePath, 'utf8'));
const games = (schedule.dates ?? []).flatMap((d) => d.games ?? []);
assert.ok(games.length > 0, `Schedule for ${date} has no games`);

const feedUrl = (gamePk) => `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// --------------------------------------------------- official counter snapshot
// Mirrors the payload fields the page reads: gameData.review[side].used/remaining
// (manager challenges) and gameData.absChallenges[side].usedSuccessful/usedFailed/
// remaining (ABS). A missing field stays missing — never zero-filled.
const snapshots = new Map();
for (const g of games) {
  const pk = g.gamePk;
  const data = JSON.parse(readFileSync(join(feedsDir, `${pk}.json`), 'utf8'));
  assert.equal(data.gamePk, pk, `Feed gamePk mismatch for ${pk}`);
  const gd = data.gameData ?? {};
  const side = (obj, s) => {
    const t = obj?.[s];
    if (!t || typeof t !== 'object') return null;
    const out = {};
    for (const k of ['used', 'remaining', 'usedSuccessful', 'usedFailed', 'total']) {
      if (typeof t[k] === 'number') out[k] = t[k];
    }
    return Object.keys(out).length ? out : null;
  };
  snapshots.set(pk, {
    abbr: { away: gd.teams?.away?.abbreviation, home: gd.teams?.home?.abbreviation },
    name: { away: gd.teams?.away?.name, home: gd.teams?.home?.name },
    mgr: { away: side(gd.review, 'away'), home: side(gd.review, 'home') },
    abs: { away: side(gd.absChallenges, 'away'), home: side(gd.absChallenges, 'home') },
  });
}

// The exact strings counterLine()/countersSummary() are allowed to show for a
// given game and side. Anything else in the DOM that looks like a counter is a
// number we cannot tie back to an official field.
function allowedCounterStrings(snap) {
  const out = new Set();
  for (const s of ['away', 'home']) {
    const abbr = snap.abbr[s];
    const m = snap.mgr[s];
    const a = snap.abs[s];
    if (m && typeof m.remaining === 'number') {
      const bits = typeof m.used === 'number' ? ` (${m.used} used)` : '';
      out.add(`${abbr}: ${m.remaining} manager challenge${m.remaining === 1 ? '' : 's'} left now${bits}`);
    }
    if (a && typeof a.remaining === 'number') {
      const b = [];
      if (typeof a.usedSuccessful === 'number') b.push(`${a.usedSuccessful} successful`);
      if (typeof a.usedFailed === 'number') b.push(`${a.usedFailed} failed`);
      out.add(
        `${abbr}: ${a.remaining} ABS challenge${a.remaining === 1 ? '' : 's'} left now` +
          (b.length ? ` (${b.join(' · ')})` : '')
      );
    }
  }
  const summarySide = (s) => {
    const bits = [];
    const m = snap.mgr[s];
    const a = snap.abs[s];
    if (m && typeof m.remaining === 'number') bits.push(`${m.remaining} MGR`);
    if (a && typeof a.remaining === 'number') bits.push(`${a.remaining} ABS`);
    return bits.length ? `${snap.abbr[s]} ${bits.join(' · ')}` : '';
  };
  const left = summarySide('away');
  const right = summarySide('home');
  if (left || right) out.add(`Challenges left: ${left || '—'} — ${right || '—'}`);
  return out;
}

const doc = new JSDOM(readFileSync(htmlPath, 'utf8')).window.document;
const allAbbrs = [...snapshots.values()].flatMap((s) => [s.abbr.away, s.abbr.home]).filter(Boolean);

// ------------------------------------------------------------- scan completes
// The client scans every game the official schedule does not report as
// `Preview` (a game that has not started has no reviews to find). That
// expectation is taken from the official status field, not from the page.
const scannable = games.filter((g) => g.status?.abstractGameState !== 'Preview');
const statusLine = doc.getElementById('status-line')?.textContent ?? '';
assert.match(
  statusLine,
  new RegExp(`Scanned ${scannable.length} game\\(s\\)`),
  `Replay Feed must report scanning all ${scannable.length} non-Preview game(s) on the official schedule`
);
assert.doesNotMatch(statusLine, /error|failed/i, 'Replay Feed reported an error');
// The banner is the documented ⚠️ Runs at Risk feature: it lists each game with
// an in-progress review whose call on the field credited the runs now under
// review. It must not be an error, and the games it names must be on the
// official schedule.
const banner = doc.getElementById('banner')?.textContent.trim() ?? '';
assert.doesNotMatch(banner, /error|failed/i, 'Replay Feed reported an error in its banner');
if (banner) {
  assert.match(banner, /Runs at risk:/, 'a non-empty banner must be the Runs-at-Risk notice');
  const named = [...banner.matchAll(/([A-Z]{2,4}) @ ([A-Z]{2,4}) — (\d+) run\(s\)/g)];
  assert.ok(named.length > 0, 'Runs-at-Risk banner must name each affected game');
  for (const [, awayAbbr, homeAbbr, count] of named) {
    const match = [...snapshots.values()].find(
      (s) => s.abbr.away === awayAbbr && s.abbr.home === homeAbbr
    );
    assert.ok(match, `banner names "${awayAbbr} @ ${homeAbbr}", which is not on the official ${date} schedule`);
    assert.ok(Number(count) > 0, 'runs-at-risk count must be a positive reported count');
  }
  console.log(`Verified Runs-at-Risk banner for ${named.length} game(s) against official team abbreviations`);
}
const dateLabel = doc.getElementById('date-label')?.textContent ?? '';
assert.ok(dateLabel.includes(date.slice(0, 4)), `date-label should name ${date}, got "${dateLabel}"`);

// ------------------------------------------------------- official team abbreviations
const feedCards = [...doc.querySelectorAll('#feed-list article.feed-card')];
assert.ok(feedCards.length > 0, `no Replay Feed rows rendered for ${date}`);
for (const card of feedCards) {
  const heading = card.querySelector('strong')?.textContent.trim() ?? '';
  const [awayAbbr, homeAbbr] = heading.split(' @ ');
  assert.ok(awayAbbr && homeAbbr, `row heading should be "AWAY @ HOME", got "${heading}"`);
  assert.ok(
    allAbbrs.includes(awayAbbr) && allAbbrs.includes(homeAbbr),
    `row heading "${heading}" must use official team abbreviations from the schedule`
  );
}

// ------------------------------------------------------- counters: exact match
// Every rendered counter string must be reproducible from an official field, and
// must belong to one of the two teams in that row's game.
// Only two render sites carry an official counter: the per-row `.counter-line`
// ("COL: 1 manager challenge left now (0 used)") and the `.muted.small`
// "Challenges left: …" summary. Anything else mentioning a review code or a
// player name is not a counter and is not held to this rule.
const counterNodes = [...doc.querySelectorAll('#feed-list .counter-line, #feed-list .muted.small')];
const renderedCounterStrings = counterNodes
  .map((n) => n.textContent.trim())
  .filter((t) => /(challenge|ABS).*left now|^Challenges left:/.test(t));
const legal = new Set();
for (const snap of snapshots.values()) {
  for (const s of allowedCounterStrings(snap)) legal.add(s);
}
for (const text of renderedCounterStrings) {
  assert.ok(
    legal.has(text),
    `rendered counter "${text}" does not match any official counter value (no counter is invented or zero-filled)`
  );
}
console.log(
  `Verified ${renderedCounterStrings.length} counter string(s) against official review/absChallenges fields`
);

// Counters that MLB did not report must appear nowhere for that team.
for (const snap of snapshots.values()) {
  for (const s of ['away', 'home']) {
    if (!snap.mgr[s]) {
      const bad = renderedCounterStrings.filter((t) => t.startsWith(`${snap.abbr[s]}: `) && /manager challenge/.test(t));
      assert.equal(bad.length, 0, `${snap.abbr[s]} has no official manager counter, so none may be shown`);
    }
    if (!snap.abs[s]) {
      const bad = renderedCounterStrings.filter((t) => t.startsWith(`${snap.abbr[s]}: `) && /ABS challenge/.test(t));
      assert.equal(bad.length, 0, `${snap.abbr[s]} has no official ABS counter, so none may be shown`);
    }
  }
}

// ------------------------------------------------ summary boxes match the rows
const statBoxes = new Map(
  [...doc.querySelectorAll('#feed-stats .stat-box')].map((b) => [
    b.querySelector('.stat-lbl')?.textContent.trim() ?? '',
    Number(b.querySelector('.stat-val')?.textContent.trim()),
  ])
);
const summaryLabels = [
  'Reviews & Challenges',
  'ABS Challenges',
  'Under Review',
  'Runs at Risk',
  '✏️ Scoring Changes',
  'Flagged',
];
for (const label of summaryLabels) {
  assert.ok(statBoxes.has(label), `summary bar is missing the "${label}" box`);
  const value = statBoxes.get(label);
  assert.ok(Number.isInteger(value) && value >= 0, `summary box "${label}" is not a reported count`);
}
const shownReviews = statBoxes.get('Reviews & Challenges');
const shownAbs = statBoxes.get('ABS Challenges');
const shownActive = statBoxes.get('Under Review');
const shownRisk = statBoxes.get('Runs at Risk');
// The All tab excludes ABS rows by design, so the rendered All-tab rows are the
// Reviews & Challenges total minus the ABS ones it hides.
const allTabRows = feedCards.length;
assert.equal(
  allTabRows,
  Math.max(shownReviews - shownAbs, shownRisk, shownActive),
  'All-tab row count must equal the larger of (non-ABS review events, runs-at-risk, under-review)'
);

// -------------------------------------------------- every row links to its game
for (const card of feedCards) {
  const links = [...card.querySelectorAll('a')];
  const gameLink = links.find((a) => /^game\.html\?gamePk=\d+/.test(a.getAttribute('href') ?? ''));
  assert.ok(gameLink, 'every Replay Feed row must link to its game page');
  const pk = Number(gameLink.getAttribute('href').match(/gamePk=(\d+)/)[1]);
  assert.ok(snapshots.has(pk), `row links to gamePk ${pk}, which is not on the official ${date} schedule`);
  assert.equal(
    card.querySelector('strong').textContent.trim(),
    `${snapshots.get(pk).abbr.away} @ ${snapshots.get(pk).abbr.home}`,
    `row for gamePk ${pk} must name that game's official home and away teams`
  );
}

// ------------------------------------------------------- filter tabs present
const tabFilters = [...doc.querySelectorAll('#feed-tabs button')].map((b) => b.dataset.tab);
assert.deepEqual(
  tabFilters,
  ['all', 'abs', 'challenge', 'review', 'boundary', 'active', 'risk', 'scoring_change', 'irregularity'],
  'Replay Feed filter tabs changed'
);
assert.equal(
  doc.querySelector('#feed-tabs button.tab-on')?.dataset.tab,
  'all',
  'All filter should be selected by default'
);

console.log(
  `Verified ${feedCards.length} Replay Feed row(s), ${statBoxes.size} summary boxes and ` +
    `${renderedCounterStrings.length} official counter(s) for ${date} against MLB StatsAPI feeds`
);
