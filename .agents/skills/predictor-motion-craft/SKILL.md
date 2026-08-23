---
name: predictor-motion-craft
description: "Use only for explicit Predictor motion work: animation, transitions, easing, springs, microinteractions, entrance/exit motion, interaction feedback, gestures, route/page transitions, animation polish or reduced-motion behaviour."
---

# Predictor motion craft adapter

This is a **narrow specialist**, not a general frontend-design skill.

1. Use it only when routing identifies a real motion/interaction concern. Do not load it for ordinary layout fixes, data tables, generic UI defects, copy changes or general frontend work.
2. Repository product/UI authorities and current source win. Existing interaction semantics, navigation, visual contracts and accessibility requirements must not be redefined by upstream examples.
3. Materialize the immutable source with `npm run agent:skill -- motion-craft` and use Emil Kowalski's `animate` skill as craft guidance.
4. Existing dependencies and existing Framer Motion/Motion/CSS conventions win unless source evidence justifies changing them. Prefer the cheapest existing mechanism that does the job; never add a dependency solely because an upstream example uses it.
5. First decide whether motion should exist and name its purpose: hierarchy, feedback, spatial/state continuity, preventing a jarring state change, or rare deliberate delight. Decorative churn is a defect, especially around dense football data and high-frequency actions.
6. Preserve readable/actionable data while it changes. Frequent controls should feel immediate; animation must not make predictions, fixture switching, tables or navigation slower to use.
7. Reduced-motion behaviour is part of the implementation wherever motion is non-trivial. Pointer/hover behaviour must also respect the actual input mode when relevant.
8. Reuse current easing/duration/spring tokens and patterns before inventing new ones. Prefer transform/opacity and interruptible interaction patterns where appropriate; verify animation under real state changes rather than only the happy path.
9. Finish through `predictor-ui-review`: exercise the interaction, keyboard/pointer behaviour, reduced motion, responsive sizes and relevant visual/performance evidence.

Do not let this specialist establish design-system truth, product rules, dependencies, navigation behaviour or brand direction. It refines motion inside the already-authorised Predictor experience.
