const UPPER_LEN = 60;
const LOWER_LEN = 52;

export class Arm {
  draw(ctx, originX, originY, targetX, targetY) {
    const dx   = targetX - originX;
    const dy   = targetY - originY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const angle    = Math.atan2(dy, dx);
    const totalLen = UPPER_LEN + LOWER_LEN;
    const tx = originX + Math.cos(angle) * Math.min(dist, totalLen);
    const ty = originY + Math.sin(angle) * Math.min(dist, totalLen);

    // Elbow droops downward — perpendicular biased toward +Y (gravity)
    const midX  = (originX + tx) * 0.5;
    const midY  = (originY + ty) * 0.5;
    let   perpX = -(ty - originY);
    let   perpY =   tx - originX;
    if (perpY < 0) { perpX = -perpX; perpY = -perpY; }
    const pLen  = Math.hypot(perpX, perpY) || 1;
    const droop = 26;
    const elbowX = midX + (perpX / pLen) * droop;
    const elbowY = midY + (perpY / pLen) * droop;

    ctx.save();

    // drop shadow
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.quadraticCurveTo(elbowX + 2, elbowY + 4, tx + 2, ty + 4);
    ctx.strokeStyle = '#000033';
    ctx.lineWidth   = 12;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Upper arm segment ──────────────────────────────────────────────────────
    const upGrad = ctx.createLinearGradient(originX, originY, elbowX, elbowY);
    upGrad.addColorStop(0, '#9aa4c0');
    upGrad.addColorStop(1, '#606880');
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(elbowX, elbowY);
    ctx.strokeStyle = upGrad;
    ctx.lineWidth   = 10;
    ctx.lineCap     = 'butt';
    ctx.stroke();

    // upper arm highlight
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(elbowX, elbowY);
    ctx.strokeStyle = 'rgba(210, 220, 240, 0.42)';
    ctx.lineWidth   = 3.5;
    ctx.stroke();

    // ── Forearm segment ────────────────────────────────────────────────────────
    const loGrad = ctx.createLinearGradient(elbowX, elbowY, tx, ty);
    loGrad.addColorStop(0, '#788098');
    loGrad.addColorStop(1, '#485070');
    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = loGrad;
    ctx.lineWidth   = 8;
    ctx.stroke();

    // forearm highlight
    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = 'rgba(180, 195, 220, 0.38)';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // ── Shoulder joint ─────────────────────────────────────────────────────────
    _drawJoint(ctx, originX, originY, 8, '#d0d8f0', '#4050a8');

    // ── Elbow joint ───────────────────────────────────────────────────────────
    _drawJoint(ctx, elbowX, elbowY, 7, '#c0c8e0', '#384090');

    // ── Wrist glow orb ─────────────────────────────────────────────────────────
    const wGrad = ctx.createRadialGradient(tx, ty, 1, tx, ty, 13);
    wGrad.addColorStop(0,   'rgba(160, 225, 255, 1)');
    wGrad.addColorStop(0.4, 'rgba(80, 160, 255, 0.65)');
    wGrad.addColorStop(1,   'rgba(80, 100, 255, 0)');
    ctx.beginPath();
    ctx.arc(tx, ty, 13, 0, Math.PI * 2);
    ctx.fillStyle = wGrad;
    ctx.fill();

    ctx.restore();
  }
}

function _drawJoint(ctx, x, y, r, lightColor, darkColor) {
  const g = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, 1, x, y, r);
  g.addColorStop(0, lightColor);
  g.addColorStop(1, darkColor);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle   = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 160, 200, 0.7)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}
