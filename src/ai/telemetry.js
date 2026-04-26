// src/ai/telemetry.js
// Session telemetry: collects frame-by-frame movement data and discrete
// gameplay events, then computes a structured summary for the AI report.

let _movements    = [];   // frame snapshots from logMovement()
let _targetEvents = [];   // hit / miss / hold events from logTargetEvent()
let _sessionStart = null;

/** Call once when a game round begins. Clears any previous session data. */
export function startSession() {
  _movements    = [];
  _targetEvents = [];
  _sessionStart = performance.now();
}

/**
 * Log one frame of pose data. Call from the game loop or poseEngine callback —
 * typically 30–60 times per second.
 * @param {{ hipX, leftWrist, rightWrist, bubbleRadius }} poseData
 */
export function logMovement(poseData) {
  if (!_sessionStart) return;
  _movements.push({
    t:    _elapsed(),
    hipX: poseData.hipX,
    lw:   { x: poseData.leftWrist.x,  y: poseData.leftWrist.y  },
    rw:   { x: poseData.rightWrist.x, y: poseData.rightWrist.y },
    br:   poseData.bubbleRadius,
  });
}

/**
 * Log a discrete gameplay event.
 * @param {'hit'|'miss'|'hold_start'|'hold_end'} type
 * @param {Object} details  e.g. { latencyMs, wristPos, bubbleRadius, targetId }
 */
export function logTargetEvent(type, details = {}) {
  if (!_sessionStart) return;
  _targetEvents.push({ type, t: _elapsed(), ...details });
}

/**
 * Finalise the session and return structured telemetry.
 * Pass the returned object directly into generateReport().
 * @returns {{ summary: Object, movements: Array, targetEvents: Array }}
 */
export function endSession() {
  return _buildTelemetry();
}

// ─── Backward-compat shims ───────────────────────────────────────────────────
// Existing game code that calls recordHit / recordMiss continues to work.

export function recordHit({ bubbleRadius, wristPos, latencyMs = null }) {
  logTargetEvent('hit', { bubbleRadius, wristPos, latencyMs });
}

export function recordMiss({ bubbleRadius, wristPos }) {
  logTargetEvent('miss', { bubbleRadius, wristPos });
}

export function getSessionData() {
  return [..._targetEvents];
}

export function resetSession() {
  startSession();
}

/** Returns legacy summary shape for older reportGenerator callers. */
export function getSessionSummary() {
  return _buildTelemetry().summary;
}

// ─── Internal ────────────────────────────────────────────────────────────────

function _elapsed() {
  return _sessionStart ? Math.round(performance.now() - _sessionStart) : 0;
}

function _buildTelemetry() {
  const hits   = _targetEvents.filter(e => e.type === 'hit');
  const misses = _targetEvents.filter(e => e.type === 'miss');
  const total  = hits.length + misses.length;

  const latencies    = hits.map(e => e.latencyMs).filter(l => l != null);
  const avgLatencyMs = latencies.length
    ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
    : 0;

  const lastMovement = _movements[_movements.length - 1];

  const summary = {
    durationSeconds:   Math.round(_elapsed() / 1000),
    totalHits:         hits.length,
    totalMisses:       misses.length,
    accuracy:          total ? hits.length / total : 0,
    avgLatencyMs,
    finalBubbleRadius: lastMovement?.br ?? 120,
    rangeOfMotion:     _calcRangeOfMotion(),
    fatigue:           _calcFatigue(hits, misses),
    bubbleChanges:     _calcBubbleChanges(),
  };

  return { summary, movements: _movements, targetEvents: _targetEvents };
}

function _calcRangeOfMotion() {
  if (!_movements.length) return null;

  const span = arr => ({ min: _min(arr), max: _max(arr), range: _max(arr) - _min(arr) });

  return {
    hipX:       span(_movements.map(m => m.hipX)),
    leftWrist:  { x: span(_movements.map(m => m.lw.x)), y: span(_movements.map(m => m.lw.y)) },
    rightWrist: { x: span(_movements.map(m => m.rw.x)), y: span(_movements.map(m => m.rw.y)) },
  };
}

function _calcFatigue(hits, misses) {
  const all = [
    ...hits.map(e  => ({ t: e.t, hit: true  })),
    ...misses.map(e => ({ t: e.t, hit: false })),
  ].sort((a, b) => a.t - b.t);

  if (all.length < 8) return { insufficientData: true };

  const cut      = Math.max(1, Math.floor(all.length * 0.25));
  const earlyAcc = all.slice(0, cut).filter(e => e.hit).length / cut;
  const lateAcc  = all.slice(-cut).filter(e => e.hit).length / cut;

  return {
    earlyAccuracy:   +earlyAcc.toFixed(3),
    lateAccuracy:    +lateAcc.toFixed(3),
    accuracyDrop:    +(earlyAcc - lateAcc).toFixed(3),
    fatigueDetected: (earlyAcc - lateAcc) > 0.2,
  };
}

function _calcBubbleChanges() {
  return _movements
    .filter((m, i) => i === 0 || m.br !== _movements[i - 1].br)
    .map(m => ({ t: m.t, radius: m.br }));
}

const _min = arr => Math.min(...arr);
const _max = arr => Math.max(...arr);
