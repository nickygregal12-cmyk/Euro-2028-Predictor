from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new), encoding="utf-8")


# Session guidance: Contract 108 is a delivered guard, not the missing scheduler.
replace_once(
    "CLAUDE.md",
    "the idempotent LMS wipeout restart transition and split persistence.",
    "the idempotent LMS wipeout restart transition, the Contract 108 past-window calendar guard and split persistence.",
)

# Active execution sequence.
replace_once(
    "docs/roadmap.md",
    "- repeatable competition instances, explicit live/current instance resolution, correction-safe terminal rederivation and an idempotent LMS wipeout restart that creates a fresh successor without copying picks, cycles, projections or windows.",
    "- repeatable competition instances, explicit live/current instance resolution, correction-safe terminal rederivation and an idempotent LMS wipeout restart that creates a fresh successor without copying picks, cycles, projections or windows, plus the Contract 108 publisher/database guard that refuses successor rounds which opened or locked before their predecessor completed.",
)
replace_once(
    "docs/roadmap.md",
    "1. **Schedule the LMS restart successor from an authoritative league calendar.** Contract 107 now completes the wiped-out predecessor and creates one idempotent, linked successor with a fresh field and no copied picks, cycles, projections or windows. The next contract must identify the next eligible league round, create the successor windows exactly once and keep the new competition inert rather than guessing when no valid round exists.",
    "1. **Schedule the LMS restart successor from an authoritative league calendar.** Contract 107 completes the wiped-out predecessor and creates one idempotent, linked successor with a fresh field and no copied picks, cycles, projections or windows. Contract 108 now prevents the catalogue publisher or any other writer from attaching rounds that opened or locked before the predecessor completed. The remaining scheduler must identify the next eligible league round, create the successor windows exactly once and keep the new competition inert rather than guessing when no valid round exists; the guard is not the scheduler.",
)

# Detailed active inventory.
replace_once(
    "MASTER-TODO.md",
    "**Rules, storage, settlement and restart transition delivered; scheduling and surfaces remain.** Eligibility, deterministic C-collation auto-assignment, used-team cycles, lock-time selection writes, correction-aware replay, entrant-state projection and the recurring settlement job are implemented. Contract 107 now converts a qualifying public wipeout into one idempotent linked successor, re-entering the field and copying no selections, cycles, projections or windows.",
    "**Rules, storage, settlement, restart transition and past-window guard delivered; scheduling and surfaces remain.** Eligibility, deterministic C-collation auto-assignment, used-team cycles, lock-time selection writes, correction-aware replay, entrant-state projection and the recurring settlement job are implemented. Contract 107 converts a qualifying public wipeout into one idempotent linked successor, re-entering the field and copying no selections, cycles, projections or windows. Contract 108 prevents that successor inheriting any round that opened or locked before its predecessor completed, without choosing its future calendar.",
)
replace_once(
    "MASTER-TODO.md",
    "- [x] Implement the ADR 0025 `restart_all_reentered` lifecycle as a separate idempotent, advisory-lock-protected successor operation. *(Contract 107; successor intentionally arrives with no windows.)*\n- [ ] Add the separate calendar authority/driver that starts the successor at the next eligible league round and creates its windows exactly once.",
    "- [x] Implement the ADR 0025 `restart_all_reentered` lifecycle as a separate idempotent, advisory-lock-protected successor operation. *(Contract 107; successor intentionally arrives with no windows.)*\n- [x] Refuse successor windows that opened or locked before the predecessor completed, at both publisher and database boundaries. *(Contract 108; safety guard only, not scheduling.)*\n- [ ] Add the separate calendar authority/driver that starts the successor at the next eligible league round and creates its windows exactly once.",
)

# Structural and programme summaries.
replace_once(
    "docs/competition-structure.md",
    "The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances, the idempotent LMS wipeout restart transition and split persistence. The LMS successor still needs an authoritative next-round/window scheduler; the Championship still needs its phase driver; both also need bounded browser reads and product surfaces. Those remaining journeys land through the roadmap sequence—backend presence is not a completed user journey.",
    "The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances, the idempotent LMS wipeout restart transition, the Contract 108 past-window guard and split persistence. The LMS successor still needs an authoritative next-round/window scheduler; Contract 108 prevents an invalid inherited past but does not choose the future calendar. The Championship still needs its phase driver; both also need bounded browser reads and product surfaces. Those remaining journeys land through the roadmap sequence—backend presence is not a completed user journey.",
)
replace_once(
    "docs/architecture/programme-plan.md",
    "- season Last Man Standing persistence, settlement and an idempotent wipeout-restart lifecycle transition;",
    "- season Last Man Standing persistence, settlement, an idempotent wipeout-restart lifecycle transition and the Contract 108 past-window calendar guard;",
)
replace_once(
    "docs/architecture/programme-plan.md",
    "These are backend capabilities, not proof that the programme's product gates have passed. The LMS successor created by the restart transition has no windows until a separately reviewed calendar authority schedules the next eligible league round.",
    "These are backend capabilities, not proof that the programme's product gates have passed. The LMS successor created by the restart transition has no windows until a separately reviewed calendar authority schedules the next eligible league round. Contract 108 protects that gap by refusing rounds which opened or locked before the predecessor completed; it does not select or create the future calendar.",
)
replace_once(
    "docs/architecture/multi-competition-hub-build-plan.md",
    "the idempotent LMS wipeout restart transition",
    "the idempotent LMS wipeout restart transition and the Contract 108 past-window calendar guard",
)

# Design delta and boundary.
replace_once(
    "docs/design/README.md",
    "| 107 | the idempotent LMS wipeout restart creates a linked successor and copies no picks, cycles, projections or windows |",
    "| 107 | the idempotent LMS wipeout restart creates a linked successor and copies no picks, cycles, projections or windows |\n| 108 | a restarted competition cannot inherit a round that opened or locked before its predecessor finished; the actual scheduler remains separate |",
)
replace_once(
    "docs/design/README.md",
    "Contract 107 is a lifecycle transition, not a complete restart journey. The\nsuccessor is deliberately inert until a separate calendar authority identifies\nthe next eligible league round and creates its windows exactly once; the design\nmust show that honest unavailable/not-started state rather than implying picks\nare open.",
    "Contract 107 is a lifecycle transition, not a complete restart journey. The\nsuccessor is deliberately inert until a separate calendar authority identifies\nthe next eligible league round and creates its windows exactly once. Contract\n108 protects that inert boundary: the catalogue publisher and database both\nrefuse any successor round that opened or locked before the predecessor\ncompleted. It does not choose the next eligible round or create a successor\ncalendar, so the design must still show the honest unavailable/not-started state\nrather than implying picks are open.",
)

# ADR implementation status.
replace_once(
    "docs/adr/README.md",
    "| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — partially implemented: rules, storage, settlement/replay and Contract-107 restart transition are merged; successor-window scheduling and complete private/player journeys remain |",
    "| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — partially implemented: rules, storage, settlement/replay, the Contract-107 restart transition and Contract-108 past-window guard are merged; successor-window scheduling and complete private/player journeys remain |",
)
replace_once(
    "docs/adr/README.md",
    "| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Accepted direction — partially implemented: reveal/defect/split decisions and the idempotent Contract-107 successor transition are merged; the separate next-eligible-round/window scheduler remains |",
    "| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Accepted direction — partially implemented: reveal/defect/split decisions, the idempotent Contract-107 successor transition and Contract-108 past-window guard are merged; the separate next-eligible-round/window scheduler remains |",
)
replace_once(
    "docs/adr/0013-last-man-standing-season-rules.md",
    "> **Implementation progress — 5 August 2026.** Presets, setup/state storage, eligibility, deterministic auto-assignment, used-team cycles, selection writes, correction-aware settlement/replay and the idempotent wipeout restart transition are merged through Contract 107. The successor intentionally has no windows until a separate calendar authority selects the next eligible league round; private/managed-entry and player-facing journeys also remain unfinished.",
    "> **Implementation progress — 5 August 2026.** Presets, setup/state storage, eligibility, deterministic auto-assignment, used-team cycles, selection writes, correction-aware settlement/replay and the idempotent wipeout restart transition are merged through Contract 107. Contract 108 now refuses any successor round that opened or locked before the predecessor completed. The successor still intentionally has no windows until a separate calendar authority selects the next eligible league round; private/managed-entry and player-facing journeys also remain unfinished.",
)
replace_once(
    "docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md",
    "> **Implementation progress — 5 August 2026.** Contracts 99–101 close the invalid-outcome CHECK, REL-001 and Euro post-lock reveal scope; Contracts 102/105 persist and derive the split; Contracts 103–107 supply repeatable instances, caller resolution, correction-safe terminal rederivation and the idempotent LMS successor transition. The one remaining lifecycle step is the separate calendar/window driver that starts the successor at the next eligible league round; Contract 107 deliberately creates no windows.",
    "> **Implementation progress — 5 August 2026.** Contracts 99–101 close the invalid-outcome CHECK, REL-001 and Euro post-lock reveal scope; Contracts 102/105 persist and derive the split; Contracts 103–107 supply repeatable instances, caller resolution, correction-safe terminal rederivation and the idempotent LMS successor transition. Contract 108 refuses any successor round that opened or locked before its predecessor completed, protecting the deliberate no-window state. The one remaining lifecycle step is the separate calendar/window driver that starts the successor at the next eligible league round; neither Contract 107 nor 108 creates that calendar.",
)

# Feature/safeguard baseline, including the reminder wording exposed by the acquisition-risk reconciliation.
replace_once(
    "docs/quality/feature-baseline.md",
    "- repeatable competition instances, explicit live/current resolution, correction-safe rederivation after completion and an idempotent LMS wipeout restart that creates a linked successor while copying no selections, used cycles, projections or windows.",
    "- repeatable competition instances, explicit live/current resolution, correction-safe rederivation after completion and an idempotent LMS wipeout restart that creates a linked successor while copying no selections, used cycles, projections or windows; Contract 108 additionally refuses successor rounds that opened or locked before the predecessor completed, without scheduling the future calendar.",
)
replace_once(
    "docs/quality/feature-baseline.md",
    "| `FEAT-041` | Deadline reminder emails | Documented/planned | Preference exists; delivery awaits Auth/SMTP ownership |",
    "| `FEAT-041` | Deadline reminder emails | Documented/planned | Preference exists; no scheduled one-hour in-app/email reminder authority exists yet |",
)
replace_once(
    "docs/quality/feature-baseline.md",
    "- describe the Contract 107 successor as playable before an authoritative next-round/window scheduler has populated it;",
    "- describe a restarted successor as playable before an authoritative next-round/window scheduler has populated it, or treat Contract 108's past-window guard as that scheduler;",
)
replace_once(
    "tests/scripts/featureBaselineFreshness.test.ts",
    "    expect(baseline).toContain('idempotent LMS wipeout restart')\n    expect(baseline).toContain('LMS successor-window scheduler')",
    "    expect(baseline).toContain('idempotent LMS wipeout restart')\n    expect(baseline).toContain('Contract 108 additionally refuses successor rounds')\n    expect(baseline).toContain('LMS successor-window scheduler')",
)
replace_once(
    "tests/scripts/featureBaselineFreshness.test.ts",
    "      'describe the Contract 107 successor as playable before an authoritative next-round/window scheduler has populated it',",
    "      \"treat Contract 108's past-window guard as that scheduler\",",
)
replace_once(
    "tests/scripts/featureBaselineFreshness.test.ts",
    "  it('keeps the stable compact identifier contract unchanged', () => {",
    "  it('keeps reminder delivery separate from password-recovery SMTP ownership', () => {\n    expect(baseline).toContain(\n      'no scheduled one-hour in-app/email reminder authority exists yet',\n    )\n    expect(baseline).not.toContain('delivery awaits Auth/SMTP ownership')\n  })\n\n  it('keeps the stable compact identifier contract unchanged', () => {",
)
replace_once(
    "tests/scripts/adrStatusFreshness.test.ts",
    "  it('keeps the Contract 107 lifecycle boundary honest', () => {",
    "  it('keeps the Contract 107/108 lifecycle boundary honest', () => {",
)
replace_once(
    "tests/scripts/adrStatusFreshness.test.ts",
    "    expect(lms).toContain('The successor intentionally has no windows')\n    expect(lifecycle).toContain('Contract 107 deliberately creates no windows')",
    "    expect(lms).toContain('Contract 108 now refuses any successor round')\n    expect(lms).toContain('The successor still intentionally has no windows')\n    expect(lifecycle).toContain('neither Contract 107 nor 108 creates that calendar')",
)

# Dedicated cross-document guard for the concurrency correction.
Path("tests/scripts/contract108DocumentationFreshness.test.ts").write_text(
    """import { readFileSync } from 'node:fs'\nimport { resolve } from 'node:path'\nimport { describe, expect, it } from 'vitest'\n\nconst read = (path: string) =>\n  readFileSync(resolve(process.cwd(), path), 'utf8')\n\ndescribe('Contract 108 documentation freshness', () => {\n  it('records the past-window guard without pretending it schedules the successor', () => {\n    for (const path of [\n      'CLAUDE.md',\n      'MASTER-TODO.md',\n      'docs/roadmap.md',\n      'docs/competition-structure.md',\n      'docs/architecture/programme-plan.md',\n      'docs/architecture/multi-competition-hub-build-plan.md',\n      'docs/design/README.md',\n      'docs/adr/README.md',\n      'docs/adr/0013-last-man-standing-season-rules.md',\n      'docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',\n      'docs/quality/feature-baseline.md',\n    ]) {\n      expect(read(path), path).toMatch(/Contract[- ]108|contract 108/)\n    }\n\n    expect(read('docs/roadmap.md')).toContain('the guard is not the scheduler')\n    expect(read('MASTER-TODO.md')).toContain('safety guard only, not scheduling')\n    expect(read('docs/design/README.md')).toContain('the actual scheduler remains separate')\n    expect(read('docs/roadmap.md')).not.toContain('The next contract must identify')\n  })\n})\n""",
    encoding="utf-8",
)

print("Contract 108 documentation reconciliation complete")
