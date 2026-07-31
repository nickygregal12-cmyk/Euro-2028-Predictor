# ACQ-R09 — anti-bot and password controls, characterised

**Date:** 31 July 2026
**Risk:** `ACQ-R09` — password, breach screening and anti-bot controls are insufficiently fail-closed for launch.
**Named mitigation:** stronger floor, leaked-password protection and mandatory production Turnstile validation.
**Outcome:** the register's wording is exact. **Nothing here is broken; everything here is optional.** The before-state is pinned by `tests/features/auth/antiBotAndPasswordBeforeState.test.ts`. No change is proposed.

## The finding that matters

It is not the password floor.

**Turnstile is the one piece of configuration whose absence is treated as a valid production setup.**

`scripts/validate-netlify-environment.mjs` exists precisely to fail a build that is misconfigured for its environment. It rejects a missing `VITE_SUPABASE_URL`, a missing anon key, and — impressively — a key belonging to the *wrong Supabase project* for the Netlify context. It is a genuine fail-closed control.

It does not know Turnstile exists.

So a production build with `VITE_TURNSTILE_SITE_KEY` unset passes **every automated gate in this repository** and ships with anti-bot protection silently off. To every check the project owns, "not yet configured" and "deliberately disabled" are the same state.

That is the *"insufficiently fail-closed"* in the risk title, and it is a build-gate gap rather than an application defect.

## What the code does today

Read from source, not assumed.

| Control | Current state | Where |
| --- | --- | --- |
| Password minimum | **6** — Supabase's default, inherited rather than chosen | `src/features/auth/authValidation.ts` |
| Composition / strength / breach check | **none** | same |
| Reset-flow floor | same 6, shared with sign-up | same |
| Turnstile | **opt-in; unset key disables it silently** | `src/features/auth/turnstileConfig.ts` |
| Captcha token | sent only when a key is configured | `src/services/supabase/auth.ts` |
| Build gate on the site key | **absent** | `scripts/validate-netlify-environment.mjs` |
| Leaked-password protection | **not visible from the repository** — a Supabase dashboard setting | — |

The source is candid about the posture. `turnstileConfig.ts` opens with *"Cloudflare Turnstile is OFF by default and opt-in via one public env var"*, and `authValidation.ts` records that the floor *"is Supabase's default"*. Neither is a mistake; both were deliberate choices for a pre-launch product, and both are what `ACQ-R09` asks to revisit before launch.

## Finding 1 — the floor is six, and length is the whole policy

Six is the platform default. NIST SP 800-63B puts the minimum for user-chosen secrets at eight, and its substantive recommendation is to screen against known-breached passwords rather than to impose composition rules.

There is no entropy check, no composition requirement and no breach screening — verified by absence of `entropy|breach|pwned|zxcvbn` in the validator. **"We validate passwords" is true and misleading:** a six-character dictionary word passes.

The reset flow shares the same constant, which is worth keeping. A stronger sign-up floor that the reset path did not share would let an existing account move *down* to six characters.

## Finding 2 — Turnstile fails open by construction

`turnstileEnabled` is `TURNSTILE_SITE_KEY !== null`. No key means no widget renders, no `captchaToken` is produced, and the service layer omits the field entirely through a conditional spread — which is why Supabase accepts the call rather than rejecting it.

This is correct behaviour for the design as written: the two sides must move together, since sending a token while Supabase CAPTCHA is disabled errors, and enabling Supabase CAPTCHA without a token also fails. The problem is not the mechanism. It is that **no gate asserts the intended side** for the production context.

## Finding 3 — leaked-password protection cannot be verified from here

It is a Supabase Auth dashboard setting, so this repository cannot observe it. `MASTER-TODO.md` still carries *"Resolve the final Turnstile and leaked-password settings"* as an open Euro-2028 item.

Recorded as unknown rather than absent. Enabling it is the cheapest of the three mitigations — one dashboard toggle, no code — and it delivers the breach screening Finding 1 says is missing, without a client-side entropy meter.

## Suggested order

Cheapest-first by risk reduction, as with `ACQ-R10`:

1. **Enable Supabase leaked-password protection.** One setting. Delivers breach screening with no code change and no deploy.
2. **Require `VITE_TURNSTILE_SITE_KEY` in the `production` context** in `validate-netlify-environment.mjs`, alongside the existing Supabase checks. The key is a build-time `VITE_` value, so the validator can already see it — the change is a few lines in a file that is already a fail-closed gate.
3. **Raise the floor to eight**, in the same change on both sign-up and reset, and raise the matching Supabase minimum. Raising only the client is theatre; raising only the server produces a confusing error after submission.

**Sequencing note on item 2.** Arming that gate decides *when a production build is allowed to fail*. Production deploys are already paused on the contract gate, so adding a second reason to fail is cheap now and expensive to discover during a release. It should be armed deliberately, with the key set first.

## What this does not establish

- **No live testing.** No sign-up was attempted against a hosted environment, with or without a key.
- **No assessment of Supabase's own rate limiting** on auth endpoints, which may bound credential stuffing independently of Turnstile. That is platform behaviour this repository cannot see, and it would reduce but not remove the exposure.
- **The dashboard state of leaked-password protection is unknown**, not confirmed absent.
- **No judgement on whether six-character passwords already exist** in production. If they do, raising the floor is a migration question for existing accounts, not only a validation change.
