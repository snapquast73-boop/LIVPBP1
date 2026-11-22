/* Verify across the entire repository (HTML + Markdown + rendered DOM):
 *   1. Zero broken local links across all HTML pages and Markdown docs;
 *   2. Every Markdown table data row links to an official http(s):// source;
 *   3. Every static HTML <tbody><tr> row links to an official http(s):// source;
 *   4. Every dynamically rendered <tbody><tr> row (game.html linescore +
 *      batting/pitching boxscore), game review card, and Replay Feed row
 *      (reviews.html) links directly to its official MLB StatsAPI feed;
 *   5. Every primary HTML page links to Flagged for Review (flagged.html). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { REPO_ROOT, readFixture } from './lib/browser-env.mjs';

const OFFICIAL_HOSTS = new Set([
  'statsapi.mlb.com',
  'www.mlb.com',
  'gdx.mlb.com',
  'www.mlbstatic.com',
  'img.mlbstatic.com',
  'api.github.com',
  'docs.github.com',
  'github.com',
  'snapquast73-boop.github.io',
]);

function isOfficialUrl(raw) {
  try {
    const u = new URL(raw);
    return (u.protocol === 'https:' || u.protocol === 'http:') && OFFICIAL_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function collectFiles(dir, ext, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collectFiles(full, ext, out);
    else if (ent.name.endsWith(ext)) out.push(full);
  }
  return out.sort();
}

function checkLocalTarget(fromFile, rawTarget) {
  if (!rawTarget || rawTarget.startsWith('#')) return;
  if (/^(https?:|mailto:|data:|javascript:)/i.test(rawTarget)) return;
  const clean = decodeURIComponent(rawTarget.split('#')[0].split('?')[0]);
  if (!clean) return;
  const stripped = clean.startsWith('/LIVPBP1/') ? '/' + clean.slice('/LIVPBP1/'.length) : clean;
  let resolved;
  if (stripped === '/' || stripped === '/LIVPBP1') {
    resolved = path.join(REPO_ROOT, 'index.html');
  } else if (stripped.startsWith('/')) {
    resolved = path.join(REPO_ROOT, stripped.slice(1));
  } else {
    resolved = path.resolve(path.dirname(fromFile), stripped);
  }
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    resolved = path.join(resolved, 'index.html');
  }
  assert.ok(
    fs.existsSync(resolved) && fs.statSync(resolved).isFile(),
    `${path.relative(REPO_ROOT, fromFile)}: broken local link "${rawTarget}" (resolved to ${path.relative(REPO_ROOT, resolved)})`
  );
}

// 1 & 3 & 5: Static HTML local links, Flagged for Review navigation, and static <tbody><tr> official links
const htmlFiles = collectFiles(REPO_ROOT, '.html');
let staticRowsChecked = 0;
for (const htmlFile of htmlFiles) {
  const rel = path.relative(REPO_ROOT, htmlFile);
  const dom = new JSDOM(fs.readFileSync(htmlFile, 'utf8'));
  const doc = dom.window.document;
  for (const el of doc.querySelectorAll('[href], [src]')) {
    const attr = el.hasAttribute('href') ? el.getAttribute('href') : el.getAttribute('src');
    checkLocalTarget(htmlFile, attr);
  }
  if (rel !== 'flagged.html') {
    const flaggedLink = [...doc.querySelectorAll('a[href]')].find((a) =>
      a.getAttribute('href').replace(/^\/LIVPBP1\//, '').startsWith('flagged.html')
    );
    assert.ok(flaggedLink, `${rel}: must include a link to flagged.html`);
  }
  for (const tr of doc.querySelectorAll('tbody tr')) {
    const officialLinks = [...tr.querySelectorAll('a[href]')].filter((a) =>
      isOfficialUrl(a.getAttribute('href'))
    );
    assert.ok(
      officialLinks.length >= 1,
      `${rel}: static <tbody><tr> row "${tr.textContent.trim().slice(0, 80)}" lacks an official source link`
    );
    staticRowsChecked += 1;
  }
}

// 1 & 2: Markdown local links and Markdown table data rows
const mdFiles = collectFiles(REPO_ROOT, '.md').filter(
  (f) => path.basename(f) !== 'COORDINATION.md'
);
let mdRowsChecked = 0;
for (const mdFile of mdFiles) {
  const rel = path.relative(REPO_ROOT, mdFile);
  const lines = fs.readFileSync(mdFile, 'utf8').split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // Strip inline code spans before scanning Markdown links so placeholders like `[text](url)` inside backticks are ignored
    const noInlineCode = line.replace(/`[^`]*`/g, '');
    for (const m of noInlineCode.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      checkLocalTarget(mdFile, m[1]);
    }
    // Check Markdown table rows
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (/^\|[\s:-]+(\|[\s:-]+)+\|?$/.test(trimmed)) continue; // separator row
    const next = (lines[i + 1] || '').trim();
    if (/^\|[\s:-]+(\|[\s:-]+)+\|?$/.test(next)) continue; // header row immediately above separator
    const urls = [...line.matchAll(/https?:\/\/[^\s)>\]]+/g)].map((m) => m[0]);
    assert.ok(
      urls.some(isOfficialUrl),
      `${rel}:${i + 1}: Markdown table row lacks an official source link: ${trimmed.slice(0, 100)}`
    );
    mdRowsChecked += 1;
  }
}

// 4: Dynamically rendered tables and Replay Feed rows
const schedule = readFixture('schedule-2026-06-01.json');
const gameStatus = readFixture('game-status.json');
const feed = readFixture('feed-824027.json');

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
      const copy = JSON.parse(JSON.stringify(feed));
      if (m && String(m[1]) !== String(feed.gamePk)) {
        copy.gamePk = Number(m[1]);
        copy.gameData.game.pk = Number(m[1]);
      }
      return jsonResponse(copy);
    }
    if (target.includes('/people/') && target.includes('stats=')) {
      return jsonResponse({ stats: [] });
    }
    if (target.includes('/api/feed-log')) return Promise.reject(new Error('static hosting'));
    return jsonResponse({}, 404);
  };
}

function waitFor(fn, timeoutMs = 4000) {
  const limit = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function tick() {
      try {
        if (fn()) return resolve();
      } catch {
        // continue polling
      }
      if (Date.now() > limit) return reject(new Error('timeout waiting for render'));
      setTimeout(tick, 25);
    })();
  });
}

async function renderPage(pageFile, query, ready) {
  const html = fs.readFileSync(path.join(REPO_ROOT, pageFile), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://example.test/' + pageFile + query,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const win = dom.window;
  win.fetch = makeFetch();
  win.console.error = () => {};
  for (const s of win.document.querySelectorAll('script[src]')) {
    win.eval(fs.readFileSync(path.join(REPO_ROOT, s.getAttribute('src')), 'utf8'));
  }
  win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));
  await waitFor(() => ready(win.document));
  return win;
}

const gameWin = await renderPage(
  'game.html',
  '?gamePk=824027',
  (doc) =>
    doc.querySelectorAll('#linescore-wrap tbody tr').length >= 2 &&
    doc.querySelectorAll('#boxscore-wrap tbody tr').length >= 4 &&
    doc.querySelectorAll('#reviews-wrap .feed-card').length >= 1
);
let renderedRowsChecked = 0;
for (const tr of gameWin.document.querySelectorAll('#linescore-wrap tbody tr, #boxscore-wrap tbody tr')) {
  const links = [...tr.querySelectorAll('a[href]')].filter((a) =>
    a.getAttribute('href') === 'https://statsapi.mlb.com/api/v1.1/game/824027/feed/live'
  );
  assert.equal(links.length, 1, 'every rendered game table row must carry a direct official MLB feed link');
  renderedRowsChecked += 1;
}
for (const card of gameWin.document.querySelectorAll('#reviews-wrap .feed-card')) {
  const links = [...card.querySelectorAll('a[href]')].filter((a) =>
    a.getAttribute('href') === 'https://statsapi.mlb.com/api/v1.1/game/824027/feed/live'
  );
  assert.ok(links.length >= 1, 'every rendered game review card must link to its official MLB feed');
}
gameWin.close();

const reviewsWin = await renderPage(
  'reviews.html',
  '?date=2026-06-01',
  (doc) => doc.querySelectorAll('#feed-list article.feed-card').length >= 1
);
let feedCardsChecked = 0;
for (const card of reviewsWin.document.querySelectorAll('#feed-list article.feed-card')) {
  const links = [...card.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
  assert.ok(
    links.some((h) => /^game\.html\?gamePk=\d+$/.test(h)),
    'every Replay Feed card must link to its game page'
  );
  assert.ok(
    links.some((h) => /^https:\/\/statsapi\.mlb\.com\/api\/v1\.1\/game\/\d+\/feed\/live$/.test(h)),
    'every Replay Feed card must link directly to its official MLB feed'
  );
  feedCardsChecked += 1;
}
reviewsWin.close();

console.log(
  `ok   verified local links (${htmlFiles.length} HTML, ${mdFiles.length} Markdown) and official source links on ` +
    `${staticRowsChecked} static HTML row(s), ${mdRowsChecked} Markdown table row(s), ` +
    `${renderedRowsChecked} rendered game row(s), and ${feedCardsChecked} Replay Feed card(s)`
);
process.exit(0);
