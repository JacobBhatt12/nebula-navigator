import { getLevel, getXP, getSkin, getXPProgress, isMaxLevel } from '../game/progression.js';

export class HUD {
  constructor() {
    this.levelUpFlash = 0;
    this.levelUpNum   = 1;
  }

  triggerLevelUp(newLevel) {
    this.levelUpFlash = 2.0;
    this.levelUpNum   = newLevel;
  }

  update(dt) {
    if (this.levelUpFlash > 0) this.levelUpFlash -= dt;
  }

  draw(ctx, canvas, {
    score,
    hitCount,
    maxHits,
    sessionTimer,
    sessionDuration,
    missCount = 0,
    bubbleRadius = 120,
    lagScore = 0,
  }) {
    const W   = canvas.width;
    const H   = canvas.height;
    const skin = getSkin();
    const lvl  = getLevel();
    const xp   = getXP();

    const timeLeft = Math.max(0, sessionDuration - sessionTimer);
    const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const ss = String(Math.floor(timeLeft % 60)).padStart(2, '0');

    ctx.save();

    // ── "Nebula Navigator" title (top-left) ──────────────────────────────────
    ctx.font      = 'bold 22px monospace';
    ctx.fillStyle = '#00d8d8';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 220, 220, 0.6)';
    ctx.shadowBlur  = 10;
    ctx.fillText('Nebula Navigator', 18, 36);
    ctx.shadowBlur = 0;

    // ── Timer (top-center) ────────────────────────────────────────────────────
    ctx.font      = 'bold 20px monospace';
    ctx.fillStyle = timeLeft < 20 ? '#ff4466' : '#c8b8ff';
    ctx.textAlign = 'center';
    ctx.fillText(`${mm}:${ss}`, W / 2, 36);

    // ── Stats panel (top-right) ───────────────────────────────────────────────
    const panelW  = 196;
    const panelH  = 174;
    const panelX  = W - panelW - 14;
    const panelY  = 10;
    const pad     = 12;

    // panel background
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 12);
    ctx.fillStyle   = 'rgba(10, 4, 28, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 60, 200, 0.55)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // panel rows
    const lagLabel =
      lagScore < 30 ? 'Low' :
      lagScore < 65 ? 'Med' :
      'High';

    const rows = [
      { label: 'XP:',            value: String(xp) },
      { label: 'LEVEL:',         value: `${lvl}${isMaxLevel() ? ' MAX' : ''}` },
      { label: 'STARDUST MISS:', value: String(missCount) },
      { label: 'METEOR HITS:',   value: String(hitCount) },
      { label: 'ROM Bubble:',    value: bubbleRadius < 100 ? 'Low' : 'Opt' },
      { label: 'Lag:',           value: lagLabel },
    ];

    ctx.font         = '12px monospace';
    ctx.textBaseline = 'middle';
    const rowH = (panelH - pad * 2) / rows.length;

    rows.forEach(({ label, value }, i) => {
      const ry = panelY + pad + rowH * i + rowH * 0.5;

      // label
      ctx.fillStyle = 'rgba(160, 140, 220, 0.85)';
      ctx.textAlign = 'left';
      ctx.fillText(label, panelX + pad, ry);

      // value
      ctx.fillStyle = '#e8e0ff';
      ctx.textAlign = 'right';
      ctx.fillText(value, panelX + panelW - pad, ry);
    });

    // divider line after LEVEL row
    ctx.beginPath();
    ctx.moveTo(panelX + pad, panelY + pad + rowH * 2);
    ctx.lineTo(panelX + panelW - pad, panelY + pad + rowH * 2);
    ctx.strokeStyle = 'rgba(100, 80, 200, 0.3)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';

    // ── XP bar (bottom-center) ─────────────────────────────────────────────────
    const barW = Math.min(W * 0.5, 420);
    const barH = 10;
    const barX = (W - barW) / 2;
    const barY = H - 34;
    const xpPct = getXPProgress();

    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (xpPct > 0) {
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, skin.stroke);
      grad.addColorStop(1, '#ffffff88');
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * xpPct, barH, 5);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.font      = 'bold 13px monospace';
    ctx.fillStyle = skin.stroke;
    ctx.textAlign = 'right';
    ctx.fillText(`LV${lvl}`, barX - 8, barY + 9);

    ctx.font      = '12px monospace';
    ctx.fillStyle = 'rgba(200,180,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(isMaxLevel() ? `${skin.name}  MAX` : skin.name, barX + barW + 8, barY + 9);

    // ── Level-up flash overlay ─────────────────────────────────────────────────
    if (this.levelUpFlash > 0) {
      const t     = Math.min(1, this.levelUpFlash / 2.0);
      const alpha = t * 0.4;
      const rgb   = this._hex2rgb(skin.stroke);
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ctx.fillRect(0, 0, W, H);

      const scale = 1 + t * 0.15;
      ctx.textAlign = 'center';
      ctx.font      = `bold ${Math.round(52 * scale)}px monospace`;
      ctx.fillStyle = `rgba(255,255,255,${t})`;
      ctx.fillText(`LEVEL ${this.levelUpNum}!`, W / 2, H / 2 - 18);

      ctx.font      = '20px monospace';
      ctx.fillStyle = `rgba(220,200,255,${t * 0.9})`;
      ctx.fillText(`${getSkin().name} skin unlocked`, W / 2, H / 2 + 28);
    }

    ctx.restore();
  }

  _hex2rgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }
}
