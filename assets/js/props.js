(function (global) {
  'use strict';

  const { MlbUi } = global;

  function renderProps(feed) {
    const wrap = document.getElementById('props-wrap');
    if (!wrap) return;
    const plays = feed?.liveData?.plays?.allPlays || [];
    const current = feed?.liveData?.plays?.currentPlay || plays[plays.length - 1];
    const matchup = current?.matchup || {};
    const batter = matchup.batter?.fullName || 'TBD';
    const pitcher = matchup.pitcher?.fullName || 'TBD';
    const batSide = matchup.batSide?.description || '';
    const pitchHand = matchup.pitchHand?.description || '';

    wrap.innerHTML = `
      <h3 style="margin-top:0;">Current Matchup</h3>
      <p><strong>Batter:</strong> ${MlbUi.esc(batter)} ${batSide ? `(${MlbUi.esc(batSide)})` : ''}</p>
      <p><strong>Pitcher:</strong> ${MlbUi.esc(pitcher)} ${pitchHand ? `(${MlbUi.esc(pitchHand)})` : ''}</p>
      <p style="color:var(--muted);font-size:12px;">All matchup details are read directly from the official MLB StatsAPI live feed.</p>
    `;
  }

  global.MlbProps = { renderProps };
})(window);
