import React, { useEffect, useRef } from "react";

type GlitchCursorProps = {
  title?: string;
  subtitle?: string;
  caption?: string;
  glitchBlockColor?: string;
  scanlineColor?: string;
  titleSize?: string;
  subtitleSize?: string;
  captionSize?: string;
  className?: string;
  backgroundImageUrl?: string;
  children?: React.ReactNode;
};

type MousePosition = { x: number; y: number };

class GlitchBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  life: number;
  context: CanvasRenderingContext2D;
  color: string;

  constructor(x: number, y: number, context: CanvasRenderingContext2D, color?: string) {
    this.x = x + (Math.random() - 0.5) * 50;
    this.y = y + (Math.random() - 0.5) * 50;
    this.width = Math.random() * 50 + 10;
    this.height = Math.random() * 30 + 5;
    this.life = 100;
    this.context = context;
    this.color =
      color ?? `hsla(${180 + Math.random() * 60}, 100%, 70%, ${Math.random() * 0.5 + 0.3})`;
  }

  draw() {
    this.context.fillStyle = this.color;
    this.context.fillRect(this.x, this.y, this.width, this.height);
  }

  update() {
    this.life -= 1;
    this.x += (Math.random() - 0.5) * 4;
    this.y += (Math.random() - 0.5) * 4;
  }
}

class Scanline {
  y: number;
  height: number;
  speed: number;
  life: number;
  context: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  offsetX: number;
  tint: string;

  constructor(
    y: number,
    height: number,
    speed: number,
    context: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    tint: string
  ) {
    this.y = y;
    this.height = height;
    this.speed = speed;
    this.life = 15;
    this.context = context;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.offsetX = (Math.random() - 0.5) * 100;
    this.tint = tint;
  }

  draw() {
    const safeY = Math.max(0, Math.min(this.canvasHeight - 1, Math.floor(this.y)));
    const safeHeight = Math.max(1, Math.min(this.canvasHeight - safeY, Math.floor(this.height)));
    const imageData = this.context.getImageData(0, safeY, this.canvasWidth, safeHeight);
    this.context.putImageData(imageData, this.offsetX, safeY);
    this.context.fillStyle = this.tint;
    this.context.fillRect(0, safeY, this.canvasWidth, safeHeight);
  }

  update() {
    this.life -= 1;
    this.y += this.speed;
  }
}

const GlitchCursor = ({
  title = "Glitch Field",
  subtitle = "Corrupting the digital space",
  caption = "Click to fracture reality",
  glitchBlockColor = "rgba(0, 255, 255, 0.7)",
  scanlineColor = "rgba(255, 255, 255, 0.1)",
  titleSize = "text-5xl md:text-7xl lg:text-8xl",
  subtitleSize = "text-xl md:text-2xl",
  captionSize = "text-sm md:text-base",
  className = "",
  backgroundImageUrl =
    "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80",
  children,
}: GlitchCursorProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const mouse = useRef<MousePosition>({ x: 0, y: 0 });
  const glitchBlocks = useRef<GlitchBlock[]>([]);
  const scanlines = useRef<Scanline[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const setDimensions = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      mouse.current.x = window.innerWidth / 2;
      mouse.current.y = window.innerHeight / 2;
    };

    setDimensions();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      glitchBlocks.current.forEach((block, i) => {
        block.update();
        block.draw();
        if (block.life <= 0) glitchBlocks.current.splice(i, 1);
      });

      scanlines.current.forEach((line, i) => {
        line.update();
        line.draw();
        if (line.life <= 0) scanlines.current.splice(i, 1);
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      if (Math.random() > 0.5) {
        glitchBlocks.current.push(new GlitchBlock(e.clientX, e.clientY, ctx, glitchBlockColor));
      }
    };

    const handleClick = () => {
      for (let i = 0; i < 20; i++) {
        scanlines.current.push(
          new Scanline(
            Math.random() * canvas.height,
            Math.random() * 10 + 1,
            (Math.random() - 0.5) * 4,
            ctx,
            canvas.width,
            canvas.height,
            scanlineColor
          )
        );
      }
    };

    const handleResize = () => {
      setDimensions();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);
    window.addEventListener("click", handleClick);

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("click", handleClick);
    };
  }, [glitchBlockColor, scanlineColor]);

  return (
    <div className={`relative h-screen w-screen overflow-hidden font-mono ${className}`}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImageUrl})` }}
      />
      <canvas ref={canvasRef} className="fixed inset-0 z-[1] block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.65)_0%,rgba(2,6,23,0.38)_38%,rgba(2,6,23,0.12)_65%,transparent_84%)]" />
      <div className="relative z-10 flex h-full w-full select-none flex-col items-center justify-center p-4 text-center">
        {title ? (
          <h1
            className={`m-0 p-0 font-bold uppercase leading-none tracking-widest text-cyan-300 ${titleSize}`}
            style={{ textShadow: "2px 2px 0px #ff00ff, -2px -2px 0px #00ffff" }}
          >
            {title}
          </h1>
        ) : null}
        {subtitle ? (
          <h2
            className={`m-0 mt-2 p-0 font-normal leading-none text-gray-300 ${subtitleSize}`}
            style={{ textShadow: "1px 1px 0px #ff00ff, -1px -1px 0px #00ffff" }}
          >
            {subtitle}
          </h2>
        ) : null}
        {caption ? <p className={`mt-4 p-0 font-light leading-none text-gray-400 ${captionSize}`}>{caption}</p> : null}
        {children}
      </div>
    </div>
  );
};

export default GlitchCursor;
