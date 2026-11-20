(function (global) {
  'use strict';

  const PREFIX = 'mlb_pbp_feed_log_';
  const MAX_DATES = 7;
  const MAX_ROWS = 500;

  function loadDateLog(dateStr) {
    try {
      const raw = localStorage.getItem(PREFIX + dateStr);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('[feed-log] Malformed log for', dateStr, '— dropping.');
        return [];
      }
      return parsed;
    } catch (err) {
      console.warn('[feed-log] Failed to read log for', dateStr, err);
      return [];
    }
  }

  function saveDateLog(dateStr, rows) {
    try {
      const trimmed = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
      localStorage.setItem(PREFIX + dateStr, JSON.stringify(trimmed));
      pruneOldDates();
    } catch (err) {
      console.warn('[feed-log] Failed to save log for', dateStr, err);
    }
  }

  function pruneOldDates() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.sort().reverse();
      for (let i = MAX_DATES; i < keys.length; i++) {
        localStorage.removeItem(keys[i]);
      }
    } catch (_) {
      // ignore storage quota / access errors
    }
  }

  global.FeedLog = {
    loadDateLog,
    saveDateLog
  };
})(window);
