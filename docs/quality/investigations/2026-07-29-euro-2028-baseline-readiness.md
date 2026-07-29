# Euro 2028 baseline readiness

**Date:** 29 July 2026  
**Candidate:** PR #193  
**Contract:** 63  
**Canonical migration count:** 63  
**Highest migration:** `20260729154931_prediction_consensus_minimum_cohort.sql`

## Current disposition

The repository candidate, development Supabase, production Supabase and every Netlify context declaration are aligned at contract 63. The currently published production application remains the earlier contract-60 artifact until PR #193 passes exact final-head gates, is merged and the resulting production deployment is verified.

No baseline tag has been created.

## Completed reconciliation

- migrations 61–63 are canonical and ordered above the contract-60 baseline;
- contract 61 supplies bounded authenticated post-lock Original Predictor consensus;
- contract 62 activates the approved five-step final standings order only after every tournament result is confirmed or corrected;
- contract 63 suppresses tournament-wide consensus below ten submitted entries, includes the caller and returns an explicit successful suppression state;
- the migration timestamp guard rejects stale or colliding additions against fresh `origin/main`;
- development and production Supabase each contain exactly 63 versions through `20260729154931`;
- production promotion preserved all tracked user, entry, league, match, prediction and Bonus Games counts;
- public/private consensus and final-standings privileges match the approved model;
- all Netlify contexts declare contract 63 and retain correct development/production Supabase separation;
- `DEC-003`, `DEC-004`, `LEAGUE-001` and `PRIV-001` are resolved at the database/implementation layer.

## Remaining baseline gates

1. Exact PR #193 final-head CI passes.
2. Exact PR #193 final-head Database parity passes.
3. Exact PR #193 authenticated Browser E2E and deploy-preview smoke pass against contract 63.
4. PR #193 is merged to `main` without bypassing required checks.
5. The exact contract-63 production application deployment is ready and identifies the expected commit, contract and production Supabase environment.
6. Production HTTP/browser smoke passes.
7. Authority documents record the exact production deploy evidence.
8. The baseline tag command is prepared and independently checked.

## Production preservation evidence

The 60→63 production migration retained:

- one Auth user;
- one profile;
- one entry;
- one league and one league member;
- 51 matches;
- 36 Original match predictions;
- three Bonus Games;
- zero Bonus Games entrants;
- zero Last Man Standing selections;
- zero KO Predictor selections.

The same-day encrypted contract-60 backup/restore evidence remains the recovery point. The production promotion required exactly 60 migrations before writing and verified exactly 63 migrations afterward.

## Prepared tag

Do not run this until every remaining gate above is complete and the exact final `main` commit and production deploy are recorded.

```bash
git tag -a euro-2028-baseline -m "Euro 2028 product baseline. Repository, development Supabase, production Supabase and Netlify aligned at contract 63 with 63 canonical migrations through 20260729154931_prediction_consensus_minimum_cohort.sql. Production deploy: <EXACT DEPLOY ID>. Test evidence: <FINAL CI / DATABASE PARITY / BROWSER E2E / PRODUCTION SMOKE>. Superseded by the multi-competition hub direction (ADR 0011)."
git push origin euro-2028-baseline
```

No tag has been created, moved or deleted.
