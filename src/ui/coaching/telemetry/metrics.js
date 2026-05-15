function count(events = [], type) {
  return events.filter((event) => event.type === type).length;
}

function uniqueLessons(events = []) {
  return new Set(events.map((event) => event.lessonId).filter(Boolean)).size;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

function timestampMs(event) {
  const parsed = Date.parse(event?.timestamp ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeCoachingEngagementMetrics(events = []) {
  const shown = count(events, "LESSON_SHOWN");
  const opened = count(events, "LESSON_OPENED");
  const replayOpened = count(events, "REPLAY_OPENED");
  const replayCompleted = count(events, "REPLAY_COMPLETED");
  const helpful = count(events, "LESSON_HELPFUL");
  const notHelpful = count(events, "LESSON_NOT_HELPFUL");
  const dismissed = count(events, "LESSON_DISMISSED");
  const acknowledged = count(events, "LESSON_ACKNOWLEDGED");
  const sessionStarts = events.filter((event) => event.type === "REPLAY_OPENED");
  const durations = sessionStarts
    .map((start) => {
      const startMs = timestampMs(start);
      const completion = events.find(
        (event) =>
          event.type === "REPLAY_COMPLETED" &&
          event.lessonId === start.lessonId &&
          Number(event.sequence ?? 0) > Number(start.sequence ?? 0),
      );
      const endMs = timestampMs(completion);
      return startMs != null && endMs != null ? Math.max(0, endMs - startMs) / 1000 : null;
    })
    .filter(Number.isFinite);

  return {
    eventCount: events.length,
    uniqueLessons: uniqueLessons(events),
    counts: {
      LESSON_SHOWN: shown,
      LESSON_OPENED: opened,
      REPLAY_OPENED: replayOpened,
      REPLAY_COMPLETED: replayCompleted,
      LESSON_ACKNOWLEDGED: acknowledged,
      LESSON_DISMISSED: dismissed,
      LESSON_HELPFUL: helpful,
      LESSON_NOT_HELPFUL: notHelpful,
    },
    lessonOpenRate: ratio(opened, shown),
    replayOpenRate: ratio(replayOpened, shown),
    replayCompletionRate: ratio(replayCompleted, replayOpened),
    helpfulRate: ratio(helpful, helpful + notHelpful),
    dismissRate: ratio(dismissed, shown),
    avgReplayViewDuration: durations.length
      ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(4))
      : 0,
    coachingInteractionRate: ratio(
      opened + replayOpened + acknowledged + helpful + notHelpful,
      Math.max(shown, 1),
    ),
  };
}
