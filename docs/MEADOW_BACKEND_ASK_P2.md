# Meadow Backend Ask — P2 Auth (Memberstack + Supabase shadow)

> **SUPERSEDED (2026-07-10):** This password-bridge design is retired. Use **`docs/MEADOW_IDENTITY_BACKEND_ASK.md`** and **`docs/MEADOW_IDENTITY_PRD.md`** — Supabase email OTP only; Memberstack is enrichment + optional write-through, never in the auth path.

**Status:** SUPERSEDED — was APPROVED (2026-07-09)  
**Hosting:** Experience at `https://booster.storytailor.com` (production); large assets at `https://assets.storytailor.dev/meadow/` (see `docs/MEADOW_DEPLOYMENT.md`). `meadow.storytailor.com` should 301 → `booster.storytailor.com`.  
**Phase:** P2 Booster's Meadow (frontend shell shipped; server not implemented)  
**Authority:** Meadow PRD §6 (auth + account linking)  
**Green backend:** OFF-LIMITS until `STORYTAILOR_ALLOW_BACKEND_CHANGE` is set by a human for the implementing commit.

---

## Summary

Ship a **Supabase Edge Function** `meadow-auth` that validates **Memberstack** credentials on sign-in/sign-up, then **lazily creates or links** a Supabase shadow user keyed by `memberstack_id`. The meadow frontend (`experiences/false-earth`) calls this function via `VITE_MEADOW_AUTH_URL`; until deployed, the UI shows a calm “not ready yet” message or local mock via `?meadow-auth-mock=1`.

Memberstack remains **source of truth** for membership. Supabase is the durable identity row for analytics, Hue linkage (P3), and future Storytailor API bridges.

---

## Edge Function: `meadow-auth`

**Deploy target:** Supabase project `lendybmmnlqelrhkhdyc` (Storytailor multi-agent)  
**Runtime:** Deno Edge Function  
**Public URL (example):** `https://<project-ref>.supabase.co/functions/v1/meadow-auth`

### Kill switch

| Env var | Default | Behavior |
|---------|---------|----------|
| `MEADOW_AUTH_ENABLED` | `false` | When not `true`, return `503` with plain body `{ "message": "Account connection isn't ready yet" }` — no credential processing |

Set via Supabase secrets; never expose in client bundle.

### CORS

Allow meadow origins only (configurable list):

- `https://booster.storytailor.com` (production)
- `https://assets.storytailor.dev` (CDN / legacy iframe host)
- `https://localhost:5173` (dev)
- Staging meadow host if/when added

`Access-Control-Allow-Credentials: true` for httpOnly session cookie.

### Actions (JSON body `action` field)

#### `signIn`

**Request**

```json
{
  "action": "signIn",
  "email": "parent@example.com",
  "password": "********"
}
```

**Flow**

1. Reject if `MEADOW_AUTH_ENABLED !== true`.
2. Validate email/password shape (min 8 chars password; no complexity beyond Memberstack policy).
3. Call Memberstack API to verify credentials (server-side secret).
4. On success, `upsert` shadow profile (see Tables).
5. Issue meadow session cookie (httpOnly, `SameSite=Lax`, `Secure` in prod).
6. Return `{ "session": { "userId", "email", "memberstackId" } }` — **no tokens in response body**.

**Errors (plain human `message`, no API codes to client)**

- Invalid credentials → `401` `{ "message": "Email or password didn't match. Try again." }`
- Memberstack unavailable → `503` `{ "message": "We could not reach the account service. Please try again." }`

#### `signUp`

**Request**

```json
{
  "action": "signUp",
  "email": "parent@example.com",
  "password": "********"
}
```

**Flow**

1. Same kill-switch and validation as `signIn`.
2. Create Memberstack member (server-side).
3. Lazy-create Supabase `auth.users` via **admin** `createUser` if no row exists for `memberstack_id`.
4. Upsert `profiles` row.
5. Issue session cookie; return session envelope.

**Errors**

- Email taken → `409` `{ "message": "An account already exists with this email. Try signing in." }`

#### `signOut`

**Request**

```json
{ "action": "signOut" }
```

Clear meadow session cookie. Idempotent `200`.

#### `getSession`

**Request:** `GET ?action=getSession` with session cookie.

**Response**

```json
{ "session": { "userId": "...", "email": "...", "memberstackId": "..." } }
```

or `{ "session": null }` when unauthenticated.

---

## Webhook handler (outline)

**Route:** `meadow-memberstack-webhook` (separate Edge Function or shared router)  
**Source:** Memberstack webhooks (member created, updated, deleted, subscription changes)

| Event | Handler |
|-------|---------|
| `member.created` | Idempotent upsert `profiles` + ensure Supabase shadow user exists |
| `member.updated` | Sync email/display fields on `profiles` |
| `member.deleted` | Soft-delete profile; revoke meadow sessions; **do not** hard-delete Supabase auth user without compliance review |
| `subscription.*` | Log to `funnel_events` only in P2; no entitlement gating in meadow |

**Security**

- Verify Memberstack webhook signature before processing.
- Return `200` quickly; heavy work async if needed.
- Idempotent on `memberstack_id` + event id dedupe table (or `funnel_events` unique constraint).

---

## Tables

### `meadow_profiles` (or extend existing `profiles` with nullable meadow columns)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | Matches Supabase `auth.users.id` when shadow exists |
| `memberstack_id` | `text` UNIQUE NOT NULL | Canonical external key |
| `email` | `text` NOT NULL | Synced from Memberstack |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `deleted_at` | `timestamptz` nullable | Soft delete |

**Upsert key:** `memberstack_id`  
**RLS:** Service role only for Edge Function writes; no direct client access.

### `funnel_events`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `anon_id` | `text` nullable | Meadow analytics anon id when logged out |
| `user_id` | `uuid` nullable FK → profiles | When authenticated |
| `event_name` | `text` NOT NULL | e.g. `meadow_visit`, `meadow_auth_sign_in`, `meadow_hue_connect_started` |
| `properties` | `jsonb` default `{}` | No PII beyond email hash optional |
| `created_at` | `timestamptz` | |

**P3 note:** `hue_connections` table deferred — document placeholder:

```sql
-- P3: hue_connections (user_id, philips_remote_user_id, selection_type, selection_id, connected_at, revoked_at)
```

Store `meadow_hue_*` events in `funnel_events` until P3 schema lands.

---

## Security requirements

1. **Never log passwords, Memberstack secrets, or session tokens.** Log only `memberstack_id` prefix + request id.
2. **Idempotent upsert** on `memberstack_id` for all create/link paths (sign-in, sign-up, webhook).
3. **Admin Supabase client** only inside Edge Function; never ship service role to meadow frontend.
4. **Rate limit** per IP + per email on `signIn`/`signUp` (e.g. 10/min) — plain `429` message.
5. **HIBP / leaked password** — delegate to Memberstack on sign-up if supported; else document gap.
6. Meadow frontend **must not** store Memberstack tokens in `localStorage`; httpOnly cookie only.

---

## Frontend contract (already implemented)

| File | Role |
|------|------|
| `src/api/meadowAuthApi.ts` | `signIn`, `signUp`, `signOut`, `getSession` → `MEADOW_AUTH_URL` |
| `src/core/store/meadowAuthStore.ts` | Zustand session + sheet state + `authIntent: hue_connect` |
| `src/ui/AuthSheet.tsx` | PRD §6.5 copy; resumes Hue sheet after auth |
| `src/ui/HueSheet.tsx` | Shell only until P3 Path A `/hue/connect` |

**Env**

```bash
VITE_MEADOW_AUTH_URL=https://<project-ref>.supabase.co/functions/v1/meadow-auth
```

**Local mock (no server):** `?meadow-auth-mock=1` on meadow URL.

---

## Out of scope (P2)

- Path A `/hue/connect` OAuth (P3)
- Storytailor API JWT issuance to meadow client
- Org / StorytailorID / Care Circle flows
- Wized or Webflow auth bridges

---

## Approval checklist

- [ ] CEO/product approves Memberstack as meadow auth source of truth (PRD §6)
- [ ] Memberstack server API key + webhook secret provisioned in Supabase secrets
- [ ] Migration for `meadow_profiles` / `funnel_events` reviewed
- [ ] `MEADOW_AUTH_ENABLED=true` only after staging curl proof
- [ ] Human sets `STORYTAILOR_ALLOW_BACKEND_CHANGE` for the implementing commit

---

## Verification (post-implementation)

```bash
# Kill switch off
curl -s -o /dev/null -w "%{http_code}" -X POST "$MEADOW_AUTH_URL" \
  -H 'Content-Type: application/json' \
  -d '{"action":"signIn","email":"test@example.com","password":"testpass12"}'
# Expect 503

# Staging sign-up (enabled)
curl -s -X POST "$MEADOW_AUTH_URL" \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"action":"signUp","email":"meadow-test@storytailor.dev","password":"testpass12"}'

curl -s "$MEADOW_AUTH_URL?action=getSession" -b cookies.txt
# Expect session JSON with memberstackId
```

Frontend: `npm run dev` → START → lamp icon → auth sheet → `?meadow-auth-mock=1` → sign in → Hue sheet opens.
