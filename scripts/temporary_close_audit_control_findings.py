from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


status_path = Path('docs/quality/current-status.md')
status = status_path.read_text(encoding='utf-8')
status = replace_once(status, '| Current repository release-control baseline | `d9bba09543409067624223f6f3fc0a0c75152cc2` — PR #45 merged the database-parity trigger repair |', '| Current repository release-control baseline | `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8` — PR #47 merged the audit-control cleanup after final head CI run 200 passed |', 'release-control baseline')
status = replace_once(status, '- `2026-07-24R` found that `tests/scripts/envFileHygiene.test.ts` failed outside a Git work tree. Issue #46 now contains an explicit Git-work-tree gate and CI execution from `git archive`; pull-request validation is pending.', '- `2026-07-24R` found that `tests/scripts/envFileHygiene.test.ts` failed outside a Git work tree. PR #47 CI run 200 passed both the explicit `git archive` Git-less execution and the normal Git-checkout assertions before merge.', 'TEST-003 qualification')
status = replace_once(status, '| Issue #46 | **In progress.** Git-less test behaviour, stale manual-test references and archived relative links are repaired on `agent/repair-audit-controls`; permanent regression checks and pull-request validation are pending. |', '| Issue #46 / PR #47 | **Resolved on `main`.** PR #47 merged as `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8`; issue #46 closed automatically. Final head `fd0fc31f4e0038e89b0d286927554de897e6d04f` passed CI run 200. |', 'issue 46 row')
status = replace_once(status, '| `DOC-001` | **In progress — issue #46:** the stale test script is rewritten; repository validation is pending. |', '| `DOC-001` | **Resolved:** the stale phase/batch references are removed, the script is aligned to current environment gates, and executable coverage prevents their return. |', 'DOC-001 row')
status = replace_once(status, '| `TEST-003` | **In progress — issue #46:** Git-less checkouts now skip explicitly and CI contains an archive-based proof step; validation is pending. |', '| `TEST-003` | **Resolved:** CI run 200 passed the Git-less archive proof and the normal Git-checkout assertions before merge. |', 'TEST-003 row')
status = replace_once(status, '| `DOC-006` | **In progress — issue #46:** archived targets are repaired and a repository-wide relative-link test is added; validation is pending. |', '| `DOC-006` | **Resolved:** archived targets are repaired and the repository-wide relative-link test passed in CI run 200 before merge. |', 'DOC-006 row')
status = replace_once(status, 'Issue #46 owns the remaining audit-control validation. Production migration and deployment gates are unchanged.', 'Issue #46 is closed and its audit-control findings are resolved on `main`. Production migration and deployment gates are unchanged.', 'closure sentence')
status = replace_once(status, '| Quality governance | **Improving but still degraded.** `DOC-004` and `TEST-002` are resolved; `DOC-005` remains open and issue #46 is validating `DOC-001`, `TEST-003` and `DOC-006`. No feature or safeguard regression was detected. |', '| Quality governance | **Improved but still degraded by `DOC-005`.** `DOC-004`, `TEST-002`, `DOC-001`, `TEST-003` and `DOC-006` are resolved. No feature or safeguard regression was detected. |', 'governance verdict')
status = replace_once(status, '- `DOC-001`, `TEST-003`, `DOC-006`: in progress through issue #46.', '- `DOC-001`, `TEST-003`, `DOC-006`: resolved by merged PR #47 and its green final-head validation.', 'finding positions')
status = replace_once(status, '| Quality governance | `DOC-005` remains open. Issue #46 is validating the repaired `DOC-001`, `TEST-003` and `DOC-006` controls; `DOC-004` and `TEST-002` are resolved. |', '| Quality governance | `DOC-005` remains open. `DOC-004`, `TEST-002`, `DOC-001`, `TEST-003` and `DOC-006` are resolved. |', 'blocker row')
status_path.write_text(status, encoding='utf-8')

risk_path = Path('docs/quality/risk-register.md')
risk = risk_path.read_text(encoding='utf-8')
risk = replace_once(risk, '| Medium | 19 | 2 | 17 |', '| Medium | 19 | 3 | 16 |', 'medium summary')
risk = replace_once(risk, '| Low | 16 | 3 | 13 |', '| Low | 16 | 5 | 11 |', 'low summary')
risk = replace_once(risk, '| **Total** | **57** | **8** | **49** |', '| **Total** | **57** | **11** | **46** |', 'total summary')
risk = replace_once(risk, '`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004` and `TEST-002` are resolved.', '`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `TEST-002`, `DOC-001`, `TEST-003` and `DOC-006` are resolved.', 'resolved summary')
risk = replace_once(risk, '| In progress | Issue #46 repairs `DOC-001`, `TEST-003` and `DOC-006` with permanent regression coverage; pull-request validation is pending. |', '| Resolved | PR #47 merged as `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8`; final head CI run 200 passed and issue #46 closed. This resolves `DOC-001`, `TEST-003` and `DOC-006`. |', 'movement row')
risk = replace_once(risk, '| `DOC-001` | Documentation is not consistently authoritative | **In progress — issue #46** | `docs/test-script.md` is rewritten against current environment gates and finding IDs, and executable coverage prevents its obsolete phase/batch references from returning. Close after the pull-request suite and repository-wide relative-link check pass. |', '| `DOC-001` | Documentation is not consistently authoritative | **Resolved by PR #47** | `docs/test-script.md` is aligned to current environment gates and finding IDs; repository-wide relative-link and obsolete-reference checks passed in CI run 200 before merge. Reopen on a new verified authority or cross-reference inconsistency. |', 'DOC-001 risk row')
risk = replace_once(risk, '| `TEST-003` | One test file hard-fails outside a git work tree | **In progress — issue #46** | The suite now detects Git-work-tree availability, skips explicitly when unavailable, and retains Git-native ignore assertions in normal checkouts. CI also runs the file from a `git archive` extraction with no `.git`. Close after both normal and archive-based pull-request steps pass. |', '| `TEST-003` | One test file hard-fails outside a git work tree | **Resolved by PR #47** | CI run 200 passed the explicit Git-less `git archive` execution and the normal Git-checkout assertions before merge. Reopen if Git-less execution fails or becomes an unexplained false pass. |', 'TEST-003 risk row')
risk = replace_once(risk, '| `DOC-006` | Archived evidence has broken relative links | **In progress — issue #46** | Both archived files now use `../audits/` and `../risk-register.md`, and a repository-wide relative Markdown-link test is present. Close after the pull-request suite reports zero broken links. |', '| `DOC-006` | Archived evidence has broken relative links | **Resolved by PR #47** | Both archived files use the correct parent-relative targets and the repository-wide Markdown-link check passed in CI run 200 before merge. Reopen on any broken relative-link regression. |', 'DOC-006 risk row')
risk_path.write_text(risk, encoding='utf-8')

reconciliation_path = Path('docs/quality/reconciliations/2026-07-24-audit-control-cleanup.md')
reconciliation = reconciliation_path.read_text(encoding='utf-8')
reconciliation = replace_once(reconciliation, '**Status:** Validated for merge; `main` closure pending', '**Status:** Closed on `main`', 'reconciliation status')
marker = '## Closure boundary'
index = reconciliation.index(marker)
reconciliation = reconciliation[:index] + '''## Post-merge closure evidence

- PR #47 merged into `main` as `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8`.
- The final clean PR head `fd0fc31f4e0038e89b0d286927554de897e6d04f` passed CI run 200, including the Git-less archive proof, build, lint, complete test suite, repository-wide Markdown-link checks and dependency audit.
- GitHub automatically closed issue #46 as completed at merge.
- `DOC-001`, `TEST-003` and `DOC-006` are therefore resolved at the repository layer.
- `TEST-002` and `DOC-004` remain resolved.
- The connected GitHub workflow-run endpoint did not expose a separate push-triggered run for the squash merge commit; this note does not claim an unseen `main` run.

No production, Supabase, Netlify, migration, deployment-contract, scoring or application-runtime change occurred in this closure batch.
'''
reconciliation_path.write_text(reconciliation, encoding='utf-8')
