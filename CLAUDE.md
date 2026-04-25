# Nebula Navigator — Claude Code Rules

## Project Overview
Browser-based AI physical therapy game. Children pilot a spaceship using real body
movement captured by a standard webcam (MediaPipe pose tracking). Post-session AI
generates clinical reports for therapists. No install required — runs fully in the browser.

## Team
- **Jacob:**    Game engine, canvas, ship, meteors, stardust, XP, HUD, CSS, index.html
- **Markaelo:** Pose tracking, calibration, adaptive bubble, telemetry, AI reports, .env

---

## Branch Rules (CRITICAL)
- NEVER commit directly to `main` or `develop`
- Always branch from develop: `git checkout develop && git pull && git checkout -b name`
- Jacob's branches: prefix with `jacob/`   (e.g. `jacob/feature-name`)
- Markaelo's branches: prefix with `markaelo/`   (e.g. `markaelo/feature-name`)
- Open a Pull Request to `develop` when done; tag the other person to review
- Only merge `develop → main` together, after full testing

---

## File Ownership — DO NOT CROSS THESE BOUNDARIES

| Owner    | Files                                                        |
|----------|--------------------------------------------------------------|
| Jacob    | `src/game/**`  \|  `src/ui/hud.js`  \|  `src/styles/**`  \|  `index.html` |
| Markaelo | `src/tracking/**`  \|  `src/ai/**`  \|  `src/ui/reportModal.js`  \|  `.env.example` |
| Shared   | `package.json`  \|  `index.html` (script tag additions only — coordinate first) |

If Claude needs to suggest a change in the other person's file, generate it as a
clearly labeled block:

```
// HAND OFF TO [NAME]: paste this into their branch
```

---

## Environment Variables
- **NEVER** read, write, or suggest changes to `.env`
- **NEVER** hardcode API keys in any source file
- Use `.env.example` as the template — it has placeholder values only
- In code use: `import.meta.env.VITE_AI_KEY` (Vite) or `process.env.AI_KEY` (Node)
- If you need a new env variable, add the placeholder to `.env.example` only

---

## Files to NEVER Touch
- `.env` — secret keys, never read or write this file under any circumstances
- `node_modules/` — never suggest editing anything inside here
- `dist/` — build output, never edit
- `.DS_Store`, `Thumbs.db` — OS junk files, ignore completely

---

## Pose Interface Contract (`src/tracking/poseInterface.js`)
This file is the bridge between tracking and game. **Both teammates depend on it.**
Markaelo writes to it. Jacob reads from it. Neither restructures it without
discussing with the other first.

Agreed shape:
```js
export const poseData = {
  hipX:         0.5,   // 0.0 = far left, 1.0 = far right (normalized)
  leftWrist:    { x: 0.5, y: 0.5 },  // normalized 0–1
  rightWrist:   { x: 0.5, y: 0.5 },  // normalized 0–1
  bubbleRadius: 120,   // pixels — shrinks after 3 misses
  isCalibrated: false, // Jacob checks this before starting the game
};

export function updatePoseData(newData) {
  Object.assign(poseData, newData);
}
```

---

## Commit Message Format
```
feat: add ship lerp movement
fix: correct wrist coordinate normalization
refactor: split gameLoop into smaller functions
docs: update README setup steps
chore: add .gitignore entry
```

---

## Tech Stack
- MediaPipe Pose Landmarker via TensorFlow.js (CDN — no npm install needed)
- Vanilla JS + Canvas 2D API (no frameworks)
- Vite for local dev server (`npm run dev`)
- AI API for post-session clinical reports (key in `.env`)

---

## When Generating Code
1. Check which branch is active before suggesting file edits
2. Only suggest edits within the current developer's owned files
3. Cross-boundary changes must be labeled as HAND OFF blocks (see above)
4. Never auto-create `.env` or fill in API key placeholders
5. Always suggest running `npm install` after adding a dependency to `package.json`
