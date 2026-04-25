import { updatePoseData } from './poseInterface.js';
import { recordFrame, normalizeWrist, getPhase } from './calibration.js';

// MediaPipe landmark indices
const HIP_LEFT   = 23;
const HIP_RIGHT  = 24;
const WRIST_LEFT  = 15;
const WRIST_RIGHT = 16;

let poseLandmarker = null;
let videoElement   = null;
let animFrameId    = null;

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
  videoElement.srcObject = stream;
  videoElement.autoplay   = true;
  videoElement.playsInline = true;

  await new Promise((resolve) => {
    videoElement.onloadeddata = resolve;
  });
}

function processFrame() {
  if (!poseLandmarker || !videoElement) return;

  const result = poseLandmarker.detectForVideo(videoElement, performance.now());

  if (result.landmarks && result.landmarks.length > 0) {
    const lm = result.landmarks[0];

    const hipX     = (lm[HIP_LEFT].x + lm[HIP_RIGHT].x) / 2;
    const rawLeft  = { x: lm[WRIST_LEFT].x,  y: lm[WRIST_LEFT].y  };
    const rawRight = { x: lm[WRIST_RIGHT].x, y: lm[WRIST_RIGHT].y };

    // Feed raw coords into calibration scan (no-op when not scanning).
    recordFrame(rawLeft, rawRight);

    const calibrated  = getPhase() === 'done';
    const leftWrist   = calibrated ? normalizeWrist(rawLeft,  'left')  : rawLeft;
    const rightWrist  = calibrated ? normalizeWrist(rawRight, 'right') : rawRight;

    updatePoseData({ hipX, leftWrist, rightWrist, isCalibrated: calibrated });

    console.log(
      `[PoseEngine] leftWrist=(${leftWrist.x.toFixed(3)}, ${leftWrist.y.toFixed(3)})` +
      `  rightWrist=(${rightWrist.x.toFixed(3)}, ${rightWrist.y.toFixed(3)})` +
      `  hipX=${hipX.toFixed(3)}` +
      (calibrated ? '' : '  [pre-calibration raw]')
    );
  }

  animFrameId = requestAnimationFrame(processFrame);
}

export async function initPoseEngine() {
  await loadMediaPipe();
  await startWebcam();
  processFrame();
  console.log('[PoseEngine] initialized — tracking started');
}

export function stopPoseEngine() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (videoElement?.srcObject) {
    videoElement.srcObject.getTracks().forEach((t) => t.stop());
  }
  animFrameId  = null;
  videoElement = null;
}
