# Quantum AI Chatbot

Premium mobile-first AI chatbot with **Supabase Auth**, **conversation history**, and **granular Connectors** (Gmail first).

## Features

- Smooth mobile-first UI (dark/light)
- Supabase email/password auth
- Persistent chat history per user
- **Connectors**: connect Gmail alone (Drive & Sheets coming next)
- AI can search connected Gmail via tool calling
- Secure Anthropic proxy (API key never in the browser)

## Setup

### 1. Supabase — Phase 1 tables

Run the conversations/messages SQL from the earlier setup (or see git history).

### 2. Supabase — Connectors table

**SQL Editor → New query → run** `supabase/connectors.sql`.

This grants authenticated users access only to connector metadata. Access and refresh tokens remain readable by the server-side service role only.

### 3. Supabase — OAuth security migration

**SQL Editor → New query → run** `supabase/oauth-security.sql` for existing projects before deploying the OAuth callback changes. It creates the server-only, expiring one-time OAuth state store and applies the connector token column grants. Apply it after `connectors.sql` if setting up a new project.

### 4. Google Cloud OAuth (for Gmail connector)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. **APIs & Services → Enable APIs**: Gmail API
4. **OAuth consent screen** → External → add the required Gmail and userinfo scopes for the connectors you enable
5. **Credentials → Create OAuth client ID** → Web application
6. Authorized redirect URIs:
   - `https://YOUR-APP.vercel.app/api/connectors/google-callback`
   - `http://localhost:5173/api/connectors/google-callback` (local development only)
7. Copy **Client ID** and **Client Secret**

### 5. Environment variables

**Vercel → Project → Settings → Environment Variables:**

| Name | Where |
|------|--------|
| `VITE_SUPABASE_URL` | Client + server |
| `VITE_SUPABASE_ANON_KEY` | Client |
| `ANTHROPIC_API_KEY` | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (Supabase → Settings → API) |
| `GOOGLE_CLIENT_ID` | Server |
| `GOOGLE_CLIENT_SECRET` | Server |
| `MICROSOFT_CLIENT_ID` | Server, when Microsoft connectors are enabled |
| `MICROSOFT_CLIENT_SECRET` | Server, when Microsoft connectors are enabled |
| `APP_URL` | Server, e.g. `https://quantumy-xi.vercel.app` |

Redeploy after adding env vars.

### 6. Run locally

```bash
npm install
npm test
npm run build
npm run dev
```

Note: OAuth callback and tool APIs need the Vercel deployment (or a local serverless adapter). Connectors use browser-bound state cookies; local HTTP is supported only for localhost.

## How Connectors work

1. Settings → **Connectors** → **Connect** on Gmail
2. User is sent to Google and only asked for the requested connector scopes
3. The server persists only a SHA-256 digest of a random, expiring OAuth state token, bound to an HttpOnly SameSite=Lax cookie and the initiating user/provider
4. The callback validates and atomically consumes the state before exchanging the authorization code
5. Tokens are stored in `connectors` and accessed by server-side routes using the service role
6. **Disconnect** removes the row and access

Drive / Sheets buttons are visible but marked **Soon** — same pattern when you enable them.

## Security

- Anthropic and Google/Microsoft client secrets stay on the server
- The service role is only used in API routes
- Authenticated clients can SELECT only non-token connector columns; token columns are server-only after the SQL migrations are applied
- OAuth state is random, short-lived, provider-bound, browser-bound and one-time
- Each connector is opt-in with minimal scopes
