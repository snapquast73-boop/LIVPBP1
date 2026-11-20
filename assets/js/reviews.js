(function (global) {
  'use strict';

  function extractGameReviews(feed) {
    if (!feed || !feed.liveData || !feed.liveData.plays) return [];
    const gameData = feed.gameData || {};
    const gamePk = feed.gamePk || gameData.game?.pk;
    const awayTeam = gameData.teams?.away?.abbreviation || 'AWY';
    const homeTeam = gameData.teams?.home?.abbreviation || 'HOM';
    const matchup = `${awayTeam} @ ${homeTeam}`;
    const allPlays = feed.liveData.plays.allPlays || [];
    const items = [];

    for (const play of allPlays) {
      const about = play.about || {};
      const result = play.result || {};
      const inningLabel = `${about.halfInning === 'top' ? 'Top' : 'Bot'} ${about.inning || ''}`.trim();
      const events = play.playEvents || [];

      // 1. Play-level reviewDetails
      if (play.reviewDetails) {
        const rd = play.reviewDetails;
        const isOverturned = rd.isOverturned === true;
        const inProgress = rd.inProgress === true;
        const runsAtRisk = (play.runners || []).some(
          (r) => r.movement && r.movement.isOut === false && r.details && r.details.isScoringEvent
        );
        items.push({
          id: `${gamePk}-play-${about.atBatIndex}-review`,
          gamePk,
          matchup,
          category: 'challenge',
          inning: inningLabel,
          inProgress,
          isOverturned,
          runsAtRisk: inProgress && runsAtRisk,
          reviewType: rd.reviewType || 'Manager Challenge',
          challengeTeamId: rd.challengeTeamId || null,
          description: result.description || 'Play under review',
          timestamp: about.endTime || about.startTime || null
        });
      }

      // 2. Event-level reviewDetails / ABS / OS pending rulings
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const details = ev.details || {};
        const eventType = details.eventType || '';

        if (ev.reviewDetails) {
          const rd = ev.reviewDetails;
          const isAbs = rd.reviewType === 'ABS' || /abs/i.test(String(rd.reviewType || ''));
          items.push({
            id: `${gamePk}-ev-${about.atBatIndex}-${i}-review`,
            gamePk,
            matchup,
            category: isAbs ? 'abs' : 'challenge',
            inning: inningLabel,
            inProgress: rd.inProgress === true,
            isOverturned: rd.isOverturned === true,
            runsAtRisk: false,
            reviewType: rd.reviewType || (isAbs ? 'ABS Pitch Challenge' : 'Replay Review'),
            challengeTeamId: rd.challengeTeamId || null,
            description: details.description || result.description || 'Event under review',
            timestamp: ev.endTime || ev.startTime || about.startTime || null
          });
        }

        if (
          eventType === 'os_ruling_pending_primary' ||
          eventType === 'os_ruling_pending_prior'
        ) {
          items.push({
            id: `${gamePk}-os-${about.atBatIndex}-${i}`,
            gamePk,
            matchup,
            category: 'os_pending',
            inning: inningLabel,
            inProgress: true,
            isOverturned: false,
            runsAtRisk: false,
            reviewType: 'Official Scorer Ruling Pending',
            challengeTeamId: null,
            description: details.description || result.description || 'Official Scorer Ruling Pending',
            timestamp: ev.endTime || ev.startTime || about.startTime || null
          });
        }
      }
    }

    return items;
  }

  function extractChallengeCounters(feed) {
    const gd = (feed && feed.gameData) || {};
    const review = gd.review || null;
    const abs = gd.absChallenges || null;
    return {
      awayRemaining: review?.away?.remaining ?? null,
      awayUsed: review?.away?.used ?? null,
      homeRemaining: review?.home?.remaining ?? null,
      homeUsed: review?.home?.used ?? null,
      absAwayRemaining: abs?.away?.remaining ?? null,
      absHomeRemaining: abs?.home?.remaining ?? null
    };
  }

  global.MlbReviews = {
    extractGameReviews,
    extractChallengeCounters
  };
})(window);
