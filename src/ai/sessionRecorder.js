let mediaRecorder = null;
let chunks = [];
let recordingStart = null;
let stopPromise = null;

let lastRecording = null;
let lastError = null;

export function getLastRecording() {
  return lastRecording;
}

export function getLastRecordingError() {
  return lastError;
}

export function clearLastRecording() {
  if (lastRecording?.url) URL.revokeObjectURL(lastRecording.url);
  lastRecording = null;
}

export function isRecording() {
  return Boolean(mediaRecorder && mediaRecorder.state === 'recording');
}

export function startSessionRecording(source) {
  clearLastRecording();
  lastError = null;

  const stream = _resolveStream(source);
  if (!stream) {
    lastError = 'Webcam stream unavailable for recording.';
    return false;
  }

  if (typeof MediaRecorder === 'undefined') {
    lastError = 'MediaRecorder is not supported in this browser.';
    return false;
  }

  const mimeType = _pickMimeType();

  try {
    chunks = [];
    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const type = mediaRecorder?.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunks, { type });
      const url  = URL.createObjectURL(blob);
      const durationMs = recordingStart ? Math.max(0, Math.round(performance.now() - recordingStart)) : 0;
      lastRecording = {
        blob,
        url,
        mimeType: type,
        sizeBytes: blob.size,
        durationMs,
      };
      recordingStart = null;
      chunks = [];
    };

    mediaRecorder.onerror = (event) => {
      lastError = event?.error?.message || 'Recording error.';
    };

    recordingStart = performance.now();
    mediaRecorder.start(1000);
    return true;
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Failed to start recording.';
    mediaRecorder = null;
    chunks = [];
    recordingStart = null;
    return false;
  }
}

function _resolveStream(source) {
  if (!source) return null;
  if (source instanceof MediaStream) return source;
  if (source.srcObject instanceof MediaStream) return source.srcObject;
  return null;
}

export async function stopSessionRecording() {
  if (!mediaRecorder) return lastRecording;
  if (mediaRecorder.state !== 'recording') return lastRecording;
  if (stopPromise) return stopPromise;

  stopPromise = new Promise((resolve) => {
    const recorder = mediaRecorder;

    const finalize = () => {
      recorder.removeEventListener('stop', finalize);
      recorder.removeEventListener('error', finalize);
      mediaRecorder = null;
      stopPromise = null;
      resolve(lastRecording);
    };

    recorder.addEventListener('stop', finalize);
    recorder.addEventListener('error', finalize);
    recorder.stop();
  });

  return stopPromise;
}

function _pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  }
  return '';
}
