(function (global) {
  'use strict';

  const { $, esc, todayStr, shiftDate, formatDateLabel, showBanner, setStatus } = global.MlbUi;
  const { getSchedule, getGameFeed } = global.MlbApi;
  const { extractGameReviews } = global.MlbReviews;
  const { loadDateLog, saveDateLog } = global.FeedLog;

  let currentDate = todayStr();
  let currentFilter = 'all';
  let feedItems = [];
  let soundOn = false;
  let notifyOn = false;
  let countdown = 20;
  let tickTimer = null;

  function playRaindropChime() {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch (_) {
      // ignore audio context errors
    }
  }

  function renderSummary() {
    const el = $('feed-stats');
    if (!el) return;
    const active = feedItems.filter((i) => i.inProgress).length;
    const challenges = feedItems.filter((i) => i.category === 'challenge').length;
    const abs = feedItems.filter((i) => i.category === 'abs').length;
    const osPending = feedItems.filter((i) => i.category === 'os_pending').length;

    el.innerHTML = `
      <span>Total Events: <strong>${feedItems.length}</strong></span>
      <span>Active Now: <strong>${active}</strong></span>
      <span>Challenges/Reviews: <strong>${challenges}</strong></span>
      <span>ABS: <strong>${abs}</strong></span>
      <span>OS Pending: <strong>${osPending}</strong></span>
    `;
  }

  function renderActiveStrip() {
    const el = $('active-strip');
    if (!el) return;
    const active = feedItems.filter((i) => i.inProgress);
    if (!active.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `<div class="active-strip">${active
      .map(
        (i) =>
          `<a href="game.html?gamePk=${encodeURIComponent(i.gamePk)}">🚨 <strong>${esc(i.matchup)}</strong> (${esc(i.inning)}): ${esc(i.reviewType)}</a>`
      )
      .join(' · ')}</div>`;
  }

  function renderTabs() {
    const el = $('feed-tabs');
    if (!el) return;
    const defs = [
      { id: 'all', label: 'All' },
      { id: 'active', label: 'Active' },
      { id: 'challenge', label: 'Challenges' },
      { id: 'abs', label: 'ABS' },
      { id: 'os_pending', label: 'Pending OS' }
    ];
    el.innerHTML = defs
      .map(
        (d) =>
          `<button class="tab-btn ${currentFilter === d.id ? 'tab-on' : ''}" data-filter="${d.id}">${esc(d.label)}</button>`
      )
      .join('');
    el.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter = btn.getAttribute('data-filter');
        renderTabs();
        renderList();
      });
    });
  }

  function renderList() {
    const el = $('feed-list');
    if (!el) return;

    const filtered = feedItems.filter((item) => {
      if (currentFilter === 'all') return true;
      if (currentFilter === 'active') return item.inProgress;
      return item.category === currentFilter;
    });

    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state">No replay reviews or challenges recorded for ${esc(formatDateLabel(currentDate))}.</div>`;
      return;
    }

    el.innerHTML = filtered
      .map((item) => {
        const badge = item.inProgress
          ? `<span class="badge badge-live">Active</span>`
          : item.isOverturned
          ? `<span class="badge badge-overturned">Overturned</span>`
          : item.category === 'os_pending'
          ? `<span class="badge badge-pending">OS Pending</span>`
          : `<span class="badge badge-upheld">Upheld</span>`;

        return `
          <article class="feed-card ${item.inProgress ? 'is-active' : ''}">
            <div class="feed-card-top">
              ${badge}
              <a href="game.html?gamePk=${encodeURIComponent(item.gamePk)}"><strong>${esc(item.matchup)}</strong></a>
              <span style="color:var(--muted);">${esc(item.inning)}</span>
              <span>${esc(item.reviewType)}</span>
              ${item.runsAtRisk ? '<span class="badge badge-risk">Runs at Risk</span>' : ''}
            </div>
            <div class="feed-card-body">${esc(item.description)}</div>
          </article>
        `;
      })
      .join('');
  }

  async function scanDate() {
    const picker = $('date-picker');
    const label = $('date-label');
    if (picker) picker.value = currentDate;
    if (label) label.textContent = formatDateLabel(currentDate);

    // Restore cached log first
    const cached = loadDateLog(currentDate);
    if (cached.length && !feedItems.length) {
      feedItems = cached;
      renderSummary();
      renderActiveStrip();
      renderList();
    }

    setStatus('Scanning MLB schedule & live feeds…');
    showBanner('');

    try {
      const sched = await getSchedule(currentDate);
      const games = (sched.dates && sched.dates[0] && sched.dates[0].games) || [];
      const activeOrDone = games.filter((g) => {
        const st = g.status?.abstractGameState;
        return st === 'Live' || st === 'Final';
      });

      const prevIds = new Set(feedItems.map((i) => i.id));
      const collected = [];

      const feeds = await Promise.all(
        activeOrDone.map((g) => getGameFeed(g.gamePk).catch(() => null))
      );
      for (const f of feeds) {
        if (!f) continue;
        collected.push(...extractGameReviews(f));
      }

      collected.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      const hasNew = collected.some((i) => !prevIds.has(i.id));
      if (hasNew && prevIds.size > 0) {
        playRaindropChime();
      }

      feedItems = collected;
      saveDateLog(currentDate, feedItems);
      renderSummary();
      renderActiveStrip();
      renderTabs();
      renderList();
      setStatus(`Updated ${new Date().toLocaleTimeString()} · Scanned ${activeOrDone.length} game(s)`);
    } catch (err) {
      showBanner(`Unable to scan MLB StatsAPI: ${err.message}`, true);
      setStatus('Error scanning feeds');
    }
  }

  function startLoop() {
    if (tickTimer) clearInterval(tickTimer);
    countdown = 20;
    const cdEl = $('countdown');
    tickTimer = setInterval(() => {
      countdown--;
      if (cdEl) cdEl.textContent = `${countdown}s`;
      if (countdown <= 0) {
        countdown = 20;
        scanDate();
      }
    }, 1000);
  }

  const ReplayFeed = {
    prevDay() {
      currentDate = shiftDate(currentDate, -1);
      feedItems = [];
      scanDate();
    },
    nextDay() {
      currentDate = shiftDate(currentDate, 1);
      feedItems = [];
      scanDate();
    },
    pickDate() {
      const picker = $('date-picker');
      if (picker && picker.value) {
        currentDate = picker.value;
        feedItems = [];
        scanDate();
      }
    },
    today() {
      currentDate = todayStr();
      feedItems = [];
      scanDate();
    }
  };

  global.ReplayFeed = ReplayFeed;

  document.addEventListener('DOMContentLoaded', () => {
    const soundBtn = $('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        soundOn = !soundOn;
        soundBtn.textContent = soundOn ? '🔊 Sound On' : '🔇 Sound Off';
        soundBtn.classList.toggle('btn-active', soundOn);
      });
    }

    const notifyBtn = $('notify-toggle-btn');
    if (notifyBtn) {
      notifyBtn.addEventListener('click', async () => {
        if (!notifyOn && 'Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        notifyOn = !notifyOn;
        notifyBtn.textContent = notifyOn ? '🟢 Run Alerts On' : '⚪ Run Alerts Off';
        notifyBtn.classList.toggle('btn-active', notifyOn);
      });
    }

    const refreshBtn = $('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        countdown = 20;
        scanDate();
      });
    }

    renderTabs();
    scanDate();
    startLoop();
  });
})(window);
