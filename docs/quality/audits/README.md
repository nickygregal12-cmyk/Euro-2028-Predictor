# Historical audit reports

This directory stores immutable, dated audit evidence for the Euro 2028 Predictor.

## Filename format

Use:

```text
YYYY-MM-DD-<scope>.md
```

Examples:

- `2026-07-23-full-audit.md`
- `2026-08-15-authentication-review.md`
- `2027-01-20-pre-release-audit.md`

Use a concise lowercase scope separated by hyphens.

## Storage rules

- Historical reports must never be overwritten.
- A corrected report uses a new versioned filename or a dated addendum that links to the original.
- Every report records the audited repository, branch and exact commit SHA.
- Record the deployed version/deploy identifier when deployment is in scope.
- List every system and environment inspected.
- List inaccessible or unverified systems and avoid positive assumptions about them.
- Record commands run, commands not run and the reason.
- Compare against [`../feature-baseline.md`](../feature-baseline.md) and identify regressions or silent feature loss.
- Distinguish implemented, partially implemented, prototype, planned, deferred, legacy, obsolete and absent features.
- Active verified risks belong in [`../risk-register.md`](../risk-register.md).
- Active implementation work belongs in GitHub Issues.
- The latest concise position belongs in [`../current-status.md`](../current-status.md).
- Current feature/safeguard state belongs in [`../feature-baseline.md`](../feature-baseline.md).
- Deferred owner/architecture decisions belong in [`../deferred-decisions.md`](../deferred-decisions.md).

## Historical evidence is not a live task list

A dated report records what was observed at one commit and point in time. After an audit:

1. preserve the full report unchanged;
2. add verified findings to the risk register;
3. create authorised GitHub Issues for active work;
4. update the feature baseline and current status; and
5. use a later audit to confirm resolution or regression.

Do not copy detailed implementation task breakdowns into every report after Issues exist.

## Sensitive information

Reports must not contain:

- credentials, passwords, private keys or access tokens;
- service-role, database, Netlify, GitHub, SMTP or private API secrets;
- refresh tokens or user passwords;
- personal user data;
- full database exports;
- production logs containing personal information;
- authentication tokens; or
- sensitive exploit instructions that create unnecessary risk.

Refer to secrets by type and controlled location only. Redact sensitive evidence before adding it to the repository.
