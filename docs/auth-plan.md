# Authentication Plan (implemented — one polish item open)

Auth is built and live: every Phase 1 and Phase 2 item below is shipped except the final auth-resilience polish batch (§3, last checkbox). The doc is retained because its checklists map directly to the shipped code and its dev-approach section still describes the active dev auto-login mechanism. The core principle held: **defer the UI, not the plumbing.**

**§ 1–4 describe shipped auth. § 5 does not** — it records the two-site redirect/session model, sender-domain transition and 18+ cohort rule accepted on 6 August 2026, none of which is implemented.

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

**Implementation (shipped):**
- Policy: `src/services/supabase/autoLoginPolicy.ts` — dependency-free pure function `evaluateAutoLoginPolicy(env)` returning `skip` / `login`, and throwing `AutoLoginProductionError` (fail-closed) or `AutoLoginConfigError`. Unit-tested in `tests/services/autoLoginPolicy.test.ts`.
- Effect: `src/services/supabase/devAutoLogin.ts` — `initDevAuth()` reads `import.meta.env`, reuses an existing session, else `signInWithPassword`; dev sign-in failures are logged, not fatal.
- Startup: `src/main.tsx` awaits `initDevAuth()` before the first render and refuses to render if it throws.
- Fail-closed twice over: the runtime policy throws, and `vite.config.ts` refuses a production **build** when `VITE_DEV_AUTOLOGIN=true`.
- Dev user: create via the dashboard, then run `supabase/dev-user.sql` for the `profiles` row. Env vars documented in `.env.example`.
- These two files are the only code that knows the dev user exists (CLAUDE.md rule 8).

## 2. Why this approach

Hardcoding a fake user ID through the app would make every query and policy assume "no auth", turning later auth into a full retrofit touching everything. Auto-login keeps the entire auth pipeline live from day one, so building auth later is **only screen-building** — no plumbing changes, no RLS rework, no query changes.

## 3. What gets built later (the actual auth work)

**Phase 1 exit requirement (before any real user touches the deployed app):**
- [x] Sign up (email + password, display name required + length-limited, creates profiles row)
- [x] Log in / log out
- [x] Session restore on refresh without logged-out flash
- [x] Friendly error states (wrong password, existing account, network) — never raw Supabase errors
- [x] Auth screens use the design system (Button, TextInput, Alert)
- [x] Remove/disable the dev auto-login path in the deployed environment (verify the fail-closed check)

**Shipped (Phase 1):** `src/features/auth/` holds the screens — presentational
`AuthScreen` shell + `LoginForm`/`SignUpForm` (own field state, error via
`Alert`, no Supabase logic → previewed in `/dev/components`), wired by
`LoginPage`/`SignUpPage` to the service and navigation. `signUpWithPassword`
(in `services/supabase/auth.ts`) creates the auth user; the matching `profiles`
row is created **server-side** by the `on_auth_user_created` trigger
(`20260720190000_profile_on_signup.sql`) from the sign-up display-name metadata —
the client `createMyProfile` was removed after the 2026-07-20 confirmation
incident (a client insert needed a session and failed under RLS when confirmation
left sign-up session-less). `friendlyAuthError()` maps failures to human
copy (never raw messages); `validateSignUp()` mirrors the server constraints
(display name 1–40, valid email, min password length) — both pure + unit-tested.
Routing gates in `src/app/Providers.tsx` (`AuthLayout` → `RequireAuth` /
`RedirectIfAuthed`) split signed-in vs signed-out and show a neutral splash
during session restore (no logged-out flash). `AuthProvider.signOut` is a real
sign-out; the dev auto-login shim stays a **startup-only** path (a dev reload
re-signs-in), and the fail-closed production check still holds (runtime policy +
`vite.config.ts` refuse a production build with `VITE_DEV_AUTOLOGIN=true`).

**Phase 2 additions:**
- [x] Server-side profile creation on sign-up (auth.users trigger) — the incident fix (`20260720190000`)
- [x] Display-name moderation rules — data-driven client policy (`displayNamePolicy.ts`) + server trigger (`20260720200000`)
- [x] Rate limiting — app-level for prediction save + league join (`20260720210000`); Supabase covers its own auth endpoints
- [x] Cloudflare Turnstile on sign up / log in — **shipped + verified live in production** (Option A, Supabase built-in CAPTCHA; widget on both forms, token threaded to auth calls; double-render bug fixed 2026-07-20; secret held by Supabase, never the repo). Detail in build-todo/roadmap Auth hardening. *(This list previously still showed it open — synced 2026-07-22.)*
- [x] Password reset flow — **shipped**: `/auth/reset` (neutral, enumeration-safe) + `/auth/update-password` (recovery-session grace window, expired-link fallback); reset request carries a Turnstile token. *(Synced 2026-07-22 — was stale here.)*
- [x] Custom SMTP for auth emails — **shipped**: Resend + verified `euro28predictor.com` domain, configured in Supabase Auth, live-verified by a real recovery send (key rotated at the 2026-07-22 prod cutover). *(Synced 2026-07-22 — was stale here.)*
- [ ] **Auth resilience (2026-07-22 interface audit — UI/CRO Batch C, build-todo):** submit buttons never disabled-until-valid — validation *speaks* on submit (per-field errors; a visible "still verifying you're human" line when the Turnstile token is missing); **Turnstile load failure is a designed state** (script blocked by ad-blockers/corporate networks → visible fallback + reload offer, never a permanently dead CTA — surface the `loadScript()` rejection, don't fold it into a null token); no silent `return` in any submit handler; password placeholder/hint de-duplicated. Spec: design-system §6 → Auth screens (amended 2026-07-22). *Rationale: a silently-broken CAPTCHA converts to a 100% loss for that visitor — nobody debugs a stranger's form.*

**Explicitly not planned unless demanded later:** social logins, magic links, MFA.

## 4. Hard rule

The app must never deploy to a URL real users can reach while auto-login exists in the build. Auth screens are the gate between "friends testing locally supervised" and "anyone can use it."

## 5. Two sites, one account (added 6 August 2026)

Decision authority: [ADR 0026](adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md). **None of this section is implemented** — it records what the shipped auth plumbing above must accommodate, not what it currently does.

### Redirect and session model

There will be **two production frontend origins** over one Supabase backend: the weekly platform on the eventual umbrella-brand domain (`SITE-003`) and Euro 2028 on `euro28predictor.com` (`SITE-004`).

**Both origins must be in the Supabase Auth redirect allow-list** (`SITE-006`). This is the single point at which two sites can break signup: a confirmation, recovery or email-change link that lands on the wrong origin is a dead end for a real user, and only the allow-list decides. The order is the one ADR 0019 already fixes for the rename — **add and verify before removing anything** — run here against two live origins rather than one replacing another, and verified per origin by a real confirmation and a real recovery send rather than by inspecting configuration.

**One account, both sites** (`ACCOUNT-001`, `ACCOUNT-002`): one Auth user, one `profiles` row, the same credentials. There is no second account and no account linking. **Separate browser sessions are acceptable initially** (`ACCOUNT-003`) — signing in at one origin need not produce a session at the other. Seamless cross-domain handoff is a later, separately designed question; sharing credentials is the part that matters and it comes free.

**Signing up joins nothing** (`ACCOUNT-004`). The sign-up path creates an Auth user and a profile and stops. It must not enrol the account in a competition, a game or a private container on either origin.

### Sender domain

**Custom SMTP is complete and live-verified** — Resend with the verified `euro28predictor.com` domain, configured in Supabase Auth, proven by a real recovery send (§ 3, Phase 2). That evidence stands and is not superseded.

Two consequences follow, and they are different things:

- **`CAP-005` — email delivery is no longer a reason to hold the public-user cap.** SMTP was the original stated prerequisite; it is met. The cap's remaining justification is that the system is untested under load, which is [ADR 0023 § Operating-limit classes](adr/0023-hub-information-architecture.md#operating-limit-classes) `CAP-001`, not this.
- **`SITE-007` — the sender identity should move to the neutral umbrella brand** once the brand decision lands. A domestic player receiving password-recovery mail from a Euro tournament address is a brand defect, not a delivery defect.

The transition, when the brand exists — no Supabase compute change is required for any of it:

1. add and verify the new sender domain with the email provider;
2. publish and validate SPF, DKIM and DMARC;
3. update the Supabase SMTP sender address and display name;
4. update authentication-email links and public site URLs;
5. re-test signup confirmation, password recovery and email-change messages;
6. keep the old sender domain live briefly for messages and links already in flight;
7. verify bounce, rejection and spam-placement monitoring after the switch.

### Age of the first external cohort

**`AGE-001` — the initial external cohort is restricted to users aged 18 or over.** This is a signup rule with server-side effect, matching eligibility wording and test fixtures, not footer copy. It is unimplemented: there is no age field and no gate. `validateSignUp()` and its server-side counterpart are where it belongs, on the pattern the display-name and password rules already use — mirrored on both sides rather than enforced in the browser alone.

The restriction stands until a Children's Code and age-risk assessment supports a different model. It is separate from, and not satisfied by, the Stage C2 data-protection work in [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md).

Each identifier is tracked in [`quality/accepted-requirements.md`](quality/accepted-requirements.md).
