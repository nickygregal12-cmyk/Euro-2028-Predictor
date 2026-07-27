# ADR 0009 — Privacy-conscious product analytics

- **Status:** Accepted direction
- **Date:** 27 July 2026

## Context

Error monitoring does not answer product questions about activation, prediction-flow drop-off, submission, league participation or retention. The product needs a small, deliberate analytics layer without undoing its privacy posture.

## Decision

Adopt a privacy-conscious analytics provider after DPA and hosting review. Instrument a controlled taxonomy rather than automatic capture.

Initial events:

- `signup_completed`
- `entry_started`
- `group_completed`
- `bracket_completed`
- `entry_submitted`
- `league_created`
- `league_joined`
- `h2h_viewed`
- `share_generated`

Session replay, arbitrary text capture and automatic user profiling are excluded unless separately approved through a documented privacy review.

## Consequences

- Analytics and Sentry remain separate systems with separate purposes.
- CSP, privacy notice, processor register and DPIA notes require updates before production enablement.
- Event names and payload fields are version-controlled.
- Expansion of the taxonomy requires review rather than ad-hoc instrumentation.

## Rejected alternatives

- No analytics: rejected because acquisition, activation and retention decisions would be made without evidence.
- Full session recording by default: rejected as disproportionate to the immediate product questions.
