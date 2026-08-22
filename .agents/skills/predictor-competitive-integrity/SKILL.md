---
name: predictor-competitive-integrity
description: Use when a change touches scoring, points, rank, locks, reveal, membership, official results, settlement, progression, prediction visibility, or another rule that can change competitive truth between players.
---

# Predictor competitive integrity guardian

Use this as the **repository review lens for competitive truth**. It is more specific than a generic diff review and outranks external preferences when the game rules are involved.

## Trace the authority

1. Find the governing ADR/product rule and executable server/tests. Never infer a rule from UI copy or an old summary.
2. Trace the value from authoritative write/read through service/read-model to the client. Flag any duplicate client implementation of scoring, locks, reveal, settlement, progression, membership or official-result logic.
3. Separate official competitive truth from provider-live/provisional/enrichment data. A live provider score may inform presentation; it cannot become settled scoring by convenience.
4. Test adversarial identities and timing where relevant: owner/member/non-member, player A/player B/anonymous/admin, just-before/at/after lock, hidden/revealed, no-op/retry/idempotency, and stale/failed rereads.
5. Check that optimistic UI cannot expose a state the server would refuse or reveal another player's protected prediction early.
6. Check rank/points displays derive from the same accepted scoring authority rather than a presentation-only approximation unless they are explicitly labelled projections.

## Review outcome

Report concrete invariant violations with source/test evidence. If the change is safe, state which invariants were checked rather than saying only `looks good`.

Do not invent a fairer rule, rebalance scoring, relax privacy, or change game semantics as part of review. Any product-rule change requires its normal authority.