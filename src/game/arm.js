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
    _drawArmSegment(ctx, originX, originY, elbowX, elbowY, 11, '#a8b4d4', '#5d6a88');
    // forearm segment
    _drawArmSegment(ctx, elbowX, elbowY, tx, ty, 9, '#8798bb', '#475670');

    _drawJoint(ctx, originX, originY, 8, '#d0d8f0', '#4050a8');
    _drawJoint(ctx, elbowX,   elbowY, 7, '#c0c8e0', '#384090');

    // wrist: mechanical claw at all times (open when searching, closed when grabbing)
    if (grabbedStar) {
      _drawGrabClaw(ctx, tx, ty, grabbedStar.progress);
    } else {
      _drawOpenClaw(ctx, tx, ty);
    }

    ctx.restore();
  }
}

function _drawGrabClaw(ctx, x, y, progress) {
  ctx.save();
  const size    = 10 + progress * 5;
  const squeeze = 0.35 + progress * 0.55;

  const gGrad = ctx.createRadialGradient(x, y, 2, x, y, size * 2.4);
  gGrad.addColorStop(0,    `rgba(255, 255, 80,  ${0.45 + progress * 0.45})`);
  gGrad.addColorStop(0.55, `rgba(255, 160, 0,   ${0.18 + progress * 0.20})`);
  gGrad.addColorStop(1,    'rgba(255, 120, 0, 0)');
  ctx.beginPath();
  ctx.arc(x, y, size * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = gGrad;
  ctx.fill();

  const palmW = size * 1.25;
  const palmH = size * 0.95;
  const palm = ctx.createLinearGradient(x - palmW / 2, y - palmH / 2, x + palmW / 2, y + palmH / 2);
  palm.addColorStop(0, '#c8d4ee');
  palm.addColorStop(1, '#5c6f95');
  ctx.fillStyle = palm;
  ctx.fillRect(x - palmW / 2, y - palmH / 2, palmW, palmH);
  ctx.strokeStyle = 'rgba(220, 235, 255, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - palmW / 2, y - palmH / 2, palmW, palmH);

  const jawOpen = Math.PI * (0.28 - squeeze * 0.16);
  _drawPincer(ctx, x, y, size * 0.95, -Math.PI / 2 - jawOpen);
  _drawPincer(ctx, x, y, size * 0.95, -Math.PI / 2 + jawOpen);
  _drawPincer(ctx, x, y, size * 0.86, -Math.PI / 2 - jawOpen * 0.62);
  _drawPincer(ctx, x, y, size * 0.86, -Math.PI / 2 + jawOpen * 0.62);

  _drawJoint(ctx, x, y, 4.8 + progress * 1.9, '#ffe080', '#b87800');
  ctx.restore();
}

function _drawOpenClaw(ctx, x, y) {
  ctx.save();
  const size = 10.5;
  const aura = ctx.createRadialGradient(x, y, 2, x, y, size * 2.2);
  aura.addColorStop(0, 'rgba(120, 215, 255, 0.28)');
  aura.addColorStop(1, 'rgba(120, 215, 255, 0)');
  ctx.beginPath();
  ctx.arc(x, y, size * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.fill();

  const palm = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
  palm.addColorStop(0, '#d4def2');
  palm.addColorStop(1, '#687b9d');
  ctx.fillStyle = palm;
  ctx.fillRect(x - size * 0.78, y - size * 0.52, size * 1.56, size * 1.04);
  ctx.strokeStyle = 'rgba(220, 235, 255, 0.6)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x - size * 0.78, y - size * 0.52, size * 1.56, size * 1.04);

  _drawPincer(ctx, x, y, size * 0.95, -Math.PI / 2 - 0.34);
  _drawPincer(ctx, x, y, size * 0.95, -Math.PI / 2 + 0.34);
  _drawJoint(ctx, x, y, 4.8, '#c8ecff', '#5776a4');
  ctx.restore();
}

function _drawPincer(ctx, x, y, len, angle) {
  const bx = x + Math.cos(angle) * (len * 0.16);
  const by = y + Math.sin(angle) * (len * 0.16);
  const tx = x + Math.cos(angle) * len;
  const ty = y + Math.sin(angle) * len;

  ctx.strokeStyle = 'rgba(168, 206, 245, 0.95)';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  const hookR = Math.max(2.8, len * 0.22);
  ctx.beginPath();
  ctx.arc(tx, ty, hookR, angle - Math.PI * 0.72, angle + Math.PI * 0.14);
  ctx.stroke();
}

function _drawArmSegment(ctx, x1, y1, x2, y2, width, lightHex, darkHex) {
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, lightHex);
  grad.addColorStop(1, darkHex);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = grad;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(224, 234, 255, 0.42)';
  ctx.lineWidth = Math.max(2, width * 0.31);
  ctx.stroke();

  // Add a small cable line down the center so the segment reads as machinery.
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(38, 46, 64, 0.55)';
  ctx.lineWidth = Math.max(1.5, width * 0.14);
  ctx.setLineDash([4, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
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
