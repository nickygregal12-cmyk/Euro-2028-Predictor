# Agent operating rules

Read this file and [`docs/quality/current-status.md`](docs/quality/current-status.md) before changing the repository.

## Project framing

This repository is a **multi-competition football prediction platform**. Euro 2028 is the first completed competition baseline and is parked for a January 2028 return; it is not the assumption every new feature is allowed to make.

- Platform direction and competition boundaries are governed by [`docs/adr/0011-multi-competition-platform.md`](docs/adr/0011-multi-competition-platform.md) through [`docs/adr/0019-brand-decision-deferred.md`](docs/adr/0019-brand-decision-deferred.md).
- The detailed Stage A–L programme is [`docs/architecture/multi-competition-hub-build-plan.md`](docs/architecture/multi-competition-hub-build-plan.md).
- The current Stage C implementation boundary is [`docs/architecture/stage-c1-c2-governance.md`](docs/architecture/stage-c1-c2-governance.md).
- The recoverable tournament reference is `euro-2028-baseline`.
- Do not assume one tournament, one lock instant, one scoring model, one standings table or one competition lifecycle unless the governing authority for that competition says so.
- Do not import features, scoring values or game rules from previous World Cup projects, old branches, prototypes, chats or similarly named modes.

## Authority order

Use evidence in this order:

1. current `main` code, migrations and executable tests;
2. freshly verified hosted Netlify/Supabase evidence;
3. [`docs/quality/current-status.md`](docs/quality/current-status.md);
4. ADRs for decisions;
5. [`docs/design/README.md`](docs/design/README.md) for what the finished product should look like — the target design authority, presentation and delivery only;
6. [`docs/roadmap.md`](docs/roadmap.md) for future sequence and [`MASTER-TODO.md`](MASTER-TODO.md) for the detailed active/parked inventory;
7. dated reconciliations and older audits for historical evidence only.

A planning document never overrides an ADR. Process, prepared tooling or a chat statement is not implementation evidence.

**The design authority is deliberately below the ADRs.** [`docs/design/hub-architecture-and-modernisation-plan.md`](docs/design/hub-architecture-and-modernisation-plan.md) (revision 1.5) says what the product should look like when finished, and its own Document Control section limits it to presentation and delivery: it may not change scoring, locks, memberships, settlement or visibility. Where it restates a rule it is recording the repository's rule, so if the restatement and the tests disagree, the tests win and the document has a defect. Its baseline is contract 93 — check Appendix D.2 against the live status document before treating any of it as outstanding.

## Current baseline

The annotated `euro-2028-baseline` tag resolves to `1fb8ffd36ad113079181829a8bcc47175c43b6da`, preserving the contract-63 Euro 2028 baseline. Remaining tournament work is parked until January 2028.

Read current hosted values from [`docs/quality/current-status.md`](docs/quality/current-status.md), and the repository contract from `config/deployment-contract.json`. This section used to restate both, and drifted two contracts behind the sentence further down this same file — one document giving two answers is worse than one document giving none.

- production Supabase and the last published application remain at the Euro baseline contract;
- production Netlify deploys are paused by the contract gate by design;
- no agent may promote production merely to equalise contract numbers.

**REQUIRES OWNER VERIFICATION before operational reliance:** run the target-specific applied-state, privilege, environment and release checks in the live status document. Never copy a stale hosted claim into a new document.

Stage B is complete on `main` through PR #226. Control, parity, inventory and Stage C foundation work through PRs #228, #229, #232, #233, #235, #239, #245, #246, #250, #252, #255, #258, #261, #264 and #265 is also on `main`. Read the current commit from git and the contract from `config/deployment-contract.json`.

PR #252 lands the competition/viewer timezone seam. PR #317 supplies persisted `tournaments.display_timezone` in the contract-65 repository candidate while retaining hosted contract-64 fallback. PRs #255, #258 and #261 make committed TypeScript/TSX compiler-project coverage exhaustive. PR #264 type-checks the three JavaScript deploy gates. PR #265 pins the complete direct Data API relation/view exposure surface. PR #266 adds disposable-local ACQ-R02 scale evidence only. PRs #269, #276 and #284 measure ACQ-R03. PR #279 freshness-checks the enum surface. PR #285 makes domain coverage thresholds and compressed bundle budgets CI gates. PR #287 makes lint warnings fail CI.

**PR #236 is merged** and all seven pre-migration contracts have landed through PR #292. The accepted governance amendment splits implementation:

- **Stage C1 — issue #303:** merged to `main` at repository contract 65 (PR #317 foundation, PR #349 populated-audit hotfix, PRs #350/#351 hosted rollout tooling and guarded workflow). The current auth-owned competitive rows, foreign-key actions and ownership RLS remain unchanged. The hosted development apply is complete: contract 65 on 2 August 2026 through the guarded workflow, contract 66 on 3 August 2026 through the ADR 0024 additive fast lane. Nothing is owner-gated.
- **Stage C2 — issue #272:** profile ownership, account erasure, pseudonymisation and related RLS. C2 remains blocked by the independent data-protection review.

Do not create a combined Stage C migration. Do not pull a C2 change into C1 for convenience. No hosted schema mutation is authorised by the split.

The repository is at **contract 124** through `20260806150000_season_cup_split_transition.sql`. Development Supabase is hosted at **120** — four behind, with contracts 121, 122, 123 and 124 pending; the fast-lane rollout run 31083613351 applied contracts 116 to 120 on 6 August 2026 and contract 121 has not been applied. Production remains at 63. Contract 103 makes competition instances repeatable; contract 104 makes every measured tournament-and-game caller resolve an explicit instance; contract 105 enforces one-parent split ancestry and derives the continuing Championship table from settled fixtures; contract 106 closes DATA-009 by giving the two Bonus Games rederive functions the terminal-aware reader; contract 107 is the Last Man Standing restart itself — it completes a wiped-out competition as `no_winner_restarted` and creates its successor, re-entering every entrant and copying no selections, cycles, projections or windows. Window generation for the successor is deliberately not in it and follows as its own contract; **contract 108 guards the gap that deferral leaves**, refusing any successor round that opened or locked before its predecessor finished, so no writer can give a fresh competition rounds nobody could play in; **contract 109 closes the deferral**, deriving the next eligible league round from contract 83's matchweek lock authority, generating the successor's calendar from it exactly once, and driving the restart from what settlement reported rather than from a lifecycle state settlement never writes; **contract 110 gives the season Predictor Championship rounds it can be played over**, which nothing in the repository had ever created — `bonus_cup_fixtures.window_id` is `NOT NULL`, so no season Championship fixture could be persisted in either phase until it landed; **contract 111 launches one**, making the first of its six previously unreachable authorities actually run; **contract 112 is the provider identity map**, which every ingestion step was blocked on — a decoded fixture names team `1234` playing team `5678` in round `40`, and until it landed no fact anywhere said which of our clubs those were. It is the map alone and deliberately writes no fixture, because `fixtureReassignment.ts` resolves a moved kickoff by round window and `competition_rounds` had none; **contract 113 supplies that window**, derived from the fixtures a round is actually played over, kept disjoint by a trigger so an ambiguous destination is unreachable from stored data. **Contract 114 gives the season matchweek card its bounded browser path** — one read and three writes scoped to the caller's own entry, with locks, the Joker allowance and version conflicts enforced by the triggers that already own them, and the delete path brought under the matchweek lock so clearing a prediction or un-playing a Joker after lock refuses. **ADR 0020 says a rescheduled fixture moves to "the round its new kickoff falls in" and never defines what falls in means**, so 113 implements the reading that invents nothing — a round bounds the time it is played — and records that widening those windows to tile the calendar is an owner decision rather than a migration's. **Contract 115 makes the database able to call the provider at all.** `pg_net` was available on the project and **not installed**, so PostgreSQL could make no outbound HTTP request and the deployed `provider-poll` Edge Function had a scheduler that could not reach it. It installs the extension, forbids any browser-reachable function in an exposed schema from calling into `net` — pg_net's own grants belong to whoever owns the extension, and where the platform owns it `postgres` is neither superuser nor a member of `supabase_admin` and cannot revoke them — and drives the Edge Function from `pg_cron` at each target's declared cadence. It records **no** poll target and imports **no** fixture, so on application the job runs every five minutes and does nothing until an operator supplies two vault secrets and a target. **Contract 116 lets a season Last Man Standing entrant see the round they can already pick in.** Contract 86 widened the selection trigger to season fixtures; the read was never widened, so `get_my_lms` returns a season round with an empty fixture array. `get_season_lms_round` reads the season fixture link instead, returns one round, and answers survival from the same function the settlement replay uses rather than letting a browser judge raw scores — a season fixture has no winner column, which is why it is a new function and not a widened one. **Contract 117 is the repeatable path a provider kickoff change takes to the fixture**, and deliberately the narrowest slice of it: an existing fixture moves. It creates no fixture, deletes none, and **never writes** `competition_round_id` — the owner amendment made executable, since a rescheduled fixture keeps the matchweek it was scheduled in, which also settles what contract 113's header left open. It fails closed on the WHOLE payload when any identifier is unmapped, because a half-applied fixture list leaves some kickoffs current and some stale with no record of which. It refuses a kickoff moved into the past and a fixture no longer scheduled, and records every move with the instant it moved from, append-only, as the queue an administrator reviews. `168_provider_fixture_revision_import.sql` holds 27 assertions with six mutants killed at 4, 4, 4, 2, 2 and 1 failures, including the one that moves the fixture to whichever matchweek its new kickoff lands in. **Contract 118 stops the games hub being blind to a season's fixtures.** `get_bonus_games` built its per-window fixtures from `bonus_window_fixtures` joined to `public.matches` with no branch on competition kind, so a season window returned an empty array — and because `resolveCompetitionStatus` can only settle a window when `total > 0 and confirmed >= total`, a season competition's first locked round stayed in flight permanently and the hub card stuck on it, showing a stale round and a stale deadline. Three internal functions supply the facts instead: a tournament limb, a season limb mapping season status onto the tournament vocabulary on contract 77's established equivalence, and a neutral combiner that unions rather than branches because a window's fixtures live in exactly one source. `get_bonus_games` is redefined from contract 104's text with only its fixtures subquery changed, verified by diff rather than by reading, because contract 114 made exactly that mistake. This is the fourth instance of one defect — contracts 86, 98, 116 and this — and `168_tournament_only_browser_reads.sql` now catches the fifth. **Contract 119 makes a rescheduled fixture lock at its own kickoff. Contract 117 let a provider move a kickoff automatically and the lock did not follow, so a fixture postponed to the following Wednesday still locked on Saturday. Only a rescheduled fixture is affected — the owner chose that reading over the universal per-fixture one, which shares the same arithmetic but would make an ordinary matchweek predictable in stages. “Moved” is contract 117's revision record, a stored fact rather than an inference, and the rule is strictly permissive: it can extend an editing window, never shorten one.** `170_rescheduled_fixture_lock.sql` holds 18 assertions with five mutants killed, including the universal per-fixture reading the owner rejected. **Contract 120 gives the Predictor Championship's phase and continuing table a bounded browser read. Contract 102 persists the split as a distinct phase and contract 105 derives the continuing table for it, but nothing browser-reachable could see either: measured on hosted development, zero functions `authenticated` may execute read `cup_split_group_tables`, `parent_group_id` or `cup_final_group_tables`, and `get_my_cup` was last defined on 29 July 2026, before the split phase existed. That is the fifth instance of the defect behind contracts 86, 98, 116 and 118 — a function written for what existed, never widened, failing silently rather than erroring. `get_season_cup_phase` returns the caller's own phase and the table for their own group from whichever authority owns that phase, adds no rule and recomputes nothing.** **Contract 121 gives a season its play context**: which season a URL means and which matchweek its card opens at — the two facts that kept the season Match Predictor surface off the production route table. The slug lives in `public.competitions`, revoked from every browser role, and two seasons sharing a `season_key` are told apart only by `competition_id`; `(competitions.slug, tournaments.season_key)` is a real composite key because both are unique. It decides nothing new — `predictor_internal.next_eligible_league_round` has answered the matchweek question since contract 109, ordering by the derived lock instant rather than by `ordinal` so a rescheduled season resolves to the round that actually locks next. A season past its last lock reports a null matchweek; an unknown or tournament-shaped competition raises. Repository-only: development is one behind again until it is applied. **Contract 122 makes ADR 0012's two retention tables answerable** — the monthly table, whose month comes from a round's `window_opens_at` read in the competition's `display_timezone` because a month boundary is not a UTC fact, and rolling form, which needs only round ordinal. Both are derived views over settled totals; neither touches the canonical total. An unplaceable settled matchweek refuses the whole monthly table rather than misranking a month. The migration also runs contract 113's window deriver once per league season, which nothing had ever called; keeping the windows fresh was left as an owner decision, because re-deriving after contract 117's provider import could make an ordinary import start failing. **Contract 123 takes that decision and removes the reason to fear it.** The refresh is per round and never raises: it recomputes only the rounds an import actually moved, and when a proposed span would overlap another round's window — the case contract 113's disjointness trigger refuses — it leaves the old window exactly as it stands and queues an append-only row naming what was kept, what was proposed and which round blocked it. The three alternatives are all worse in ways the header states: raising fails an entire season's import over one postponed fixture, applying anyway is the ambiguity contract 113 exists to exclude, and moving the blocking round's boundary invents contract 113's TILED reading inside an automatic ingestion path where nobody is watching. Contract 117's importer is redefined from its own committed text with only that call added, verified by diff in `tests/database-parity/roundWindowStaleRefreshParity.test.ts`, and `175_round_window_stale_refresh.sql` holds 35 assertions with the conflict path checked against the stored row rather than the return value. **Contract 124 makes the Championship split actually happen.** Contract 102 persists the split phase, 105 derives its continuing table and 120 reads it, and nothing had ever written a split-phase row — so `cup_split_group_tables` had never returned one. `executeCupSplit` had the same shape on the TypeScript side: exported, tested, called by nothing. The transition reads the plan from contract 111's launch record rather than re-deriving a format against rounds that have since been played, carries draw numbers, eliminates nobody, refuses a multi-group field as ADR 0014 requires, and is idempotent. It closes ADR 0014's stated-behaviour loose end — both halves play in the same windows and the smaller half simply has no fixture in the last round or two, because `matchday` is the competition's round number. It also fixes the defect it would otherwise have lit: `cup_final_group_tables` had no phase filter, so a split entrant's window totals would have been summed twice in the initial table a browser reads.

The repository contract and the hosted contracts are distinct facts. Any hosted schema mutation requires the guarded rollout workflow, explicit owner approval and the applicable preflight.

**Lock policy is game-owned (ADR 0020, PR #353).** `CompetitionConfig` describes identity, calendar and structure only; the selected game supplies its own explicit `lockPolicy` (Original Predictor entry/0, Main Predictor matchweek/0, Last Man Standing matchweek/30). A missing, unknown, stale or incompatible policy fails closed. Do not reintroduce a competition-wide buffer, and do not branch on route, slug, name or UI type to pick a policy.

## Development operating mode

The project remains in active pre-launch development. Use proportionate checks:

| Change | Required gate |
| --- | --- |
| Copy, documentation, styling or isolated UI | CI: build, lint, tests and production dependency audit. Add a preview/targeted UI test when appearance or interaction changes. |
| Application feature or development schema | CI plus relevant unit/integration tests. Run Database parity for migrations or database-backed domain rules and Browser E2E for critical journeys. |
| Production schema, auth, scoring, destructive work or milestone release | Fresh encrypted backup when data could be affected, dry-run/preflight, explicit owner approval, full verification and dated release evidence. |

Rules:

- production promotion is milestone-only;
- development may advance ahead of production, but the difference must be stated once in `docs/quality/current-status.md`;
- combine related schema work into coherent milestone migrations where practical;
- do not require a backup, reconciliation record or production smoke for ordinary UI, documentation or application-only changes;
- keep CI, Database parity and Browser E2E automated and path-scoped without silently excluding future domain siblings;
- reserve the full backup/promotion/recovery sequence for production-risk work;
- review this mode around six months before a public launch, or earlier when real users or valuable live data appear.

## Git discipline

- Work from current `main` or the explicitly named dependency branch on a dedicated branch.
- Keep one coherent concern per PR where practical.
- Do not push directly to `main`.
- **One session at a time on `supabase/migrations/`.** The repository contract is
  the migration COUNT, so a contract number cannot be reserved: whichever of two
  concurrent sessions merges second must renumber its migration, its pgTAP suite
  and every live authority document naming the number. That happened four times
  on 5 August 2026 (#496, #502, #505, #506). Reserving a distant migration
  timestamp does not help, because the timestamp is not what collides. A session
  finding another session's migration work in flight should take non-migration
  work rather than race it.
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
- Competition-season scoping must preserve or strengthen the existing same-reference safeguards.
- No development, rehearsal or simulation path may write to production.
- Every new public table must keep RLS enabled, and every security-definer function must pin `search_path`.
- **`current_user` is not a caller check inside a SECURITY DEFINER function.** It is the function OWNER there, for every caller. Verified on PostgreSQL 16: an insert by an ordinary role through a security-definer trigger reports `current_user=postgres, session_user=app_user`, while the same insert through a plain trigger reports `current_user=app_user`. The tournament's `enforce_entry_lock_generic` narrows its post-lock exception with `current_user = 'postgres'` and that is sound *because that function is not a definer*. Copying the same conjunct into a definer function produces a conjunct that is always true — a control that reads as a security narrowing and is not one. Use `session_user` there, and mutation-test that the guard actually refuses a non-server caller.
- Every public view and direct browser relation grant must remain in the reviewed exposure allowlist.
- Stage C1 must preserve the full PR #246 deletion/ownership before-state and add a guard proving it has not changed.

## Architecture rules

- Shared competition rules live as pure functions under `src/domain/competition/`; follow [ADR 0011](docs/adr/0011-multi-competition-platform.md).
- Tournament-only rules remain under `src/domain/tournament/`.
- Season-only rules belong under the future `src/domain/season/` boundary when Stage C1/E begins.
- `competition/` does not import from `tournament/` or `season/`; tournament and season code do not import one another.
- All domain layers remain pure: no storage, network or ambient clock reads; time is an input.
- Components render domain output; they do not invent standings, scoring, lock or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- Keep pure response parsing/models separate from configured network wrappers.
- Do not expose private integrity helpers as browser RPCs.
- Follow the separation authorities in ADR 0011 and ADR 0015; never combine competition entries, points or standings.
- Separation must also be visible on the surface, not only true in the schema.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references, stale/unknown official data and incompatible schemas.
- Knockout display/social views consume authoritative winner and result-method data.
- Other-player detail stays within the authenticated co-member boundary unless a later explicit privacy decision changes it.
- Profile/H2H headline points and ranks come from bounded authoritative server reads; browser logic may derive comparison/accuracy views only.
- Feeds remain provisional/display-only; official confirmation remains the scoring/progression gate.
- UTC instants decide locks and match state. Competition timezone decides competition-day and matchweek grouping. Viewer/device timezone may change displayed clock time only.
- Account erasure and retained historical identity belong to Stage C2. Do not describe the proposed pseudonymised-history model as legally approved before issue #272 closes.

## Scoring authority

[`docs/scoring-rules.md`](docs/scoring-rules.md) is authoritative for the existing Euro 2028 tournament configuration and must stay aligned with TypeScript, SQL scoring logic and tests.

Season Predictor and Last Man Standing rules are governed by ADR 0012 and ADR 0013. Do not copy tournament values into a season implementation or merge separate scoring authorities for convenience.

Automatic valid-entry submission at the tournament lock is implemented and must continue to reuse the authoritative validator. The recurring season cadence is separate future work.

## Verification commands

Normal application checks:

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

Migration or database-backed domain changes also require the disposable workflow represented by `.github/workflows/database-parity.yml`. Browser-critical changes require relevant Playwright journeys — `scripts/select-browser-journeys.mjs` chooses them from the change and widens to the full suite on anything it does not recognise. Hosted claims require target-specific hosted verification.

How work reaches the **development** environment — disposable data, the additive-migration fast lane, and the informational preview contract gap — is [ADR 0024](docs/adr/0024-development-environment-operating-model.md). It relaxes nothing about production.

`tsc -b` strict-checks application code, TypeScript tests, Playwright/e2e fixtures, production-smoke TypeScript, TypeScript scripts, Playwright configs and the three JavaScript deploy gates. The remaining JavaScript files under `scripts/` are measured in the explicit deferred allowlist.

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
- `MASTER-TODO.md` is the only detailed active/parked inventory.
- `docs/build-todo.md` is a compatibility pointer, not a separate checklist.
- Update risk, scoring, architecture or operational runbooks only when their subject changes.
- Dated audits and reconciliations are immutable historical evidence.
- Archive superseded controls under the governed history directory; never delete one as cleanup.
- Do not create a new status, audit or reconciliation document for routine development work.
