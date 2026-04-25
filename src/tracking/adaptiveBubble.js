import { updatePoseData } from './poseInterface.js';

const BASE_RADIUS  = 120; // pixels — matches poseInterface default
const MIN_RADIUS   = 40;  // floor — never shrink below this
const SHRINK_STEP  = 20;  // pixels removed per trigger
const MISS_TRIGGER = 3;   // misses required to shrink once

let missCount = 0;

function _computeRadius() {
  const shrinks = Math.floor(missCount / MISS_TRIGGER);
  return Math.max(MIN_RADIUS, BASE_RADIUS - shrinks * SHRINK_STEP);
}

// Call this whenever stardust.js registers a miss.
export function recordMiss() {
  missCount++;
  const radius = _computeRadius();
  updatePoseData({ bubbleRadius: radius });
  if (missCount % MISS_TRIGGER === 0) {
    console.log(`[AdaptiveBubble] ${missCount} misses — bubbleRadius shrunk to ${radius}px`);
  }
}

// Call at session start or level reset.
export function resetMissCount() {
  missCount = 0;
  updatePoseData({ bubbleRadius: BASE_RADIUS });
  console.log('[AdaptiveBubble] reset — bubbleRadius restored to', BASE_RADIUS, 'px');
}

export function getMissCount() {
  return missCount;
}
