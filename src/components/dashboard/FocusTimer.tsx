import { useState, useRef, useEffect, useCallback } from "react";
import { Timer, Play, Pause, RotateCcw, Coffee, Brain, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TimerMode = "work" | "break";

const DEFAULT_WORK = 25 * 60; // 25 min
const DEFAULT_BREAK = 5 * 60; // 5 min

export function FocusTimer() {
  const [workDuration, setWorkDuration] = useState(DEFAULT_WORK);
  const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK);
  const [mode, setMode] = useState<TimerMode>("work");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_WORK);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!running) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setRunning(false);

          if (mode === "work") {
            setSessions((s) => s + 1);
            toast.success("Focus session complete! 🎉", {
              description: "Time for a break.",
            });
            setMode("break");
            setSecondsLeft(breakDuration);
          } else {
            toast.success("Break over!", {
              description: "Ready for another focus session?",
            });
            setMode("work");
            setSecondsLeft(workDuration);
          }

          // Try notification
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(
              mode === "work" ? "Focus session done!" : "Break over!",
              { body: mode === "work" ? "Take a short break." : "Let's get back to work." },
            );
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, mode, workDuration, breakDuration, clearTimer]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const toggleRunning = () => setRunning((r) => !r);

  const reset = () => {
    clearTimer();
    setRunning(false);
    setMode("work");
    setSecondsLeft(workDuration);
  };

  const totalDuration = mode === "work" ? workDuration : breakDuration;
  const progress = ((totalDuration - secondsLeft) / totalDuration) * 100;

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const PRESET_DURATIONS = [
    { label: "15 min", work: 15 * 60, break: 3 * 60 },
    { label: "25 min", work: 25 * 60, break: 5 * 60 },
    { label: "50 min", work: 50 * 60, break: 10 * 60 },
  ];

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
            {sessions > 0 ? `${sessions} session${sessions > 1 ? "s" : ""} today` : "Stay focused, stay sharp"}
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
              mode === "work"
                ? "bg-primary/10 text-primary"
                : "bg-success/10 text-success",
            )}
          >
            {mode === "work" ? (
              <Brain className="h-3.5 w-3.5" />
            ) : (
              <Coffee className="h-3.5 w-3.5" />
            )}
            {mode === "work" ? "Focus" : "Break"}
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
              stroke={mode === "work" ? "hsl(var(--primary))" : "hsl(var(--success))"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              strokeDashoffset={2 * Math.PI * 52 * (1 - progress / 100)}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-bold tabular-nums text-foreground tracking-tight">
              {display}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={reset}
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-all",
              running
                ? "bg-destructive hover:bg-destructive/90"
                : mode === "work"
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-success hover:bg-success/90",
            )}
            onClick={toggleRunning}
          >
            {running ? (
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
                  variant={workDuration === p.work ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setWorkDuration(p.work);
                    setBreakDuration(p.break);
                    if (!running) {
                      setMode("work");
                      setSecondsLeft(p.work);
                    }
                  }}
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
