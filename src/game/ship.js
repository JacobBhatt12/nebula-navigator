const P = 4; // pixel grid unit (4 canvas px per "pixel")

// r helper: draw one pixel-art cell at grid coords
function _r(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x * P, y * P, w * P, h * P);
}

// Animated pixel thrust flames below the ship
function _thrust(ctx, phase, nozzles) {
  const f   = 0.62 + 0.38 * Math.sin(phase);
  const len = 3 + Math.round(3 * f);
  nozzles.forEach(([nx, ny]) => {
    for (let i = 0; i < len; i++) {
      const a = ((1 - i / len) * 0.9 * f).toFixed(2);
      ctx.fillStyle = `rgba(0,220,255,${a})`;
      ctx.fillRect((nx - 1) * P, (ny + i) * P, 2 * P, P);
    }
    const cl = Math.round(len * 0.55);
    for (let i = 0; i < cl; i++) {
      const a = ((1 - i / cl) * f).toFixed(2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(nx * P, (ny + i) * P, P, P);
    }
  });
}

// ── 6 pixel ship designs ───────────────────────────────────────────────────────

// Cadet — classic white/gray shuttle, spread wings, blue dome
function _shipCadet(ctx, c, flash) {
  const r = (x,y,w,h,col) => _r(ctx, x, y, w, h, flash ? _flashCol(col) : col);
  // wings behind body
  r(-8, 0, 4, 5, c.wing);
  r( 4, 0, 4, 5, c.wing);
  r(-7, 4, 2, 2, c.wing);
  r( 5, 4, 2, 2, c.wing);
  // stepped nose
  r(-1,-9, 2, 1, c.hull);
  r(-2,-8, 4, 1, c.hull);
  r(-3,-7, 6, 2, c.hull);
  // body
  r(-4,-5, 8,10, c.hull);
  r(-3, 5, 6, 3, c.hull);
  r(-2, 8, 4, 1, c.hull);
  // cockpit dome
  r(-2,-7, 4, 4, c.cockpit);
  // accent stripe
  r(-4,-2, 8, 1, c.stroke);
  // nozzle mounts
  r(-3, 9, 2, 1, c.wing);
  r( 1, 9, 2, 1, c.wing);
}

// Voyager — red delta fighter, swept wings, pointed nose
function _shipVoyager(ctx, c, flash) {
  const r = (x,y,w,h,col) => _r(ctx, x, y, w, h, flash ? _flashCol(col) : col);
  // swept delta wings
  r(-8,-2, 4, 2, c.wing);
  r( 4,-2, 4, 2, c.wing);
  r(-8, 0, 5, 4, c.wing);
  r( 3, 0, 5, 4, c.wing);
  r(-7, 4, 3, 2, c.wing);
  r( 4, 4, 3, 2, c.wing);
  // pointy nose
  r(-1,-9, 2, 2, c.hull);
  r(-2,-7, 4, 2, c.hull);
  r(-3,-5, 6, 10, c.hull);
  r(-2, 5, 4, 4, c.hull);
  r(-1, 9, 2, 1, c.hull);
  // cockpit slit
  r(-2,-6, 4, 2, c.cockpit);
  // accent
  r(-3,-1, 6, 1, c.stroke);
}

// Sunfire — tall gold rocket, big stabilizer fins
function _shipSunfire(ctx, c, flash) {
  const r = (x,y,w,h,col) => _r(ctx, x, y, w, h, flash ? _flashCol(col) : col);
  // stabilizer fins
  r(-7, 3, 4, 6, c.wing);
  r( 3, 3, 4, 6, c.wing);
  r(-6, 7, 2, 2, c.wing);
  r( 4, 7, 2, 2, c.wing);
  // narrow rocket body
  r(-1,-9, 2, 2, c.hull);
  r(-2,-7, 4, 3, c.hull);
  r(-2,-4, 4,12, c.hull);
  r(-3,-2, 6, 2, c.hull);
  r(-3, 4, 6, 5, c.hull);
  // cockpit porthole
  r(-1,-8, 2, 3, c.cockpit);
  // stripe
  r(-2, 0, 4, 1, c.stroke);
}

// Verdant — wide green alien saucer with spines
function _shipVerdant(ctx, c, flash) {
  const r = (x,y,w,h,col) => _r(ctx, x, y, w, h, flash ? _flashCol(col) : col);
  // side spines
  r(-9,-1, 2, 2, c.wing);
  r( 7,-1, 2, 2, c.wing);
  r(-9, 1, 1, 4, c.wing);
  r( 8, 1, 1, 4, c.wing);
  // top spike
  r(-1,-9, 2, 2, c.hull);
  // wide saucer body
  r(-3,-7, 6, 2, c.hull);
  r(-5,-5,10, 4, c.hull);
  r(-6,-1,12, 6, c.hull);
  r(-5, 5,10, 3, c.hull);
  r(-4, 8, 8, 1, c.hull);
  r(-2, 9, 4, 1, c.hull);
  // cockpit band
  r(-3,-5, 6, 2, c.cockpit);
  r(-2,-3, 4, 2, c.cockpit);
}

// Phantom — blue flat stealth delta
function _shipPhantom(ctx, c, flash) {
  const r = (x,y,w,h,col) => _r(ctx, x, y, w, h, flash ? _flashCol(col) : col);
  // flat delta sweep
  r(-8, 0, 3, 2, c.wing);
  r( 5, 0, 3, 2, c.wing);
  r(-8, 2, 5, 3, c.wing);
  r( 3, 2, 5, 3, c.wing);
  r(-7, 5, 3, 2, c.wing);
  r( 4, 5, 3, 2, c.wing);
  // slim body spine
  r(-1,-9, 2, 3, c.hull);
  r(-2,-6, 4,13, c.hull);
  r(-1, 7, 2, 3, c.hull);
  // cockpit
  r(-1,-8, 2, 4, c.cockpit);
  // wing-tip accent
  r(-8, 6, 2, 1, c.stroke);
  r( 6, 6, 2, 1, c.stroke);
  r(-2, 1, 4, 1, c.stroke);
}

// Prismatic — purple alien angular craft
function _shipPrismatic(ctx, c, flash) {
  const r = (x,y,w,h,col) => _r(ctx, x, y, w, h, flash ? _flashCol(col) : col);
  // side horns
  r(-9,-2, 3, 2, c.wing);
  r( 6,-2, 3, 2, c.wing);
  r(-8, 0, 2, 4, c.wing);
  r( 6, 0, 2, 4, c.wing);
  // top spike
  r(-1,-9, 2, 2, c.stroke);
  // body
  r(-3,-7, 6, 2, c.hull);
  r(-4,-5, 8, 4, c.hull);
  r(-5,-1,10, 6, c.hull);
  r(-4, 5, 8, 3, c.hull);
  r(-3, 8, 6, 1, c.hull);
  r(-2, 9, 4, 1, c.hull);
  // cockpit
  r(-2,-6, 4, 3, c.cockpit);
  // magic accent lines
  r(-4, 0, 8, 1, c.stroke);
  r(-3, 3, 6, 1, c.stroke);
}

function _flashCol(col) {
  // swap any color to a red flash tint during hit
  return '#ff2244';
}

// Map skin name → pixel ship draw fn + exhaust nozzles
const SHIP_MODELS = {
  Cadet:     { fn: _shipCadet,     nozzles: [[-2, 9], [1, 9]] },
  Voyager:   { fn: _shipVoyager,   nozzles: [[0, 9]]           },
  Sunfire:   { fn: _shipSunfire,   nozzles: [[0, 8]]           },
  Verdant:   { fn: _shipVerdant,   nozzles: [[-2, 9], [1, 9]] },
  Phantom:   { fn: _shipPhantom,   nozzles: [[0, 8]]           },
  Prismatic: { fn: _shipPrismatic, nozzles: [[-2, 9], [1, 9]] },
};

export class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width  = 64;
    this.height = 80;
    this.hitFlash     = 0;
    this._thrustPhase = 0;
  }

  lerpTo(targetX, dt) {
    this.x += (targetX - this.x) * Math.min(1, 6 * dt);
  }

  onHit() { this.hitFlash = 0.35; }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this._thrustPhase += dt * 10;
  }

  draw(ctx, skin = null) {
    const s     = skin ?? { name: 'Cadet', hull: '#d0dce8', stroke: '#ffffff', wing: '#4878b8', cockpit: '#40a0ff' };
    const flash = this.hitFlash > 0;
    const model = SHIP_MODELS[s.name] ?? SHIP_MODELS['Cadet'];

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(this.x, this.y);

    model.fn(ctx, s, flash);
    _thrust(ctx, this._thrustPhase, model.nozzles);

    ctx.restore();
  }
}
