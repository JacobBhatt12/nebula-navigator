# S-TARDUS-T

> Browser-based AI physical therapy game for children with motor disabilities.

Pilot a spaceship using real body movement captured by a standard webcam. MediaPipe Pose Landmarker tracks hip lean (steering) and wrist reach (grabbing stardust targets). After each session, an AI generates a clinical report for therapists — no install required, runs fully in the browser.

---

## Team

| Member | Domain |
|--------|--------|
| **Jacob** | Game engine · Canvas · Ship · Meteors · Stardust · XP progression · HUD · CSS · `index.html` |
| **Markaelo** | Pose tracking · Calibration · Adaptive bubble · Telemetry · AI clinical reports · `.env` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Pose Tracking | MediaPipe Pose Landmarker via TensorFlow.js (CDN) |
| Game Engine | Vanilla JS + Canvas 2D API |
| UI / Start Screen | React + Tailwind CSS + Three.js shader |
| Build Tool | Vite (`npm run dev`) |
| AI Reports | LLM API — post-session clinical summary |

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/JacobBhatt12/nebula-navigator.git
cd nebula-navigator

# 2. Install dependencies
npm install

# 3. Add your API key
cp .env.example .env
# Edit .env and fill in VITE_AI_KEY with your key

# 4. Start the dev server
npm run dev
```

> **Never commit `.env`** — it contains your real API keys. Only `.env.example` (with placeholder values) belongs in the repo.

---

## How to Play

1. Allow webcam access when prompted
2. Select **Standing Mode** or **Wheelchair Mode** on the start screen
3. Press **SPACE** (or the on-screen button) to begin the 10-second reach calibration scan
4. After calibration, the game starts automatically:
   - **Lean your body** left/right to steer the ship
   - **Hold your wrist** over a stardust star to collect it
   - **Avoid meteors** — 3 hits ends the session
5. At session end, an AI-generated clinical report is displayed for therapists

---

## File Structure

```
nebula-navigator/
├── index.html                    # Main entry point (Jacob)
├── .env.example                  # API key template — commit this, not .env
├── CLAUDE.md                     # Claude Code rules for the repo
├── src/
│   ├── game/
│   │   ├── gameLoop.js           # State machine + main render loop
│   │   ├── ship.js               # Ship rendering + lerp movement
│   │   ├── meteor.js             # Meteor spawning, tails, collision
│   │   ├── stardust.js           # Star targets + hold-timer hitbox
│   │   ├── progression.js        # XP, level thresholds, skin unlocks
│   │   ├── arm.js                # Arm rendering
│   │   └── starshipShader.js     # GLSL start-screen background shader
│   ├── tracking/
│   │   ├── poseEngine.js         # MediaPipe init + webcam stream
│   │   ├── calibration.js        # 10-sec Golden Bounds reach scan
│   │   ├── poseInterface.js      # Shared pose data contract (see below)
│   │   └── adaptiveBubble.js     # Heuristic difficulty — bubble shrink/grow
│   ├── ai/
│   │   ├── telemetry.js          # Hit/miss/latency event logger
│   │   ├── sessionRecorder.js    # Session recording handler
│   │   └── reportGenerator.js    # AI API call → clinical summary
│   ├── ui/
│   │   ├── hud.js                # XP bar, skin level nodes, timer, health
│   │   └── reportModal.js        # Post-session report modal
│   └── styles/
│       └── main.css              # Global styles
```

> **File ownership is strict.** Jacob's code stays in `src/game/`, `src/ui/hud.js`, `src/styles/`, and `index.html`. Markaelo's code stays in `src/tracking/`, `src/ai/`, and `src/ui/reportModal.js`. Cross-boundary changes must be coordinated.

---

## Shared Interface Contract

`poseInterface.js` is the bridge between tracking and game. Both teammates depend on it. **Do not restructure it without discussing first.**

```js
// src/tracking/poseInterface.js
// Markaelo writes to this. Jacob reads from it.

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

## GitHub Workflow

**Never commit directly to `main` or `develop`.**

```bash
# Start any new piece of work
git checkout develop && git pull origin develop
git checkout -b jacob/feature-name   # or markaelo/feature-name

# Work, commit often
git add src/game/ship.js
git commit -m "feat: add ship lerp movement"

# Push and open a PR
git push -u origin jacob/feature-name
# GitHub → New Pull Request → base: develop ← compare: your branch
# Tag your teammate to review before merging
```

### Branch Map

| Branch | Owner | Purpose |
|--------|-------|---------|
| `main` | Both (protected) | Production-ready. PRs only, no direct pushes. |
| `develop` | Both | Integration branch — all features merge here first. |
| `jacob/game-canvas` | Jacob | Phase 1: Canvas layout, game loop, ship stub. |
| `jacob/ship-meteors` | Jacob | Phase 2: Ship lerp, meteor spawning, stardust targets. |
| `jacob/progression` | Jacob | Phase 3: XP, level-up, skin unlocks, HUD. ← *current* |
| `markaelo/tracking-setup` | Markaelo | Phase 1: MediaPipe init, webcam stream, poseInterface. |
| `markaelo/calibration` | Markaelo | Phase 2: Golden Bounds scan, coord normalization, bubble. |
| `markaelo/ai-report` | Markaelo | Phase 3: Telemetry logger, AI API call, report modal. |

### Commit Message Format

```
feat: add ship lerp movement
fix: correct wrist coordinate normalization
refactor: split gameLoop into smaller functions
docs: update README setup steps
chore: add .gitignore entry
```

---

## Environment Variables

| Variable | Used In | Description |
|----------|---------|-------------|
| `VITE_AI_KEY` | `src/ai/reportGenerator.js` | LLM API key for clinical report generation |

Copy `.env.example` → `.env` and fill in your key. The `.env` file is git-ignored and must **never** be committed. If you accidentally commit it, rotate your keys immediately and run:

```bash
git rm --cached .env
git commit -m "chore: remove .env from tracking"
```

---

## Build Checklist

| Phase | Status | Description |
|-------|--------|-------------|
| 0 — Repo Setup | ✅ | Repo, branches, CLAUDE.md, .gitignore |
| 1 — Foundation | ✅ | Canvas, game loop, ship, MediaPipe, poseInterface |
| 2 — Core Mechanics | ✅ | Meteors, stardust hold-timer, calibration, adaptive bubble |
| 3 — Progression & AI | ✅ | XP system, skin unlocks, HUD, telemetry, AI report |
| 4 — Polish & Submit | 🔄 | Full flow test, README, release tag, hackathon submission |

---

*Good luck, Jacob & Markaelo — build the tracking, build the game, merge the branches.*
