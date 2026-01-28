# Ekaagra backend

This backend handles Google OAuth (offline access) and stores per-user refresh tokens so Calendar calls never break when access tokens expire.

## Setup

1. Create `.env` from `.env.example`.
2. Provide Firebase Admin credentials (`FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`).
3. Start:

```bash
cd backend
npm i
npm run dev
```

## Endpoints

- `POST /auth/google/url` (Authorization: Bearer <firebase id token>) → returns `{ url }`
- `GET /auth/google/callback` → stores refresh token for user, redirects to `FRONTEND_URL`
- `GET /api/calendar/events` (Authorization: Bearer <firebase id token>) → proxies Google Calendar events list
