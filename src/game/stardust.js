const HOLD_DURATION = 1.5;
const STAR_LIFETIME = 8.0;
const FLY_DURATION  = 0.30;
const GRAB_RADIUS_DEFAULT = 55;

// Pixel-art palettes for each star type
const PALETTES = [
  { fill: '#ffe840', light: '#ffffff', dark: '#c89000', face: '#604000' }, // yellow
  { fill: '#40e870', light: '#aaffcc', dark: '#109030', face: '#004018' }, // green
  { fill: '#40d8ff', light: '#ccf8ff', dark: '#0088b0', face: '#003848' }, // cyan
  { fill: '#ff88cc', light: '#ffccee', dark: '#c02880', face: '#600030' }, // pink
];

// Draw a 4-pointed pixel art sparkle star centered at (cx, cy)
function _drawPixelStarBody(ctx, cx, cy, r, palette) {
  const P  = Math.max(2, Math.round(r / 5));
  const pr = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(cx + x * P, cy + y * P, w * P, h * P);
  };

  // Horizontal arm
  pr(-5,-1,10, 2, palette.fill);
  // Vertical arm
  pr(-1,-5, 2,10, palette.fill);
  // Diamond center
  pr(-2,-2, 4, 4, palette.fill);
  pr(-3,-1, 6, 2, palette.fill);
  pr(-1,-3, 2, 6, palette.fill);
  // Spike tips (lighter)
  pr(-1,-5, 2, 1, palette.light);
  pr(-1, 5, 2, 1, palette.light);
  pr(-5,-1, 1, 2, palette.light);
  pr( 5,-1, 1, 2, palette.light);
  // Diagonal corner highlights
  pr(-2,-2, 2, 1, palette.light);
  pr(-2,-1, 1, 2, palette.light);
  // Shadow bottom-right
  pr( 1, 1, 2, 1, palette.dark);
  pr( 1, 2, 1, 1, palette.dark);
}

// Pixel art face: square eyes + smile
function _drawPixelFace(ctx, cx, cy, r, faceColor) {
  const P  = Math.max(2, Math.round(r / 5));
  const pr = (x, y, w, h) => { ctx.fillStyle = faceColor; ctx.fillRect(cx + x*P, cy + y*P, w*P, h*P); };

  // eyes
  pr(-2, -1, 2, 2);
  pr( 1, -1, 2, 2);
  // glints
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(cx + (-1)*P, cy + (-1)*P, P, P);
  ctx.fillRect(cx +  (2)*P, cy + (-1)*P, P, P);
  // smile row
  pr(-2, 2, 1, 1);
  pr(-1, 3, 3, 1);
  pr( 2, 2, 1, 1);
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
    this.flying     = false;
    this.flyTimer   = 0;
    this._flyStartX = 0;
    this._flyStartY = 0;
    this._xpPending = false;
  }

  update(dt, lwx, lwy, rwx, rwy, bubbleRadius, shipX, shipY) {
    if (this.collected || this.expired) return;

    this.pulse     += dt * 2.8;
    this._spin     += dt * 0.6;
    this.lifeTimer += dt;

    if (this.flying) {
      this.flyTimer += dt;
      const t    = Math.min(1, this.flyTimer / FLY_DURATION);
      const ease = 1 - (1 - t) * (1 - t);
      this.x = this._flyStartX + (shipX - this._flyStartX) * ease;
      this.y = this._flyStartY + (shipY - this._flyStartY) * ease;
      if (this.flyTimer >= FLY_DURATION) this.collected = true;
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
      if (this.holdTimer >= HOLD_DURATION) {
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
    const { x, y, radius: r, pulse, palette, timeLeft, flying, flyTimer } = this;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (flying) {
      const t   = Math.min(1, flyTimer / FLY_DURATION);
      ctx.globalAlpha = 1 - t * 0.6;
      ctx.translate(x, y);
      ctx.scale(1 - t * 0.75, 1 - t * 0.75);
      _drawPixelStarBody(ctx, 0, 0, r, palette);
      ctx.restore();
      return;
    }

    const urgent      = timeLeft < 3;
    const urgentAlpha = urgent ? 0.7 + 0.3 * Math.sin(pulse * 6) : 1;
    ctx.globalAlpha   = urgentAlpha;

    // grab bubble ring
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

    // square pixel glow behind star
    const gs = r * 2.6;
    const ga = 0.10 + 0.06 * Math.sin(pulse);
    ctx.fillStyle = palette.fill + Math.round(ga * 255).toString(16).padStart(2, '0');
    ctx.fillRect(x - gs, y - gs, gs * 2, gs * 2);

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
    if (this.progress > 0) {
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
      t => !t.collected && !t.expired && t.lockedBy === side && (t.holdTimer > 0 || t.flying)
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
