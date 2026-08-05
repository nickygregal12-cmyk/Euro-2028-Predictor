from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def replace_section(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = text.find(start)
    end_index = text.find(end, start_index + len(start))
    if start_index < 0 or end_index < 0:
        raise RuntimeError(f"{label}: section markers not found")
    if text.find(start, start_index + 1) >= 0:
        raise RuntimeError(f"{label}: duplicate start marker")
    return text[:start_index] + replacement.rstrip() + "\n\n" + text[end_index:]


# ---------------------------------------------------------------------------
# Roadmap: retain durable history, replace the stale executable sequence.
# ---------------------------------------------------------------------------
roadmap_path = ROOT / "docs" / "roadmap.md"
roadmap = roadmap_path.read_text(encoding="utf-8")
roadmap = replace_once(
    roadmap,
    "**Status date:** 3 August 2026",
    "**Status date:** 5 August 2026",
    "roadmap status date",
)
roadmap_sequence = """## Delivered platform backend since Stage C

The repository has moved well beyond the original Stage C foundation. The moving contract and hosted values remain in [`quality/current-status.md`](quality/current-status.md) and [`ops/ops-pending-migrations.md`](ops/ops-pending-migrations.md); the durable delivered capabilities are:

- the competition-season catalogue, separate game memberships and game-owned lock policies;
- season fixtures, Match Predictor cards, Jokers, lock resolution, recurring submission scheduling, scoring, replay-safe fixture reassignment, stored matchweek totals and bounded standings;
- season LMS eligibility, deterministic auto-assignment, used-team cycles, selection writes, correction-aware settlement and entrant-state replay;
- competition-neutral Championship/Cup points and settlement sources, season scheduling rules, persisted split phases, one-parent ancestry and a continuing table derived from settled initial and split fixtures;
- provider-response custody with strict decoding, archive-before-processing evidence and no path from a provider response to official result truth;
- repeatable competition instances, explicit live/current instance resolution and correction-safe terminal rederivation.

These are backend and control foundations. They do not mean that the season game surfaces, split driver, restart lifecycle, provider rehearsal or closed-cohort product have been delivered.

## Next executable sequence

1. **Finish the LMS restart lifecycle governed by ADR 0025.** A public `restart_all_reentered` wipeout creates a new linked competition row, copies immutable setup only, re-enters the previous field with no picks or used-team state, starts at the next eligible round and records one idempotent audited lifecycle event. Settlement continues to report the outcome rather than creating the successor itself.
2. **Run the first bounded provider rehearsal in non-production.** Configure only the approved development credential/path, make one request, prove raw custody precedes decode, prove processing evidence is append-only and prove no official fixture, result, lock, score, total, rank or standing is written. If credentials or provider authority are unavailable, stop rather than weakening the boundary.
3. **Build the season game surfaces from the accepted design authority.** Sequence the phone-first Match Predictor completion flow and retention standings; the LMS weekly-picks/read model and private-management paths; the Predictor Championship phase driver, tables and fixtures; then the Hub action/social shell. Backend availability is not a substitute for a usable surface.
4. **Instrument before cohort exposure.** Emit the Phase 1 taxonomy from the first surface commit, then run the headless season/anomaly log and only introduce a closed cohort after the provisional path is stable.
5. **Keep production paused as a separate milestone.** Repository and development progress do not authorise production migration or publication. Production promotion retains backup, preflight, approval, exact-artifact verification and rollback evidence.
6. **Keep Stage C2 blocked.** No ownership, erasure, pseudonymisation or replacement ownership-RLS work enters the platform until issue #272 records the independent data-protection decision.
7. **Review ACQ-R02 only at its trigger.** Reopen maintained standings only on a material cap increase or adverse rehearsal/hosted concurrency evidence, not merely because the design exists.
"""
roadmap = replace_section(
    roadmap,
    "## Next executable sequence",
    "## Parked Euro 2028 scope",
    roadmap_sequence,
    "roadmap executable sequence",
)
for stale in (
    "Provider-ingestion custody**: recreate",
    "It is blocked on a parity slice that does not exist yet",
    "the **Cup split-stage persistence decision**, then its implementation",
    "This is the only Cup work left",
):
    if stale in roadmap:
        raise RuntimeError(f"roadmap stale claim survived: {stale}")
roadmap_path.write_text(roadmap, encoding="utf-8")


# ---------------------------------------------------------------------------
# MASTER-TODO: preserve the inventory but reconcile delivered backend slices.
# ---------------------------------------------------------------------------
todo_path = ROOT / "MASTER-TODO.md"
todo = todo_path.read_text(encoding="utf-8")
todo = replace_once(todo, "**Status date:** 2 August 2026", "**Status date:** 5 August 2026", "TODO status date")
todo = replace_once(
    todo,
    "**Decision authority:** [`docs/adr/0011-multi-competition-platform.md`](docs/adr/0011-multi-competition-platform.md) through [`docs/adr/0019-brand-decision-deferred.md`](docs/adr/0019-brand-decision-deferred.md)",
    "**Decision authority:** [`docs/adr/README.md`](docs/adr/README.md), including later amendments through ADR 0025",
    "TODO decision authority",
)
todo = replace_once(
    todo,
    "- [x] Complete the guarded hosted development rollout (workflow from PR #351). *(Applied and postflight-verified 2–3 August 2026; the `SUPABASE_DEV_DB_URL` blocker is resolved. Development has since advanced to contract 79 through the ADR 0024 fast lane.)*",
    "- [x] Complete the guarded hosted development rollout (workflow from PR #351). *(Applied and postflight-verified 2–3 August 2026; later additive development movement is recorded only in `docs/quality/current-status.md` and the development machine record, not duplicated here.)*",
    "TODO Stage C hosted wording",
)

todo_stage_d = """## Stage D — ingestion and headless rehearsal

**Custody foundation delivered; live rehearsal remains.** The repository now has strict provider decoders, a server-only request boundary, raw-response archive-before-processing custody and append-only processing evidence. Provider data remains provisional and cannot write official competition truth.

- [ ] Confirm provider terms, coverage, timezone and exceptional-state mappings with dated evidence.
- [x] Implement the strict provider-response custody boundary behind one internal model.
- [ ] Configure the approved development credential and execute one bounded non-production request.
- [ ] Verify the exact raw response is archived before decode and every processing attempt is append-only.
- [ ] Keep ingestion provisional, replay-safe and unable to write official fixtures, results, locks, scores, totals, ranks or standings.
- [ ] Audit kickoff, round and result changes.
- [ ] Build deterministic anomaly fixtures for events not observed live.
- [ ] Prove stale/unavailable data fails closed.
- [ ] Build bulk review/confirmation ergonomics without allowing feeds to become official truth.
- [ ] Run the headless season and maintain an anomaly/evidence log.
- [ ] Introduce the closed cohort only after the provisional pipeline has demonstrated stability.
"""
todo = replace_section(todo, "## Stage D — ingestion and headless rehearsal", "## Stage E — season Predictor", todo_stage_d, "TODO Stage D")

todo_stage_e = """## Stage E — season Predictor

**Backend foundation delivered; product surfaces remain.** The season path has stored fixtures and predictions, whole-matchweek Jokers, zero-buffer locks, empty-card semantics, recurring lock processing, replay-safe fixture reassignment, scoring parity, stored matchweek totals and a bounded season leaderboard.

- [x] Build the backend authorities from ADR 0012 as amended by ADR 0020.
- [x] Add recurring matchweek submission scheduling around the stored card and lock authorities.
- [x] Extend TypeScript/PostgreSQL parity for season scoring.
- [x] Cover backend late entry, unbanked rounds, blank/partial cards, reschedules and corrections.
- [ ] Build the fast phone entry and completion flow.
- [ ] Build matchweek, monthly and form standings as first-class retention surfaces that never feed back into the canonical total.
- [ ] Prove the complete user journey across hostile loading, unavailable, correction and replay states.
- [ ] Measure completion and low-rank retention during the closed cohort and record the result.
"""
todo = replace_section(todo, "## Stage E — season Predictor", "## Stage F — season Last Man Standing", todo_stage_e, "TODO Stage E")

todo_stage_f = """## Stage F — season Last Man Standing

**Rules, storage and settlement delivered; lifecycle and surfaces remain.** Eligibility, deterministic C-collation auto-assignment, used-team cycles, lock-time selection writes, correction-aware replay, entrant-state projection and the recurring settlement job are implemented. The settlement job deliberately reports a large public wipeout without creating its successor.

- [x] Encode the ADR 0013 rules as pure TypeScript authorities with PostgreSQL parity.
- [x] Persist LMS setup, selections, used cycles and entrant state with server-side lock and allowance enforcement.
- [x] Drive `resolve_lms_pick` and `conclude_lms_round` from confirmed results through the correction-aware settlement job.
- [ ] Implement the ADR 0025 `restart_all_reentered` lifecycle as a separate idempotent, advisory-lock-protected successor operation.
- [ ] Complete public/private registration and repeating-competition user journeys.
- [ ] Build managed entrants and organiser audit/ownership paths.
- [ ] Prove the consolidated weekly-picks read model and phone selection surface.
- [ ] Cover every depletion, reduced-round, reset and exceptional endgame through complete browser journeys.
"""
todo = replace_section(todo, "## Stage F — season Last Man Standing", "## Stage G — season Predictor Cup", todo_stage_f, "TODO Stage F")

todo_stage_g = """## Stage G — season Predictor Cup

**Rules, shared machinery and split persistence delivered; the phase driver and surfaces remain.** The shared Cup machinery is competition-neutral; the season supplies its own sources. Split groups and memberships are phase-aware, each child has one initial parent, and continuing standings are derived from settled fixtures across both phases rather than copied into a starting total.

- [x] Build from ADR 0014 as amended by ADRs 0020, 0022 and 0025.
- [x] Reuse the existing draw, qualification, bracket and Penalty Number machinery through competition-neutral sources.
- [x] Prove format selection, circle-method schedules, tie settlement and reduced fixture sets.
- [x] Persist `stage = 'split'`, phase-aware membership, one-parent ancestry and derived continuing standings.
- [ ] Build the phase-transition driver that creates the two child groups, assigns entrants by the final initial table and schedules the immutable split fixtures.
- [ ] Expose the continuing table and phase state through a bounded browser read.
- [ ] Build the season Predictor Championship surfaces after the Phase 1 design gate.
"""
todo = replace_section(todo, "## Stage G — season Predictor Cup", "## Stage H — hub and social product", todo_stage_g, "TODO Stage G")

for stale in (
    "Development has since advanced to contract 79",
    "**NEXT SLICE.**",
    "What remains below is the settlement job",
    "Decide and document the split-stage persistence shape",
    "bonus_cup_fixtures.stage` is still `('group', 'playoff', 'knockout')",
):
    if stale in todo:
        raise RuntimeError(f"TODO stale claim survived: {stale}")
todo_path.write_text(todo, encoding="utf-8")


# ---------------------------------------------------------------------------
# CLAUDE.md: replace the stale convenience summary with a drift-resistant one.
# ---------------------------------------------------------------------------
claude_path = ROOT / "CLAUDE.md"
claude = """# CLAUDE.md — Football Prediction Hub

Convenience summary for coding-agent sessions. [`AGENTS.md`](AGENTS.md), [`docs/quality/current-status.md`](docs/quality/current-status.md) and the machine contract records are authoritative. This file deliberately does not repeat the moving repository, development, production or Netlify contract values.

## Start every session

1. Read current `main`, open pull requests and the exact branch ancestry before changing anything.
2. Read `config/deployment-contract.json` and `config/development-hosted-contract.json`; do not infer hosted state from an older report.
3. Read [`docs/quality/current-status.md`](docs/quality/current-status.md) for implementation/hosted truth and [`docs/roadmap.md`](docs/roadmap.md) for the current executable sequence.
4. Treat dated audits, investigations, reconciliations and automation handovers as evidence at their recorded commit—not as a current task list.
5. Keep concurrent work separate. Do not restack, renumber, rewrite or merge another session's branch without first establishing ownership and overlap.

## Project framing

- This is a mobile-first, multi-competition football prediction platform.
- Euro 2028 is the recoverable first tournament baseline at `euro-2028-baseline`; its remaining tournament-specific scope returns in January 2028.
- A competition season supplies real football. Each prediction game is joined separately and owns its own rules, entry/state, scoring or progression and standings.
- Following a competition is not game entry. Joining a private league is not game enrolment.
- Platform and game decisions live in [`docs/adr/README.md`](docs/adr/README.md). Do not infer season rules from the tournament implementation or presentation copy.
- The finished presentation target lives in [`docs/design/README.md`](docs/design/README.md); it cannot change a scoring, lock, membership, settlement, progression or reveal rule.

## Current implementation boundary

The shared competition context/lock foundation and its Home, Matches, Match Centre and entry-lock consumers are delivered. The repository also contains the competition-season/game catalogue and backend authorities for season Match Predictor, season Last Man Standing and Predictor Championship, including recurring jobs, scoring/settlement, standings, repeatable competition instances and split persistence.

Do not mistake backend presence for a completed product. The remaining work is governed by the roadmap and includes lifecycle/phase drivers, bounded browser reads and surfaces, provider rehearsal, instrumentation/cohort evidence and launch operations. Stage C2 ownership/erasure work remains blocked by issue #272.

## Architecture

- Shared competition rules live under `src/domain/competition/`.
- Tournament-only rules live under `src/domain/tournament/`; season-only rules live under `src/domain/season/`.
- Shared domain code may not import tournament or season implementations; tournament and season implementations may not import one another.
- One game's scoring or progression code never imports another's.
- Domain code is pure: no storage, network or ambient clock reads; time is an input.
- Components render domain/read-model output and never call Supabase directly.
- Browser database access goes through `src/services/supabase/` and bounded RPC/read-model contracts.
- The database is authoritative for locks, submissions, official results, progression, scoring, lifecycle state and server-enforced reveal/access.
- Live/provider data is provisional. Protected confirmation/correction remains the official scoring and progression gate.
- Predicted and real brackets never blend.
- Competition and game separation must be visible in the interface as well as true in storage.

## Scoring and game rules

[`docs/scoring-rules.md`](docs/scoring-rules.md) remains authoritative for the preserved Euro Original Predictor configuration. It is not a platform default.

Season Match Predictor, Last Man Standing and Predictor Championship rules come from ADRs 0012–0014 and their later amendments. Keep TypeScript, PostgreSQL, pgTAP and source guards aligned whenever a rule authority changes.

## Development and verification

- Normal work targets the development environment. Production promotion is a separately approved milestone.
- Additive development migrations use the guarded fast lane only after its checker derives the pending set and accepts every migration.
- UI/copy/docs: CI, plus a targeted preview or interaction check when appearance/behaviour changes.
- Application features or development schema: CI plus relevant Browser E2E and/or Database parity.
- Scoring, locks, lifecycle, auth, destructive work or production changes: the full applicable evidence, explicit approval and target-specific verification.
- A green repository check is not evidence that a hosted environment was changed.

## Hard boundaries

- No direct push to `main`.
- No unapproved production mutation, reset, repair or contract-declaration change.
- No guard bypass or direct-table fallback around a protected RPC.
- No Supabase/Netlify environment crossing and no modification of the historic World Cup deployment.
- No scoring, lifecycle or rule change without its authority and executable evidence.
- No hosted claim without fresh target-specific evidence.
- No combined cross-competition entry, score, survival, progression or standings authority.
- No rewriting dated evidence to make the current position look cleaner; correct the live authority and preserve history.
"""
claude_path.write_text(claude, encoding="utf-8")

print("Reconciled docs/roadmap.md, MASTER-TODO.md and CLAUDE.md")
