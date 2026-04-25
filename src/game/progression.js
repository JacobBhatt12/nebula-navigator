const XP_PER_STAR = 10;

// Cumulative XP required to reach each level index (index 0 = level 1 start)
const THRESHOLDS = [0, 50, 120, 210, 320, 450];

export const SKINS = [
  { name: 'Cadet',     hull: '#1e1560', stroke: '#7b5cff', wing: '#3a2a7a', cockpit: '#4020a0' },
  { name: 'Voyager',   hull: '#0a2a5a', stroke: '#40a0ff', wing: '#1a3a6a', cockpit: '#0040a0' },
  { name: 'Sunfire',   hull: '#3a2000', stroke: '#ffaa00', wing: '#5a3000', cockpit: '#8a4000' },
  { name: 'Crimson',   hull: '#3a0010', stroke: '#ff2050', wing: '#4a0020', cockpit: '#700020' },
  { name: 'Phantom',   hull: '#003a3a', stroke: '#00ffcc', wing: '#005050', cockpit: '#007060' },
  { name: 'Prismatic', hull: '#2a0050', stroke: '#ff80ff', wing: '#3a0060', cockpit: '#600080' },
];

let xp    = 0;
let level = 1;

// Returns true if a level-up occurred
export function addXP(stars) {
  xp += stars * XP_PER_STAR;
  const prev = level;
  while (level < THRESHOLDS.length && xp >= THRESHOLDS[level]) {
    level++;
  }
  return level > prev;
}

export function getXP()      { return xp; }
export function getLevel()   { return level; }
export function getSkin()    { return SKINS[Math.min(level - 1, SKINS.length - 1)]; }
export function isMaxLevel() { return level >= THRESHOLDS.length; }

export function getXPProgress() {
  if (isMaxLevel()) return 1;
  const lo = THRESHOLDS[level - 1];
  const hi = THRESHOLDS[level];
  return (xp - lo) / (hi - lo);
}

export function reset() {
  xp    = 0;
  level = 1;
}
