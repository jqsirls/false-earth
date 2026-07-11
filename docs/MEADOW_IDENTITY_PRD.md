# PRD: Storytailor Identity at Booster's Meadow

## V3 Auth, Soft-Launched Early

**Owner:** JQ Sirls  
**Status:** Active — OTP live; in-modal profile completion for Hue eligibility (2026-07-11)  
**Date:** July 2026  
**Audience:** Cursor / dev team  
**Scope:** Authentication and identity only. Hue mechanics, CTA, and modals live in `PRD_BOOSTERS_MEADOW.md` and `PRD_MEADOW_MODALS.md`.

---

## 1. The point of this document

Hue is a V3 feature and lives in Supabase. V3's full launch date is uncertain. The Meadow needs auth **now** so Hue can ship **now**. Therefore: the Meadow runs V3's identity system (Supabase Auth) today, dressed in the exact sign-in ritual V2 users already know. Minimum guaranteed outcome even if V3 slips: Hue works at the Meadow, and every person who signs in there is already registered in the V3 system on launch day.

**The three promises this design keeps:**

1. **One ritual.** Enter email, get a code. That's it, and it covers everyone: Memberstack accepts passwordless codes for all members regardless of how they originally signed up (including Google and LinkedIn members), verified by JQ July 2026. Users never learn there are two systems.
2. **One email, maximum.** No flow ever sends two emails. (Accounting in Section 3.)
3. **One list.** Every Meadow sign-in = a V3-ready identity, linked to their Memberstack membership when one exists.

---

## 2. Architecture

### 2.1 Roles

- **Supabase Auth = the authenticator.** Email OTP only at the Meadow. Google and Apple arrive at V3; offering them earlier would trigger a second, confusing OAuth consent at V2 and break email-as-join-key. This is V3's login, in production early, deliberately minimal.
- **Memberstack = read-only enrichment (+ optional write-through).** Never in the auth path. Never blocks a session.

### 2.2 Sign-in flows

**The flow: email code (the only method at the Meadow)**

1. User enters email. Client calls Supabase `signInWithOtp` (`shouldCreateUser: true`).
2. Supabase emails a 6-digit code. (The only email in the flow.)
3. User enters code → `verifyOtp` → session. New users are created implicitly at this step; see 4.2 for the transparency line that makes this honest.
4. Post-auth, fire the enrichment job (2.3). Non-blocking.

**Why no Google or Apple button here:** those providers launch with V3. Offering Google at the Meadow would (a) present a second OAuth consent when the user later hits Memberstack's Google at V2, which reads as broken, and (b) admit Google emails that differ from the member's Memberstack email, silently breaking enrichment and write-through. Passwordless covers every member, including those who originally signed up with Google or LinkedIn (confirmed working). The typed email is the join key, always.

### 2.3 Enrichment job (server, after every successful auth)

1. `GET https://admin.memberstack.com/members/{email}` (Admin REST, secret key, server only; 25 req/s limit is a non-issue at this volume).
2. If member found: write `memberstack_id` + plan snapshot to the Supabase user's `app_metadata`/profile. Mark `v2_member: true`.
3. If not found: mark `v2_member: false` and run the write-through (2.4).
4. Failures log and retry with backoff. The user's session is never affected.
5. Drift protection: subscribe to Memberstack `member.updated` / `member.deleted` webhooks (Node Admin Package required for signature verification) → resync email changes to the Supabase user; on delete, unlink and revoke Hue tokens.

### 2.4 Write-through (ships enabled)

Purpose: a brand-new Meadow signup also exists in Memberstack, so the "Make a story" CTA lands them at V2 as a recognized member. This ships ON.

- Memberstack member creation requires a password (documented behavior in REST, Node, and dashboard). The write-through supplies a **random, cryptographically strong, immediately discarded password**. It is never stored, logged, or shown. The member will only ever authenticate via passwordless code or Google, so the password is dead weight by design; at V3, anyone wanting a password uses reset.
- **Email safety, confirmed against Memberstack docs:** Memberstack does not send welcome emails natively (they require webhook/Zapier wiring we simply do not add for this source), and verification emails do not send when passwordless auth is enabled, which is our configuration. Therefore write-through creation sends **zero** emails.
- Tag created members (`metaData.source: "meadow"`) so V2 analytics can distinguish them.
- **Timing (Hue profile gate):** do **not** create a nameless Memberstack member on OTP alone. Enrichment after OTP **looks up** only; if no member exists, mark `pending_writethrough` and **defer create** until Path A profile completion (§4.6). On create (or create-then-PATCH): set `customFields["first-name"]`, `customFields["last-name"]` (when present), and **always** `customFields["user-role"] = "Enthusiast"` — V2 roles are a coarse bucket until V3; Path A stores the real `userType` separately.
- **Race / migration framing:** OTP session is valid for Meadow grass immediately; Hue connect requires Path A profile complete. Existing V2 members who already have names in Memberstack prefill the profile step; they still supply birthday (+ `userType` dropdown) once so Path A age audit exists. Net-new Meadow users fill names + birthday + role, then write-through runs with names.
- **Dev verification task (day one of the sprint, ~10 minutes):** in the Memberstack sandbox, create a member via Admin REST with a random password, then complete a passwordless-code login as that member. Pass = proceed. Fail = flip `WRITETHROUGH_ENABLED` off and open the support ticket. Do not wait on support to start building.

### 2.5 Kill switches (ops hygiene, both default ON)

- `ENRICHMENT_ENABLED` (default true): if disabled, auth still works fully; profiles lack Memberstack linkage until re-enabled (job can backfill).
- `WRITETHROUGH_ENABLED` (default true, contingent only on the day-one sandbox test in 2.4): if disabled, new users exist in Supabase only and reconcile by email at V3 migration.

These flags exist for incident response, not indecision. The launch configuration is both ON.

---

## 3. The one-email guarantee (accounting table)

| Flow | Supabase emails | Memberstack emails | Total |
|------|-----------------|-------------------|-------|
| Email-code sign-in (existing or new user) | 1 (the code) | 0 (enrichment is a GET) | **1** |
| Write-through member creation | 0 | 0 (no native welcome email; verification suppressed under passwordless) | **0** |
| Hue connect after sign-in | 0 | 0 | **0** |

Regression rule: any future change to auth must update this table, and any cell that becomes 2 fails review. If Memberstack's email behavior is ever reconfigured (e.g., welcome emails wired up via webhook for V2 marketing), the write-through source tag (`metaData.source: "meadow"`) must be excluded from those sends.

---

## 4. UX and wording

### 4.1 Auth sheet

- Header: **"One account for Booster's lights and Storytailor stories."**
- Field: email. Button: **"Send my code"**.
- No tabs, no divider, no provider buttons, no separate signup mode. One field, one button.

### 4.2 Transparency line (required, brand rule)

Because OTP creates accounts implicitly, honesty is one line under the buttons, always visible:

**"New here? Signing in creates your free Storytailor account."**

No surprise accounts; no extra friction. The guardrail metric from the main PRD applies: support tickets about unexpected account creation must be ~zero.

### 4.3 Code screen

- **"Check your email."**
- "We sent a 6 digit code to {email}."
- Code input, auto-advance, paste-friendly.
- "Didn't get it? **Resend code**" (30s cooldown; resend replaces, never stacks, still one live code).
- Quiet escape: "Use a different email".

### 4.4 Error states (calm voice, mono aesthetic per modals PRD)

- Wrong code: "That code didn't match. Try again or resend."
- Expired: "That code expired. We can send a fresh one."
- Enrichment failure: **invisible to the user.** Never surface Memberstack's existence.

### 4.5 Post-auth

Return the user exactly where they were (mid-Hue-connect, or standing in the grass). Never a dashboard, never a welcome screen.

**Carve-out:** when Path A profile is incomplete, the auth sheet stays open for the one-time profile step (§4.6) before Hue resume. That step is still *in the Meadow auth sheet* — never a redirect to storytailor.com, never a separate welcome/dashboard surface.

### 4.6 One-time profile step (Hue eligibility)

Path A Hue exchange returns `PROFILE_INCOMPLETE` until adult profile + age verification exist. Collect that **in-modal after OTP**, never off-site.

**When:** after successful `verifyOtp`, client calls `profileStatus`. If complete → close sheet and resume Hue intent (§4.5). If incomplete → show profile step in the same auth sheet.

**Fields**

| Audience | Collect |
|----------|---------|
| Existing Memberstack member (names from enrichment) | Birthday (full ISO), Path A `userType` dropdown; `firstName` only if missing |
| New signup / skeleton | `firstName` (required), `lastName` (optional), birthday, `userType` dropdown |

**Birthday:** prefer full ISO — `ageVerification.method: "birthday"`, `value: "YYYY-MM-DD"`.

**Path A `userType`:** Meadow shows a dropdown of the live V3 adult enum (17 slugs from Path A `ADULT_USER_TYPES`). User picks their real role; that value is sent to `POST /auth/complete-profile`.

**Memberstack write-through role:** always `customFields["user-role"] = "Enthusiast"`, regardless of Path A `userType`. Do not surface Memberstack/V2/V3 jargon in UI.

**Copy (calm mono CRT, matching auth sheet):**

- Header: **"A few details so we can turn on the lights."**
- No Memberstack, V2, or V3 language.

**Submit:** `completeProfile` → Path A `POST /auth/complete-profile` with Supabase access token from session cookie → then deferred Memberstack write-through with names + Enthusiast → close sheet and resume Hue intent.

---

## 5. V3 continuity

- **Passwordless users:** same email, same code ritual at V3. Nothing to migrate; they are already IN the V3 system.
- **Google users (V3):** Google launches at V3 alongside Apple and passwords. Supabase's automatic identity linking attaches a Google identity to the existing account when the verified email matches; a post-sign-in linking prompt catches mismatched emails. Same prompt covers Apple's Hide My Email relays.
- **Passwords (returning in V3):** users set one via standard flow. Known upstream quirk: adding a password to an OAuth-created account works for login but may not update identities metadata cleanly; track and verify in V3 QA. Not a Meadow concern.
- **The list:** query for V3 launch comms = all Supabase users with `origin: meadow`, segmented by `v2_member` true/false. These people log into V3 on day one with zero migration steps.

---

## 6. Data model (delta to main PRD)

- `auth.users.app_metadata`: `memberstack_id`, `origin` (`meadow`), `v2_member` (bool), `enriched_at`, `writethrough` (bool), `pending_writethrough` (bool — set when OTP enrich finds no MS member and defers create), `ms_first_name` / `ms_last_name` (cached from Memberstack `customFields` for profile prefills).
- `profiles` / `public.users`: Path A owns `first_name`, `last_name`, `user_type` after `complete-profile`.
- Secrets: Memberstack secret key and Supabase service-role key in the server secret store only (Supabase Vault / AWS Secrets Manager). Never client-side, never in the repo.

---

## 7. Acceptance criteria

- **AC1:** Email-code flow: exactly one email observed end-to-end, verified against a live inbox in staging for both new and existing users.
- **AC2:** A V2 member who originally signed up via Google (or LinkedIn) completes the Meadow email-code flow successfully and gets enriched with their `memberstack_id`. Verified in staging with a real Google-origin test member.
- **AC3:** Enrichment: an existing V2 member's Meadow sign-in results in `memberstack_id` linkage within 60 seconds, with zero user-visible effect and zero emails.
- **AC4:** Write-through (flag on, staging): creates a Memberstack member with source tag, zero emails observed, and that member can subsequently sign in at V2 via passwordless code.
- **AC5:** Both kill switches verified: auth fully functional with each disabled.
- **AC6:** The transparency line renders on the auth sheet in all states.
- **AC7:** No Memberstack error, name, or state is ever visible in the client.
- **AC8:** No OAuth provider buttons render anywhere in the Meadow auth UI; email code is the only visible method.
- **AC9:** After OTP, if Path A profile is incomplete, the auth sheet shows the in-modal profile step (never redirects to storytailor.com). On submit, Path A receives the chosen `userType` + birthday; Memberstack write-through (when needed) includes names and `user-role: Enthusiast`. Hue intent resumes only after profile is complete.

---

## 8. Open questions

1. ~~Memberstack support confirmation~~ **Resolved by decision:** verified via the day-one sandbox test in 2.4, not a support ticket. Write-through ships ON.
2. **Supabase OTP email template:** brand the code email (from-address, logo, copy) before launch; the default template would be the one place the seam shows. Decide sender: hello@storytailor.com or booster@storytailor.com.
3. **LinkedIn removal from V2:** confirm no members are LinkedIn-only before the provider is removed; if any exist, they need an email-match path first.
4. **Rate limiting / abuse:** confirm Supabase OTP throttling defaults are acceptable for a public splash page (bot-driven email sends to arbitrary addresses); add per-IP throttle at the edge if not.
