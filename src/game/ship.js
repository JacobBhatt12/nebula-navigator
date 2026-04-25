export class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width  = 54;
    this.height = 72;
    this.hitFlash = 0; // seconds remaining for red flash on collision
  }

  // Called each frame from gameLoop with the target pixel X derived from poseData.hipX
  lerpTo(targetX, dt) {
    this.x += (targetX - this.x) * Math.min(1, 6 * dt);
  }

  onHit() {
    this.hitFlash = 0.3;
  }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  draw(ctx) {
    const { x, y, width, height } = this;
    ctx.save();
    ctx.translate(x, y);

    // engine glow
    const glowGrad = ctx.createRadialGradient(0, height * 0.45, 2, 0, height * 0.45, 22);
    glowGrad.addColorStop(0, 'rgba(100, 60, 255, 0.9)');
    glowGrad.addColorStop(1, 'rgba(100, 60, 255, 0)');
    ctx.beginPath();
    ctx.ellipse(0, height * 0.45, 10, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // left wing
    ctx.beginPath();
    ctx.moveTo(-width * 0.25, height * 0.1);
    ctx.lineTo(-width * 0.55, height * 0.4);
    ctx.lineTo(-width * 0.2, height * 0.35);
    ctx.closePath();
    ctx.fillStyle = '#3a2a7a';
    ctx.fill();
    ctx.strokeStyle = '#7b5cff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // right wing
    ctx.beginPath();
    ctx.moveTo(width * 0.25, height * 0.1);
    ctx.lineTo(width * 0.55, height * 0.4);
    ctx.lineTo(width * 0.2, height * 0.35);
    ctx.closePath();
    ctx.fillStyle = '#3a2a7a';
    ctx.fill();
    ctx.strokeStyle = '#7b5cff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // main hull
    ctx.beginPath();
    ctx.moveTo(0, -height * 0.5);
    ctx.bezierCurveTo(width * 0.35, -height * 0.2, width * 0.3, height * 0.25, 0, height * 0.5);
    ctx.bezierCurveTo(-width * 0.3, height * 0.25, -width * 0.35, -height * 0.2, 0, -height * 0.5);
    ctx.fillStyle = this.hitFlash > 0 ? '#601530' : '#1e1560';
    ctx.fill();
    ctx.strokeStyle = this.hitFlash > 0 ? '#ff4466' : '#7b5cff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // cockpit
    ctx.beginPath();
    ctx.ellipse(0, -height * 0.15, width * 0.15, height * 0.18, 0, 0, Math.PI * 2);
    const cockpitGrad = ctx.createRadialGradient(-3, -height * 0.2, 1, 0, -height * 0.15, width * 0.15);
    cockpitGrad.addColorStop(0, '#c8b8ff');
    cockpitGrad.addColorStop(1, '#4020a0');
    ctx.fillStyle = cockpitGrad;
    ctx.fill();
    ctx.strokeStyle = '#a080ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}
