# PRE_LIVE_OWNER first increment

## Problem and outcome

The private mobile Conductor is persistent, but routine owner-authorised repository
work still stops on OpenCode permission prompts. Establish an explicit owner-operation
policy in which normal task-branch engineering and its specialist evidence are
zero-prompt while secrets, destructive history operations, and Production mutation
remain mechanically unavailable.

## Scope

In scope:

- effective, last-match-wins permissions for all five tracked OpenCode agents;
- safe task-branch push and pull-request wrappers;
- executable effective-config and wrapper tests using the pinned OpenCode client;
- local doctor evidence for persistent private mobile operation;
- owner-mode and mobile runbook guidance.

Out of scope:

- merging pull requests without an owner action;
- changing the GitHub ruleset or aggregating specialist gates in this increment;
- networking redesign, deployment, provider calls, or application changes;
- any Supabase/Netlify Production mutation or real-player-data operation.

## Authorities

- `AGENTS.md` and `NOW.md`
- `docs/ops/developer-toolchain.md`
- `docs/ops/persistent-cloud-conductor.md`
- `opencode.json` and `.opencode/agents/*.md`
- `.github/workflows/ci.yml` and live GitHub ruleset `20508177`

The live ruleset currently requires only `CI / Required merge gate`, protects deletion
and non-fast-forward updates, and has no bypass actors. It does not prove that every
applicable Visual QA, Release Verifier, or Ox result reaches the required aggregate.

## Acceptance scenarios

1. The pinned OpenCode resolver shows routine reading, routing, task worktree/branch
   work, edits, formatting, tests, builds, browser evidence, commits, safe task-branch
   push/PR wrappers, CI reads, and role-appropriate delegation as `allow`, not `ask`.
2. The resolved policy denies unknown shell commands, direct push, force/history
   rewrite, secret reads, and Production mutation/destruction.
3. Safe wrappers reject `main`, detached HEAD, force/history-danger options, and a
   mismatched upstream before invoking fakeable `git`/`gh` commands.
4. Builder alone retains task-authorised Supabase Development MCP capability;
   Release Verifier alone retains server-side read-only Production evidence surfaces.
5. The local doctor checks the enabled/restarting service, linger, localhost-only bind,
   Basic auth, private Serve route, Funnel disabled, default Conductor, and resumable
   sessions without reading or printing credential values or making provider calls.
6. The runbook gives a short iPhone setup and states that push/PR are no longer owner
   approval boundaries, while merge remains one until applicable specialist evidence
   is mechanically aggregated into the required GitHub decision.

## Security and environment constraints

Permissions are ordered broad-first and narrow-last because OpenCode 1.18.19 uses the
last matching rule. Unknown external paths and unknown shell operations fail closed.
No credential value, auth store, `.env`, Production service, paid provider, or real
player data is read or mutated. The only hosted mutation capability is Builder's
existing task-authorised Supabase Development MCP surface.

## Completion predicate

The effective-config and wrapper tests pass against this worktree, OpenCode resolves
the schema and all tracked agents, focused tooling/documentation checks pass, and the
intended diff is committed on `feat/pre-live-owner-mode`. Merge remains bounded until
the next phase mechanically aggregates every applicable specialist gate into the
required GitHub merge decision.
