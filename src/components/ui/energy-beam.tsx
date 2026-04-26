import React, { useEffect, useRef } from "react";

interface EnergyBeamProps {
  projectId?: string;
  className?: string;
}

declare global {
  interface Window {
    UnicornStudio?: {
      init: () => void;
    };
  }
}

const SCRIPT_ID = "unicorn-studio-script";

const EnergyBeam: React.FC<EnergyBeamProps> = ({
  projectId = "hRFfUymDGOHwtFe7evR2",
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const initUnicorn = () => {
      if (cancelled) return;
      if (window.UnicornStudio && containerRef.current) {
        window.UnicornStudio.init();
      }
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.UnicornStudio) {
        initUnicorn();
      } else {
        existing.addEventListener("load", initUnicorn, { once: true });
      }
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.5.2/dist/unicornStudio.umd.js";
    script.async = true;
    script.onload = initUnicorn;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className={`relative h-screen w-full overflow-hidden bg-black ${className}`}>
      <div ref={containerRef} data-us-project={projectId} className="h-full w-full" />
    </div>
  );
};

export default EnergyBeam;
