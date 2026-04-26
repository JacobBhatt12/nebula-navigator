import { updatePoseData } from './poseInterface.js';
import { recordFrame, normalizeWrist, getPhase } from './calibration.js';

// MediaPipe landmark indices
const HIP_LEFT     = 23;
const HIP_RIGHT    = 24;
const SHOULDER_LEFT  = 11;
const SHOULDER_RIGHT = 12;
const ELBOW_LEFT   = 13;
const ELBOW_RIGHT  = 14;
const WRIST_LEFT   = 15;
const WRIST_RIGHT  = 16;
const NOSE = 0;

let poseLandmarker = null;
let videoElement   = null;
let animFrameId    = null;
let lastLandmarks  = null;

let _skeletonCanvas = null;
let _skeletonCtx    = null;

// Bone pairs to draw (MediaPipe Pose landmark indices)
const _BONES = [
  // Face
  [0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [3, 7], [6, 8],
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Left leg
  [23, 25], [25, 27],
  // Right leg
  [24, 26], [26, 28],
];

async function loadMediaPipe() {
  const { PoseLandmarker, FilesetResolver } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
  );

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode:        'VIDEO',
    numPoses:           1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence:  0.5,
    minTrackingConfidence:      0.5,
  });
}

async function startWebcam() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
    audio: false,
  });

  videoElement = document.createElement('video');
  videoElement.srcObject  = stream;
  videoElement.autoplay   = true;
  videoElement.playsInline = true;

  await new Promise((resolve) => {
    videoElement.onloadeddata = resolve;
  });
}

function _initSkeletonCanvas() {
  _skeletonCanvas = document.createElement('canvas');
  _skeletonCanvas.width  = 200;
  _skeletonCanvas.height = 200;
  Object.assign(_skeletonCanvas.style, {
    position:      'fixed',
    bottom:        '20px',
    left:          '20px',
    width:         '200px',
    height:        '200px',
    borderRadius:  '50%',
    zIndex:        '11',
    pointerEvents: 'none',
  });
  document.body.appendChild(_skeletonCanvas);
  _skeletonCtx = _skeletonCanvas.getContext('2d');
}

function _drawSkeletonFrame() {
  if (!_skeletonCtx) return;
  const S = 200;
  _skeletonCtx.clearRect(0, 0, S, S);

  // hide skeleton during calibration and when no landmarks yet
  if (document.body.classList.contains('calibrating') || !lastLandmarks) return;

  const lm = lastLandmarks;

  _skeletonCtx.save();
  _skeletonCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  _skeletonCtx.lineWidth   = 2;
  _skeletonCtx.lineCap     = 'round';

  _BONES.forEach(([a, b]) => {
    const la = lm[a], lb = lm[b];
    if (!la || !lb) return;
    if ((la.visibility ?? 1) < 0.3 || (lb.visibility ?? 1) < 0.3) return;
    _skeletonCtx.beginPath();
    _skeletonCtx.moveTo((1 - la.x) * S, la.y * S);
    _skeletonCtx.lineTo((1 - lb.x) * S, lb.y * S);
    _skeletonCtx.stroke();
  });

  // joint dots at key landmarks
  _skeletonCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  [0, 11, 12, 13, 14, 15, 16, 23, 24].forEach(idx => {
    const p = lm[idx];
    if (!p || (p.visibility ?? 1) < 0.3) return;
    _skeletonCtx.beginPath();
    _skeletonCtx.arc((1 - p.x) * S, p.y * S, 3.5, 0, Math.PI * 2);
    _skeletonCtx.fill();
  });

  _skeletonCtx.restore();
}

function processFrame() {
  if (!poseLandmarker || !videoElement) return;

  const result = poseLandmarker.detectForVideo(videoElement, performance.now());

  if (result.landmarks && result.landmarks.length > 0) {
    const lm = result.landmarks[0];
    lastLandmarks = lm;

    const hipX      = (lm[HIP_LEFT].x + lm[HIP_RIGHT].x) / 2;
    const shoulderX = (lm[SHOULDER_LEFT].x + lm[SHOULDER_RIGHT].x) / 2;
    const noseX     = lm[NOSE].x;
    const shoulderVis = ((lm[SHOULDER_LEFT].visibility ?? 1) + (lm[SHOULDER_RIGHT].visibility ?? 1)) * 0.5;
    const noseVis     = lm[NOSE].visibility ?? 1;
    const torsoX      = (hipX * 0.6) + (shoulderX * 0.4);
    const neckX       = (shoulderVis > 0.4 && noseVis > 0.4) ? (shoulderX * 0.55 + noseX * 0.45) : shoulderX;
    const rawLeft   = { x: lm[WRIST_LEFT].x,  y: lm[WRIST_LEFT].y  };
    const rawRight  = { x: lm[WRIST_RIGHT].x, y: lm[WRIST_RIGHT].y };
    const leftElbow = { x: lm[ELBOW_LEFT].x,  y: lm[ELBOW_LEFT].y  };
    const rightElbow= { x: lm[ELBOW_RIGHT].x, y: lm[ELBOW_RIGHT].y };

    recordFrame(rawLeft, rawRight);

    const calibrated  = getPhase() === 'done';
    const leftWrist   = calibrated ? normalizeWrist(rawLeft,  'left')  : rawLeft;
    const rightWrist  = calibrated ? normalizeWrist(rawRight, 'right') : rawRight;

    updatePoseData({
      hipX,
      torsoX,
      neckX,
      leftWrist,
      rightWrist,
      leftElbow,
      rightElbow,
      isCalibrated: calibrated,
    });
  }

  _drawSkeletonFrame();
  animFrameId = requestAnimationFrame(processFrame);
}

export async function initPoseEngine() {
  await loadMediaPipe();
  await startWebcam();
  _initSkeletonCanvas();
  processFrame();
  console.log('[PoseEngine] initialized — tracking started');
}

export function getPoseStream() {
  return videoElement?.srcObject instanceof MediaStream ? videoElement.srcObject : null;
}

export function stopPoseEngine() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (videoElement?.srcObject) {
    videoElement.srcObject.getTracks().forEach((t) => t.stop());
  }
  if (_skeletonCanvas) {
    _skeletonCanvas.remove();
    _skeletonCanvas = null;
    _skeletonCtx    = null;
  }
  animFrameId   = null;
  videoElement  = null;
  lastLandmarks = null;
}
