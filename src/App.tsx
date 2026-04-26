import { useEffect, useMemo, useState } from "react";
import { Settings, Volume2, VolumeX } from "lucide-react";
import { AnoAI } from "@/components/ui/animated-shader-background";
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

// ── Deterministic seeded RNG (stable across renders) ──────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _rng = mulberry32(137);
const ALL_STARS = Array.from({ length: 120 }, () => ({
  x: +(_rng() * 100).toFixed(2),
  y: +(_rng() * 100).toFixed(2),
  r: _rng() < 0.1 ? 2 : _rng() < 0.28 ? 1.3 : 0.75,
  o: +(0.2 + _rng() * 0.8).toFixed(2),
}));
const STAR_GROUPS = [
  ALL_STARS.slice(0,  30),
  ALL_STARS.slice(30, 60),
  ALL_STARS.slice(60, 90),
  ALL_STARS.slice(90),
];

// Pre-defined floating pixel particles
const PIXELS = [
  { x: 4,  d: 0,    t: 14, s: 2, c: '#00ffff' },
  { x: 9,  d: 3.8,  t: 11, s: 3, c: '#cc88ff' },
  { x: 17, d: 7.2,  t: 16, s: 2, c: '#ffd700' },
  { x: 27, d: 1.3,  t: 12, s: 2, c: '#00ffff' },
  { x: 34, d: 5.6,  t: 9,  s: 3, c: '#ff88ff' },
  { x: 44, d: 2.9,  t: 13, s: 2, c: '#88ffff' },
  { x: 51, d: 8.4,  t: 15, s: 2, c: '#ffccff' },
  { x: 59, d: 0.6,  t: 10, s: 3, c: '#00ffff' },
  { x: 67, d: 4.2,  t: 14, s: 2, c: '#ffe088' },
  { x: 74, d: 6.7,  t: 11, s: 2, c: '#c0a0ff' },
  { x: 82, d: 2.1,  t: 16, s: 3, c: '#00ffff' },
  { x: 89, d: 9.4,  t: 13, s: 2, c: '#ff88ff' },
  { x: 95, d: 1.9,  t: 12, s: 2, c: '#88ffff' },
  { x: 13, d: 11.5, t: 14, s: 2, c: '#ffd700' },
  { x: 21, d: 4.5,  t: 10, s: 2, c: '#cc88ff' },
  { x: 39, d: 7.8,  t: 15, s: 3, c: '#00ffff' },
  { x: 56, d: 3.2,  t: 11, s: 2, c: '#ff88ff' },
  { x: 71, d: 9.8,  t: 13, s: 2, c: '#88ffff' },
  { x: 86, d: 0.9,  t: 16, s: 2, c: '#ffd700' },
  { x: 30, d: 12.5, t: 14, s: 2, c: '#c0a0ff' },
  { x: 47, d: 5.4,  t: 12, s: 3, c: '#00ffff' },
  { x: 63, d: 2.7,  t: 10, s: 2, c: '#ff88ff' },
  { x: 78, d: 8.8,  t: 15, s: 2, c: '#88e8ff' },
  { x: 92, d: 6.3,  t: 11, s: 2, c: '#ffd700' },
  { x: 3,  d: 10.4, t: 14, s: 3, c: '#cc88ff' },
];

// ── Galaxy (upper-left) ───────────────────────────────────────────────────────
const GALAXY_STARS = [
  [55,72],[132,44],[82,122],[148,98],[58,144],[118,158],
  [38,96],[164,132],[102,54],[88,150],[158,62],[32,62],
  [110,108],[76,38],[144,170],[48,128],[170,80],[64,158],
];

function GalaxyDecor() {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true"
         className="galaxy-spin absolute left-0 top-0 h-[150px] w-[150px] opacity-85
                    sm:h-[195px] sm:w-[195px] lg:h-[240px] lg:w-[240px]">
      <defs>
        <radialGradient id="gxyCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ffe090" stopOpacity="0.95"/>
          <stop offset="22%"  stopColor="#d07cff" stopOpacity="0.72"/>
          <stop offset="60%"  stopColor="#501ab0" stopOpacity="0.36"/>
          <stop offset="100%" stopColor="#10032a" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#gxyCore)"/>
      <path d="M100,100 Q144,50 180,30 Q190,22 196,16" stroke="#ffcc44" strokeWidth="10" fill="none" opacity="0.55" strokeLinecap="round"/>
      <path d="M100,100 Q60,150 34,175 Q20,186 12,194" stroke="#ffcc44" strokeWidth="10" fill="none" opacity="0.55" strokeLinecap="round"/>
      <path d="M100,100 Q152,124 174,160 Q186,176 190,188" stroke="#b060f0" strokeWidth="7"  fill="none" opacity="0.4"  strokeLinecap="round"/>
      <path d="M100,100 Q50,76  24,42  Q10,24  4,12"  stroke="#b060f0" strokeWidth="7"  fill="none" opacity="0.4"  strokeLinecap="round"/>
      {GALAXY_STARS.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.8 : 1} fill="white" opacity={i % 2 === 0 ? 0.9 : 0.55}/>
      ))}
      <circle cx="100" cy="100" r="8"   fill="#fff8d0" opacity="0.95"/>
      <circle cx="100" cy="100" r="3.5" fill="white"/>
    </svg>
  );
}

// ── Ringed planet (upper-right) ───────────────────────────────────────────────
function PlanetDecor() {
  return (
    <svg viewBox="0 0 180 145" aria-hidden="true"
         className="absolute right-0 top-3 h-[90px] w-[118px] opacity-90
                    sm:h-[115px] sm:w-[152px] lg:h-[145px] lg:w-[180px]">
      <defs>
        <radialGradient id="plntG" cx="36%" cy="33%" r="66%">
          <stop offset="0%"   stopColor="#c080ff"/>
          <stop offset="48%"  stopColor="#6030cc"/>
          <stop offset="100%" stopColor="#190750"/>
        </radialGradient>
      </defs>
      <ellipse cx="90" cy="76" rx="76" ry="17" fill="rgba(35,8,90,0.45)"/>
      <circle  cx="90" cy="63" r="46"  fill="url(#plntG)"/>
      <ellipse cx="76" cy="50" rx="22" ry="8"  fill="rgba(190,140,255,0.22)"/>
      <ellipse cx="104" cy="72" rx="16" ry="5" fill="rgba(80,40,190,0.28)"/>
      <ellipse cx="90" cy="68" rx="76" ry="15" fill="none" stroke="rgba(200,165,255,0.8)"  strokeWidth="6"  className="ring-pulse"/>
      <ellipse cx="90" cy="68" rx="76" ry="15" fill="none" stroke="rgba(230,210,255,0.22)" strokeWidth="12" className="ring-pulse"/>
      <clipPath id="plntClip"><circle cx="90" cy="63" r="46"/></clipPath>
      <ellipse cx="90" cy="68" rx="76" ry="15" fill="url(#plntG)" clipPath="url(#plntClip)"/>
    </svg>
  );
}

// ── Pixel-art spaceship ───────────────────────────────────────────────────────
function SpaceshipDecor() {
  return (
    <svg width="140" height="168" viewBox="-28 -60 56 118" fill="none"
         shapeRendering="crispEdges" aria-hidden="true">
      {/* Wings */}
      <path d="M-28 8 L-12 -8 L-12 32 L-28 40 Z"  fill="#2a5a9a"/>
      <path d="M28  8 L12 -8  L12 32  L28 40 Z"   fill="#2a5a9a"/>
      <rect x="-28" y="12" width="16" height="4" fill="rgba(0,190,255,0.5)"/>
      <rect x="12"  y="12" width="16" height="4" fill="rgba(0,190,255,0.5)"/>
      {/* Hull */}
      <rect x="-13" y="-47" width="26" height="9"  fill="#c0d4e8"/>
      <rect x="-17" y="-38" width="34" height="64" fill="#ccdcea"/>
      {/* Nose */}
      <rect x="-5"  y="-57" width="10" height="5"  fill="#e2f4ff"/>
      <rect x="-9"  y="-52" width="18" height="6"  fill="#d8eef8"/>
      {/* Lower hull */}
      <rect x="-13" y="25" width="26" height="14" fill="#b0c8de"/>
      {/* Cockpit */}
      <rect x="-9"  y="-36" width="18" height="18" fill="#40b0ff"/>
      <rect x="-7"  y="-34" width="7"  height="9"  fill="rgba(255,255,255,0.32)"/>
      {/* Stripe */}
      <rect x="-17" y="-8" width="34" height="4" fill="rgba(255,255,255,0.92)"/>
      {/* Engine nozzles */}
      <rect x="-11" y="39" width="8"  height="9" fill="#111e40"/>
      <rect x="3"   y="39" width="8"  height="9" fill="#111e40"/>
      {/* Thrust outer */}
      <ellipse cx="-7"  cy="55" rx="6"  ry="12" fill="url(#sFL)" className="thruster-flame"/>
      <ellipse cx="7"   cy="55" rx="6"  ry="12" fill="url(#sFR)" className="thruster-flame"/>
      {/* Thrust core (white flicker) */}
      <ellipse cx="-7"  cy="47" rx="3.2" ry="5.5" fill="white" opacity="0.7" className="thruster-core"/>
      <ellipse cx="7"   cy="47" rx="3.2" ry="5.5" fill="white" opacity="0.7" className="thruster-core"/>
      <defs>
        <radialGradient id="sFL" cx="0.5" cy="0" r="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"/>
          <stop offset="20%"  stopColor="#88ffff" stopOpacity="0.95"/>
          <stop offset="60%"  stopColor="#0058ff" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#000070" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="sFR" cx="0.5" cy="0" r="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"/>
          <stop offset="20%"  stopColor="#88ffff" stopOpacity="0.95"/>
          <stop offset="60%"  stopColor="#0058ff" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#000070" stopOpacity="0"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
function App() {
  const [gameState,        setGameState]        = useState<string>(() => getGameState());
  const [movementMode,     setMovementModeState] = useState<string>(() => getMovementMode());
  const [isBooting,        setIsBooting]         = useState(true);
  const [soundOn,          setSoundOn]           = useState(true);

  useEffect(() => {
    const onState = (e: Event) =>
      setGameState((e as CustomEvent<{ state: string }>).detail.state);
    window.addEventListener("nebula:game-state", onState as EventListener);

    const initWebcam = async () => {
      const vid = document.getElementById("webcam") as HTMLVideoElement | null;
      if (!vid) return;
      try { vid.srcObject = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
      catch (err) { console.warn("Webcam unavailable:", (err as Error).message); }
    };
    void initWebcam();
    startGame();
    return () => {
      window.removeEventListener("nebula:game-state", onState as EventListener);
      stopGame();
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setIsBooting(false), 1400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => { setMovementMode(movementMode); }, [movementMode]);

  const showWelcome = useMemo(() => gameState === GameState.IDLE, [gameState]);
  const isStanding  = movementMode === MovementMode.STANDING;
  const isChair     = movementMode === MovementMode.WHEELCHAIR;

  return (
    <>
      <canvas id="gameCanvas"/>
      <video  id="webcam" autoPlay playsInline muted/>

      {/* ── Boot ──────────────────────────────────────────────────────────── */}
      <div className={`pointer-events-none fixed inset-0 z-40 transition-opacity duration-500
                       ${isBooting ? "opacity-100" : "opacity-0"}`}>
        <div className="absolute inset-0 bg-[#020412]"/>
        <div className="nebula-boot-scanline absolute inset-0"/>
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="w-full max-w-lg border-2 border-cyan-300/50 bg-black/70 p-5">
            <p className="mb-4 text-center text-xs tracking-[0.22em] text-cyan-100">
              INITIALIZING STAR DUST
            </p>
            <div className="h-3 w-full border border-cyan-300/70 bg-black">
              <div className="nebula-loader-fill h-full bg-[linear-gradient(90deg,#00e8ff_0%,#1f9cff_45%,#6f7dff_100%)]"/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Welcome screen ────────────────────────────────────────────────── */}
      {showWelcome ? (
        <div className="fixed inset-0 z-20 overflow-hidden font-['Press_Start_2P']"
             style={{ imageRendering: 'pixelated' }}>

          {/* Three.js aurora shader — fills the whole background */}
          <AnoAI />

          {/* Twinkling starfield */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {STAR_GROUPS.map((group, gi) => (
              <g key={gi} className={`twinkle-${'abcd'[gi]}`}>
                {group.map((s, i) => (
                  <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.o}/>
                ))}
              </g>
            ))}
          </svg>

          {/* CRT scanlines + sweep */}
          <div className="crt-scanlines pointer-events-none absolute inset-0 z-30"/>
          <div className="scanline-sweep z-30"/>

          {/* Cosmic decorations */}
          <GalaxyDecor/>
          <PlanetDecor/>

          {/* ── Asteroid rock clusters ── */}
          {/* Lower-left cluster */}
          <div aria-hidden="true" className="asteroid-a absolute opacity-95"
               style={{bottom:'-3rem', left:'-3rem', width:'260px', height:'260px',
                 background:'radial-gradient(ellipse at 38% 32%, #3e2c6a 0%, #1e1035 52%, #0a071c 100%)',
                 clipPath:'polygon(18% 2%, 82% 0%, 100% 20%, 98% 74%, 78% 100%, 20% 98%, 0% 74%, 2% 18%)'}}/>
          <div aria-hidden="true" className="asteroid-b absolute opacity-82"
               style={{bottom:'-2rem', left:'4rem', width:'180px', height:'180px',
                 background:'radial-gradient(ellipse at 44% 40%, #322258 0%, #160e2c 54%, #09061a 100%)',
                 clipPath:'polygon(8% 5%, 88% 2%, 100% 32%, 94% 80%, 72% 100%, 14% 98%, 0% 65%, 5% 22%)'}}/>
          <div aria-hidden="true" className="asteroid-c absolute opacity-65"
               style={{bottom:'4rem', left:'-1rem', width:'120px', height:'120px',
                 background:'radial-gradient(ellipse at 50% 35%, #28185a 0%, #100a28 55%, #070518 100%)',
                 clipPath:'polygon(22% 0%, 85% 8%, 100% 28%, 92% 82%, 70% 100%, 18% 94%, 0% 70%, 5% 24%)'}}/>
          {/* Lower-right cluster */}
          <div aria-hidden="true" className="asteroid-b absolute opacity-95"
               style={{bottom:'-3rem', right:'-3rem', width:'280px', height:'280px',
                 background:'radial-gradient(ellipse at 55% 34%, #3c2a62 0%, #1c1032 52%, #090718 100%)',
                 clipPath:'polygon(20% 0%, 88% 5%, 100% 24%, 97% 76%, 76% 100%, 18% 97%, 0% 72%, 3% 20%)'}}/>
          <div aria-hidden="true" className="asteroid-d absolute opacity-80"
               style={{bottom:'-2rem', right:'4.5rem', width:'175px', height:'175px',
                 background:'radial-gradient(ellipse at 48% 40%, #2e2050 0%, #140c28 54%, #080518 100%)',
                 clipPath:'polygon(10% 5%, 84% 0%, 100% 30%, 96% 78%, 74% 100%, 12% 96%, 0% 68%, 5% 22%)'}}/>
          <div aria-hidden="true" className="asteroid-a absolute opacity-60"
               style={{bottom:'5rem', right:'-0.5rem', width:'115px', height:'115px',
                 background:'radial-gradient(ellipse at 52% 36%, #261848 0%, #100828 55%, #070518 100%)',
                 clipPath:'polygon(24% 2%, 82% 4%, 100% 26%, 95% 80%, 72% 100%, 20% 96%, 0% 74%, 4% 26%)'}}/>

          {/* Floating pixel particles */}
          {PIXELS.map((p, i) => (
            <div key={i} className="pixel-particle bottom-0"
                 style={{left:`${p.x}%`, width:`${p.s}px`, height:`${p.s}px`,
                   background: p.c, boxShadow:`0 0 ${p.s*2}px ${p.c}`,
                   animationDuration:`${p.t}s`, animationDelay:`${p.d}s`}}/>
          ))}

          {/* ── Main UI content ────────────────────────────────────────────── */}
          <div className="nebula-fade-up relative z-10 flex h-full flex-col
                          items-center justify-center gap-4 pb-32 pt-4">

            {/* Title */}
            <h1 className="glitch-title select-none text-center leading-tight
                           text-[1.9rem] sm:text-[2.6rem] md:text-[3.4rem] lg:text-[4.4rem] xl:text-[5.2rem]">
              S-TARDUS-T
            </h1>

            {/* ── Mode buttons ─────────────────────────────────────────────── */}
            <div className="flex w-full max-w-2xl gap-4 px-4">

              {/* STANDING MODE */}
              <button type="button"
                      onClick={() => setMovementModeState(MovementMode.STANDING)}
                      className={`pixel-btn flex flex-1 items-center gap-4 px-5 py-4
                                  text-[9px] uppercase tracking-wide transition-colors duration-100
                                  sm:gap-5 sm:px-6 sm:py-5 sm:text-[11px]
                                  ${isStanding
                                    ? 'pixel-btn-active-cyan border-cyan-400 bg-cyan-950/70 text-cyan-200'
                                    : 'border-cyan-500/38 bg-black/60 text-cyan-400/60 hover:border-cyan-400/72 hover:text-cyan-300'}`}>
                {/* Pixel-art standing person */}
                <svg viewBox="0 0 18 40" fill="currentColor" shapeRendering="crispEdges"
                     className="h-12 w-5 shrink-0" aria-hidden="true">
                  <rect x="5" y="0"  width="8" height="8"/>   {/* head */}
                  <rect x="5" y="10" width="8" height="13"/>  {/* torso */}
                  <rect x="0" y="11" width="5" height="9"/>   {/* L arm */}
                  <rect x="13" y="11" width="5" height="9"/>  {/* R arm */}
                  <rect x="5" y="24" width="3" height="15"/>  {/* L leg */}
                  <rect x="10" y="24" width="3" height="15"/> {/* R leg */}
                </svg>
                <span className="leading-snug">STANDING<br/>MODE</span>
              </button>

              {/* WHEELCHAIR MODE */}
              <button type="button"
                      onClick={() => setMovementModeState(MovementMode.WHEELCHAIR)}
                      className={`pixel-btn flex flex-1 items-center gap-4 px-5 py-4
                                  text-[9px] uppercase tracking-wide transition-colors duration-100
                                  sm:gap-5 sm:px-6 sm:py-5 sm:text-[11px]
                                  ${isChair
                                    ? 'pixel-btn-active-magenta border-fuchsia-400 bg-fuchsia-950/70 text-fuchsia-200'
                                    : 'border-fuchsia-500/38 bg-black/60 text-fuchsia-400/60 hover:border-fuchsia-400/72 hover:text-fuchsia-300'}`}>
                {/* Pixel-art wheelchair person */}
                <svg viewBox="0 0 24 40" fill="none" shapeRendering="crispEdges"
                     className="h-12 w-6 shrink-0" aria-hidden="true">
                  <rect x="8"  y="0"  width="8"  height="7"  fill="currentColor"/>  {/* head */}
                  <rect x="9"  y="8"  width="5"  height="8"  fill="currentColor"/>  {/* body */}
                  <rect x="9"  y="16" width="11" height="3"  fill="currentColor"/>  {/* lap */}
                  {/* rear wheel (pixel octagon) */}
                  <rect x="0"  y="22" width="2"  height="12" fill="currentColor"/>
                  <rect x="12" y="22" width="2"  height="12" fill="currentColor"/>
                  <rect x="2"  y="20" width="10" height="2"  fill="currentColor"/>
                  <rect x="2"  y="34" width="10" height="2"  fill="currentColor"/>
                  <rect x="5"  y="21" width="4"  height="1"  fill="currentColor" opacity="0.5"/>
                  <rect x="5"  y="35" width="4"  height="1"  fill="currentColor" opacity="0.5"/>
                  {/* front wheel */}
                  <rect x="17" y="26" width="2"  height="9"  fill="currentColor"/>
                  <rect x="18" y="25" width="4"  height="2"  fill="currentColor"/>
                  <rect x="18" y="35" width="4"  height="2"  fill="currentColor"/>
                  {/* push handle */}
                  <rect x="20" y="16" width="2"  height="9"  fill="currentColor" opacity="0.7"/>
                </svg>
                <span className="leading-snug">WHEELCHAIR<br/>MODE</span>
              </button>
            </div>

            {/* ── Mechanic cards ────────────────────────────────────────────── */}
            <div className="flex w-full max-w-2xl gap-3 px-4">

              {/* LEAN TO STEER */}
              <div className="pixel-card pixel-card-cyan flex flex-1 items-center gap-3
                              bg-black/60 px-3 py-3 backdrop-blur-sm transition-colors duration-150">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-cyan-900/50"
                     style={{border:'2px solid rgba(0,232,255,0.6)'}}>
                  {/* Pixel steering wheel */}
                  <svg viewBox="0 0 22 22" fill="none" shapeRendering="crispEdges"
                       stroke="#00e8ff" strokeWidth="0"
                       className="h-7 w-7 drop-shadow-[0_0_5px_rgba(0,222,255,0.9)]" aria-hidden="true">
                    <rect x="0"  y="9"  width="22" height="4"  fill="#00e8ff"/>  {/* H spoke */}
                    <rect x="9"  y="0"  width="4"  height="22" fill="#00e8ff"/>  {/* V spoke */}
                    <rect x="0"  y="7"  width="4"  height="8"  fill="#00e8ff"/>  {/* L rim */}
                    <rect x="18" y="7"  width="4"  height="8"  fill="#00e8ff"/>  {/* R rim */}
                    <rect x="7"  y="0"  width="8"  height="4"  fill="#00e8ff"/>  {/* T rim */}
                    <rect x="7"  y="18" width="8"  height="4"  fill="#00e8ff"/>  {/* B rim */}
                    <rect x="8"  y="8"  width="6"  height="6"  fill="#001830"/>  {/* hub dark */}
                    <rect x="9"  y="9"  width="4"  height="4"  fill="#00e8ff"/>  {/* hub center */}
                  </svg>
                </div>
                <span className="text-[7px] uppercase leading-relaxed tracking-wide text-cyan-300 sm:text-[9px]">
                  LEAN TO<br/>STEER
                </span>
              </div>

              {/* GRAB STARDUST */}
              <div className="pixel-card pixel-card-gold flex flex-1 items-center gap-3
                              bg-black/60 px-3 py-3 backdrop-blur-sm transition-colors duration-150">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-yellow-900/40"
                     style={{border:'2px solid rgba(255,210,0,0.6)'}}>
                  {/* Pixel star */}
                  <svg viewBox="0 0 22 22" fill="#ffd700" shapeRendering="crispEdges"
                       className="h-7 w-7 drop-shadow-[0_0_5px_rgba(255,210,0,0.9)]" aria-hidden="true">
                    <rect x="9"  y="0"  width="4"  height="6" />
                    <rect x="9"  y="14" width="4"  height="8" />
                    <rect x="0"  y="8"  width="7"  height="4" />
                    <rect x="14" y="8"  width="8"  height="4" />
                    <rect x="2"  y="2"  width="4"  height="4" />
                    <rect x="16" y="2"  width="4"  height="4" />
                    <rect x="2"  y="16" width="4"  height="4" />
                    <rect x="16" y="16" width="4"  height="4" />
                    <rect x="6"  y="6"  width="10" height="10"/>
                  </svg>
                </div>
                <span className="text-[7px] uppercase leading-relaxed tracking-wide text-yellow-300 sm:text-[9px]">
                  GRAB<br/>STARDUST
                </span>
              </div>

              {/* AVOID ASTEROIDS */}
              <div className="pixel-card pixel-card-magenta flex flex-1 items-center gap-3
                              bg-black/60 px-3 py-3 backdrop-blur-sm transition-colors duration-150">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-fuchsia-900/40"
                     style={{border:'2px solid rgba(255,0,200,0.6)'}}>
                  {/* Pixel asteroid + trail */}
                  <svg viewBox="0 0 22 22" fill="#ff00cc" shapeRendering="crispEdges"
                       className="h-7 w-7 drop-shadow-[0_0_5px_rgba(255,0,200,0.9)]" aria-hidden="true">
                    <rect x="10" y="0"  width="12" height="12"/>
                    <rect x="12" y="2"  width="3"  height="2"  fill="rgba(0,0,0,0.4)"/>
                    <rect x="0"  y="14" width="3"  height="3"  opacity="0.85"/>
                    <rect x="3"  y="17" width="3"  height="2"  opacity="0.6"/>
                    <rect x="6"  y="19" width="2"  height="2"  opacity="0.4"/>
                    <rect x="8"  y="21" width="2"  height="1"  opacity="0.22"/>
                  </svg>
                </div>
                <span className="text-[7px] uppercase leading-relaxed tracking-wide text-fuchsia-300 sm:text-[9px]">
                  AVOID<br/>ASTEROIDS
                </span>
              </div>
            </div>

            {/* Press space — also tappable */}
            <button type="button" onClick={requestPrimaryAction}
                    className="start-blink mt-2 cursor-pointer text-[13px] tracking-[0.28em]
                               text-yellow-300 drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]
                               hover:text-yellow-200 sm:text-[16px] md:text-[18px]">
              PRESS SPACE TO BEGIN
            </button>
          </div>

          {/* ── Spaceship (bottom-center) ──────────────────────────────────── */}
          <div className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2">
            <div className="ship-decor">
              <SpaceshipDecor/>
            </div>
          </div>

          {/* ── Settings (bottom-left) ─────────────────────────────────────── */}
          <button type="button" aria-label="Settings"
                  className="fixed bottom-4 left-4 z-30 border border-white/15 bg-black/45
                             p-2.5 text-white/45 backdrop-blur-sm transition-all
                             hover:border-white/38 hover:text-white/78">
            <Settings className="h-5 w-5"/>
          </button>

          {/* ── Sound (bottom-right) ───────────────────────────────────────── */}
          <button type="button" onClick={() => setSoundOn(!soundOn)}
                  aria-label={soundOn ? "Mute" : "Unmute"}
                  className="fixed bottom-4 right-4 z-30 border border-white/15 bg-black/45
                             p-2.5 text-white/45 backdrop-blur-sm transition-all
                             hover:border-white/38 hover:text-white/78">
            {soundOn ? <Volume2 className="h-5 w-5"/> : <VolumeX className="h-5 w-5"/>}
          </button>
        </div>
      ) : null}
    </>
  );
}

export default App;
