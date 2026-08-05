# Tournament Bonus Games recompute: a completion gate with no writer yet

**Date:** 5 August 2026
**Scope:** read-only investigation. Nothing under `supabase/`, `src/`, `tests/` or `scripts/` was changed. This document and the `docs/quality/current-status.md` correction recorded in the same session are the only changes.
**Baseline:** `origin/main` at `653511a999a57b9dffa1894fd322c61b3c60627f`, repository contract 105.

## Finding

`supabase/migrations/20260805001000_live_competition_callers.sql` (contract 104) redefines two `predictor_internal` functions that recompute the tournament's Bonus Games from confirmed match results:

- `recompute_ko_predictor_for_match(p_match_id uuid)`
- `recompute_lms_for_tournament(p_tournament_id uuid)`

Both now resolve their target competition through `predictor_internal.live_competition_id(tournament_id, game_key)` and return immediately (no-op) when it comes back null:

```sql
v_competition_id := predictor_internal.live_competition_id(
  v_match.tournament_id, 'ko_predictor'
);

if v_competition_id is null then
  return;
end if;
```

`live_competition_id` (contract 103, `20260804333000_competition_instance_lineage.sql:220`) is defined as `where … visibility_kind = 'public' and completed_at is null` — it exists specifically to exclude a completed competition.

**Before contract 104**, both functions matched purely on `tournament_id` and `game_key`, with no `completed_at` condition at all (`supabase/migrations/20260804283000_bonus_rederive_tournament_lock.sql:98-127`). They rederived unconditionally, regardless of whether the competition had finished.

So contract 104 introduced a genuine behavioural change: **a KO Predictor or Last Man Standing competition that is marked complete can no longer have its Bonus Games scores/eliminations rederived**, even though the trigger chain that calls these functions (`recompute_bonus_scores_on_result`, fired from `admin_correct_match_result`) is exactly the path a post-confirmation correction takes.

## Why this matters

Two places in the same codebase disagree, in writing, about whether "completed" should ever gate a rederive:

- Contract 104's own header states the rationale as "Operational callers require the live public row" — i.e. deliberate.
- Contract 89's season Last Man Standing settlement job (`supabase/migrations/20260804173000_lms_settlement_job.sql:1-20`) does the opposite on purpose, and explains why at length: completion there is *derived* every run and *cleared* the moment a replay stops being terminal, specifically because *"a result restated after a competition finished — exactly when a final standing is disputed — could never re-derive, and the wrong player would keep the title for ever."*

CLAUDE.md states corrections are a normal, expected, audited operation ("Database rules are authoritative for … results") and that confirmation, not completion, is the gate. A silent no-op on the tournament path contradicts the season path's explicit design precedent for the identical problem, and would defeat the correction guarantee without raising an error anywhere.

## Verified: not reachable today

I checked every writer of `bonus_competitions.completed_at` in the committed migrations:

| Writer | Scope |
| --- | --- |
| `predictor_internal.settle_season_lms_competition` (contract 89) | `game_key = 'last_man_standing'`, but only for `tournaments.kind = 'league_season'` rows — see the driving job `public.process_due_season_lms_settlements`, which filters `t.kind = 'league_season'` explicitly |
| Predictor Cup knockout final settlement (`20260729050000_predictor_cup_knockouts.sql:912`) | `game_key = 'predictor_cup'` only |
| Contract 103 backfill (`20260804333000_competition_instance_lineage.sql`) | one-time backfill of existing rows, not a live write path |

`recompute_ko_predictor_for_match` and `recompute_lms_for_tournament` only ever resolve `game_key in ('ko_predictor', 'last_man_standing')`. No writer sets `completed_at` on a `ko_predictor` or `last_man_standing` row belonging to a **tournament**-kind competition (Euro 2028 is the only one that exists, and it is `kind = 'tournament'`, not `'league_season'`). `restart_all_reentered` — the one remaining ADR 0013 endgame, and the likeliest future writer of this kind — is confirmed unimplemented anywhere in the repository (`tests/database-parity/liveCompetitionCallerBoundary.test.ts:71-72` explicitly pins that contract 104's migration contains neither `restart_all_reentered` nor `public_wipeout_restart`).

So there is no reachable defect to reproduce against either hosted environment today, and this is recorded as a latent risk rather than a live one.

## Why it is not fixed here

This repository holds every scoring-authoritative SQL change to pgTAP and TypeScript/PostgreSQL parity evidence proven against a real database (`supabase test db --local`, disposable Supabase). This session's sandbox has outbound network access limited to an allow-listed proxy; pulling the Postgres/Supabase container images required for `supabase start` fails closed (`docker pull` and `supabase start` both returned `403 Forbidden` from the registry). There is no local Postgres available to prove a fix, and CLAUDE.md's own instruction is to fail closed rather than land an unverified change to scoring-authoritative SQL: *"if an action could compromise tournament integrity and you're unsure, don't do it — report it instead."* Writing a plausible-looking SQL fix with no pgTAP evidence would be exactly the failure mode this repository's evidence culture exists to prevent, so this document reports the finding rather than attempting the change blind.

## Recommendation

Before any future path writes `completed_at` on a tournament-kind `ko_predictor` or `last_man_standing` row — most plausibly if the LMS restart/wipeout driver (ADR 0025 decision 1) is ever generalised beyond `league_season` scope — resolve one of:

1. Give `recompute_ko_predictor_for_match` / `recompute_lms_for_tournament` a resolver that includes the latest completed competition too (mirroring `predictor_internal.current_public_competition_id`'s fallback), so a correction can still reach it; or
2. Explicitly decide, with the same rigour contract 89 applied to the season path, that a completed tournament Bonus Games competition is deliberately frozen against correction — and prove that decision with a pgTAP case the way `152_euro_post_lock_reveal_scope.sql` proves the reveal-scope decisions, rather than leaving it as an unstated side effect of contract 104's routing choice.

Either way, this is a scoring-authority decision under CLAUDE.md ("No scoring or rule change without authority and test updates") and needs a database engineer with real Postgres access to prove it, not a text-only patch.

## Related correction made in the same session

`docs/quality/current-status.md`'s "Next executable issue" row still described contract 105 as the LMS restart lifecycle function. It shipped as the Cup split-ancestry/derived-standings work instead (`20260805010000_cup_split_group_tables.sql`); the restart driver remains unbuilt. Corrected in place alongside this document.

---

## Resolution — 5 August 2026, contract 106

**Remedy 1 was taken.** Both `recompute_ko_predictor_for_match` and
`recompute_lms_for_tournament` now resolve through
`predictor_internal.current_public_competition_id`, which prefers the live
public instance and otherwise returns the most recently completed one — the
fallback this document recommended. `20260805020000_terminal_aware_bonus_rederive.sql`
changes one call in each function and nothing else.

The proof is behavioural rather than structural, because a check that the
function *names* the right resolver would pass against a body that still
returned early. `supabase/tests/157_terminal_aware_bonus_rederive.sql` completes
a KO Predictor competition, corrects its result from 2-1 to 0-2, and requires
both entrants' stored scores to fall to zero. Mutating the resolver back to the
live-only reader kills six of its fourteen assertions.

**The timing was not incidental.** This document recorded the risk as latent
because no writer set `completed_at` on a tournament-kind `ko_predictor` or
`last_man_standing` row. Contract 107 — the Last Man Standing restart driver —
is exactly such a writer. Closing this first was the precondition for landing
it, which is why contract 106 sits between the caller work and the driver
rather than after them.

Verified on development: neither function retains a `live_competition_id` call.
