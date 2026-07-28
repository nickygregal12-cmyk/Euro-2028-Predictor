# Stage 4 evidence — secure other-player profiles

**Date:** 28 July 2026  
**Environment:** development Supabase `iouzoutneyjpugbbtdem` at contract 47  
**Scope:** co-member profile privacy before lock, bounded authoritative detail after lock, outsider denial and hosted response/query-plan evidence.

## Contract

`get_player_profile(uuid,uuid)` preserves the existing private-league/H2H access boundary:

- authenticated callers may always read their own profile;
- another player is readable only when caller and player share a league in the requested tournament;
- before lock, the response contains identity, tournament league count and submitted-entry status only;
- after lock, a submitted entry adds authoritative total points/rank and bounded detail: 36 group predictions, 24 progression rows and 100 score events maximum;
- anonymous execution is denied; authenticated and service-role execution are explicitly allowed;
- the security-definer function has an immutable empty search path.

## Hosted method

A temporary PL/pgSQL evidence function created a rollback-only fixture containing a caller, rival, outsider, shared league, submitted entries, 36 predictions, 24 progression rows and 100 score events. It measured the profile before and after moving the tournament lock, attempted outsider access, captured `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` and intentionally rolled the entire fixture back before returning evidence.

Baseline and post-run counts were identical: 23 Auth users, 23 profiles, 21 entries, 3 leagues, 37 league memberships and 252 score events. No synthetic data was retained.

Timings are single server-side measurements on the shared hosted development project. They exclude network/PostgREST overhead and are evidence of shape and order of magnitude rather than percentile benchmarks.

## Results

| Operation | Duration | Response size | Result |
| --- | ---: | ---: | --- |
| Pre-lock co-member profile | 2.408 ms | 195 B | Identity/league/entry state only; no points or predictions |
| Post-lock full profile | 9.691 ms | 21,273 B | Rank 2; 100 points; 36 predictions; 24 progression rows; 100 score events |
| Outsider attempt | — | — | Denied with SQLSTATE `42501` |
| Measured post-lock execution plan | 4.836 ms | — | 193 shared-buffer hits; zero shared reads; zero temp/local reads or writes |

## Verdict

The other-player profile contract is privacy-preserving and bounded at the current product limits. The pre-lock payload cannot reveal score or prediction detail, the full post-lock payload remains approximately 21 kB at every enforced row cap, and non-co-members are denied server-side. No separate global profile directory was introduced.

Contract 47 is appropriate for development and non-production Netlify. Production remains aligned and locked at contract 44 pending a future approved milestone promotion.
