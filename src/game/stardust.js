const HOLD_DURATION = 1.5;   // seconds wrist must stay inside bubble to collect
const STAR_LIFETIME = 8.0;   // seconds before a star expires (miss)
const FLY_DURATION  = 0.30;  // seconds for pull-to-ship animation
const GRAB_RADIUS   = 55;    // pixels — bubble around each star that arm tip must enter

const PALETTES = [
  { fill: '#ffe040', stroke: '#ffaa00', face: '#a06000', blush: '#ffb060' }, // yellow
  { fill: '#60e880', stroke: '#20b840', face: '#0a6020', blush: '#80e8a0' }, // green
  { fill: '#40d8d8', stroke: '#00a8b8', face: '#005060', blush: '#60e0e0' }, // teal
  { fill: '#ff88cc', stroke: '#d040a0', face: '#800040', blush: '#ffaada' }, // pink
];

export class Stardust {
  constructor(x, y) {
    this.x          = x;
    this.y          = y;
    this.radius     = 22;
    this.holdTimer  = 0;
    this.lifeTimer  = 0;
    this.collected  = false;
    this.expired    = false;
    this.pulse      = Math.random() * Math.PI * 2;
    this.palette    = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    this._spin      = 0;

    // which arm locked onto this star: 'left' | 'right' | null
    this.lockedBy   = null;

    // pull-to-ship animation
    this.flying     = false;
    this.flyTimer   = 0;
    this._flyStartX = 0;
    this._flyStartY = 0;
    this._xpPending = false; // true for one frame when XP should be awarded
  }

  update(dt, lwx, lwy, rwx, rwy, bubbleRadius, shipX, shipY) {
    if (this.collected || this.expired) return;

    this.pulse     += dt * 2.8;
    this._spin     += dt * 0.6;
    this.lifeTimer += dt;

    // pull-to-ship animation after grab completes
    if (this.flying) {
      this.flyTimer += dt;
      const t    = Math.min(1, this.flyTimer / FLY_DURATION);
      const ease = 1 - (1 - t) * (1 - t); // ease-out quad
      this.x = this._flyStartX + (shipX - this._flyStartX) * ease;
      this.y = this._flyStartY + (shipY - this._flyStartY) * ease;
      if (this.flyTimer >= FLY_DURATION) this.collected = true;
      return;
    }

    if (this.lifeTimer >= STAR_LIFETIME) {
      this.expired = true;
      return;
    }

    const leftDist  = Math.hypot(lwx - this.x, lwy - this.y);
    const rightDist = Math.hypot(rwx - this.x, rwy - this.y);
    const leftIn    = leftDist  < GRAB_RADIUS;
    const rightIn   = rightDist < GRAB_RADIUS;

    // lock onto the closest wrist that enters range (first contact wins)
    if (!this.lockedBy) {
      if      (leftIn && rightIn) this.lockedBy = leftDist <= rightDist ? 'left' : 'right';
      else if (leftIn)            this.lockedBy = 'left';
      else if (rightIn)           this.lockedBy = 'right';
    }

    // only the locking wrist keeps the hold alive; release if it leaves
    const inRange = this.lockedBy === 'left'  ? leftIn
                  : this.lockedBy === 'right' ? rightIn
                  : false;

    if (!inRange) this.lockedBy = null;

    if (inRange) {
      this.holdTimer += dt;
      if (this.holdTimer >= HOLD_DURATION) {
        // start flying to ship — XP awarded this frame
        this.flying     = true;
        this._xpPending = true;
        this._flyStartX = this.x;
        this._flyStartY = this.y;
      }
    } else {
      this.holdTimer = Math.max(0, this.holdTimer - dt * 2);
    }
  }

  get progress() { return Math.min(1, this.holdTimer / HOLD_DURATION); }
  get timeLeft()  { return Math.max(0, STAR_LIFETIME - this.lifeTimer); }

  draw(ctx) {
    const { x, y, radius: r, pulse, _spin, palette, timeLeft, flying, flyTimer } = this;

    // shrink and fade while flying to ship
    if (flying) {
      const t     = Math.min(1, flyTimer / FLY_DURATION);
      const scale = 1 - t * 0.75;
      ctx.save();
      ctx.globalAlpha = 1 - t * 0.6;
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      _drawStarBody(ctx, 0, 0, r, _spin, palette);
      ctx.restore();
      return;
    }

    const glow        = 0.65 + 0.35 * Math.sin(pulse);
    const urgent      = timeLeft < 3;
    const urgentAlpha = urgent ? 0.7 + 0.3 * Math.sin(pulse * 6) : 1;

    ctx.save();
    ctx.globalAlpha = urgentAlpha;

    // grab bubble ring — faint dashed circle showing the arm-tip lock zone
    const ringAlpha = this.progress > 0
      ? 0.55 + 0.4 * this.progress
      : 0.18 + 0.10 * Math.sin(pulse * 1.4);
    ctx.beginPath();
    ctx.arc(x, y, GRAB_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(80, 220, 255, ${ringAlpha})`;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // outer glow
    const outerGrad = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
    outerGrad.addColorStop(0, palette.fill + Math.round(0.3 * glow * 255).toString(16).padStart(2, '0'));
    outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // 5-point star body (rotated slowly)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(_spin);
    _drawStarBody(ctx, 0, 0, r, 0, palette);
    ctx.restore();

    // kawaii face (always upright)
    const eyeY  = y - r * 0.06;
    const eyeOff = r * 0.28;
    const eyeR  = r * 0.11;

    // blush cheeks
    ctx.beginPath();
    ctx.ellipse(x - eyeOff * 1.2, eyeY + r * 0.22, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = palette.blush + '80';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + eyeOff * 1.2, eyeY + r * 0.22, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = palette.face;
    ctx.beginPath();
    ctx.ellipse(x - eyeOff, eyeY, eyeR, eyeR * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + eyeOff, eyeY, eyeR, eyeR * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // eye glints
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(x - eyeOff + eyeR * 0.4, eyeY - eyeR * 0.35, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + eyeOff + eyeR * 0.4, eyeY - eyeR * 0.35, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();

    // smile
    ctx.beginPath();
    ctx.arc(x, eyeY + r * 0.22, r * 0.22, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = palette.face;
    ctx.lineWidth   = r * 0.10;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // countdown text
    const secsLeft = Math.ceil(timeLeft);
    ctx.font         = `bold ${Math.round(r * 0.72)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle    = urgent ? '#ff4466' : palette.face;
    ctx.fillText(`${secsLeft}s`, x, y + r * 1.78);

    // hold-progress arc
    if (this.progress > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + this.progress * Math.PI * 2);
      ctx.strokeStyle = `rgba(80, 220, 255, ${0.5 + 0.5 * this.progress})`;
      ctx.lineWidth   = 3.5;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function _drawStarBody(ctx, cx, cy, r, rotation, palette) {
  ctx.save();
  ctx.rotate(rotation);
  _drawStarPath(ctx, cx, cy, r, r * 0.42, 5);
  const bodyGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 2, 0, 0, r);
  bodyGrad.addColorStop(0,   _lighten(palette.fill, 0.35));
  bodyGrad.addColorStop(0.5, palette.fill);
  bodyGrad.addColorStop(1,   palette.stroke);
  ctx.fillStyle   = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.stroke();
  ctx.restore();
}

function _drawStarPath(ctx, cx, cy, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r     = i % 2 === 0 ? outerR : innerR;
    const px    = cx + Math.cos(angle) * r;
    const py    = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function _lighten(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(amt * 255));
  const g = Math.min(255, ((n >> 8)  & 255) + Math.round(amt * 255));
  const b = Math.min(255, ( n        & 255) + Math.round(amt * 255));
  return `rgb(${r},${g},${b})`;
}

// ─────────────────────────────────────────────────────────────────────────────

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

  // Returns the star currently locked and being held by the given arm side
  getGrabbedBy(side) {
    return this.targets.find(
      t => !t.collected && !t.expired && t.lockedBy === side && (t.holdTimer > 0 || t.flying)
    ) ?? null;
  }

  // Returns { collected, missed } counts for this frame
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

    // Stars that just triggered their fly animation award XP this frame
    const collected = this.targets.filter(t => t._xpPending).length;
    this.targets.forEach(t => { t._xpPending = false; });

    const missed = this.targets.filter(t => t.expired).length;
    this.totalMisses += missed;
    this.targets = this.targets.filter(t => !t.collected && !t.expired);

    return { collected, missed };
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
