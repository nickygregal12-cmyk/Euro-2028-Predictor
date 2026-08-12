# ADR 0029: Private AI Lab and paid-odds custody

**Status:** Implemented in the repository at contract 184; hosted rollout pending

**Date:** 12 August 2026

## Context

The supplied AI Lab models nine English and Scottish divisions and records
predictions, paper selections, settlement and closing-line value. Its first
integration pass left the live lifecycle incomplete: some prices had no
canonical fixture, seven leagues depended on `public.season_fixtures`, live
season progress used a ten-day prediction window, and settlement could make
missing CLV permanent.

The project already has a server-only provider boundary. Provider credentials
belong in Supabase Edge Function secrets and raw responses are retained before
processing. A paid Odds API key is also present there. The fourth football-data
candidate, SportDB.dev, has not yet passed the capability, response-contract
and retention/licensing audit required by the provider-enrichment plan.

## Decision

1. The AI Lab is a private analytical subsystem in schema `ai`. It has no
   authority over platform fixtures, official results, scoring, locks,
   standings, progression, memberships or player predictions.
2. The lab's canonical fixture is `ai.fixtures`. A link to
   `public.season_fixtures` is optional, so all nine leagues use the same
   prediction, grading and paper-betting lifecycle.
3. Odds rows written by either the free Football-Data.co.uk feed or the paid
   API must resolve to `ai.fixtures.id`. Unmatched paid events remain visible
   as custody evidence and cannot enter value selection.
4. The paid key is read only by `provider-poll`. The credential is appended to
   a separate fetch URL; the archived URL is captured first and a database
   constraint refuses credential-shaped query parameters.
5. Paid collection is installed disabled. Enabling it is an explicit
   Development operation after contract 184 and the Edge Function are hosted.
   A monthly soft cap and provider-reported usage are checked and retained.
6. The default is paper betting. Model promotion remains a human admin action;
   artefacts are insert-only and SHA-verified. This work does not turn the free
   prediction product into a gambling product or expose betting to players.
7. SportMonks, API-Football and football-data.org retain their existing
   fixture-evidence authority. SportDB.dev is not activated by this decision;
   its secret being present is not evidence that its schema, entitlement or
   retention terms are safe to depend on.

## Consequences

- One database lifecycle test covers the lower-league path and the EPL path
  where the platform result arrives before a closing line.
- Free historical CSVs provide long-run results and 1X2/O-U/AH prices; the
  twice-weekly fixtures CSV supplies early prices across nine divisions. Paid
  odds add sharper 1X2 and totals snapshots where the subscription covers them.
- Closing-line settlement waits rather than permanently recording a null CLV.
- Browser roles have no direct access to `ai`; bounded reads reuse the existing
  competition-admin gate.
- Production remains a separately authorised migration and function rollout.

## Rejected alternatives

- Putting the Odds API key in GitHub Actions or Python environment files: this
  creates another secret boundary and makes sanitized archival harder to prove.
- Writing paid odds through the platform fixture decoder: odds are analytical
  evidence, not a fixture or official-result source.
- Activating SportDB.dev on the existence of a secret alone: it would bypass the
  accepted capability and licensing audit.
- Settling bets without a closing benchmark: it makes the primary evidence
  metric permanently dependent on job timing.
