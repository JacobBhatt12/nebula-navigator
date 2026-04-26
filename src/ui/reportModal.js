// src/ui/reportModal.js
// Displays the AI clinical report and optional session video recording.

import './reportModal.css';
import { generateReport } from '../ai/reportGenerator.js';

/**
 * Open the report modal.
 *
 * @param {Object} [opts]
 * @param {string} [opts.report]    Pre-generated report text. If omitted,
 *   generateReport() is called automatically (backward-compat path).
 * @param {string} [opts.videoUrl]  Object URL from stopRecording(). If provided,
 *   a video player is shown above the report.
 * @param {Object} [opts.summary]   Session summary for the stats bar.
 */
export async function showReportModal(opts = {}) {
  // Prevent duplicate modals.
  if (document.getElementById('report-overlay')) return;

  const overlay = _buildOverlay(opts.videoUrl);
  document.body.appendChild(overlay);

  try {
    let { report, summary } = opts;

    if (!report) {
      const result = await generateReport();
      report  = result.report;
      summary = result.summary;
    }

    _populate(overlay, summary, report);
  } catch (err) {
    const loading = overlay.querySelector('#report-loading');
    if (loading) loading.textContent = `Error generating report: ${err.message}`;
  }
}

export function closeReportModal() {
  const overlay = document.getElementById('report-overlay');
  if (!overlay) return;

  // Revoke any object URL we created to free browser memory.
  const video = overlay.querySelector('#report-video');
  if (video?.src) URL.revokeObjectURL(video.src);

  overlay.remove();
}

// ─── DOM builders ─────────────────────────────────────────────────────────────

function _buildOverlay(videoUrl) {
  const el = document.createElement('div');
  el.id = 'report-overlay';

  const videoBlock = videoUrl
    ? `<div class="report-video-wrap">
         <h3>Session Recording</h3>
         <video id="report-video" src="${videoUrl}" controls playsinline></video>
       </div>`
    : '';

  el.innerHTML = `
    <div id="report-modal">
      <h2>Session Report</h2>
      ${videoBlock}
      <div id="report-loading">Generating clinical report…</div>
      <div id="report-content" style="display:none"></div>
      <button id="report-close">Close</button>
    </div>
  `;

  el.querySelector('#report-close').addEventListener('click', closeReportModal);
  el.addEventListener('click', (e) => { if (e.target === el) closeReportModal(); });

  return el;
}

function _populate(overlay, summary, reportText) {
  const loading = overlay.querySelector('#report-loading');
  const content = overlay.querySelector('#report-content');

  if (loading) loading.style.display = 'none';
  if (!content) return;

  const statsHtml = summary
    ? `<div class="report-stats">
         <span>Hits: <b>${summary.totalHits}</b></span>
         <span>Misses: <b>${summary.totalMisses}</b></span>
         <span>Accuracy: <b>${(summary.accuracy * 100).toFixed(1)}%</b></span>
         <span>Avg latency: <b>${summary.avgLatencyMs}ms</b></span>
         <span>Duration: <b>${summary.durationSeconds}s</b></span>
       </div>`
    : '';

  const formattedReport = reportText
    .replace(/#{1,6}\s*/g, '')          // strip any ## markdown headers
    .replace(/\*\*(.*?)\*\*/g, '$1')    // strip **bold**
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  content.innerHTML = `${statsHtml}<div class="report-text">${formattedReport}</div>`;
  content.style.display = 'block';
}
