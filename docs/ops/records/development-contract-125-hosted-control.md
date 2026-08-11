# Development contract-125 hosted control

**Captured:** 6 August 2026  
**Project:** `iouzoutneyjpugbbtdem`  
**Mode:** Read-only hosted metadata  
**Purpose:** Control evidence for the production contract-gap assessment.

## Verified state

| Field | Development reading |
| --- | --- |
| Applied migrations | 125 |
| Latest migration | `20260806160000_season_fixture_result_entry` |
| Relations in `public` + `predictor_internal` | 60 |
| Routines in `public` + `predictor_internal` | 262 |
| Non-internal triggers | 100 |
| RLS policies | 21 |
| `pg_cron` | installed, 1.6.4 |
| `pg_net` | installed, 0.20.4 |
| `supabase_vault` | installed, 0.3.1 |

## Active scheduler state

| Job | Schedule | Command |
| ---: | --- | --- |
| 1 | every minute | `process_due_entry_submissions()` |
| 2 | every minute | `process_due_season_matchweek_submissions()` |
| 3 | hourly | `process_due_season_lms_settlements()` |
| 4 | hourly at minute 30 | `process_due_season_matchweek_scores()` |
| 5 | hourly at minute 15 | `process_due_lms_restarts()` |
| 6 | every five minutes | `dispatch_due_provider_polls()` |

This control confirms why contract 115 belongs in the final promotion batch rather than the first foundation batch: Development has an installed outbound extension and active dispatch scheduler that Production correctly does not yet have.

The presence of the dispatch job does not prove provider credentials or targets exist and does not authorise reading or copying them. No provider request was made during this assessment.
