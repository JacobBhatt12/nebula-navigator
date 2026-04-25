import { getLevel, getSkin, getXPProgress, isMaxLevel } from '../game/progression.js';

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

  draw(ctx, canvas, { score, hitCount, maxHits, sessionTimer, sessionDuration }) {
    const W    = canvas.width;
    const H    = canvas.height;
    const skin = getSkin();
    const lvl  = getLevel();

    const timeLeft = Math.max(0, sessionDuration - sessionTimer);
    const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const ss = String(Math.floor(timeLeft % 60)).padStart(2, '0');

    ctx.save();

    // ── Score (top-left) ─────────────────────────────────────────────────────
    ctx.font      = 'bold 20px monospace';
    ctx.fillStyle = '#ffe080';
    ctx.textAlign = 'left';
    ctx.fillText(`★ ${score}`, 20, 38);

    // ── Timer (top-center) ───────────────────────────────────────────────────
    ctx.font      = 'bold 20px monospace';
    ctx.fillStyle = timeLeft < 20 ? '#ff4466' : '#c8b8ff';
    ctx.textAlign = 'center';
    ctx.fillText(`${mm}:${ss}`, W / 2, 38);

    // ── Health pips (top-right) ──────────────────────────────────────────────
    for (let i = 0; i < maxHits; i++) {
      const alive = i < (maxHits - hitCount);
      ctx.beginPath();
      ctx.arc(W - 24 - i * 26, 28, 9, 0, Math.PI * 2);
      ctx.fillStyle   = alive ? '#ff4466' : '#2a1a22';
      ctx.fill();
      ctx.strokeStyle = alive ? '#ff8899' : '#3a2a32';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    // ── XP bar (bottom-center) ───────────────────────────────────────────────
    const barW = Math.min(W * 0.5, 420);
    const barH = 10;
    const barX = (W - barW) / 2;
    const barY = H - 34;
    const xpPct = getXPProgress();

    // track
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // fill
    if (xpPct > 0) {
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, skin.stroke);
      grad.addColorStop(1, '#ffffff88');
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * xpPct, barH, 5);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // level badge (left of bar)
    ctx.font      = 'bold 13px monospace';
    ctx.fillStyle = skin.stroke;
    ctx.textAlign = 'right';
    ctx.fillText(`LV${lvl}`, barX - 8, barY + 9);

    // skin name (right of bar)
    ctx.font      = '12px monospace';
    ctx.fillStyle = 'rgba(200,180,255,0.55)';
    ctx.textAlign = 'left';
    const label = isMaxLevel() ? `${skin.name}  MAX` : skin.name;
    ctx.fillText(label, barX + barW + 8, barY + 9);

    // ── Level-up flash overlay ───────────────────────────────────────────────
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

      ctx.font      = `20px monospace`;
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
