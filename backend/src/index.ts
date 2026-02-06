import "dotenv/config";
import express from "express";
import cors from "cors";
import { google } from "googleapis";

import { makeOAuthClient, CALENDAR_SCOPES } from "./googleOAuth.js";
import { signState, verifyFirebaseIdToken, verifyState } from "./auth.js";
import { getRefreshToken, upsertRefreshToken } from "./tokenStore.js";
import { adminAuth } from "./firebaseAdmin.js";

const app = express();

const port = Number(process.env.PORT || 4000);
const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:8080";

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

type CacheEntry<T> = { value: T; ts: number };

const EVENTS_CACHE_TTL_MS = Number(process.env.EVENTS_CACHE_TTL_MS || 20_000);
const eventsCache = new Map<string, CacheEntry<any>>();

app.get("/debug/config", (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "";
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || "";

  let redirectHost = "";
  try {
    redirectHost = googleRedirectUri ? new URL(googleRedirectUri).host : "";
  } catch {
    redirectHost = "(invalid)";
  }

  return res.json({
    ok: true,
    env: {
      nodeEnv: process.env.NODE_ENV || "",
      port: process.env.PORT || "",
      frontendUrl,
      corsOrigin,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      googleRedirectUri,
      googleRedirectHost: redirectHost,
      hasFirebaseServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      hasFirebaseServiceAccountB64: !!process.env.FIREBASE_SERVICE_ACCOUNT_B64,
      hasFirebaseServiceAccountPath: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    },
  });
});

function mkReqId() {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

app.use((req, res, next) => {
  const reqId = mkReqId();
  (req as any).reqId = reqId;
  const start = Date.now();

  console.log(`[${reqId}] -> ${req.method} ${req.originalUrl}`);
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[${reqId}] <- ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });

  next();
});

function log(req: express.Request, message: string, extra?: Record<string, unknown>) {
  const reqId = (req as any).reqId || "-";
  const payload = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[${reqId}] ${message}${payload}`);
}

function requireAuthHeader(req: express.Request) {
  const h = req.header("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1];
}

function cacheKeyForEvents(uid: string, req: express.Request) {
  const timeMin = typeof req.query.timeMin === "string" ? req.query.timeMin : "";
  const timeMax = typeof req.query.timeMax === "string" ? req.query.timeMax : "";
  const maxResults = typeof req.query.maxResults === "string" ? req.query.maxResults : "";
  return `${uid}|${timeMin}|${timeMax}|${maxResults}`;
}

// Create an OAuth URL for the currently logged-in Firebase user
app.post("/auth/google/url", async (req, res) => {
  try {
    const idToken = requireAuthHeader(req);
    if (!idToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const decoded = await verifyFirebaseIdToken(idToken);
    log(req, "connect: creating OAuth URL", { uid: decoded.uid });
    const state = signState({ uid: decoded.uid, mode: "connect" });

    const oauth2 = makeOAuthClient();
    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: CALENDAR_SCOPES,
      include_granted_scopes: true,
      state,
    });

    return res.json({ url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to create auth url" });
  }
});

// Create an OAuth URL for logging in (no existing session)
app.get("/auth/login", (req, res) => {
  try {
    log(req, "login: creating OAuth URL");
    const state = signState({ mode: "login" });
    const oauth2 = makeOAuthClient();
    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [...CALENDAR_SCOPES, "openid", "email", "profile"],
      include_granted_scopes: true,
      state,
    });
    return res.json({ url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to create login url" });
  }
});

// OAuth callback stores refresh token in Firestore for the user
app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const stateToken = String(req.query.state || "");
    if (!code || !stateToken) return res.status(400).send("Missing code/state");

    const { uid, mode } = verifyState(stateToken);
    log(req, "oauth callback: received", { mode: mode ?? "(none)", hasUid: !!uid });

    const oauth2 = makeOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    log(req, "oauth callback: token exchange done", {
      hasRefreshTokenFromGoogle: !!tokens.refresh_token,
      hasAccessTokenFromGoogle: !!tokens.access_token,
    });

    let targetUid = uid;

    // If logging in, we need to find/create the user from Google profile
    if (mode === "login") {
      oauth2.setCredentials(tokens);
      const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
      const userInfo = await oauth2Api.userinfo.get();
      const email = userInfo.data.email;

      if (!email) throw new Error("No email found in Google profile");

      try {
        const user = await adminAuth.getUserByEmail(email);
        targetUid = user.uid;
        log(req, "login: resolved user", { uid: targetUid, email });
      } catch (e: any) {
        if (e.code === "auth/user-not-found") {
          const user = await adminAuth.createUser({
            email,
            displayName: userInfo.data.name ?? undefined,
            photoURL: userInfo.data.picture ?? undefined,
            emailVerified: true,
          });
          targetUid = user.uid;
          log(req, "login: created user", { uid: targetUid, email });
        } else {
          throw e;
        }
      }
    }

    if (!targetUid) return res.status(400).send("Invalid state: no user resolved");

    // Google only returns refresh_token on first consent (or when prompt=consent)
    // but users may have already connected previously.
    const existing = await getRefreshToken(targetUid);
    const refreshToken = tokens.refresh_token || existing;

    log(req, "oauth callback: refresh token resolution", {
      uid: targetUid,
      hasExistingRefreshToken: !!existing,
      usingRefreshTokenFromGoogle: !!tokens.refresh_token,
      willStore: !!refreshToken,
    });

    if (refreshToken) {
      await upsertRefreshToken(targetUid, {
        refreshToken,
        scope: tokens.scope ?? undefined,
        tokenType: tokens.token_type ?? undefined,
        updatedAt: Date.now(),
      });
      log(req, "oauth callback: refresh token stored", { uid: targetUid });
    } else if (mode === "connect") {
       // Only fail if we expected a refresh token during explicit connect
       // During login, maybe they just logged in without re-consenting offline access?
       // But we forced prompt=consent, so we SHOULD get it.
       return res.status(400).send("No refresh token received. Revoke access and try again.");
    }

    const redirectTo = process.env.FRONTEND_URL || "http://localhost:8080";
    console.log(redirectTo)
    
    if (mode === "login") {
      const customToken = await adminAuth.createCustomToken(targetUid);
      log(req, "login: issuing firebase custom token", { uid: targetUid });
      return res.redirect(`${redirectTo}/auth/callback?token=${customToken}`);
    } else {
      log(req, "connect: redirecting back to schedule", { uid: targetUid });
      return res.redirect(`${redirectTo}/schedule?calendar=connected`);
    }
  } catch (e) {
    const err = e as any;
    const reqId = (req as any).reqId || "-";
    const message = typeof err?.message === "string" ? err.message : String(err);
    const code = typeof err?.code === "string" ? err.code : undefined;
    const stack = typeof err?.stack === "string" ? err.stack : undefined;

    console.error(`[${reqId}] OAuth callback failed`, {
      message,
      code,
      path: req.originalUrl,
    });
    if (stack) console.error(stack);

    // Keep response minimal; the details are in logs.
    return res.status(500).send(`OAuth callback failed (reqId=${reqId})`);
  }
});

// Proxy Calendar events list; refreshes access tokens automatically via refresh_token
app.get("/api/calendar/events", async (req, res) => {
  try {
    const idToken = requireAuthHeader(req);
    if (!idToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const decoded = await verifyFirebaseIdToken(idToken);
    const uid = decoded.uid;

    log(req, "calendar: events requested", {
      uid,
      timeMin: typeof req.query.timeMin === "string" ? req.query.timeMin : undefined,
      timeMax: typeof req.query.timeMax === "string" ? req.query.timeMax : undefined,
      maxResults: typeof req.query.maxResults === "string" ? req.query.maxResults : undefined,
    });

    const refreshToken = await getRefreshToken(uid);
    if (!refreshToken) {
      log(req, "calendar: no refresh token on file", { uid });
      return res.status(401).json({ error: "Google Calendar not connected" });
    }

    // Short TTL cache to avoid repeated round-trips when UI triggers multiple requests.
    const cacheKey = cacheKeyForEvents(uid, req);
    const cached = eventsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < EVENTS_CACHE_TTL_MS) {
      res.setHeader("X-Cache", "HIT");
      log(req, "calendar: events cache hit", { uid });
      return res.json(cached.value);
    }

    const oauth2 = makeOAuthClient();
    oauth2.setCredentials({ refresh_token: refreshToken });

    oauth2.on("tokens", (t) => {
      // Never log token values.
      if (t.access_token) console.log(`[calendar] access_token refreshed for uid=${uid}`);
      if (t.refresh_token) console.log(`[calendar] NEW refresh_token received for uid=${uid}`);
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const timeMin = typeof req.query.timeMin === "string" ? req.query.timeMin : new Date().toISOString();
    const timeMax = typeof req.query.timeMax === "string" ? req.query.timeMax : undefined;
    const maxResults = typeof req.query.maxResults === "string" ? Number(req.query.maxResults) : 10;

    const resp = await calendar.events.list({
      calendarId: "primary",
      singleEvents: true,
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: Number.isFinite(maxResults) ? maxResults : 10,
    });

    log(req, "calendar: events served", { uid, count: (resp.data.items ?? []).length });
    const payload = { items: resp.data.items ?? [] };
    res.setHeader("X-Cache", "MISS");
    eventsCache.set(cacheKey, { value: payload, ts: Date.now() });
    return res.json(payload);
  } catch (e: any) {
    console.error(e);
    // If refresh token was revoked, surface as disconnected
    const message = typeof e?.message === "string" ? e.message : "Calendar request failed";
    return res.status(500).json({ error: message });
  }
});

// Create a new calendar event
app.post("/api/calendar/events", async (req, res) => {
  try {
    const idToken = requireAuthHeader(req);
    if (!idToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const decoded = await verifyFirebaseIdToken(idToken);
    const uid = decoded.uid;

    const refreshToken = await getRefreshToken(uid);
    if (!refreshToken) {
      return res.status(401).json({ error: "Google Calendar not connected" });
    }

    const oauth2 = makeOAuthClient();
    oauth2.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const { summary, description, location, start, end, allDay } = req.body;

    if (!summary) {
      return res.status(400).json({ error: "Event summary (title) is required" });
    }

    let eventBody: any;
    if (allDay) {
      const startDate = start ? new Date(start).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
      const endDate = end ? new Date(end).toISOString().split("T")[0] : startDate;
      eventBody = {
        summary,
        description: description || undefined,
        location: location || undefined,
        start: { date: startDate },
        end: { date: endDate },
      };
    } else {
      const startDateTime = start ? new Date(start).toISOString() : new Date().toISOString();
      const endDateTime = end ? new Date(end).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString();
      eventBody = {
        summary,
        description: description || undefined,
        location: location || undefined,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
      };
    }

    const resp = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventBody,
    });

    // Clear cache for this user
    for (const key of eventsCache.keys()) {
      if (key.startsWith(`${uid}|`)) {
        eventsCache.delete(key);
      }
    }

    log(req, "calendar: event created", { uid, eventId: resp.data.id });
    return res.json({ event: resp.data });
  } catch (e: any) {
    console.error(e);
    const message = typeof e?.message === "string" ? e.message : "Failed to create event";
    return res.status(500).json({ error: message });
  }
});

// Mint a short-lived Google access token for the user (from stored refresh token)
// Use-case: frontend can call Google APIs directly for lower latency.
app.get("/api/calendar/access-token", async (req, res) => {
  try {
    const idToken = requireAuthHeader(req);
    if (!idToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const decoded = await verifyFirebaseIdToken(idToken);
    const uid = decoded.uid;

    const refreshToken = await getRefreshToken(uid);
    if (!refreshToken) return res.status(401).json({ error: "Google Calendar not connected" });

    const oauth2 = makeOAuthClient();
    oauth2.setCredentials({ refresh_token: refreshToken });

    const tokenResp = await oauth2.getAccessToken();
    const accessToken = typeof tokenResp === "string" ? tokenResp : tokenResp?.token;
    const expiryDate = oauth2.credentials.expiry_date;

    const expiresAt = typeof expiryDate === "number" ? expiryDate : null;

    if (!accessToken) return res.status(500).json({ error: "Failed to mint access token" });

    log(req, "calendar: minted access token", { uid, hasExpiry: !!expiryDate });
    // Return both keys for compatibility.
    return res.json({ accessToken, expiresAt, expiryDate: expiresAt });
  } catch (e: any) {
    console.error(e);
    const message = typeof e?.message === "string" ? e.message : "Failed to mint access token";
    return res.status(500).json({ error: message });
  }
});

// Check if Google Calendar is connected for this user
app.get("/api/calendar/status", async (req, res) => {
  try {
    const idToken = requireAuthHeader(req);
    if (!idToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const decoded = await verifyFirebaseIdToken(idToken);
    const refreshToken = await getRefreshToken(decoded.uid);
    log(req, "calendar: status checked", { uid: decoded.uid, connected: !!refreshToken });
    return res.json({ connected: !!refreshToken });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to check calendar status" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
