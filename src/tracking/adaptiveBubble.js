import { updatePoseData } from './poseInterface.js';
import { getLevel } from '../game/progression.js';

const START_RADIUS = 130; // level 1: large assist circle
const END_RADIUS   = 22;  // level 10: effectively just the star
const MAX_LEVEL    = 10;

let missCount = 0;

function _radiusForLevel(level) {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, level));
  // Steep assist drop early: by level 4 it's already very small.
  if (clamped <= 4) {
    const t = (clamped - 1) / 3;
    return Math.round(START_RADIUS + (42 - START_RADIUS) * t);
  }
  const t = (clamped - 4) / (MAX_LEVEL - 4);
  return Math.round(42 + (END_RADIUS - 42) * t);
}

function _syncRadius(level = getLevel()) {
  updatePoseData({ bubbleRadius: _radiusForLevel(level) });
}

// Call this whenever stardust.js registers a miss.
export function recordMiss() {
  missCount++;
}

// Call this whenever stars are collected.
export function recordCollection(stars = 1) {
  if (stars > 0) _syncRadius();
}

// Call at session start or level reset.
export function resetMissCount() {
  missCount = 0;
  _syncRadius(1);
  console.log('[AdaptiveBubble] reset — bubbleRadius set to', START_RADIUS, 'px');
}

export function getMissCount() {
  return missCount;
}
