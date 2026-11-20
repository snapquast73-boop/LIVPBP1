"use strict";
const el = (id) => document.getElementById(id),
  mlb = "https://statsapi.mlb.com";
const localDate = (d) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
let date = localDate(new Date()),
  revision = 0,
  controller,
  pollTimer,
  displayedDate,
  replayScan,
  replayFilter = "all";
const requested = new URLSearchParams(location.search).get("date");
if (/^\d{4}-\d{2}-\d{2}$/.test(requested ?? "") &&
    localDate(new Date(requested + "T12:00:00")) === requested) date = requested;
function syncNavigation() {
  for (const a of document.querySelectorAll('a[href^="index.html"], a[href^="reviews.html"]')) {
    const url = new URL(a.href);
    url.searchParams.set("date", date);
    a.href = url.href;
  }
}
syncNavigation();
const text = (id, s) => {
  if (el(id)) el(id).textContent = s ?? "";
};
function link(parent, label, url) {
  const a = document.createElement("a");
  a.href = url;
  a.textContent = label;
  parent.append(a);
}
function row(parent, label, url, game) {
  const card = document.createElement("article");
  card.append(document.createTextNode(label + " "));
  if (game)
    link(card, "Game details", "game.html?gamePk=" + encodeURIComponent(game) + "&date=" + date);
  link(card, "MLB source", url);
  parent.append(card);
}
async function get(url, signal) {
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) request.abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const r = await fetch(url, { signal: request.signal });
    if (!r.ok) throw Error("MLB HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
const feed = (id) => `${mlb}/api/v1.1/game/${id}/feed/live`;
const plays = (data) => data.liveData?.plays?.allPlays ?? [];
const pendingCodes = new Set(["os_ruling_pending_primary", "os_ruling_pending_prior"]);
const replayFilters = [
  ["all", "All", () => true],
  ["replay", "Reviews & Challenges", (r) => r.kind === "replay"],
  ["abs", "ABS Challenges", (r) => r.kind === "abs"],
  ["pending", "Scorer Pending", (r) => r.kind === "pending"],
  ["active", "Under Review", (r) => r.active],
];
function reviewRows(data, game) {
  const entries = [];
  const url = feed(game);
  const teams = data.gameData?.teams;
  for (const p of plays(data).slice().reverse()) {
    const seen = new Set();
    const context = [teams?.away?.name, teams?.home?.name].filter(Boolean).join(" at ");
    const inning = [p.about?.halfInning, p.about?.inning].filter(x => x != null).join(" ");
    const add = (details, info) => {
      for (const d of Array.isArray(details) ? details : [details]) {
        if (!d || typeof d !== "object" || !Object.keys(d).length) continue;
        if (d.id != null) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
        }
        // MJ was cross-checked with MLB's own ABS clip for game 822974.
        // Other codes stay opaque; don't reconstruct their labels from prefixes.
        const code = d.reviewType;
        const kind = code === "MJ" ? "abs" : "replay";
        const active = d.inProgress === true;
        const outcome = active ? "Under review" : d.inProgress === false
          ? d.isOverturned === true ? "Overturned" : d.isOverturned === false ? "Not overturned" : ""
          : "";
        entries.push({ context, inning, kind, active, outcome, code, url, game,
          description: info?.description, missing: !outcome || !info?.description || !code });
      }
      if (pendingCodes.has(info?.eventType)) {
        entries.push({ context, inning, kind: "pending", code: info.eventType, url, game,
          description: info.description, missing: !info.description });
      }
    };
    add(p.reviewDetails, p.result);
    for (const event of (p.playEvents ?? []).slice().reverse()) add(event.reviewDetails, event.details);
  }
  return entries;
}
function renderReviewRow(list, entry, detailsLink = false) {
  const { context, inning, kind, code, outcome, description, missing, url, game } = entry;
  const label = { replay: "Replay review", abs: "ABS challenge", pending: "Official Scorer Ruling Pending" }[kind];
  const line = [context, inning, label, code, outcome, description,
    missing ? "Some fields unverified or not reported" : ""].filter(Boolean).join(" · ");
  row(list, line, url, detailsLink ? game : undefined);
}
function renderReplay() {
  const list = el("feed-list"), stats = el("feed-stats");
  if (!replayScan || replayScan.date !== date) return;
  const { entries, total, failed } = replayScan;
  const [, , includes] = replayFilters.find(([key]) => key === replayFilter);
  const visible = entries.filter(includes);
  list.replaceChildren();
  for (const entry of visible) renderReviewRow(list, entry, true);
  if (!visible.length) list.textContent = failed
    ? "No matching entries in the available feeds."
    : total ? "No matching review events for this date/filter." : "No games scheduled.";
  if (failed === total && failed) list.textContent = "No review entries loaded.";
  stats.textContent = failed ? "Totals unverified: some game feeds are unavailable."
    : replayFilters.slice(1).map(([, label, match]) => `${label}: ${entries.filter(match).length}`).join(" · ");
  for (const b of el("feed-tabs").querySelectorAll("button")) {
    b.setAttribute("aria-pressed", String(b.dataset.filter === replayFilter));
    b.classList.toggle("tab-on", b.dataset.filter === replayFilter);
  }
}
async function scanReplay(games, signal) {
  let next = 0;
  const results = [];
  async function worker() {
    while (!signal.aborted && next < games.length) {
      const i = next++;
      const id = games[i]?.gamePk;
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      try {
        const data = await get(feed(id), signal);
        if (data.gamePk !== id || !Array.isArray(data.liveData?.plays?.allPlays)) continue;
        results[i] = reviewRows(data, id);
      } catch { /* Report unavailable game feeds separately from an empty feed. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, games.length) }, worker));
  return { entries: results.flat(), total: games.length, failed: games.length - results.filter(Boolean).length };
}
function renderGameReviews(data, url, id) {
  const list = el("reviews-wrap");
  list.replaceChildren();
  if (!Array.isArray(data.liveData?.plays?.allPlays)) {
    list.textContent = "Review entries unverified: play feed unavailable.";
    return;
  }
  for (const entry of reviewRows(data, id)) renderReviewRow(list, entry);
  for (const [key, label, fields] of [
    ["review", "Replay challenge counters", [["used", "used"], ["remaining", "remaining"]]],
    ["absChallenges", "ABS challenge counters", [["usedSuccessful", "successful"], ["usedFailed", "unsuccessful"], ["remaining", "remaining"]]],
  ]) {
    for (const side of ["away", "home"]) {
      const values = data.gameData?.[key]?.[side];
      const present = ([field]) => Number.isSafeInteger(values?.[field]) && values[field] >= 0;
      if (!fields.some(present)) continue;
      const counters = fields.map(([field, caption]) => `${caption}: ${present([field]) ? values[field] : ""}`).join(" · ");
      row(list, `${label} (${side}) · ${counters}${fields.every(present) ? "" : " · Missing values unverified"}`, url);
    }
  }
  if (!list.children.length) list.textContent = "No review entries or challenge counters reported.";
}
function lines(id, rows, url) {
  const p = el(id);
  p.replaceChildren();
  for (const s of rows) row(p, s, url);
  if (!rows.length) p.textContent = "No entries reported.";
}
async function refresh() {
  clearTimeout(pollTimer);
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const v = ++revision;
  text("banner", "Loading MLB data…");
  try {
    if (el("date-picker")) {
      syncNavigation();
      if (displayedDate !== date) {
        (el("game-list") || el("feed-list")).replaceChildren();
        text("status-line", "");
        text("feed-stats", "");
        replayScan = undefined;
        displayedDate = date;
      }
      el("date-picker").value = date;
      text("date-label", date);
      const url = `${mlb}/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore`;
      const data = await get(url, signal);
      if (v !== revision) return;
      if (!Array.isArray(data.dates) || data.dates.some(d => d.date !== date || !Array.isArray(d.games)))
        throw Error("Schedule date or game list unverified.");
      const games = data.dates.flatMap(d => d.games);
      const list = el("game-list") || el("feed-list");
      if (el("game-list")) {
        list.replaceChildren();
        for (const g of games) {
          const names = ["away", "home"]
            .map((k) => [g.teams?.[k]?.team?.name, g.teams?.[k]?.score]
              .filter((x) => x != null).join(" "))
            .join(" at ");
          row(list, `${names} · ${g.status?.detailedState ?? ""}`, url, g.gamePk);
        }
        if (!list.children.length) text(list.id, "No games scheduled.");
        text("banner", "");
      } else {
        const scan = await scanReplay(games, signal);
        if (v !== revision) return;
        replayScan = { ...scan, date };
        renderReplay();
        text("banner", scan.failed ? `${scan.failed} game feed${scan.failed === 1 ? "" : "s"} unavailable.` : "");
        text("status-line", `Last updated ${new Date().toLocaleTimeString()} · Scanned ${scan.total - scan.failed}/${scan.total} games`);
        return;
      }
    } else {
      const q = new URLSearchParams(location.search),
        id = q.get("gamePk") || q.get("game");
      if (!/^\d+$/.test(id ?? ""))
        throw Error("Choose a game from the scoreboard.");
      const url = feed(id),
        d = await get(url, signal);
      if (v !== revision) return;
      const live = d.liveData ?? {},
        game = d.gameData ?? {},
        ps = plays(d);
      for (const side of ["away", "home"])
        text(
          "header-" + side,
          [game.teams?.[side]?.name, live.linescore?.teams?.[side]?.runs]
            .filter((x) => x != null)
            .join(" "),
        );
      text("header-center", game.status?.detailedState);
      el("header-meta").replaceChildren();
      link(el("header-meta"), "MLB source for game status and current play", url);
      text("live-panel", live.plays?.currentPlay?.result?.description);
      lines(
        "plays-wrap",
        ps
          .slice()
          .reverse()
          .map((p) => p.result?.description)
          .filter(Boolean),
        url,
      );
      renderGameReviews(d, url, id);
      lines(
        "linescore-wrap",
        (live.linescore?.innings ?? []).map(
          (i) =>
            `Inning ${i.num ?? ""}: ${i.away?.runs ?? ""} – ${i.home?.runs ?? ""}`,
        ),
        url,
      );
      lines(
        "boxscore-wrap",
        ["away", "home"].flatMap((side) =>
          Object.values(live.boxscore?.teams?.[side]?.players ?? {})
            .filter((p) => p.stats?.batting?.atBats != null)
            .map(
              (p) =>
                `${p.person?.fullName ?? ""} · AB ${p.stats.batting.atBats} · H ${p.stats.batting.hits ?? ""}`,
            ),
        ),
        url,
      );
      text("props-wrap", "Forecast unavailable; see Flagged for Review.");
      text("banner", "");
    }
    text("status-line", "Last updated " + new Date().toLocaleTimeString());
  } catch (e) {
    if (v === revision) {
      text("banner", "Unable to update: " + e.message);
      text(
        "status-line",
        "Displayed data, if any, is from the last successful request.",
      );
    }
  } finally {
    // Manual refreshes reset polling; an obsolete request must not add a timer.
    if (v === revision) pollTimer = setTimeout(refresh, 30000);
  }
}
function shift(n) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  date = localDate(d);
  refresh();
}
window.Scoreboard = window.ReplayFeed = {
  prevDay: () => shift(-1),
  nextDay: () => shift(1),
  today: () => {
    date = localDate(new Date());
    refresh();
  },
  pickDate: () => {
    if (el("date-picker").value) {
      date = el("date-picker").value;
      refresh();
    }
  },
};
for (const b of document.querySelectorAll("[data-tab]"))
  b.onclick = () => {
    for (const t of document.querySelectorAll("[data-tab]")) {
      el("panel-" + t.dataset.tab).style.display = t === b ? "" : "none";
      t.classList.toggle("tab-on", t === b);
    }
  };
if (el("feed-tabs")) {
  for (const [key, label] of replayFilters) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filter = key;
    button.textContent = label;
    button.setAttribute("aria-pressed", String(key === replayFilter));
    button.classList.toggle("tab-on", key === replayFilter);
    button.onclick = () => { replayFilter = key; renderReplay(); };
    el("feed-tabs").append(button);
  }
}
if (el("refresh-btn")) el("refresh-btn").onclick = refresh;
for (const id of ["notify-toggle-btn", "sound-toggle-btn"])
  if (el(id)) {
    el(id).disabled = true;
    el(id).title = "Unavailable; see Flagged for Review.";
  }
refresh();
