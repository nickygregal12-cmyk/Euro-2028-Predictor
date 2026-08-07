# Production contract-63 object baseline

**Captured:** 6 August 2026  
**Source:** Hosted Production Supabase `vkfnsqdyhvtwyqkisxhk`  
**Mode:** Read-only metadata and aggregate counts only  
**Authority:** Evidence for PR #545. This record does not authorise a migration, deployment, backup, restore or production write.

## Migration identity

| Field | Verified value |
| --- | --- |
| Applied migration count | **63** |
| Latest version | `20260729154931` |
| Latest migration | `prediction_consensus_minimum_cohort` |
| Development control | **125** migrations through `20260806160000_season_fixture_result_entry` |

The hosted Production history reproduces the repository's recorded contract-63 baseline. No migration-history drift was found.

## Object surface fingerprint

The fingerprints below are MD5 digests over sorted PostgreSQL catalogue metadata. They contain no table rows or user values. They are evidence identifiers, not security hashes.

| Surface | Production count | Production fingerprint | Development count | Development fingerprint |
| --- | ---: | --- | ---: | --- |
| Relations in `public` + `predictor_internal` | 36 | `52a52b1588c2dfc8bc3daf5c91a5bf00` | 60 | `82a3e258d4c567b39de5f58ad8d76bec` |
| Routines in `public` + `predictor_internal` | 128 | `f169bf05da2b60b0235bcdba753f5daf` | 262 | `14fa5e1be7023220165dfc24c2478aa1` |
| Non-internal triggers | 43 | `d8d2441fcc96ea437e49f2ef5463a85f` | 100 | `a712faca0362b3971dd45f1a6ec4fe12` |
| RLS policies | 20 | `f133e74bee2a864abae199564a6f71f3` | 21 | `0cacacb90676ecf4f9318da09b858559` |

The Development difference is expected and must not be described as drift: Development carries contracts 64–125. The unresolved parity question is whether Production's contract-63 fingerprint matches a clean contract-63 rebuild. That requires the disposable restore/rebuild evidence and cannot be proven by comparing Production directly with contract 125.

## Extension and scheduler boundary

| Item | Production reading |
| --- | --- |
| PostgreSQL | managed 17 series |
| `pg_cron` | installed, version `1.6.4` |
| `supabase_vault` | installed, version `0.3.1` |
| `pg_net` | not installed |
| Active cron jobs | one |
| Active command | `select public.process_due_entry_submissions();` |
| Schedule | every minute |
| Provider polling job | absent |

This is the correct pre-provider boundary. Contracts that install or use `pg_net`, provider targets or provider polling must not be included accidentally in an earlier batch.

## Critical aggregate source counts

No identities, names, emails, prediction values or row contents were retrieved.

| Object | Rows |
| --- | ---: |
| `auth.users` | 1 |
| `public.profiles` | 1 |
| `public.tournaments` | 1 |
| `public.teams` | 24 |
| `public.matches` | 51 |
| `public.entries` | 1 |
| `public.match_predictions` | 36 |
| `public.leagues` | 1 |
| `public.league_members` | 1 |
| `public.score_events` | 0 |
| `public.entry_totals` | 1 |

These values become forward-rehearsal invariants. A migration may create new empty structures or legitimately derive rows only where its reviewed contract explicitly says so. Any unexplained change to these source counts is a stop condition.

## Security-advisor classification boundary

The read-only hosted advisor reports:

- `public.enforce_joker_rules` with mutable `search_path`;
- leaked-password protection disabled;
- multiple `RLS enabled, no policy` informational findings;
- multiple browser-executable `SECURITY DEFINER` warnings.

These are not all equivalent:

1. Leaked-password protection is a hosted Auth setting and is outside migration promotion.
2. RPC-only tables with RLS and no direct policy may be intentional fail-closed storage.
3. Browser-executable `SECURITY DEFINER` functions must be checked against their internal caller/ownership gates and the repository RPC allowlist; advisor wording alone cannot determine exposure.
4. The mutable search path warning requires comparison with later migrations to determine whether the promotion already fixes it or whether it remains a separate defect.

No advisor finding is silently waived. Each must be mapped to accepted architecture, an existing risk identifier, a later correcting contract or a new blocker before the first batch is authorised.

## Current conclusion

The contract-63 migration identity and first hosted boundary reproduce cleanly. No provider infrastructure has appeared early, and no source-data anomaly is visible from the aggregate baseline.

The first batch is **not ready**. Remaining gates are:

- compare this fingerprint with a clean contract-63 rebuild or restored production backup;
- classify migrations 64 onward and identify the first dependency-complete endpoint;
- verify Netlify's current production source commit and contract environment value;
- verify backup workflow pins and secret availability without exposing secret values;
- run performance advisors and finish security-advisor classification;
- create a fresh encrypted backup and forward rehearsal before any production-changing instruction.
