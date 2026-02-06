import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink: string;
  attendees?: { email: string }[];
}

export interface CreateEventParams {
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
}

export type GoogleCalendarQueryOptions = {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
};

export function useGoogleCalendar(options: GoogleCalendarQueryOptions = {}) {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to direct Google fetch for lower latency.
  // Set VITE_CALENDAR_FETCH_MODE=proxy to force backend proxy.
  const mode = String(import.meta.env.VITE_CALENDAR_FETCH_MODE || "direct");
  const directMode = mode !== "proxy";

  // In-memory per-session cache for minted access tokens (never persisted).
  // Keyed by uid to avoid cross-user reuse.
  const accessTokenCache = (globalThis as any).__kriyaaAccessTokenCache ||
    ((globalThis as any).__kriyaaAccessTokenCache = new Map<string, { token: string; expiryDate?: number | null }>());

  // Deduplicate concurrent mint requests across the whole app.
  const inFlight: Map<string, Promise<{ token: string; expiresAt: number | null } | null>> =
    (globalThis as any).__kriyaaAccessTokenInFlight ||
    ((globalThis as any).__kriyaaAccessTokenInFlight = new Map());

  const REFRESH_SKEW_MS = 2 * 60 * 1000;

  const readStoredToken = (uid: string): { token: string; expiresAt: number | null } | null => {
    try {
      const raw = localStorage.getItem(`kriyaa_google_access_token:${uid}`);
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
      localStorage.setItem(`kriyaa_google_access_token:${uid}`, JSON.stringify({ token, expiresAt }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const abort = new AbortController();
    let retryCount = 0;
    const MAX_RETRIES = 2;

    const fetchEvents = async () => {
      if (!user) {
        setEvents([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("singleEvents", "true");
        params.set("orderBy", "startTime");
        params.set("timeMin", options.timeMin ?? new Date().toISOString());
        if (options.timeMax) params.set("timeMax", options.timeMax);
        params.set("maxResults", String(options.maxResults ?? 10));

        const idToken = await user.getIdToken();
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://kriyaa.onrender.com";

        const mintAccessToken = async () => {
          const fromStorage = readStoredToken(user.uid);
          if (fromStorage?.token) {
            const now = Date.now();
            const expiresAt = typeof fromStorage.expiresAt === "number" ? fromStorage.expiresAt : null;
            const isFresh = expiresAt === null || now < expiresAt - REFRESH_SKEW_MS;
            if (isFresh) {
              accessTokenCache.set(user.uid, { token: fromStorage.token, expiryDate: expiresAt });
              return fromStorage.token;
            }
          }

          const existing = inFlight.get(user.uid);
          const promise =
            existing ||
            (async () => {
              const resp = await fetch(`${backendUrl}/api/calendar/access-token`, {
                signal: abort.signal,
                headers: { Authorization: `Bearer ${idToken}` },
              });
              if (!resp.ok) {
                throw new Error(resp.status === 401 ? "Google Calendar session expired" : "Failed to mint access token");
              }
              const data = (await resp.json()) as {
                accessToken?: string;
                expiresAt?: number | null;
                expiryDate?: number | null;
              };
              if (!data.accessToken) throw new Error("Missing access token");
              const expiresAt =
                (typeof data.expiresAt === "number" ? data.expiresAt : null) ??
                (typeof data.expiryDate === "number" ? data.expiryDate : null);
              return { token: data.accessToken, expiresAt };
            })();

          if (!existing) {
            inFlight.set(
              user.uid,
              promise.finally(() => {
                inFlight.delete(user.uid);
              }),
            );
          }

          const minted = await (existing || inFlight.get(user.uid)!);
          if (!minted?.token) throw new Error("Missing access token");
          accessTokenCache.set(user.uid, { token: minted.token, expiryDate: minted.expiresAt });
          writeStoredToken(user.uid, minted.token, minted.expiresAt);
          return minted.token;
        };

        const fetchDirectFromGoogle = async (accessToken: string) => {
          const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
          const resp = await fetch(url, {
            signal: abort.signal,
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          return resp;
        };

        if (!directMode) {
          // Legacy mode: backend proxy
          const response = await fetch(`${backendUrl}/api/calendar/events?${params.toString()}`, {
            signal: abort.signal,
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(response.status === 401 ? "Google Calendar session expired" : "Failed to fetch calendar events");
          }

          const data = await response.json();
          setEvents(data.items || []);
          return;
        }

        // Direct mode: use access token from backend, call Google API directly.
        // If token is invalid/expired, mint a new one and retry once.
        const cached = accessTokenCache.get(user.uid);
        const now = Date.now();
        const expiresAt = typeof cached?.expiryDate === "number" ? cached.expiryDate : null;
        const isFresh = !!cached?.token && (expiresAt === null || now < expiresAt - REFRESH_SKEW_MS);

        let token = isFresh ? cached!.token : await mintAccessToken();

        let resp = await fetchDirectFromGoogle(token);

        // If token expired/revoked, mint and retry once.
        if (resp.status === 401 || resp.status === 403) {
          accessTokenCache.delete(user.uid);
          token = await mintAccessToken();
          resp = await fetchDirectFromGoogle(token);
        }

        if (!resp.ok) {
          // Retry logic for transient network errors
          if (retryCount < MAX_RETRIES && (resp.status >= 500 || resp.status === 0)) {
            retryCount++;
            console.log(`[calendar] Retrying fetch (${retryCount}/${MAX_RETRIES})...`);
            await new Promise((r) => setTimeout(r, 1000 * retryCount));
            return fetchEvents();
          }
          throw new Error("Failed to fetch calendar events");
        }

        const data = await resp.json();
        setEvents(data.items || []);
      } catch (err) {
        if (abort.signal.aborted) return;
        console.error(err);
        // Only set error for non-abort errors
        const message = err instanceof Error ? err.message : "An error occurred";
        // Retry for network errors
        if (retryCount < MAX_RETRIES && (message.includes("fetch") || message.includes("network"))) {
          retryCount++;
          console.log(`[calendar] Retrying after error (${retryCount}/${MAX_RETRIES})...`);
          await new Promise((r) => setTimeout(r, 1000 * retryCount));
          return fetchEvents();
        }
        setError(message);
      } finally {
        if (!abort.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchEvents();
    return () => abort.abort();
  }, [user, options.timeMin, options.timeMax, options.maxResults, directMode]);

  const createEvent = useCallback(async (params: CreateEventParams): Promise<CalendarEvent | null> => {
    if (!user) {
      throw new Error("Not authenticated");
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://kriyaa.onrender.com";
    const idToken = await user.getIdToken();

    const resp = await fetch(`${backendUrl}/api/calendar/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: params.start.toISOString(),
        end: params.end.toISOString(),
        allDay: params.allDay || false,
      }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || "Failed to create event");
    }

    const data = await resp.json();
    return data.event;
  }, [user]);

  const refetch = useCallback(() => {
    // Trigger a refetch by clearing cache
    if (user) {
      accessTokenCache.delete(user.uid);
    }
  }, [user]);

  return { events, loading, error, createEvent, refetch };
}
