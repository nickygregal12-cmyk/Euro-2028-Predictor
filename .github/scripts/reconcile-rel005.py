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
    "**Entry creation idempotency:** [`reconciliations/2026-07-24-entry-creation-idempotency.md`](reconciliations/2026-07-24-entry-creation-idempotency.md)\n",
    "**Entry creation idempotency:** [`reconciliations/2026-07-24-entry-creation-idempotency.md`](reconciliations/2026-07-24-entry-creation-idempotency.md)  \n"
    "**Foreground refresh:** [`reconciliations/2026-07-24-foreground-refresh.md`](reconciliations/2026-07-24-foreground-refresh.md)\n",
    "risk evidence link",
)
risk = replace_once(
    risk,
    "| Resolved | PR #65 merged as `cd517f6f0fba48aaf54c16ee444671db29bd2741`; final CI run `30131321194`, Browser E2E run `30131321198` and the ready Netlify preview passed. This resolves `REL-006`. |\n",
    "| Resolved | PR #65 merged as `cd517f6f0fba48aaf54c16ee444671db29bd2741`; final CI run `30131321194`, Browser E2E run `30131321198` and the ready Netlify preview passed. This resolves `REL-006`. |\n"
    "| In progress | PR #68 implements `REL-005`; hook/provider tests and the guarded implementation run pass, with final Browser E2E, preview and merge evidence pending. |\n",
    "risk movement REL-005",
)
risk = replace_once(
    risk,
    "| `REL-005` | Open pages can remain convincingly stale | Open | Add and test realtime, polling or focus-refetch strategy. |\n",
    "| `REL-005` | Open pages can remain convincingly stale | **Implementation complete — PR #68 pending final gates** | A deduplicated hidden-to-visible refresh contract updates tournament and persisted-entry state without polling, waits for save settlement, preserves errors/conflicts and uses `REL-002` revisions to protect in-flight local edits. Focused tests pass; close only after final Browser E2E, preview and merge. |\n",
    "risk REL-005 row",
)
risk_path.write_text(risk)

status_path = Path("docs/quality/current-status.md")
status = status_path.read_text()
status = replace_once(
    status,
    "| Entry creation idempotency | [`2026-07-24-entry-creation-idempotency.md`](reconciliations/2026-07-24-entry-creation-idempotency.md) |\n",
    "| Entry creation idempotency | [`2026-07-24-entry-creation-idempotency.md`](reconciliations/2026-07-24-entry-creation-idempotency.md) |\n"
    "| Foreground refresh | [`2026-07-24-foreground-refresh.md`](reconciliations/2026-07-24-foreground-refresh.md) |\n",
    "status evidence link",
)
status = replace_once(
    status,
    "- `REL-006`: resolved by merged PR #65 and its final CI, concurrent-browser and preview evidence.\n",
    "- `REL-006`: resolved by merged PR #65 and its final CI, concurrent-browser and preview evidence.\n"
    "- `REL-005`: implementation and focused provider evidence pass on PR #68; final Browser E2E, preview and merge remain.\n",
    "status finding REL-005",
)
status = replace_once(
    status,
    "| Entry reliability | `REL-002` and `REL-006` are resolved. `REL-003` and `DATA-005` await compatible-production browser closure. |\n",
    "| Entry reliability | `REL-002` and `REL-006` are resolved. PR #68 is the final repository merge gate for `REL-005`; `REL-003` and `DATA-005` await compatible-production browser closure. |\n",
    "status reliability blocker",
)
status = replace_once(
    status,
    "| Test assurance | Dedicated disposable-local-Supabase Playwright coverage now includes authenticated routes, score persistence/clearing, submission barriers, bracket conflicts, lock rejection, signup confirmation, password recovery and coordinated concurrent first-entry creation. Private-league invitation/join, result administration, browser accessibility and production smoke journeys remain open. |\n",
    "| Test assurance | Dedicated disposable-local-Supabase Playwright coverage now includes authenticated routes, score persistence/clearing, submission barriers, bracket conflicts, lock rejection, signup confirmation, password recovery, coordinated concurrent first-entry creation and a two-page foreground-refresh lifecycle. Private-league invitation/join, result administration, browser accessibility and production smoke journeys remain open. |\n",
    "status test assurance",
)
status = replace_once(
    status,
    "15. With `REL-002` and `REL-006` resolved, define the next approved integrity batch before automatic real R16 population.\n",
    "15. Complete PR #68 (`REL-005`) before defining the next integrity batch or automatic real R16 population.\n",
    "status immediate order",
)
status_path.write_text(status)

todo_path = Path("docs/build-todo.md")
todo = todo_path.read_text()
todo = replace_once(
    todo,
    "  - [x] Issue #64 closed after PR #65 passed final checks and merged to `main`.\n- [ ] Complete wider tournament/reference immutability constraints.\n",
    "  - [x] Issue #64 closed after PR #65 passed final checks and merged to `main`.\n"
    "- [ ] **`REL-005`** — refresh convincingly stale open pages after a genuine background return.\n"
    "  - [x] Add one deduplicated hidden-to-visible foreground contract without polling.\n"
    "  - [x] Refresh tournament data without a loading flash and retain valid data on failure.\n"
    "  - [x] Flush/settle prediction writes before refreshing persisted entry slices.\n"
    "  - [x] Preserve failed/conflicted/local in-flight work through save barriers and `REL-002` revisions.\n"
    "  - [x] Add focused hook/provider tests and a two-page disposable-Supabase browser journey.\n"
    "  - [ ] Close issue #67 after PR #68 passes final checks and merges to `main`.\n"
    "- [ ] Complete wider tournament/reference immutability constraints.\n",
    "todo REL-005",
)
todo_path.write_text(todo)

recon_path = Path("docs/quality/reconciliations/2026-07-24-foreground-refresh.md")
recon = recon_path.read_text()
recon = replace_once(
    recon,
    "Pending implementation execution and final pull-request checks.\n",
    "Implementation head `8dac43c92b1757d12877e30603695d530b444fce` passed the guarded build, lint, complete Vitest suite and production dependency audit in CI run `30132387283`. This documentation reconciliation triggers the standard CI, Browser E2E and Netlify preview on the final review head.\n",
    "reconciliation validation",
)
recon_path.write_text(recon)

Path(".github/scripts/reconcile-rel005.py").unlink()
