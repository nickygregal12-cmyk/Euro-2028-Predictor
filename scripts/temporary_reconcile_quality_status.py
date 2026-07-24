from pathlib import Path
import traceback

ERROR_PATH = Path('docs/quality/reconciliations/temporary-status-reconcile-error.txt')


def write_lines(path, lines):
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def find_line(lines, prefix, start=0):
    for index in range(start, len(lines)):
        if lines[index].startswith(prefix):
            return index
    raise RuntimeError(f'Missing expected line prefix: {prefix}')


def reconcile_status():
    path = Path('docs/quality/current-status.md')
    lines = path.read_text(encoding='utf-8').splitlines()

    persisted = find_line(lines, '| Persisted score clearing |')
    evidence_rows = [
        '| Database-parity trigger repair | [`2026-07-24-database-parity-trigger.md`](reconciliations/2026-07-24-database-parity-trigger.md) |',
        '| Audit-control cleanup | [`2026-07-24-audit-control-cleanup.md`](reconciliations/2026-07-24-audit-control-cleanup.md) |',
    ]
    for row in reversed(evidence_rows):
        if row not in lines:
            lines.insert(persisted + 1, row)

    lines[find_line(lines, '| Current repository release-control baseline |')] = (
        '| Current repository release-control baseline | '
        '`d9bba09543409067624223f6f3fc0a0c75152cc2` — PR #45 merged the database-parity trigger repair |'
    )

    lines[find_line(lines, '- `tests/scripts/envFileHygiene.test.ts` reports 8 failures')] = (
        '- `2026-07-24R` found that `tests/scripts/envFileHygiene.test.ts` failed outside a Git work tree. '
        'Issue #46 now contains an explicit Git-work-tree gate and CI execution from `git archive`; '
        'pull-request validation is pending.'
    )

    lines[find_line(lines, 'The 12 pgTAP files under `supabase/tests/` were')] = (
        'The 12 pgTAP files under `supabase/tests/` were **read but not executed** during '
        '`2026-07-24R`; that audit had no local Supabase stack. PR #45 subsequently ran the full '
        'disposable database workflow successfully before merge.'
    )

    governance = find_line(lines, '## Quality-governance position')
    lines[governance] = '## Quality-governance position'
    post_heading = '## Repository control changes after `2026-07-24R`'
    if post_heading not in lines:
        block = [
            post_heading,
            '',
            '| Finding / batch | Current position |',
            '| --- | --- |',
            '| `DOC-004` | **Resolved.** `docs/quality/README.md` is restored on `main`, defines the required governance controls and satisfies `audit-prompt.md` repeat-audit item 1. |',
            '| `TEST-002` | **Resolved.** PR #45 merged as `d9bba09543409067624223f6f3fc0a0c75152cc2`; CI run 188 and Database parity run 65 passed on its latest head, including migration rebuild, database lint, pgTAP and TypeScript/PostgreSQL parity. |',
            '| Issue #46 | **In progress.** Git-less test behaviour, stale manual-test references and archived relative links are repaired on `agent/repair-audit-controls`; permanent regression checks and pull-request validation are pending. |',
            '',
        ]
        lines[governance:governance] = block
        governance += len(block)

    release = find_line(lines, '## Release identity rule')
    replacements = {
        '| `DOC-004` |': '| `DOC-004` | **Resolved:** the restored governance charter is present and readable on `main`. |',
        '| `DOC-005` |': '| `DOC-005` | **Open:** the live feature baseline still lacks stable `FEAT-*` / `PLAN-*` / `SAFE-*` identifiers and dispositions for every archived ID. |',
        '| `TEST-002` |': '| `TEST-002` | **Resolved:** the real rollout SQL directory and deployment contract now trigger Database parity, protected by an executable regression test. |',
        '| `DOC-001` |': '| `DOC-001` | **In progress — issue #46:** the stale test script is rewritten; repository validation is pending. |',
        '| `HYGIENE-001` |': '| `HYGIENE-001` | Corrected: the asset is present at `src/assets/vite.svg`; the previous "path not identified" note was wrong. |',
    }
    for index in range(governance, release):
        for prefix, replacement in replacements.items():
            if lines[index].startswith(prefix):
                lines[index] = replacement

    hygiene = find_line(lines, '| `HYGIENE-001` |', governance)
    for row in reversed([
        '| `TEST-003` | **In progress — issue #46:** Git-less checkouts now skip explicitly and CI contains an archive-based proof step; validation is pending. |',
        '| `DOC-006` | **In progress — issue #46:** archived targets are repaired and a repository-wide relative-link test is added; validation is pending. |',
    ]):
        if row not in lines:
            lines.insert(hygiene, row)

    lines = [line for line in lines if not line.startswith('**Fix `TEST-002`')]
    release = find_line(lines, '## Release identity rule')
    issue_line = 'Issue #46 owns the remaining audit-control validation. Production migration and deployment gates are unchanged.'
    if issue_line not in lines:
        lines[release:release] = [issue_line, '']

    quality_rows = [i for i, line in enumerate(lines) if line.startswith('| Quality governance |')]
    if len(quality_rows) != 2:
        raise RuntimeError(f'Expected two Quality governance rows, found {len(quality_rows)}')
    lines[quality_rows[0]] = (
        '| Quality governance | **Improving but still degraded.** `DOC-004` and `TEST-002` are resolved; '
        '`DOC-005` remains open and issue #46 is validating `DOC-001`, `TEST-003` and `DOC-006`. '
        'No feature or safeguard regression was detected. |'
    )
    lines[quality_rows[1]] = (
        '| Quality governance | `DOC-005` remains open. Issue #46 is validating the repaired '
        '`DOC-001`, `TEST-003` and `DOC-006` controls; `DOC-004` and `TEST-002` are resolved. |'
    )
    lines[find_line(lines, '| Test assurance |')] = (
        '| Test assurance | No Playwright or equivalent authenticated browser E2E suite. Database parity '
        'now covers migrations, rollout SQL, the deployment contract and its trigger regression test. |'
    )

    finding_heading = find_line(lines, '## Current finding positions')
    compatibility = find_line(lines, '## Production-entry compatibility proof')
    insertion = compatibility - 1
    for row in [
        '- `DOC-004`: resolved; the governance charter is restored and readable.',
        '- `TEST-002`: resolved by merged PR #45 and its green application/database workflows.',
        '- `DOC-001`, `TEST-003`, `DOC-006`: in progress through issue #46.',
    ]:
        if row not in lines[finding_heading:compatibility]:
            lines.insert(insertion, row)
            insertion += 1

    write_lines(path, lines)


def reconcile_risk():
    path = Path('docs/quality/risk-register.md')
    lines = path.read_text(encoding='utf-8').splitlines()

    latest = find_line(lines, '**Latest data reconciliation:**')
    for row in reversed([
        '**Database-parity trigger repair:** [`reconciliations/2026-07-24-database-parity-trigger.md`](reconciliations/2026-07-24-database-parity-trigger.md)  ',
        '**Audit-control cleanup:** [`reconciliations/2026-07-24-audit-control-cleanup.md`](reconciliations/2026-07-24-audit-control-cleanup.md)',
    ]):
        if row not in lines:
            lines.insert(latest + 1, row)

    lines[find_line(lines, '| Medium |')] = '| Medium | 19 | 2 | 17 |'
    lines[find_line(lines, '| **Total** |')] = '| **Total** | **57** | **8** | **49** |'
    lines[find_line(lines, '`OPS-001`, `OPS-004`')] = (
        '`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004` and `TEST-002` are resolved. '
        '`OPS-005` is superseded by `OPS-002`. `REPO-001` is partially resolved: the editor baseline is '
        'implemented and tested, while licence and changelog policy remain open. Several findings are '
        'implemented in repository/development but remain open because production has not received or '
        'browser-verified them.'
    )

    critical = find_line(lines, '## Critical')
    heading = '### Movement after `2026-07-24R`'
    if heading not in lines:
        lines[critical:critical] = [
            heading,
            '',
            '| Change | Detail |',
            '| --- | --- |',
            '| Resolved | `DOC-004` — the governance charter is restored on `main` and the mandatory audit read is satisfiable. |',
            '| Resolved | `TEST-002` — PR #45 merged the corrected database-parity trigger contract after CI run 188 and Database parity run 65 passed. |',
            '| In progress | Issue #46 repairs `DOC-001`, `TEST-003` and `DOC-006` with permanent regression coverage; pull-request validation is pending. |',
            '',
        ]

    replacements = {
        '| `DOC-001` |': '| `DOC-001` | Documentation is not consistently authoritative | **In progress — issue #46** | `docs/test-script.md` is rewritten against current environment gates and finding IDs, and executable coverage prevents its obsolete phase/batch references from returning. Close after the pull-request suite and repository-wide relative-link check pass. |',
        '| `DOC-004` |': '| `DOC-004` | Quality governance charter is absent | **Resolved** | `docs/quality/README.md` is restored on `main`, contains the source-of-truth, workflow, severity/status, evidence, resolution and prohibited-content controls, and satisfies `audit-prompt.md` repeat-audit item 1. Reopen if the charter is removed or the mandatory read becomes unsatisfiable. |',
        '| `TEST-002` |': '| `TEST-002` | Database-parity CI gate filters on a non-existent path | **Resolved** | PR #45 replaced the dead path with `scripts/database-rollout/**`, added `config/deployment-contract.json` and executable trigger-contract coverage, and merged as `d9bba09543409067624223f6f3fc0a0c75152cc2`. CI run 188 and Database parity run 65 passed on its latest head, including rebuild, lint, pgTAP and differential parity. |',
        '| `TEST-003` |': '| `TEST-003` | One test file hard-fails outside a git work tree | **In progress — issue #46** | The suite now detects Git-work-tree availability, skips explicitly when unavailable, and retains Git-native ignore assertions in normal checkouts. CI also runs the file from a `git archive` extraction with no `.git`. Close after both normal and archive-based pull-request steps pass. |',
        '| `DOC-006` |': '| `DOC-006` | Archived evidence has broken relative links | **In progress — issue #46** | Both archived files now use `../audits/` and `../risk-register.md`, and a repository-wide relative Markdown-link test is present. Close after the pull-request suite reports zero broken links. |',
    }
    for index, line in enumerate(lines):
        for prefix, replacement in replacements.items():
            if line.startswith(prefix):
                lines[index] = replacement

    write_lines(path, lines)


def main():
    reconcile_status()
    reconcile_risk()
    if ERROR_PATH.exists():
        ERROR_PATH.unlink()


try:
    main()
except Exception:
    ERROR_PATH.write_text(traceback.format_exc(), encoding='utf-8')
