import { Ship }           from './ship.js';
import { Arm }            from './arm.js';
import { MeteorManager }  from './meteor.js';
import { StardustManager } from './stardust.js';
import { addXP, getLevel, getSkin, reset as resetProgression } from './progression.js';
import { HUD }            from '../ui/hud.js';
import { poseData }       from '../tracking/poseInterface.js';
import { initPoseEngine, getPoseStream } from '../tracking/poseEngine.js';
import { runCalibration, goldenBounds } from '../tracking/calibration.js';
import { recordMiss, resetMissCount, getMissCount, recordCollection } from '../tracking/adaptiveBubble.js';
import {
  startSession as startTelemetrySession,
  stopSession as stopTelemetrySession,
  resetSession as resetTelemetrySession,
  recordFrameSample,
  recordHit as recordTelemetryHit,
  recordMiss as recordTelemetryMiss,
} from '../ai/telemetry.js';
import { startSessionRecording, stopSessionRecording, getLastRecordingError } from '../ai/sessionRecorder.js';
import { showReportModal } from '../ui/reportModal.js';

// ─── State Machine ────────────────────────────────────────────────────────────
export const GameState = {
  IDLE:        'idle',
  CALIBRATING: 'calibrating',
  PLAYING:     'playing',
  ENDED:       'ended',
};

export const MovementMode = {
  STANDING: 'standing',
  WHEELCHAIR: 'wheelchair',
};

let state = GameState.IDLE;
let movementMode = MovementMode.STANDING;

function setState(next) {
  state = next;
  document.body.classList.toggle('calibrating', next === GameState.CALIBRATING);
  window.dispatchEvent(new CustomEvent('nebula:game-state', { detail: { state: next } }));
}

function ensureDomRefs() {
  if (canvas && ctx && webcamEl) return true;
  canvas = document.getElementById('gameCanvas');
  webcamEl = document.getElementById('webcam');
  if (!canvas || !webcamEl) return false;
  ctx = canvas.getContext('2d');
  return Boolean(ctx);
}

function triggerPrimaryAction() {
  if (state === GameState.IDLE) {
    calibTimer = 0;
    setState(GameState.CALIBRATING);
    runCalibration(10_000).then(() => {
      if (state === GameState.CALIBRATING) {
        _applyCalibrationBounds();
        startSession();
      }
    });
  } else if (state === GameState.CALIBRATING) {
    startSession();   // dev bypass
  } else if (state === GameState.ENDED) {
    resetSession();
    setState(GameState.IDLE);
  }
}

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
let canvas = null;
let ctx    = null;

// ─── Game Objects ─────────────────────────────────────────────────────────────
const ship      = new Ship(0, 0);
const leftArm   = new Arm('left');
const rightArm  = new Arm('right');
const meteors   = new MeteorManager();
const stardust  = new StardustManager();
const hud       = new HUD();
let webcamEl  = null;

// ─── Session State ────────────────────────────────────────────────────────────
const MAX_HITS    = 3;
const SESSION_SEC = 180;

let score        = 0;
let hitCount     = 0;
let sessionTimer = 0;
let calibTimer   = 0; // counts up during calibration for animations + countdown
let bgTime       = 0;
let rafId        = null;
let lastTime     = 0;


// Pre-computed pixel background star field
const bgStars = (function () {
  const colors = ['#ffffff', '#ffe8c0', '#a0e8ff', '#ffa0d8', '#a0ffb8', '#c0a0ff', '#ffff80'];
  return Array.from({ length: 150 }, () => ({
    x:       Math.random(),
    y:       Math.random(),
    size:    Math.random() < 0.15 ? 3 : 1,
    color:   colors[Math.floor(Math.random() * colors.length)],
    phase:   Math.random() * Math.PI * 2,
    speed:   0.5 + Math.random() * 2.0,
  }));
}());

// Smoothed wrist pixel positions — lerped each frame to kill MediaPipe jitter
let smoothLwx = 0, smoothLwy = 0;
let smoothRwx = 0, smoothRwy = 0;
const WRIST_SMOOTH = 10; // higher = smoother but more lag
let lagScore     = 0; // EMA of smoothing delta in pixels for HUD lag indicator
let leftGrabbed  = null; // Stardust being held by left arm this frame
let rightGrabbed = null; // Stardust being held by right arm this frame
let lTargetX = 0, lTargetY = 0; // clamped arm targets shared between update and draw
let rTargetX = 0, rTargetY = 0;
let reportPending = false;
let recordingRetryTimer = null;
const STANDING_STEER_GAIN = 1.0;
const WHEELCHAIR_STEER_GAIN = 1.85;

// ─── Input ────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  triggerPrimaryAction();
});

function checkCalibration() {
  if (state === GameState.CALIBRATING && poseData.isCalibrated) startSession();
}

// ─── Session lifecycle ────────────────────────────────────────────────────────
function _applyCalibrationBounds() {
  const W = canvas.width, H = canvas.height;

  const lValid = goldenBounds.left.maxX  > goldenBounds.left.minX;
  const rValid = goldenBounds.right.minX < goldenBounds.right.maxX;

  // Set arm lengths proportional to calibrated wrist-reach span
  const lSpan   = lValid ? (goldenBounds.left.maxX  - goldenBounds.left.minX)  * W : 0;
  const rSpan   = rValid ? (goldenBounds.right.maxX - goldenBounds.right.minX) * W : 0;
  const lArmLen = lSpan > 0 ? Math.max(160, Math.min(lSpan * 0.45, W * 0.32)) : 200;
  const rArmLen = rSpan > 0 ? Math.max(160, Math.min(rSpan * 0.45, W * 0.32)) : 200;
  leftArm.setMaxLength(lArmLen);
  rightArm.setMaxLength(rArmLen);

  const maxArmLen = Math.max(lArmLen, rArmLen);
  const shipY     = H * 0.65;

  // X bounds from calibration (mirrored)
  const xMin = lValid ? (1 - goldenBounds.left.maxX)  * W : W * 0.08;
  const xMax = rValid ? (1 - goldenBounds.right.minX) * W : W * 0.92;

  // Y bounds: wheelchair mode keeps stars a bit closer to ship (lower on screen)
  const yMin = movementMode === MovementMode.WHEELCHAIR
    ? Math.max(60, shipY - maxArmLen * 0.62)
    : Math.max(40, shipY - maxArmLen * 0.90);
  const yMax = movementMode === MovementMode.WHEELCHAIR
    ? Math.min(shipY - 35, shipY - maxArmLen * 0.02)
    : Math.min(shipY - 60, shipY - maxArmLen * 0.10);

  stardust.setBounds(
    Math.max(40,     xMin - 20),
    Math.min(W - 40, xMax + 20),
    yMin,
    Math.max(yMin + 60, yMax),
  );
}

function startSession() {
  score        = 0;
  hitCount     = 0;
  sessionTimer = 0;
  meteors.reset();
  stardust.reset();
  meteors.setLevel(1);
  stardust.setLevel(1);
  resetMissCount();
  resetProgression();
  lagScore = 0;
  reportPending = false;
  resetTelemetrySession();
  startTelemetrySession();
  _startSessionRecordingWithRetry();
  setState(GameState.PLAYING);
}

function resetSession() {
  ship.x = canvas.width  / 2;
  ship.y = canvas.height * 0.65;
}

function endSession() {
  if (state === GameState.ENDED || reportPending) return;
  reportPending = true;
  stopTelemetrySession();
  setState(GameState.ENDED);
  void _openReportForSession();
}

async function _openReportForSession() {
  _clearRecordingRetry();
  const recording = await stopSessionRecording();
  const recordingError = getLastRecordingError();
  try {
    await showReportModal({ recording, recordingError });
  } catch (error) {
    console.warn('[ReportModal] failed to render:', error);
  }
}

function _clearRecordingRetry() {
  if (recordingRetryTimer) {
    clearTimeout(recordingRetryTimer);
    recordingRetryTimer = null;
  }
}

function _resolveRecordingSource() {
  if (webcamEl?.srcObject instanceof MediaStream) return webcamEl;
  const poseStream = getPoseStream();
  if (poseStream) return poseStream;
  return null;
}

function _startSessionRecordingWithRetry(attempt = 0) {
  const ok = startSessionRecording(_resolveRecordingSource());
  if (ok) {
    _clearRecordingRetry();
    return;
  }
  if (attempt >= 12 || state !== GameState.PLAYING) return;

  _clearRecordingRetry();
  recordingRetryTimer = setTimeout(() => {
    _startSessionRecordingWithRetry(attempt + 1);
  }, 350);
}

function _applySteeringGain(rawX, gain) {
  const centered = (rawX - 0.5) * gain + 0.5;
  return Math.min(1, Math.max(0, centered));
}

// ─── Resize ───────────────────────────────────────────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  ship.x = canvas.width  / 2;
  ship.y = canvas.height * 0.65;
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  checkCalibration();
  bgTime += dt;
  if (state === GameState.CALIBRATING) calibTimer += dt;
  if (state !== GameState.PLAYING) return;

  hud.update(dt);

  sessionTimer += dt;
  if (sessionTimer >= SESSION_SEC) { endSession(); return; }

  // flip X to match mirrored webcam display (scaleX(-1) in CSS)
  const rawSteeringX = movementMode === MovementMode.WHEELCHAIR ? poseData.neckX : poseData.torsoX;
  const steerGain = movementMode === MovementMode.WHEELCHAIR ? WHEELCHAIR_STEER_GAIN : STANDING_STEER_GAIN;
  const steeringX = _applySteeringGain(rawSteeringX, steerGain);
  ship.lerpTo((1 - steeringX) * canvas.width, dt);
  ship.update(dt);

  // smooth wrist + elbow positions to remove MediaPipe jitter
  const t = Math.min(1, WRIST_SMOOTH * dt);
  smoothLwx += ((1 - poseData.leftWrist.x)   * canvas.width  - smoothLwx) * t;
  smoothLwy += (poseData.leftWrist.y          * canvas.height - smoothLwy) * t;
  smoothRwx += ((1 - poseData.rightWrist.x)  * canvas.width  - smoothRwx) * t;
  smoothRwy += (poseData.rightWrist.y         * canvas.height - smoothRwy) * t;
  const targetLwx = (1 - poseData.leftWrist.x)  * canvas.width;
  const targetLwy = poseData.leftWrist.y         * canvas.height;
  const targetRwx = (1 - poseData.rightWrist.x) * canvas.width;
  const targetRwy = poseData.rightWrist.y        * canvas.height;
  const leftLag   = Math.hypot(targetLwx - smoothLwx, targetLwy - smoothLwy);
  const rightLag  = Math.hypot(targetRwx - smoothRwx, targetRwy - smoothRwy);
  const frameLag  = (leftLag + rightLag) * 0.5;
  lagScore += (frameLag - lagScore) * Math.min(1, dt * 5);

  const lwx = smoothLwx, lwy = smoothLwy;
  const rwx = smoothRwx, rwy = smoothRwy;

  recordFrameSample({
    hipX: poseData.hipX,
    torsoX: poseData.torsoX,
    neckX: poseData.neckX,
    leftWrist: poseData.leftWrist,
    rightWrist: poseData.rightWrist,
    bubbleRadius: poseData.bubbleRadius,
  });

  // J3.3 — meteors scale with level
  const hits = meteors.update(dt, canvas.width, canvas.height, ship);
  if (hits > 0) {
    hitCount += hits;
    ship.onHit();
    if (hitCount >= MAX_HITS) { endSession(); return; }
  }

  // Clamp arm targets: X stays on correct side of ship, Y never goes below ship
  const armYMax = ship.y - 15;
  lTargetX = Math.min(lwx, ship.x - 12);
  lTargetY = Math.min(lwy, armYMax);
  rTargetX = Math.max(rwx, ship.x + 12);
  rTargetY = Math.min(rwy, armYMax);

  // Compute actual arm-tip positions so star collision matches the visual arm
  const leftTip  = leftArm.getTip(ship.x - 28, ship.y - 8, lTargetX, lTargetY);
  const rightTip = rightArm.getTip(ship.x + 28, ship.y - 8, rTargetX, rTargetY);

  // J3.4 — stardust density scales with level
  const { collected, missed, collectedEvents = [], missedEvents = [] } = stardust.update(
    dt, canvas.width, canvas.height,
    leftTip.x, leftTip.y, rightTip.x, rightTip.y, poseData.bubbleRadius,
    ship.x, ship.y
  );
  if (missed > 0) {
    if (missedEvents.length) {
      for (const event of missedEvents) {
        recordMiss();
        recordTelemetryMiss({
          bubbleRadius: poseData.bubbleRadius,
          latencyMs: event.latencyMs,
          hand: event.hand,
          wristPos: {
            left: { x: poseData.leftWrist.x, y: poseData.leftWrist.y },
            right: { x: poseData.rightWrist.x, y: poseData.rightWrist.y },
            target: { x: event.x, y: event.y },
          },
        });
      }
    } else {
      for (let i = 0; i < missed; i++) {
        recordMiss();
        recordTelemetryMiss({
          bubbleRadius: poseData.bubbleRadius,
          wristPos: {
            left: { x: poseData.leftWrist.x, y: poseData.leftWrist.y },
            right: { x: poseData.rightWrist.x, y: poseData.rightWrist.y },
          },
        });
      }
    }
  }

  // track which star each arm is holding this frame (used in draw)
  leftGrabbed  = stardust.getGrabbedBy('left');
  rightGrabbed = stardust.getGrabbedBy('right');

  if (collected > 0) {
    recordCollection(collected);
    if (collectedEvents.length) {
      for (const event of collectedEvents) {
        recordTelemetryHit({
          bubbleRadius: poseData.bubbleRadius,
          latencyMs: event.latencyMs,
          hand: event.hand,
          wristPos: {
            left: { x: poseData.leftWrist.x, y: poseData.leftWrist.y },
            right: { x: poseData.rightWrist.x, y: poseData.rightWrist.y },
            target: { x: event.x, y: event.y },
          },
        });
      }
    } else {
      for (let i = 0; i < collected; i++) {
        recordTelemetryHit({
          bubbleRadius: poseData.bubbleRadius,
          wristPos: {
            left: { x: poseData.leftWrist.x, y: poseData.leftWrist.y },
            right: { x: poseData.rightWrist.x, y: poseData.rightWrist.y },
          },
        });
      }
    }
    score += collected;

    // J3.1 — award XP, check for level-up
    const leveledUp = addXP(collected);
    if (leveledUp) {
      const lvl = getLevel();
      meteors.setLevel(lvl);   // J3.3
      stardust.setLevel(lvl);  // J3.4
      hud.triggerLevelUp(lvl);
    }
  }
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
function drawBackground() {
  const W = canvas.width, H = canvas.height;

  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0,   '#070b1c');
  base.addColorStop(0.45,'#0b1234');
  base.addColorStop(1,   '#18052e');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const blobs = [
    { nx: 0.17, ny: 0.24, nr: 0.40, rgb:  '0, 185, 255', ph: 0.0  },
    { nx: 0.72, ny: 0.16, nr: 0.32, rgb: '130, 40, 255', ph: 1.5  },
    { nx: 0.50, ny: 0.60, nr: 0.46, rgb:  '0, 120, 255', ph: 0.8  },
    { nx: 0.88, ny: 0.74, nr: 0.28, rgb: '255, 0, 204',  ph: 2.2  },
    { nx: 0.12, ny: 0.80, nr: 0.25, rgb: '70, 70, 240',  ph: 3.1  },
    { nx: 0.58, ny: 0.34, nr: 0.24, rgb: '110, 25, 235', ph: 4.0  },
  ];
  blobs.forEach(({ nx, ny, nr, rgb, ph }) => {
    const bx = W * nx, by = H * ny, br = Math.min(W, H) * nr;
    const a  = 0.13 + 0.05 * Math.sin(bgTime * 0.25 + ph);
    const g  = ctx.createRadialGradient(bx, by, br * 0.08, bx, by, br);
    g.addColorStop(0,   `rgba(${rgb}, ${a})`);
    g.addColorStop(0.55, `rgba(${rgb}, ${a * 0.45})`);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });

  ctx.imageSmoothingEnabled = false;
  bgStars.forEach(({ x, y, size, color, phase, speed }) => {
    const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(bgTime * speed + phase));
    const sx    = Math.round(x * W);
    const sy    = Math.round(y * H);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    if (size === 1) {
      ctx.fillRect(sx, sy, 2, 2);
    } else {
      ctx.fillRect(sx - 4, sy, 9, 2);
      ctx.fillRect(sx, sy - 4, 2, 9);
      ctx.fillRect(sx, sy, 2, 2);
    }
  });
  ctx.globalAlpha = 1;
}

function drawCalibrationGuide() {
  const W  = canvas.width;
  const H  = canvas.height;
  const cx = W / 2;
  const cy = H / 2;

  const CALIB_DURATION = 10;
  const secsLeft = Math.max(0, Math.ceil(CALIB_DURATION - calibTimer));
  const progress = Math.min(1, calibTimer / CALIB_DURATION);
  const pulse    = Math.sin(calibTimer * 3) * 0.5 + 0.5;

  // ── webcam feed (mirrored to match user's expectation) ─────────────────────
  if (webcamEl && webcamEl.readyState >= 2) {
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.globalAlpha = 0.72;
    ctx.drawImage(webcamEl, 0, 0, W, H);
    ctx.restore();
  } else {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);
  }

  // dark tint + subtle center glow to match welcome screen palette
  ctx.fillStyle = 'rgba(3, 7, 20, 0.6)';
  ctx.fillRect(0, 0, W, H);
  const centerGlow = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.min(W, H) * 0.72);
  centerGlow.addColorStop(0, 'rgba(0, 160, 255, 0.18)');
  centerGlow.addColorStop(0.45, 'rgba(170, 40, 255, 0.10)');
  centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, W, H);

  // ── scanning line ───────────────────────────────────────────────────────────
  const scanY = ((calibTimer * 0.11) % 1) * H;
  const scanGrad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
  scanGrad.addColorStop(0,   'rgba(0, 232, 255, 0)');
  scanGrad.addColorStop(0.5, `rgba(0, 232, 255, ${0.18 + pulse * 0.12})`);
  scanGrad.addColorStop(1,   'rgba(0, 232, 255, 0)');
  ctx.fillStyle = scanGrad;
  ctx.fillRect(0, scanY - 50, W, 100);

  // ── body silhouette ─────────────────────────────────────────────────────────
  const figH         = H * 0.62;
  const headR        = figH * 0.08;
  const neckY        = cy - figH * 0.32;
  const headCY       = neckY - headR * 1.2;
  const hipY         = cy + figH * 0.1;
  const footY        = cy + figH * 0.46;
  const shoulderSpan = figH * 0.2;
  const shoulderY    = neckY + headR * 0.4;

  ctx.save();
  ctx.strokeStyle = 'rgba(90, 220, 255, 0.72)';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.setLineDash([7, 5]);

  if (movementMode === MovementMode.WHEELCHAIR) {
    // torso-first marker, shifted lower to better match seated posture
    const seatOffset = figH * 0.18;
    const torsoTop   = shoulderY + seatOffset;
    const torsoBot   = hipY + seatOffset;
    const torsoHalf  = shoulderSpan * 0.95;
    const headY      = headCY + seatOffset;

    ctx.beginPath(); ctx.arc(cx, headY, headR * 0.92, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - torsoHalf, torsoTop); ctx.lineTo(cx + torsoHalf, torsoTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - torsoHalf * 0.8, torsoTop); ctx.lineTo(cx - torsoHalf * 0.65, torsoBot); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + torsoHalf * 0.8, torsoTop); ctx.lineTo(cx + torsoHalf * 0.65, torsoBot); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - torsoHalf * 0.65, torsoBot); ctx.lineTo(cx + torsoHalf * 0.65, torsoBot); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, neckY);  ctx.lineTo(cx, hipY);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - shoulderSpan, shoulderY); ctx.lineTo(cx + shoulderSpan, shoulderY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, hipY); ctx.lineTo(cx - figH * 0.13, footY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, hipY); ctx.lineTo(cx + figH * 0.13, footY); ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();

  // ── reach zones — live from goldenBounds, shrink/grow with user's actual reach ─
  // goldenBounds is in raw camera X; mirror with (1 - x) for display
  const lRecorded = goldenBounds.left.maxX  > 0.01;
  const rRecorded = goldenBounds.right.maxX > goldenBounds.right.minX + 0.01;

  // target circles: where we'd LIKE the user to reach (fixed outer guide)
  const targetLx = cx - W * 0.30;
  const targetRx = cx + W * 0.30;
  const targetR  = figH * 0.10;

  // actual recorded reach circles (start at shoulder, grow outward as user reaches)
  const reachLx = lRecorded ? (1 - goldenBounds.left.maxX)  * W : cx - shoulderSpan;
  const reachRx = rRecorded ? (1 - goldenBounds.right.minX) * W : cx + shoulderSpan;
  const reachLy = lRecorded ? goldenBounds.left.minY  * H : shoulderY;
  const reachRy = rRecorded ? goldenBounds.right.minY * H : shoulderY;

  [
    { tx: targetLx, rx: reachLx, ry: reachLy, shoulder: cx - shoulderSpan, label: '← REACH', recorded: lRecorded },
    { tx: targetRx, rx: reachRx, ry: reachRy, shoulder: cx + shoulderSpan, label: 'REACH →', recorded: rRecorded },
  ].forEach(({ tx, rx, ry, shoulder, label, recorded }) => {
    ctx.save();

    // dashed TARGET ring (outer guide — fixed, shows ideal reach)
    ctx.beginPath();
    ctx.arc(tx, shoulderY, targetR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 0, 204, ${0.34 + pulse * 0.14})`;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // dashed arm line from shoulder toward actual reach
    ctx.beginPath();
    ctx.moveTo(shoulder, shoulderY);
    ctx.lineTo(rx, ry);
    ctx.strokeStyle = `rgba(110, 220, 255, ${0.32 + pulse * 0.2})`;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ACTUAL reach circle — grows as user reaches further
    const r = recorded ? Math.max(targetR * 0.4, targetR * 1.2) : targetR * 0.4;
    const glow = ctx.createRadialGradient(rx, ry, 2, rx, ry, r * 1.8);
    glow.addColorStop(0,   `rgba(0, 232, 255, ${recorded ? 0.34 + pulse * 0.18 : 0.12})`);
    glow.addColorStop(0.6, `rgba(255, 0, 204, ${recorded ? 0.14 : 0.05})`);
    glow.addColorStop(1,   'rgba(0, 160, 255, 0)');
    ctx.beginPath();
    ctx.arc(rx, ry, r * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 232, 255, ${recorded ? 0.74 + pulse * 0.22 : 0.38 + pulse * 0.18})`;
    ctx.lineWidth   = recorded ? 2.5 : 1.5;
    ctx.stroke();

    // hand icon at actual reach point
    ctx.beginPath();
    ctx.arc(rx, ry, 11, 0, Math.PI * 2);
    ctx.fillStyle   = `rgba(0, 210, 255, ${recorded ? 0.72 + pulse * 0.2 : 0.35})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(230, 250, 255, 0.94)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // label
    const reachLabelSize = Math.max(9, Math.min(12, Math.floor(W / 125)));
    ctx.font         = `${reachLabelSize}px "Press Start 2P", monospace`;
    ctx.fillStyle    = `rgba(175, 242, 255, ${recorded ? 1 : 0.62})`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, rx, ry + r + 16);

    ctx.restore();
  });

  // ── live wrist dots from poseData (show where hands actually are) ───────────
  const wrists = [
    { wx: (1 - poseData.leftWrist.x)  * W, wy: poseData.leftWrist.y  * H, label: 'L' },
    { wx: (1 - poseData.rightWrist.x) * W, wy: poseData.rightWrist.y * H, label: 'R' },
  ];
  wrists.forEach(({ wx, wy, label }) => {
    ctx.save();
    // outer ring
    ctx.beginPath();
    ctx.arc(wx, wy, 18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 0, 204, ${0.52 + pulse * 0.28})`;
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    // inner dot
    ctx.beginPath();
    ctx.arc(wx, wy, 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 232, 255, ${0.75 + pulse * 0.2})`;
    ctx.fill();
    // label
    ctx.font         = `8px "Press Start 2P", monospace`;
    ctx.fillStyle    = 'rgba(222, 248, 255, 0.95)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, wx, wy);
    ctx.restore();
  });

  // ── countdown badge (circular) ──────────────────────────────────────────────
  const ringR = 34;
  const ringX = cx;
  const ringY = H * 0.122;

  ctx.save();
  const halo = ctx.createRadialGradient(ringX, ringY, 8, ringX, ringY, ringR * 2.1);
  halo.addColorStop(0, 'rgba(0, 232, 255, 0.20)');
  halo.addColorStop(0.65, 'rgba(255, 0, 204, 0.10)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR + 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(4, 8, 30, 0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 232, 255, 0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth   = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 0, 204, ${0.68 + pulse * 0.22})`;
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';
  ctx.stroke();

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = `18px "Press Start 2P", monospace`;
  ctx.fillStyle    = '#d8f9ff';
  ctx.fillText(secsLeft, ringX, ringY);
  ctx.restore();

  // ── labels ──────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font      = `12px "Press Start 2P", monospace`;
  ctx.fillStyle = '#aef1ff';
  ctx.fillText('REACH SCAN', cx, H * 0.05);

  const footerW = Math.min(860, W * 0.92);
  const footerH = 88;
  const footerX = cx - footerW / 2;
  const footerY = H * 0.84;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.56)';
  ctx.fillRect(footerX, footerY, footerW, footerH);
  ctx.strokeStyle = 'rgba(255, 0, 204, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(footerX, footerY, footerW, footerH);

  const instructionSize = Math.max(6, Math.min(9, Math.floor(W / 150)));
  const skipSize = Math.max(6, instructionSize - 1);
  ctx.font      = `${instructionSize}px "Press Start 2P", monospace`;
  ctx.fillStyle = 'rgba(190, 246, 255, 0.96)';
  ctx.fillText('STEP BACK AND REACH BOTH ARMS TO THE GLOWING CIRCLES', cx, footerY + 34);
  ctx.font      = `${skipSize}px "Press Start 2P", monospace`;
  ctx.fillStyle = 'rgba(255, 225, 120, 0.98)';
  ctx.fillText('PRESS SPACE TO SKIP', cx, footerY + 66);
  ctx.restore();
}

function drawOverlay(title, subtitle) {
  const W = canvas.width, H = canvas.height;
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // dark semi-transparent panel
  ctx.fillStyle = 'rgba(2, 4, 18, 0.86)';
  ctx.fillRect(0, 0, W, H);

  // pixel-border box
  const bw = Math.min(W - 60, 600), bh = 220;
  const bx = (W - bw) / 2, by = H / 2 - bh / 2;
  ctx.fillStyle = '#0a0820';
  ctx.fillRect(bx, by, bw, bh);
  // pixel corner border (4px wide)
  ctx.fillStyle = '#5030c0';
  ctx.fillRect(bx,          by,          bw, 4);
  ctx.fillRect(bx,          by + bh - 4, bw, 4);
  ctx.fillRect(bx,          by,          4, bh);
  ctx.fillRect(bx + bw - 4, by,          4, bh);
  // corner accent pixels
  ctx.fillStyle = '#a070ff';
  ctx.fillRect(bx,          by,          8, 8);
  ctx.fillRect(bx + bw - 8, by,          8, 8);
  ctx.fillRect(bx,          by + bh - 8, 8, 8);
  ctx.fillRect(bx + bw - 8, by + bh - 8, 8, 8);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = `16px "Press Start 2P", monospace`;
  ctx.fillStyle    = '#d0b8ff';
  ctx.fillText(title, W / 2, by + bh * 0.38);

  ctx.font      = `8px "Press Start 2P", monospace`;
  ctx.fillStyle = '#7860d0';
  ctx.fillText(subtitle, W / 2, by + bh * 0.68);

  ctx.restore();
}

function drawIdleScreen() {
  const W = canvas.width, H = canvas.height;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(2, 4, 18, 0.75)';
  ctx.fillRect(0, 0, W, H);

  // title banner
  const bw = Math.min(W - 40, 680), bh = 56;
  const bx = (W - bw) / 2, by = H * 0.10;
  ctx.fillStyle = '#0a0830';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#00a8ff';
  ctx.fillRect(bx, by, bw, 4);
  ctx.fillRect(bx, by + bh - 4, bw, 4);
  ctx.fillStyle = '#0080d0';
  ctx.fillRect(bx, by, 4, bh);
  ctx.fillRect(bx + bw - 4, by, 4, bh);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = `18px "Press Start 2P", monospace`;
  ctx.fillStyle    = '#00e8ff';
  ctx.shadowColor  = 'rgba(0,220,255,0.7)';
  ctx.shadowBlur   = 12;
  ctx.fillText('NEBULA  NAVIGATOR', W / 2, by + bh / 2);
  ctx.shadowBlur   = 0;

  // animated demo ship (draw current Cadet ship skin in center)
  ctx.save();
  ctx.translate(W / 2, H * 0.42);
  // simple white pixel ship preview
  const P = 4;
  const r = (x,y,w,h,col) => { ctx.fillStyle=col; ctx.fillRect(x*P,y*P,w*P,h*P); };
  r(-4, 1, 4, 5, '#3870b8'); r( 0, 1, 4, 5, '#3870b8');  // wings
  r(-1,-9, 2, 1, '#c8d8e8'); r(-2,-8, 4, 1, '#c8d8e8');  // nose
  r(-3,-7, 6, 2, '#c8d8e8'); r(-4,-5, 8,10, '#c8d8e8');  // body
  r(-3, 5, 6, 3, '#c8d8e8'); r(-2, 8, 4, 1, '#c8d8e8');
  r(-2,-7, 4, 4, '#38a0ff');  // cockpit
  r(-4,-2, 8, 1, '#ffffff');  // stripe
  // thrust
  const f = 0.7 + 0.3 * Math.sin(bgTime * 9);
  const tlen = 3 + Math.round(3 * f);
  for (let i = 0; i < tlen; i++) {
    const a = ((1 - i/tlen) * 0.9 * f).toFixed(2);
    ctx.fillStyle = `rgba(0,220,255,${a})`;
    ctx.fillRect(-2*P, (9+i)*P, 4*P, P);
    ctx.fillStyle = `rgba(255,255,255,${((1 - i/tlen)*f*0.8).toFixed(2)})`;
    ctx.fillRect(-P, (9+i)*P, 2*P, P);
  }
  ctx.restore();

  // how to play panel
  const iw = Math.min(W - 80, 560), ih = 130;
  const ix = (W - iw) / 2, iy = H * 0.60;
  ctx.fillStyle = 'rgba(8, 6, 30, 0.9)';
  ctx.fillRect(ix, iy, iw, ih);
  ctx.fillStyle = '#2820a0';
  ctx.fillRect(ix, iy, iw, 3);
  ctx.fillRect(ix, iy + ih - 3, iw, 3);
  ctx.fillRect(ix, iy, 3, ih);
  ctx.fillRect(ix + iw - 3, iy, 3, ih);

  ctx.font         = `7px "Press Start 2P", monospace`;
  ctx.fillStyle    = '#8890d0';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  const lines = [
    '>> HOW TO PLAY',
    '',
    '  BODY  - lean to steer your ship',
    '  ARMS  - hold wrist on stars to collect',
    '  DODGE - avoid the incoming meteors',
  ];
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#a0c0ff' : '#8890d0';
    ctx.fillText(line, ix + 18, iy + 14 + i * 18);
  });

  // blinking PRESS SPACE
  if (Math.floor(bgTime * 2) % 2 === 0) {
    ctx.font      = `10px "Press Start 2P", monospace`;
    ctx.fillStyle = '#ffe840';
    ctx.textAlign = 'center';
    ctx.fillText('[ PRESS SPACE TO START ]', W / 2, H * 0.90);
  }

  ctx.restore();
}

function draw() {
  ctx.imageSmoothingEnabled = false;
  drawBackground();

  if (state === GameState.IDLE) {
    drawIdleScreen();
    return;
  }

  if (state === GameState.CALIBRATING) {
    drawCalibrationGuide();
    return;
  }

  // PLAYING or ENDED — draw the game world (use smoothed wrist positions)
  const lwx = smoothLwx, lwy = smoothLwy;
  const rwx = smoothRwx, rwy = smoothRwy;

  meteors.draw(ctx);

  // clamp so left arm never crosses right of ship and vice-versa
  leftArm.draw(ctx,  ship.x - 28, ship.y - 8, lTargetX, lTargetY,  leftGrabbed);
  rightArm.draw(ctx, ship.x + 28, ship.y - 8, rTargetX, rTargetY, rightGrabbed);

  // J3.1 — ship renders with current skin
  ship.draw(ctx, getSkin());

  // stars render in front of ship so they're always visible and grabbable
  stardust.draw(ctx);

  // J3.2 — HUD: XP bar, level badge, score, timer, health
  hud.draw(ctx, canvas, {
    score,
    hitCount,
    maxHits:         MAX_HITS,
    sessionTimer,
    sessionDuration: SESSION_SEC,
    missCount:       getMissCount(),
    bubbleRadius:    poseData.bubbleRadius,
    lagScore,
  });

  if (state === GameState.ENDED) {
    const reason = hitCount >= MAX_HITS ? 'Ship destroyed!' : 'Session complete!';
    drawOverlay(reason, `Score: ${score}  •  Press SPACE to restart`);
  }
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  update(dt);
  draw();

  rafId = requestAnimationFrame(loop);
}

export function startGame() {
  if (!ensureDomRefs()) {
    console.warn('[GameLoop] Missing required DOM nodes: #gameCanvas or #webcam');
    return;
  }
  resize();
  window.addEventListener('resize', resize);
  initPoseEngine().catch(err => console.warn('[PoseEngine] init failed:', err));
  setState(GameState.IDLE);
  lastTime = performance.now();
  rafId    = requestAnimationFrame(loop);
}

export function stopGame() {
  cancelAnimationFrame(rafId);
  rafId = null;
  _clearRecordingRetry();
  stopTelemetrySession();
  void stopSessionRecording();
  window.removeEventListener('resize', resize);
}

export function requestPrimaryAction() {
  triggerPrimaryAction();
}

export function getGameState() {
  return state;
}

export function setMovementMode(mode) {
  movementMode = mode === MovementMode.WHEELCHAIR ? MovementMode.WHEELCHAIR : MovementMode.STANDING;
}

export function getMovementMode() {
  return movementMode;
}
