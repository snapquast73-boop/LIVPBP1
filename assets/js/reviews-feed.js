(function (global) {
  'use strict';

  const { MlbApi, MlbUi, MlbReviews, FeedLog } = global;
  let currentDate = new URLSearchParams(location.search).get('date') || MlbApi.todayIso();
  let soundOn = false;
  let pollTimer = null;

  function setDate(iso) {
    currentDate = iso;
    const picker = document.getElementById('date-picker');
    const label = document.getElementById('date-label');
    if (picker) picker.value = currentDate;
    if (label) label.textContent = MlbUi.formatDateLabel(currentDate);
    loadFeed();
  }

  function renderRows(rows) {
    const list = document.getElementById('feed-list') || document.getElementById('game-list') || document.querySelector('main');
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = `<div class="panel"><div style="color:var(--muted);text-align:center;padding:24px;">No replay reviews or challenges logged for ${MlbUi.esc(MlbUi.formatDateLabel(currentDate))}.</div></div>`;
      return;
    }
    list.innerHTML = `<div class="panel">${rows.map(r => {
      const cls = r.inProgress ? 'review-active' : (r.isOverturned ? 'review-overturned' : 'review-upheld');
      const label = r.inProgress ? 'Under Review' : (r.isOverturned ? 'Overturned' : 'Call Stands');
      return `
        <div class="review-row">
          <div class="play-head">
            <span><a href="game.html?gamePk=${encodeURIComponent(r.gamePk)}">${MlbUi.esc(r.matchupLabel || `Game ${r.gamePk}`)}</a> · ${MlbUi.esc(r.halfInning || '')} ${r.inning ?? ''} · ${MlbUi.esc(r.type)}</span>
            <span class="review-badge ${cls}">${label}</span>
          </div>
          <div class="play-desc">${MlbUi.esc(r.description)}</div>
        </div>
      `;
    }).join('')}</div>`;
  }

  async function loadFeed() {
    clearTimeout(pollTimer);
    MlbUi.showBanner('');
    const cached = FeedLog.loadLog(currentDate);
    if (cached.length) renderRows(cached);

    MlbUi.setStatusLine(`Scanning ${currentDate} games from statsapi.mlb.com…`);
    try {
      const sched = await MlbApi.getSchedule(currentDate);
      const games = sched?.dates?.[0]?.games || [];
      const allRows = [];
      for (const g of games) {
        if (MlbUi.gameStateBucket(g) === 'preview') continue;
        try {
          const feed = await MlbApi.getGameFeed(g.gamePk);
          const awayAbbr = g.teams?.away?.team?.abbreviation || 'AWY';
          const homeAbbr = g.teams?.home?.team?.abbreviation || 'HME';
          const reviews = MlbReviews.extractReviewsFromFeed(feed);
          for (const r of reviews) {
            r.matchupLabel = `${awayAbbr} @ ${homeAbbr}`;
            allRows.push(r);
          }
        } catch (_) {}
      }
      allRows.reverse();
      if (soundOn && allRows.length > cached.length) {
        FeedLog.playChime();
      }
      FeedLog.saveLog(currentDate, allRows);
      renderRows(allRows);
      MlbUi.setStatusLine(`Scanned ${games.length} game(s) · ${allRows.length} review(s) · ${new Date().toLocaleTimeString()}`);
      if (games.some(g => MlbUi.gameStateBucket(g) === 'live')) {
        pollTimer = setTimeout(loadFeed, 20000);
      }
    } catch (err) {
      MlbUi.showBanner(`Unable to scan replay feed: ${err.message}`, true);
    }
  }

  global.ReplayFeed = {
    prevDay: () => setDate(MlbApi.shiftDate(currentDate, -1)),
    nextDay: () => setDate(MlbApi.shiftDate(currentDate, 1)),
    today: () => setDate(MlbApi.todayIso()),
    pickDate: () => {
      const picker = document.getElementById('date-picker');
      if (picker && picker.value) setDate(picker.value);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        soundOn = !soundOn;
        soundBtn.textContent = soundOn ? '🔊 Sound On' : '🔇 Sound Off';
      });
    }
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadFeed);
    setDate(currentDate);
  });
})(window);
