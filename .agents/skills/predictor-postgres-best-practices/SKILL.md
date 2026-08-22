---
name: predictor-postgres-best-practices
description: Use for PostgreSQL or Supabase schema, query, index, RLS, locking, connection, or migration design where database-specific implementation guidance is needed.
---

# Predictor Postgres best-practices adapter

Use this as a **domain skill** only for database work. Repository migration/contract authorities remain binding.

1. Read `NOW.md`, the routed database/ADR authority and current migration inventory first. Check open PRs before claiming a migration number.
2. Materialize the immutable upstream skill with `npm run agent:skill -- supabase-postgres-best-practices`, read the printed `SKILL.md`, then open only the reference files relevant to the concrete query/schema/RLS problem.
3. Upstream best practices may improve implementation, indexes, query shape, locking or policy design; they do not authorise a new contract, production mutation, destructive migration or hosted-state claim.
4. Preserve additive/fail-closed migration rules, RLS/permission boundaries and repository-generated database types. Do not infer Production from repository or Development state.
5. For query/performance work, prefer `EXPLAIN`/existing disposable test evidence where available rather than speculative indexes or rewrites.
6. For RLS/RPC/security-sensitive changes, route the resulting diff through the conditional differential-review adapter as well.
7. Run the exact migration/database tests and contract checks required by the repository before completion.

The task packet defines the initial source/migration working set; do not scan every migration by default.
