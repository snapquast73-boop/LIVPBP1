(function (global) {
  'use strict';

  const STORAGE_PREFIX = 'mlb_live_pbp_log_';
  const MAX_DATES = 7;
  const MAX_ROWS = 500;

  function loadLog(dateIso) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + dateIso);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      console.warn('FeedLog: malformed log dropped for', dateIso, err);
      return [];
    }
  }

  function saveLog(dateIso, rows) {
    try {
      const trimmed = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
      localStorage.setItem(STORAGE_PREFIX + dateIso, JSON.stringify(trimmed));
      pruneOldDates();
    } catch (err) {
      console.warn('FeedLog: unable to save log', err);
    }
  }

  function pruneOldDates() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      keys.sort().reverse();
      for (let i = MAX_DATES; i < keys.length; i++) {
        localStorage.removeItem(keys[i]);
      }
    } catch (_) {}
  }

  function playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (_) {}
  }

  global.FeedLog = {
    loadLog,
    saveLog,
    playChime
  };
})(window);
