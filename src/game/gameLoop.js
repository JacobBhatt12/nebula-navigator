import { Ship }           from './ship.js';
import { Arm }            from './arm.js';
import { MeteorManager }  from './meteor.js';
import { StardustManager } from './stardust.js';
import { addXP, getLevel, getSkin, reset as resetProgression } from './progression.js';
import { HUD }            from '../ui/hud.js';
import { poseData }       from '../tracking/poseInterface.js';
import { initPoseEngine } from '../tracking/poseEngine.js';
import { runCalibration, goldenBounds } from '../tracking/calibration.js';
import { recordMiss, resetMissCount, getMissCount, recordCollection } from '../tracking/adaptiveBubble.js';

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
  // mix of single-pixel dots and cross sparkles
  return Array.from({ length: 150 }, () => ({
    x:       Math.random(),
    y:       Math.random(),
    size:    Math.random() < 0.15 ? 3 : 1, // 15% are cross sparkles (size=3), rest are dots
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
  setState(GameState.PLAYING);
}

function resetSession() {
  ship.x = canvas.width  / 2;
  ship.y = canvas.height * 0.65;
}

function endSession() {
  setState(GameState.ENDED);
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
  const steeringX = movementMode === MovementMode.WHEELCHAIR ? poseData.neckX : poseData.torsoX;
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
  const { collected, missed } = stardust.update(
    dt, canvas.width, canvas.height,
    leftTip.x, leftTip.y, rightTip.x, rightTip.y, poseData.bubbleRadius,
    ship.x, ship.y
  );
  if (missed > 0) {
    for (let i = 0; i < missed; i++) recordMiss();
  }

  // track which star each arm is holding this frame (used in draw)
  leftGrabbed  = stardust.getGrabbedBy('left');
  rightGrabbed = stardust.getGrabbedBy('right');

  if (collected > 0) {
    recordCollection(collected);
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

  // deep space base
  const base = ctx.createLinearGradient(0, 0, W * 0.4, H);
  base.addColorStop(0,   '#0d0520');
  base.addColorStop(0.5, '#150830');
  base.addColorStop(1,   '#080428');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // nebula cloud blobs
  const blobs = [
    { nx: 0.18, ny: 0.28, nr: 0.38, rgb: '110, 35, 200', ph: 0.0  },
    { nx: 0.72, ny: 0.18, nr: 0.30, rgb:  '70, 20, 160', ph: 1.5  },
    { nx: 0.50, ny: 0.62, nr: 0.44, rgb:  '50, 70, 210', ph: 0.8  },
    { nx: 0.88, ny: 0.72, nr: 0.26, rgb:  '90, 25, 175', ph: 2.2  },
    { nx: 0.12, ny: 0.78, nr: 0.24, rgb:  '35, 55, 190', ph: 3.1  },
    { nx: 0.55, ny: 0.35, nr: 0.22, rgb: '140, 30, 220', ph: 4.0  },
  ];
  blobs.forEach(({ nx, ny, nr, rgb, ph }) => {
    const bx = W * nx, by = H * ny, br = Math.min(W, H) * nr;
    const a  = 0.10 + 0.04 * Math.sin(bgTime * 0.25 + ph);
    const g  = ctx.createRadialGradient(bx, by, br * 0.08, bx, by, br);
    g.addColorStop(0,   `rgba(${rgb}, ${a})`);
    g.addColorStop(0.55, `rgba(${rgb}, ${a * 0.45})`);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });

  // pixel twinkling stars — dots and cross sparkles
  ctx.imageSmoothingEnabled = false;
  bgStars.forEach(({ x, y, size, color, phase, speed }) => {
    const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(bgTime * speed + phase));
    const sx    = Math.round(x * W);
    const sy    = Math.round(y * H);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    if (size === 1) {
      ctx.fillRect(sx, sy, 2, 2); // pixel dot
    } else {
      // cross sparkle
      ctx.fillRect(sx - 4, sy, 9, 2); // horizontal arm
      ctx.fillRect(sx, sy - 4, 2, 9); // vertical arm
      ctx.fillRect(sx, sy, 2, 2);     // bright center
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

  // dark tint so guide graphics pop
  ctx.fillStyle = 'rgba(5, 5, 15, 0.52)';
  ctx.fillRect(0, 0, W, H);

  // ── scanning line ───────────────────────────────────────────────────────────
  const scanY = ((calibTimer * 0.12) % 1) * H;
  const scanGrad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
  scanGrad.addColorStop(0,   'rgba(120, 80, 255, 0)');
  scanGrad.addColorStop(0.5, `rgba(120, 80, 255, ${0.28 + pulse * 0.12})`);
  scanGrad.addColorStop(1,   'rgba(120, 80, 255, 0)');
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
  ctx.strokeStyle = 'rgba(180, 150, 255, 0.6)';
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
    ctx.strokeStyle = `rgba(80, 80, 180, ${0.3 + pulse * 0.15})`;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // dashed arm line from shoulder toward actual reach
    ctx.beginPath();
    ctx.moveTo(shoulder, shoulderY);
    ctx.lineTo(rx, ry);
    ctx.strokeStyle = `rgba(160, 130, 255, ${0.35 + pulse * 0.2})`;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ACTUAL reach circle — grows as user reaches further
    const r = recorded ? Math.max(targetR * 0.4, targetR * 1.2) : targetR * 0.4;
    const glow = ctx.createRadialGradient(rx, ry, 2, rx, ry, r * 1.8);
    glow.addColorStop(0,   `rgba(0, 220, 255, ${recorded ? 0.28 + pulse * 0.15 : 0.10})`);
    glow.addColorStop(0.6, `rgba(0, 160, 255, ${recorded ? 0.12 : 0.04})`);
    glow.addColorStop(1,   'rgba(0, 160, 255, 0)');
    ctx.beginPath();
    ctx.arc(rx, ry, r * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 220, 255, ${recorded ? 0.7 + pulse * 0.3 : 0.3 + pulse * 0.2})`;
    ctx.lineWidth   = recorded ? 2.5 : 1.5;
    ctx.stroke();

    // hand icon at actual reach point
    ctx.beginPath();
    ctx.arc(rx, ry, 11, 0, Math.PI * 2);
    ctx.fillStyle   = `rgba(0, 210, 255, ${recorded ? 0.65 + pulse * 0.25 : 0.3})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.9)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // label
    ctx.font         = 'bold 13px monospace';
    ctx.fillStyle    = `rgba(0, 230, 255, ${recorded ? 0.9 : 0.5})`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, rx, ry + r + 6);

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
    ctx.strokeStyle = `rgba(255, 220, 0, ${0.6 + pulse * 0.3})`;
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    // inner dot
    ctx.beginPath();
    ctx.arc(wx, wy, 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 240, 80, ${0.8 + pulse * 0.2})`;
    ctx.fill();
    // label
    ctx.font         = 'bold 11px monospace';
    ctx.fillStyle    = 'rgba(255, 255, 200, 0.9)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, wx, wy);
    ctx.restore();
  });

  // ── countdown ring ──────────────────────────────────────────────────────────
  const ringR = 40;
  const ringX = cx;
  const ringY = H * 0.1;

  ctx.save();
  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth   = 5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = `rgba(120, 80, 255, ${0.75 + pulse * 0.25})`;
  ctx.lineWidth   = 5;
  ctx.lineCap     = 'round';
  ctx.stroke();

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 30px monospace';
  ctx.fillStyle    = '#d0c0ff';
  ctx.fillText(secsLeft, ringX, ringY);
  ctx.restore();

  // ── labels ──────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font      = 'bold 24px monospace';
  ctx.fillStyle = '#c8b8ff';
  ctx.fillText('REACH SCAN', cx, H * 0.07);

  ctx.font      = '15px monospace';
  ctx.fillStyle = 'rgba(160, 220, 255, 0.85)';
  ctx.fillText('Step back • Stretch both arms to the glowing circles', cx, H * 0.9);
  ctx.fillText('Press SPACE to skip', cx, H * 0.95);
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
