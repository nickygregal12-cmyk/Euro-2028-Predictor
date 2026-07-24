# Post-merge production release state

**Date:** 24 July 2026  
**Repository:** `nickygregal12-cmyk/Euro-2028-Predictor`  
**Production application commit:** `a403b0796853453cb4115aea55729aced192a6ca`  
**Production Netlify deploy:** `6a62c49dfaa87100087a6ab1`  
**Production Supabase:** `vkfnsqdyhvtwyqkisxhk`

## Verdict

PR #20 was squash-merged into `main` and Netlify automatically published the merge to production. The production application now includes both the atomic bracket client and the version-safe score-clearing client, while production Supabase remains on the original twenty-migration schema.

The live production application/database pair is therefore incompatible at two known write boundaries:

1. bracket persistence calls `replace_predicted_progression(...)`, which production does not contain;
2. persisted score clearing calls `delete_match_prediction(...)`, which production does not contain.

Production was not migrated or configured during this verification. The automatic application deployment broadened the already-known `OPS-006` mismatch; it did not alter production data or database privileges.

## Netlify evidence

The production Netlify project automatically published:

- commit `a403b0796853453cb4115aea55729aced192a6ca`;
- deploy ID `6a62c49dfaa87100087a6ab1`;
- branch/context `main` / `production`;
- published at `2026-07-24T01:49:38.591Z`;
- state `ready`;
- Lighthouse averages: performance 97, accessibility 100, best practices 100, SEO 100;
- secret scan: 401 files scanned, no matches.

The deployment succeeded as a static application build. That does not prove database compatibility.

## Production Supabase read-only verification

A read-only query after the deploy confirmed:

- `replace_predicted_progression(uuid,jsonb,jsonb)` does not exist;
- `delete_match_prediction(uuid,uuid,integer)` does not exist;
- authenticated users still have direct insert/update/delete privileges on `predicted_progression`;
- authenticated users still have direct delete privilege on `match_predictions`;
- both tables retain the old broad owner `ALL` policies;
- `supabase_migrations.schema_migrations` does not exist;
- no match result score is stored.

Current production counts at verification time:

| Object | Count |
| --- | ---: |
| Profiles | 4 |
| Entries | 4 |
| Submitted entries | 1 |
| Match predictions | 36 |
| Predicted tie resolutions | 2 |
| Predicted progression rows | 8 |
| Matches with stored scores | 0 |

The increase from the earlier audit’s three profiles/entries to four is current live data, not evidence of a migration or anomaly by itself. No row was changed during this inspection.

## User-visible implications

### Bracket persistence

The deployed bracket save path calls an absent RPC. Bracket edits are expected to fail rather than persist atomically.

### Persisted score clearing

Clearing a previously persisted complete score now queues the protected deletion RPC, but production lacks that RPC. The shared save controller should surface a save error after retries rather than reporting a successful clear. A reload can therefore restore the old stored score until migration 35 is deployed.

This is fail-closed compared with silently claiming the deletion succeeded, but the production feature is not operational.

### Other writes

The old production schema still permits direct table writes that migrations 21–35 are designed to remove. The deployed client does not make those old direct bracket/delete writes as a fallback.

## Required recovery path

The reviewed recovery path remains the complete migrations 21–35 rollout, not an isolated RPC patch:

1. obtain verified production backup/recovery evidence;
2. name the operator, recovery decision owner and change window;
3. rerun the baseline and source-data preflights;
4. apply only the prepared metadata repair for proven migrations 1–20;
5. require a dry run showing migrations 21–35 only;
6. obtain explicit owner approval;
7. apply the full chain in timestamp order;
8. run the exact post-rollout verifier and security advisors;
9. browser-verify bracket save/reload, immediate final-edit submission and score clear/reload/conflict/lock behavior;
10. record the compatible application/schema pair.

Do not apply migration 33, 34 or 35 alone. Do not point production at development Supabase.

## Documentation consequence

Active documents that described production merely as the post-PR #14 client were stale immediately after the automatic merge deployment. They must now identify commit `a403b079` and both absent RPC boundaries.

Historical audit files remain unchanged. This reconciliation and the active current-status documents supersede their older production-release identity.
