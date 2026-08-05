from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:140]!r}")
    file_path.write_text(text.replace(old, new), encoding="utf-8")


replace_once(
    "CLAUDE.md",
    "the idempotent LMS wipeout restart transition, the Contract 108 past-window calendar guard and split persistence.",
    "the idempotent LMS wipeout restart transition, the Contract 108 past-window calendar guard, the Contract 109 successor-window scheduler and split persistence.",
)
replace_once(
    "CLAUDE.md",
    "includes the LMS successor-window scheduler, Championship phase driver, bounded browser reads and surfaces, provider rehearsal, instrumentation/cohort evidence and launch operations.",
    "includes the Championship phase driver, bounded browser reads and season-game surfaces, provider rehearsal, instrumentation/cohort evidence and launch operations.",
)

replace_once(
    "MASTER-TODO.md",
    "**Rules, storage, settlement, restart transition and past-window guard delivered; scheduling and surfaces remain.** Eligibility, deterministic C-collation auto-assignment, used-team cycles, lock-time selection writes, correction-aware replay, entrant-state projection and the recurring settlement job are implemented. Contract 107 converts a qualifying public wipeout into one idempotent linked successor, re-entering the field and copying no selections, cycles, projections or windows. Contract 108 prevents that successor inheriting any round that opened or locked before its predecessor completed, without choosing its future calendar.",
    "**Rules, storage, settlement and the complete restart lifecycle are delivered; surfaces remain.** Eligibility, deterministic C-collation auto-assignment, used-team cycles, lock-time selection writes, correction-aware replay, entrant-state projection and the recurring settlement job are implemented. Contract 107 creates the idempotent linked successor without copying selections, cycles, projections or windows; Contract 108 refuses any inherited past round; Contract 109 derives the first eligible future league matchweek from the existing lock authority, creates the successor calendar exactly once and drives the lifecycle from settlement's immutable report.",
)
replace_once(
    "MASTER-TODO.md",
    "- [ ] Add the separate calendar authority/driver that starts the successor at the next eligible league round and creates its windows exactly once.",
    "- [x] Add the separate calendar authority/driver that starts the successor at the next eligible league round and creates its windows exactly once. *(Contract 109; uses the existing matchweek lock authority, remains inert when the calendar is not derivable, and is idempotent.)*",
)

replace_once(
    "docs/roadmap.md",
    "- repeatable competition instances, explicit live/current instance resolution, correction-safe terminal rederivation and an idempotent LMS wipeout restart that creates a fresh successor without copying picks, cycles, projections or windows, plus the Contract 108 publisher/database guard that refuses successor rounds which opened or locked before their predecessor completed.",
    "- repeatable competition instances, explicit live/current instance resolution, correction-safe terminal rederivation and a complete LMS restart lifecycle: Contract 107 creates the fresh successor without copied picks, cycles, projections or windows; Contract 108 refuses inherited past rounds; Contract 109 selects the first derivable future league matchweek, creates the successor calendar exactly once and drives the transition from settlement's immutable report.",
)
replace_once(
    "docs/roadmap.md",
    "These are backend and control foundations. They do not mean that the season game surfaces, Championship split driver, LMS successor-window scheduler, provider rehearsal or closed-cohort product have been delivered.",
    "These are backend and control foundations. They do not mean that the season game surfaces, Championship split driver, provider rehearsal or closed-cohort product have been delivered.",
)
replace_once(
    "docs/roadmap.md",
    """1. **Schedule the LMS restart successor from an authoritative league calendar.** Contract 107 completes the wiped-out predecessor and creates one idempotent, linked successor with a fresh field and no copied picks, cycles, projections or windows. Contract 108 now prevents the catalogue publisher or any other writer from attaching rounds that opened or locked before the predecessor completed. The remaining scheduler must identify the next eligible league round, create the successor windows exactly once and keep the new competition inert rather than guessing when no valid round exists; the guard is not the scheduler.
2. **Run the first bounded provider rehearsal in non-production.** Configure only the approved development credential/path, make one request, prove raw custody precedes decode, prove processing evidence is append-only and prove no official fixture, result, lock, score, total, rank or standing is written. If credentials or provider authority are unavailable, stop rather than weakening the boundary.
3. **Build the season game surfaces from the accepted design authority.** Sequence the phone-first Match Predictor completion flow and retention standings; the LMS weekly-picks/read model and private-management paths; the Predictor Championship phase driver, tables and fixtures; then the Hub action/social shell. Backend availability is not a substitute for a usable surface.
4. **Instrument before cohort exposure.** Emit the Phase 1 taxonomy from the first surface commit, then run the headless season/anomaly log and only introduce a closed cohort after the provisional path is stable.
5. **Keep production paused as a separate milestone.** Repository and development progress do not authorise production migration or publication. Production promotion retains backup, preflight, approval, exact-artifact verification and rollback evidence.
6. **Keep Stage C2 blocked.** No ownership, erasure, pseudonymisation or replacement ownership-RLS work enters the platform until issue #272 records the independent data-protection decision.
7. **Review ACQ-R02 only at its trigger.** Reopen maintained standings only on a material cap increase or adverse rehearsal/hosted concurrency evidence, not merely because the design exists.""",
    """1. **Run the first bounded provider rehearsal in non-production.** Configure only the approved development credential/path, make one request, prove raw custody precedes decode, prove processing evidence is append-only and prove no official fixture, result, lock, score, total, rank or standing is written. If credentials or provider authority are unavailable, stop rather than weakening the boundary.
2. **Build the season game surfaces from the accepted design authority.** Sequence the phone-first Match Predictor completion flow and retention standings; the LMS weekly-picks/read model and private-management paths; the Predictor Championship phase driver, tables and fixtures; then the Hub action/social shell. Backend availability is not a substitute for a usable surface.
3. **Instrument before cohort exposure.** Emit the Phase 1 taxonomy from the first surface commit, then run the headless season/anomaly log and only introduce a closed cohort after the provisional path is stable.
4. **Keep production paused as a separate milestone.** Repository and development progress do not authorise production migration or publication. Production promotion retains backup, preflight, approval, exact-artifact verification and rollback evidence.
5. **Keep Stage C2 blocked.** No ownership, erasure, pseudonymisation or replacement ownership-RLS work enters the platform until issue #272 records the independent data-protection decision.
6. **Review ACQ-R02 only at its trigger.** Reopen maintained standings only on a material cap increase or adverse rehearsal/hosted concurrency evidence, not merely because the design exists.""",
)

replace_once(
    "docs/competition-structure.md",
    "The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances, the idempotent LMS wipeout restart transition, the Contract 108 past-window guard and split persistence. The LMS successor still needs an authoritative next-round/window scheduler; Contract 108 prevents an invalid inherited past but does not choose the future calendar. The Championship still needs its phase driver; both also need bounded browser reads and product surfaces. Those remaining journeys land through the roadmap sequence—backend presence is not a completed user journey.",
    "The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances, the complete Contract 107–109 LMS restart lifecycle and split persistence. Contract 109 derives the next eligible future league matchweek from the established lock authority and creates the successor calendar exactly once; the backend restart deferral is closed. The Championship still needs its phase driver, and all season games still need bounded browser reads and product surfaces. Those remaining journeys land through the roadmap sequence—backend presence is not a completed user journey.",
)

replace_once(
    "docs/architecture/programme-plan.md",
    "- season Last Man Standing persistence, settlement, an idempotent wipeout-restart lifecycle transition and the Contract 108 past-window calendar guard;",
    "- season Last Man Standing persistence, settlement and the complete Contract 107–109 wipeout-restart lifecycle, including the past-window guard and idempotent successor calendar scheduler;",
)
replace_once(
    "docs/architecture/programme-plan.md",
    "These are backend capabilities, not proof that the programme's product gates have passed. The LMS successor created by the restart transition has no windows until a separately reviewed calendar authority schedules the next eligible league round. Contract 108 protects that gap by refusing rounds which opened or locked before the predecessor completed; it does not select or create the future calendar. The Championship still lacks its phase-transition driver, bounded product reads and completed user surface. The first bounded provider rehearsal, season-game surfaces, instrumentation, external-user discovery and cohort evidence also remain open.",
    "These are backend capabilities, not proof that the programme's product gates have passed. The Contract 107–109 LMS restart lifecycle is now complete: settlement reports the wipeout, the lifecycle creates the successor, the guard refuses inherited past rounds and the scheduler derives the first eligible future matchweek from the existing lock authority without guessing when fixtures are incomplete. The Championship still lacks its phase-transition driver, bounded product reads and completed user surface. The first bounded provider rehearsal, season-game surfaces, instrumentation, external-user discovery and cohort evidence also remain open.",
)

replace_once(
    "docs/architecture/multi-competition-hub-build-plan.md",
    "the idempotent LMS wipeout restart transition and the Contract 108 past-window calendar guard",
    "the complete Contract 107–109 LMS wipeout restart lifecycle, including the past-window guard and successor-window scheduler",
)

replace_once(
    "docs/design/README.md",
    "| 108 | a restarted competition cannot inherit a round that opened or locked before its predecessor finished; the actual scheduler remains separate |",
    "| 108 | a restarted competition cannot inherit a round that opened or locked before its predecessor finished |\n| 109 | the next eligible future league matchweek is derived from the existing lock authority and the successor calendar is created exactly once |",
)
replace_once(
    "docs/design/README.md",
    """Contract 107 is a lifecycle transition, not a complete restart journey. The
successor is deliberately inert until a separate calendar authority identifies
the next eligible league round and creates its windows exactly once. Contract
108 protects that inert boundary: the catalogue publisher and database both
refuse any successor round that opened or locked before the predecessor
completed. It does not choose the next eligible round or create a successor
calendar, so the design must still show the honest unavailable/not-started state
rather than implying picks are open.""",
    """The Contract 107–109 backend restart lifecycle is complete. Contract 107
creates the linked successor, Contract 108 refuses inherited past rounds, and
Contract 109 derives the first eligible future league matchweek from the existing
lock authority and creates the successor calendar exactly once. When fixtures
are incomplete and no lock can be derived, the successor remains honestly
unavailable rather than guessing. Product surfaces must render those real states;
backend completion is not evidence that the player or organiser journey exists.""",
)

replace_once(
    "docs/adr/README.md",
    "| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — partially implemented: rules, storage, settlement/replay, the Contract-107 restart transition and Contract-108 past-window guard are merged; successor-window scheduling and complete private/player journeys remain |",
    "| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — partially implemented: rules, storage, settlement/replay and the complete Contract-107–109 restart lifecycle are merged; complete private/managed-entry and player journeys remain |",
)
replace_once(
    "docs/adr/README.md",
    "| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Accepted direction — partially implemented: reveal/defect/split decisions, the idempotent Contract-107 successor transition and Contract-108 past-window guard are merged; the separate next-eligible-round/window scheduler remains |",
    "| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Implemented — Contracts 99–109 close both tournament defects, Euro reveal scope, split persistence/derived standings and the complete idempotent LMS restart lifecycle including guarded successor scheduling |",
)
replace_once(
    "docs/adr/0013-last-man-standing-season-rules.md",
    "> **Implementation progress — 5 August 2026.** Presets, setup/state storage, eligibility, deterministic auto-assignment, used-team cycles, selection writes, correction-aware settlement/replay and the idempotent wipeout restart transition are merged through Contract 107. Contract 108 now refuses any successor round that opened or locked before the predecessor completed. The successor still intentionally has no windows until a separate calendar authority selects the next eligible league round; private/managed-entry and player-facing journeys also remain unfinished.",
    "> **Implementation progress — 5 August 2026.** Presets, setup/state storage, eligibility, deterministic auto-assignment, used-team cycles, selection writes and correction-aware settlement/replay are merged. Contracts 107–109 complete the public wipeout restart lifecycle: create one linked successor, refuse inherited past rounds, derive the first eligible future league matchweek from the existing lock authority and create its calendar exactly once. Private/managed-entry and player-facing journeys remain unfinished.",
)
replace_once(
    "docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md",
    "- **Status:** Accepted direction — partially implemented",
    "- **Status:** Implemented",
)
replace_once(
    "docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md",
    "> **Implementation progress — 5 August 2026.** Contracts 99–101 close the invalid-outcome CHECK, REL-001 and Euro post-lock reveal scope; Contracts 102/105 persist and derive the split; Contracts 103–107 supply repeatable instances, caller resolution, correction-safe terminal rederivation and the idempotent LMS successor transition. Contract 108 refuses any successor round that opened or locked before its predecessor completed, protecting the deliberate no-window state. The one remaining lifecycle step is the separate calendar/window driver that starts the successor at the next eligible league round; neither Contract 107 nor 108 creates that calendar.",
    "> **Implementation progress — 5 August 2026.** Contracts 99–101 close the invalid-outcome CHECK, REL-001 and Euro post-lock reveal scope; Contracts 102/105 persist and derive the split; Contracts 103–107 supply repeatable instances, caller resolution, correction-safe terminal rederivation and the idempotent LMS successor transition. Contract 108 refuses inherited past rounds. Contract 109 closes the final lifecycle step by deriving the earliest eligible future league matchweek from the existing lock authority, creating the successor calendar exactly once and driving the transition from settlement's immutable report. Every decision in this ADR is now implemented.",
)

replace_once(
    "docs/quality/feature-baseline.md",
    "- repeatable competition instances, explicit live/current resolution, correction-safe rederivation after completion and an idempotent LMS wipeout restart that creates a linked successor while copying no selections, used cycles, projections or windows; Contract 108 additionally refuses successor rounds that opened or locked before the predecessor completed, without scheduling the future calendar.",
    "- repeatable competition instances, explicit live/current resolution, correction-safe rederivation after completion and the complete Contract 107–109 LMS wipeout restart lifecycle: linked successor creation without copied selections/cycles/projections/windows, a past-window guard, and an idempotent scheduler that derives the first eligible future league matchweek from the established lock authority.",
)
replace_once(
    "docs/quality/feature-baseline.md",
    "The LMS successor-window scheduler, Championship phase driver, bounded browser reads and season product surfaces remain partial/planned work in the roadmap.",
    "The Championship phase driver, bounded browser reads and season product surfaces remain partial/planned work in the roadmap.",
)
replace_once(
    "docs/quality/feature-baseline.md",
    "- describe a restarted successor as playable before an authoritative next-round/window scheduler has populated it, or treat Contract 108's past-window guard as that scheduler;",
    "- describe the Contract 109 successor scheduler as absent, or treat Contract 108's past-window guard as the scheduler;",
)

adr_test = Path("tests/scripts/adrStatusFreshness.test.ts")
adr_test.write_text(
    """import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const adr = (name: string) =>
  readFileSync(resolve(process.cwd(), 'docs/adr', name), 'utf8')

const index = adr('README.md')

const partiallyImplemented = [
  '0011-multi-competition-platform.md',
  '0012-season-predictor-rules.md',
  '0013-last-man-standing-season-rules.md',
  '0014-predictor-cup-season-formats.md',
  '0020-football-prediction-hub-product-model.md',
  '0023-hub-information-architecture.md',
] as const

describe('ADR implementation-status freshness', () => {
  it('does not describe delivered platform backends as wholly unimplemented', () => {
    for (const file of partiallyImplemented) {
      const source = adr(file)
      expect(source).toContain(
        '- **Status:** Accepted direction — partially implemented',
      )
      expect(source).toContain('Implementation progress — 5 August 2026')
      expect(source).not.toContain(
        '- **Status:** Accepted direction — unimplemented',
      )
    }
  })

  it('records decisions whose complete present scope is implemented', () => {
    expect(adr('0022-season-preset-threshold-and-shared-cup-machinery.md')).toContain(
      '- **Status:** Implemented',
    )
    expect(adr('0024-development-environment-operating-model.md')).toContain(
      '- **Status:** Implemented for the current pre-cohort development operating model',
    )
    expect(
      adr('0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md'),
    ).toContain('- **Status:** Implemented')
  })

  it('records the complete Contract 107-109 LMS lifecycle without claiming surfaces', () => {
    const lms = adr('0013-last-man-standing-season-rules.md')
    const lifecycle = adr(
      '0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
    )

    expect(lms).toContain('Contracts 107–109 complete the public wipeout restart lifecycle')
    expect(lms).toContain('player-facing journeys remain unfinished')
    expect(lifecycle).toContain('Contract 109 closes the final lifecycle step')
    expect(index).toContain(
      '| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Implemented',
    )
  })

  it('updates capacity and background-job evidence beyond the first sample', () => {
    expect(adr('0003-asynchronous-incremental-scoring.md')).toContain(
      'roughly 884 ms',
    )
    expect(adr('0005-background-jobs.md')).toContain(
      'recurring season Match Predictor lock processing',
    )
  })

  it('keeps the index aligned with the record-level statuses', () => {
    expect(index).toContain(
      '| [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) | Season presets, Cup launch threshold and shared Cup machinery | Implemented',
    )
    expect(index).toContain(
      '| [0024](0024-development-environment-operating-model.md) | Development environment operating model | Implemented for the current pre-cohort mode',
    )
    expect(index.match(/Accepted direction — unimplemented/g)?.length ?? 0).toBe(5)
  })
})
""",
    encoding="utf-8",
)

replace_once(
    "tests/scripts/featureBaselineFreshness.test.ts",
    "    expect(baseline).toContain('Contract 108 additionally refuses successor rounds')\n    expect(baseline).toContain('LMS successor-window scheduler')",
    "    expect(baseline).toContain('complete Contract 107–109 LMS wipeout restart lifecycle')\n    expect(baseline).toContain('Championship phase driver')",
)
replace_once(
    "tests/scripts/featureBaselineFreshness.test.ts",
    "      \"treat Contract 108's past-window guard as that scheduler\",",
    "      'describe the Contract 109 successor scheduler as absent',",
)

old_guard = Path("tests/scripts/contract108DocumentationFreshness.test.ts")
if not old_guard.exists():
    raise SystemExit("missing Contract 108 documentation guard")
old_guard.unlink()
Path("tests/scripts/lmsRestartDocumentationFreshness.test.ts").write_text(
    """import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

describe('LMS restart documentation freshness', () => {
  it('records Contract 108 as the guard and Contract 109 as the scheduler', () => {
    for (const path of [
      'CLAUDE.md',
      'MASTER-TODO.md',
      'docs/roadmap.md',
      'docs/competition-structure.md',
      'docs/architecture/programme-plan.md',
      'docs/architecture/multi-competition-hub-build-plan.md',
      'docs/design/README.md',
      'docs/adr/README.md',
      'docs/adr/0013-last-man-standing-season-rules.md',
      'docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
      'docs/quality/feature-baseline.md',
    ]) {
      expect(read(path), path).toMatch(/Contract[- ]109|contract 109/)
    }

    expect(read('MASTER-TODO.md')).toContain(
      '[x] Add the separate calendar authority/driver',
    )
    expect(read('docs/design/README.md')).toContain('| 109 |')
    expect(read('docs/roadmap.md')).not.toContain(
      'Schedule the LMS restart successor',
    )
    expect(read('CLAUDE.md')).not.toContain(
      'includes the LMS successor-window scheduler',
    )
    expect(
      read(
        'docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
      ),
    ).toContain('- **Status:** Implemented')
  })
})
""",
    encoding="utf-8",
)

print("Contract 109 documentation reconciliation complete")
