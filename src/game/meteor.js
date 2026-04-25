// Bumpy angles baked in so each Meteor instance shares the same shape variation
const BUMP_OFFSETS = [0.9, 1.0, 0.8, 1.1, 0.85, 1.0, 0.95, 0.8, 1.05, 0.9, 0.85, 1.0];
const SIDES = BUMP_OFFSETS.length;

export class Meteor {
  constructor(canvasWidth) {
    this.x        = 40 + Math.random() * (canvasWidth - 80);
    this.y        = -50;
    this.radius   = 18 + Math.random() * 22;
    this.speed    = 120 + Math.random() * 100;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 2.5;
    this.alive    = true;
    // unique shape per meteor
    this.bumps    = BUMP_OFFSETS.map(b => b * (0.85 + Math.random() * 0.3));
  }

  update(dt) {
    this.y        += this.speed * dt;
    this.rotation += this.rotSpeed * dt;
  }

  draw(ctx) {
    const { x, y, radius, rotation, bumps } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // rock body
    ctx.beginPath();
    for (let i = 0; i < SIDES; i++) {
      const angle = (i / SIDES) * Math.PI * 2;
      const r = radius * bumps[i];
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 1, 0, 0, radius * 1.1);
    grad.addColorStop(0, '#8a7060');
    grad.addColorStop(0.5, '#5a4030');
    grad.addColorStop(1, '#2e1f10');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#9a8070';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // crater detail
    ctx.beginPath();
    ctx.arc(-radius * 0.25, -radius * 0.2, radius * 0.18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  collidesWithShip(ship) {
    const dx = this.x - ship.x;
    const dy = this.y - ship.y;
    return Math.hypot(dx, dy) < this.radius + 26;
  }
}

export class MeteorManager {
  constructor() {
    this.meteors       = [];
    this.spawnTimer    = 0;
    this.spawnInterval = 2.2;
  }

  // Returns number of ships hit this frame
  update(dt, canvasWidth, canvasHeight, ship) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.meteors.push(new Meteor(canvasWidth));
    }

    let hits = 0;
    for (const m of this.meteors) {
      m.update(dt);
      if (m.alive && m.collidesWithShip(ship)) {
        m.alive = false;
        hits++;
      }
    }

    this.meteors = this.meteors.filter(m => m.alive && m.y < canvasHeight + 60);
    return hits;
  }

  draw(ctx) {
    for (const m of this.meteors) m.draw(ctx);
  }

  reset() {
    this.meteors    = [];
    this.spawnTimer = 0;
  }

  // Increase difficulty — called on level-up (Phase 3)
  setLevel(level) {
    this.spawnInterval = Math.max(0.8, 2.2 - (level - 1) * 0.2);
  }
}
