export class Arm {
  constructor(side = 'left') {
    this.side     = side;   // 'left' or 'right' — determines which way elbow bends
    this.upperLen = 60;
    this.lowerLen = 52;
  }

  // Set arm reach to match calibrated wrist span
  setMaxLength(total) {
    this.upperLen = total * 0.54;
    this.lowerLen = total * 0.46;
  }

  // Returns where the arm tip actually lands given these inputs (mirrors IK in draw)
  getTip(originX, originY, targetX, targetY) {
    const dx   = targetX - originX;
    const dy   = targetY - originY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return { x: originX, y: originY };
    const a = this.upperLen, b = this.lowerLen;
    if (dist >= a + b) {
      const angle = Math.atan2(dy, dx);
      return { x: originX + Math.cos(angle) * (a + b), y: originY + Math.sin(angle) * (a + b) };
    }
    return { x: targetX, y: targetY };
  }

  draw(ctx, originX, originY, targetX, targetY, grabbedStar = null) {
    const aimX = grabbedStar ? grabbedStar.x : targetX;
    const aimY = grabbedStar ? grabbedStar.y : targetY;

    const dx   = aimX - originX;
    const dy   = aimY - originY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const a         = this.upperLen;  // upper arm — fixed length
    const b         = this.lowerLen;  // forearm   — fixed length
    const baseAngle = Math.atan2(dy, dx);

    let elbowX, elbowY, tx, ty;

    if (dist >= a + b) {
      // Target beyond reach — arm fully extends in a straight line
      elbowX = originX + Math.cos(baseAngle) * a;
      elbowY = originY + Math.sin(baseAngle) * a;
      tx     = originX + Math.cos(baseAngle) * (a + b);
      ty     = originY + Math.sin(baseAngle) * (a + b);
    } else {
      // Two-bone IK via law of cosines
      // angle at origin between (origin→target) and (origin→elbow)
      const cosA = Math.max(-1, Math.min(1, (a * a + dist * dist - b * b) / (2 * a * dist)));
      const theta = Math.acos(cosA);

      // Two candidate elbow positions
      const e1x = originX + Math.cos(baseAngle + theta) * a;
      const e1y = originY + Math.sin(baseAngle + theta) * a;
      const e2x = originX + Math.cos(baseAngle - theta) * a;
      const e2y = originY + Math.sin(baseAngle - theta) * a;

      // Pick the IK solution whose elbow is on the natural outward side.
      // Hint: a point offset outward (left arm → hint is left+down, right arm → right+down).
      const hintX = this.side === 'left' ? originX - 90 : originX + 90;
      const hintY = originY + 70;
      const d1h = Math.hypot(e1x - hintX, e1y - hintY);
      const d2h = Math.hypot(e2x - hintX, e2y - hintY);
      if (d1h <= d2h) { elbowX = e1x; elbowY = e1y; }
      else            { elbowX = e2x; elbowY = e2y; }

      // Wrist tip reaches exactly to the target when in range
      tx = aimX;
      ty = aimY;
    }

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

    // upper arm segment
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

    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(elbowX, elbowY);
    ctx.strokeStyle = 'rgba(210, 220, 240, 0.42)';
    ctx.lineWidth   = 3.5;
    ctx.stroke();

    // forearm segment
    const loGrad = ctx.createLinearGradient(elbowX, elbowY, tx, ty);
    loGrad.addColorStop(0, '#788098');
    loGrad.addColorStop(1, '#485070');
    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = loGrad;
    ctx.lineWidth   = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = 'rgba(180, 195, 220, 0.38)';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    _drawJoint(ctx, originX, originY, 8, '#d0d8f0', '#4050a8');
    _drawJoint(ctx, elbowX,   elbowY, 7, '#c0c8e0', '#384090');

    // wrist: claw when grabbing a star, glow orb otherwise
    if (grabbedStar) {
      _drawGrabClaw(ctx, tx, ty, grabbedStar.progress);
    } else {
      const wGrad = ctx.createRadialGradient(tx, ty, 1, tx, ty, 13);
      wGrad.addColorStop(0,   'rgba(160, 225, 255, 1)');
      wGrad.addColorStop(0.4, 'rgba(80, 160, 255, 0.65)');
      wGrad.addColorStop(1,   'rgba(80, 100, 255, 0)');
      ctx.beginPath();
      ctx.arc(tx, ty, 13, 0, Math.PI * 2);
      ctx.fillStyle = wGrad;
      ctx.fill();
    }

    ctx.restore();
  }
}

function _drawGrabClaw(ctx, x, y, progress) {
  ctx.save();
  const size    = 10 + progress * 7;
  const squeeze = progress * 0.55;

  const gGrad = ctx.createRadialGradient(x, y, 2, x, y, size * 2.4);
  gGrad.addColorStop(0,    `rgba(255, 255, 80,  ${0.45 + progress * 0.45})`);
  gGrad.addColorStop(0.55, `rgba(255, 160, 0,   ${0.18 + progress * 0.20})`);
  gGrad.addColorStop(1,    'rgba(255, 120, 0, 0)');
  ctx.beginPath();
  ctx.arc(x, y, size * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = gGrad;
  ctx.fill();

  const cr = Math.round(160 + progress * 95);
  const cg = Math.round(225 - progress * 80);
  ctx.strokeStyle = `rgba(${cr}, ${cg}, 255, 0.95)`;
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';

  [-0.38, 0, 0.38].forEach(offset => {
    const angle = -Math.PI / 2 + offset * Math.PI * (1 - squeeze * 0.65);
    const ex    = x + Math.cos(angle) * size;
    const ey    = y + Math.sin(angle) * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, size * 0.32, angle - Math.PI * 0.65, angle + Math.PI * 0.28);
    ctx.stroke();
  });

  _drawJoint(ctx, x, y, 5 + progress * 2.5, '#ffe080', '#b87800');
  ctx.restore();
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
