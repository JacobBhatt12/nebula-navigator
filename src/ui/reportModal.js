import './reportModal.css';
import { generateReport } from '../ai/reportGenerator.js';

export async function showReportModal({ recording = null, recordingError = '' } = {}) {
  const overlay = _buildOverlay();
  document.body.appendChild(overlay);

  try {
    const { report, summary, source, error } = await generateReport();
    _populate(overlay, summary, report, recording, source, error, recordingError);
  } catch (err) {
    overlay.querySelector('#report-loading').textContent = `Error: ${err.message}`;
  }
}

export function closeReportModal() {
  document.getElementById('report-overlay')?.remove();
}

function _buildOverlay() {
  const el = document.createElement('div');
  el.id = 'report-overlay';
  el.innerHTML = `
    <div id="report-modal">
      <h2>Session Report</h2>
      <div id="report-loading">Generating clinical report…</div>
      <div id="report-content" style="display:none"></div>
      <div class="report-actions">
        <button id="report-close">Close</button>
      </div>
    </div>
  `;
  el.querySelector('#report-close').addEventListener('click', closeReportModal);
  // click outside to close
  el.addEventListener('click', (e) => { if (e.target === el) closeReportModal(); });
  return el;
}

function _populate(overlay, summary, reportText, recording, source, error, recordingError) {
  overlay.querySelector('#report-loading').style.display = 'none';
  const content = overlay.querySelector('#report-content');
  content.style.display = 'block';

  const sourceBadge = source === 'anthropic'
    ? '<span class="report-badge">AI: Claude</span>'
    : '<span class="report-badge report-badge-fallback">Local fallback summary</span>';

  const recordingHtml = recording?.url
    ? `
      <section class="report-video-wrap">
        <h3>Session Recording</h3>
        <video class="report-video" src="${recording.url}" controls playsinline></video>
        <p class="report-video-meta">Length: ${Math.round((recording.durationMs || 0) / 1000)}s · Size: ${_formatBytes(recording.sizeBytes || 0)}</p>
      </section>
    `
    : `
      <section class="report-video-wrap">
        <h3>Session Recording</h3>
        <p class="report-video-missing">No recording available for this session.${recordingError ? ` ${_escapeHtml(recordingError)}` : ''}</p>
      </section>
    `;

  const warning = error
    ? `<p class="report-warning">${_escapeHtml(error)}</p>`
    : '';

  content.innerHTML = `
    <div class="report-header-meta">${sourceBadge}</div>
    <div class="report-stats">
      <span>Hits: <b>${summary.totalHits}</b></span>
      <span>Misses: <b>${summary.totalMisses}</b></span>
      <span>Accuracy: <b>${(summary.accuracy * 100).toFixed(1)}%</b></span>
      <span>Avg latency: <b>${summary.avgLatencyMs}ms</b></span>
      <span>Duration: <b>${summary.durationSeconds}s</b></span>
      <span>ROM asymmetry: <b>${summary.rangeOfMotion?.asymmetryIndexPct ?? 0}%</b></span>
    </div>
    ${recordingHtml}
    ${warning}
    <div class="report-text">${_escapeHtml(reportText).replace(/\n/g, '<br>')}</div>
  `;
}

function _escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
