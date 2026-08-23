---
name: predictor-product-opportunity-scout
description: Use for broad outcome prompts such as improve this page, make this better, or take this to the next level when the user wants the agent to find the highest-value missing player-facing improvement rather than perform a named technique.
---

# Predictor product opportunity scout

Use this as the **process skill for outcome-first improvement work**. It exists to stop a broad prompt such as `Improve Match Centre UI` collapsing into cosmetic tweaks when the bigger player-facing opportunity is elsewhere.

## Bounded discovery

1. Start from the routed surface, current source/tests and its one canonical product authority. Check open PRs for overlapping capability before proposing work.
2. State the player's job on this surface in one sentence. For Predictor Hub, prefer concrete jobs such as predict, understand football context, see what matters next, compare with rivals, understand competitive consequence, or recover from a failed/empty state.
3. Inspect the implementation before suggesting capability. Do not assume a missing feature because an external product has it.
4. Search `docs/quality/accepted-requirements.md` only for terms relevant to this surface. Inspect `docs/product/innovation-lab.md` only when a genuinely new capability is being considered. Candidate innovation is not approved scope.
5. Produce at most three materially different opportunities and rank them by player value, frequency, differentiation, existing-data readiness, implementation cost/risk, and overlap with work already in progress.
6. Prefer an underused authoritative read/model or an incomplete journey over inventing a second backend truth.
7. If the user asked to implement an improvement, choose the highest-value bounded option that is already authorised and hand it to the normal routed delivery/design/debugging workflow. Do not keep this skill loaded through implementation unless the decision remains unresolved.

## Reject fake improvement

Do not manufacture work. If the current surface is already strong, say so and move to the next evidence-backed opportunity or report that no bounded improvement earned its complexity.

Do not turn a broad improvement prompt into a redesign by default. A spacing, performance, motion, bug, state-completeness, environment or competitive-integrity task belongs to its more specific route.

Repository product rules, scoring, locks, reveal, membership, settlement, progression, provider truth and hosted state are never invented here.