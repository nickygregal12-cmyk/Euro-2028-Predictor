# Agent operating rules

Read this file and `docs/quality/current-status.md` before changing the repository.

## Authority order

Use evidence in this order:

1. current `main` code, migrations and executable tests;
2. verified hosted Netlify/Supabase evidence;
3. `docs/quality/current-status.md`;
4. `docs/roadmap.md` for future sequence;
5. dated reconciliations and older audits for historical evidence only.

Never import features, scoring values or game rules from previous World Cup projects, old branches, prototypes, chats or similarly named modes.

## Current baseline

Repository and development Supabase are at contract `51`; non-production Netlify declares `50` pending an owner environment update; production database and application are intentionally aligned and locked at contract `44`.

- canonical repository migration history contains exactly 51 versions through `20260728210000_ko_predictor_scoring.sql`;
- development Supabase is `iouzoutneyjpugbbtdem` and records the same 51 canonical versions;
- production Supabase is `vkfnsqdyhvtwyqkisxhk` and remains at 44 canonical versions through `20260727191942_operating_cap_enforcement.sql`;
- Netlify `dev`, `branch-deploy` and `deploy-preview` use development Supabase and require `EURO28_DEPLOYED_DB_CONTRACT=51` before their next deploy;
- Netlify `production` declares contract 44, uses production Supabase and serves deploy `6a686e30f2f13c07f10e30d8` from commit `515e794aa483a779c971e16a364fcbd243fa7ee6`;
- production remains milestone-locked and normal development must not publish or migrate it automatically;
- encrypted backup run `30264080847` passed disposable restore verification and its artifact was preserved off GitHub.

Contract compatibility does not make the product tournament-ready. Operating caps and Stage 3C2 scale/surface evidence are complete. Secure co-member player profiles are delivered through contract 47; contracts 48–51 add the Bonus Games platform and the first game (ADR-0010 B1–B5: deny-all schema, hub with voluntary entry, shared knockout prediction store and KO Predictor scoring/standings per `docs/scoring-rules.md` §8); the next product batch is richer H2H with rank-over-time and bracket health.

## Development operating mode

The project is two years from the tournament and remains in active development. Use proportionate checks:

| Change | Required gate |
| --- | --- |
| Copy, documentation, styling or isolated UI | CI: build, lint, tests and production dependency audit. Add a preview/targeted UI test when appearance or interaction changes. |
| Application feature or development schema | CI plus relevant unit/integration tests. Run Database parity for migrations/tournament database rules and Browser E2E for critical journeys. |
| Production schema, auth, scoring, destructive work or milestone release | Fresh encrypted backup when data could be affected, dry-run/preflight, explicit owner approval, full verification and dated release evidence. |

Rules:

- production promotion is milestone-only;
- development may advance ahead of production, but the difference must be stated once in `docs/quality/current-status.md`;
- combine related schema work into coherent milestone migrations where practical;
- do not require a backup, reconciliation record or production smoke for ordinary UI, documentation or application-only changes;
- keep CI, Database parity and Browser E2E automated and path-scoped;
- reserve the full backup/promotion/recovery sequence for production-risk work;
- review this mode around six months before the tournament, or earlier when real users or valuable live data appear.

## Git discipline

- Work from current `main` on a dedicated branch.
- Keep one coherent concern per PR where practical.
- Do not push directly to `main`.
- Run the checks required by the change class above.
- Netlify build success is not database or authenticated-journey evidence.
- Record current facts in `docs/quality/current-status.md`, not across multiple live status documents.

## Database discipline

- Migrations are append-only after hosted application.
- Use disposable local Supabase for rebuilds, database lint, pgTAP and parity.
- Hosted inspection defaults to read-only.
- Never run a remote reset, destructive repair, unreviewed SQL or production mutation without explicit approval.
- Browser roles receive minimum privileges; internal trigger and maintenance helpers default to no Data API execution.
- The database is authoritative for locks, submission, results, progression, scoring and profile reveal/access boundaries.

## Architecture rules

- Put tournament rules in pure functions under `src/domain/tournament/` before UI wiring.
- Components render domain output; they do not invent standings, scoring or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- Keep pure response parsing/models separate from configured network wrappers.
- Do not expose private integrity helpers as browser RPCs.
- Original Predictor and bonus competitions remain separate competitions and score systems.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references, unknown official data and incompatible schemas.
- Knockout display/social views consume authoritative winner and result-method data.
- Other-player detail stays within the authenticated co-member boundary unless a later explicit privacy decision changes it.
- Profile/H2H headline points and ranks come from bounded authoritative server reads; browser logic may derive comparison/accuracy views only.

## Scoring authority

`docs/scoring-rules.md` is authoritative and must stay aligned with `src/domain/tournament/scoringConfig.ts`, SQL scoring logic and tests. Automatic valid-entry submission at lock is implemented through contract 41 and must continue to reuse the authoritative validator rather than creating a second completeness rule.

## Verification commands

Normal application checks:

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

Migration/tournament database changes also require the disposable workflow represented by `.github/workflows/database-parity.yml`. Browser-critical changes require relevant Playwright journeys. Hosted claims require target-specific hosted verification.

## Production milestones

For a production database or release milestone:

1. confirm the exact repository head, target project and current contract;
2. create a fresh encrypted backup when the operation could affect stored data;
3. prove the intended migration/release scope with dry-run or equivalent preflight;
4. obtain explicit owner approval before the production write;
5. apply only the approved scope;
6. verify history, permissions, application contract and environment isolation;
7. publish the exact approved build and run exact-head production smoke;
8. lock production again when the milestone is complete;
9. add one concise dated reconciliation.

Never weaken an environment or deployment-contract guard merely to make a build pass.

## Documentation maintenance

- `docs/quality/current-status.md` is the only live status authority.
- `docs/roadmap.md` is the only live execution sequence.
- `docs/build-todo.md` is a compatibility pointer, not a separate checklist.
- Update risk, scoring, architecture or operational runbooks only when their subject changes.
- Dated audits and reconciliations are immutable historical evidence.
- Do not create a new status, audit or reconciliation document for routine development work.
