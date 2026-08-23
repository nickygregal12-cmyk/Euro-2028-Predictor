---
name: predictor-product-brainstorming
description: Use when a requested capability or architecture change still has genuine product/technical choices to resolve before implementation. Do not use for known defects, routine polish, or tasks whose governing authority already makes the approach clear.
---

# Predictor product brainstorming adapter

Use this as the **process skill for unresolved choices**, after `agent:route` has identified the smallest relevant authority and source surface.

1. Read the routed repository authority first. Product rules, ADRs, accepted requirements, current source/tests and explicit user intent outrank upstream brainstorming advice.
2. Materialize the immutable upstream skill with `npm run agent:skill -- brainstorming`, then read only its `SKILL.md` entrypoint. Follow extra references only when the decision genuinely needs them.
3. Use the upstream strengths: clarify the player/job-to-be-done, expose hidden assumptions, compare 2–3 materially different approaches, state trade-offs, recommend one, and apply YAGNI.
4. **Do not import the upstream approval ceremony wholesale.** An explicit user instruction to implement a bounded change is already authorization to work. Do not stop for another approval when repository authority makes the intended behaviour clear. Pause only when choosing an option would invent or alter product behaviour that no authority/user instruction resolves.
5. Do not create `docs/superpowers/`, a parallel spec hierarchy, or another product/design authority. If a durable decision needs recording, use the repository's existing ADR/product/spec locations selected by routing.
6. Keep exploration bounded. Once a decision is sufficiently supported, hand implementation to the normal routed delivery/debugging/design workflow rather than keeping brainstorming loaded.

This skill is not a license to scan the repository. Graphify/Serena/source/tests still define the working set.