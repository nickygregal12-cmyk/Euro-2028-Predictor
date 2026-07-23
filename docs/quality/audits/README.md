[README.md](https://github.com/user-attachments/files/30300903/README.md)
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

- Historical reports must not be overwritten.
- A corrected report should use a clearly versioned filename or a dated addendum that links to the original.
- Active verified findings belong in [`../risk-register.md`](../risk-register.md).
- Active implementation work belongs in GitHub Issues.
- The latest concise quality summary belongs in [`../current-status.md`](../current-status.md).
- Reports must record the audited repository, branch and exact commit SHA.
- Reports must record the deployed version or deploy identifier when deployment is in scope.
- Reports must list the systems and environments inspected.
- Reports must list inaccessible or unverified systems and avoid positive assumptions about them.
- Reports should link to the feature baseline and identify regressions against it.
- Reports should distinguish current implemented scope from planned, deferred, prototype, legacy or absent features.

## Sensitive information

Audit reports must not contain:

- credentials, passwords or access tokens;
- service-role, database, Netlify, GitHub, SMTP or private API secrets;
- refresh tokens or user passwords;
- personal user data;
- full database exports;
- production logs containing personal information;
- sensitive exploit payloads that create unnecessary risk.

Refer to secrets by type and controlled location only. Redact sensitive evidence before adding it to the repository.

## Historical reports are not live task lists

A report preserves what was observed at one commit and point in time. It must not become a parallel backlog. After an audit:

1. add verified findings to the risk register;
2. create GitHub Issues for approved actionable work;
3. update the current status summary; and
4. retain the report unchanged as historical evidence.
