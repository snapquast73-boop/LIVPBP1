(function (global) {
  'use strict';

  const { $, esc, teamLogoUrl, todayStr, shiftDate, formatDateLabel, formatGameTime, showBanner, setStatus } = global.MlbUi;
  const { getSchedule } = global.MlbApi;

  let currentDate = todayStr();
  let currentFilter = 'all';
  let cachedGames = [];
  let timerId = null;

  function classifyGame(g) {
    const abstract = g.status?.abstractGameState || '';
    if (abstract === 'Live') return 'live';
    if (abstract === 'Final') return 'final';
    return 'scheduled';
  }

  function renderTabs() {
    const tabsEl = $('tabs');
    if (!tabsEl) return;
    const counts = { all: cachedGames.length, live: 0, final: 0, scheduled: 0 };
    for (const g of cachedGames) counts[classifyGame(g)]++;

    const defs = [
      { id: 'all', label: 'All Games' },
      { id: 'live', label: 'Live' },
      { id: 'final', label: 'Final' },
      { id: 'scheduled', label: 'Scheduled' }
    ];

    tabsEl.innerHTML = defs
      .map(
        (d) =>
          `<button class="tab-btn ${currentFilter === d.id ? 'tab-on' : ''}" data-filter="${d.id}">` +
          `${esc(d.label)} <span class="tab-badge">${counts[d.id]}</span></button>`
      )
      .join('');

    tabsEl.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter = btn.getAttribute('data-filter');
        renderTabs();
        renderGames();
      });
    });
  }

  function renderGames() {
    const listEl = $('game-list');
    if (!listEl) return;

    const filtered =
      currentFilter === 'all'
        ? cachedGames
        : cachedGames.filter((g) => classifyGame(g) === currentFilter);

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state">No games found for ${esc(formatDateLabel(currentDate))}.</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((g) => {
        const state = classifyGame(g);
        const away = g.teams?.away || {};
        const home = g.teams?.home || {};
        const awayTeam = away.team || {};
        const homeTeam = home.team || {};
        const ls = g.linescore || {};
        const statusText =
          state === 'live'
            ? `${ls.inningState || ''} ${ls.currentInningOrdinal || ''}`.trim() || g.status?.detailedState || 'Live'
            : state === 'final'
            ? g.status?.detailedState || 'Final'
            : formatGameTime(g.gameDate);

        const awayScore = away.score != null ? away.score : '-';
        const homeScore = home.score != null ? home.score : '-';
        const awayWin = state === 'final' && away.isWinner;
        const homeWin = state === 'final' && home.isWinner;

        const awayRec = away.leagueRecord ? `${away.leagueRecord.wins}-${away.leagueRecord.losses}` : '';
        const homeRec = home.leagueRecord ? `${home.leagueRecord.wins}-${home.leagueRecord.losses}` : '';

        return (
          `<a class="game-card ${state === 'live' ? 'is-live' : ''}" href="game.html?gamePk=${encodeURIComponent(g.gamePk)}">` +
          `<div class="gc-top">` +
          `<span class="${state === 'live' ? 'gc-status-live' : ''}">${esc(statusText)}</span>` +
          `<span>${esc(g.venue?.name || '')}</span>` +
          `</div>` +
          `<div class="gc-teams">` +
          `<div class="gc-team ${awayWin ? 'gc-winner' : homeWin ? 'gc-loser' : ''}">` +
          `<img class="gc-logo" src="${esc(teamLogoUrl(awayTeam.id))}" alt="${esc(awayTeam.abbreviation || '')}" loading="lazy">` +
          `<span class="gc-name">${esc(awayTeam.name || awayTeam.teamName || 'Away')}</span>` +
          `<span class="gc-record">${esc(awayRec)}</span>` +
          `<span class="gc-score">${esc(awayScore)}</span>` +
          `</div>` +
          `<div class="gc-team ${homeWin ? 'gc-winner' : awayWin ? 'gc-loser' : ''}">` +
          `<img class="gc-logo" src="${esc(teamLogoUrl(homeTeam.id))}" alt="${esc(homeTeam.abbreviation || '')}" loading="lazy">` +
          `<span class="gc-name">${esc(homeTeam.name || homeTeam.teamName || 'Home')}</span>` +
          `<span class="gc-record">${esc(homeRec)}</span>` +
          `<span class="gc-score">${esc(homeScore)}</span>` +
          `</div>` +
          `</div>` +
          `<div class="gc-foot">` +
          `<span>${state === 'live' && ls.outs != null ? `${ls.outs} Out${ls.outs === 1 ? '' : 's'}` : esc(g.seriesDescription || 'MLB')}</span>` +
          `<span>Open Game →</span>` +
          `</div>` +
          `</a>`
        );
      })
      .join('');
  }

  async function loadSchedule() {
    const picker = $('date-picker');
    const label = $('date-label');
    if (picker) picker.value = currentDate;
    if (label) label.textContent = formatDateLabel(currentDate);

    setStatus('Loading schedule from statsapi.mlb.com…');
    showBanner('');

    try {
      const data = await getSchedule(currentDate);
      cachedGames = (data.dates && data.dates[0] && data.dates[0].games) || [];
      renderTabs();
      renderGames();
      setStatus(`Updated ${new Date().toLocaleTimeString()} · ${cachedGames.length} game(s)`);
    } catch (err) {
      showBanner(`Unable to load schedule from MLB StatsAPI: ${err.message}`, true);
      setStatus('Error loading schedule');
    }

    if (timerId) clearTimeout(timerId);
    const hasLive = cachedGames.some((g) => classifyGame(g) === 'live');
    timerId = setTimeout(loadSchedule, hasLive ? 15000 : 60000);
  }

  const Scoreboard = {
    prevDay() {
      currentDate = shiftDate(currentDate, -1);
      loadSchedule();
    },
    nextDay() {
      currentDate = shiftDate(currentDate, 1);
      loadSchedule();
    },
    pickDate() {
      const picker = $('date-picker');
      if (picker && picker.value) {
        currentDate = picker.value;
        loadSchedule();
      }
    },
    today() {
      currentDate = todayStr();
      loadSchedule();
    }
  };

  global.Scoreboard = Scoreboard;
  document.addEventListener('DOMContentLoaded', loadSchedule);
})(window);
