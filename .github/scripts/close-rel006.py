from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


risk_path = Path("docs/quality/risk-register.md")
risk = risk_path.read_text()
risk = replace_once(
    risk,
    "| High | 16 | 3 | 13 |\n| Medium | 19 | 4 | 15 |\n| Low | 16 | 6 | 10 |\n| **Total** | **57** | **14** | **43** |\n",
    "| High | 16 | 3 | 13 |\n| Medium | 19 | 5 | 14 |\n| Low | 16 | 6 | 10 |\n| **Total** | **57** | **15** | **42** |\n",
    "risk summary counts",
)
risk = replace_once(
    risk,
    "`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `DOC-005`, `TEST-002`, `DOC-001`, `TEST-003`, `DOC-006`, `REL-002` and `UX-004` are resolved.",
    "`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `DOC-005`, `TEST-002`, `DOC-001`, `TEST-003`, `DOC-006`, `REL-002`, `REL-006` and `UX-004` are resolved.",
    "risk resolved list",
)
risk = replace_once(
    risk,
    "| In progress | PR #65 implements `REL-006`; service, unit, Browser E2E and preview evidence are green, with final documentation-head validation and merge pending. |\n",
    "| Resolved | PR #65 merged as `cd517f6f0fba48aaf54c16ee444671db29bd2741`; final CI run `30131321194`, Browser E2E run `30131321198` and the ready Netlify preview passed. This resolves `REL-006`. |\n",
    "risk movement REL-006",
)
risk = replace_once(
    risk,
    "| `REL-006` | Concurrent first-use requests can hit entry unique conflicts | **Implementation complete — PR #65 pending merge** | Existing unique `(user_id, tournament_id)` authority now supports an insert-on-conflict/fallback-read boundary; focused service tests and a coordinated two-context disposable-Supabase race pass. Close only after the final documentation head is green and merged. |\n",
    "| `REL-006` | Concurrent first-use requests can hit entry unique conflicts | **Resolved by PR #65** | Existing unique `(user_id, tournament_id)` authority supports an insert-on-conflict/fallback-read boundary; focused service tests and a coordinated two-context disposable-Supabase race passed final CI and Browser E2E before merge. Reopen on any duplicate-entry or raw first-use conflict regression. |\n",
    "risk REL-006",
)
risk_path.write_text(risk)

status_path = Path("docs/quality/current-status.md")
status = status_path.read_text()
status = replace_once(
    status,
    "- `REL-006`: implementation and executable concurrent-browser proof pass on PR #65; final documentation-head validation and merge remain.\n",
    "- `REL-006`: resolved by merged PR #65 and its final CI, concurrent-browser and preview evidence.\n",
    "status REL-006 position",
)
status = replace_once(
    status,
    "| Entry reliability | `REL-003` and `DATA-005` await compatible-production browser closure; `REL-002` is resolved, and PR #65 is the final merge gate for `REL-006`. |\n",
    "| Entry reliability | `REL-002` and `REL-006` are resolved. `REL-003` and `DATA-005` await compatible-production browser closure. |\n",
    "status entry blocker",
)
status = replace_once(
    status,
    "15. Complete PR #65 (`REL-006`) before automatic real R16 population.\n",
    "15. With `REL-002` and `REL-006` resolved, define the next approved integrity batch before automatic real R16 population.\n",
    "status immediate order",
)
status_path.write_text(status)

todo_path = Path("docs/build-todo.md")
todo = todo_path.read_text()
todo = replace_once(
    todo,
    "- [ ] **`REL-006`** — make first entry creation idempotent under concurrent tabs.\n",
    "- [x] **`REL-006`** — make first entry creation idempotent under concurrent tabs.\n",
    "todo REL-006 main",
)
todo = replace_once(
    todo,
    "  - [ ] Close issue #64 after PR #65 passes the final documentation head and merges to `main`.\n",
    "  - [x] Issue #64 closed after PR #65 passed final checks and merged to `main`.\n",
    "todo REL-006 closure",
)
todo_path.write_text(todo)

recon_path = Path("docs/quality/reconciliations/2026-07-24-entry-creation-idempotency.md")
recon = recon_path.read_text()
recon = replace_once(
    recon,
    "Keep `REL-006` open until the final pull-request head passes the guarded build, lint, complete Vitest suite, production dependency audit, Browser E2E and a ready Netlify preview, then merges to `main`.\n",
    "`REL-006` is resolved. Reopen it only if concurrent first-use requests can again create duplicates, surface a raw unique conflict or fail to converge on the shared entry.\n",
    "reconciliation closure boundary",
)
recon = replace_once(
    recon,
    "Functional head `c1ee4d727ad7235e350d5e6c7c79072857834e58` passed CI run `30130735751`, Browser E2E run `30130735710` and a ready Netlify deploy preview. The browser run rebuilt all committed migrations and seed data, released two coordinated first-use entry writes simultaneously, completed all established authenticated and recovery journeys, and cleaned up disposable data. Reconciliation commit `86d85330761c18a59195a50a6e08a7e422e4cf2f` then passed the guarded build, lint, complete Vitest suite and production dependency audit. This documentation-only owner commit triggers the standard CI, Browser E2E and Netlify gates on the final review head.\n",
    "Functional head `c1ee4d727ad7235e350d5e6c7c79072857834e58` passed CI run `30130735751`, Browser E2E run `30130735710` and a ready Netlify deploy preview. Final head `41853b5716764e953160e161a8dd4356bde1499b` passed CI run `30131321194`, Browser E2E run `30131321198` and the ready deploy preview, then PR #65 squash-merged as `cd517f6f0fba48aaf54c16ee444671db29bd2741` and issue #64 closed.\n",
    "reconciliation final validation",
)
recon_path.write_text(recon)

Path(".github/scripts/close-rel006.py").unlink()
