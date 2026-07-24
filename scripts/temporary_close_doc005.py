from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        if text.count(old) != 1:
            raise SystemExit(f'{label}: expected one old match, found {text.count(old)}')
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'{label}: neither old nor closed form found')


status_path = Path('docs/quality/current-status.md')
status = status_path.read_text(encoding='utf-8')
status = replace_once(
    status,
    '| Audit-control cleanup | [`2026-07-24-audit-control-cleanup.md`](reconciliations/2026-07-24-audit-control-cleanup.md) |',
    '| Audit-control cleanup | [`2026-07-24-audit-control-cleanup.md`](reconciliations/2026-07-24-audit-control-cleanup.md) |\n| Feature-baseline identifiers | [`2026-07-24-feature-baseline-identifiers.md`](reconciliations/2026-07-24-feature-baseline-identifiers.md) |',
    'status evidence link',
)
status = replace_once(
    status,
    '| Current repository release-control baseline | `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8` — PR #47 merged the audit-control cleanup after final head CI run 200 passed |',
    '| Current repository release-control baseline | `2bfe5d6b06519cf26929ba49a57b5a5861644e14` — PR #50 restored stable feature-baseline identifiers after final head CI run 217 passed |',
    'status release baseline',
)
status = replace_once(
    status,
    '| Issue #46 / PR #47 | **Resolved on `main`.** PR #47 merged as `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8`; issue #46 closed automatically. Final head `fd0fc31f4e0038e89b0d286927554de897e6d04f` passed CI run 200. |',
    '| Issue #46 / PR #47 | **Resolved on `main`.** PR #47 merged as `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8`; issue #46 closed automatically. Final head `fd0fc31f4e0038e89b0d286927554de897e6d04f` passed CI run 200. |\n| Issue #49 / PR #50 | **Resolved on `main`.** PR #50 merged as `2bfe5d6b06519cf26929ba49a57b5a5861644e14`; issue #49 closed automatically. Final head `f191a988e5cf18d773846c4d58b8f5d8becdd1c9` passed CI run 217. |',
    'status PR50 row',
)
status = replace_once(
    status,
    'The engineering position improved substantially since `2026-07-23R`. The system that measures it weakened, and that is now the notable concern:',
    'The engineering position improved substantially since `2026-07-23R`. The quality-governance controls identified by that repeat audit are now restored and executable:',
    'status governance introduction',
)
status = replace_once(
    status,
    '| `DOC-005` | **Open:** the live feature baseline still lacks stable `FEAT-*` / `PLAN-*` / `SAFE-*` identifiers and dispositions for every archived ID. |',
    '| `DOC-005` | **Resolved:** every compact baseline row has a unique primary ID, all 96 archived IDs have explicit dispositions, and executable tests enforce continuity and non-reuse. |',
    'status DOC-005 row',
)
status = replace_once(
    status,
    'Issue #46 is closed and its audit-control findings are resolved on `main`. Production migration and deployment gates are unchanged.',
    'Issues #46 and #49 are closed, and all quality-governance findings added by `2026-07-24R` are resolved on `main`. Production migration and deployment gates are unchanged.',
    'status closure sentence',
)
status = replace_once(
    status,
    '| Quality governance | **Improved but still degraded by `DOC-005`.** `DOC-004`, `TEST-002`, `DOC-001`, `TEST-003` and `DOC-006` are resolved. No feature or safeguard regression was detected. |',
    '| Quality governance | **Restored.** `DOC-004`, `DOC-005`, `TEST-002`, `DOC-001`, `TEST-003` and `DOC-006` are resolved, with executable continuity checks protecting the feature baseline. No feature or safeguard regression was detected. |',
    'status governance verdict',
)
status_path.write_text(status, encoding='utf-8')


risk_path = Path('docs/quality/risk-register.md')
risk = risk_path.read_text(encoding='utf-8')
risk = replace_once(
    risk,
    '**Audit-control cleanup:** [`reconciliations/2026-07-24-audit-control-cleanup.md`](reconciliations/2026-07-24-audit-control-cleanup.md)',
    '**Audit-control cleanup:** [`reconciliations/2026-07-24-audit-control-cleanup.md`](reconciliations/2026-07-24-audit-control-cleanup.md)  \n**Feature-baseline identifiers:** [`reconciliations/2026-07-24-feature-baseline-identifiers.md`](reconciliations/2026-07-24-feature-baseline-identifiers.md)',
    'risk evidence link',
)
risk = replace_once(risk, '| Medium | 19 | 3 | 16 |', '| Medium | 19 | 4 | 15 |', 'risk medium count')
risk = replace_once(risk, '| **Total** | **57** | **11** | **46** |', '| **Total** | **57** | **12** | **45** |', 'risk total count')
risk = replace_once(
    risk,
    '`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `TEST-002`, `DOC-001`, `TEST-003` and `DOC-006` are resolved.',
    '`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `DOC-005`, `TEST-002`, `DOC-001`, `TEST-003` and `DOC-006` are resolved.',
    'risk resolved summary',
)
risk = replace_once(
    risk,
    '| Resolved | PR #47 merged as `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8`; final head CI run 200 passed and issue #46 closed. This resolves `DOC-001`, `TEST-003` and `DOC-006`. |',
    '| Resolved | PR #47 merged as `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8`; final head CI run 200 passed and issue #46 closed. This resolves `DOC-001`, `TEST-003` and `DOC-006`. |\n| Resolved | PR #50 merged as `2bfe5d6b06519cf26929ba49a57b5a5861644e14`; final head CI run 217 passed and issue #49 closed. This resolves `DOC-005`. |',
    'risk movement row',
)
risk = replace_once(
    risk,
    '| `DOC-005` | Live feature baseline has lost its stable identifiers | **Open — owner action required** | `feature-baseline.md` was rewritten from 96 ID-bearing rows (`FEAT-*`, `PLAN-*`, `SAFE-*`) to 60 rows with no IDs and no `Last verified`/`Validation evidence` columns. The prior version is preserved at `history/feature-baseline-2026-07-23R.md`, so no evidence is lost, but row-by-row regression comparison is no longer reliable. The 96→60 reduction is not itself evidence of feature loss — the point is that it can no longer be audited. Close after IDs are re-attached and every archived ID is present or has a recorded disposition. |',
    '| `DOC-005` | Live feature baseline has lost its stable identifiers | **Resolved by PR #50** | All 59 compact rows now have unique primary IDs; all 96 archived IDs have explicit continuity dispositions; new IDs are non-conflicting; and CI run 217 passed the executable continuity, Markdown, build, lint, full-test and dependency-audit gates. Reopen if an archived ID loses representation, a compact row loses its primary ID or an identifier is reused. |',
    'risk DOC-005 row',
)
risk_path.write_text(risk, encoding='utf-8')


reconciliation_path = Path('docs/quality/reconciliations/2026-07-24-feature-baseline-identifiers.md')
reconciliation = reconciliation_path.read_text(encoding='utf-8')
reconciliation = replace_once(
    reconciliation,
    '**Status:** Pull-request validation complete; `main` closure pending',
    '**Status:** Closed on `main`',
    'reconciliation status',
)
reconciliation = replace_once(
    reconciliation,
    'CI runs 211 through 216 passed on the implementation and documentation heads. Final review head `f76cd3fa7a1154754167b675ff78fa4a5abff198` passed run 216:',
    'CI runs 211 through 217 passed on the implementation and documentation heads. Final merged PR head `f191a988e5cf18d773846c4d58b8f5d8becdd1c9` passed run 217:',
    'reconciliation validation head',
)
old_closure = '''## Closure boundary

Until the pull request is merged, `DOC-005` remains open because an unmerged branch is not the live quality authority.

After merge:

1. confirm the exact `main` merge commit and green final-head CI;
2. mark `DOC-005` resolved in `current-status.md` and `risk-register.md`;
3. update the risk totals;
4. close issue #49.
'''
new_closure = '''## Post-merge closure evidence

- PR #50 merged into `main` as `2bfe5d6b06519cf26929ba49a57b5a5861644e14`.
- Final PR head `f191a988e5cf18d773846c4d58b8f5d8becdd1c9` passed CI run 217, including installation, the Git-less proof, build, lint, the complete test suite, identifier-continuity assertions, repository-wide Markdown checks and the production-dependency audit.
- GitHub automatically closed issue #49 as completed at merge.
- `DOC-005` is resolved at the repository layer.
- The risk register now records 12 closed or superseded findings and 45 open or partially resolved findings.

No application behavior, scoring, migrations, Supabase data or configuration, Netlify settings, deployment-contract values or production data changed in this closure batch.
'''
reconciliation = replace_once(reconciliation, old_closure, new_closure, 'reconciliation closure')
reconciliation_path.write_text(reconciliation, encoding='utf-8')
