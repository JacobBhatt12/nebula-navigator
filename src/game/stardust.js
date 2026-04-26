const HOLD_DURATION = 1.5;
const STAR_LIFETIME = 8.0;
const CARRY_DURATION  = 0.62;
const GRAB_RADIUS_DEFAULT = 55;

// Pixel-art palettes for each star type
const PALETTES = [
  { fill: '#ffe31a', light: '#fff6a8', dark: '#b96a18', face: '#402010' }, // yellow
  { fill: '#f2a0a9', light: '#ffe1c8', dark: '#9f1f6a', face: '#2b1a18' }, // pink
  { fill: '#5a8fd0', light: '#8bc5f2', dark: '#3f4a86', face: '#18233d' }, // blue
];

// Draw a 5-pointed retro star centered at (cx, cy)
function _drawPixelStarBody(ctx, cx, cy, r, palette) {
  const outer = r * 1.04;
  const inner = r * 0.48;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? outer : inner;
    const px = Math.round(Math.cos(angle) * rr);
    const py = Math.round(Math.sin(angle) * rr);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.lineJoin = 'miter';
  ctx.lineWidth = Math.max(2.5, r * 0.20);
  ctx.strokeStyle = palette.dark;
  ctx.stroke();

  // pixel-ish highlight clusters
  const P = Math.max(2, Math.round(r / 7));
  const pr = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x * P), Math.round(y * P), Math.round(w * P), Math.round(h * P));
  };
  pr(-2.4, -2.2, 1.5, 0.9, palette.light);
  pr(-3.0, -0.4, 1.1, 0.9, palette.light);
  pr(-2.0, 1.4, 1.0, 0.9, palette.light);
  pr(1.3, -1.6, 1.3, 0.8, palette.light);
  pr(1.9, 0.9, 1.0, 0.8, '#ffffff66');
  ctx.restore();
}

// Face: two vertical eyes (Mario-style)
function _drawPixelFace(ctx, cx, cy, r, faceColor) {
  const P = Math.max(2, Math.round(r / 7));
  ctx.fillStyle = faceColor;
  ctx.fillRect(cx - Math.round(P * 2.1), cy - Math.round(P * 1.2), Math.round(P * 0.9), Math.round(P * 2.6));
  ctx.fillRect(cx + Math.round(P * 1.2), cy - Math.round(P * 1.2), Math.round(P * 0.9), Math.round(P * 2.6));
}

export class Stardust {
  constructor(x, y) {
    this.x          = x;
    this.y          = y;
    this.radius     = 22;
    this.grabRadius = GRAB_RADIUS_DEFAULT;
    this.holdTimer  = 0;
    this.lifeTimer  = 0;
    this.collected  = false;
    this.expired    = false;
    this.pulse      = Math.random() * Math.PI * 2;
    this.palette    = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    this._spin      = 0;
    this.lockedBy   = null;
    this.carrying   = false;
    this.carryTimer = 0;
    this._flyStartX = 0;
    this._flyStartY = 0;
    this._xpPending = false;
    this._collectionLatencyMs = null;
    this._collectedBy = 'unknown';
    this._missLatencyMs = null;
    this._missedBy = 'unknown';
  }

  update(dt, lwx, lwy, rwx, rwy, bubbleRadius, shipX, shipY) {
    if (this.collected || this.expired) return;

    this.pulse     += dt * 2.8;
    this._spin     += dt * 0.6;
    this.lifeTimer += dt;

    if (this.carrying) {
      this.carryTimer += dt;
      const t    = Math.min(1, this.carryTimer / CARRY_DURATION);
      const ease = 1 - (1 - t) * (1 - t);
      this.x = this._flyStartX + (shipX - this._flyStartX) * ease;
      this.y = this._flyStartY + (shipY - this._flyStartY) * ease;
      if (this.carryTimer >= CARRY_DURATION) this.collected = true;
      return;
    }

    if (this.lifeTimer >= STAR_LIFETIME) { this.expired = true; return; }

    this.grabRadius = bubbleRadius || GRAB_RADIUS_DEFAULT;
    const leftDist  = Math.hypot(lwx - this.x, lwy - this.y);
    const rightDist = Math.hypot(rwx - this.x, rwy - this.y);
    const leftIn    = leftDist  < this.grabRadius;
    const rightIn   = rightDist < this.grabRadius;

    if (!this.lockedBy) {
      if      (leftIn && rightIn) this.lockedBy = leftDist <= rightDist ? 'left' : 'right';
      else if (leftIn)            this.lockedBy = 'left';
      else if (rightIn)           this.lockedBy = 'right';
    }

    const inRange = this.lockedBy === 'left'  ? leftIn
                  : this.lockedBy === 'right' ? rightIn
                  : false;

    if (!inRange) this.lockedBy = null;

    if (inRange) {
      this.holdTimer += dt;
      // Pull the star into the selected hand so the grab reads visually.
      const handX = this.lockedBy === 'left' ? lwx : rwx;
      const handY = this.lockedBy === 'left' ? lwy : rwy;
      const pull = Math.min(1, dt * (4.5 + this.progress * 9));
      this.x += (handX - this.x) * pull;
      this.y += (handY - this.y) * pull;

      if (this.holdTimer >= HOLD_DURATION) {
        this.carrying   = true;
        this._xpPending = true;
        this._collectionLatencyMs = Math.round(this.lifeTimer * 1000);
        this._collectedBy = this.lockedBy || 'unknown';
        this._flyStartX = this.x;
        this._flyStartY = this.y;
      }
    } else {
      this.holdTimer = Math.max(0, this.holdTimer - dt * 2);
      if (!leftIn && !rightIn) this._missedBy = 'none';
    }

    if (leftIn && !rightIn) this._missedBy = 'left';
    if (rightIn && !leftIn) this._missedBy = 'right';
    if (leftIn && rightIn) this._missedBy = 'both';
  }

  get progress() { return Math.min(1, this.holdTimer / HOLD_DURATION); }
  get timeLeft()  { return Math.max(0, STAR_LIFETIME - this.lifeTimer); }

  draw(ctx) {
    const { x, y, radius: r, pulse, palette, timeLeft, carrying, carryTimer } = this;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (carrying) {
      const t   = Math.min(1, carryTimer / CARRY_DURATION);
      ctx.globalAlpha = 1 - t * 0.30;
      ctx.translate(x, y);
      ctx.scale(1 - t * 0.28, 1 - t * 0.28);
      const streak = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.1);
      streak.addColorStop(0, `${palette.fill}77`);
      streak.addColorStop(1, `${palette.fill}00`);
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
      ctx.fillStyle = streak;
      ctx.fill();
      _drawPixelStarBody(ctx, 0, 0, r, palette);
      _drawPixelFace(ctx, 0, 0, r, palette.face);
      ctx.restore();
      return;
    }

    const urgent      = timeLeft < 3;
    const urgentAlpha = urgent ? 0.7 + 0.3 * Math.sin(pulse * 6) : 1;
    ctx.globalAlpha   = urgentAlpha;

    const showGrabRing = this.grabRadius > r + 6;

    // grab bubble ring
    if (showGrabRing) {
      const ringAlpha = this.progress > 0
        ? 0.55 + 0.4 * this.progress
        : 0.18 + 0.10 * Math.sin(pulse * 1.4);
      ctx.beginPath();
      ctx.arc(x, y, this.grabRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(80, 220, 255, ${ringAlpha})`;
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // circular glow behind star
    const glowR = r * 2.0;
    const glow = ctx.createRadialGradient(x, y, r * 0.25, x, y, glowR);
    glow.addColorStop(0, `${palette.fill}66`);
    glow.addColorStop(0.65, `${palette.fill}22`);
    glow.addColorStop(1, `${palette.fill}00`);
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // pixel star body + face
    _drawPixelStarBody(ctx, x, y, r, palette);
    _drawPixelFace(ctx, x, y, r, palette.face);

    // countdown
    const P       = Math.max(2, Math.round(r / 5));
    const secsLeft = Math.ceil(timeLeft);
    ctx.font         = `bold ${P * 3}px "Press Start 2P", monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle    = urgent ? '#ff2244' : palette.face;
    ctx.fillText(`${secsLeft}s`, x, y + r + P * 5);

    // hold-progress arc
    if (this.progress > 0 && showGrabRing) {
      ctx.beginPath();
      ctx.arc(x, y, r + 9, -Math.PI / 2, -Math.PI / 2 + this.progress * Math.PI * 2);
      ctx.strokeStyle = `rgba(80, 220, 255, ${0.5 + 0.5 * this.progress})`;
      ctx.lineWidth   = 4;
      ctx.lineCap     = 'square';
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export class StardustManager {
  constructor() {
    this.targets       = [];
    this.spawnTimer    = 0;
    this.spawnInterval = 3.5;
    this.maxTargets    = 3;
    this.bounds        = null;
    this.totalMisses   = 0;
  }

  setBounds(xMin, xMax, yMin, yMax) {
    this.bounds = { xMin, xMax, yMin, yMax };
  }

  getGrabbedBy(side) {
    return this.targets.find(
      t => !t.collected && !t.expired && t.lockedBy === side && (t.holdTimer > 0 || t.carrying)
    ) ?? null;
  }

  update(dt, canvasWidth, canvasHeight, lwx, lwy, rwx, rwy, bubbleRadius, shipX = 0, shipY = 0) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval && this.targets.length < this.maxTargets) {
      this.spawnTimer = 0;
      const b  = this.bounds;
      const x0 = b ? b.xMin : 80;
      const x1 = b ? b.xMax : canvasWidth  - 80;
      const y0 = b ? b.yMin : 80;
      const y1 = b ? b.yMax : canvasHeight * 0.55;
      this.targets.push(new Stardust(
        x0 + Math.random() * (x1 - x0),
        y0 + Math.random() * (y1 - y0)
      ));
    }

    for (const t of this.targets) {
      t.update(dt, lwx, lwy, rwx, rwy, bubbleRadius, shipX, shipY);
    }

    const collectedTargets = this.targets.filter(t => t._xpPending);
    const collectedEvents = collectedTargets.map((t) => ({
      latencyMs: t._collectionLatencyMs,
      hand: t._collectedBy,
      x: t.x,
      y: t.y,
    }));
    const collected = collectedTargets.length;

    const missedTargets = this.targets.filter(t => t.expired);
    const missedEvents = missedTargets.map((t) => ({
      latencyMs: Math.round((t._missLatencyMs ?? t.lifeTimer * 1000)),
      hand: t._missedBy,
      x: t.x,
      y: t.y,
    }));
    const missed = missedTargets.length;

    this.targets.forEach(t => {
      t._xpPending = false;
      if (t.expired && t._missLatencyMs === null) t._missLatencyMs = Math.round(t.lifeTimer * 1000);
    });

    this.totalMisses += missed;
    this.targets = this.targets.filter(t => !t.collected && !t.expired);

    return { collected, missed, collectedEvents, missedEvents };
  }

  draw(ctx) {
    for (const t of this.targets) t.draw(ctx);
  }

  reset() {
    this.targets     = [];
    this.spawnTimer  = 0;
    this.totalMisses = 0;
  }

  setLevel(level) {
    this.spawnInterval = Math.max(1.5, 3.5 - (level - 1) * 0.3);
    this.maxTargets    = Math.min(6, 3 + Math.floor((level - 1) / 2));
  }
}
