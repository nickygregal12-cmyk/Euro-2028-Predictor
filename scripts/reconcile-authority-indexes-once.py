from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# Deferred-decision register: close the split-shape decision, not its remaining driver.
path = ROOT / "docs" / "quality" / "deferred-decisions.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "Tagged repository source contains contracts through 63. Hosted database and application publication claims are `REQUIRES OWNER VERIFICATION` in the 29 July 2026 tag reconciliation.",
    "The recoverable `euro-2028-baseline` tag contains contracts through 63. Moving repository, hosted-database and publication facts belong in [`current-status.md`](current-status.md) and the machine contract records rather than this decision register.",
    "deferred register baseline",
)
old_dec014 = "| DEC-014 | Persistence shape for the season Cup's split stage | Contracts 74–79 completed the Cup rescoping: the shared machinery is competition-agnostic and the season supplies its own points and settlement sources. One thing is deliberately unbuilt. `bonus_cup_fixtures.stage` is still `('group', 'playoff', 'knockout')`, and a season split stage cannot simply be added to it: `bonus_cup_fixtures_group_shape` requires a non-group stage to carry **neither** `group_id` **nor** `matchday`, while split rounds need both — the split is a post-split round-robin within a half, so each fixture belongs to a half and to a round. Widening the enum alone buys a constraint violation rather than a feature. Contract 79 widened the two format domains (`size`, `matchday`) but left `stage` untouched for this reason. | The check encodes an assumption — that only group fixtures are grouped and numbered — which the split contradicts. Resolving it means deciding whether the split is a third shape alongside group and knockout, or a continuation of the group stage under a different label; that determines whether `group_shape` is relaxed, replaced, or the split reuses `stage = 'group'` with a phase marker. Guessing produces either a violated constraint or a weakened one. | ADR 0014's split rules, already encoded in `src/domain/season/cupGroupTable.ts`; no external dependency | Project owner | Before any season Cup persists a split fixture, and before `bonus_cup_fixtures.stage` is widened | Deferred | 2026-08-04 |"
new_dec014 = "| DEC-014 | Persistence shape for the season Cup's split stage | **DECIDED AND IMPLEMENTED.** ADR 0025 chose a distinct persisted `stage = 'split'`, phase-aware initial/split groups and memberships, one initial parent per split group, and continuing standings derived from settled fixtures across both phases rather than copied into starting points. Contract 102 made the shape representable; contract 105 enforced one-parent member ancestry and supplied the derived continuing table. | The remaining phase-transition driver and browser surface are implementation work, not an unresolved persistence decision. They must consume this shape rather than reopen it implicitly. | ADR 0025 decision 2; contracts 102 and 105; `153_cup_split_stage_persistence.sql` and `156_cup_split_group_tables.sql` | Project owner | Reopen only through a new ADR if the persisted phase shape or derived carry-forward rule changes | **Decided and implemented** | 2026-08-05 |"
text = replace_once(text, old_dec014, new_dec014, "DEC-014")
path.write_text(text, encoding="utf-8")


# Design index: preserve the plan snapshot but remove the stale current-main count.
path = ROOT / "docs" / "design" / "README.md"
text = path.read_text(encoding="utf-8")
old_baseline = """**The plan reviewed a snapshot of 93 migrations and 69 pgTAP suites** (§2.1).
`main` is at **103 migrations / 78 pgTAP suites** — contracts 94–103 landed on
4 August 2026, after the snapshot was taken:

| contract | what landed |
| --- | --- |
| 94 | `standings.ts` SQL parity — the season table, ranked |
| 95 | the bounded season leaderboard read, limited to league co-members |
| 96 | Cup tie refusal-order parity fix, found by differential sweep |
| 97 | server-only provider-response custody |
| 98 | the Cup RPC layer taken off the tournament link — the Penalty Number target and lock instant |
| 99 | an `invalid` automatic-submission outcome must carry a reason |
| 100 | REL-001 — the Bonus Games rederive joins the tournament lock |
| 101 | Euro post-lock reveal stops gating on shared leagues |
| 102 | the Predictor Championship split stage persisted, phase-aware |
| 103 | a competition can happen more than once — lifecycle-aware uniqueness |

Nothing in those contradicts the plan, but **Appendix D.2's reconciliation list
predates them** and must be checked against
[`../quality/current-status.md`](../quality/current-status.md) before being
treated as outstanding work."""
new_baseline = """**The plan reviewed a snapshot of 93 migrations and 69 pgTAP suites** (§2.1).
That count is a document-input fact, not a live repository gauge. The repository
has moved substantially beyond the snapshot; read
[`../quality/current-status.md`](../quality/current-status.md) and
`config/deployment-contract.json` for the moving head rather than copying a count
from this design index.

The merged delta known at this 5 August review is:

| contract | what landed after the plan snapshot |
| --- | --- |
| 94 | `standings.ts` SQL parity — the season table, ranked |
| 95 | the bounded season leaderboard read, limited to league co-members |
| 96 | Cup tie refusal-order parity fix, found by differential sweep |
| 97 | server-only provider-response custody |
| 98 | the Cup RPC layer taken off the tournament link — the Penalty Number target and lock instant |
| 99 | an `invalid` automatic-submission outcome must carry a reason |
| 100 | REL-001 — the Bonus Games rederive joins the tournament lock |
| 101 | Euro post-lock reveal stops gating on shared leagues |
| 102 | the Predictor Championship split stage persisted, phase-aware |
| 103 | competition instances became repeatable through lifecycle-aware uniqueness |
| 104 | operational callers became live-instance explicit and current reads terminal-aware |
| 105 | one-parent split ancestry and a continuing table derived across both phases |
| 106 | tournament Bonus rederivation remained correction-safe after completion |

None of these changes presentation authority into scoring or lifecycle authority.
**Appendix D.2's reconciliation list predates them** and must be checked against
the live status before being treated as outstanding work."""
text = replace_once(text, old_baseline, new_baseline, "design baseline delta")
path.write_text(text, encoding="utf-8")


# Architecture index: distinguish dated compatibility inventory from live trigger inventory.
path = ROOT / "docs" / "architecture" / "README.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "| [`stage-c-trigger-bindings.md`](stage-c-trigger-bindings.md) | Exact pre-migration inventory of every effective non-internal trigger binding on a `public` table |",
    "| [`stage-c-trigger-bindings.md`](stage-c-trigger-bindings.md) | Current effective inventory of every non-internal trigger binding on a `public` table, kept in lockstep with the executable parser/coverage guard |",
    "trigger inventory role",
)
text = replace_once(
    text,
    "Neither planning document overrides an ADR. Decisions are governed by [`../adr/README.md`](../adr/README.md), especially ADRs 0011–0019.",
    "Neither planning document overrides an ADR. Decisions are governed by the current index at [`../adr/README.md`](../adr/README.md), including later amendments to the original Stage A set.",
    "architecture ADR scope",
)
path.write_text(text, encoding="utf-8")


# Provider-custody contract: remove obsolete rollout instruction.
path = ROOT / "docs" / "architecture" / "provider-ingestion-contract-97.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "After merge, apply the pending additive migrations to Development through `.github/workflows/development-fast-lane-rollout.yml`, verify the ledger at 94, then align non-production declarations. Production remains at contract 63 and has no fast lane.",
    "Contract 97 is merged and its custody boundary has been carried through the later repository and development contract sequence. Moving hosted levels and Netlify declarations belong in the machine records and live operations status, not this contract note. The remaining product step is one bounded non-production provider rehearsal proving the archived raw response, strict decode and processing evidence while writing no official competition truth. This document authorises no credential change, provider request, hosted rollout or production mutation.",
    "provider rollout follow-up",
)
path.write_text(text, encoding="utf-8")


# Competition structure: reflect delivered backend without claiming surfaces.
path = ROOT / "docs" / "competition-structure.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "The Euro baseline already implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. Season Match Predictor, season LMS, season Championship and Hub persistence/surfaces land through the roadmap sequence.",
    "The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances and split persistence. Their remaining lifecycle/phase drivers, bounded browser reads and product surfaces still land through the roadmap sequence; backend presence is not a completed user journey.",
    "competition implementation relationship",
)
path.write_text(text, encoding="utf-8")


# Dated engineering plan: add an overlay rather than rewriting historical findings.
path = ROOT / "docs" / "architecture" / "multi-competition-hub-build-plan.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "**Decision authority:** [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0018-pre-launch-promotion-cadence.md`](../adr/0018-pre-launch-promotion-cadence.md).",
    "**Decision authority:** the current index at [`../adr/README.md`](../adr/README.md); later ADRs amend the original 0011–0018 planning set.",
    "build-plan decision authority",
)
anchor = "This document owns the Stage A–L engineering sequence. Discovery, research, product design, instrumentation, go-to-market, operations and legal work are governed by the parent programme. Competition rules and strategic decisions are referenced rather than repeated here; the ADRs win wherever this plan or an older document differs."
overlay = anchor + """

> **Progress overlay — 5 August 2026.** The detailed findings below remain a dated 30 July planning record. Phrases such as “current `main`” inside §1 refer to that verification snapshot, not the repository now. Since then the shared context migration, Stage C/C1b, provider custody and the season Match Predictor/LMS/Championship backend foundations have landed. The remaining execution order is maintained only in [`../roadmap.md`](../roadmap.md), and exact implementation/hosted truth only in [`../quality/current-status.md`](../quality/current-status.md). Do not update historical rows piecemeal to mimic a live status page."""
text = replace_once(text, anchor, overlay, "build-plan progress overlay")
path.write_text(text, encoding="utf-8")


# Source guards for the intended reconciliation.
checks = {
    ROOT / "docs" / "quality" / "deferred-decisions.md": [
        "DEC-014 | Persistence shape for the season Cup's split stage | **DECIDED AND IMPLEMENTED.**",
        "| **Decided and implemented** | 2026-08-05 |",
    ],
    ROOT / "docs" / "design" / "README.md": [
        "| 106 | tournament Bonus rederivation remained correction-safe after completion |",
        "That count is a document-input fact, not a live repository gauge.",
    ],
    ROOT / "docs" / "architecture" / "README.md": [
        "Current effective inventory of every non-internal trigger binding",
    ],
    ROOT / "docs" / "architecture" / "provider-ingestion-contract-97.md": [
        "one bounded non-production provider rehearsal",
    ],
    ROOT / "docs" / "competition-structure.md": [
        "backend presence is not a completed user journey",
    ],
    ROOT / "docs" / "architecture" / "multi-competition-hub-build-plan.md": [
        "Progress overlay — 5 August 2026",
    ],
}
for file_path, needles in checks.items():
    source = file_path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in source:
            raise RuntimeError(f"{file_path}: missing guard text {needle!r}")

for stale in (
    "`main` is at **103 migrations / 78 pgTAP suites**",
    "verify the ledger at 94",
    "Exact pre-migration inventory of every effective non-internal trigger binding",
    "| Deferred | 2026-08-04 |",
):
    if any(stale in p.read_text(encoding="utf-8") for p in checks):
        raise RuntimeError(f"stale authority wording survived: {stale}")

print("Reconciled six authority/index documents")
