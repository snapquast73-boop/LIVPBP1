(function (global) {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function teamLogoUrl(teamId) {
    if (!teamId) return '';
    return `https://www.mlbstatic.com/team-logos/${encodeURIComponent(teamId)}.svg`;
  }

  function headshotUrl(personId) {
    if (!personId) return '';
    return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/${encodeURIComponent(personId)}/headshot/67/current`;
  }

  function todayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function shiftDate(dateStr, deltaDays) {
    const parts = dateStr.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatGameTime(isoStr) {
    if (!isoStr) return 'TBD';
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return 'TBD';
    return dt.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function showBanner(msg, isError) {
    const el = $('banner');
    if (!el) return;
    if (!msg) {
      el.className = 'banner';
      el.textContent = '';
      return;
    }
    el.className = isError ? 'banner show error' : 'banner show';
    el.textContent = msg;
  }

  function setStatus(msg) {
    const el = $('status-line');
    if (el) el.textContent = msg || '';
  }

  global.MlbUi = {
    $,
    esc,
    teamLogoUrl,
    headshotUrl,
    todayStr,
    shiftDate,
    formatDateLabel,
    formatGameTime,
    showBanner,
    setStatus
  };
})(window);
