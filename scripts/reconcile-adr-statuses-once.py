from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADR = ROOT / 'docs' / 'adr'


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def insert_after(path: Path, anchor: str, addition: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(anchor)
    if count != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {count}')
    path.write_text(text.replace(anchor, anchor + addition, 1), encoding='utf-8')


# 0003 — later capacity evidence supersedes the first 12-result sample, but the
# decision remains deliberately deferred at current caps.
path = ADR / '0003-asynchronous-incremental-scoring.md'
replace_once(
    path,
    '- **Status:** Accepted direction — not currently justified: first capacity evidence (28 July 2026, `docs/quality/investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`) measured the synchronous full recompute at ~354 ms for 250 entries with 12 results; revisit at full-tournament result volume (see `DEC-009`)',
    '- **Status:** Accepted direction — not currently justified at the operating caps. Later ACQ-R03 evidence measured the synchronous full recompute at roughly 884 ms by group result 36 for 250 entries and roughly 4 seconds for 1,000, with WAL/bloat, knockout-cascade and concurrency probes also recorded. `DEC-009` remains deferred to the full dress rehearsal rather than being decided from the original 12-result sample.',
    'ADR 0003 status',
)

# 0005 — several more database jobs and the provider custody boundary now exist.
path = ADR / '0005-background-jobs.md'
replace_once(
    path,
    '- **Status:** Accepted direction — partially implemented (auto-submit at lock ships on `pg_cron` via contract 41, `20260727174658_automatic_entry_submission.sql`; rate-limit pruning was instead solved opportunistically in-transaction, `20260720210000_rate_limits.sql`; scoring drain, standings reconciliation, reminders, failure reporting and the Edge Functions half remain unbuilt)',
    '- **Status:** Accepted direction — partially implemented. Database scheduling now drives Original auto-submission (contract 41), recurring season Match Predictor lock processing (contract 83) and season LMS settlement/replay (contract 89); rate-limit pruning remains transaction-local. The provider Edge Function has a server-only custody/strict-decode boundary (contract 97) but no approved live rehearsal. Incremental scoring drain, maintained-standings reconciliation, reminders and general failed/delayed-job reporting remain unbuilt.',
    'ADR 0005 status',
)

# 0011 — core context, catalogue, lock and instance architecture delivered;
# complete Hub journeys remain.
path = ADR / '0011-multi-competition-platform.md'
replace_once(path, '- **Status:** Accepted direction — unimplemented', '- **Status:** Accepted direction — partially implemented', 'ADR 0011 status')
insert_after(
    path,
    '- **Date:** 29 July 2026\n',
    '\n> **Implementation progress — 5 August 2026.** The shared competition-context and game-owned lock foundations, competition-season/game catalogue, separate memberships, same-season persistence, repeatable competition instances and explicit live/current resolution are merged. The Context section below records the pre-implementation starting point. Complete Hub navigation, season game journeys and remaining product surfaces are still unfinished.\n',
    'ADR 0011 progress note',
)

# 0012 — rule/storage/job/scoring/standings spine delivered, surface absent.
path = ADR / '0012-season-predictor-rules.md'
replace_once(path, '- **Status:** Accepted direction — unimplemented', '- **Status:** Accepted direction — partially implemented', 'ADR 0012 status')
insert_after(
    path,
    '- **Amended by:** this record\'s own 4 August 2026 amendment below, which withdraws the pre-filled card and lock-time auto-completion; and [ADR 0020](0020-football-prediction-hub-product-model.md) — the Joker count becomes ten split five and five, and a fixture postponed after its round locks is reassigned to its new round with an editable prediction rather than staying frozen. The matchweek Joker unit, the one-per-matchweek maximum, the scoring values, rolling entry and the cumulative-total ranking law below are **unchanged and still authoritative**.\n',
    '\n> **Implementation progress — 5 August 2026.** Pure-domain rules, season fixtures/predictions/Jokers, empty-card lock behaviour, recurring processing, replay-safe reassignment, scoring parity, stored matchweek totals and the bounded cumulative standings authority are merged. The phone-first card, secondary standings and complete season user journeys remain unbuilt.\n',
    'ADR 0012 progress note',
)

# 0013 — backend and restart transition delivered; successor calendar and UX absent.
path = ADR / '0013-last-man-standing-season-rules.md'
replace_once(path, '- **Status:** Accepted direction — unimplemented', '- **Status:** Accepted direction — partially implemented', 'ADR 0013 status')
insert_after(
    path,
    '- **Amended by:** [ADR 0020](0020-football-prediction-hub-product-model.md) — the thirty-minute buffer becomes a property of the Last Man Standing **game** rather than of the competition season, so the Main Predictor in the same competition locks at first kickoff with no buffer. The buffer\'s value and every other rule below are unchanged. ADR 0020 also records that leaving an LMS competition never permits rejoining that same running competition, consistent with the rolling-entry rejection below.\n',
    '\n> **Implementation progress — 5 August 2026.** Presets, setup/state storage, eligibility, deterministic auto-assignment, used-team cycles, selection writes, correction-aware settlement/replay and the idempotent wipeout restart transition are merged through Contract 107. The successor intentionally has no windows until a separate calendar authority selects the next eligible league round; private/managed-entry and player-facing journeys also remain unfinished.\n',
    'ADR 0013 progress note',
)

# 0014 — shared machinery and split read delivered; driver/read/surface absent.
path = ADR / '0014-predictor-cup-season-formats.md'
replace_once(path, '- **Status:** Accepted direction — unimplemented', '- **Status:** Accepted direction — partially implemented', 'ADR 0014 status')
insert_after(
    path,
    '- **Amended by:** [ADR 0020](0020-football-prediction-hub-product-model.md) — the game is named **Predictor Championship** in the interface, with every internal identifier left unchanged, and global entry closes at Matchday 1 rather than at the draw. Every format rule below — the group cap of twenty, the meetings arithmetic, the split, the seeded playoff, points-per-game cross-group ranking, the published immutable fixture list, the settlement cutoff, the tie-break sequence and the jokers-never-apply law — is **unchanged and remains the format authority**.\n',
    '\n> **Implementation progress — 5 August 2026.** Format selection, launch threshold, neutral points/settlement machinery, season sources, circle-method scheduling rules, split persistence, one-parent ancestry and a continuing table derived across settled initial and split fixtures are merged. The phase-transition driver that creates/schedules the child groups, its bounded browser read and the Predictor Championship surfaces remain unbuilt.\n',
    'ADR 0014 progress note',
)

# 0020 — data/product model is materially implemented but finished Hub UX is not.
path = ADR / '0020-football-prediction-hub-product-model.md'
replace_once(path, '- **Status:** Accepted', '- **Status:** Accepted direction — partially implemented', 'ADR 0020 status')
insert_after(
    path,
    '- **Amends:** five named rules in ADRs 0012, 0013 and 0014, and the lock-policy ownership in ADR 0011. Every other rule in those records remains authoritative — see [§ Rule reconciliation](#rule-reconciliation-with-adrs-0011-0014).\n',
    '\n> **Implementation progress — 5 August 2026.** The competition-season/game data model, separate game memberships, game-owned locks and substantial Match Predictor/LMS/Championship backend authorities are merged. The finished Football Prediction Hub shell, onboarding and complete game surfaces remain governed by ADR 0023 and the target design authority.\n',
    'ADR 0020 progress note',
)

# 0022 — all decisions in this record have executable implementations.
path = ADR / '0022-season-preset-threshold-and-shared-cup-machinery.md'
replace_once(path, '- **Status:** Accepted', '- **Status:** Implemented', 'ADR 0022 status')
insert_after(
    path,
    '- **Amends:** [ADR 0013](0013-last-man-standing-season-rules.md) (supplies the three preset compositions it mandated but left undefined), [ADR 0014](0014-predictor-cup-season-formats.md) (supplies the launch threshold it left undefined and settles where its reused machinery lives). Every other rule in both records is unchanged.\n',
    '\n> **Implementation evidence — 5 August 2026.** The LMS preset/setup domain and storage, public Championship launch threshold, competition-neutral Cup points and settlement machinery, season sources and parity/schedule authorities are merged. Later split persistence and continuing-table work build on this decision rather than leaving any item in this ADR unresolved.\n',
    'ADR 0022 progress note',
)

# 0023 — backend private/game model partly delivered; shell/onboarding/managed UX not.
path = ADR / '0023-hub-information-architecture.md'
replace_once(path, '- **Status:** Accepted direction — unimplemented', '- **Status:** Accepted direction — partially implemented', 'ADR 0023 status')
insert_after(
    path,
    '- **Amends:** [ADR 0020](0020-football-prediction-hub-product-model.md) (public domestic game name, Hub/competition navigation and onboarding), [ADR 0013](0013-last-man-standing-season-rules.md) (creator limits around the private competitions it already permits), and [ADR 0015](0015-commercial-and-social-model.md) (the concrete private-container model). It supersedes the navigation clause in [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md) §0 and the navigation/catalogue section in [`../competition-structure.md`](../competition-structure.md).\n',
    '\n> **Implementation progress — 5 August 2026.** Competition/game identity, separate memberships, private/public competition instances, game leagues, bounded standings authorities and the Match Predictor public name exist in the backend. The permanent Hub rail/tab shell, onboarding, full private-creation/managed-entrant UX and the complete phone-first competition journeys remain unbuilt.\n',
    'ADR 0023 progress note',
)

# 0024 — current pre-cohort operating model is implemented, with its future
# closed-cohort trigger remaining a condition rather than missing code.
path = ADR / '0024-development-environment-operating-model.md'
replace_once(
    path,
    '- **Status:** Accepted — the deployment-contract change is implemented; the remaining items are decided and staged',
    '- **Status:** Implemented for the current pre-cohort development operating model',
    'ADR 0024 status',
)
insert_after(
    path,
    '- **Amends:** the proportionate-checks intent already stated in `AGENTS.md` and `CLAUDE.md`, by making it operational. It does **not** amend any scoring, privacy, permission or production-safety decision, and nothing here relaxes a control that protects production data.\n',
    '\n> **Implementation evidence — 5 August 2026.** Non-production contract mismatch reporting, the guarded additive fast lane, deterministic seed contract, proportionate CI/browser/database gates and separate production controls are all active. The closed-cohort trigger changes future operating requirements when it occurs; it is not an unimplemented part of the present model.\n',
    'ADR 0024 progress note',
)

# 0025 — all four decisions are implemented except the lifecycle's deliberately
# separate successor-window scheduler.
path = ADR / '0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md'
replace_once(path, '- **Status:** Accepted', '- **Status:** Accepted direction — partially implemented', 'ADR 0025 status')
insert_after(
    path,
    '- **Amends:** [ADR 0013](0013-last-man-standing-season-rules.md) (supplies the lifecycle its `restart_all_reentered` endgame implies but never described), [ADR 0014](0014-predictor-cup-season-formats.md) (supplies the split\'s persisted shape). Clarifies the scope of the post-lock reveal item in Appendix D.2 of [`../design/hub-architecture-and-modernisation-plan.md`](../design/hub-architecture-and-modernisation-plan.md) against contract 95. Every other rule in those records is unchanged.\n',
    '\n> **Implementation progress — 5 August 2026.** Contracts 99–101 close the invalid-outcome CHECK, REL-001 and Euro post-lock reveal scope; Contracts 102/105 persist and derive the split; Contracts 103–107 supply repeatable instances, caller resolution, correction-safe terminal rederivation and the idempotent LMS successor transition. The one remaining lifecycle step is the separate calendar/window driver that starts the successor at the next eligible league round; Contract 107 deliberately creates no windows.\n',
    'ADR 0025 progress note',
)

# Index: mirror the record-level truth without turning it into another live
# hosted-status document.
index = ADR / 'README.md'
replacements = {
    '| [0003](0003-asynchronous-incremental-scoring.md) | Asynchronous incremental scoring | Accepted direction — first capacity evidence (28 July 2026) shows full recompute at ~354 ms for 250 entries; not currently justified at the operating caps (see `DEC-009`) |':
        '| [0003](0003-asynchronous-incremental-scoring.md) | Asynchronous incremental scoring | Accepted direction — not currently justified at the operating caps; later full-group/WAL/bloat/knockout/concurrency evidence supersedes the first 12-result sample and `DEC-009` remains deferred to dress rehearsal |',
    '| [0005](0005-background-jobs.md) | Background jobs | Partially implemented — `pg_cron` auto-submit shipped (contract 41); remaining jobs and the Edge Functions half unbuilt |':
        '| [0005](0005-background-jobs.md) | Background jobs | Partially implemented — Original auto-submit, recurring Match Predictor processing and LMS settlement run as database jobs; provider custody exists without a live rehearsal; reminders, incremental scoring drain, maintained-standings reconciliation and general failure reporting remain |',
    '| [0011](0011-multi-competition-platform.md) | Multi-competition platform | Accepted direction — context and lock generalisation unimplemented; lock-policy ownership amended by [0020](0020-football-prediction-hub-product-model.md) |':
        '| [0011](0011-multi-competition-platform.md) | Multi-competition platform | Accepted direction — partially implemented: shared context/locks, competition-season/game catalogue, memberships and repeatable instances are merged; complete Hub and season journeys remain |',
    '| [0012](0012-season-predictor-rules.md) | Season Predictor rules | Accepted direction — unimplemented; Joker count and postponement rules amended by [0020](0020-football-prediction-hub-product-model.md); public game name set to Match Predictor by [0023](0023-hub-information-architecture.md) |':
        '| [0012](0012-season-predictor-rules.md) | Season Predictor rules | Accepted direction — partially implemented: rules, storage, recurring processing, scoring and cumulative standings backend are merged; phone card and complete season surfaces remain |',
    '| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — unimplemented; lock-buffer ownership amended by [0020](0020-football-prediction-hub-product-model.md), presets supplied by [0022](0022-season-preset-threshold-and-shared-cup-machinery.md), private creator limits clarified by [0023](0023-hub-information-architecture.md) |':
        '| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — partially implemented: rules, storage, settlement/replay and Contract-107 restart transition are merged; successor-window scheduling and complete private/player journeys remain |',
    '| [0014](0014-predictor-cup-season-formats.md) | Predictor Cup season formats | Accepted direction — unimplemented; entry close amended and interface name set to Predictor Championship by [0020](0020-football-prediction-hub-product-model.md); launch threshold and shared machinery supplied by [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) |':
        '| [0014](0014-predictor-cup-season-formats.md) | Predictor Cup season formats | Accepted direction — partially implemented: rules, neutral machinery, split persistence/ancestry and derived standings are merged; phase driver, bounded read and Predictor Championship surfaces remain |',
    '| [0020](0020-football-prediction-hub-product-model.md) | Football Prediction Hub product model | Accepted — amends five named rules in ADRs 0011–0014 and sets the Hub product model, domestic Joker, lock-policy and Predictor Championship decisions; navigation/onboarding and public Match Predictor name amended by [0023](0023-hub-information-architecture.md) |':
        '| [0020](0020-football-prediction-hub-product-model.md) | Football Prediction Hub product model | Accepted direction — partially implemented: competition/game identity, memberships, game-owned locks and season backends are merged; finished Hub shell, onboarding and game surfaces remain |',
    '| [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) | Season presets, Cup launch threshold and shared Cup machinery | Accepted — supplies the three LMS presets ADR 0013 mandated but left undefined and the 100-entrant public Cup threshold ADR 0014 left open (both now executable); **corrected 3 August 2026** on the Cup machinery — the machinery is PostgreSQL (`predictor_internal.cup_*`), not TypeScript, so there was nothing in `src/domain` to extract and the separation law was never at risk; sharing is a database rescoping sequenced after C1b, and the season Cup modules still lack parity coverage |':
        '| [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) | Season presets, Cup launch threshold and shared Cup machinery | Implemented — presets/setup, the public launch threshold, competition-neutral PostgreSQL Cup machinery, season sources and parity/schedule authorities are merged |',
    '| [0023](0023-hub-information-architecture.md) | Hub information architecture and private competition model | Accepted direction — unimplemented; retires the tournament-era future navigation, sets Hub/competition shells, onboarding, Match Predictor naming, private creation/caps, standings visibility, managed LMS and administration/fixture-change boundaries |':
        '| [0023](0023-hub-information-architecture.md) | Hub information architecture and private competition model | Accepted direction — partially implemented: backend competition/game/private-instance/membership/league authorities and Match Predictor naming exist; Hub shell, onboarding, managed entrants and full creation/journey surfaces remain |',
    '| [0024](0024-development-environment-operating-model.md) | Development environment operating model | Accepted — the preview contract-mismatch change is **implemented** (non-production trailing builds and reports; production and ahead-of-application still fail); development data is disposable until a closed external cohort begins, additive development migrations use a fast lane, browser regression is targeted with full runs at boundaries, and development must be deterministically reseedable. Production stays frozen and fully guarded; no production control is relaxed |':
        '| [0024](0024-development-environment-operating-model.md) | Development environment operating model | Implemented for the current pre-cohort mode — trailing non-production contracts report, ahead/production mismatches fail, additive fast lane and deterministic seed are active, proportionate gates are enforced and production controls remain separate |',
    '| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Accepted — settles the four questions that were blocking forward work. The LMS `restart_all_reentered` endgame **creates a new competition row** rather than wiping the old one, behind a separate idempotent lock-protected lifecycle function, which first requires resolving `bonus_competitions`\' availability/instance conflation and its `unique (tournament_id, game_key)` key. The Cup split becomes a **distinct persisted stage** with phase-aware groups and memberships, standings derived across both phases rather than carried forward as a starting total. Both tournament-path defects are corrected **now** — the `entry_automatic_submission_outcomes` three-valued-logic hole and REL-001 — with production promotion separately controlled as usual. Appendix D.2 and contract 95 are confirmed as **different scopes with no conflict**; neither boundary moves |':
        '| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Accepted direction — partially implemented: reveal/defect/split decisions and the idempotent Contract-107 successor transition are merged; the separate next-eligible-round/window scheduler remains |',
}
for old, new in replacements.items():
    replace_once(index, old, new, f'ADR index row {old[3:9]}')

# Assertions: no affected record or index row may still describe the whole
# delivered backend as unimplemented.
for filename in (
    '0011-multi-competition-platform.md',
    '0012-season-predictor-rules.md',
    '0013-last-man-standing-season-rules.md',
    '0014-predictor-cup-season-formats.md',
    '0023-hub-information-architecture.md',
):
    source = (ADR / filename).read_text(encoding='utf-8')
    if '- **Status:** Accepted direction — unimplemented' in source:
        raise RuntimeError(f'{filename}: stale unimplemented status survived')

required = {
    '0003-asynchronous-incremental-scoring.md': 'roughly 884 ms',
    '0005-background-jobs.md': 'recurring season Match Predictor lock processing',
    '0011-multi-competition-platform.md': 'repeatable competition instances',
    '0012-season-predictor-rules.md': 'stored matchweek totals',
    '0013-last-man-standing-season-rules.md': 'successor intentionally has no windows',
    '0014-predictor-cup-season-formats.md': 'phase-transition driver',
    '0020-football-prediction-hub-product-model.md': 'substantial Match Predictor/LMS/Championship backend authorities',
    '0022-season-preset-threshold-and-shared-cup-machinery.md': '- **Status:** Implemented',
    '0023-hub-information-architecture.md': 'private/public competition instances',
    '0024-development-environment-operating-model.md': 'Implemented for the current pre-cohort development operating model',
    '0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md': 'Contract 107 deliberately creates no windows',
}
for filename, needle in required.items():
    if needle not in (ADR / filename).read_text(encoding='utf-8'):
        raise RuntimeError(f'{filename}: missing {needle!r}')

print('Reconciled ADR implementation statuses and index')
