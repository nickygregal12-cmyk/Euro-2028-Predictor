# Contract 60 production promotion

**Date:** 29 July 2026  
**Production Supabase:** `vkfnsqdyhvtwyqkisxhk`  
**Application release target:** contract-60 release-alignment merge

## Approved scope

The owner explicitly approved bringing production up to date with all completed repository changes. The release target included the current application through PR #178 plus the contract-60 Predictor Cup lint cleanup merged in PR #180.

## Recovery gate

Before any production mutation:

- a fresh encrypted production backup was captured using the stored age public key;
- the plaintext bundle was restored into disposable local Supabase;
- roles, schema, Auth data, public data and canonical migration history were included;
- the restore rehearsal passed against the exact contract-55 baseline;
- plaintext files were shredded before the encrypted artifact upload.

## Database promotion

Production advanced from contract 55 to contract 60 under exact, staged gates:

1. contracts 56–58 were preflighted as the only pending canonical chain;
2. the migration dry run passed;
3. existing row counts were captured;
4. the migrations were applied;
5. every protected count was unchanged;
6. contract 59 replaced the Predictor Cup playoff seat temporary table with an equivalent CTE;
7. contract 60 replaced the qualification temporary table with direct authoritative table-function reads;
8. both function-only migrations passed separate dry runs and preserved-count comparisons;
9. hosted database lint passed at contract 60.

## Preserved production state

The final verification recorded:

- 60 canonical migration-history rows through `20260729110000_predictor_cup_lint_safe_qualification`;
- one Auth user;
- one profile;
- one Original Predictor entry;
- one league and one league member;
- 51 matches;
- 36 saved match predictions;
- zero Bonus Games competitions, entrants, knockout predictions, LMS selections, Cup groups, Cup members, Cup fixtures and Penalty Number rows;
- zero application SQL functions retaining a `pg_temp` or temporary-table dependency.

## Security and rules verification

- anonymous callers cannot execute `clear_my_predictions`;
- authenticated users and service role retain only the intended Account clear capability;
- Predictor Cup qualification and round settlement remain service-role-only;
- the full clean 60-migration rebuild passed;
- database lint, complete pgTAP—including the full Predictor Cup lifecycle—and TypeScript/PostgreSQL parity passed;
- authenticated browser journeys, signup/recovery journeys and exact preview HTTP/Chromium smoke passed;
- contracts 59–60 change implementation mechanics only; qualification, wildcard, seeding, bracket and round-decision rules are unchanged.

## Application publication

The permanent production smoke workflow is pinned to contract 60 and requires an exact 40-character release commit. The milestone closes only after the production Netlify context reports:

- environment `production`;
- application contract 60;
- hosted contract 60;
- production Supabase project `vkfnsqdyhvtwyqkisxhk`;
- the exact release-alignment merge commit;
- a non-local deploy ID;
- green production HTTP and Chromium smoke.
