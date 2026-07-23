# Feature and safeguard baseline

This file is the primary defence against silent feature loss. It records verified user-facing features and important security, data, accessibility, deployment and operational safeguards at a known repository state.

Do not populate or update a row from memory, previous predictor projects, similarly named game modes or future plans. Each status requires current evidence.

| ID | Feature or safeguard | Intended status | Current status | Source of truth | Implementation evidence | Validation evidence | Last verified | Regression notes |
| -- | -------------------- | --------------- | -------------- | --------------- | ----------------------- | ------------------- | ------------- | ---------------- |
| — | No baseline entries recorded yet | — | Pending first complete audit | — | — | — | — | Populate only from verified evidence |

## Recording guidance

- Do not add assumed features.
- Do not import features or rules from previous predictor projects.
- Planned features must not be recorded as implemented.
- Database scaffolding alone is not a completed feature.
- An unreachable component is not a completed user-facing feature.
- A visual prototype without working data and actions must be labelled as a prototype.
- Intentionally removed features must retain a record of the approved decision and last known implementation evidence.
- Critical security and data safeguards must remain listed after refactoring, even when their implementation path changes.
- Future audits must compare the current implementation against this baseline.
- Where intended and actual behaviour differ, record both without silently changing the requirement.
- Use stable IDs. A feature ID should survive a rename or refactor when the user-facing capability is materially the same.

## Recommended status vocabulary

Use specific statuses such as:

- Implemented
- Partially implemented
- UI prototype only
- Database structure only
- Documented but not implemented
- Planned
- Legacy or obsolete
- Intentionally removed
- Not present
- Unclear
- Regressed

## Evidence standard

A baseline row should normally identify:

1. the approved requirement or control document;
2. current routes, files, functions, migrations, policies or configuration supporting the capability;
3. automated test evidence and any required manual validation;
4. the branch, commit SHA and date last verified; and
5. known limitations or conditions under which the feature is unavailable.

Do not treat the existence of a test, component, table, TODO or design mock-up as proof of a complete feature.
