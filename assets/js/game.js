(function (global) {
  'use strict';

  const { $, esc, teamLogoUrl, formatGameTime, setStatus } = global.MlbUi;
  const { getGameFeed } = global.MlbApi;
  const { extractGameReviews, extractChallengeCounters } = global.MlbReviews;
  const { renderProps } = global.MlbProps;

  let gamePk = null;
  let countdown = 15;
  let tickTimer = null;

  function getGamePk() {
    const params = new URLSearchParams(window.location.search);
    return params.get('gamePk');
  }

  function setupTabs() {
    const btns = document.querySelectorAll('.tabs-game .tab-btn');
    const panels = {
      plays: $('panel-plays'),
      boxscore: $('panel-boxscore'),
      props: $('panel-props'),
      reviews: $('panel-reviews')
    };
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        btns.forEach((b) => b.classList.remove('tab-on'));
        btn.classList.add('tab-on');
        Object.keys(panels).forEach((k) => {
          if (panels[k]) panels[k].style.display = k === target ? '' : 'none';
        });
      });
    });
  }

  function renderHeader(feed) {
    const gd = feed.gameData || {};
    const ld = feed.liveData || {};
    const away = gd.teams?.away || {};
    const home = gd.teams?.home || {};
    const ls = ld.linescore || {};
    const status = gd.status || {};

    const awayRuns = ls.teams?.away?.runs ?? '-';
    const homeRuns = ls.teams?.home?.runs ?? '-';

    $('header-away').innerHTML = `
      <img class="header-logo" src="${esc(teamLogoUrl(away.id))}" alt="${esc(away.abbreviation || '')}">
      <div>
        <div class="header-team-name">${esc(away.name || 'Away')}</div>
        <div class="header-team-rec">${esc(away.record?.wins ?? '-')}-${esc(away.record?.losses ?? '-')}</div>
      </div>
    `;

    const stateLabel =
      status.abstractGameState === 'Live'
        ? `${ls.inningState || ''} ${ls.currentInningOrdinal || ''}`.trim()
        : status.abstractGameState === 'Final'
        ? status.detailedState || 'Final'
        : formatGameTime(gd.datetime?.dateTime);

    $('header-center').innerHTML = `
      <div class="header-score">${esc(awayRuns)} – ${esc(homeRuns)}</div>
      <div class="header-state">${esc(stateLabel)}</div>
    `;

    $('header-home').className = 'header-side home';
    $('header-home').innerHTML = `
      <div>
        <div class="header-team-name">${esc(home.name || 'Home')}</div>
        <div class="header-team-rec">${esc(home.record?.wins ?? '-')}-${esc(home.record?.losses ?? '-')}</div>
      </div>
      <img class="header-logo" src="${esc(teamLogoUrl(home.id))}" alt="${esc(home.abbreviation || '')}">
    `;

    const venue = gd.venue?.name ? `Venue: ${gd.venue.name}` : '';
    const weather = gd.weather?.condition ? `Weather: ${gd.weather.condition}, ${gd.weather.temp}°F` : '';
    $('header-meta').innerHTML = [venue, weather].filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('');

    const dec = ld.decisions || {};
    const decParts = [];
    if (dec.winner) decParts.push(`W: ${dec.winner.fullName}`);
    if (dec.loser) decParts.push(`L: ${dec.loser.fullName}`);
    if (dec.save) decParts.push(`SV: ${dec.save.fullName}`);
    $('header-decisions').innerHTML = decParts.map((t) => `<span>${esc(t)}</span>`).join('');
  }

  function renderLivePanel(feed) {
    const ld = feed.liveData || {};
    const ls = ld.linescore || {};
    const cp = ld.plays?.currentPlay;
    const el = $('live-panel');
    if (!el) return;

    if (feed.gameData?.status?.abstractGameState !== 'Live' || !cp) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const count = cp.count || {};
    const offense = ls.offense || {};
    const bases = [
      offense.first ? '1B' : null,
      offense.second ? '2B' : null,
      offense.third ? '3B' : null
    ].filter(Boolean);

    el.innerHTML = `
      <div class="live-grid">
        <div class="live-box">
          <div class="live-box-title">Count & Bases</div>
          <div><strong>${esc(count.balls ?? 0)}-${esc(count.strikes ?? 0)}</strong> · ${esc(count.outs ?? 0)} Out(s)</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;">Runners: ${bases.length ? esc(bases.join(', ')) : 'Bases empty'}</div>
        </div>
        <div class="live-box">
          <div class="live-box-title">At Bat</div>
          <div><strong>${esc(cp.matchup?.batter?.fullName || 'TBD')}</strong></div>
          <div style="font-size:12px;color:var(--muted);">vs ${esc(cp.matchup?.pitcher?.fullName || 'TBD')}</div>
        </div>
      </div>
    `;
  }

  function renderLinescore(feed) {
    const ld = feed.liveData || {};
    const gd = feed.gameData || {};
    const ls = ld.linescore || {};
    const innings = ls.innings || [];
    const awayAbbr = gd.teams?.away?.abbreviation || 'AWY';
    const homeAbbr = gd.teams?.home?.abbreviation || 'HOM';

    const hdrCells = innings.map((inn) => `<th>${esc(inn.num)}</th>`).join('');
    const awayCells = innings.map((inn) => `<td>${esc(inn.away?.runs ?? '-')}</td>`).join('');
    const homeCells = innings.map((inn) => `<td>${esc(inn.home?.runs ?? '-')}</td>`).join('');

    $('linescore-wrap').innerHTML = `
      <div class="table-scroll">
        <table class="mlb-table">
          <thead>
            <tr><th>Team</th>${hdrCells}<th>R</th><th>H</th><th>E</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${esc(awayAbbr)}</strong></td>
              ${awayCells}
              <td><strong>${esc(ls.teams?.away?.runs ?? 0)}</strong></td>
              <td>${esc(ls.teams?.away?.hits ?? 0)}</td>
              <td>${esc(ls.teams?.away?.errors ?? 0)}</td>
            </tr>
            <tr>
              <td><strong>${esc(homeAbbr)}</strong></td>
              ${homeCells}
              <td><strong>${esc(ls.teams?.home?.runs ?? 0)}</strong></td>
              <td>${esc(ls.teams?.home?.hits ?? 0)}</td>
              <td>${esc(ls.teams?.home?.errors ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPlays(feed) {
    const allPlays = (feed.liveData?.plays?.allPlays || []).slice().reverse();
    const wrap = $('plays-wrap');
    if (!allPlays.length) {
      wrap.innerHTML = `<div class="empty-state">No plays recorded yet.</div>`;
      return;
    }

    wrap.innerHTML = allPlays
      .map((p) => {
        const about = p.about || {};
        const res = p.result || {};
        const isScoring = about.isScoringPlay === true;
        const isReview = Boolean(p.reviewDetails);
        const inn = `${about.halfInning === 'top' ? 'Top' : 'Bot'} ${about.inning || ''}`;
        return `
          <div class="play-row ${isScoring ? 'is-scoring' : ''} ${isReview ? 'is-review' : ''}">
            <div class="play-desc">
              <span style="color:var(--muted);font-size:12px;margin-right:6px;">${esc(inn)}</span>
              ${esc(res.description || 'In progress')}
            </div>
            <div class="play-meta">${esc(res.awayScore ?? 0)}-${esc(res.homeScore ?? 0)}</div>
          </div>
        `;
      })
      .join('');
  }

  function renderBoxscore(feed) {
    const box = feed.liveData?.boxscore?.teams;
    const gd = feed.gameData || {};
    const wrap = $('boxscore-wrap');
    if (!box) {
      wrap.innerHTML = `<div class="empty-state">Box score not available yet.</div>`;
      return;
    }

    const renderTeamBox = (sideKey, teamName) => {
      const side = box[sideKey];
      if (!side) return '';
      const batters = (side.batters || [])
        .map((id) => side.players?.[`ID${id}`])
        .filter((p) => p && p.stats?.batting && p.stats.batting.atBats !== undefined);

      const rows = batters
        .map((p) => {
          const b = p.stats.batting;
          return `<tr>
            <td>${esc(p.person?.fullName || '')} <span style="color:var(--muted);font-size:11px;">${esc(p.position?.abbreviation || '')}</span></td>
            <td>${esc(b.atBats ?? 0)}</td>
            <td>${esc(b.runs ?? 0)}</td>
            <td>${esc(b.hits ?? 0)}</td>
            <td>${esc(b.rbi ?? 0)}</td>
            <td>${esc(b.baseOnBalls ?? 0)}</td>
            <td>${esc(b.strikeOuts ?? 0)}</td>
          </tr>`;
        })
        .join('');

      return `
        <h3 style="margin:10px 0 6px;">${esc(teamName)}</h3>
        <div class="table-scroll">
          <table class="mlb-table">
            <thead><tr><th>Batter</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7">No batting stats yet</td></tr>'}</tbody>
          </table>
        </div>
      `;
    };

    wrap.innerHTML =
      renderTeamBox('away', gd.teams?.away?.name || 'Away') +
      renderTeamBox('home', gd.teams?.home?.name || 'Home');
  }

  function renderReviewsTab(feed) {
    const reviews = extractGameReviews(feed);
    const counters = extractChallengeCounters(feed);
    const countBadge = $('reviews-tab-count');
    if (countBadge) {
      countBadge.style.display = reviews.length ? 'inline-block' : 'none';
      countBadge.textContent = String(reviews.length);
    }

    const active = reviews.filter((r) => r.inProgress);
    const bannerWrap = $('live-review-banner-wrap');
    if (bannerWrap) {
      bannerWrap.innerHTML = active.length
        ? `<div class="active-strip">${active
            .map((r) => `<span>🚨 <strong>${esc(r.reviewType)}</strong> (${esc(r.inning)}): ${esc(r.description)}</span>`)
            .join('')}</div>`
        : '';
    }

    const wrap = $('reviews-wrap');
    const counterLine = `<div class="reviews-summary-bar">
      <span>Away Challenges Remaining: <strong>${counters.awayRemaining ?? '—'}</strong></span>
      <span>Home Challenges Remaining: <strong>${counters.homeRemaining ?? '—'}</strong></span>
      <span>ABS Remaining: <strong>${counters.absAwayRemaining ?? '—'} / ${counters.absHomeRemaining ?? '—'}</strong></span>
    </div>`;

    if (!reviews.length) {
      wrap.innerHTML = counterLine + `<div class="empty-state">No challenges or replay reviews in this game.</div>`;
      return;
    }

    wrap.innerHTML =
      counterLine +
      reviews
        .map((r) => {
          const badge = r.inProgress
            ? `<span class="badge badge-live">In Progress</span>`
            : r.isOverturned
            ? `<span class="badge badge-overturned">Overturned</span>`
            : `<span class="badge badge-upheld">Upheld / Stands</span>`;
          return `
            <div class="feed-card ${r.inProgress ? 'is-active' : ''}">
              <div class="feed-card-top">
                ${badge}
                <strong>${esc(r.reviewType)}</strong>
                <span style="color:var(--muted);">${esc(r.inning)}</span>
                ${r.runsAtRisk ? '<span class="badge badge-risk">Runs at Risk</span>' : ''}
              </div>
              <div class="feed-card-body">${esc(r.description)}</div>
            </div>
          `;
        })
        .join('');
  }

  async function loadGame() {
    if (!gamePk) {
      setStatus('Missing ?gamePk= parameter in URL.');
      return;
    }
    const loader = $('loading');
    if (loader) loader.classList.add('show');
    try {
      const feed = await getGameFeed(gamePk);
      renderHeader(feed);
      renderLivePanel(feed);
      renderLinescore(feed);
      renderPlays(feed);
      renderBoxscore(feed);
      renderProps(feed, $('props-wrap'));
      renderReviewsTab(feed);
      setStatus(`Updated ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      setStatus(`Error loading game ${gamePk}: ${err.message}`);
    } finally {
      if (loader) loader.classList.remove('show');
    }
  }

  function startLoop() {
    if (tickTimer) clearInterval(tickTimer);
    countdown = 15;
    const cdEl = $('countdown');
    tickTimer = setInterval(() => {
      countdown--;
      if (cdEl) cdEl.textContent = `${countdown}s`;
      if (countdown <= 0) {
        countdown = 15;
        loadGame();
      }
    }, 1000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    gamePk = getGamePk();
    setupTabs();
    const refreshBtn = $('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        countdown = 15;
        loadGame();
      });
    }
    loadGame();
    startLoop();
  });
})(window);
