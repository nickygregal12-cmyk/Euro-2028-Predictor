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
    "| High | 16 | 3 | 13 |\n| Medium | 19 | 5 | 14 |\n| Low | 16 | 6 | 10 |\n| **Total** | **57** | **15** | **42** |\n",
    "| High | 16 | 3 | 13 |\n| Medium | 19 | 6 | 13 |\n| Low | 16 | 6 | 10 |\n| **Total** | **57** | **16** | **41** |\n",
    "risk summary counts",
)
risk = replace_once(
    risk,
    "`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `DOC-005`, `TEST-002`, `DOC-001`, `TEST-003`, `DOC-006`, `REL-002`, `REL-006` and `UX-004` are resolved.",
    "`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `DOC-005`, `TEST-002`, `DOC-001`, `TEST-003`, `DOC-006`, `REL-002`, `REL-005`, `REL-006` and `UX-004` are resolved.",
    "risk resolved list",
)
risk = replace_once(
    risk,
    "| In progress | PR #68 implements `REL-005`; hook/provider tests and the guarded implementation run pass, with final Browser E2E, preview and merge evidence pending. |\n",
    "| Resolved | PR #68 merged as `4b1c4d4ae4f944687a28f431b60698c110b83586`; final CI run `30133656106`, Browser E2E run `30133656077` and the ready Netlify preview passed. This resolves `REL-005`. |\n",
    "risk movement REL-005",
)
risk = replace_once(
    risk,
    "| `REL-005` | Open pages can remain convincingly stale | **Implementation complete — PR #68 pending final gates** | A deduplicated hidden-to-visible refresh contract updates tournament and persisted-entry state without polling, waits for save settlement, preserves errors/conflicts and uses `REL-002` revisions to protect in-flight local edits. Focused tests pass; close only after final Browser E2E, preview and merge. |\n",
    "| `REL-005` | Open pages can remain convincingly stale | **Resolved by PR #68** | A deduplicated hidden-to-visible refresh contract updates tournament and persisted-entry state without polling, waits for save settlement, preserves errors/conflicts and uses `REL-002` revisions to protect in-flight local edits. Focused tests and a two-page disposable-Supabase journey passed final CI and Browser E2E before merge. Reopen on any stale foreground-return regression. |\n",
    "risk REL-005 row",
)
risk_path.write_text(risk)

status_path = Path("docs/quality/current-status.md")
status = status_path.read_text()
status = replace_once(
    status,
    "- `REL-005`: implementation and focused provider evidence pass on PR #68; final Browser E2E, preview and merge remain.\n",
    "- `REL-005`: resolved by merged PR #68 and its final CI, two-page Browser E2E and preview evidence.\n",
    "status REL-005 finding",
)
status = replace_once(
    status,
    "| Entry reliability | `REL-002` and `REL-006` are resolved. PR #68 is the final repository merge gate for `REL-005`; `REL-003` and `DATA-005` await compatible-production browser closure. |\n",
    "| Entry reliability | `REL-002`, `REL-005` and `REL-006` are resolved. `REL-003` and `DATA-005` await compatible-production browser closure. |\n",
    "status reliability blocker",
)
status = replace_once(
    status,
    "15. Complete PR #68 (`REL-005`) before defining the next integrity batch or automatic real R16 population.\n",
    "15. With `REL-002`, `REL-005` and `REL-006` resolved, define the next approved integrity batch before automatic real R16 population.\n",
    "status immediate order",
)
status_path.write_text(status)

todo_path = Path("docs/build-todo.md")
todo = todo_path.read_text()
todo = replace_once(
    todo,
    "- [ ] **`REL-005`** — refresh convincingly stale open pages after a genuine background return.\n",
    "- [x] **`REL-005`** — refresh convincingly stale open pages after a genuine background return.\n",
    "todo REL-005 main",
)
todo = replace_once(
    todo,
    "  - [ ] Close issue #67 after PR #68 passes final checks and merges to `main`.\n",
    "  - [x] Issue #67 closed after PR #68 passed final checks and merged to `main`.\n",
    "todo REL-005 closure",
)
todo_path.write_text(todo)

recon_path = Path("docs/quality/reconciliations/2026-07-24-foreground-refresh.md")
recon = recon_path.read_text()
recon = replace_once(
    recon,
    "Keep `REL-005` open until the final pull-request head passes the guarded build, lint, complete Vitest suite, production dependency audit, Browser E2E and a ready Netlify preview, then merges to `main`.\n",
    "`REL-005` is resolved. Reopen it only if a genuine foreground return can again leave valid tournament or persisted-entry data convincingly stale, overwrite unsettled/conflicted local work or introduce duplicate refreshes.\n",
    "reconciliation closure boundary",
)
recon = replace_once(
    recon,
    "Implementation head `8dac43c92b1757d12877e30603695d530b444fce` passed the guarded build, lint, complete Vitest suite and production dependency audit in CI run `30132387283`. Reconciled head `7ac9128ef7033571ec6b8412adf9b3608cdb2528` passed the same guarded application gates in CI run `30132609768`. This documentation-only owner commit triggers standard CI, Browser E2E and Netlify validation on the final review head.\n",
    "Implementation head `8dac43c92b1757d12877e30603695d530b444fce` passed the guarded build, lint, complete Vitest suite and production dependency audit in CI run `30132387283`. Final head `1660fe42a9cb3a5111bb21eb809879c9586665f3` passed CI run `30133656106`, Browser E2E run `30133656077` and the ready Netlify preview. The browser suite proved a hidden page adopted a second page's persisted score after returning, completed all established authenticated and recovery journeys, and cleaned up disposable data. PR #68 then squash-merged as `4b1c4d4ae4f944687a28f431b60698c110b83586` and issue #67 closed.\n",
    "reconciliation final validation",
)
recon_path.write_text(recon)

Path(".github/scripts/close-rel005.py").unlink()
