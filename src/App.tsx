import { useEffect, useMemo, useState } from "react";
import { MoveHorizontal, Hand, ShieldAlert } from "lucide-react";
import GlitchCursor from "@/components/ui/glitch-cursor";
import LiquidStartButton from "@/components/ui/button-1";
import { GameState, getGameState, requestPrimaryAction, startGame, stopGame } from "@/game/gameLoop.js";

function App() {
  const [gameState, setGameState] = useState<string>(() => getGameState());
  const [activeInstruction, setActiveInstruction] = useState<number | null>(null);

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

  const showWelcome = useMemo(() => gameState === GameState.IDLE, [gameState]);

  return (
    <>
      <canvas id="gameCanvas" />
      <video id="webcam" autoPlay playsInline muted />

      {showWelcome ? (
        <div className="fixed inset-0 z-20">
          <GlitchCursor
            title="S-tardus-T"
            subtitle=""
            caption=""
            titleSize="text-4xl sm:text-6xl md:text-7xl lg:text-8xl"
          >
            <div className="relative z-10 mt-4 flex w-full max-w-md flex-col items-center">
              <div className="w-full rounded-xl border border-cyan-300/40 bg-black/55 p-4 backdrop-blur-md">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-200/90">How To Play</p>
                <div className="flex flex-col gap-2 text-left">
                  {[
                    {
                      icon: MoveHorizontal,
                      title: "Steer",
                      text: "Lean left or right to move the ship.",
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
