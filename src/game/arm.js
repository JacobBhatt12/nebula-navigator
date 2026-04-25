export class Arm {
  constructor() {
    // targetX/Y will come from poseData wrists once tracking is wired in
    this.targetX = 0;
    this.targetY = 0;
  }

  // originX/Y: shoulder anchor point on the ship
  // targetX/Y: wrist position (stub: set externally from poseData)
  draw(ctx, originX, originY, targetX, targetY) {
    const tx = targetX ?? this.targetX;
    const ty = targetY ?? this.targetY;

    const dx = tx - originX;
    const dy = ty - originY;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;

    const angle = Math.atan2(dy, dx);

    ctx.save();

    // arm beam
    const grad = ctx.createLinearGradient(originX, originY, tx, ty);
    grad.addColorStop(0, 'rgba(123, 92, 255, 0.9)');
    grad.addColorStop(0.6, 'rgba(80, 200, 255, 0.7)');
    grad.addColorStop(1, 'rgba(80, 200, 255, 0.2)');

    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // inner highlight
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = 'rgba(220, 210, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // wrist glow orb
    const orbGrad = ctx.createRadialGradient(tx, ty, 1, tx, ty, 12);
    orbGrad.addColorStop(0, 'rgba(160, 220, 255, 1)');
    orbGrad.addColorStop(0.4, 'rgba(80, 160, 255, 0.6)');
    orbGrad.addColorStop(1, 'rgba(80, 100, 255, 0)');
    ctx.beginPath();
    ctx.arc(tx, ty, 12, 0, Math.PI * 2);
    ctx.fillStyle = orbGrad;
    ctx.fill();

    ctx.restore();
  }
}
