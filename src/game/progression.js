const XP_PER_STAR = 10;

const THRESHOLDS = [0, 50, 120, 210, 320, 450, 600, 780, 990, 1230];

// hull/stroke → ship body; wing → side panels; cockpit → dome/window
export const SKINS = [
  { name: 'Cadet',     hull: '#c8d8e8', stroke: '#ffffff', wing: '#3870b8', cockpit: '#38a0ff' },
  { name: 'Voyager',   hull: '#c01818', stroke: '#ff3838', wing: '#780808', cockpit: '#ff2020' },
  { name: 'Sunfire',   hull: '#d8a010', stroke: '#ffe030', wing: '#885800', cockpit: '#ffc800' },
  { name: 'Verdant',   hull: '#18c040', stroke: '#40ff70', wing: '#087828', cockpit: '#28ff58' },
  { name: 'Phantom',   hull: '#1068c8', stroke: '#00d8ff', wing: '#083060', cockpit: '#00c0ff' },
  { name: 'Prismatic', hull: '#8010c8', stroke: '#c838ff', wing: '#480070', cockpit: '#b028ff' },
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
