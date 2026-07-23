# Post-`FUNC-001` documentation reconciliation

**Scope:** living implementation-status documents after merged PRs #9–#12  
**Evidence boundary:** current repository and completed CI/database-parity records  
**No application, migration, workflow or hosted-environment change**

## Why this reconciliation was needed

After PR #12 merged, several living documents still described already-completed work as open or pending. In particular:

- the README still listed the entry boundary, group-position persistence, result model and bracket integrity as unimplemented;
- `docs/quality/current-status.md` still described PR #12 as pending merge;
- long-form roadmap, build-todo and agent-history sections still contained dated implementation narratives from before PRs #9–#12.

The dated audits and historical risk register are intentionally unchanged. They remain valid evidence of what was found at the time.

## Authority hierarchy

For implementation status, use sources in this order:

1. current `main` code, migrations and executable tests;
2. `docs/quality/current-status.md`;
3. the dated post-audit reconciliation note for the relevant workstream;
4. formal dated audits and the risk register for historical evidence;
5. roadmap/build-todo/agent-history narratives for product intent and historical sequencing only.

A planning document must not be used to classify a feature as implemented when current code, migrations and tests do not support that classification. Conversely, an older unchecked item must not override later merged and executable evidence.

## Documents updated in this batch

- `README.md`
  - records entry, result and bracket integrity as implemented locally;
  - states the hosted evidence boundary;
  - identifies `REL-004` as the next repository batch;
  - points agents to `current-status.md` for live implementation state.

- `docs/quality/current-status.md`
  - records PR #12 as merged at `0112bfa6283c089048534c5e75678dbeefd14b4e`;
  - reconciles PRs #9–#12 as executable local evidence;
  - removes the stale “after PR #12 is merged” wording;
  - identifies atomic whole-bracket persistence as the next repository action;
  - distinguishes historical planning documents from live status.

- `docs/quality/reconciliations/2026-07-23-knockout-bracket-tree-integrity.md`
  - adds the verified PR #12 head, merge SHA and final gate record;
  - changes pending language to merged language;
  - preserves the hosted and non-goal boundaries.

## Long-form planning documents

`docs/roadmap.md`, `docs/build-todo.md` and historical sections of `CLAUDE.md` contain substantial product decisions and implementation history. They were not rewritten wholesale in this batch because doing so would risk deleting still-valid future-scope decisions.

Until those documents receive a structured line-by-line cleanup:

- use them for product intent, sequence and historical context;
- verify every current implementation claim against `docs/quality/current-status.md` and the repository;
- treat references to the old `submit_entry()` shape, direct result updates, stage-count-only bracket validation or PR #12 being pending as superseded;
- do not treat “migration applied” statements from 20–21 July as proof that migrations added through PRs #7, #9, #11 or #12 are deployed to either hosted project.

## Current next action

The next repository implementation batch is `REL-004`: replace a user's complete predicted progression set through one owner-checked, pre-lock server transaction. The transaction must validate the complete supplied tree before committing and must preserve the previous valid bracket if any supplied row or tree relationship is invalid.

Automatic real R16 population from confirmed group standings and the authoritative best-third ranking remains the following linked batch.

## Hosted boundary

No hosted Supabase project, Netlify setting or production data was queried or changed during this documentation reconciliation.
