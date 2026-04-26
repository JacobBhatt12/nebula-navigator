import { cn } from "@/lib/utils";

type RobotFlybyProps = {
  className?: string;
  frameClassName?: string;
  src?: string;
};

export const Component = ({
  className,
  frameClassName,
  src = "https://my.spline.design/untitled-rv0hx3zVdoM6t2ydngxuS7zi/",
}: RobotFlybyProps) => {
  return (
    <div className={cn("flex h-screen w-full items-center justify-center bg-black", className)}>
      <div className={cn("h-full w-full max-w-5xl overflow-hidden rounded-xl border border-gray-700 shadow-2xl", frameClassName)}>
        <iframe src={src} className="h-full w-full" frameBorder="0" allowFullScreen />
      </div>
    </div>
  );
};

export const RobotFlyby = Component;

