from __future__ import annotations

from pathlib import Path

path = Path(__file__).resolve().parents[1] / "docs" / "quality" / "feature-baseline.md"
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    "**Latest full audit reconciliation:** [`audits/2026-07-29-contract-60-full-documentation-audit.md`](audits/2026-07-29-contract-60-full-documentation-audit.md)  \n**Latest production release alignment:** [`investigations/2026-07-29-contract60-production-promotion.md`](investigations/2026-07-29-contract60-production-promotion.md)  \n**Current hosted state:** [`current-status.md`](current-status.md)  ",
    "**Baseline reconciliation date:** 5 August 2026  \n**Historical contract-60 audit:** [`audits/2026-07-29-contract-60-full-documentation-audit.md`](audits/2026-07-29-contract-60-full-documentation-audit.md)  \n**Historical contract-60 production release:** [`investigations/2026-07-29-contract60-production-promotion.md`](investigations/2026-07-29-contract60-production-promotion.md)  \n**Current implementation and hosted state:** [`current-status.md`](current-status.md)  ",
    "feature baseline header",
)

old_classification = """## Classification rules

- **Implemented and production-hosted:** working capability supported by the current contract-60 production application/database pair.
- **Implemented and development-hosted; production pending:** working development capability not yet promoted.
- **Implemented with evidence gap:** hosted capability exists but a required browser, accessibility or operational journey remains incomplete.
- **Partial:** meaningful implementation exists but a required layer, route or journey is absent.
- **UI prototype only:** presentation exists without an authoritative data path.
- **Documented/planned:** intent exists without working implementation.
- **Not present:** no current implementation evidence.

Repository, development Supabase, production Supabase and every Netlify context are aligned at contract 60. The production application is published from the exact contract-60 release-alignment merge. See `current-status.md` for the live deploy and data position.
"""
new_classification = """## Classification rules

- **Implemented and production-hosted:** working capability verified in the published Euro production baseline. This classification is about the capability, not a claim that production has every later platform contract.
- **Implemented and development-hosted; production pending:** working capability present in the repository/development path but not promoted to production.
- **Implemented in repository; hosted state delegated:** working code exists, while the exact environment publication state is intentionally read from `current-status.md` rather than copied here.
- **Implemented with evidence gap:** hosted capability exists but a required browser, accessibility or operational journey remains incomplete.
- **Partial:** meaningful implementation exists but a required layer, route or journey is absent.
- **UI prototype only:** presentation exists without an authoritative data path.
- **Documented/planned:** intent exists without working implementation.
- **Not present:** no current implementation evidence.

Repository, development, production and Netlify contract values move independently. This baseline does not restate them. [`current-status.md`](current-status.md) and the machine contract records decide exact hosted state; the fixed `euro-2028-baseline` tag remains the recoverable contract-63 tournament anchor.

## Platform backend overlay — not yet compact user features

The stable compact rows below preserve the established feature/safeguard identifiers. Since that identifier set was created, the repository has also delivered substantial platform backend foundations that are not yet complete user-facing features and therefore do not receive speculative `FEAT-*` IDs here:

- competition-season identity, per-game availability/membership and game-owned lock policies;
- season Match Predictor fixtures, cards, Jokers, lock processing, recurring scheduling, replay-safe reassignment, scoring, stored matchweek totals and bounded standings;
- season Last Man Standing setup, eligibility, deterministic auto-assignment, used-team cycles, selection writes, correction-aware settlement and entrant-state replay;
- competition-neutral Predictor Championship/Cup points and settlement sources, circle-method scheduling rules, persisted split phases, one-parent ancestry and derived continuing standings;
- server-only provider-response custody with archive-before-processing evidence and no authority to write official competition truth;
- repeatable competition instances, explicit live/current resolution and correction-safe rederivation after completion.

The missing lifecycle/phase drivers, bounded browser reads and season product surfaces remain partial/planned work in the roadmap. Backend presence must not be reclassified as a completed user journey. When a surface becomes a real supported capability, add one reviewed primary identifier and update the executable identifier-count guard in the same change.
"""
replace_once(old_classification, new_classification, "classification and platform overlay")

replacements = {
    "| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and production-hosted | Auth routes/Supabase; final SMTP/Turnstile decisions remain |":
        "| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and production-hosted | Auth routes/Supabase; Turnstile and recovery delivery are implemented, while ownership/incident readiness remains operational |",
    "| `SAFE-010` | Serialized score recomputation | Implemented and production-hosted | Result/scoring operations serialized |":
        "| `SAFE-010` | Serialized score recomputation | Implemented with environment split | Production baseline serializes Original scoring; later repository/development contracts extend the same transaction lock to Bonus rederivation |",
    "| `SAFE-013` | Production/development isolation | Implemented and hosted | Production and non-production retain separate Supabase projects |":
        "| `SAFE-013` | Production/development isolation | Implemented and hosted | Separate Supabase targets are enforced; Netlify context values were independently read on 5 August 2026 and moving declarations remain in current status |",
    "| `SAFE-054` | Application/schema compatibility gate | Implemented and actively enforcing | Every Netlify context declares contract 60 |":
        "| `SAFE-054` | Application/schema compatibility gate | Implemented and actively enforcing | Each context is checked against its own declared database contract; exact values are target-specific and live in operations/current status |",
    "| `FEAT-036` | Other-player full profile | Implemented and production-hosted | Co-member-only pre/post-lock reveal boundary |":
        "| `FEAT-036` | Other-player full profile | Implemented and production-hosted | Pre-lock ownership remains private; frozen Euro entry/profile reveal is authenticated post-lock, while league-context pick reads remain league-scoped |",
    "| `FEAT-050` | Post-lock trends | Documented/planned | Current Stage 6 product batch |":
        "| `FEAT-050` | Post-lock trends | Implemented in repository; hosted state delegated | Consensus/trends route exists with suppression, loading/error states and player-name fallback; exact publication follows current status |",
    "| `SAFE-026` | Disposable database integration CI | Implemented | Full 60-migration rebuild, lint, pgTAP and differential parity |":
        "| `SAFE-026` | Disposable database integration CI | Implemented | Zero-to-current migration rebuild, database lint, complete pgTAP chain, transition rehearsals and differential parity |",
    "| `SAFE-029` | Contract-gated production deploy | Implemented | Exact contract-60 release published and production re-locked |":
        "| `SAFE-029` | Contract-gated production deploy | Implemented | Production fails closed on contract mismatch; exact published release identity and target contract remain in current status/release evidence |",
}
for old, new in replacements.items():
    replace_once(old, new, old.split('|')[1].strip())

old_route = """## Current route and data baseline

Current `main` has authenticated Original Predictor, league, H2H, match, profile, Account, Bonus Games and protected administrator routes plus catch-all. Development-only routes remain gated. Repository and both hosted databases have exactly 60 canonical migrations; every Netlify context declares contract 60.

The Bonus Games runtime routes are `/games`, `/games/knockout`, `/games/ko-predictor`, `/games/lms` and `/games/cup`. Hosted catalogue publication is separate operational reference data and must not create synthetic entrants or result history.
"""
new_route = """## Current route and data baseline

The application contains authenticated Original Predictor, league, H2H, match, profile, Account, Trends, Bonus Games and protected administrator routes plus a real catch-all. Development-only routes remain gated. This document is not the exhaustive route manifest and does not copy migration or Netlify contract counts; executable route coverage and [`current-status.md`](current-status.md) decide those facts.

The historical Bonus Games compatibility routes remain available while the accepted Hub information architecture is adopted. Hosted catalogue publication is operational reference data, not schema authority, and must never create synthetic entrants, predictions, draws, scores or result history. The season backend overlay above has no complete public product surface yet.
"""
replace_once(old_route, new_route, "route and data baseline")

replace_once(
    "- mix Original/bonus points or predicted/real brackets;",
    "- mix Original/bonus points, one game's standings with another's, or predicted/real brackets;\n- treat a backend authority as a completed or production-hosted surface without journey evidence;\n- let a provider response become official fixture/result/scoring truth;\n- copy Championship carried points into a second stored starting total;\n- resolve correction-time rederivation through a live-only competition lookup after completion;",
    "safeguard regression extensions",
)

# Permanent guards: identifier structure stays unchanged while stale moving claims disappear.
for stale in (
    "current contract-60 production application/database pair",
    "every Netlify context declares contract 60",
    "exactly 60 canonical migrations",
    "Full 60-migration rebuild",
    "Current Stage 6 product batch",
    "final SMTP/Turnstile decisions remain",
):
    if stale in text:
        raise RuntimeError(f"stale feature-baseline claim survived: {stale}")

for required in (
    "## Platform backend overlay — not yet compact user features",
    "Implemented in repository; hosted state delegated",
    "Zero-to-current migration rebuild",
    "Backend presence must not be reclassified as a completed user journey",
    "the fixed `euro-2028-baseline` tag remains the recoverable contract-63 tournament anchor",
):
    if required not in text:
        raise RuntimeError(f"missing feature-baseline guard: {required}")

# The compact row count and primary IDs are intentionally preserved for the existing test.
compact = text.split("## Identifier continuity and archived dispositions", 1)[0]
rows = [
    line for line in compact.splitlines()
    if line.startswith("| ") and not line.startswith("| ID |") and not line.startswith("| --- |")
]
if len(rows) != 61:
    raise RuntimeError(f"compact feature row count changed: {len(rows)}")

path.write_text(text, encoding="utf-8")
print("Reconciled feature baseline without changing identifier count")
