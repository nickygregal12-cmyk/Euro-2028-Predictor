---
name: predictor-environment-contract-guardian
description: Use for repository, Supabase, Netlify, migration, rollout, hosted-contract, environment-variable, site-variant, or promotion work where confusing Development, Production, repository state, or contract numbering could cause a real operational mistake.
---

# Predictor environment and contract guardian

Use this as the **process skill for environment-sensitive work**.

## Establish identity before mutation

Create a compact working identity card from current machine evidence:

- target environment/site;
- repository contract;
- target hosted contract and evidence timestamp/source;
- Production contract separately;
- whether Production mutation/promotion is explicitly authorised;
- site variant/origin when relevant;
- whether provider/paid API consumption is authorised;
- next free migration/contract number after checking open PR collisions.

Repository state is never hosted proof. Development state is never Production state. One Netlify site is never evidence about the other.

## Mutation discipline

1. Read `NOW.md`, the exact machine record/runbook and relevant open PRs before claiming a number or target.
2. For a migration, check timestamp/contract-number collisions before writing it and preserve the repository's normal Postgres/RLS/review path.
3. Fail closed when target identity is ambiguous. Never copy a known value from one environment into another merely because they are expected to match.
4. Do not consume paid provider APIs, deploy, promote, or mutate Production unless the task explicitly authorises that exact target/action.
5. After a hosted action, verify the hosted result independently before updating a machine record. After a repository-only change, do not update hosted truth as if deployment happened.
6. Regenerate `NOW.md` only through its generator when its machine inputs legitimately changed; never hand-edit moving facts into routers/docs.

Finish by stating exactly which environments changed and which did not.