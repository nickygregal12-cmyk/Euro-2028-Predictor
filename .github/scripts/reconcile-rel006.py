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
    "**Late-read overwrite guard:** [`reconciliations/2026-07-24-late-read-overwrite-guard.md`](reconciliations/2026-07-24-late-read-overwrite-guard.md)\n",
    "**Late-read overwrite guard:** [`reconciliations/2026-07-24-late-read-overwrite-guard.md`](reconciliations/2026-07-24-late-read-overwrite-guard.md)  \n"
    "**Sign-out confirmation:** [`reconciliations/2026-07-24-sign-out-confirmation.md`](reconciliations/2026-07-24-sign-out-confirmation.md)  \n"
    "**Entry creation idempotency:** [`reconciliations/2026-07-24-entry-creation-idempotency.md`](reconciliations/2026-07-24-entry-creation-idempotency.md)\n",
    "risk evidence links",
)
risk = replace_once(
    risk,
    "| High | 16 | 2 | 14 |\n| Medium | 19 | 4 | 15 |\n| Low | 16 | 5 | 11 |\n| **Total** | **57** | **12** | **45** |\n",
    "| High | 16 | 3 | 13 |\n| Medium | 19 | 4 | 15 |\n| Low | 16 | 6 | 10 |\n| **Total** | **57** | **14** | **43** |\n",
    "risk summary counts",
)
risk = replace_once(
    risk,
    "`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `DOC-005`, `TEST-002`, `DOC-001`, `TEST-003` and `DOC-006` are resolved.",
    "`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-003`, `REPO-002`, `DOC-004`, `DOC-005`, `TEST-002`, `DOC-001`, `TEST-003`, `DOC-006`, `REL-002` and `UX-004` are resolved.",
    "risk resolved list",
)
risk = replace_once(
    risk,
    "| Resolved | PR #50 merged as `2bfe5d6b06519cf26929ba49a57b5a5861644e14`; final head CI run 217 passed and issue #49 closed. This resolves `DOC-005`. |\n",
    "| Resolved | PR #50 merged as `2bfe5d6b06519cf26929ba49a57b5a5861644e14`; final head CI run 217 passed and issue #49 closed. This resolves `DOC-005`. |\n"
    "| Resolved | PR #63 merged as `f30ee8367116132c7c4b6a079bdba9371b27cf76` after final CI and Browser E2E passed. This resolves `REL-002`. |\n"
    "| Resolved | PR #43 merged as `620180b16113c6d7b877e266afbb1fbea537967f` after final CI, Browser E2E and Netlify preview passed. This resolves `UX-004`. |\n"
    "| In progress | PR #65 implements `REL-006`; service, unit, Browser E2E and preview evidence are green, with final documentation-head validation and merge pending. |\n",
    "risk movement rows",
)
risk = replace_once(
    risk,
    "| `REL-002` | Independent late reads can overwrite newer state | **Implementation in progress — issue #62** | Per-slice edit generations now guard initial prediction, tie, bracket and Golden Boot reads on the working branch. Keep open until the final head passes required checks and merges to `main`. |\n",
    "| `REL-002` | Independent late reads can overwrite newer state | **Resolved by PR #63** | Per-slice edit generations guard initial prediction, tie, bracket and Golden Boot reads; entry-context resets and delayed success/failure regressions passed final CI and Browser E2E before merge. Reopen on any stale-load overwrite regression. |\n",
    "risk REL-002",
)
risk = replace_once(
    risk,
    "| `REL-006` | Concurrent first-use requests can hit entry unique conflicts | Open | Replace/select-insert race with idempotent server boundary and test two-tab creation. |\n",
    "| `REL-006` | Concurrent first-use requests can hit entry unique conflicts | **Implementation complete — PR #65 pending merge** | Existing unique `(user_id, tournament_id)` authority now supports an insert-on-conflict/fallback-read boundary; focused service tests and a coordinated two-context disposable-Supabase race pass. Close only after the final documentation head is green and merged. |\n",
    "risk REL-006",
)
risk = replace_once(
    risk,
    "| `UX-004` | Sign-out is immediate | Open |\n",
    "| `UX-004` | Sign-out is immediate | **Resolved by PR #43** — destructive confirmation, pending-state protection, safe failure retry, unit regressions and established two-device Browser E2E journeys passed before merge. |\n",
    "risk UX-004",
)
risk_path.write_text(risk)

status_path = Path("docs/quality/current-status.md")
status = status_path.read_text()
status = replace_once(
    status,
    "| Late-read overwrite guard | [`2026-07-24-late-read-overwrite-guard.md`](reconciliations/2026-07-24-late-read-overwrite-guard.md) |\n",
    "| Late-read overwrite guard | [`2026-07-24-late-read-overwrite-guard.md`](reconciliations/2026-07-24-late-read-overwrite-guard.md) |\n"
    "| Sign-out confirmation | [`2026-07-24-sign-out-confirmation.md`](reconciliations/2026-07-24-sign-out-confirmation.md) |\n"
    "| Entry creation idempotency | [`2026-07-24-entry-creation-idempotency.md`](reconciliations/2026-07-24-entry-creation-idempotency.md) |\n",
    "status evidence links",
)
status = replace_once(
    status,
    "- `REL-002`: repository implementation is in progress on issue #62; current `main` remains open until final validation and merge.\n",
    "- `REL-002`: resolved by merged PR #63 and its final CI/Browser E2E evidence.\n"
    "- `UX-004`: resolved by merged PR #43 and its confirmation/retry/browser evidence.\n"
    "- `REL-006`: implementation and executable concurrent-browser proof pass on PR #65; final documentation-head validation and merge remain.\n",
    "status finding positions",
)
status = replace_once(
    status,
    "| Entry reliability | `REL-003` and `DATA-005` await compatible-production browser closure; issue #62 implements the repository guard for `REL-002`, while `REL-006` remains unimplemented. |\n",
    "| Entry reliability | `REL-003` and `DATA-005` await compatible-production browser closure; `REL-002` is resolved, and PR #65 is the final merge gate for `REL-006`. |\n",
    "status reliability blocker",
)
status = replace_once(
    status,
    "| Test assurance | Dedicated disposable-local-Supabase Playwright coverage now includes authenticated routes, score persistence/clearing, submission barriers, bracket conflicts, lock rejection, signup confirmation and password recovery. Private-league invitation/join, result administration, browser accessibility and production smoke journeys remain open. |\n",
    "| Test assurance | Dedicated disposable-local-Supabase Playwright coverage now includes authenticated routes, score persistence/clearing, submission barriers, bracket conflicts, lock rejection, signup confirmation, password recovery and coordinated concurrent first-entry creation. Private-league invitation/join, result administration, browser accessibility and production smoke journeys remain open. |\n",
    "status test assurance",
)
status = replace_once(
    status,
    "15. Complete issue #62 (`REL-002`), then address `REL-006`, before automatic real R16 population.\n",
    "15. Complete PR #65 (`REL-006`) before automatic real R16 population.\n",
    "status immediate order",
)
status_path.write_text(status)

todo_path = Path("docs/build-todo.md")
todo = todo_path.read_text()
todo = replace_once(
    todo,
    "- [ ] **`REL-002`** — prevent late best-effort reads from overwriting newer state.\n",
    "- [x] **`REL-002`** — prevent late best-effort reads from overwriting newer state.\n",
    "todo REL-002 main",
)
todo = replace_once(
    todo,
    "  - [ ] Close issue #62 after the final head is green and merged to `main`.\n- [ ] **`REL-006`** — make first entry creation idempotent under concurrent tabs.\n",
    "  - [x] Issue #62 closed after PR #63 passed final checks and merged to `main`.\n"
    "- [ ] **`REL-006`** — make first entry creation idempotent under concurrent tabs.\n"
    "  - [x] Replace the select-then-insert race with the existing unique-key insert-on-conflict boundary.\n"
    "  - [x] Add focused service regressions for winner, concurrent loser and genuine error paths.\n"
    "  - [x] Prove two independent browser contexts converge on one disposable-Supabase entry row.\n"
    "  - [ ] Close issue #64 after PR #65 passes the final documentation head and merges to `main`.\n",
    "todo REL closure",
)
todo_path.write_text(todo)

recon_path = Path("docs/quality/reconciliations/2026-07-24-entry-creation-idempotency.md")
recon = recon_path.read_text()
recon = replace_once(
    recon,
    "Pending final pull-request checks.\n",
    "Functional head `c1ee4d727ad7235e350d5e6c7c79072857834e58` passed CI run `30130735751`, Browser E2E run `30130735710` and a ready Netlify deploy preview. The browser run rebuilt all committed migrations and seed data, released two coordinated first-use entry writes simultaneously, completed all established authenticated and recovery journeys, and cleaned up disposable data. This documentation-only follow-up triggers the standard gates on the final review head.\n",
    "reconciliation validation",
)
recon_path.write_text(recon)

Path(".github/scripts/reconcile-rel006.py").unlink()
