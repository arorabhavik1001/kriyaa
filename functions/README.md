# Kriyaa Firebase Functions

This folder contains Firebase Cloud Functions for the Kriyaa app.

## Features

1. **Birthday Emails** (scheduled cron job) - Sends birthday emails daily at 9 AM IST
2. **Google Calendar OAuth** - HTTP endpoints for Google OAuth flow
3. **Calendar Events API** - Read and create Google Calendar events

## Environment Variables

Set these in Firebase Functions config or `.env`:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-project.cloudfunctions.net/authGoogleCallback
JWT_SECRET=your-jwt-secret
FRONTEND_URL=https://your-frontend.com
```

## Endpoints

| Function | Method | Description |
|----------|--------|-------------|
| `health` | GET | Health check |
| `authGoogleUrl` | POST | Create OAuth URL for connecting calendar |
| `authLogin` | GET | Create OAuth URL for login |
| `authGoogleCallback` | GET | OAuth callback handler |
| `calendarEvents` | GET | Get calendar events |
| `calendarCreateEvent` | POST | Create a new calendar event |
| `calendarAccessToken` | GET | Mint access token |
| `calendarStatus` | GET | Check if calendar is connected |
| `dailyBirthdayEmails` | (scheduled) | Send birthday emails |

## Deployment

```bash
cd functions
npm install
firebase deploy --only functions
```

## Local Testing

```bash
npm run serve
```
