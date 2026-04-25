const DEFAULT_BOUNDS = () => ({ minX: 1, maxX: 0, minY: 1, maxY: 0 });

// Populated by runCalibration(); reset each new scan.
export const goldenBounds = {
  left:  DEFAULT_BOUNDS(),
  right: DEFAULT_BOUNDS(),
};

// 'idle' | 'scanning' | 'done'
let _phase = 'idle';

export function getPhase() {
  return _phase;
}

// Called by poseEngine on every frame. No-op unless scan is active.
export function recordFrame(leftWrist, rightWrist) {
  if (_phase !== 'scanning') return;
  _expand(goldenBounds.left,  leftWrist);
  _expand(goldenBounds.right, rightWrist);
}

function _expand(b, wrist) {
  if (wrist.x < b.minX) b.minX = wrist.x;
  if (wrist.x > b.maxX) b.maxX = wrist.x;
  if (wrist.y < b.minY) b.minY = wrist.y;
  if (wrist.y > b.maxY) b.maxY = wrist.y;
}

// Clamps wrist to [0, 1] relative to the recorded Golden Bounds.
export function normalizeWrist(wrist, side) {
  const b = goldenBounds[side];
  const rangeX = b.maxX - b.minX || 1;
  const rangeY = b.maxY - b.minY || 1;
  return {
    x: Math.min(1, Math.max(0, (wrist.x - b.minX) / rangeX)),
    y: Math.min(1, Math.max(0, (wrist.y - b.minY) / rangeY)),
  };
}

// Starts a timed Reach Scan. Resolves with goldenBounds when done.
export function runCalibration(durationMs = 10_000) {
  Object.assign(goldenBounds.left,  DEFAULT_BOUNDS());
  Object.assign(goldenBounds.right, DEFAULT_BOUNDS());
  _phase = 'scanning';
  console.log(`[Calibration] Reach Scan started — ${durationMs / 1000}s. Reach as far as you can!`);

  return new Promise((resolve) => {
    setTimeout(() => {
      _phase = 'done';
      console.log('[Calibration] Golden Bounds recorded:', JSON.stringify(goldenBounds));
      resolve(goldenBounds);
    }, durationMs);
  });
}
