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

## Why it audits a local build and not the deploy preview

Because the deploy preview does not measure the product. Two pull requests that changed **no runtime code at all** — the design-authority documentation change and the Knip tooling baseline — scored **20** and **21** on their previews, while the same bundle scores 89–95 here and production scores in the mid-nineties. A tool pointed at the preview would report infrastructure as product quality, and the first thing it would do is send someone hunting for a regression in code that had not changed.

The full evidence and the suspects it cleared are in the execution authority's performance section. What matters for this configuration is the consequence: the collect step builds and serves the application itself, so a score is attributable to a commit.

## What blocks and what warns

Blocking, because a failure is unambiguous and about the product:

- **accessibility must be 100.** The repository already scans every declared route with axe and treats a serious violation as a build failure; a Lighthouse category that permitted 95 would be a quieter standard sitting beside a louder one.
- **SEO at least 90.** Cheap to hold, and a public acquisition page is coming.
- **A route that fails to load at all** fails the run by construction — Lighthouse cannot score a page it cannot fetch, which is the broken-route gate the plan asks for.

Warning only, deliberately:

- **performance, floor 80.** Advisory until repeated runs establish how much it moves between runners. A single number that swings with machine load is a false alarm generator, and the improvement plan's own rule is that a check becomes blocking only after its false positives and runtime are understood.
- **best practices, floor 90.**
- **`errors-in-console`.** This audit runs against a build configured with placeholder credentials and no reachable backend, so the signup page logs one failed request — `ERR_TUNNEL_CONNECTION_FAILED` — every time. That is the harness, not the product. It stays visible as a warning rather than being switched off, because a *second* console error appearing would be worth looking at, and an assertion turned off tells nobody anything.

Two audits are off outright: `unused-javascript` and `uses-long-cache-ttl` describe a CDN and a bundler configuration that a local preview server does not have, and `csp-xss` duplicates the committed content-security-policy parity check, which reads the real headers.

## Not yet a CI job

This lands as a local capability with a recorded baseline, not a workflow. Wiring it into CI needs Chrome on the runner and, more importantly, needs to know how far performance drifts between runs on shared infrastructure before a floor can be set without crying wolf. The rule this follows is the improvement plan's third: new checks begin report-only unless their signal is already stable, and this one's stability is exactly what has not been measured yet.
