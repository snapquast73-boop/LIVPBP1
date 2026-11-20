(function (global) {
  'use strict';

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateLabel(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  function formatStartTime(isoDateTime) {
    if (!isoDateTime) return '';
    const dt = new Date(isoDateTime);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function showBanner(msg, isError) {
    const el = document.getElementById('banner');
    if (!el) return;
    if (!msg) {
      el.className = 'banner';
      el.textContent = '';
      return;
    }
    el.className = isError ? 'banner show error' : 'banner show';
    el.textContent = msg;
  }

  function setStatusLine(msg) {
    const el = document.getElementById('status-line');
    if (el) el.textContent = msg || '';
  }

  function gameStateBucket(game) {
    const code = game?.status?.abstractGameCode || game?.status?.abstractGameState;
    if (code === 'L' || code === 'Live') return 'live';
    if (code === 'F' || code === 'Final') return 'final';
    return 'preview';
  }

  function formatInningState(linescore) {
    if (!linescore || !linescore.currentInning) return '';
    const half = linescore.inningHalf || (linescore.isTopInning ? 'Top' : 'Bot');
    return `${half} ${linescore.currentInningOrdinal || linescore.currentInning}`;
  }

  global.MlbUi = {
    esc,
    formatDateLabel,
    formatStartTime,
    showBanner,
    setStatusLine,
    gameStateBucket,
    formatInningState
  };
})(window);
