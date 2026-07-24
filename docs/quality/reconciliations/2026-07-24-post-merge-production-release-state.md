# Post-merge production release state

**Date:** 24 July 2026  
**Repository:** `nickygregal12-cmyk/Euro-2028-Predictor`  
**Production application-code baseline:** `a403b0796853453cb4115aea55729aced192a6ca`  
**Initial PR #20 production deploy:** `6a62c49dfaa87100087a6ab1`  
**First docs-only descendant deploy:** commit `83e071c2c971ba16cffd8de6ae8fb92ffff5e7a3`, deploy `6a62c93afeb9b400086e1e3f`  
**Production Supabase:** `vkfnsqdyhvtwyqkisxhk`

## Release identity rule

Netlify creates a new production release commit for every deployable `main` merge, including documentation-only merges. Therefore:

- the **application-code baseline** identifies the last commit that changed executable application/database-dependent client behavior;
- a later **release commit** may be a documentation-only descendant with identical built application code;
- active documents must not treat one Netlify release hash as permanently current;
- verify the current deploy through Netlify at the time of an operation and compare its code changes with the application-code baseline.

PR #20’s squash merge `a403b079` is the application-code baseline that introduced the version-safe score-clearing client while retaining the previously deployed atomic bracket client. PR #21’s docs-only merge `83e071c2` produced a new Netlify release but did not change executable application code or the compatibility verdict. Later docs-only descendants should be treated the same unless their diff changes executable/configuration files.

## Verdict

The production application code includes both the atomic bracket client and the version-safe score-clearing client, while production Supabase remains on the original twenty-migration schema.

The live production application/database pair is incompatible at two known write boundaries:

1. bracket persistence calls `replace_predicted_progression(...)`, which production does not contain;
2. persisted score clearing calls `delete_match_prediction(...)`, which production does not contain.

Production was not migrated or configured during these verifications. Automatic application and docs-only deployments did not alter production data or database privileges.

## Netlify evidence

### Application-code deployment

Netlify published PR #20’s application-code baseline:

- commit `a403b0796853453cb4115aea55729aced192a6ca`;
- deploy ID `6a62c49dfaa87100087a6ab1`;
- branch/context `main` / `production`;
- published at `2026-07-24T01:49:38.591Z`;
- state `ready`;
- Lighthouse averages: performance 97, accessibility 100, best practices 100, SEO 100;
- secret scan: 401 files scanned, no matches.

### Documentation-only descendant deployment

After PR #21 reconciled the hosted state, Netlify published:

- commit `83e071c2c971ba16cffd8de6ae8fb92ffff5e7a3`;
- deploy ID `6a62c93afeb9b400086e1e3f`;
- published at `2026-07-24T02:09:20.981Z`;
- Lighthouse averages: performance 98, accessibility 100, best practices 100, SEO 100;
- secret scan: 402 files scanned, no matches;
- deploy summary: all built files were already uploaded from an equivalent prior build, with no functions or edge functions deployed.

This docs-only release changed the Netlify commit/deploy identity but not the executable application compatibility boundary.

A successful static build or docs-only deployment does not prove database compatibility.

## Production Supabase read-only verification

A read-only query after the application-code deploy confirmed:

- `replace_predicted_progression(uuid,jsonb,jsonb)` does not exist;
- `delete_match_prediction(uuid,uuid,integer)` does not exist;
- authenticated users still have direct insert/update/delete privileges on `predicted_progression`;
- authenticated users still have direct delete privilege on `match_predictions`;
- both tables retain the old broad owner `ALL` policies;
- `supabase_migrations.schema_migrations` does not exist;
- no match result score is stored.

Production counts at verification time:

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

Clearing a previously persisted complete score queues the protected deletion RPC, but production lacks that RPC. The shared save controller should surface a save error after retries rather than reporting a successful clear. A reload can therefore restore the old stored score until migration 35 is deployed.

This is fail-closed compared with silently claiming the deletion succeeded, but the production feature is not operational.

### Other writes

The old production schema still permits direct table writes that migrations 21–35 are designed to remove. The deployed client does not make those old direct bracket/delete writes as a fallback.

## Required recovery path

The reviewed recovery path remains the complete migrations 21–35 rollout, not an isolated RPC patch:

1. obtain verified production backup/recovery evidence;
2. name the operator, recovery decision owner and change window;
3. verify the current Netlify release and confirm its executable code is compatible with the `a403b079` application-code baseline or another explicitly reviewed baseline;
4. rerun the baseline and source-data preflights;
5. apply only the prepared metadata repair for proven migrations 1–20;
6. require a dry run showing migrations 21–35 only;
7. obtain explicit owner approval;
8. apply the full chain in timestamp order;
9. run the exact post-rollout verifier and security advisors;
10. browser-verify bracket save/reload, immediate final-edit submission and score clear/reload/conflict/lock behavior;
11. record the compatible application-code baseline, current Netlify release and database schema pair.

Do not apply migration 33, 34 or 35 alone. Do not point production at development Supabase.

## Documentation consequence

Historical audits remain unchanged. Active documents should identify `a403b079` as the application-code baseline responsible for the two RPC dependencies, while treating later docs-only Netlify release commits as descendants that do not alter the technical verdict.

The exact current release commit must be verified from Netlify during an operational change rather than hard-coded as a permanent fact.
