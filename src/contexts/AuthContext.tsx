import React, { createContext, useContext, useEffect, useState } from "react";
import { User, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

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

  const refreshCalendarStatus = async (currentUser: User) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
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
      } else {
        // After login (and after OAuth redirect back), confirm connection state from backend.
        void refreshCalendarStatus(currentUser);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
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
  };

  const connectGoogleCalendar = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const idToken = await currentUser.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

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
