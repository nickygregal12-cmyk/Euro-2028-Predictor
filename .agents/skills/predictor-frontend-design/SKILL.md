---
name: predictor-frontend-design
description: Use when building or materially reshaping Predictor UI and the task needs deliberate visual direction, hierarchy, typography, layout, or signature interaction choices rather than routine bug fixing.
---

# Predictor frontend design adapter

Use this as a **domain skill**, after the task router has already identified the relevant product authority and source surface.

1. Repository authorities win. Read the exact `docs/product/*` authority selected by `agent:route`; for vNext, `docs/product/ui.md` and the routed surface authority constrain the design.
2. Materialize the immutable upstream design skill with `npm run agent:skill -- frontend-design`, then read only the printed `SKILL.md` entrypoint. Follow references only when the task needs them.
3. Treat upstream design advice as craft guidance, never as permission to invent scoring, permissions, football data, navigation, product copy, dependencies, fonts, brand tokens, or runtime behaviour that conflict with this repository.
4. Reuse the existing vNext foundations and dependencies unless the task explicitly authorises a broader design-system change.
5. Build with real domain content/states. Do not substitute decorative mock data for unavailable product truth.
6. After implementation, use `predictor-ui-review` for browser/responsive/accessibility evidence when the task packet selects it.

The skill does not grant permission to scan the repository. Work from the Graphify/Serena/source shortlist in the task packet.
