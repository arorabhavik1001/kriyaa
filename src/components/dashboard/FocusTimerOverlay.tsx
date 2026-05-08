import { useFocusTimer } from "@/contexts/FocusTimerContext";
import { Pause, Play, X, Brain, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function FocusTimerOverlay() {
  const timer = useFocusTimer();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when timer stops so overlay reappears on next start
  useEffect(() => {
    if (!timer.running) setDismissed(false);
  }, [timer.running]);

  if (!timer.running || dismissed) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border shadow-lg backdrop-blur-md px-4 py-2.5 min-w-[200px]",
          timer.mode === "work"
            ? "border-primary/30 bg-primary/5 dark:bg-primary/10"
            : "border-green-500/30 bg-green-500/5 dark:bg-green-500/10",
        )}
      >
        {/* Mini circular progress */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="2.5"
              opacity={0.3}
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke={
                timer.mode === "work"
                  ? "hsl(var(--primary))"
                  : "hsl(142, 76%, 36%)"
              }
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 16}
              strokeDashoffset={
                2 * Math.PI * 16 * (1 - timer.progress / 100)
              }
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute">
            {timer.mode === "work" ? (
              <Brain className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Coffee className="h-3.5 w-3.5 text-green-600" />
            )}
          </div>
        </div>

        {/* Timer display */}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none">
            {timer.mode === "work" ? "Focus" : "Break"}
          </span>
          <span className="text-lg font-bold tabular-nums text-foreground tracking-tight leading-tight">
            {timer.display}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 ml-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={timer.toggleRunning}
            title={timer.running ? "Pause" : "Resume"}
          >
            {timer.running ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
            title="Dismiss overlay"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
