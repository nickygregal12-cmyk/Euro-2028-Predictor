---
name: predictor-frontend-design
description: Use when building or materially reshaping Predictor UI and the task needs deliberate visual direction, hierarchy, typography, layout, responsive composition or interaction craft rather than routine bug fixing.
---

# Predictor frontend design adapter

Use this as the **general UI design domain skill** after routing has identified the product authority and source surface.

1. **Repository authority wins.** Read only the product/UI authority selected by `agent:route`, plus the affected source/test surface. Existing navigation, product rules, brand decisions, dependencies and runtime behaviour are constraints, not suggestions.
2. Materialize the immutable external craft source with `npm run agent:skill -- frontend-design`. Read its `SKILL.md`, then only a narrowly relevant reference when the task genuinely needs it.
3. **Suppress upstream authority creation.** Do not run Impeccable `context.mjs`, `init`, `document`, `doctor`, hooks or pinning workflows. Do not create, replace or establish `PRODUCT.md`, `DESIGN.md`, surface briefs, a parallel design-system truth, navigation rules, product rules, brand rules, dependencies or runtime behaviour. The repository already owns those decisions.
4. Use upstream guidance only for craft: hierarchy, typography, spacing, colour/contrast, responsive composition, interaction design, state completeness, UX writing, anti-pattern detection, critique, polish and hardening.
5. Before visual choices, infer the **player job and audience context** from routed authority and real content. Decide an intentional visual direction rather than accepting generic SaaS defaults; explicitly consider visual character, information density and motion intensity.
6. Design desktop and mobile for their actual jobs. Wide screens should earn their density; phone layouts should preserve direct, thumb-friendly prediction/game actions rather than merely stacking desktop cards.
7. Check interaction feedback and whether motion is warranted. If animation, easing, springs, gestures, entrance/exit motion, route transitions or reduced-motion behaviour are a real implementation concern, allow the router to add `predictor-motion-craft`; do not duplicate its specialist guidance here.
8. Design the states the player can actually encounter: loading, empty, error, locked, live, stale and partial data, plus permission/offline/retry states when the routed product surface supports them.
9. Run an anti-generic-AI pass: avoid gratuitous gradients, glass, card grids, decorative churn and templated SaaS composition. Do not swap fonts, icon sets, frameworks or dependencies merely because an external example prefers them. Useful Taste/UI UX catalogue ideas may inform deliberate exploration, never silently become project defaults.
10. Keep football usefulness visible: hierarchy, density and visual emphasis should help the player predict, compare, understand live/fixture context or navigate their competitions rather than decorate data.
11. After implementation, use `predictor-ui-review` as the Predictor-specific acceptance layer for Storybook/Playwright/accessibility/responsive/visual-contract/performance evidence at the level the change justifies.

This adapter does not grant permission to scan the repository. Work from the routed/Graphify/source shortlist and keep external reference loading proportional to the task.
