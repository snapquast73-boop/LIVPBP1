(function (global) {
  'use strict';

  const { MlbApi, MlbUi, MlbReviews, MlbProps } = global;
  const gamePk = new URLSearchParams(location.search).get('gamePk');
  let pollTimer = null;
  let countdownTimer = null;
  let secondsLeft = 15;

  function renderHeader(feed) {
    const away = feed.gameData?.teams?.away || {};
    const home = feed.gameData?.teams?.home || {};
    const ls = feed.liveData?.linescore || {};
    const awayRuns = ls.teams?.away?.runs ?? '-';
    const homeRuns = ls.teams?.home?.runs ?? '-';
    const status = feed.gameData?.status?.detailedState || '';
    const inning = MlbUi.formatInningState(ls);

    document.getElementById('header-away').innerHTML = `
      <img class="header-logo" src="${MlbApi.teamLogoUrl(away.id)}" alt="">
      <div>
        <div class="header-team-name">${MlbUi.esc(away.name || 'Away')}</div>
        <div class="header-team-sub">${MlbUi.esc(away.record ? `${away.record.wins}-${away.record.losses}` : '')}</div>
      </div>
    `;
    document.getElementById('header-center').innerHTML = `
      <div class="header-score">${MlbUi.esc(awayRuns)} – ${MlbUi.esc(homeRuns)}</div>
      <div class="header-team-sub">${MlbUi.esc(inning || status)}</div>
    `;
    document.getElementById('header-home').innerHTML = `
      <div>
        <div class="header-team-name">${MlbUi.esc(home.name || 'Home')}</div>
        <div class="header-team-sub">${MlbUi.esc(home.record ? `${home.record.wins}-${home.record.losses}` : '')}</div>
      </div>
      <img class="header-logo" src="${MlbApi.teamLogoUrl(home.id)}" alt="">
    `;
    document.getElementById('header-home').classList.add('home');
    document.getElementById('header-meta').textContent =
      [feed.gameData?.venue?.name, status].filter(Boolean).join(' · ');
  }

  function renderLivePanel(feed) {
    const el = document.getElementById('live-panel');
    const ls = feed.liveData?.linescore || {};
    const current = feed.liveData?.plays?.currentPlay;
    const matchup = current?.matchup || {};
    const offense = ls.offense || {};
    const bases = [
      offense.first ? '1B' : '',
      offense.second ? '2B' : '',
      offense.third ? '3B' : ''
    ].filter(Boolean).join(', ') || 'Bases empty';

    el.innerHTML = `
      <div><strong>At Bat:</strong> ${MlbUi.esc(matchup.batter?.fullName || '—')}</div>
      <div><strong>Pitching:</strong> ${MlbUi.esc(matchup.pitcher?.fullName || '—')}</div>
      <div><strong>Count / Outs:</strong> ${ls.balls ?? 0}-${ls.strikes ?? 0}, ${ls.outs ?? 0} out</div>
      <div><strong>Runners:</strong> ${MlbUi.esc(bases)}</div>
    `;
  }

  function renderLinescore(feed) {
    const wrap = document.getElementById('linescore-wrap');
    const ls = feed.liveData?.linescore || {};
    const innings = ls.innings || [];
    const away = feed.gameData?.teams?.away?.abbreviation || 'AWY';
    const home = feed.gameData?.teams?.home?.abbreviation || 'HME';

    wrap.innerHTML = `
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Team</th>
              ${innings.map(i => `<th>${i.num}</th>`).join('')}
              <th>R</th><th>H</th><th>E</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${MlbUi.esc(away)}</td>
              ${innings.map(i => `<td>${i.away?.runs ?? ''}</td>`).join('')}
              <td><strong>${ls.teams?.away?.runs ?? 0}</strong></td>
              <td>${ls.teams?.away?.hits ?? 0}</td>
              <td>${ls.teams?.away?.errors ?? 0}</td>
            </tr>
            <tr>
              <td>${MlbUi.esc(home)}</td>
              ${innings.map(i => `<td>${i.home?.runs ?? ''}</td>`).join('')}
              <td><strong>${ls.teams?.home?.runs ?? 0}</strong></td>
              <td>${ls.teams?.home?.hits ?? 0}</td>
              <td>${ls.teams?.home?.errors ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPlays(feed) {
    const wrap = document.getElementById('plays-wrap');
    const plays = (feed.liveData?.plays?.allPlays || []).slice().reverse();
    if (!plays.length) {
      wrap.innerHTML = '<div style="color:var(--muted);">No plays recorded yet.</div>';
      return;
    }
    wrap.innerHTML = plays.map(p => {
      const about = p.about || {};
      const res = p.result || {};
      return `
        <div class="play-item">
          <div class="play-head">
            <span>${MlbUi.esc(about.halfInning || '')} ${about.inning ?? ''} · ${MlbUi.esc(p.matchup?.batter?.fullName || '')}</span>
            <span>${res.awayScore ?? 0} – ${res.homeScore ?? 0}</span>
          </div>
          <div class="play-desc">${MlbUi.esc(res.description || 'In progress')}</div>
        </div>
      `;
    }).join('');
  }

  function renderBoxscore(feed) {
    const wrap = document.getElementById('boxscore-wrap');
    const teams = feed.liveData?.boxscore?.teams;
    if (!teams) {
      wrap.innerHTML = '<div style="color:var(--muted);">Box score not available yet.</div>';
      return;
    }
    const renderSide = (side, label) => {
      const batters = (side.batters || []).map(id => side.players?.[`ID${id}`]).filter(Boolean);
      return `
        <h4>${MlbUi.esc(label)} Batting</h4>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Player</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th></tr></thead>
            <tbody>
              ${batters.map(p => {
                const s = p.stats?.batting || {};
                return `<tr>
                  <td>${MlbUi.esc(p.person?.fullName || '')}</td>
                  <td>${s.atBats ?? 0}</td><td>${s.runs ?? 0}</td><td>${s.hits ?? 0}</td>
                  <td>${s.rbi ?? 0}</td><td>${s.baseOnBalls ?? 0}</td><td>${s.strikeOuts ?? 0}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };
    wrap.innerHTML = renderSide(teams.away, feed.gameData?.teams?.away?.name || 'Away') +
      renderSide(teams.home, feed.gameData?.teams?.home?.name || 'Home');
  }

  function renderReviews(feed) {
    const wrap = document.getElementById('reviews-wrap');
    const badge = document.getElementById('reviews-tab-count');
    const reviews = MlbReviews.extractReviewsFromFeed(feed);
    if (badge) {
      badge.textContent = String(reviews.length);
      badge.style.display = reviews.length ? 'inline-block' : 'none';
    }
    if (!reviews.length) {
      wrap.innerHTML = '<div style="color:var(--muted);">No replay reviews or challenges in this game.</div>';
      return;
    }
    wrap.innerHTML = reviews.slice().reverse().map(r => {
      const cls = r.inProgress ? 'review-active' : (r.isOverturned ? 'review-overturned' : 'review-upheld');
      const label = r.inProgress ? 'Under Review' : (r.isOverturned ? 'Overturned' : 'Call Stands / Confirmed');
      return `
        <div class="review-row">
          <div class="play-head">
            <span>${MlbUi.esc(r.halfInning || '')} ${r.inning ?? ''} · ${MlbUi.esc(r.type)}</span>
            <span class="review-badge ${cls}">${label}</span>
          </div>
          <div class="play-desc">${MlbUi.esc(r.description)}</div>
        </div>
      `;
    }).join('');
  }

  async function loadGame() {
    clearTimeout(pollTimer);
    clearInterval(countdownTimer);
    if (!gamePk) {
      MlbUi.setStatusLine('Missing ?gamePk= parameter.');
      return;
    }
    try {
      const feed = await MlbApi.getGameFeed(gamePk);
      renderHeader(feed);
      renderLivePanel(feed);
      renderLinescore(feed);
      renderPlays(feed);
      renderBoxscore(feed);
      MlbProps.renderProps(feed);
      renderReviews(feed);
      MlbUi.setStatusLine(`Updated ${new Date().toLocaleTimeString()}`);
      const isLive = feed.gameData?.status?.abstractGameCode === 'L';
      if (isLive) {
        secondsLeft = 15;
        countdownTimer = setInterval(() => {
          secondsLeft = Math.max(0, secondsLeft - 1);
          const cd = document.getElementById('countdown');
          if (cd) cd.textContent = `${secondsLeft}s`;
        }, 1000);
        pollTimer = setTimeout(loadGame, 15000);
      }
    } catch (err) {
      MlbUi.setStatusLine(`Error loading game ${gamePk}: ${err.message}`);
    }
  }

  function initTabs() {
    document.querySelectorAll('.tabs-game .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs-game .tab-btn').forEach(b => b.classList.remove('tab-on'));
        btn.classList.add('tab-on');
        const target = btn.dataset.tab;
        ['plays', 'boxscore', 'props', 'reviews'].forEach(name => {
          const panel = document.getElementById(`panel-${name}`);
          if (panel) panel.style.display = name === target ? 'block' : 'none';
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    const btn = document.getElementById('refresh-btn');
    if (btn) btn.addEventListener('click', loadGame);
    loadGame();
  });
})(window);
