/* Self-test for the acceptance verifiers: render each page in jsdom against the
 * recorded official fixtures (tools/fixtures/), then run tests/verify_schedule.py,
 * tests/verify-game.mjs and tests/verify-reviews.mjs on the dumps — exactly as the
 * CI workflows run them on headless-Chrome dumps. Network-free and deterministic.
 *
 *   node tests/selftest-verify.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'tools', 'fixtures');
const schedule = JSON.parse(fs.readFileSync(path.join(FIX, 'schedule-2026-06-01.json'), 'utf8'));
const gameStatus = JSON.parse(fs.readFileSync(path.join(FIX, 'game-status.json'), 'utf8'));
const feed = JSON.parse(fs.readFileSync(path.join(FIX, 'feed-824027.json'), 'utf8'));

function feedFor(gamePk) {
  const copy = JSON.parse(JSON.stringify(feed));
  if (String(gamePk) !== String(feed.gamePk)) {
    copy.gameData.game.pk = Number(gamePk);
    copy.gamePk = Number(gamePk);
  }
  return copy;
}
function jsonResponse(payload, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(payload),
  });
}
function makeFetch() {
  return (url) => {
    const target = String(url);
    if (target.includes('/api/v1/schedule')) return jsonResponse(schedule);
    if (target.includes('/gameStatus')) return jsonResponse(gameStatus);
    if (target.includes('/eventTypes')) return jsonResponse([]);
    if (target.includes('/feed/live')) {
      const m = target.match(/\/game\/(\d+)\/feed\/live/);
      return jsonResponse(feedFor(m ? m[1] : feed.gamePk));
    }
    if (target.includes('/playByPlay')) return jsonResponse({ allPlays: feed.liveData.plays.allPlays });
    if (target.includes('/people/') && target.includes('stats=')) return jsonResponse({ stats: [] });
    if (target.includes('/api/feed-log')) return Promise.reject(new Error('static hosting'));
    return jsonResponse({}, 404);
  };
}

function waitFor(fn, timeoutMs = 8000) {
  const limit = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function tick() {
      let value;
      try { value = fn(); } catch (err) { value = false; }
      if (value) return resolve(value);
      if (Date.now() > limit) return reject(new Error('timeout waiting for render'));
      setTimeout(tick, 25);
    })();
  });
}

async function render(pageFile, query, until) {
  const html = fs.readFileSync(path.join(ROOT, pageFile), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://example.test/' + pageFile + query,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const win = dom.window;
  win.fetch = makeFetch();
  const errors = [];
  win.addEventListener('error', (ev) => errors.push(String(ev.message || ev.type)));
  win.console.error = (...args) => errors.push('console.error: ' + args.map(String).join(' '));
  for (const src of [...win.document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'))) {
    win.eval(fs.readFileSync(path.join(ROOT, src), 'utf8'));
  }
  win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));
  await waitFor(() => until(win.document));
  const dump = win.document.documentElement.outerHTML;
  win.close();
  assert.deepEqual(errors.filter((e) => !/feed-log|static hosting/i.test(e)), [], `no page errors on ${pageFile}`);
  return dump;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'livpbp1-selftest-'));
fs.mkdirSync(path.join(tmp, 'feeds'));
fs.writeFileSync(path.join(tmp, 'feeds', '824027.json'), JSON.stringify(feedFor(824027)));
fs.writeFileSync(path.join(tmp, 'feeds', '822974.json'), JSON.stringify(feedFor(822974)));

const dumps = {
  index: await render('index.html', '?date=2026-06-01', (d) => d.querySelectorAll('#game-list .game-card').length === 3),
  game: await render('game.html', '?gamePk=824027', (d) => d.querySelectorAll('#plays-wrap .play-item').length > 0),
  reviews: await render('reviews.html', '?date=2026-06-01', (d) => d.querySelectorAll('#feed-list article.feed-card').length > 0),
};
for (const [name, html] of Object.entries(dumps)) fs.writeFileSync(path.join(tmp, `${name}.html`), html);

const steps = [
  ['verify_schedule.py (scoreboard cards vs schedule)',
    'python3', [path.join(ROOT, 'tests', 'verify_schedule.py'), path.join(FIX, 'schedule-2026-06-01.json'), path.join(tmp, 'index.html')]],
  ['verify-game.mjs (game rows vs feed)',
    'node', [path.join(ROOT, 'tests', 'verify-game.mjs'), path.join(FIX, 'feed-824027.json'), path.join(tmp, 'game.html'), '824027']],
  ['verify-reviews.mjs (replay feed vs feeds)',
    'node', [path.join(ROOT, 'tests', 'verify-reviews.mjs'), '2026-06-01', path.join(FIX, 'schedule-2026-06-01.json'), path.join(tmp, 'feeds'), path.join(tmp, 'reviews.html')]],
];
let failed = 0;
for (const [label, cmd, args] of steps) {
  try {
    execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('ok   ' + label);
  } catch (err) {
    failed += 1;
    console.error('FAIL ' + label + '\n     ' + String(err.stdout || '') + String(err.stderr || err.message));
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nselftest-verify: ${steps.length - failed}/${steps.length} verifiers reproduced against the official fixtures`);
process.exit(failed ? 1 : 0);
