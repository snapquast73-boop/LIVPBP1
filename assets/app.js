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
  pollTimer;
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
    link(card, "Game details", "game.html?gamePk=" + encodeURIComponent(game));
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
function reviews(p) {
  return [p.result, ...(p.playEvents ?? []).map((e) => e.details)].filter(
    (x) => x?.description && /challenge|review/i.test(x.description),
  );
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
      el("date-picker").value = date;
      if (el("date-label").textContent !== date) {
        (el("game-list") || el("feed-list")).replaceChildren();
        text("status-line", "");
      }
      text("date-label", date);
      const url = `${mlb}/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore`;
      const data = await get(url, signal);
      if (v !== revision) return;
      const games = (data.dates ?? []).flatMap((d) => d.games ?? []);
      const list = el("game-list") || el("feed-list");
      list.replaceChildren();
      let failed = 0;
      for (const g of games) {
        const names = ["away", "home"]
          .map((k) =>
            [g.teams?.[k]?.team?.name, g.teams?.[k]?.score]
              .filter((x) => x != null)
              .join(" "),
          )
          .join(" at ");
        if (el("game-list"))
          row(
            list,
            `${names} · ${g.status?.detailedState ?? ""}`,
            url,
            g.gamePk,
          );
        else if (g.gamePk) {
          try {
            const d = await get(feed(g.gamePk), signal);
            if (v !== revision) return;
            for (const p of plays(d).slice().reverse())
              for (const x of reviews(p))
                row(
                  list,
                  names + " · " + x.description,
                  feed(g.gamePk),
                  g.gamePk,
                );
          } catch {
            if (v !== revision) return;
            failed++;
          }
        }
      }
      if (!list.children.length)
        text(
          list.id,
          failed
            ? "No review entries loaded."
            : games.length
              ? "No review descriptions reported."
              : "No games scheduled.",
        );
      text("banner", failed ? `${failed} game feeds unavailable.` : "");
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
      lines(
        "reviews-wrap",
        ps.flatMap(reviews).map((x) => x.description),
        url,
      );
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
if (el("refresh-btn")) el("refresh-btn").onclick = refresh;
for (const id of ["notify-toggle-btn", "sound-toggle-btn"])
  if (el(id)) {
    el(id).disabled = true;
    el(id).title = "Unavailable; see Flagged for Review.";
  }
refresh();
