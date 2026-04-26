import { getSessionSummary } from './telemetry.js';

const API_URL = '/api/report';

export async function generateReport() {
  const summary  = getSessionSummary();

  let response;
  try {
    response = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
      }),
    });
  } catch (error) {
    return {
      report: buildFallbackReport(summary),
      summary,
      source: 'local-fallback',
      error: `Network error while contacting Anthropic: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!response.ok) {
    const text = await response.text();
    return {
      report: buildFallbackReport(summary),
      summary,
      source: 'local-fallback',
      error: `Report API ${response.status}: ${text}`,
    };
  }

  const data = await response.json();
  return {
    report: data.report || buildFallbackReport(summary),
    summary,
    source: data.model ? 'anthropic' : 'local-fallback',
  };
}

export function buildFallbackReport(summary) {
  const fatigue = summary.fatigue;
  const rom = summary.rangeOfMotion;
  const side = rom.dominantSide === 'balanced' ? 'balanced bilateral reach' : `${rom.dominantSide}-side dominant reach`;
  const fatigueLine = fatigue.detected
    ? `Accuracy declined from ${_pct(fatigue.firstQuarterAccuracy)}% in the first quarter to ${_pct(fatigue.lastQuarterAccuracy)}% in the final quarter, suggesting fatigue effects late in session.`
    : `Accuracy remained relatively stable across the session (${_pct(fatigue.firstQuarterAccuracy)}% early vs ${_pct(fatigue.lastQuarterAccuracy)}% late), with no strong fatigue signature.`;

  return `Session duration was ${summary.durationSeconds}s with ${summary.totalHits} successful collections and ${summary.totalMisses} misses (${_pct(summary.accuracy)}% accuracy). Average reaction latency was ${summary.avgLatencyMs}ms and final assist bubble size was ${summary.finalBubbleRadius}px. Bilateral movement showed ${side}, with asymmetry index ${summary.rangeOfMotion.asymmetryIndexPct}%. Left ROM was lateral ${rom.left.lateralExcursion} and vertical ${rom.left.verticalExcursion}, while right ROM was lateral ${rom.right.lateralExcursion} and vertical ${rom.right.verticalExcursion}. ${fatigueLine} Consider continuing bilateral reach tasks while cueing symmetrical movement amplitude and pacing rest intervals if late-session accuracy drops again.`;
}

function _pct(value) {
  return (value * 100).toFixed(1);
}
