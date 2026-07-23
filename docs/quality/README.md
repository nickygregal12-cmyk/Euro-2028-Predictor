# Quality governance

This directory is the durable quality-control layer for the Euro 2028 Predictor. It preserves the latest assurance position, verified risk history, the known feature and safeguard baseline, intentionally deferred decisions and immutable audit evidence without becoming a second roadmap or backlog.

## Existing authoritative controls

The quality system complements rather than replaces:

- [`../../CLAUDE.md`](../../CLAUDE.md) — agent instructions, architecture rules, Git discipline and database-change rules.
- [`../roadmap.md`](../roadmap.md) — full product sequence and deliberately deferred product work.
- [`../build-todo.md`](../build-todo.md) — current implementation checklist and near-term sequencing.
- [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md) — architecture and tournament-state contract.
- [`../scoring-rules.md`](../scoring-rules.md) — approved Original Predictor scoring and entry-validity rules.
- [`../tournament-structure.md`](../tournament-structure.md) — tournament facts and structural rules.
- [`../competition-structure.md`](../competition-structure.md) — separation between the Original Predictor and future competitions.
- [`../design-system.md`](../design-system.md) — approved interface and design-system rules.
- Existing `docs/ops-*.md` files — operational procedures and environment-specific evidence.

Do not move their content here or create competing copies. Where actual and intended behaviour conflict, keep the conflict visible until it is repaired or explicitly decided.

## Source-of-truth hierarchy

1. Approved current requirements and project-control documents define intended behaviour.
2. Current code, migrations and observed runtime behaviour define actual implementation.
3. Automated and reviewed manual tests provide validation evidence.
4. [`feature-baseline.md`](feature-baseline.md) preserves the current feature and safeguard inventory.
5. [`risk-register.md`](risk-register.md) preserves verified findings and risk history.
6. GitHub Issues track active remediation work.
7. Pull requests and commits provide implementation and review evidence.
8. [`current-status.md`](current-status.md) provides the latest concise quality summary.
9. Dated files under [`audits/`](audits/) preserve historical audit evidence.

A historical audit is evidence at one commit and date. It must not become a competing live task list, and it must never be overwritten to make the current position look cleaner.

## Active and historical documents

| Document | Role | Active source of implementation tasks? |
| --- | --- | --- |
| [`current-status.md`](current-status.md) | Latest concise assurance position and blockers | No |
| [`feature-baseline.md`](feature-baseline.md) | Feature/safeguard preservation and regression comparison | No |
| [`risk-register.md`](risk-register.md) | Permanent finding history and current status | No |
| [`deferred-decisions.md`](deferred-decisions.md) | Intentionally postponed decisions with review triggers | No |
| [`audit-prompt.md`](audit-prompt.md) | Controlled reusable audit instructions | No |
| [`audits/`](audits/) | Immutable dated evidence | No |
| GitHub Issues | Approved active remediation work | **Yes** |
| Pull requests and commits | Implementation/review/validation evidence | No |

## Finding workflow

1. An audit identifies a verified finding and preserves full evidence in a dated report.
2. The finding is added to `risk-register.md` with its stable ID.
3. An actionable Critical, High or agreed Medium finding receives a GitHub Issue.
4. The Issue references the finding ID and dated audit.
5. Work is completed on a dedicated branch.
6. The pull request references both the Issue and finding ID.
7. Automated tests and required manual validation are completed.
8. The pull request is reviewed and merged.
9. The risk register and current status are updated with the merged evidence.
10. A future audit retests the control and confirms that it has not regressed.

Deleting a test, TODO, document or finding is not resolution evidence.

## Finding identifiers

Future findings should use stable category prefixes such as:

| Prefix | Category |
| --- | --- |
| `SEC` | Security and privacy |
| `DATA` | Data integrity and database behaviour |
| `AUTH` | Authentication and authorisation |
| `FUNC` | Functional and business-rule correctness |
| `UX` | User experience |
| `A11Y` | Accessibility |
| `PERF` | Performance |
| `TEST` | Testing and validation |
| `DEPLOY` | Deployment, environments and operations |
| `DOC` | Documentation and maintainability |

The 23 July 2026 audit already assigned stable IDs using additional prefixes including `SECURITY`, `REL`, `OPS`, `TYPE`, `HYGIENE`, `CODE`, `SEO` and `REPO`. Those IDs are preserved exactly. Do not renumber them merely to normalise naming.

Use the original ID when the same underlying defect regresses. Create a new ID only for a materially different root cause or risk.

## Severity definitions

| Severity | Definition |
| --- | --- |
| **Critical** | Can plausibly cause a security breach, permission bypass, irreversible corruption, materially incorrect core competition results, severe privacy exposure or a production outage requiring immediate containment. |
| **High** | Can materially break a major user journey, undermine data/release confidence, create significant operational risk or make the application unsafe to launch without repair. |
| **Medium** | Meaningful defect or control weakness that should be scheduled but does not immediately threaten core competition integrity. |
| **Low** | Minor defect, polish item, cleanup or optional improvement with limited user or operational impact. |

Severity describes impact, not implementation effort.

## Status definitions

| Status | Definition |
| --- | --- |
| **Open** | Verified and not yet being actively repaired. |
| **In progress** | A linked Issue or branch is actively addressing the finding. |
| **Blocked** | Work cannot progress until a recorded dependency or decision is resolved. |
| **Resolved** | Every resolution requirement below is met. |
| **Accepted risk** | An authorised owner has accepted the risk with rationale, scope and review trigger. |
| **False positive** | Evidence shows the finding is not present or applicable; the rejection rationale remains recorded. |
| **Superseded** | Replaced by another finding/control; the replacement relationship is recorded. |

Use the confidence field for findings that require verification rather than deleting or overstating them.

## Evidence requirements

A finding must provide enough evidence for another reviewer to reproduce or independently assess it:

- audit date, branch and commit SHA;
- exact paths, functions, routes, migrations, policies, queries or configuration;
- affected environments;
- command/test output or manual reproduction where available;
- systems that were inaccessible;
- confidence and assumptions;
- links to the dated audit and GitHub Issue where applicable.

A comment, TODO, test name or historical claim is not proof by itself.

## Resolution requirements

A finding may be marked **Resolved** only when all of the following exist:

1. implementation evidence;
2. validation evidence;
3. a linked commit or pull request where applicable; and
4. confirmation that the issue no longer reproduces.

If a product decision changes the intended requirement, record the authorised decision and update the relevant authoritative document. Do not silently rewrite history.

## Regression and repeat-audit review

Every repeat audit or release-sensitive review must:

- start from the exact current commit and deployed version;
- compare current implementation against `feature-baseline.md`;
- review every open and resolved Critical/High finding;
- reuse the original finding ID when the same issue returns;
- distinguish removed, renamed, unreachable, planned, deferred and legacy features;
- record newly inaccessible systems as unknown rather than assuming they remain safe;
- create a new dated report instead of overwriting the previous one;
- update the risk register, feature baseline and current status only after evidence review.

## Review frequency

- Update `current-status.md` after every approved audit, material remediation batch or production-readiness review.
- Review all open Critical and High findings before a release-sensitive merge.
- Review accepted risks at their recorded trigger and before each launch gate.
- Compare the feature baseline during every full audit and major release.
- Run a full review before the tournament dress rehearsal and again before production launch.

## Prohibited content

Never store in `docs/quality/`:

- service-role keys, database passwords or access tokens;
- Netlify, GitHub, SMTP or private API tokens;
- refresh tokens or user passwords;
- personal user data, database exports or sensitive production logs;
- exploit payloads that create unnecessary risk;
- duplicate roadmaps, backlogs, project-control systems or architecture-decision registers;
- unverified allegations presented as confirmed findings;
- detailed implementation task lists that belong in GitHub Issues;
- browser keys duplicated from existing environment documentation without a clear need.
