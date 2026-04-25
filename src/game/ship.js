export class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width  = 64;
    this.height = 80;
    this.hitFlash    = 0;
    this._thrustPhase = 0;
  }

  lerpTo(targetX, dt) {
    this.x += (targetX - this.x) * Math.min(1, 6 * dt);
  }

  onHit() { this.hitFlash = 0.3; }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this._thrustPhase += dt * 9;
  }

  draw(ctx, skin = null) {
    const s = skin ?? { hull: '#e86020', stroke: '#ff9040', wing: '#1a4a7a', cockpit: '#2080c8' };
    const { x, y, width: w, height: h } = this;
    const flash    = this.hitFlash > 0;
    const flicker  = 0.72 + 0.28 * Math.sin(this._thrustPhase);

    const hullColor   = flash ? '#601530' : s.hull;
    const strokeColor = flash ? '#ff4466' : s.stroke;
    const podColor    = flash ? '#601530' : s.wing;
    const podStroke   = flash ? '#ff4466' : (s.wing + 'cc');

    ctx.save();
    ctx.translate(x, y);

    // ── Main thrust trail ──────────────────────────────────────────────────────
    const trailLen = 44 + 14 * flicker;
    const trailGrad = ctx.createLinearGradient(0, h * 0.36, 0, h * 0.36 + trailLen);
    trailGrad.addColorStop(0,   `rgba(0, 230, 255, ${0.95 * flicker})`);
    trailGrad.addColorStop(0.4, `rgba(0, 180, 255, ${0.55 * flicker})`);
    trailGrad.addColorStop(1,   'rgba(0, 60, 200, 0)');
    ctx.beginPath();
    ctx.ellipse(0, h * 0.36 + trailLen * 0.5, 9, trailLen * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = trailGrad;
    ctx.fill();

    // inner white-hot core
    const coreTrail = ctx.createLinearGradient(0, h * 0.36, 0, h * 0.36 + trailLen * 0.55);
    coreTrail.addColorStop(0, `rgba(255, 255, 255, ${0.95 * flicker})`);
    coreTrail.addColorStop(1,  'rgba(0, 220, 255, 0)');
    ctx.beginPath();
    ctx.ellipse(0, h * 0.36 + trailLen * 0.25, 3.5, trailLen * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = coreTrail;
    ctx.fill();

    // ── Side thruster pods ─────────────────────────────────────────────────────
    [-w * 0.43, w * 0.43].forEach(px => {
      const podY = h * 0.14;

      // pod glow halo
      const podHalo = ctx.createRadialGradient(px, podY + 10, 2, px, podY + 10, 22);
      podHalo.addColorStop(0, `rgba(0, 200, 255, ${0.3 * flicker})`);
      podHalo.addColorStop(1, 'rgba(0, 200, 255, 0)');
      ctx.beginPath();
      ctx.arc(px, podY + 10, 22, 0, Math.PI * 2);
      ctx.fillStyle = podHalo;
      ctx.fill();

      // pod body
      ctx.beginPath();
      ctx.roundRect(px - 11, podY - 7, 22, 24, 6);
      ctx.fillStyle   = podColor;
      ctx.fill();
      ctx.strokeStyle = podStroke;
      ctx.lineWidth   = 1.8;
      ctx.stroke();

      // pod highlight stripe
      ctx.beginPath();
      ctx.roundRect(px - 6, podY - 4, 5, 14, 3);
      ctx.fillStyle = `rgba(140, 200, 255, 0.35)`;
      ctx.fill();

      // mini thrust flame below pod
      const flameGrad = ctx.createLinearGradient(px, podY + 16, px, podY + 30);
      flameGrad.addColorStop(0, `rgba(0, 220, 255, ${0.75 * flicker})`);
      flameGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.beginPath();
      ctx.ellipse(px, podY + 23, 4, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = flameGrad;
      ctx.fill();
    });

    // ── Main hull (orange rounded bullet shape) ────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.46);
    ctx.bezierCurveTo( w * 0.36, -h * 0.30,  w * 0.38,  h * 0.22,  0,  h * 0.36);
    ctx.bezierCurveTo(-w * 0.38,  h * 0.22, -w * 0.36, -h * 0.30,  0, -h * 0.46);
    ctx.fillStyle   = hullColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // hull highlight
    const hlGrad = ctx.createLinearGradient(-w * 0.14, -h * 0.43, w * 0.08, -h * 0.08);
    hlGrad.addColorStop(0, 'rgba(255, 210, 130, 0.58)');
    hlGrad.addColorStop(1, 'rgba(255, 140, 60, 0)');
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.44);
    ctx.bezierCurveTo( w * 0.2, -h * 0.28,  w * 0.18, -h * 0.04,  0, -h * 0.04);
    ctx.bezierCurveTo(-w * 0.18, -h * 0.04, -w * 0.2, -h * 0.28,  0, -h * 0.44);
    ctx.fillStyle = hlGrad;
    ctx.fill();

    // ── Blue cockpit dome ──────────────────────────────────────────────────────
    const domeY  = -h * 0.20;
    const domeRx = w * 0.22;
    const domeRy = h * 0.21;

    ctx.beginPath();
    ctx.ellipse(0, domeY, domeRx, domeRy, 0, 0, Math.PI * 2);
    const domeGrad = ctx.createRadialGradient(
      -domeRx * 0.28, domeY - domeRy * 0.32, 2,
       0, domeY, domeRx
    );
    domeGrad.addColorStop(0,   '#a8dcff');
    domeGrad.addColorStop(0.4, flash ? '#8040c0' : s.cockpit);
    domeGrad.addColorStop(1,   flash ? '#300040' : s.cockpit + '88');
    ctx.fillStyle   = domeGrad;
    ctx.fill();
    ctx.strokeStyle = flash ? '#ff4466' : '#60c0ff';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // dome glare
    ctx.beginPath();
    ctx.ellipse(-domeRx * 0.24, domeY - domeRy * 0.30, domeRx * 0.30, domeRy * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200, 235, 255, 0.52)';
    ctx.fill();

    ctx.restore();
  }
}
