import { Timer, Play, Pause, RotateCcw, Coffee, Brain, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFocusTimer } from "@/contexts/FocusTimerContext";

const PRESET_DURATIONS = [
  { label: "15 min", work: 15 * 60, break: 3 * 60 },
  { label: "25 min", work: 25 * 60, break: 5 * 60 },
  { label: "50 min", work: 50 * 60, break: 10 * 60 },
];

export function FocusTimer() {
  const timer = useFocusTimer();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0 bg-muted/20 rounded-t-xl">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background">
              <Timer className="h-4 w-4 text-primary" />
            </span>
            <span className="truncate">Focus Timer</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {timer.sessions > 0 ? `${timer.sessions} session${timer.sessions > 1 ? "s" : ""} today` : "Stay focused, stay sharp"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => setShowSettings((v) => !v)}
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="p-6 flex flex-col items-center gap-4">
        {/* Mode indicator */}
        <div className="flex items-center gap-2 text-sm font-medium">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              timer.mode === "work"
                ? "bg-primary/10 text-primary"
                : "bg-success/10 text-success",
            )}
          >
            {timer.mode === "work" ? (
              <Brain className="h-3.5 w-3.5" />
            ) : (
              <Coffee className="h-3.5 w-3.5" />
            )}
            {timer.mode === "work" ? "Focus" : "Break"}
          </span>
        </div>

        {/* Circular progress */}
        <div className="relative flex items-center justify-center">
          <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="6"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={timer.mode === "work" ? "hsl(var(--primary))" : "hsl(var(--success))"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              strokeDashoffset={2 * Math.PI * 52 * (1 - timer.progress / 100)}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-bold tabular-nums text-foreground tracking-tight">
              {timer.display}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={timer.reset}
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-all",
              timer.running
                ? "bg-destructive hover:bg-destructive/90"
                : timer.mode === "work"
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-success hover:bg-success/90",
            )}
            onClick={timer.toggleRunning}
          >
            {timer.running ? (
              <Pause className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white ml-0.5" />
            )}
          </Button>
          <div className="h-10 w-10" /> {/* spacer for symmetry */}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="w-full rounded-lg border border-border bg-muted/30 p-3 mt-1 space-y-3 animate-in slide-in-from-top-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Presets
            </p>
            <div className="flex gap-2">
              {PRESET_DURATIONS.map((p) => (
                <Button
                  key={p.label}
                  variant={timer.workDuration === p.work ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => timer.setPreset(p.work, p.break)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
