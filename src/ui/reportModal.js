import './reportModal.css';
import { generateReport } from '../ai/reportGenerator.js';

export async function showReportModal() {
  const overlay = _buildOverlay();
  document.body.appendChild(overlay);

  try {
    const { report, summary } = await generateReport();
    _populate(overlay, summary, report);
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
      <button id="report-close">Close</button>
    </div>
  `;
  el.querySelector('#report-close').addEventListener('click', closeReportModal);
  // click outside to close
  el.addEventListener('click', (e) => { if (e.target === el) closeReportModal(); });
  return el;
}

function _populate(overlay, summary, reportText) {
  overlay.querySelector('#report-loading').style.display = 'none';
  const content = overlay.querySelector('#report-content');
  content.style.display = 'block';
  content.innerHTML = `
    <div class="report-stats">
      <span>Hits: <b>${summary.totalHits}</b></span>
      <span>Misses: <b>${summary.totalMisses}</b></span>
      <span>Accuracy: <b>${(summary.accuracy * 100).toFixed(1)}%</b></span>
      <span>Avg latency: <b>${summary.avgLatencyMs}ms</b></span>
      <span>Duration: <b>${summary.durationSeconds}s</b></span>
    </div>
    <div class="report-text">${reportText.replace(/\n/g, '<br>')}</div>
  `;
}
