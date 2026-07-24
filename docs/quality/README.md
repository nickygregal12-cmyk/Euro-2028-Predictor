# Quality governance

This directory is the durable quality-control layer for the Euro 2028 Predictor. It preserves the current assurance position, verified risk history, the feature and safeguard baseline, intentionally deferred decisions, workstream reconciliation evidence and immutable audit evidence — without becoming a second roadmap or backlog.

> **Restored 2026-07-24.** This charter was absent from the repository between the `2026-07-23L` reorganisation and the `2026-07-24R` audit, which recorded the gap as `DOC-004`. It has been restored and updated for the `reconciliations/` and `history/` directories that did not exist when it was first written. `audit-prompt.md` § *Repeat-audit and quality-baseline controls* item 1 requires this file to be readable.

## Existing authoritative controls

The quality system complements rather than replaces:

- [`../../AGENTS.md`](../../AGENTS.md) — agent operating rules and the authority order.
- [`../../CLAUDE.md`](../../CLAUDE.md) — coding-agent session guidance.
- [`current-status.md`](current-status.md) — the live implementation and operations status document.
- [`../roadmap.md`](../roadmap.md) — future product sequence.
- [`../build-todo.md`](../build-todo.md) — near-term execution checklist.
- [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md) — architecture and tournament-state contract.
- [`../scoring-rules.md`](../scoring-rules.md) — approved Original Predictor scoring and entry-validity rules.
- [`../tournament-structure.md`](../tournament-structure.md) — tournament facts and structural rules.
- [`../competition-structure.md`](../competition-structure.md) — separation between the Original Predictor and future competitions.
- [`../design-system.md`](../design-system.md) — approved interface and design-system rules.
- `../ops-*.md` — operational procedures and environment-specific evidence.

Do not move their content here or create competing copies. Where actual and intended behaviour conflict, keep the conflict visible until it is repaired or explicitly decided.

## Source-of-truth hierarchy

1. Current `main` code, migrations and executable tests.
2. Verified current hosted evidence (Supabase, Netlify, GitHub).
3. [`current-status.md`](current-status.md) — the live assurance and operations position.
4. The latest dated audit and the workstream notes in [`reconciliations/`](reconciliations/).
5. [`feature-baseline.md`](feature-baseline.md) — the feature and safeguard inventory.
6. [`risk-register.md`](risk-register.md) — verified findings and risk history.
7. GitHub Issues — active remediation work.
8. Pull requests and commits — implementation and review evidence.
9. Dated files under [`audits/`](audits/) and superseded documents under [`history/`](history/) — historical evidence only.

A historical audit is evidence at one commit and date. It must not become a competing live task list, and it must never be overwritten to make the current position look cleaner.

**A repository or development fix is not a production fix.** A finding stays open while the actual risk remains present or unverified in production.

## Active and historical documents

| Document | Role | Active source of implementation tasks? |
| --- | --- | --- |
| [`current-status.md`](current-status.md) | Live assurance and operations position | No |
| [`feature-baseline.md`](feature-baseline.md) | Feature/safeguard preservation and regression comparison | No |
| [`risk-register.md`](risk-register.md) | Permanent finding history and current status | No |
| [`deferred-decisions.md`](deferred-decisions.md) | Intentionally postponed decisions with review triggers | No |
| [`audit-prompt.md`](audit-prompt.md) | Controlled reusable audit instructions | No |
| [`audits/`](audits/) | Immutable dated audit evidence | No |
| [`reconciliations/`](reconciliations/) | Dated workstream closure evidence | No |
| [`history/`](history/) | Superseded versions of live control documents | No |
| GitHub Issues | Approved active remediation work | **Yes** |
| Pull requests and commits | Implementation/review/validation evidence | No |

### `reconciliations/`

A reconciliation records the closure evidence for one workstream: what changed, what was verified, in which environment, and what remains open. Use `YYYY-MM-DD-<workstream>.md`. A reconciliation is evidence, not a task list, and does not replace a risk-register status change — update both.

### `history/`

When a live control document is materially restructured, archive the previous version here as `<document>-<audit-designation>.md` before replacing it. Fix relative links when moving a file down a directory level.

## Finding workflow

1. An audit identifies a verified finding and preserves full evidence in a dated report.
2. The finding is added to `risk-register.md` with its stable ID.
3. An actionable Critical, High or agreed Medium finding receives a GitHub Issue.
4. The Issue references the finding ID and dated audit.
5. Work is completed on a dedicated branch.
6. The pull request references both the Issue and finding ID.
7. Automated tests and required manual validation are completed.
8. The pull request is reviewed and merged.
9. A reconciliation note records the closure evidence where the workstream warrants one.
10. The risk register, feature baseline and current status are updated with the merged evidence.
11. A future audit retests the control and confirms that it has not regressed.

Deleting a test, TODO, document or finding is not resolution evidence.

## Finding identifiers

| Prefix | Category |
| --- | --- |
| `SEC` / `SECURITY` | Security and privacy |
| `DATA` | Data integrity and database behaviour |
| `AUTH` | Authentication and authorisation |
| `FUNC` | Functional and business-rule correctness |
| `UX` | User experience |
| `A11Y` | Accessibility |
| `PERF` | Performance |
| `REL` | Reliability and edge cases |
| `TEST` | Testing and validation |
| `OPS` / `DEPLOY` | Deployment, environments and operations |
| `DOC` | Documentation and maintainability |
| `TYPE` | Typing and schema-drift protection |
| `CODE` | Code structure and maintainability |
| `HYGIENE` / `REPO` | Repository hygiene |
| `SEO` | Public-web and sharing quality |

Both `SEC` and `SECURITY`, and both `OPS` and `DEPLOY`, appear in the historical registers. Those IDs are preserved exactly. **Do not renumber existing findings merely to normalise naming.**

Use the original ID when the same underlying defect regresses or broadens. Create a new ID only for a materially different root cause or risk.

## Severity definitions

| Severity | Definition |
| --- | --- |
| **Critical** | Can plausibly cause a security breach, permission bypass, irreversible corruption, materially incorrect core competition results, severe privacy exposure or a production outage requiring immediate containment. |
| **High** | Can materially break a major user journey, undermine data/release confidence, create significant operational risk or make the application unsafe to launch without repair. |
| **Medium** | Meaningful defect or control weakness that should be scheduled but does not immediately threaten core competition integrity. |
| **Low** | Minor defect, polish item, cleanup or optional improvement with limited user or operational impact. |

Severity describes impact, not implementation effort. A severity change must record the audit designation that changed it and, where the change is proposed rather than applied, remain flagged until the owner confirms it.

## Status definitions

| Status | Definition |
| --- | --- |
| **Open** | Verified and not yet being actively repaired. |
| **In progress** | A linked Issue or branch is actively addressing the finding. |
| **Partially resolved** | Some layers or environments are repaired and verified; the actual risk remains present or unverified elsewhere. State exactly which layer and environment remain. |
| **Blocked** | Work cannot progress until a recorded dependency or decision is resolved. |
| **Resolved** | Every resolution requirement below is met. |
| **Accepted risk** | An authorised owner has accepted the risk with rationale, scope and review trigger. |
| **False positive** | Evidence shows the finding is not present or applicable; the rejection rationale remains recorded. |
| **Superseded** | Replaced by another finding/control; the replacement must be named. |

Use the confidence field for findings that require verification rather than deleting or overstating them.

## Evidence requirements

A finding must provide enough evidence for another reviewer to reproduce or independently assess it:

- audit date, designation, branch and commit SHA;
- exact paths, functions, routes, migrations, policies, queries or configuration;
- affected environments, stated separately for repository, development and production;
- command/test output or manual reproduction where available;
- systems that were inaccessible;
- confidence and assumptions;
- links to the dated audit, reconciliation and GitHub Issue where applicable.

A comment, TODO, test name, runbook log or historical claim is not proof by itself. The `2026-07-23L` disproof of `OPS-005` is the worked example: a runbook recorded an action as executed, and direct inspection showed it had not been.

## Resolution requirements

A finding may be marked **Resolved** only when all of the following exist:

1. implementation evidence;
2. validation evidence appropriate to the finding — for a hosted risk, that means current-environment evidence, not repository tests alone;
3. a linked commit or pull request where applicable; and
4. confirmation that the issue no longer reproduces.

Prepared tooling, an approved method or a documented process is **not** resolution evidence for a finding that requires a real artifact, a restore proof or demonstrated consistency.

If a product decision changes the intended requirement, record the authorised decision and update the relevant authoritative document. Do not silently rewrite history.

## Regression and repeat-audit review

Every repeat audit or release-sensitive review must:

- start from the exact current commit and deployed version;
- compare current implementation against `feature-baseline.md` **using stable identifiers**;
- review every open and resolved Critical/High finding;
- reuse the original finding ID when the same issue returns;
- distinguish removed, renamed, unreachable, planned, deferred and legacy features;
- record newly inaccessible systems as unknown rather than assuming they remain safe;
- create a new dated report instead of overwriting the previous one;
- update the risk register, feature baseline and current status only after evidence review.

## Review frequency

- Update `current-status.md` after every approved audit, material remediation batch, hosted change or production-readiness review.
- Review all open Critical and High findings before a release-sensitive merge and before any production migration window.
- Review accepted risks at their recorded trigger and before each launch gate.
- Compare the feature baseline during every full audit and major release.
- Run a full review before the tournament dress rehearsal and again before production launch.

## Prohibited content

Never store in `docs/quality/`:

- service-role keys, database passwords or access tokens;
- Netlify, GitHub, SMTP, Cloudflare or private API secrets;
- refresh tokens or user passwords;
- personal user data, database exports or sensitive production logs;
- backup artifacts, dumps or encryption passphrases;
- exploit payloads that create unnecessary risk;
- duplicate roadmaps, backlogs, project-control systems or architecture-decision registers;
- unverified allegations presented as confirmed findings;
- detailed implementation task lists that belong in GitHub Issues;
- browser keys duplicated from existing environment documentation without a clear need.

Project references, site IDs and deploy IDs identify environments and are permitted. Aggregate row counts are permitted; individual user records are not.
