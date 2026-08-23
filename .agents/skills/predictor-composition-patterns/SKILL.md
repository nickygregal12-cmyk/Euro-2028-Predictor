---
name: predictor-composition-patterns
description: Use when a React component API is becoming brittle, prop-heavy, duplicated, or hard to extend and the task is specifically about reusable composition or component architecture.
---

# Predictor composition-patterns adapter

Use this as a **domain skill** for component API design, not as a reason to refactor unrelated UI.

1. Materialize the immutable upstream skill with `npm run agent:skill -- composition-patterns`, read its printed `SKILL.md`, and open only referenced examples/rules needed by the component under change.
2. Repository product authorities and the vNext presentation/integration boundary outrank generic composition advice.
3. Prefer explicit variants, composition and shared state/context when they simplify a real API. Do not manufacture abstraction merely to satisfy a pattern.
4. Preserve existing public component behaviour unless the task explicitly changes it. Avoid boolean-prop multiplication, duplicated responsive variants and hidden coupling between shell/page responsibilities.
5. React 19 patterns are allowed where they fit the repository; Next.js-specific assumptions are not.
6. Keep reusable presentation components network- and Supabase-unaware; application-facing acquisition/commands stay in `integration/` or the existing application service boundary.
7. Prove the resulting API through the smallest affected component/unit/browser stories and journeys.

The task packet's exact file shortlist remains the working boundary.
