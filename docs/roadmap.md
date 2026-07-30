# Multi-competition platform — roadmap

**Status date:** 30 July 2026  
**Purpose:** current delivery position and next executable slice.  
**Current facts:** [`quality/current-status.md`](quality/current-status.md)  
**Parent programme:** [`architecture/programme-plan.md`](architecture/programme-plan.md)  
**Engineering workstream:** [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md)  
**Detailed inventory:** [`../MASTER-TODO.md`](../MASTER-TODO.md)  
**Decision authority:** [`adr/README.md`](adr/README.md)

This roadmap does **not** maintain another copy of the programme phases or Stage A–L engineering plan. The parent programme owns phases, workstreams and product gates. The child engineering plan owns stage sequence and engineering exit evidence. This file records where delivery is now and what can execute next.

## Correction record — 30 July 2026

The previous roadmap was inconsistent with the reconciled planning hierarchy. The following corrections are explicit rather than silent:

1. **Parent/child authority:** the programme plan, not the engineering plan, is identified as the parent programme.
2. **Surface migration order:** Stage B followed the child plan's `homeDashboard → matchesTab → matchCentre → entryLock` sequence, each with pre-migration differential evidence.
3. **Design and instrumentation:** information architecture, prototype testing, visual direction and event-taxonomy definition belong to programme **Phase 1** before Stages E–H implement screens. Stage H implements validated output rather than designing alongside construction.
4. **Launch and acquisition:** Stage J is launch readiness **and go-to-market**, with the programme window beginning in **February 2027**.
5. **Bonus Games Browser E2E:** PR #187 already supplies authenticated desktop/phone lifecycle proof for all three Bonus Games; new work covers only new platform and season behaviour.
6. **Stage B status:** the complete competition-context adoption sequence merged through PR #226 as `2648540dc001c50305f1effa526fc16e43dcdb26`; the superseded Stage B PR stack is closed.
7. **Control/scoping status:** PR #228 merged as `ae78a57b5beabd6a415975b24daae28215ed509d`, landing cross-tournament read scoping and the reviewed deployment/environment guard repairs.
8. **Parallel coverage:** PR #229 is independent, test-only scoring parity work and does not block Stage C design.

## Delivered baseline

The completed Euro 2028 tournament product is preserved as the recoverable baseline. Its exact capabilities, contract and hosted-evidence boundary belong in [`quality/current-status.md`](quality/current-status.md), not in another roadmap inventory.

Remaining tournament-specific work is parked in Part I of [`../MASTER-TODO.md`](../MASTER-TODO.md) for the January 2028 return.

## Current position

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain-wide automated controls are established. Brand-clearance work remains separately governed by ADR 0017.

### Stage B — competition-context foundation and surface migration

Stage B is complete on `main`:

- foundation and deterministic clock/state tests merged through PR #212;
- Home migration merged through PR #219;
- Matches, Match Centre, entry lock and `MatchTemporalState` retirement integrated through PR #226;
- the clean-main candidate passed build/typecheck, lint, full Vitest, dependency audit, Database parity, exact preview smoke, authenticated journeys, signup and recovery;
- PR #226 merged as `2648540dc001c50305f1effa526fc16e43dcdb26`;
- the superseded Stage B PRs were closed.

### Landed prerequisite — PR #228

PR #228 merged as `ae78a57b5beabd6a415975b24daae28215ed509d` after green CI, Database parity, exact preview smoke and authenticated Browser E2E. It landed:

- production guard expectations derived from committed authority;
- tournament-scoped `group_teams` reads;
- real 404 responses for unknown SPA routes;
- RPC contract enforcement;
- fail-closed browser Supabase key validation;
- module reachability evidence, two verified retirements and TypeScript/SQL parity coverage.

The exact merge automatically published to Netlify and is ready at deploy `6a6b4e905de2dd0008808d8d`.

### Parallel control coverage — PR #229

PR #229 adds one test file comparing Original Predictor scoring constants with the newest effective SQL scoring definition. It is test-only, mergeable and green, and may integrate independently without blocking Stage C design.

## Next executable sequence

1. Design the Stage C competition-season schema before creating dependent records. Define competition and season identifiers, lifecycle ownership, timezone authority, fixture/result ownership, deletion/anonymisation consequences and independent entry/standing/history boundaries.
2. Map every existing tournament relationship that must remain valid when a second competition/season exists, including groups, teams, fixtures, predictions, score events, leagues, rank history, awards and bonus-game references.
3. Specify same-reference constraints and indexes that prevent cross-competition joins or writes, reusing or strengthening the current relationship safeguards rather than relying on client filters.
4. Decide the migration boundary: one coherent append-only **development** migration plus tests, with no hosted application in the design PR.
5. Commit pre-migration contract tests and database-parity fixtures before implementing the migration.
6. Implement the Stage C development migration only after the schema design is reviewed; prove local rebuild, database lint, pgTAP, TypeScript/PostgreSQL parity, preservation of existing Euro data and environment isolation.
7. Do not mutate hosted development or production schema without the currently applicable explicit approval, preflight and verification process.

## Programme and stage navigation

- Product phases, workstreams, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L, migration order and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Current implemented/hosted position: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Architecture and product decisions: [`adr/README.md`](adr/README.md).

When these documents disagree, the conflict remains visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
