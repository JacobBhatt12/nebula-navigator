import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type StarButtonProps = {
  label?: string;
  className?: string;
  onClick?: () => void;
};

export const Component = ({ label = "PLAY", className, onClick }: StarButtonProps) => {
  const [checked, setChecked] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setChecked((prev) => !prev);
        onClick?.();
      }}
      className={cn(
        "group flex h-14 w-52 items-center justify-between gap-3 overflow-hidden rounded-none border-2 border-pink-400 px-4 text-left font-extrabold uppercase tracking-[0.12em] text-cyan-100 transition-all active:scale-95",
        "bg-[linear-gradient(90deg,#ff4fd8_0%,#7a5cff_52%,#22d3ee_100%)] hover:border-cyan-300",
        checked ? "shadow-[0_0_0_2px_rgba(34,211,238,0.5),0_0_24px_rgba(255,79,216,0.45)]" : "shadow-[0_0_16px_rgba(122,92,255,0.35)]",
        className
      )}
      aria-pressed={checked}
    >
      <span className="z-10 text-xs transition group-hover:translate-x-1 sm:text-sm">{label}</span>
      <Star
        className={cn(
          "h-6 w-6 stroke-[1.75] transition-all duration-500",
          "group-hover:scale-[1.8] group-hover:-translate-x-2",
          checked ? "fill-cyan-200 text-cyan-100" : "fill-transparent text-pink-100"
        )}
      />
    </button>
  );
};

export const StarButton = Component;

