import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

function therapistReportApiPlugin(): Plugin {
  let anthropicKey = "";

  const handler = async (req: any, res: any) => {
    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (!anthropicKey) {
      return sendJson(res, 500, { error: "ANTHROPIC_API_KEY is not configured on the server." });
    }

    try {
      const rawBody = await readRequestBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const summary = payload?.summary;

      if (!summary || typeof summary !== "object") {
        return sendJson(res, 400, { error: "Missing `summary` payload." });
      }

      const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 512,
          messages: [{ role: "user", content: buildPrompt(summary) }],
        }),
      });

      if (!anthropicResponse.ok) {
        const text = await anthropicResponse.text();
        return sendJson(res, anthropicResponse.status, {
          error: `Anthropic API ${anthropicResponse.status}: ${text}`,
        });
      }

      const data = await anthropicResponse.json();
      const report = data?.content?.[0]?.text;
      return sendJson(res, 200, { report, model: ANTHROPIC_MODEL });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return sendJson(res, 500, { error: `Server report generation failed: ${message}` });
    }
  };

  return {
    name: "therapist-report-api",
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), "");
      anthropicKey =
        env.ANTHROPIC_API_KEY ||
        env.VITE_AI_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.VITE_AI_KEY ||
        "";
    },
    configureServer(server) {
      server.middlewares.use("/api/report", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/report", handler);
    },
  };
}

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
      if (body.length > 2_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function buildPrompt(summary: any) {
  const structured = {
    duration_seconds: summary.durationSeconds,
    total_hits: summary.totalHits,
    total_misses: summary.totalMisses,
    accuracy_percent: ((summary.accuracy ?? 0) * 100).toFixed(1),
    average_reaction_latency_ms: summary.avgLatencyMs,
    final_bubble_radius_px: summary.finalBubbleRadius,
    hip_sway: summary.hipSway,
    fatigue: summary.fatigue,
    range_of_motion: summary.rangeOfMotion,
    reaction_trend: summary.reactionTrend,
    bubble_behavior: summary.bubble,
  };

  return `You are a pediatric physical therapist assistant reviewing a Nebula Navigator session.
Nebula Navigator is a browser-based therapy game where children pilot a spaceship using real body movement captured by webcam.

Session telemetry (JSON):
${JSON.stringify(structured, null, 2)}

Write a concise therapist-facing summary in exactly 4-6 sentences.
Your summary must explicitly cover:
1) Motor performance and control quality
2) Bilateral comparison (left vs right) and asymmetry
3) Range of motion observations
4) Fatigue trend from first 25% vs last 25% of session
5) Practical next-step recommendation for the next session

Constraints:
- Use professional, readable clinical language.
- No bullet points.
- Mention quantitative details where possible.`;
}

export default defineConfig({
  plugins: [react(), therapistReportApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
