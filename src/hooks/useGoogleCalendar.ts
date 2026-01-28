import { useState, useEffect } from "react";
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

export type GoogleCalendarQueryOptions = {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
};

export function useGoogleCalendar(options: GoogleCalendarQueryOptions = {}) {
  const { user, disconnectGoogleCalendar } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

        const response = await fetch(
          `${backendUrl}/api/calendar/events?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            disconnectGoogleCalendar();
            throw new Error("Google Calendar not connected");
          }
          throw new Error("Failed to fetch calendar events");
        }

        const data = await response.json();
        setEvents(data.items || []);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user, options.timeMin, options.timeMax, options.maxResults]);

  return { events, loading, error };
}
