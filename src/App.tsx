import { useEffect, useMemo, useState } from "react";
import { MoveHorizontal, Hand, ShieldAlert } from "lucide-react";
import GlitchCursor from "@/components/ui/glitch-cursor";
import LiquidStartButton from "@/components/ui/button-1";
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
  const [movementMode, setMovementModeState] = useState<string>(() => getMovementMode());
  const [activeInstruction, setActiveInstruction] = useState<number | null>(null);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const onStateChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ state: string }>;
      setGameState(customEvent.detail.state);
    };

    window.addEventListener("nebula:game-state", onStateChange as EventListener);

    const initWebcam = async () => {
      const video = document.getElementById("webcam") as HTMLVideoElement | null;
      if (!video) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        video.srcObject = stream;
      } catch (err) {
        const error = err as Error;
        console.warn("Webcam unavailable:", error.message);
      }
    };

    void initWebcam();
    startGame();

    return () => {
      window.removeEventListener("nebula:game-state", onStateChange as EventListener);
      stopGame();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsBooting(false), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setMovementMode(movementMode);
  }, [movementMode]);

  const showWelcome = useMemo(() => gameState === GameState.IDLE, [gameState]);

  return (
    <>
      <canvas id="gameCanvas" />
      <video id="webcam" autoPlay playsInline muted />

      <div
        className={`pointer-events-none fixed inset-0 z-40 transition-opacity duration-500 ${
          isBooting ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-[#020412]" />
        <div className="nebula-boot-scanline absolute inset-0" />
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-none border-2 border-cyan-300/50 bg-black/70 p-5">
            <p className="mb-4 text-center text-xs tracking-[0.22em] text-cyan-100">INITIALIZING STAR DUST</p>
            <div className="h-3 w-full border border-cyan-300/70 bg-black">
              <div className="nebula-loader-fill h-full bg-[linear-gradient(90deg,#00e8ff_0%,#1f9cff_45%,#6f7dff_100%)]" />
            </div>
          </div>
        </div>
      </div>

      {showWelcome ? (
        <div className="fixed inset-0 z-20">
          <GlitchCursor
            title="S-tardus-T"
            subtitle=""
            caption=""
            titleSize="mb-5 text-3xl font-['Public_Pixel'] sm:text-5xl md:text-6xl lg:text-7xl"
          >
            <div className="nebula-fade-up relative z-10 mt-4 flex w-full max-w-md flex-col items-center">
              <div className="w-full rounded-xl border border-cyan-300/40 bg-black/55 p-4 backdrop-blur-md">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-200/90">How To Play</p>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementModeState(MovementMode.STANDING)}
                    className={`rounded-md border px-2 py-2 text-[10px] uppercase tracking-[0.12em] transition ${
                      movementMode === MovementMode.STANDING
                        ? "border-cyan-200 bg-cyan-400/20 text-cyan-100"
                        : "border-cyan-400/30 bg-black/30 text-cyan-300/80 hover:border-cyan-300/60"
                    }`}
                  >
                    Standing
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementModeState(MovementMode.WHEELCHAIR)}
                    className={`rounded-md border px-2 py-2 text-[10px] uppercase tracking-[0.12em] transition ${
                      movementMode === MovementMode.WHEELCHAIR
                        ? "border-cyan-200 bg-cyan-400/20 text-cyan-100"
                        : "border-cyan-400/30 bg-black/30 text-cyan-300/80 hover:border-cyan-300/60"
                    }`}
                  >
                    Wheelchair
                  </button>
                </div>
                <div className="flex flex-col gap-2 text-left">
                  {[
                    {
                      icon: MoveHorizontal,
                      title: "Steer",
                      text:
                        movementMode === MovementMode.WHEELCHAIR
                          ? "Move your neck left or right to steer the ship."
                          : "Lean your torso left or right to steer the ship.",
                    },
                    {
                      icon: Hand,
                      title: "Collect",
                      text: "Hold your wrists on stars to grab stardust.",
                    },
                    {
                      icon: ShieldAlert,
                      title: "Survive",
                      text: "Dodge meteors and stay alive.",
                    },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    const isActive = activeInstruction === index;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        onMouseEnter={() => setActiveInstruction(index)}
                        onMouseLeave={() => setActiveInstruction(null)}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                          isActive
                            ? "border-cyan-300/80 bg-cyan-500/10"
                            : "border-cyan-300/20 bg-black/20 hover:border-cyan-300/50 hover:bg-cyan-500/5"
                        }`}
                      >
                        <Icon className={`mt-0.5 h-4 w-4 ${isActive ? "text-cyan-200" : "text-cyan-300/80"}`} />
                        <div>
                          <p className="text-sm font-semibold text-cyan-100">{item.title}</p>
                          <p className="text-xs text-slate-300">{item.text}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-5">
                <LiquidStartButton
                  label="Start Mission"
                  onClick={() => {
                    requestPrimaryAction();
                  }}
                />
              </div>
            </div>
          </GlitchCursor>
        </div>
      ) : null}
    </>
  );
}

export default App;
