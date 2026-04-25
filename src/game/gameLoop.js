import { Ship }           from './ship.js';
import { Arm }            from './arm.js';
import { MeteorManager }  from './meteor.js';
import { StardustManager } from './stardust.js';
import { addXP, getLevel, getSkin, reset as resetProgression } from './progression.js';
import { HUD }            from '../ui/hud.js';

// ─── Pose Interface Stub ──────────────────────────────────────────────────────
// Matches the poseInterface.js contract agreed with Markaelo.
// When his tracking branch lands, replace this block with:
//   import { poseData } from '../tracking/poseInterface.js';
const poseData = {
  hipX:         0.5,
  leftWrist:    { x: 0.3, y: 0.65 },
  rightWrist:   { x: 0.7, y: 0.65 },
  bubbleRadius: 120,
  isCalibrated: false,
};

// ─── State Machine ────────────────────────────────────────────────────────────
export const GameState = {
  IDLE:        'idle',
  CALIBRATING: 'calibrating',
  PLAYING:     'playing',
  ENDED:       'ended',
};

let state = GameState.IDLE;

function setState(next) { state = next; }

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ─── Game Objects ─────────────────────────────────────────────────────────────
const ship     = new Ship(0, 0);
const leftArm  = new Arm();
const rightArm = new Arm();
const meteors  = new MeteorManager();
const stardust = new StardustManager();
const hud      = new HUD();

// ─── Session State ────────────────────────────────────────────────────────────
const MAX_HITS    = 3;
const SESSION_SEC = 120;

let score        = 0;
let hitCount     = 0;
let sessionTimer = 0;
let rafId        = null;
let lastTime     = 0;

// ─── Input ────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();

  if      (state === GameState.IDLE)        setState(GameState.CALIBRATING);
  else if (state === GameState.CALIBRATING) startSession();   // dev bypass
  else if (state === GameState.ENDED)     { resetSession(); setState(GameState.IDLE); }
});

function checkCalibration() {
  if (state === GameState.CALIBRATING && poseData.isCalibrated) startSession();
}

// ─── Session lifecycle ────────────────────────────────────────────────────────
function startSession() {
  score        = 0;
  hitCount     = 0;
  sessionTimer = 0;
  meteors.reset();
  stardust.reset();
  meteors.setLevel(1);
  stardust.setLevel(1);
  resetProgression();
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
  if (state !== GameState.PLAYING) return;

  hud.update(dt);

  sessionTimer += dt;
  if (sessionTimer >= SESSION_SEC) { endSession(); return; }

  // ship follows hipX with lerp (J2.1 / J3.1)
  ship.lerpTo(poseData.hipX * canvas.width, dt);
  ship.update(dt);

  const lwx = poseData.leftWrist.x  * canvas.width;
  const lwy = poseData.leftWrist.y  * canvas.height;
  const rwx = poseData.rightWrist.x * canvas.width;
  const rwy = poseData.rightWrist.y * canvas.height;

  // J3.3 — meteors scale with level
  const hits = meteors.update(dt, canvas.width, canvas.height, ship);
  if (hits > 0) {
    hitCount += hits;
    ship.onHit();
    if (hitCount >= MAX_HITS) { endSession(); return; }
  }

  // J3.4 — stardust density scales with level
  const collected = stardust.update(
    dt, canvas.width, canvas.height,
    lwx, lwy, rwx, rwy, poseData.bubbleRadius
  );

  if (collected > 0) {
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
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawOverlay(title, subtitle) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 5, 15, 0.78)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d0c0ff';
  ctx.font      = 'bold 48px monospace';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = '#8878cc';
  ctx.font      = '22px monospace';
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 28);
  ctx.restore();
}

function draw() {
  drawBackground();

  if (state === GameState.IDLE) {
    drawOverlay('NEBULA NAVIGATOR', 'Press SPACE to begin');
    return;
  }

  if (state === GameState.CALIBRATING) {
    drawOverlay('CALIBRATING…', 'Hold still  •  or press SPACE to skip');
    return;
  }

  // PLAYING or ENDED — draw the game world
  const lwx = poseData.leftWrist.x  * canvas.width;
  const lwy = poseData.leftWrist.y  * canvas.height;
  const rwx = poseData.rightWrist.x * canvas.width;
  const rwy = poseData.rightWrist.y * canvas.height;

  stardust.draw(ctx);
  meteors.draw(ctx);

  leftArm.draw(ctx,  ship.x - 28, ship.y - 8, lwx, lwy);
  rightArm.draw(ctx, ship.x + 28, ship.y - 8, rwx, rwy);

  // J3.1 — ship renders with current skin
  ship.draw(ctx, getSkin());

  // J3.2 — HUD: XP bar, level badge, score, timer, health
  hud.draw(ctx, canvas, {
    score,
    hitCount,
    maxHits:         MAX_HITS,
    sessionTimer,
    sessionDuration: SESSION_SEC,
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
  resize();
  window.addEventListener('resize', resize);
  lastTime = performance.now();
  rafId    = requestAnimationFrame(loop);
}

export function stopGame() {
  cancelAnimationFrame(rafId);
  rafId = null;
  window.removeEventListener('resize', resize);
}
