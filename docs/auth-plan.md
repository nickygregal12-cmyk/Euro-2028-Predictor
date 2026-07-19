# Authentication Plan (deferred — build later)

Auth screens are deliberately deferred. This doc defines how development proceeds without them, and exactly what gets built when auth lands. The core principle: **defer the UI, not the plumbing.**

---

## 1. The dev approach (in effect now)

- One real Supabase Auth user (the "dev user") is created in the dev project, with a matching `profiles` row (display name e.g. "Dev Tester").
- In development mode only, the app **auto-signs-in as the dev user on startup**, using credentials from `.env.local`:
  - `VITE_DEV_AUTOLOGIN=true`
  - `VITE_DEV_USER_EMAIL=...`
  - `VITE_DEV_USER_PASSWORD=...`
- Auto-login code is gated on `import.meta.env.DEV` **and** the env flag — it must be impossible to trigger in a production build. A fail-closed check: if a production build detects the autologin flag, it refuses to start.
- Everything downstream — sessions, `auth.uid()`, RLS policies, autosave, entries — works exactly as production will. **No code outside the auto-login shim may ever special-case the dev user.**
- Additional test users (for leaderboard/league testing) are created the same way and switched via the env vars.

## 2. Why this approach

Hardcoding a fake user ID through the app would make every query and policy assume "no auth", turning later auth into a full retrofit touching everything. Auto-login keeps the entire auth pipeline live from day one, so building auth later is **only screen-building** — no plumbing changes, no RLS rework, no query changes.

## 3. What gets built later (the actual auth work)

**Phase 1 exit requirement (before any real user touches the deployed app):**
- Sign up (email + password, display name required + length-limited, creates profiles row)
- Log in / log out
- Session restore on refresh without logged-out flash
- Friendly error states (wrong password, existing account, network) — never raw Supabase errors
- Auth screens use the design system (Button, TextInput, Alert)
- Remove/disable the dev auto-login path in the deployed environment (verify the fail-closed check)

**Phase 2 additions:**
- Cloudflare Turnstile on sign up / log in
- Password reset flow
- Rate limiting on auth endpoints
- Display-name moderation rules

**Explicitly not planned unless demanded later:** social logins, magic links, MFA.

## 4. Hard rule

The app must never deploy to a URL real users can reach while auto-login exists in the build. Auth screens are the gate between "friends testing locally supervised" and "anyone can use it."
