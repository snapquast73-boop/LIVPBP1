(function (global) {
  'use strict';

  const BASE_V1 = 'https://statsapi.mlb.com/api/v1';
  const BASE_V11 = 'https://statsapi.mlb.com/api/v1.1';

  async function fetchJson(url) {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) {
      throw new Error(`MLB StatsAPI HTTP ${res.status} for ${url}`);
    }
    return res.json();
  }

  function todayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function shiftDate(isoDate, deltaDays) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  async function getSchedule(dateIso) {
    const hydrate = [
      'team',
      'linescore',
      'probablePitcher(note)',
      'decisions',
      'flags',
      'review',
      'game(content(summary))'
    ].join(',');
    const url = `${BASE_V1}/schedule?sportId=1&date=${encodeURIComponent(dateIso)}&hydrate=${encodeURIComponent(hydrate)}`;
    return fetchJson(url);
  }

  async function getGameFeed(gamePk) {
    const url = `${BASE_V11}/game/${encodeURIComponent(gamePk)}/feed/live`;
    return fetchJson(url);
  }

  function teamLogoUrl(teamId) {
    if (!teamId) return '';
    return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
  }

  function playerHeadshotUrl(playerId) {
    if (!playerId) return '';
    return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`;
  }

  global.MlbApi = {
    todayIso,
    shiftDate,
    getSchedule,
    getGameFeed,
    teamLogoUrl,
    playerHeadshotUrl
  };
})(window);
