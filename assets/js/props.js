(function (global) {
  'use strict';

  const { esc, headshotUrl } = global.MlbUi;

  function renderProps(feed, container) {
    if (!container) return;
    const ld = feed?.liveData || {};
    const gd = feed?.gameData || {};
    const currentPlay = ld.plays?.currentPlay;
    const matchup = currentPlay?.matchup || {};
    const batter = matchup.batter;
    const pitcher = matchup.pitcher;

    if (!batter && !pitcher) {
      container.innerHTML = `<div class="empty-state">Live matchup data is not available yet for this game.</div>`;
      return;
    }

    const box = ld.boxscore?.teams || {};
    const findPlayerStats = (id) => {
      if (!id) return null;
      const key = `ID${id}`;
      return box.away?.players?.[key]?.stats || box.home?.players?.[key]?.stats || null;
    };

    const batStats = findPlayerStats(batter?.id)?.batting || {};
    const pitStats = findPlayerStats(pitcher?.id)?.pitching || {};

    container.innerHTML = `
      <div class="live-grid">
        <div class="live-box">
          <div class="live-box-title">Current Batter</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${esc(headshotUrl(batter?.id))}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;background:#0b0f17;" loading="lazy">
            <div>
              <div style="font-weight:700;">${esc(batter?.fullName || 'TBD')}</div>
              <div style="font-size:12px;color:var(--muted);">
                Today: ${esc(batStats.hits ?? 0)}-${esc(batStats.atBats ?? 0)}, ${esc(batStats.baseOnBalls ?? 0)} BB, ${esc(batStats.strikeOuts ?? 0)} SO
              </div>
            </div>
          </div>
        </div>
        <div class="live-box">
          <div class="live-box-title">Current Pitcher</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${esc(headshotUrl(pitcher?.id))}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;background:#0b0f17;" loading="lazy">
            <div>
              <div style="font-weight:700;">${esc(pitcher?.fullName || 'TBD')}</div>
              <div style="font-size:12px;color:var(--muted);">
                Today: ${esc(pitStats.inningsPitched ?? '0.0')} IP, ${esc(pitStats.hits ?? 0)} H, ${esc(pitStats.earnedRuns ?? 0)} ER, ${esc(pitStats.strikeOuts ?? 0)} K
              </div>
            </div>
          </div>
        </div>
      </div>
      <p style="font-size:12px;color:var(--muted);margin-top:12px;">
        Matchup data sourced directly from MLB StatsAPI live feed (${esc(gd.game?.season || '')} season).
      </p>
    `;
  }

  global.MlbProps = { renderProps };
})(window);
