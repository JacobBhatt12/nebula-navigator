const XP_PER_STAR = 10;

const THRESHOLDS = [0, 50, 120, 210, 320, 450];

// hull/stroke → ship body color; wing → side pods; cockpit → dome
export const SKINS = [
  { name: 'Cadet',     hull: '#e86020', stroke: '#ff9040', wing: '#1a4a7a', cockpit: '#2080c8' },
  { name: 'Voyager',   hull: '#d82020', stroke: '#ff5050', wing: '#6a0a20', cockpit: '#c01040' },
  { name: 'Sunfire',   hull: '#d89000', stroke: '#ffe040', wing: '#6a4400', cockpit: '#a07000' },
  { name: 'Verdant',   hull: '#208050', stroke: '#40e880', wing: '#0a4020', cockpit: '#106040' },
  { name: 'Phantom',   hull: '#007898', stroke: '#00d8d8', wing: '#003858', cockpit: '#005070' },
  { name: 'Prismatic', hull: '#8020a0', stroke: '#d060ff', wing: '#400060', cockpit: '#600080' },
];

let xp    = 0;
let level = 1;

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
