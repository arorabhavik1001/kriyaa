import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  calendarConnected: boolean;
  connectGoogleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [calendarConnected, setCalendarConnected] = useState<boolean>(
    localStorage.getItem("google_calendar_connected") === "true",
  );
  const [loading, setLoading] = useState(true);

  const calendarRefreshTimerRef = useRef<number | null>(null);

  const clearCalendarRefreshTimer = () => {
    if (calendarRefreshTimerRef.current != null) {
      window.clearTimeout(calendarRefreshTimerRef.current);
      calendarRefreshTimerRef.current = null;
    }
  };

  // Warm up Render backend (helps reduce cold-start latency).
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://kriyaa.onrender.com";
    fetch(`${backendUrl}/health`, { cache: "no-store" }).catch(() => {
      // Ignore warmup failures; app will still function if backend is down.
    });
  }, []);

  // Proactively mint/refresh Google access token ~2 minutes before expiry.
  // This avoids adding latency during normal calendar fetches.
  useEffect(() => {
    const REFRESH_SKEW_MS = 2 * 60 * 1000;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://kriyaa.onrender.com";

    // Shared cache used by useGoogleCalendar (in-memory only).
    const accessTokenCache: Map<string, { token: string; expiryDate?: number | null }> =
      (globalThis as any).__kriyaaAccessTokenCache ||
      ((globalThis as any).__kriyaaAccessTokenCache = new Map());

    // Deduplicate concurrent mint requests across the whole app.
    const inFlight: Map<string, Promise<{ token: string; expiresAt: number | null } | null>> =
      (globalThis as any).__kriyaaAccessTokenInFlight ||
      ((globalThis as any).__kriyaaAccessTokenInFlight = new Map());

    let cancelled = false;

    const storageKey = (uid: string) => `kriyaa_google_access_token:${uid}`;

    const readStoredToken = (uid: string): { token: string; expiresAt: number | null } | null => {
      try {
        const raw = localStorage.getItem(storageKey(uid));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { token?: string; expiresAt?: number | null; expiryDate?: number | null };
        const token = typeof parsed.token === "string" ? parsed.token : null;
        const expiresAt =
          (typeof parsed.expiresAt === "number" ? parsed.expiresAt : null) ??
          (typeof parsed.expiryDate === "number" ? parsed.expiryDate : null);
        if (!token) return null;
        return { token, expiresAt };
      } catch {
        return null;
      }
    };

    const writeStoredToken = (uid: string, token: string, expiresAt: number | null) => {
      try {
        localStorage.setItem(storageKey(uid), JSON.stringify({ token, expiresAt }));
      } catch {
        // Ignore storage failures (e.g. privacy mode)
      }
    };

    const scheduleNext = (currentUser: User, expiresAt: number) => {
      clearCalendarRefreshTimer();
      const delay = Math.max(0, expiresAt - Date.now() - REFRESH_SKEW_MS);
      calendarRefreshTimerRef.current = window.setTimeout(() => {
        void mintAndSchedule(currentUser);
      }, delay);
    };

    const mintAndSchedule = async (currentUser: User) => {
      if (cancelled) return;

      // If we already have a fresh token in local storage, reuse it
      // and avoid the backend roundtrip on app reload.
      const fromStorage = readStoredToken(currentUser.uid);
      if (fromStorage?.token) {
        const now = Date.now();
        const expiresAt = typeof fromStorage.expiresAt === "number" ? fromStorage.expiresAt : null;
        const isFresh = expiresAt === null || now < expiresAt - REFRESH_SKEW_MS;
        if (isFresh) {
          accessTokenCache.set(currentUser.uid, { token: fromStorage.token, expiryDate: expiresAt });
          if (typeof expiresAt === "number") scheduleNext(currentUser, expiresAt);
          return;
        }
      }

      const existing = inFlight.get(currentUser.uid);
      const promise =
        existing ||
        (async () => {
          try {
            const idToken = await currentUser.getIdToken();
            const resp = await fetch(`${backendUrl}/api/calendar/access-token`, {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            });

            if (!resp.ok) {
              // 401 => not connected. Other failures => backend down.
              if (resp.status === 401) {
                setCalendarConnected(false);
                localStorage.removeItem("google_calendar_connected");
              }
              return null;
            }

            const data = (await resp.json()) as {
              accessToken?: string;
              expiresAt?: number | null;
              expiryDate?: number | null;
            };
            const accessToken = data.accessToken;
            const expiresAt =
              (typeof data.expiresAt === "number" ? data.expiresAt : null) ??
              (typeof data.expiryDate === "number" ? data.expiryDate : null);

            if (!accessToken) return null;
            return { token: accessToken, expiresAt };
          } catch {
            return null;
          }
        })();

      if (!existing) {
        inFlight.set(
          currentUser.uid,
          promise.finally(() => {
            inFlight.delete(currentUser.uid);
          }),
        );
      }

      const minted = await (existing || inFlight.get(currentUser.uid)!);
      if (!minted) {
        clearCalendarRefreshTimer();
        return;
      }

      // Mark as connected if mint succeeded.
      setCalendarConnected(true);
      localStorage.setItem("google_calendar_connected", "true");

      accessTokenCache.set(currentUser.uid, { token: minted.token, expiryDate: minted.expiresAt });
      writeStoredToken(currentUser.uid, minted.token, minted.expiresAt);
      if (typeof minted.expiresAt === "number") scheduleNext(currentUser, minted.expiresAt);
      return;
    };

    if (!user || !calendarConnected) {
      clearCalendarRefreshTimer();
      return () => {
        cancelled = true;
      };
    }

    void mintAndSchedule(user);

    return () => {
      cancelled = true;
      clearCalendarRefreshTimer();
    };
  }, [user, calendarConnected]);

  const refreshCalendarStatus = async (currentUser: User) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://kriyaa.onrender.com";
      // const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
      const idToken = await currentUser.getIdToken();
      const resp = await fetch(`${backendUrl}/api/calendar/status`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!resp.ok) {
        setCalendarConnected(false);
        localStorage.removeItem("google_calendar_connected");
        return;
      }

      const data = (await resp.json()) as { connected?: boolean };
      const connected = !!data.connected;
      setCalendarConnected(connected);
      localStorage.setItem("google_calendar_connected", String(connected));
    } catch (e) {
      // If backend is down, don't force-disconnect; just keep current state.
      console.error("Failed to refresh calendar status", e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setCalendarConnected(false);
        localStorage.removeItem("google_calendar_connected");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://kriyaa.onrender.com";
      // const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
      const resp = await fetch(`${backendUrl}/auth/login`);
      if (!resp.ok) throw new Error("Failed to get login url");
      const { url } = await resp.json();
      window.location.href = url;
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const disconnectGoogleCalendar = () => {
    setCalendarConnected(false);
    localStorage.removeItem("google_calendar_connected");

    // Clear any cached tokens/timers so we stop calling Google.
    clearCalendarRefreshTimer();
    const uid = auth.currentUser?.uid;
    const accessTokenCache: Map<string, { token: string; expiryDate?: number | null }> =
      (globalThis as any).__kriyaaAccessTokenCache || new Map();
    const inFlight: Map<string, Promise<any>> = (globalThis as any).__kriyaaAccessTokenInFlight || new Map();
    if (uid) {
      accessTokenCache.delete(uid);
      inFlight.delete(uid);
      try {
        localStorage.removeItem(`kriyaa_google_access_token:${uid}`);
      } catch {
        // ignore
      }
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const idToken = await currentUser.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://kriyaa.onrender.com";
      // const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

      const resp = await fetch(`${backendUrl}/auth/google/url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        throw new Error("Failed to start Google Calendar connection");
      }

      const data = (await resp.json()) as { url?: string };
      if (!data.url) throw new Error("Missing auth url");

      // Must be a user-initiated navigation to avoid popup blockers.
      window.location.assign(data.url);
    } catch (error) {
      console.error("Error connecting Google Calendar", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      disconnectGoogleCalendar();
      clearCalendarRefreshTimer();
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, calendarConnected, signInWithGoogle, connectGoogleCalendar, disconnectGoogleCalendar, logout }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
