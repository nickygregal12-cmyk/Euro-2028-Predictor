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

**This file names no contract version, and you should not add one.** The authorities are:

- [`config/deployment-contract.json`](config/deployment-contract.json) — the contract version, required migration count and the exact RPC allowlist;
- [`docs/quality/current-status.md`](docs/quality/current-status.md) — the hosted position of the repository, development Supabase `iouzoutneyjpugbbtdem`, production Supabase `vkfnsqdyhvtwyqkisxhk`, every Netlify context and the published application, plus any deliberate development-ahead-of-production split;
- [`docs/ops-pending-migrations.md`](docs/ops-pending-migrations.md) — the canonical migration chain and per-environment applied state.

Read those rather than trusting a number written anywhere else. Every stale document in this repository became stale by copying a contract figure out of them.

Contract compatibility does not make the product tournament-ready. `docs/roadmap.md` holds the order of remaining work and `docs/quality/risk-register.md` the open risks.

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

- **Diff against `origin/main`, never the local `main` ref.** Run `git fetch origin main` first. A fresh clone in a remote or ephemeral environment can leave local `main` many merges behind — it has been observed pointing at history from roughly seventeen contracts earlier than `origin/main`. Diffing against the stale ref silently attributes hundreds of already-merged files to your own branch, which makes a documentation-only change look as though it touched `src/`, `supabase/` and `tests/`. Verify current state with `git show origin/main:<path>`, and treat any claim about what is on `main` as unverified until you have.
- Work from current `origin/main` on a dedicated branch.
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

## Documentation map

### Where the task queue lives

**GitHub Issues.** No markdown file in this repository is a task queue. `docs/roadmap.md` gives the order of work, `docs/quality/current-status.md` gives the current batch, and neither is a checklist to tick. If you are looking for what to do next, read those two for context and the Issue for the work.

### Read these before changing anything

| Document | Owns |
| --- | --- |
| `AGENTS.md` (this file) | Operating rules, git and database discipline, architecture rules, hard boundaries |
| `docs/quality/current-status.md` | Current implementation and hosted state, and **every contract number** |
| `docs/roadmap.md` | The single execution sequence |

### Read when your change touches the subject

`docs/scoring-rules.md` (scoring and entry validity) · `docs/tournament-structure.md` (tournament facts, R16 allocation) · `docs/competition-structure.md` (competition separation law) · `docs/predictor-cup-rules.md` (Cup rules) · `docs/design-system.md` (visual and interaction rules) · `docs/architecture-and-tournament-states.md` (how the app understands the tournament) · `docs/adr/` (platform architecture decisions, indexed in `docs/adr/README.md`) · `docs/quality/feature-baseline.md` (capabilities and safeguards that must not silently regress) · `docs/quality/risk-register.md` (current findings) · `docs/quality/deferred-decisions.md` (what is deliberately postponed, and what you must therefore not do yet) · `docs/ops-*.md` (live operational runbooks) · `docs/quality/README.md` (the governance charter and this taxonomy).

### Do not read these as current truth

Dated evidence, immutable, historical only — never a task list and never a statement of what is live now:

- `docs/quality/audits/`, `docs/quality/investigations/`, `docs/quality/reconciliations/`, `docs/audits/`;
- everything under `docs/history/` and `docs/quality/history/`, including `docs/history/ops/`.

A file in one of those directories describes one commit on one date. If it disagrees with `docs/quality/current-status.md`, the status document wins and the dated file is simply old — do not "correct" it.

### Rules

- **One subject, one owner.** Do not restate a fact owned by another document; cite it. Every stale document in this repository became stale by restating something it did not own — contract numbers most of all.
- `docs/quality/current-status.md` is the only live status authority; `docs/roadmap.md` is the only live execution sequence.
- `docs/build-todo.md` is a compatibility pointer, not a separate checklist. `CLAUDE.md` is a pointer index, not a second copy of this file.
- Update risk, scoring, architecture or operational runbooks only when their subject changes.
- Archive; never delete. A superseded document moves with `git mv` and gains a supersession header — see `docs/quality/README.md` § `history/`. ADRs are the exception: they are superseded by status change in place.
- Do not create a new status, audit or reconciliation document for routine development work.
- Do not add a second document describing a subject that already has an owner.
