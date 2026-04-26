const targetEvents = [];
const frameSamples = [];

let sessionStart = null;
let sessionEnd   = null;

export function startSession() {
  targetEvents.length = 0;
  frameSamples.length = 0;
  sessionStart = performance.now();
  sessionEnd   = null;
}

export function stopSession() {
  if (!sessionStart) return;
  sessionEnd = performance.now();
}

export function recordFrameSample({
  hipX = 0.5,
  torsoX = 0.5,
  neckX = 0.5,
  leftWrist = { x: 0.5, y: 0.5 },
  rightWrist = { x: 0.5, y: 0.5 },
  bubbleRadius = 120,
} = {}) {
  if (!sessionStart) return;

  frameSamples.push({
    timestamp: _elapsed(),
    hipX,
    torsoX,
    neckX,
    leftWrist:  { x: leftWrist.x,  y: leftWrist.y  },
    rightWrist: { x: rightWrist.x, y: rightWrist.y },
    bubbleRadius,
  });
}

export function recordHit({ bubbleRadius, wristPos, latencyMs = null, hand = 'unknown' }) {
  _recordTargetEvent('hit', { bubbleRadius, wristPos, latencyMs, hand });
}

export function recordMiss({ bubbleRadius, wristPos, latencyMs = null, hand = 'unknown' }) {
  _recordTargetEvent('miss', { bubbleRadius, wristPos, latencyMs, hand });
}

export function getSessionData() {
  return {
    targetEvents: [...targetEvents],
    frameSamples: [...frameSamples],
    durationMs: _elapsed(),
  };
}

export function getSessionSummary() {
  const hits   = targetEvents.filter((e) => e.type === 'hit');
  const misses = targetEvents.filter((e) => e.type === 'miss');
  const total  = targetEvents.length;

  const validLatencies = hits
    .map((e) => e.latencyMs)
    .filter((l) => Number.isFinite(l) && l >= 0);
  const avgLatencyMs   = validLatencies.length
    ? Math.round(validLatencies.reduce((sum, value) => sum + value, 0) / validLatencies.length)
    : 0;

  const durationMs = _elapsed();
  const durationSeconds = Math.round(durationMs / 1000);

  const firstQuarter = _bucketAccuracy(0, 0.25, durationMs);
  const lastQuarter  = _bucketAccuracy(0.75, 1, durationMs);

  const leftRom  = _computeRom(frameSamples, 'leftWrist');
  const rightRom = _computeRom(frameSamples, 'rightWrist');
  const asymmetryIndexPct = _computeAsymmetryPct(leftRom.totalExcursion, rightRom.totalExcursion);

  const hipSway = _computeRange(frameSamples.map((f) => f.hipX));
  const bubble  = _computeBubbleTrends(frameSamples);
  const reactionTrend = _reactionTrend(hits, durationMs);

  const finalBubbleRadius = frameSamples.at(-1)?.bubbleRadius
    ?? targetEvents.at(-1)?.bubbleRadius
    ?? 120;

  return {
    totalHits: hits.length,
    totalMisses: misses.length,
    totalTargets: total,
    accuracy: total ? hits.length / total : 0,
    avgLatencyMs,
    finalBubbleRadius,
    durationSeconds,
    durationMs,
    frameCount: frameSamples.length,
    targetEvents,
    frameSamples,
    fatigue: {
      firstQuarterAccuracy: firstQuarter.accuracy,
      firstQuarterAttempts: firstQuarter.attempts,
      lastQuarterAccuracy: lastQuarter.accuracy,
      lastQuarterAttempts: lastQuarter.attempts,
      declinePctPoints: _round2((firstQuarter.accuracy - lastQuarter.accuracy) * 100),
      detected: firstQuarter.attempts >= 2 && lastQuarter.attempts >= 2
        ? (firstQuarter.accuracy - lastQuarter.accuracy) >= 0.12
        : false,
    },
    hipSway: {
      min: _round3(hipSway.min),
      max: _round3(hipSway.max),
      range: _round3(hipSway.range),
    },
    rangeOfMotion: {
      left: leftRom,
      right: rightRom,
      asymmetryIndexPct,
      dominantSide:
        leftRom.totalExcursion === rightRom.totalExcursion
          ? 'balanced'
          : (leftRom.totalExcursion > rightRom.totalExcursion ? 'left' : 'right'),
    },
    reactionTrend,
    bubble,
  };
}

export function resetSession() {
  targetEvents.length = 0;
  frameSamples.length = 0;
  sessionStart = null;
  sessionEnd   = null;
}

function _recordTargetEvent(type, { bubbleRadius, wristPos, latencyMs, hand }) {
  if (!sessionStart) return;
  targetEvents.push({
    type,
    timestamp: _elapsed(),
    latencyMs: Number.isFinite(latencyMs) ? Math.round(latencyMs) : null,
    hand,
    bubbleRadius,
    wristPos: wristPos ? { ...wristPos } : null,
  });
}

function _bucketAccuracy(startRatio, endRatio, durationMs) {
  if (!durationMs || targetEvents.length === 0) {
    return { attempts: 0, hits: 0, accuracy: 0 };
  }

  const start = durationMs * startRatio;
  const end   = durationMs * endRatio;
  const bucket = targetEvents.filter((e) => e.timestamp >= start && e.timestamp <= end);
  const hits = bucket.filter((e) => e.type === 'hit').length;
  const attempts = bucket.length;
  return {
    attempts,
    hits,
    accuracy: attempts ? hits / attempts : 0,
  };
}

function _computeRom(frames, key) {
  const xs = frames.map((f) => f[key]?.x).filter((v) => Number.isFinite(v));
  const ys = frames.map((f) => f[key]?.y).filter((v) => Number.isFinite(v));
  const xRange = _computeRange(xs).range;
  const yRange = _computeRange(ys).range;
  const totalExcursion = Math.sqrt((xRange * xRange) + (yRange * yRange));

  return {
    lateralExcursion: _round3(xRange),
    verticalExcursion: _round3(yRange),
    totalExcursion: _round3(totalExcursion),
  };
}

function _computeAsymmetryPct(a, b) {
  const maxVal = Math.max(a, b, 0.0001);
  return _round2((Math.abs(a - b) / maxVal) * 100);
}

function _computeRange(values) {
  if (!values.length) return { min: 0, max: 0, range: 0 };
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max, range: max - min };
}

function _reactionTrend(hits, durationMs) {
  const valid = hits.filter((e) => Number.isFinite(e.latencyMs) && e.latencyMs >= 0);
  if (!valid.length || !durationMs) {
    return {
      earlyAvgLatencyMs: 0,
      lateAvgLatencyMs: 0,
      deltaMs: 0,
      trend: 'insufficient-data',
    };
  }

  const split = durationMs * 0.5;
  const early = valid.filter((e) => e.timestamp <= split).map((e) => e.latencyMs);
  const late  = valid.filter((e) => e.timestamp > split).map((e) => e.latencyMs);
  const earlyAvg = _avg(early);
  const lateAvg  = _avg(late);
  const delta = Math.round(lateAvg - earlyAvg);

  let trend = 'stable';
  if (delta >= 120) trend = 'slower-late';
  else if (delta <= -120) trend = 'faster-late';

  return {
    earlyAvgLatencyMs: Math.round(earlyAvg),
    lateAvgLatencyMs: Math.round(lateAvg),
    deltaMs: delta,
    trend,
  };
}

function _computeBubbleTrends(frames) {
  if (!frames.length) {
    return { minRadius: 120, maxRadius: 120, changeCount: 0 };
  }

  let minRadius = frames[0].bubbleRadius ?? 120;
  let maxRadius = minRadius;
  let changeCount = 0;
  let prev = minRadius;

  for (const frame of frames) {
    const radius = frame.bubbleRadius ?? 120;
    if (radius < minRadius) minRadius = radius;
    if (radius > maxRadius) maxRadius = radius;
    if (radius !== prev) changeCount++;
    prev = radius;
  }

  return { minRadius, maxRadius, changeCount };
}

function _avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function _elapsed() {
  if (!sessionStart) return 0;
  const end = sessionEnd ?? performance.now();
  return Math.max(0, Math.round(end - sessionStart));
}

function _round2(value) {
  return Math.round(value * 100) / 100;
}

function _round3(value) {
  return Math.round(value * 1000) / 1000;
}
