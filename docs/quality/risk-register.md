# Quality risk register

This is the permanent history and current status of verified findings. It is not the implementation backlog and must not be populated with speculative or unverified concerns.

| ID | Title | Category | Severity | Confidence | First identified | Status | GitHub Issue | Resolution evidence | Last reviewed |
| -- | ----- | -------- | -------- | ---------- | ---------------- | ------ | ------------ | ------------------- | ------------- |
| — | No verified findings recorded during governance setup | — | — | — | — | — | — | — | — |

## Register rules

- Findings remain in the register after resolution.
- Resolved items must link to implementation evidence, validation evidence and the relevant commit or pull request where applicable.
- Active remediation should normally be tracked through GitHub Issues.
- This register records risk history and status, not detailed implementation task breakdowns.
- Duplicate findings should be linked or marked `Superseded` rather than deleted.
- Accepted risks must include rationale, scope, an owner-approved decision and a review trigger.
- False positives must retain the evidence explaining why the finding was rejected.
- A regression of the same underlying issue retains the original finding ID and records the new occurrence.
- Severity and confidence changes must preserve the prior reasoning in the linked audit or issue history.
- A historical audit report is evidence, not automatic proof that a finding is still present.

## Minimum finding evidence

Before adding a finding, record or link:

- audited branch and commit SHA;
- category, severity and confidence;
- exact implementation or configuration evidence;
- reproduction or validation method;
- affected environment(s);
- inaccessible systems and assumptions;
- first identified date and audit report;
- GitHub Issue when the finding is actionable and prioritised.

## Resolution rule

`Resolved` requires:

1. implementation evidence;
2. validation evidence;
3. linked commit or pull request where applicable; and
4. confirmation that the issue no longer reproduces.

Removing the finding, a test, a TODO or the affected documentation is not resolution evidence.
