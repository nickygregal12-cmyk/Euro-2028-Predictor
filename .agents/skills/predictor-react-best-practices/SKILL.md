---
name: predictor-react-best-practices
description: Use for React performance, rerender, bundle, async-waterfall, rendering, or client data-flow work where implementation quality benefits from current Vercel React guidance.
---

# Predictor React best-practices adapter

Use this as a **domain skill** only after `agent:route` identifies the source/test working set.

1. Materialize the immutable upstream skill with `npm run agent:skill -- react-best-practices`, read the printed `SKILL.md`, then open only the individual upstream `rules/*.md` relevant to the measured problem.
2. This repository is React + Vite, not Next.js. Ignore Next.js App Router, RSC, Server Actions, `next/dynamic`, Next-specific caching/serialization and similar rules unless the source being changed genuinely uses that mechanism.
3. Prefer the repository's existing React Router, TanStack Query, Supabase/integration boundaries, Framer Motion and build tooling over upstream examples that introduce an alternative library.
4. Measure before broad optimization. React Scan, browser traces, Lighthouse, bundle budgets or existing tests should identify the actual cost when the task is performance-driven.
5. Preserve product semantics and vNext presentation/integration boundaries. A performance refactor must not silently change locking, reveal, scoring, permissions, navigation or data freshness.
6. Verify the smallest relevant build/test/browser/performance evidence after the change.

Do not read the upstream compiled `AGENTS.md`; its expanded 70-rule copy defeats progressive disclosure. Load only the entrypoint and selected rule files.
