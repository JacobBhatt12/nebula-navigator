// src/ai/reportGenerator.js
// Builds a therapist-focused prompt from session telemetry and calls the
// Anthropic API to produce a structured clinical session note.

import { getSessionSummary } from './telemetry.js';

const API_URL       = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-haiku-4-5-20251001';
const MAX_TOKENS    = 160;
const ANTHROPIC_VER = '2023-06-01';

/**
 * Generate a clinical session report.
 * @param {Object} [telemetryData]  Object returned by endSession(). If omitted,
 *   falls back to getSessionSummary() for backward compatibility.
 * @returns {Promise<{ report: string, summary: Object }>}
 */
export async function generateReport(telemetryData = null) {
  const key = import.meta.env.VITE_AI_KEY;
  if (!key) throw new Error('VITE_AI_KEY is not set — copy .env.example to .env and add your key.');

  const summary = telemetryData?.summary ?? getSessionSummary();

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':                            'application/json',
      'x-api-key':                               key,
      'anthropic-version':                       ANTHROPIC_VER,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      messages:   [{ role: 'user', content: _buildPrompt(summary) }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  const data = await response.json();
  return { report: data.content[0].text, summary };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function _buildPrompt(s) {
  const acc = (s.accuracy * 100).toFixed(1);
  const rom = s.rangeOfMotion;
  const fat = s.fatigue;

  // ── Range of motion section ──────────────────────────────────────────────
  const romLines = rom
    ? `Range of Motion (normalized screen space, 0.0–1.0):
  Hip lateral sway range:        ${rom.hipX.range.toFixed(3)}  (${rom.hipX.min.toFixed(2)} → ${rom.hipX.max.toFixed(2)})
  Left wrist  — horizontal:      ${rom.leftWrist.x.range.toFixed(3)}  vertical: ${rom.leftWrist.y.range.toFixed(3)}
  Right wrist — horizontal:      ${rom.rightWrist.x.range.toFixed(3)}  vertical: ${rom.rightWrist.y.range.toFixed(3)}
  Left vs right horizontal diff: ${Math.abs(rom.leftWrist.x.range - rom.rightWrist.x.range).toFixed(3)} (asymmetry indicator)`
    : 'Range of Motion: no movement data collected (logMovement was not called).';

  // ── Fatigue section ───────────────────────────────────────────────────────
  let fatigueLines;
  if (fat?.insufficientData) {
    fatigueLines = 'Fatigue analysis: session too short for trend detection (< 8 target events).';
  } else if (fat) {
    fatigueLines = `Fatigue / performance trend:
  Early accuracy (first 25% of events): ${(fat.earlyAccuracy * 100).toFixed(1)}%
  Late accuracy  (last  25% of events): ${(fat.lateAccuracy  * 100).toFixed(1)}%
  Accuracy drop across session:         ${(fat.accuracyDrop  * 100).toFixed(1)} percentage points
  Fatigue flag: ${fat.fatigueDetected ? 'YES — notable decline detected (>20 pp drop)' : 'No significant decline'}`;
  } else {
    fatigueLines = 'Fatigue analysis: unavailable.';
  }

  // ── Adaptive difficulty ───────────────────────────────────────────────────
  const shrinks = (s.bubbleChanges ?? []).filter(c => c.radius < 120).length;

  return `You are a pediatric physical therapy assistant. Write a single concise paragraph (3 sentences max, plain text only — no bullet points, no markdown, no headers) summarising this Nebula Navigator session for the supervising therapist. Reference the key numbers. End with: "⚠️ Not a medical diagnosis — review with a qualified therapist."

Session: ${s.durationSeconds}s | Hits ${s.totalHits} / Misses ${s.totalMisses} | Accuracy ${acc}% | Bubble radius ${s.finalBubbleRadius}px (${shrinks} adaptive shrinks) | ${romLines} | ${fatigueLines}`;
}
