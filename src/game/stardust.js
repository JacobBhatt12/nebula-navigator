const HOLD_DURATION = 1.5; // seconds wrist must stay inside bubble to collect

export class Stardust {
  constructor(x, y) {
    this.x          = x;
    this.y          = y;
    this.radius     = 20;
    this.holdTimer  = 0;
    this.collected  = false;
    this.pulse      = Math.random() * Math.PI * 2; // phase offset for glow animation
  }

  update(dt, lwx, lwy, rwx, rwy, bubbleRadius) {
    if (this.collected) return;

    this.pulse += dt * 3;

    const inRange =
      Math.hypot(lwx - this.x, lwy - this.y) < bubbleRadius ||
      Math.hypot(rwx - this.x, rwy - this.y) < bubbleRadius;

    if (inRange) {
      this.holdTimer += dt;
      if (this.holdTimer >= HOLD_DURATION) this.collected = true;
    } else {
      // decay twice as fast as it fills so a near-miss feels fair
      this.holdTimer = Math.max(0, this.holdTimer - dt * 2);
    }
  }

  get progress() {
    return Math.min(1, this.holdTimer / HOLD_DURATION);
  }

  draw(ctx) {
    const { x, y, radius, pulse, progress } = this;
    const glow = 0.6 + 0.4 * Math.sin(pulse);

    ctx.save();

    // outer glow ring
    const outerGrad = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2.2);
    outerGrad.addColorStop(0, `rgba(255, 220, 80, ${0.25 * glow})`);
    outerGrad.addColorStop(1, 'rgba(255, 180, 0, 0)');
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // core orb
    const coreGrad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 1, x, y, radius);
    coreGrad.addColorStop(0, `rgba(255, 255, 200, ${glow})`);
    coreGrad.addColorStop(0.5, `rgba(255, 200, 50, ${0.9 * glow})`);
    coreGrad.addColorStop(1, `rgba(200, 120, 0, ${0.7 * glow})`);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // 4-point star sparkle
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * glow})`;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + pulse * 0.2;
      const len   = radius * 1.4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 2, len * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // hold-progress arc
    if (progress > 0) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 7, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = `rgba(80, 220, 255, ${0.5 + 0.5 * progress})`;
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }
}

export class StardustManager {
  constructor() {
    this.targets       = [];
    this.spawnTimer    = 0;
    this.spawnInterval = 3.5;
    this.maxTargets    = 3;
  }

  // Returns number of targets collected this frame
  update(dt, canvasWidth, canvasHeight, lwx, lwy, rwx, rwy, bubbleRadius) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval && this.targets.length < this.maxTargets) {
      this.spawnTimer = 0;
      this.targets.push(new Stardust(
        80 + Math.random() * (canvasWidth  - 160),
        80 + Math.random() * (canvasHeight * 0.55)
      ));
    }

    for (const t of this.targets) {
      t.update(dt, lwx, lwy, rwx, rwy, bubbleRadius);
    }

    const collected = this.targets.filter(t => t.collected).length;
    this.targets    = this.targets.filter(t => !t.collected);
    return collected;
  }

  draw(ctx) {
    for (const t of this.targets) t.draw(ctx);
  }

  reset() {
    this.targets    = [];
    this.spawnTimer = 0;
  }

  // Increase density per level (Phase 3)
  setLevel(level) {
    this.spawnInterval = Math.max(1.5, 3.5 - (level - 1) * 0.3);
    this.maxTargets    = Math.min(6, 3 + Math.floor((level - 1) / 2));
  }
}
