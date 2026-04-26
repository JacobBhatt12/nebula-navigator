import { getLevel, getXP, getSkin, getXPProgress, isMaxLevel, SKINS } from '../game/progression.js';

const PX_FONT  = '"Press Start 2P", monospace';

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
    const W    = canvas.width;
    const H    = canvas.height;
    const skin = getSkin();
    const lvl  = getLevel();
    const xp   = getXP();

    const timeLeft = Math.max(0, sessionDuration - sessionTimer);
    const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const ss = String(Math.floor(timeLeft % 60)).padStart(2, '0');

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // ── Skin level nodes (top-left) ───────────────────────────────────────────
    const skinIdx  = Math.min(lvl - 1, SKINS.length - 1);
    const nodeSize = 18, nodeGap = 6;
    const nodesX   = 14, nodesY  = 14;

    ctx.font         = `7px ${PX_FONT}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    SKINS.forEach((s, i) => {
      const nx         = nodesX + i * (nodeSize + nodeGap);
      const ny         = nodesY;
      const isCurrent  = i === skinIdx;
      const isUnlocked = i < skinIdx;

      if (isCurrent) { ctx.shadowColor = s.stroke; ctx.shadowBlur = 12; }

      ctx.fillStyle = isCurrent ? s.hull : isUnlocked ? `${s.hull}88` : 'rgba(20,14,44,0.9)';
      ctx.fillRect(nx, ny, nodeSize, nodeSize);

      ctx.fillStyle = isCurrent ? s.stroke : isUnlocked ? `${s.stroke}66` : 'rgba(70,50,110,0.5)';
      ctx.fillRect(nx, ny, nodeSize, 2);
      ctx.fillRect(nx, ny + nodeSize - 2, nodeSize, 2);
      ctx.fillRect(nx, ny, 2, nodeSize);
      ctx.fillRect(nx + nodeSize - 2, ny, 2, nodeSize);

      ctx.shadowBlur = 0;

      ctx.fillStyle = isCurrent ? '#ffffff' : isUnlocked ? 'rgba(255,255,255,0.55)' : 'rgba(100,80,140,0.45)';
      ctx.fillText(String(i + 1), nx + nodeSize / 2, ny + nodeSize / 2 + 1);
    });

    // ── Timer (top-center) — pixel box ───────────────────────────────────────────
    const tbw = 110, tbh = 28, tbx = W / 2 - tbw / 2, tby = 8;
    ctx.fillStyle = '#050318';
    ctx.fillRect(tbx, tby, tbw, tbh);
    const timerColor = timeLeft < 20 ? '#ff2244' : '#c8b8ff';
    ctx.fillStyle = timerColor;
    ctx.fillRect(tbx, tby, tbw, 3);
    ctx.fillRect(tbx, tby + tbh - 3, tbw, 3);
    ctx.fillRect(tbx, tby, 3, tbh);
    ctx.fillRect(tbx + tbw - 3, tby, 3, tbh);
    ctx.font         = `10px ${PX_FONT}`;
    ctx.fillStyle    = timerColor;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${mm}:${ss}`, W / 2, tby + tbh / 2 + 1);

    // ── Stats panel (top-right) ───────────────────────────────────────────────────
    const panelW = 270, panelH = 236;
    const panelX = W - panelW - 14, panelY = 10;

    // panel bg + pixel border
    ctx.fillStyle = 'rgba(4, 2, 20, 0.88)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.fillStyle = 'rgba(70, 40, 180, 0.8)';
    ctx.fillRect(panelX, panelY, panelW, 3);
    ctx.fillRect(panelX, panelY + panelH - 3, panelW, 3);
    ctx.fillRect(panelX, panelY, 3, panelH);
    ctx.fillRect(panelX + panelW - 3, panelY, 3, panelH);
    // corner accents
    ctx.fillStyle = '#6040c0';
    ctx.fillRect(panelX, panelY, 6, 6);
    ctx.fillRect(panelX + panelW - 6, panelY, 6, 6);
    ctx.fillRect(panelX, panelY + panelH - 6, 6, 6);
    ctx.fillRect(panelX + panelW - 6, panelY + panelH - 6, 6, 6);

    const lagLabel = lagScore < 30 ? 'LOW' : lagScore < 65 ? 'MED' : 'HIGH';
    const rows = [
      { label: 'XP',       value: String(xp),                         vc: '#ffe840' },
      { label: 'LEVEL',    value: `${lvl}${isMaxLevel() ? ' MAX' : ''}`, vc: '#40e8ff' },
      { label: 'MISS',     value: String(missCount),                   vc: '#ff8060' },
      { label: 'HITS',     value: `${hitCount}/${maxHits}`,            vc: '#ff4466' },
      { label: 'BUBBLE',   value: bubbleRadius < 72 ? 'LOW' : bubbleRadius < 96 ? 'MED' : 'HIGH', vc: '#80ff80' },
      { label: 'LAG',      value: lagLabel,                            vc: '#c0a0ff' },
    ];

    const pad  = 13;
    const rowH = (panelH - pad * 2) / rows.length;
    ctx.font         = `8px ${PX_FONT}`;
    ctx.textBaseline = 'middle';

    rows.forEach(({ label, value, vc }, i) => {
      const ry = panelY + pad + rowH * i + rowH * 0.5;
      ctx.fillStyle = 'rgba(140, 120, 220, 0.8)';
      ctx.textAlign = 'left';
      ctx.fillText(label, panelX + pad, ry);
      ctx.fillStyle = vc;
      ctx.textAlign = 'right';
      ctx.fillText(value, panelX + panelW - pad, ry);
    });

    // divider after LEVEL
    ctx.fillStyle = 'rgba(70,50,180,0.4)';
    ctx.fillRect(panelX + pad, panelY + pad + rowH * 2, panelW - pad * 2, 2);

    ctx.textBaseline = 'alphabetic';

    // ── XP bar (bottom) — segmented pixel style ────────────────────────────────
    const barW   = Math.min(W * 0.50, 420);
    const barH   = 12;
    const barX   = (W - barW) / 2;
    const barY   = H - 36;
    const xpPct  = getXPProgress();
    const segW   = Math.round(barW / 20); // 20 segments
    const filled = Math.round(xpPct * 20);

    // bar background
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, 2);
    ctx.fillRect(barX, barY, 2, barH);
    ctx.fillRect(barX + barW - 2, barY, 2, barH);
    ctx.fillRect(barX, barY + barH - 2, barW, 2);

    // filled segments
    for (let i = 0; i < filled; i++) {
      const sx = barX + i * segW + 1;
      ctx.fillStyle = i < 15 ? skin.cockpit : '#ffffff';
      ctx.fillRect(sx, barY + 2, segW - 1, barH - 4);
    }

    // level label left
    ctx.font         = `7px ${PX_FONT}`;
    ctx.fillStyle    = skin.stroke;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LV${lvl}`, barX - 8, barY + barH / 2);

    // skin name right
    ctx.fillStyle = 'rgba(200,180,255,0.6)';
    ctx.textAlign = 'left';
    ctx.fillText(isMaxLevel() ? `${skin.name} MAX` : skin.name, barX + barW + 8, barY + barH / 2);

    // ── Health bar (hearts / pixel dashes) ────────────────────────────────────
    const hbx = panelX, hby = panelY + panelH + 10;
    ctx.font         = `8px ${PX_FONT}`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#ff4466';
    for (let i = 0; i < maxHits; i++) {
      const alive = i >= hitCount;
      ctx.fillStyle = alive ? '#ff2244' : 'rgba(100,30,50,0.5)';
      ctx.fillRect(hbx + i * 26, hby, 18, 18);
      if (alive) {
        ctx.fillStyle = '#ff8898';
        ctx.fillRect(hbx + i * 26 + 3, hby + 3, 5, 5);
      }
    }

    // ── Level-up flash overlay ────────────────────────────────────────────────
    if (this.levelUpFlash > 0) {
      const t     = Math.min(1, this.levelUpFlash / 2.0);
      const rgb   = this._hex2rgb(skin.stroke);
      ctx.fillStyle = `rgba(${rgb},${t * 0.38})`;
      ctx.fillRect(0, 0, W, H);

      // pixel border flash
      ctx.fillStyle = `rgba(${rgb},${t * 0.9})`;
      ctx.fillRect(0, 0, W, 6);
      ctx.fillRect(0, H - 6, W, 6);
      ctx.fillRect(0, 0, 6, H);
      ctx.fillRect(W - 6, 0, 6, H);

      ctx.font         = `18px ${PX_FONT}`;
      ctx.fillStyle    = `rgba(255,255,255,${t})`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`LEVEL ${this.levelUpNum}!`, W / 2, H / 2 - 18);

      ctx.font      = `8px ${PX_FONT}`;
      ctx.fillStyle = `rgba(220,200,255,${t * 0.9})`;
      ctx.fillText(`${getSkin().name} UNLOCKED`, W / 2, H / 2 + 28);
    }

    ctx.restore();
  }

  _hex2rgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }
}
