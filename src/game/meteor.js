const METEOR_PALETTES = [
  { base: '#808080', light: '#aaaaaa', dark: '#484848', crater: '#303030' }, // gray
  { base: '#706858', light: '#988870', dark: '#403828', crater: '#282018' }, // brown-gray
  { base: '#607080', light: '#8898a8', dark: '#384048', crater: '#202830' }, // blue-gray
];

export class Meteor {
  constructor(canvasWidth) {
    this.x          = 40 + Math.random() * (canvasWidth - 80);
    this.y          = -50;
    this.radius     = 18 + Math.random() * 22;
    this.speed      = 120 + Math.random() * 100;
    this.rotation   = Math.random() * Math.PI * 2;
    this.rotSpeed   = (Math.random() - 0.5) * 2.5;
    this.alive      = true;
    this.palette    = METEOR_PALETTES[Math.floor(Math.random() * METEOR_PALETTES.length)];
    this.variant    = Math.floor(Math.random() * 3);
    this.trailPhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.y          += this.speed * dt;
    this.rotation   += this.rotSpeed * dt;
    this.trailPhase += dt * 9;
  }

  _drawTail(ctx) {
    const { x, y, radius, trailPhase } = this;
    // hot-to-cool ramp: white-yellow → orange → red → dark
    const COLORS = ['#fffff0','#ffe860','#ffb020','#ff6010','#ff2808','#cc1808','#781010','#380808'];
    const steps  = COLORS.length;
    const maxOff = radius * 3.2;
    const baseW  = radius * 0.95;
    const segH   = Math.ceil(maxOff / steps) + 1;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < steps; i++) {
      const t     = (i + 1) / steps;
      const offY  = t * maxOff;
      const w     = Math.max(2, Math.round(baseW * (1 - t * 0.82)));
      const shimX = Math.sin(trailPhase + i * 1.6) * 2;
      ctx.globalAlpha = (1 - t) * 0.72;
      ctx.fillStyle   = COLORS[i];
      ctx.fillRect(
        Math.round(x - w / 2 + shimX),
        Math.round(y - offY - segH),
        w, segH
      );
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  draw(ctx) {
    this._drawTail(ctx);

    const { x, y, radius, rotation, palette, variant } = this;
    const P = Math.max(3, Math.round(radius / 5)); // pixel unit scales with size

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const r = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dx * P, dy * P, w * P, h * P); };

    if (variant === 0) {
      // Classic hex rock
      r(-2,-4, 4,1, palette.base);
      r(-3,-3, 6,1, palette.base);
      r(-4,-2, 8,4, palette.base);
      r(-3, 2, 6,1, palette.base);
      r(-2, 3, 4,1, palette.base);
      // highlights
      r(-2,-3, 3,1, palette.light);
      r(-3,-2, 2,2, palette.light);
      // shadow
      r( 1, 1, 2,1, palette.dark);
      r( 0, 2, 3,1, palette.dark);
      // craters
      r(-1,-1, 2,2, palette.crater);
      r( 1,-3, 2,1, palette.crater);
    } else if (variant === 1) {
      // Chunkier square asteroid
      r(-3,-4, 6,1, palette.base);
      r(-4,-3, 8,6, palette.base);
      r(-3, 3, 6,1, palette.base);
      r(-2,-4, 1,1, palette.dark);  // notch
      // highlights
      r(-3,-3, 4,1, palette.light);
      r(-3,-2, 2,3, palette.light);
      // shadow bottom-right
      r( 1, 1, 3,2, palette.dark);
      r( 0, 3, 3,1, palette.dark);
      // craters
      r(-1, 0, 3,3, palette.crater);
      r(-2,-2, 2,2, palette.crater);
    } else {
      // Lumpy irregular rock
      r(-1,-5, 2,1, palette.base);
      r(-2,-4, 5,1, palette.base);
      r(-4,-3, 7,2, palette.base);
      r(-3,-1, 8,3, palette.base);
      r(-3, 2, 7,1, palette.base);
      r(-2, 3, 5,1, palette.base);
      r(-1, 4, 3,1, palette.base);
      // highlights
      r(-1,-4, 3,1, palette.light);
      r(-3,-2, 2,3, palette.light);
      // shadow
      r( 2, 0, 2,3, palette.dark);
      r( 1, 3, 3,1, palette.dark);
      // craters
      r( 0,-1, 2,2, palette.crater);
      r(-2, 0, 2,1, palette.crater);
    }

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
    this.extraSpawnChance = 0;
  }

  update(dt, canvasWidth, canvasHeight, ship) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.meteors.push(new Meteor(canvasWidth));
      if (Math.random() < this.extraSpawnChance) {
        this.meteors.push(new Meteor(canvasWidth));
      }
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

  setLevel(level) {
    this.spawnInterval   = Math.max(0.55, 2.2 - (level - 1) * 0.22);
    this.extraSpawnChance = Math.min(0.95, (level - 1) * 0.11);
  }
}
