const events = [];
let sessionStart = null;

export function startSession() {
  events.length = 0;
  sessionStart = performance.now();
}

export function recordHit({ bubbleRadius, wristPos, latencyMs = null }) {
  events.push({
    type:         'hit',
    timestamp:    _elapsed(),
    latencyMs,
    bubbleRadius,
    wristPos,
  });
}

export function recordMiss({ bubbleRadius, wristPos }) {
  events.push({
    type:         'miss',
    timestamp:    _elapsed(),
    latencyMs:    null,
    bubbleRadius,
    wristPos,
  });
}

export function getSessionData() {
  return [...events];
}

export function getSessionSummary() {
  const hits   = events.filter((e) => e.type === 'hit');
  const misses = events.filter((e) => e.type === 'miss');
  const total  = hits.length + misses.length;

  const validLatencies = hits.map((e) => e.latencyMs).filter((l) => l !== null);
  const avgLatencyMs   = validLatencies.length
    ? Math.round(validLatencies.reduce((s, l) => s + l, 0) / validLatencies.length)
    : 0;

  return {
    totalHits:         hits.length,
    totalMisses:       misses.length,
    accuracy:          total ? hits.length / total : 0,
    avgLatencyMs,
    finalBubbleRadius: events.at(-1)?.bubbleRadius ?? 120,
    durationSeconds:   Math.round(_elapsed() / 1000),
    events,
  };
}

export function resetSession() {
  events.length = 0;
  sessionStart  = null;
}

function _elapsed() {
  return sessionStart ? Math.round(performance.now() - sessionStart) : 0;
}
