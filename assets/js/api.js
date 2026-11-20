(function (global) {
  'use strict';

  const BASE = 'https://statsapi.mlb.com/api';

  async function fetchJson(url) {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) {
      throw new Error(`MLB StatsAPI HTTP ${res.status} for ${url}`);
    }
    return res.json();
  }

  function getSchedule(dateStr) {
    const params = new URLSearchParams({
      sportId: '1',
      date: dateStr,
      hydrate: 'team,linescore,decisions,venue,probablePitcher'
    });
    return fetchJson(`${BASE}/v1/schedule?${params.toString()}`);
  }

  function getGameFeed(gamePk) {
    return fetchJson(`${BASE}/v1.1/game/${encodeURIComponent(gamePk)}/feed/live`);
  }

  function getPlayerSeasonStats(personId, season) {
    const params = new URLSearchParams({
      stats: 'season',
      group: 'hitting,pitching',
      season: String(season)
    });
    return fetchJson(`${BASE}/v1/people/${encodeURIComponent(personId)}/stats?${params.toString()}`);
  }

  global.MlbApi = {
    BASE,
    getSchedule,
    getGameFeed,
    getPlayerSeasonStats
  };
})(window);
