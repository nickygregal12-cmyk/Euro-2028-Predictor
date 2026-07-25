# Current quality status

> This is the live implementation and operations status document. Current `main` code, migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Latest production reconciliation | [`2026-07-25-contract-35-production-promotion.md`](reconciliations/2026-07-25-contract-35-production-promotion.md) |
| Latest recovery acceptance | [`2026-07-25-final-recovery-acceptance.md`](reconciliations/2026-07-25-final-recovery-acceptance.md) |
| Latest formal pre-rollout audit | [`2026-07-25-repeat-verification-audit.md`](audits/2026-07-25-repeat-verification-audit.md), designation `2026-07-25R` |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Approved/deployed source | `902a37aa6c50c967f8080d751147a5733b251fe3` |
| Current production deploy | `6a652c3d3416d26d595ae2ef` |
| Repository application/database contract | 35 |
| Production Netlify declared contract | 35 |
| Repository migration count | 35 |
| Production migration history | exactly 35 canonical versions through `20260724003000` |
| Development Supabase | `iouzoutneyjpugbbtdem` — contract 35 |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — contract 35 |
| Draft migration 36 | PR #76 only; unmerged and unapplied |

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue controlled development.** Architecture, CI, database parity and browser E2E provide strong repository/disposable evidence. |
| Production application/database pair | **Compatible and verified at contract 35.** The former two-RPC mismatch is resolved. |
| Production database rollout | **Complete.** History records exactly migrations 1–35, the final dry run is zero-pending and 63/63 post-rollout checks passed. |
| Production application promotion | **Complete.** Netlify serves the approved commit and production contract 35. |
| Environment isolation | **Verified.** Production uses production Supabase; deploy-preview, branch-deploy and dev use development Supabase. |
| Recovery readiness | **Technically proven and accepted.** The encrypted artifact, corrected clean restore and forward rehearsal passed. |
| Migration 36 | **Draft only.** PR #76 remains outside current authority. |
| Tournament launch readiness | **Not ready.** Monitoring, admin journeys, official data, Auth/CAPTCHA decisions, accessibility review and full dress rehearsal remain incomplete. |

## Completed production contract-35 rollout

The production operation completed on 25 July 2026 with separate explicit approvals for the database and Netlify changes.

Database evidence:

- exact contract-20 preflight passed before writes;
- metadata-only history repair recorded exactly migrations 1–20;
- the dry run listed exactly migrations 21–35;
- migrations 21–35 applied in timestamp order;
- migration history contains exactly 35 canonical rows;
- the final dry run reports the remote database is up to date;
- migration 36 was absent and not applied;
- all source counts, the submitted timestamp and all three rollout fingerprints remained unchanged;
- exactly 24 derived group-position rows were created;
- no score, result, revision or rank-history data was invented.

The committed verifier returned exactly 63 passing checks before and after rollback-only smoke operations. Authenticated atomic bracket replacement and submission settlement passed. Service-role result confirmation/clearing passed while direct revision-table access remained denied. Every smoke write rolled back.

Security advisors returned no `ERROR` finding. Remaining warnings are documented non-blocking items: intentional authenticated `SECURITY DEFINER` RPCs, internal RLS tables without browser policies, the trigger-only `enforce_joker_rules` search-path warning and leaked-password protection disabled.

## Current production source state

| Object | Verified value |
| --- | ---: |
| Auth users | 1 |
| Profiles | 1 |
| Entries | 1 |
| Submitted entries | 1 |
| Submitted timestamp | `2026-07-21T21:51:49.639442+00:00` |
| Match predictions | 36 |
| Predicted tie resolutions | 2 |
| Predicted progression rows | 8 |
| Derived group-position rows | 24 |
| Stored/non-scheduled results | 0 |
| Result revisions | 0 |
| Score events | 0 |
| Rank-history rows | 0 |

Preserved fingerprints:

- predictions `320cf25d62767dee307d3602212909af`;
- ties `a4dcf183f5c48e3ba11ff75c59622598`;
- progression `0d7bc491daa9b24013204d061a2d38f1`.

Total users, profiles and unsubmitted entries may legitimately change after this evidence point and are not permanent rollout guards.

## Current Netlify and live-site state

Production Netlify now declares contract 35 and serves:

- deploy `6a652c3d3416d26d595ae2ef`;
- source `902a37aa6c50c967f8080d751147a5733b251fe3`;
- production Supabase `vkfnsqdyhvtwyqkisxhk`;
- no deploy build error;
- no secret-scan match;
- processed SPA redirect and security-header rules.

Current context matrix:

| Context | Supabase project | Declared DB contract |
| --- | --- | ---: |
| `production` | production `vkfnsqdyhvtwyqkisxhk` | 35 |
| `deploy-preview` | development `iouzoutneyjpugbbtdem` | 35 |
| `branch-deploy` | development `iouzoutneyjpugbbtdem` | 35 |
| `dev` | development `iouzoutneyjpugbbtdem` | 35 |

Live read-only verification passed:

- production and immutable deploy roots returned HTTP 200 and identical HTML;
- title, description, canonical URL and React root were correct;
- CSP, HSTS, frame denial, MIME-sniffing protection, referrer policy and permissions policy were present;
- tested SPA paths returned the application shell;
- initial JavaScript and CSS assets returned HTTP 200;
- the complete configured Supabase URL was production;
- the complete development Supabase URL was absent;
- the bare development reference in the bundle was confirmed as fail-closed auto-login guard data;
- no browser request targeted development or an unexpected Supabase host;
- login, signup, reset, protected-route and not-found anonymous journeys passed.

No anonymous form was submitted and the live verification performed no database write.

## Recovery status — `OPS-003`

The accepted recovery artifact and corrected restore procedure are proven:

- encrypted off-device custody, retrieval and checksum verification passed;
- restricted decryption, archive-safety and plaintext checks passed;
- a genuinely empty hosted target was restored using the corrected privilege-preparation sequence;
- Auth/profile/Storage and signup-trigger checks passed;
- history repair and migrations 21–35 passed;
- all 63 post-rollout checks, advisors and rollback-only smoke tests passed without manual ACL repair.

Recovery proof and the production execution portion of `OPS-003` are complete. The broader finding remains open for monitoring, alert ownership, periodic recovery rehearsal and final launch rollback readiness.

## Repository and test position

Current workflows provide:

- lockfile install, guarded build/type-check, Oxlint, Vitest and production dependency audit;
- full disposable 35-migration rebuild, database lint, pgTAP and TypeScript/PostgreSQL parity;
- authenticated Playwright journeys against disposable local Supabase;
- desktop and phone-width route, prediction, submission, conflict and lock journeys;
- signup, email confirmation and password-recovery journeys;
- keyboard skip-link, route-focus and live-region evidence;
- private league create/invite/join evidence;
- signed-out invite persistence through confirmation and Welcome;
- anonymous production application/environment smoke evidence.

`TEST-001` remains partial. Missing evidence includes browser result administration, manual screen-reader review and carefully controlled authenticated production browser mutation journeys.

## Feature and safeguard status

Production contract 35 now supports:

- canonical predicted group ordering and exact manual tie decisions;
- RPC-only submission and server-derived group positions;
- same-tournament, ownership, version and lock guards;
- authoritative result lifecycle and immutable revisions;
- serialized scoring recomputation;
- real winner propagation and full predicted bracket replay;
- expected-version atomic complete-bracket replacement;
- pending-write settlement before submission;
- version-safe persisted score clearing and derived-position invalidation;
- exact function execution allowlists, zero anonymous application execution and closed future defaults.

Still partial or planned:

- trustworthy privacy-reviewed signed-out invite context before signup (`UX-001`);
- remaining unavailable/error/empty data consumers (`UX-002`);
- other-player full profile and richer H2H;
- expanded Match Centre phases;
- browser result administration and an approved admin authorization model;
- automatic valid-entry submission and reminders;
- actual R16 population and unresolved actual-tie workflow;
- post-lock prediction trends;
- KO Predictor, Last Man Standing and Predictor Cup.

Bonus competitions remain separate planned products. No bonus game is implemented merely because it appears in design or roadmap documents.

## Current finding positions

### Resolved by the production rollout

- `OPS-006` — the application/database incompatibility is closed;
- `DATA-001` — production group positions are server-derived and protected;
- `SECURITY-001` — browser writes to server-owned positions are denied;
- `SECURITY-002` — submission state is protected by the RPC boundary;
- `DATA-002` — authoritative result method/winner/revision controls are deployed;
- `SECURITY-003` — exact production function allowlists and closed defaults are deployed;
- `FUNC-001` — production bracket-tree replay and validation are deployed;
- `REL-001` — serialized production scoring/result operations are deployed;
- `REL-003` — settlement is implemented and the production submission smoke passed;
- `REL-004` — atomic bracket replacement is deployed and smoke-tested.

### Still open or partial

- `DATA-003`, `DATA-006` — wider reference integrity; draft PR #76 is not authority;
- `DATA-005`, `REL-007` — production backend is deployed, but final authenticated production browser evidence remains under `TEST-001`;
- `FUNC-002`, `DATA-004`, `OPS-002` — automatic submission, actual-tie workflow and administrator model;
- `TEST-001` — partial as described above;
- `OPS-003` — monitoring and final rollback readiness remain;
- `OPS-008`, `AUTH-001` — legacy environment and Turnstile/CAPTCHA work;
- `A11Y-001`, `UX-001`, `UX-002`, `UX-003` — remaining experience/accessibility work;
- `TYPE-001`, `PERF-001`, `PERF-002`, `SEC-001`, `DATA-007` — typing, performance and abuse controls;
- `SEO-001`, `SEO-002`, `REPO-001`, `DOC-002`, `DOC-003`, `CODE-001`, `HYGIENE-002` — maintenance and policy work.

## Scoring status

`docs/scoring-rules.md`, TypeScript configuration, SQL scorer and tests remain aligned:

- group result 3;
- exact group score 5 total;
- five Jokers, doubling group-match points only;
- group positions 2 each plus 5 complete-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group-goals bands 40 / 30 / 20, tiered.

The rollout changed no scoring value.

## Immediate order of work

1. Merge the contract-35 production documentation reconciliation after checks pass.
2. Add production error reporting, alert ownership and critical-journey monitoring.
3. Resolve the approved production/non-production Turnstile and development CAPTCHA model; verify preview auth.
4. Review leaked-password protection as a separate Auth change.
5. Verify GitHub branch protection and required checks.
6. Keep the legacy World Cup-sourced Netlify site under its separate owner workstream.
7. Complete wider reference integrity; keep PR #76 and migration 36 separate until reviewed.
8. Define the administrator authorization model and browser result-management path.
9. Add controlled authenticated production browser smoke without damaging retained user predictions.
10. Complete manual screen-reader review and the full tournament dress rehearsal.
11. Replace provisional tournament data only from authoritative sources when available.

## Documentation authority

Use sources in this order:

1. current `main` code, migrations and executable tests;
2. verified current hosted evidence;
3. this file;
4. latest formal audit and reconciliation notes;
5. feature baseline and risk register;
6. historical audits;
7. roadmap/TODO for future intent only.

Do not claim contract 36, preview-auth verification or tournament-launch readiness until the corresponding evidence gates pass.