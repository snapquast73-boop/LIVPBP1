(function (global) {
  'use strict';

  function extractReviewsFromFeed(feed) {
    const plays = feed?.liveData?.plays?.allPlays || [];
    const results = [];

    for (const play of plays) {
      const about = play.about || {};
      const result = play.result || {};
      const matchup = play.matchup || {};
      const reviewDetails = play.reviewDetails || null;

      if (reviewDetails) {
        results.push({
          id: `${feed.gamePk}-play-${about.atBatIndex}`,
          gamePk: feed.gamePk,
          atBatIndex: about.atBatIndex,
          inning: about.inning,
          halfInning: about.halfInning,
          isTopInning: about.isTopInning,
          type: reviewDetails.reviewType || 'Replay Review',
          isOverturned: Boolean(reviewDetails.isOverturned),
          inProgress: Boolean(reviewDetails.inProgress),
          challengeTeamId: reviewDetails.challengeTeamId || null,
          description: result.description || '',
          batter: matchup.batter?.fullName || '',
          pitcher: matchup.pitcher?.fullName || '',
          awayScore: result.awayScore,
          homeScore: result.homeScore
        });
      }

      const events = play.playEvents || [];
      for (const ev of events) {
        if (ev.reviewDetails) {
          results.push({
            id: `${feed.gamePk}-play-${about.atBatIndex}-ev-${ev.index}`,
            gamePk: feed.gamePk,
            atBatIndex: about.atBatIndex,
            inning: about.inning,
            halfInning: about.halfInning,
            isTopInning: about.isTopInning,
            type: ev.reviewDetails.reviewType || 'ABS / Pitch Challenge',
            isOverturned: Boolean(ev.reviewDetails.isOverturned),
            inProgress: Boolean(ev.reviewDetails.inProgress),
            challengeTeamId: ev.reviewDetails.challengeTeamId || null,
            description: ev.details?.description || result.description || '',
            batter: matchup.batter?.fullName || '',
            pitcher: matchup.pitcher?.fullName || '',
            awayScore: result.awayScore,
            homeScore: result.homeScore
          });
        }
      }
    }

    return results;
  }

  function getChallengeCounters(feed) {
    const review = feed?.gameData?.review || feed?.liveData?.boxscore?.info || null;
    if (!review || (!review.away && !review.home)) return null;
    return {
      away: review.away || null,
      home: review.home || null
    };
  }

  global.MlbReviews = {
    extractReviewsFromFeed,
    getChallengeCounters
  };
})(window);
