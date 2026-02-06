const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const cors = require("cors");

// --------------------- ADMIN INIT ---------------------
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();
const adminAuth = getAuth();

// --------------------- CORS ---------------------
const corsHandler = cors({ origin: true, credentials: true });

// --------------------- EMAIL CONFIG ---------------------
const fromEmailParam = "no-reply@iskcongurugram.com";
const SMTP_USER = "radha.damodar.ms@gmail.com";
const SMTP_PASS = "umyv kzhu zzrv qkog";

// --------------------- NODEMAILER ---------------------
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// --------------------- BIRTHDAY HELPERS ---------------------
function extractMonthDay(dateString) {
  if (!dateString || dateString.length < 10) return "";
  return `${dateString.slice(5, 7)}-${dateString.slice(8, 10)}`;
}

async function getTodayBirthdays() {
  const today = new Date();
  const md =
    `${String(today.getMonth() + 1).padStart(2, "0")}-` +
    `${String(today.getDate()).padStart(2, "0")}`;

  const snap = await db.collection("users").get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => extractMonthDay(u.birthday || "") === md)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
    }));
}

async function sendBirthdayEmail(toEmail, toName) {
  const fromName = "ISKCON Gurugram";
  const fromEmail = process.env.FROM_EMAIL || fromEmailParam;

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: toEmail,
    subject: `Hare Krishna! Happy Birthday ${toName || ""}`.trim(),
    html: `
      <div style="font-family: Arial, sans-serif;">
        <p>Hare Krishna ${toName || ""},</p>
        <p>On behalf of ISKCON Gurugram, we wish you a very Happy Krishna Conscious Birthday!</p>
        <p>May Sri Sri Radha Damodar bless you with good fortune. Please visit <a href="https://iskcongurugram.com">ISKCON Gurugram</a> temple on this special occassion.</p>
        <p>For Temple Location: <a href="https://maps.app.goo.gl/RS8CxNGjtERUBmV67">click here</a></p>
        <p>Chant and be happy!</p>
        <p>With blessings,<br/>ISKCON Gurugram</p>
      </div>
    `,
  });
}

// --------------------- BIRTHDAY CRON JOB ---------------------
exports.dailyBirthdayEmails = onSchedule(
  {
    schedule: "0 9 * * *", // Every day at 9 AM IST
    timeZone: "Asia/Kolkata",
  },
  async () => {
    const birthdays = await getTodayBirthdays();

    if (!birthdays.length) {
      console.log("No birthdays today.");
      return;
    }

    const tasks = birthdays
      .filter((b) => b.email)
      .map((b) => sendBirthdayEmail(b.email, b.name));

    await Promise.allSettled(tasks);
    console.log(`Sent ${tasks.length} birthday emails.`);
  }
);

// --------------------- GOOGLE OAUTH HELPERS ---------------------
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

function makeOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI env vars");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function signState(state) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return jwt.sign(state, secret, { expiresIn: "1h" });
}

function verifyState(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const decoded = jwt.verify(token, secret, { clockTolerance: 60 });
  if (typeof decoded !== "object" || decoded === null) throw new Error("Invalid state");
  return { uid: decoded.uid, mode: decoded.mode };
}

async function verifyFirebaseIdToken(idToken) {
  return adminAuth.verifyIdToken(idToken);
}

function requireAuthHeader(req) {
  const h = req.header("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1];
}

// Token store
const tokenCollectionName = "googleTokens";

async function getRefreshToken(uid) {
  const snap = await db.collection(tokenCollectionName).doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data?.refreshToken) return null;
  return data.refreshToken;
}

async function upsertRefreshToken(uid, token) {
  await db.collection(tokenCollectionName).doc(uid).set(token, { merge: true });
}

// Cache for events (in-memory per function instance)
const EVENTS_CACHE_TTL_MS = Number(process.env.EVENTS_CACHE_TTL_MS || 20_000);
const eventsCache = new Map();

function cacheKeyForEvents(uid, query) {
  const timeMin = query.timeMin || "";
  const timeMax = query.timeMax || "";
  const maxResults = query.maxResults || "";
  return `${uid}|${timeMin}|${timeMax}|${maxResults}`;
}

// --------------------- KRIYAA CALENDAR HTTP ENDPOINTS ---------------------

// Health check
exports.health = onRequest((req, res) => {
  corsHandler(req, res, () => {
    res.json({ ok: true });
  });
});

// Create OAuth URL for connecting Google Calendar (POST /auth/google/url)
exports.authGoogleUrl = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const idToken = requireAuthHeader(req);
      if (!idToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });

      const decoded = await verifyFirebaseIdToken(idToken);
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
});

// Create OAuth URL for login (GET /auth/login)
exports.authLogin = onRequest((req, res) => {
  corsHandler(req, res, () => {
    try {
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
});

// OAuth callback (GET /auth/google/callback)
exports.authGoogleCallback = onRequest(async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const stateToken = String(req.query.state || "");
    if (!code || !stateToken) return res.status(400).send("Missing code/state");

    const { uid, mode } = verifyState(stateToken);

    const oauth2 = makeOAuthClient();
    const { tokens } = await oauth2.getToken(code);

    let targetUid = uid;

    if (mode === "login") {
      oauth2.setCredentials(tokens);
      const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
      const userInfo = await oauth2Api.userinfo.get();
      const email = userInfo.data.email;

      if (!email) throw new Error("No email found in Google profile");

      try {
        const user = await adminAuth.getUserByEmail(email);
        targetUid = user.uid;
      } catch (e) {
        if (e.code === "auth/user-not-found") {
          const user = await adminAuth.createUser({
            email,
            displayName: userInfo.data.name ?? undefined,
            photoURL: userInfo.data.picture ?? undefined,
            emailVerified: true,
          });
          targetUid = user.uid;
        } else {
          throw e;
        }
      }
    }

    if (!targetUid) return res.status(400).send("Invalid state: no user resolved");

    const existing = await getRefreshToken(targetUid);
    const refreshToken = tokens.refresh_token || existing;

    if (refreshToken) {
      await upsertRefreshToken(targetUid, {
        refreshToken,
        scope: tokens.scope ?? undefined,
        tokenType: tokens.token_type ?? undefined,
        updatedAt: Date.now(),
      });
    } else if (mode === "connect") {
      return res.status(400).send("No refresh token received. Revoke access and try again.");
    }

    const redirectTo = process.env.FRONTEND_URL || "http://localhost:8080";

    if (mode === "login") {
      const customToken = await adminAuth.createCustomToken(targetUid);
      return res.redirect(`${redirectTo}/auth/callback?token=${customToken}`);
    } else {
      return res.redirect(`${redirectTo}/schedule?calendar=connected`);
    }
  } catch (e) {
    console.error("OAuth callback failed", e);
    return res.status(500).send("OAuth callback failed");
  }
});

// Get calendar events (GET /api/calendar/events)
exports.calendarEvents = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const idToken = requireAuthHeader(req);
      if (!idToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });

      const decoded = await verifyFirebaseIdToken(idToken);
      const uid = decoded.uid;

      const refreshToken = await getRefreshToken(uid);
      if (!refreshToken) {
        return res.status(401).json({ error: "Google Calendar not connected" });
      }

      const cacheKey = cacheKeyForEvents(uid, req.query);
      const cached = eventsCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < EVENTS_CACHE_TTL_MS) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached.value);
      }

      const oauth2 = makeOAuthClient();
      oauth2.setCredentials({ refresh_token: refreshToken });

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

      const payload = { items: resp.data.items ?? [] };
      res.setHeader("X-Cache", "MISS");
      eventsCache.set(cacheKey, { value: payload, ts: Date.now() });
      return res.json(payload);
    } catch (e) {
      console.error(e);
      const message = typeof e?.message === "string" ? e.message : "Calendar request failed";
      return res.status(500).json({ error: message });
    }
  });
});

// Create calendar event (POST /api/calendar/events)
exports.calendarCreateEvent = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

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

      let eventBody;
      if (allDay) {
        // All day event - use date format
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
        // Timed event
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

      return res.json({ event: resp.data });
    } catch (e) {
      console.error(e);
      const message = typeof e?.message === "string" ? e.message : "Failed to create event";
      return res.status(500).json({ error: message });
    }
  });
});

// Mint access token (GET /api/calendar/access-token)
exports.calendarAccessToken = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
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

      if (!accessToken) return res.status(500).json({ error: "Failed to mint access token" });

      return res.json({ accessToken, expiresAt: expiryDate, expiryDate });
    } catch (e) {
      console.error(e);
      const message = typeof e?.message === "string" ? e.message : "Failed to mint access token";
      return res.status(500).json({ error: message });
    }
  });
});

// Check calendar status (GET /api/calendar/status)
exports.calendarStatus = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const idToken = requireAuthHeader(req);
      if (!idToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });

      const decoded = await verifyFirebaseIdToken(idToken);
      const refreshToken = await getRefreshToken(decoded.uid);
      return res.json({ connected: !!refreshToken });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to check calendar status" });
    }
  });
});
