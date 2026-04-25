export const poseData = {
  hipX:         0.5,   // 0.0 = far left, 1.0 = far right (normalized)
  leftWrist:    { x: 0.5, y: 0.5 },  // normalized 0–1
  rightWrist:   { x: 0.5, y: 0.5 },  // normalized 0–1
  bubbleRadius: 120,   // pixels — written by adaptiveBubble.js; read by Jacob's stardust.js
  isCalibrated: false, // Jacob checks this before starting the game
};

export function updatePoseData(newData) {
  Object.assign(poseData, newData);
}
