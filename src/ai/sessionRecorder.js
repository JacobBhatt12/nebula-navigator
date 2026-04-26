// src/ai/sessionRecorder.js
// Records a webcam or canvas MediaStream using the browser's MediaRecorder API.
// Produces a Blob and an object URL ready for <video> playback.

let _recorder = null;
let _chunks   = [];
let _mimeType = '';

/**
 * Begin recording a MediaStream.
 * Pass the webcam stream from getWebcamStream() or a canvas.captureStream().
 * @param {MediaStream} stream
 */
export function startRecording(stream) {
  if (_recorder && _recorder.state !== 'inactive') {
    console.warn('[SessionRecorder] already recording — call stopRecording() first');
    return;
  }

  _chunks   = [];
  _mimeType = _chooseMimeType();

  _recorder = new MediaRecorder(stream, { mimeType: _mimeType });

  _recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) _chunks.push(e.data);
  };

  // Collect a chunk every 250 ms so we never lose data if the tab crashes.
  _recorder.start(250);
  console.log('[SessionRecorder] recording started —', _mimeType || 'browser default codec');
}

/**
 * Stop recording and resolve with the captured video.
 * @returns {Promise<{ blob: Blob, videoUrl: string }>}
 */
export function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!_recorder || _recorder.state === 'inactive') {
      reject(new Error('[SessionRecorder] not recording — call startRecording() first'));
      return;
    }

    _recorder.onstop = () => {
      const blob     = new Blob(_chunks, { type: _mimeType || 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      _chunks        = [];
      _recorder      = null;
      console.log('[SessionRecorder] stopped — blob size:', blob.size, 'bytes');
      resolve({ blob, videoUrl });
    };

    _recorder.onerror = (e) => {
      _recorder = null;
      reject(e.error ?? new Error('MediaRecorder error'));
    };

    _recorder.stop();
  });
}

/** True while a recording is in progress. */
export function isRecording() {
  return _recorder?.state === 'recording';
}

// ─── Codec selection ──────────────────────────────────────────────────────────
// Try codecs in quality order; fall back to whatever the browser supports.

function _chooseMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}
