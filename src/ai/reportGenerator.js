import { getSessionSummary } from './telemetry.js';

const API_URL        = 'https://api.anthropic.com/v1/messages';
const MODEL          = 'claude-haiku-4-5-20251001';
const MAX_TOKENS     = 512;
const ANTHROPIC_VER  = '2023-06-01';

export async function generateReport() {
  const key = import.meta.env.VITE_AI_KEY;
  if (!key) throw new Error('VITE_AI_KEY is not set — copy .env.example to .env and add your key.');

  const summary  = getSessionSummary();
  const response = await fetch(API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         key,
      'anthropic-version': ANTHROPIC_VER,
    },
    body: JSON.stringify({
      model:     MODEL,
      max_tokens: MAX_TOKENS,
      messages:  [{ role: 'user', content: _buildPrompt(summary) }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  const data = await response.json();
  return { report: data.content[0].text, summary };
}

function _buildPrompt(s) {
  return `You are a pediatric physical therapist assistant reviewing a Nebula Navigator session.
Nebula Navigator is a browser-based therapy game where children pilot a spaceship using real body movement captured by webcam.

Session metrics:
- Duration: ${s.durationSeconds}s
- Hits: ${s.totalHits} | Misses: ${s.totalMisses}
- Accuracy: ${(s.accuracy * 100).toFixed(1)}%
- Average reaction latency: ${s.avgLatencyMs}ms
- Final bubble radius: ${s.finalBubbleRadius}px (baseline 120px — shrinks 20px every 3 misses, floor 40px)

Write a concise clinical session summary (3–5 sentences) for the supervising therapist.
Cover: motor control quality, reaction time, accuracy trends, and adaptive difficulty response.
Use professional but accessible language. Do not use bullet points.`;
}
