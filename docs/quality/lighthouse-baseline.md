# Lighthouse baseline — locally built, fixture-backed routes

**Ran:** 5 August 2026, `npm run check:lighthouse` (Lighthouse CI 0.15 against a production `vite build`).
**Configuration:** [`lighthouserc.json`](../../lighthouserc.json), guarded by `tests/scripts/lighthouseConfiguration.test.ts`.
**Authority for what this feeds:** [`../design/ui-modernisation-execution.md`](../design/ui-modernisation-execution.md).

## The baseline

| Route | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| `/auth/login` | 89 | 100 | 100 | 100 |
| `/auth/signup` | 94 | 100 | 96 | 100 |
| `/auth/reset` | 95 | 100 | 100 | 100 |

These three are the whole unauthenticated route set a production build can serve without a backend. Every other route sits behind the authenticated shell, so auditing it would measure a redirect rather than a page. Extending the set is work for the first new journey, which brings its own fixture-backed routes with it.

**Re-measured 5 August 2026, and the command needed fixing before it could be re-run.** `check:lighthouse` was `lhci autorun` alone, which worked for whoever had a `.env.local` and for nobody else: the application throws `Missing Supabase configuration` at module load, Vite inlines those variables at *build* time so they cannot be supplied to an existing `dist`, and the audit therefore died on a bare `NO_FCP` — "the page did not paint any content". The documented command was unrunnable on a clean checkout, which is also what would have happened had it been promoted to CI as it stood. `scripts/run-lighthouse.mjs` now supplies placeholder configuration when the caller has supplied none, then builds and audits; real values already in the environment are left alone, because Vite gives shell variables precedence over `.env` files and overriding them would audit a configuration the developer is not working on.

Re-run that way on a clean environment, the routes score **94 / 94 / 94** on performance with accessibility 100 throughout and best practices 100 / 96 / 100 — at or above the baseline row above on every route. The one sub-100 best-practices score is `/auth/signup`'s single `errors-in-console` finding, which is also present on `main`.

Worth recording because it removes a reason to build something: **Lighthouse refuses to score a page that painted nothing.** A blank build aborts with `NO_FCP` and `lhci autorun` exits 1 rather than returning flattering numbers, so the "green result from an empty page" failure this repository would otherwise have to guard against cannot occur. A blank-page assertion was written and then deleted for that reason.

## Why it audits a local build and not the deploy preview

Because the deploy preview does not measure the product. Two pull requests that changed **no runtime code at all** — the design-authority documentation change and the Knip tooling baseline — scored **20** and **21** on their previews, while the same bundle scores 89–95 here and production scores in the mid-nineties. A tool pointed at the preview would report infrastructure as product quality, and the first thing it would do is send someone hunting for a regression in code that had not changed.

The full evidence and the suspects it cleared are in the execution authority's performance section. What matters for this configuration is the consequence: the collect step builds and serves the application itself, so a score is attributable to a commit.

## What blocks and what warns

Blocking, because a failure is unambiguous and about the product:

- **accessibility must be 100.** The repository already scans every declared route with axe and treats a serious violation as a build failure; a Lighthouse category that permitted 95 would be a quieter standard sitting beside a louder one.
- **SEO at least 90.** Cheap to hold, and a public acquisition page is coming.
- **performance at least 80.** The measured minimum is 89 and every route is
  collected three times, leaving a nine-point regression budget while damping
  a single noisy sample.
- **best practices at least 90.** The measured minimum is 96.
- **A route that fails to load at all** fails the run by construction — Lighthouse cannot score a page it cannot fetch, which is the broken-route gate the plan asks for.

Warning only, deliberately:

- **`errors-in-console`.** This audit runs against a build configured with placeholder credentials and no reachable backend, so the signup page logs one failed request — `ERR_TUNNEL_CONNECTION_FAILED` — every time. That is the harness, not the product. It stays visible as a warning rather than being switched off, because a *second* console error appearing would be worth looking at, and an assertion turned off tells nobody anything.

Two audits are off outright: `unused-javascript` and `uses-long-cache-ttl` describe a CDN and a bundler configuration that a local preview server does not have, and `csp-xss` duplicates the committed content-security-policy parity check, which reads the real headers.

## CI gate

CI builds the local fixture-backed app and collects each route three times. It
blocks the floors above and retains `.lighthouseci/` for seven days so a failure
can be inspected instead of reduced to one score. This does not audit a deploy
preview or Production and makes no remote writes. CI installs the Chromium
revision pinned by Playwright and passes its exact executable path to Lighthouse;
without that step Lighthouse's health check exits before collecting a page.
