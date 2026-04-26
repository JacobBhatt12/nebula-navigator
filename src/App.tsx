import { useEffect, useMemo, useState } from "react";
import { Brain, Hand, Rocket, Settings, Shield, Volume2, VolumeX } from "lucide-react";
import { PixelRocketHero } from "@/components/ui/pixel-rocket-voyager";
import {
  GameState,
  MovementMode,
  getGameState,
  getMovementMode,
  requestPrimaryAction,
  setMovementMode,
  startGame,
  stopGame,
} from "@/game/gameLoop.js";

function App() {
  const [gameState, setGameState] = useState<string>(() => getGameState());
  const [movementMode, setMovementModeState] = useState<string>(() =>
    getMovementMode()
  );
  const [isBooting, setIsBooting] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const onState = (e: Event) =>
      setGameState((e as CustomEvent<{ state: string }>).detail.state);
    window.addEventListener("nebula:game-state", onState as EventListener);

    const initWebcam = async () => {
      const vid = document.getElementById("webcam") as HTMLVideoElement | null;
      if (!vid) return;
      try {
        vid.srcObject = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 16 / 9 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });
      } catch (err) {
        console.warn("Webcam unavailable:", (err as Error).message);
      }
    };

    void initWebcam();
    startGame();

    return () => {
      window.removeEventListener("nebula:game-state", onState as EventListener);
      stopGame();
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setIsBooting(false), 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    setMovementMode(movementMode);
  }, [movementMode]);

  const showWelcome = useMemo(() => gameState === GameState.IDLE, [gameState]);
  const isStanding = movementMode === MovementMode.STANDING;
  const isChair = movementMode === MovementMode.WHEELCHAIR;

  return (
    <>
      <canvas
        id="gameCanvas"
        className={showWelcome ? "opacity-0 transition-opacity duration-300" : ""}
      />
      <video id="webcam" autoPlay playsInline muted />

      <div
        className={`pointer-events-none fixed inset-0 z-40 transition-opacity duration-300 ${
          isBooting ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-[var(--bg-dark)]" />
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="w-full max-w-lg border border-cyan-300/40 bg-black/70 p-5">
            <p className="mb-4 text-center text-xs tracking-[0.22em] text-cyan-100">
              INITIALIZING STAR DUST
            </p>
            <div className="h-2.5 w-full border border-cyan-300/60 bg-black">
              <div className="h-full w-full bg-[linear-gradient(90deg,#00e8ff_0%,#1f9cff_45%,#6f7dff_100%)]" />
            </div>
          </div>
        </div>
      </div>

      {showWelcome ? (
        <div className="fixed inset-0 z-20 overflow-hidden">
          <PixelRocketHero title="S-TARDUS-T" subtitle="" className="!bg-[#080b1e]">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 pb-20">
              <div className="flex w-full max-w-2xl gap-5 px-1 mx-auto">
                <button
                  type="button"
                  onClick={() => setMovementModeState(MovementMode.STANDING)}
                  className={`pixel-btn flex flex-1 items-center gap-4 px-5 py-4 text-[9px] uppercase tracking-wide transition-all duration-200 hover:-translate-y-1 sm:gap-5 sm:px-6 sm:py-5 sm:text-[11px] ${
                    isStanding
                      ? "pixel-btn-active-cyan border-cyan-200 bg-cyan-500 text-white"
                      : "border-cyan-200/70 bg-cyan-700 text-cyan-50 hover:border-cyan-100 hover:bg-cyan-600"
                  }`}
                >
                  <Rocket className="h-5 w-5" />
                  <span className="leading-snug">
                    STANDING
                    <br />
                    MODE
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementModeState(MovementMode.WHEELCHAIR)}
                  className={`pixel-btn flex flex-1 items-center gap-4 px-5 py-4 text-[9px] uppercase tracking-wide transition-all duration-200 hover:-translate-y-1 sm:gap-5 sm:px-6 sm:py-5 sm:text-[11px] ${
                    isChair
                      ? "pixel-btn-active-magenta border-fuchsia-200 bg-fuchsia-500 text-white"
                      : "border-fuchsia-200/70 bg-fuchsia-700 text-fuchsia-50 hover:border-fuchsia-100 hover:bg-fuchsia-600"
                  }`}
                >
                  <Shield className="h-5 w-5" />
                  <span className="leading-snug">
                    WHEELCHAIR
                    <br />
                    MODE
                  </span>
                </button>
              </div>

              <div className="grid w-full max-w-3xl grid-cols-1 gap-4 px-2 sm:grid-cols-3">
                <button type="button" className="instruction-card instruction-card-cyan">
                  <Brain className="h-5 w-5" />
                  <span>Lean to steer</span>
                </button>
                <button type="button" className="instruction-card instruction-card-gold">
                  <Hand className="h-5 w-5" />
                  <span>Grab stardust</span>
                </button>
                <button type="button" className="instruction-card instruction-card-magenta">
                  <Shield className="h-5 w-5" />
                  <span>Avoid meteors</span>
                </button>
              </div>

              <button
                type="button"
                onClick={requestPrimaryAction}
                className="launch-btn mt-1 inline-flex items-center"
              >
                PRESS SPACE TO PLAY
              </button>
            </div>
          </PixelRocketHero>

          <button
            type="button"
            aria-label="Settings"
            className="fixed bottom-4 left-4 z-30 border border-white/15 bg-black/45 p-2.5 text-white/45 backdrop-blur-sm transition-all hover:border-white/38 hover:text-white/78"
          >
            <Settings className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setSoundOn(!soundOn)}
            aria-label={soundOn ? "Mute" : "Unmute"}
            className="fixed bottom-4 right-4 z-30 border border-white/15 bg-black/45 p-2.5 text-white/45 backdrop-blur-sm transition-all hover:border-white/38 hover:text-white/78"
          >
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
      ) : null}
    </>
  );
}

export default App;
