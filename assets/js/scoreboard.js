(function (global) {
  'use strict';

  const { MlbApi, MlbUi } = global;
  let currentDate = new URLSearchParams(location.search).get('date') || MlbApi.todayIso();
  let activeFilter = 'all';
  let gamesCache = [];
  let pollTimer = null;

  function setDate(iso) {
    currentDate = iso;
    const picker = document.getElementById('date-picker');
    const label = document.getElementById('date-label');
    if (picker) picker.value = currentDate;
    if (label) label.textContent = MlbUi.formatDateLabel(currentDate);
    const url = new URL(location.href);
    url.searchParams.set('date', currentDate);
    history.replaceState(null, '', url.toString());
    loadGames();
  }

  function renderTabs(games) {
    const tabsEl = document.getElementById('tabs');
    if (!tabsEl) return;
    const counts = { all: games.length, live: 0, final: 0, preview: 0 };
    for (const g of games) {
      counts[MlbUi.gameStateBucket(g)]++;
    }
    const defs = [
      ['all', `All (${counts.all})`],
      ['live', `Live (${counts.live})`],
      ['final', `Final (${counts.final})`],
      ['preview', `Upcoming (${counts.preview})`]
    ];
    tabsEl.innerHTML = defs.map(([id, text]) => (
      `<button class="tab-btn ${activeFilter === id ? 'tab-on' : ''}" data-filter="${id}">${MlbUi.esc(text)}</button>`
    )).join('');

    tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        renderTabs(gamesCache);
        renderGames(gamesCache);
      });
    });
  }

  function renderGames(games) {
    const listEl = document.getElementById('game-list');
    if (!listEl) return;
    const filtered = activeFilter === 'all'
      ? games
      : games.filter(g => MlbUi.gameStateBucket(g) === activeFilter);

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state">No games found for ${MlbUi.esc(MlbUi.formatDateLabel(currentDate))}.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(g => {
      const bucket = MlbUi.gameStateBucket(g);
      const away = g.teams?.away || {};
      const home = g.teams?.home || {};
      const awayTeam = away.team || {};
      const homeTeam = home.team || {};
      const awayScore = away.score != null ? away.score : '';
      const homeScore = home.score != null ? home.score : '';
      const statusText = bucket === 'live'
        ? (MlbUi.formatInningState(g.linescore) || g.status?.detailedState || 'Live')
        : bucket === 'final'
          ? (g.status?.detailedState || 'Final')
          : MlbUi.formatStartTime(g.gameDate) || g.status?.detailedState || 'Scheduled';

      const pillClass = bucket === 'live' ? 'status-live' : bucket === 'final' ? 'status-final' : 'status-preview';
      const venue = g.venue?.name || '';
      const awayWin = bucket === 'final' && away.isWinner;
      const homeWin = bucket === 'final' && home.isWinner;

      return `
        <a class="game-card" href="game.html?gamePk=${encodeURIComponent(g.gamePk)}">
          <div class="game-card-top">
            <span class="status-pill ${pillClass}">${MlbUi.esc(statusText)}</span>
            <span>${MlbUi.esc(venue)}</span>
          </div>
          <div class="team-row">
            <img class="team-logo" src="${MlbApi.teamLogoUrl(awayTeam.id)}" alt="" loading="lazy">
            <span class="team-name">${MlbUi.esc(awayTeam.name || awayTeam.teamName || 'Away')}</span>
            <span class="team-record">${away.leagueRecord ? `${away.leagueRecord.wins}-${away.leagueRecord.losses}` : ''}</span>
            <span class="team-score ${awayWin ? 'winner' : ''}">${MlbUi.esc(awayScore)}</span>
          </div>
          <div class="team-row">
            <img class="team-logo" src="${MlbApi.teamLogoUrl(homeTeam.id)}" alt="" loading="lazy">
            <span class="team-name">${MlbUi.esc(homeTeam.name || homeTeam.teamName || 'Home')}</span>
            <span class="team-record">${home.leagueRecord ? `${home.leagueRecord.wins}-${home.leagueRecord.losses}` : ''}</span>
            <span class="team-score ${homeWin ? 'winner' : ''}">${MlbUi.esc(homeScore)}</span>
          </div>
          <div class="game-card-foot">
            <span>${g.linescore?.balls != null && bucket === 'live' ? `${g.linescore.balls}-${g.linescore.strikes}, ${g.linescore.outs} out` : (g.status?.detailedState || '')}</span>
            <span>Box & PBP →</span>
          </div>
        </a>
      `;
    }).join('');
  }

  async function loadGames() {
    clearTimeout(pollTimer);
    MlbUi.showBanner('');
    MlbUi.setStatusLine(`Loading ${currentDate} from statsapi.mlb.com…`);
    try {
      const data = await MlbApi.getSchedule(currentDate);
      gamesCache = data?.dates?.[0]?.games || [];
      renderTabs(gamesCache);
      renderGames(gamesCache);
      const hasLive = gamesCache.some(g => MlbUi.gameStateBucket(g) === 'live');
      MlbUi.setStatusLine(`Updated ${new Date().toLocaleTimeString()} · ${gamesCache.length} game(s)`);
      if (hasLive) {
        pollTimer = setTimeout(loadGames, 20000);
      }
    } catch (err) {
      MlbUi.showBanner(`Unable to load MLB schedule: ${err.message}`, true);
      MlbUi.setStatusLine('Error loading schedule');
    }
  }

  global.Scoreboard = {
    prevDay: () => setDate(MlbApi.shiftDate(currentDate, -1)),
    nextDay: () => setDate(MlbApi.shiftDate(currentDate, 1)),
    today: () => setDate(MlbApi.todayIso()),
    pickDate: () => {
      const picker = document.getElementById('date-picker');
      if (picker && picker.value) setDate(picker.value);
    }
  };

  document.addEventListener('DOMContentLoaded', () => setDate(currentDate));
})(window);
