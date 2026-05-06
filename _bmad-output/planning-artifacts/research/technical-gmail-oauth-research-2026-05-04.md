---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - https://developers.google.com/gmail/api/auth/scopes
  - https://developers.google.com/gmail/api/guides/sync
  - https://developers.google.com/gmail/api/guides/push
  - https://developers.google.com/gmail/api/quickstart/nodejs
  - https://developers.google.com/identity/protocols/oauth2/web-server
  - https://developers.google.com/gmail/api/auth/web-server
  - https://supabase.com/docs/guides/database/vault
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'Gmail OAuth + API Integration for Flow OS'
research_goals: 'Research Gmail OAuth 2.0 scopes, token management, incremental sync, Pub/Sub push notifications, googleapis npm package patterns, Supabase Auth coexistence, and token encryption at rest'
date: '2026-05-04'
web_research_enabled: true
source_verification: true
---

# Technical Research: Gmail OAuth + API Integration for Flow OS

**Date:** 2026-05-04
**Research Type:** Technical
**Status:** Complete

---

## Table of Contents

1. [Google OAuth 2.0 Scopes for Gmail](#1-google-oauth-20-scopes-for-gmail)
2. [Gmail API v1 — Token Management & Sync](#2-gmail-api-v1--token-management--sync)
3. [googleapis npm Package — Code Patterns](#3-googleapis-npm-package--code-patterns)
4. [Supabase Auth Coexistence (No NextAuth)](#4-supabase-auth-coexistence-no-nextauth)
5. [Token Encryption at Rest](#5-token-encryption-at-rest)
6. [Gmail Pub/Sub Push Notifications Setup](#6-gmail-pubsub-push-notifications-setup)
7. [Key Considerations & Risks](#7-key-considerations--risks)

---

## 1. Google OAuth 2.0 Scopes for Gmail

### Recommended Scopes for Read-Only Email Access

For the Flow OS email agent (read-only access to process incoming emails), the primary scope is:

| Scope | Sensitivity | Description |
|-------|------------|-------------|
| `https://www.googleapis.com/auth/gmail.readonly` | **Restricted** | View email messages and settings. Full read access to all messages, labels, and settings. |
| `https://www.googleapis.com/auth/gmail.metadata` | **Restricted** | View email metadata (labels, headers) but NOT the email body. Useful for lightweight sync. |
| `https://www.googleapis.com/auth/userinfo.email` | Sensitive | View user's email address. Used to identify which Gmail account was authorized. |
| `https://www.googleapis.com/auth/userinfo.profile` | Sensitive | View user's basic profile info. |

**Recommended minimal set for Flow OS:**

```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/userinfo.email
```

The `gmail.readonly` scope is classified as **Restricted** by Google, meaning:
- Requires OAuth App Verification
- Requires a security assessment if you store restricted scope data on servers (which we do)
- Must comply with [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

### Scope for Metadata-Only Access

If the agent only needs headers/labels (e.g., for triage before full body fetch):

```
https://www.googleapis.com/auth/gmail.metadata
```

**Limitation:** This scope does NOT allow fetching message bodies. You cannot call `messages.get` with `format=FULL` or `format=RAW`. Only `format=MINIMAL` and `format=METADATA` work.

### Domain-Wide Delegation (Service Account)

For Google Workspace customers where the admin pre-authorizes the app:

- Uses a **Service Account** with domain-wide delegation
- No individual user consent required — admin grants access at the org level
- Requires `gmail.settings.sharing` scope (admin-only operations)
- The service account impersonates users via `subject` parameter
- **Not recommended for Flow OS initially** — individual OAuth is simpler and works for all Gmail users (not just Workspace)

### Incremental Authorization

Google supports incremental authorization via `include_granted_scopes=true`. This lets you:
1. Start with `gmail.readonly` + `userinfo.email`
2. Later request `gmail.modify` or `gmail.compose` without re-prompting for existing scopes
3. The new access token covers both old and new scopes

---

## 2. Gmail API v1 — Token Management & Sync

### Current State

Gmail API v1 is the current and only version. It is stable and actively maintained (last docs update: April 2026). There is no v2 announced.

### OAuth Token Management

#### Token Lifecycle

| Token Type | Lifetime | Storage |
|-----------|----------|---------|
| **Authorization Code** | One-time use, ~10 min | Never stored — exchanged immediately |
| **Access Token** | ~1 hour (3600s typical) | In-memory / short-lived cache |
| **Refresh Token** | Indefinite (until revoked) | Encrypted in database |

#### Key Token Management Rules

1. **`access_type=offline`** is required to get a refresh token. Set this in the initial authorization URL.
2. **Refresh token is only returned on the first authorization.** If the user re-authorizes, you may not get a new refresh token unless you set `prompt=consent`.
3. **Always store the refresh token.** If lost, the user must re-do the entire OAuth flow.
4. **Access tokens auto-refresh.** The `googleapis` library handles this automatically when you call `oauth2Client.setCredentials(tokens)` — it uses the refresh token to get a new access token when the current one expires.
5. **Token revocation.** Users can revoke at myaccount.google.com. Your app must handle `401` responses gracefully and re-prompt for authorization.

#### Token Refresh Flow

```
Access token expires
  → googleapis library auto-detects expiry
  → Calls https://oauth2.googleapis.com/token with grant_type=refresh_token
  → Gets new access token
  → Retries the original API call
```

### Email Sync Strategies

#### Full Sync (Initial Connection)

1. Call `messages.list` to get first page of message IDs
2. Create batch `messages.get` requests for each ID
3. Use `format=FULL` or `format=RAW` for first fetch, cache results
4. Store the `historyId` of the most recent message for future partial sync

**Recommendation for Flow OS:** Only fetch the most recent N messages (e.g., last 50) during initial sync. Don't backfill the entire mailbox.

#### Partial Sync (Incremental via History API)

After initial sync, use `history.list` with `startHistoryId` to get changes:

```
GET /gmail/v1/users/me/history?startHistoryId={lastKnownHistoryId}
```

Returns `History` objects containing:
- `messagesAdded` — new messages
- `messagesDeleted` — removed messages
- `labelsAdded` / `labelsRemoved` — label changes

**Critical limitation:** History records are typically available for **at least one week**, but may be shorter. If `startHistoryId` is too old, the API returns **HTTP 404** → you must fall back to full sync.

#### Recommended Sync Strategy for Flow OS

```
1. Initial: Full sync (last 50 messages) → store historyId
2. Ongoing: Pub/Sub push notification → triggers partial sync via history.list
3. Fallback: If history 404 → re-do full sync
4. Watchdog: Daily `watch()` renewal (expires every 7 days)
```

### Rate Limits

- Gmail API: **250 quota units per user per second**
- `messages.list`: 5 quota units
- `messages.get` (FULL): 5 quota units
- `messages.get` (MINIMAL): 1 quota unit
- `history.list`: 2 quota units
- Batch requests: up to 100 requests per batch

---

## 3. googleapis npm Package — Code Patterns

### Package Details

| Property | Value |
|----------|-------|
| **Package** | `googleapis` |
| **Latest Version** | `171.4.0` (as of 2026-05-04) |
| **Node.js** | `>=18` |
| **Dependencies** | `google-auth-library@^10.2.0`, `googleapis-common@^8.0.0` |
| **License** | Apache-2.0 |
| **TypeScript** | Built-in types |

**Install:**
```bash
pnpm add googleapis
```

### Pattern: Creating an OAuth2 Client

```typescript
import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI!;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
  );
}
```

### Pattern: Generating Authorization URL (Route Handler)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client } from '@/lib/google/oauth-client';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const oauth2Client = createOAuth2Client();
  const state = crypto.randomBytes(32).toString('hex');

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    include_granted_scopes: true,
    prompt: 'consent',
    state,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  });
  return response;
}
```

### Pattern: OAuth Callback — Exchanging Code for Tokens

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client } from '@/lib/google/oauth-client';
import { encryptToken } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = request.cookies.get('oauth_state')?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
  }

  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    return NextResponse.json(
      { error: 'No refresh token received. Re-authorize with prompt=consent.' },
      { status: 400 },
    );
  }

  const encryptedRefreshToken = await encryptToken(tokens.refresh_token);
  const encryptedAccessToken = tokens.access_token
    ? await encryptToken(tokens.access_token)
    : null;

  // Store in database: user_id, encrypted_refresh_token, encrypted_access_token,
  // access_token_expires_at, scopes, gmail_email
  // ...

  const response = NextResponse.redirect(new URL('/settings/integrations', request.url));
  response.cookies.delete('oauth_state');
  return response;
}
```

### Pattern: Refreshing Tokens & Using the Gmail Client

```typescript
import { google } from 'googleapis';
import { decryptToken } from '@/lib/crypto';

export async function getGmailClient(
  encryptedRefreshToken: string,
  encryptedAccessToken: string | null,
  accessTokenExpiresAt: Date | null,
) {
  const oauth2Client = createOAuth2Client();

  const refreshToken = await decryptToken(encryptedRefreshToken);

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: encryptedAccessToken
      ? await decryptToken(encryptedAccessToken)
      : undefined,
    expiry_date: accessTokenExpiresAt?.getTime() ?? undefined,
  });

  // The library auto-refreshes access tokens when they expire
  oauth2Client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      // Store new refresh token (rare, but can happen)
      // Update in DB: encrypted refresh token
    }
    if (newTokens.access_token) {
      // Store new access token
      // Update in DB: encrypted access token + new expiry
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}
```

### Pattern: Fetching Message List & Individual Messages

```typescript
export async function fetchRecentMessages(gmail: Gmail, maxResults = 50) {
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    labelIds: ['INBOX'],
  });

  const messages = listResponse.data.messages ?? [];
  return messages;
}

export async function fetchMessageDetail(gmail: Gmail, messageId: string) {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const message = response.data;
  const headers = message.payload?.headers ?? [];
  const subject = headers.find((h) => h.name === 'Subject')?.value ?? '';
  const from = headers.find((h) => h.name === 'From')?.value ?? '';
  const to = headers.find((h) => h.name === 'To')?.value ?? '';
  const date = headers.find((h) => h.name === 'Date')?.value ?? '';

  // Extract body (handles both text/plain and text/html parts)
  const body = extractBody(message.payload);

  return { id: message.id, threadId: message.threadId, subject, from, to, date, body, labelIds: message.labelIds };
}

function extractBody(payload: any): string {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  if (payload.parts) {
    const textPart = payload.parts.find(
      (p: any) => p.mimeType === 'text/plain' && p.body?.data,
    );
    if (textPart) {
      return Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
    }
    const htmlPart = payload.parts.find(
      (p: any) => p.mimeType === 'text/html' && p.body?.data,
    );
    if (htmlPart) {
      return Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8');
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}
```

### Pattern: Setting Up Pub/Sub Watch

```typescript
export async function setupGmailWatch(
  gmail: Gmail,
  topicName: string,
) {
  const response = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
      labelFilterBehavior: 'INCLUDE',
    },
  });

  return {
    historyId: response.data.historyId,
    expiration: response.data.expiration,
  };
}

export async function stopGmailWatch(gmail: Gmail) {
  await gmail.users.stop({ userId: 'me' });
}
```

### Pattern: Incremental Sync via History API

```typescript
export async function incrementalSync(
  gmail: Gmail,
  startHistoryId: string,
) {
  const history = await gmail.users.history.list({
    userId: 'me',
    startHistoryId,
    historyTypes: ['messageAdded'],
  });

  const records = history.data.history ?? [];
  const newMessages: string[] = [];

  for (const record of records) {
    const added = record.messagesAdded ?? [];
    for (const msg of added) {
      if (msg.message?.id) {
        newMessages.push(msg.message.id);
      }
    }
  }

  const nextHistoryId = history.data.historyId ?? startHistoryId;

  return { newMessages, nextHistoryId };
}
```

---

## 4. Supabase Auth Coexistence (No NextAuth)

### Why NOT NextAuth

Flow OS uses **Supabase Auth** for user authentication. Adding NextAuth.js would create:
- Two separate session systems
- Two cookie schemes
- Complex middleware to coordinate both
- Migration headaches

### Recommended: Manual OAuth 2.0 Flow

Implement Google OAuth directly using `googleapis` — it's straightforward for a single provider. This is a **separate** OAuth flow from Supabase Auth:

| Concern | Solution |
|---------|----------|
| User identity | Supabase Auth (email/password, magic link, etc.) |
| Gmail API access | Google OAuth 2.0 (manual flow via `googleapis`) |
| Token storage | Encrypted in Postgres, linked to Supabase user ID |
| Session | Supabase session only. Google tokens are API credentials, not session tokens. |

### Architecture

```
User signs in via Supabase Auth → gets Supabase session
  → User clicks "Connect Gmail" in settings
  → Browser redirects to Google OAuth consent screen
  → Google redirects back to /api/integrations/google/callback
  → Server exchanges code for tokens
  → Server encrypts tokens and stores in Postgres linked to Supabase user_id
  → Agent jobs decrypt tokens, create Gmail client, fetch emails
```

### Key Implementation Points

1. **Route handlers** (not Server Actions) for OAuth flow:
   - `GET /api/integrations/google/connect` — generates auth URL, sets state cookie
   - `GET /api/integrations/google/callback` — exchanges code, stores tokens

2. **State parameter** must include the Supabase user ID (encrypted or signed) so the callback knows which user to link tokens to.

3. **CSRF protection**: Use the `state` parameter with a random nonce stored in an HTTP-only cookie.

4. **No PKCE needed** — server-side OAuth uses `client_secret` (confidential client).

5. **Multiple Gmail accounts**: Design the schema to allow multiple OAuth tokens per user (one per Gmail address).

---

## 5. Token Encryption at Rest

### Option A: Supabase Vault (Recommended)

Supabase Vault uses **Transparent Column Encryption (TCE)** with **libsodium AEAD** (Authenticated Encryption with Associated Data).

**How it works:**
- Encryption key is stored in Supabase's secured backend, **not in the database**
- Data is encrypted on disk and in backups/replication streams
- Decrypted via a Postgres view (`vault.decrypted_secrets`) at query time
- Backed by `libsodium` crypto library

**Usage pattern:**

```sql
-- Store a secret
SELECT vault.create_secret(
  'encrypted_refresh_token_value_here',
  'gmail_oauth_user_abc123',
  'Google OAuth refresh token for user abc123'
);

-- Retrieve decrypted secret (only for roles with access)
SELECT decrypted_secret
FROM vault.decrypted_secrets
WHERE name = 'gmail_oauth_user_abc123';
```

**Pros:**
- Zero application-level crypto code
- Key management handled by Supabase
- Secrets encrypted at rest, in backups, and in replication streams
- Access controlled via Postgres RLS

**Cons:**
- Requires Supabase Vault extension (included in Supabase, but check plan limits)
- Decrypting requires a DB round-trip (fine for agent jobs)
- Less portable if you ever move off Supabase

### Option B: Application-Level Encryption

Encrypt tokens in the Node.js application before storing in Postgres:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!; // 32 bytes, base64-encoded
const ALGORITHM = 'aes-256-gcm';

export async function encryptToken(plaintext: string): Promise<string> {
  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64url');
  encrypted += cipher.final('base64url');

  const authTag = cipher.getAuthTag();
  // Format: iv.authTag.ciphertext (all base64url)
  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted}`;
}

export async function decryptToken(encrypted: string): Promise<string> {
  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  const [ivB64, authTagB64, ciphertext] = encrypted.split('.');

  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(authTagB64, 'base64url');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64url', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

**Pros:**
- Full control over encryption
- Portable across any database/hosting
- No Supabase-specific dependency

**Cons:**
- Must manage encryption key (store in env var or secret manager)
- Key rotation is manual and complex
- More code to maintain and audit

### Recommendation for Flow OS

**Use Supabase Vault** for storing Google OAuth tokens. Reasons:

1. Zero additional crypto code in the app
2. Key management is handled by Supabase (key never in the DB)
3. RLS can protect access to decrypted secrets
4. AEAD ensures tokens can't be tampered with
5. The project already uses Supabase as its primary infrastructure

**Fallback:** If Vault has limitations for high-volume token access, use application-level AES-256-GCM and store the encryption key in Supabase Vault (meta-encryption).

### Database Schema

```sql
CREATE TABLE integrations.google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_email text NOT NULL,
  encrypted_refresh_token text NOT NULL,  -- encrypted via Vault or app-level
  encrypted_access_token text,            -- encrypted, nullable (auto-refreshed)
  access_token_expires_at timestamptz,
  scopes text[] NOT NULL,
  history_id text,                        -- last known Gmail historyId for sync
  watch_expiration timestamptz,           -- when Pub/Sub watch expires
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, gmail_email)
);
```

---

## 6. Gmail Pub/Sub Push Notifications Setup

### Overview

Gmail uses **Google Cloud Pub/Sub** to deliver push notifications when a mailbox changes. This eliminates polling and enables real-time email detection.

### Setup Steps

#### Step 1: Create a Google Cloud Project (if not already)

The same project used for OAuth credentials can be used for Pub/Sub.

#### Step 2: Enable the Pub/Sub API

```bash
gcloud services enable pubsub.googleapis.com
```

#### Step 3: Create a Topic

```bash
gcloud pubsub topics create gmail-notifications \
  --project=your-project-id
```

Topic name format: `projects/{project-id}/topics/{topic-name}`

#### Step 4: Grant Publish Rights to Gmail

Grant `roles/pubsub.publisher` to `gmail-api-push@system.gserviceaccount.com`:

```bash
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

**Important:** If your org has domain-restricted sharing policies, you must configure an exception for this service account.

#### Step 5: Create a Push Subscription

```bash
gcloud pubsub subscriptions create gmail-push-subscription \
  --topic=gmail-notifications \
  --push-endpoint=https://your-app.example.com/api/webhooks/gmail \
  --push-auth-service-account=your-service-account@your-project.iam.gserviceaccount.com
```

The `--push-auth-service-account` enables authenticated push (OIDC token in the `Authorization` header).

#### Step 6: Verify the Webhook Endpoint

For push subscriptions, Google requires endpoint verification:
1. Google sends a challenge request to your endpoint
2. Your endpoint must respond with the challenge token

Alternatively, use **pull subscriptions** where your app polls Pub/Sub (simpler for development).

### Notification Payload

When a mailbox changes, Pub/Sub delivers:

```json
{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiAidXNlckBleGFtcGxlLmNvbSIsICJoaXN0b3J5SWQiOiAiMTIzNDU2Nzg5MCJ9",
    "messageId": "2070443601311540",
    "publishTime": "2021-02-26T19:13:55.749Z"
  },
  "subscription": "projects/myproject/subscriptions/mysubscription"
}
```

Decoded `data`:
```json
{
  "emailAddress": "user@example.com",
  "historyId": "9876543210"
}
```

### Webhook Handler Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = JSON.parse(
    Buffer.from(body.message.data, 'base64url').toString('utf-8'),
  );

  const { emailAddress, historyId } = data;

  // 1. Look up user by emailAddress in integrations.google_oauth_tokens
  // 2. Get their last known historyId
  // 3. Call history.list with startHistoryId = stored historyId
  // 4. Process new messages
  // 5. Update stored historyId to the new one

  // Acknowledge by returning 200
  return NextResponse.json({ ok: true });
}
```

### Watch Renewal

- Gmail watches **expire after 7 days**
- Must call `users.watch()` at least every 7 days per user
- **Recommendation:** Use a daily cron job (via Trigger.dev or pg-boss) that:
  1. Queries all active `google_oauth_tokens` where `watch_expiration < now() + interval '2 days'`
  2. For each, calls `users.watch()` to renew
  3. Updates `watch_expiration` and `history_id`

### Limitations

| Limitation | Detail |
|-----------|--------|
| Max notification rate | 1 per second per user (excess dropped) |
| Reliability | Typically seconds, but can be delayed or dropped |
| History availability | ~1 week minimum, can be shorter |
| Watch renewal | Must renew every 7 days |

**Fallback strategy:** If no notification received for a user in 5+ minutes, fall back to polling `history.list`.

---

## 7. Key Considerations & Risks

### Security

1. **Restricted scope verification.** `gmail.readonly` requires Google OAuth verification. For development, use "Internal" user type. For production, submit for verification early (can take weeks).
2. **Security assessment.** Storing restricted scope data on servers requires a Google security assessment. Budget time and cost for this.
3. **Token encryption.** Refresh tokens grant permanent access. Must be encrypted at rest.
4. **State parameter.** Always use a CSRF-protecting `state` parameter in the OAuth flow.
5. **Client secret.** Never expose in client-side code. All OAuth token exchange happens server-side.

### Architecture Alignment with Flow OS

1. **Provider abstraction.** Per `project-context.md`, agent code never imports Gmail SDK directly. All Gmail API calls go through an `EmailProvider` interface in `packages/agents/email-inbox/`.
2. **Agent isolation.** Gmail OAuth token management lives in `packages/auth/` or a dedicated `packages/tokens/` module. The email agent receives a pre-configured Gmail client, not raw tokens.
3. **Server Components by default.** The OAuth callback is a Route Handler (the exception for server-side flows in App Router).
4. **RLS is the security perimeter.** The `google_oauth_tokens` table uses RLS to ensure users can only access their own tokens.

### Development Phasing

| Phase | Scope |
|-------|-------|
| **Phase 1** | Manual OAuth flow, full sync, no real-time. Agent fetches on-demand. |
| **Phase 2** | Add Pub/Sub push notifications for real-time detection. |
| **Phase 3** | Incremental sync via history API. Watch renewal cron. |
| **Phase 4** | Google OAuth verification for production. Security assessment. |

### Package Versions Summary

| Package | Version | Notes |
|---------|---------|-------|
| `googleapis` | `171.4.0` | Latest. Requires Node.js >=18 |
| `google-auth-library` | `^10.2.0` | Peer dep of googleapis |
| `googleapis-common` | `^8.0.0` | Peer dep of googleapis |

---

*Sources: Google Developers documentation (developers.google.com), npm registry (registry.npmjs.org), Supabase documentation (supabase.com). All fetched 2026-05-04.*
