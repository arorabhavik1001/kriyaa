import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";

type TimerMode = "work" | "break";

const DEFAULT_WORK = 25 * 60;
const DEFAULT_BREAK = 5 * 60;

interface FocusTimerState {
  mode: TimerMode;
  secondsLeft: number;
  running: boolean;
  sessions: number;
  workDuration: number;
  breakDuration: number;
  totalDuration: number;
  progress: number;
  display: string;
  toggleRunning: () => void;
  reset: () => void;
  setPreset: (work: number, brk: number) => void;
}

const FocusTimerContext = createContext<FocusTimerState | null>(null);

export function useFocusTimer() {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error("useFocusTimer must be used within FocusTimerProvider");
  return ctx;
}

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const [workDuration, setWorkDuration] = useState(DEFAULT_WORK);
  const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK);
  const [mode, setMode] = useState<TimerMode>("work");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_WORK);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
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

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const toggleRunning = useCallback(() => setRunning((r) => !r), []);

  const reset = useCallback(() => {
    clearTimer();
    setRunning(false);
    setMode("work");
    setSecondsLeft(workDuration);
  }, [clearTimer, workDuration]);

  const setPreset = useCallback(
    (work: number, brk: number) => {
      setWorkDuration(work);
      setBreakDuration(brk);
      if (!running) {
        setMode("work");
        setSecondsLeft(work);
      }
    },
    [running],
  );

  const totalDuration = mode === "work" ? workDuration : breakDuration;
  const progress = ((totalDuration - secondsLeft) / totalDuration) * 100;
  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <FocusTimerContext.Provider
      value={{
        mode,
        secondsLeft,
        running,
        sessions,
        workDuration,
        breakDuration,
        totalDuration,
        progress,
        display,
        toggleRunning,
        reset,
        setPreset,
      }}
    >
      {children}
    </FocusTimerContext.Provider>
  );
}
