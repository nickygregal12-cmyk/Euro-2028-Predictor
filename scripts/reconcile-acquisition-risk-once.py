from __future__ import annotations

from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'docs' / 'quality' / 'acquisition-risk-register.md'
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    '**Scope:** Risks derived from the acquisition technical audit and reconciled as forward platform work.  \n**Status rule:** A risk closes only when implementation and verification evidence exist; planning text alone does not mitigate it.',
    '**Scope:** Risks derived from the acquisition technical audit and reconciled as forward platform work.  \n**Last reconciled:** 5 August 2026 against merged repository evidence. Moving repository, hosted-database and Netlify contract values remain in [`current-status.md`](current-status.md), the live [`risk-register.md`](risk-register.md) and machine records rather than being copied here.  \n**Status rule:** A risk closes only when implementation and verification evidence exist; planning text alone does not mitigate it.',
    'register authority header',
)

replace_once(
    '| ACQ-R05 | Complete entries may remain unsubmitted at lock and score zero. | Idempotent auto-submit job using authoritative completeness rules; user notification. | In progress — idempotent database-scheduled auto-submit with immutable outcomes is deployed through contract 41; user notification/email remains pending Auth/SMTP ownership. |',
    '| ACQ-R05 | Complete entries may remain unsubmitted at lock and score zero. | Idempotent auto-submit job using authoritative completeness rules; user notification. | In progress — idempotent database-scheduled auto-submit with immutable outcomes is implemented and production-hosted through the fixed Euro baseline. The remaining mitigation is the reminder/notification delivery itself: the accepted product rule is one hour before lock for an incomplete entry, but no scheduled in-app/email reminder authority is implemented. This is not blocked on password-recovery SMTP ownership. |',
    'ACQ-R05',
)

replace_once(
    '| ACQ-R11 | No accepted background-job tier supports scoring, submission, reconciliation and lifecycle work. | Establish `pg_cron`/Edge Function responsibilities with idempotency and observability. | In progress — a `pg_cron` tier carries the idempotent submission job; scoring, reconciliation/lifecycle jobs and failure observability remain only where later evidence justifies them. |',
    '| ACQ-R11 | No accepted background-job tier supports scoring, submission, reconciliation and lifecycle work. | Establish `pg_cron`/Edge Function responsibilities with idempotency and observability. | In progress — the database-scheduled tier now carries Original auto-submit, recurring season Match Predictor lock processing and correction-aware season LMS settlement/replay. The LMS wipeout restart is a separate idempotent lifecycle command rather than a cron side effect, and provider work has a server-only Edge Function custody/strict-decode boundary without a live rehearsal. Incremental scoring drain, maintained-standings reconciliation, reminders and cross-job failure/delay observability remain open. |',
    'ACQ-R11',
)

replace_once(
    '| ACQ-R13 | Large-scale behaviour at lock and result peaks is not evidenced. | Representative seeded load tests, connection-pool budget and rehearsed thresholds. | In progress — separate rollback-only hosted tranches cover 250 submitted entries and a 250-member private league, including query plans, payload sizes, full cursor traversal and recomputation. Connection-pool/concurrent peak testing and full-result-volume evidence remain. |',
    '| ACQ-R13 | Large-scale behaviour at lock and result peaks is not evidenced. | Representative seeded load tests, connection-pool budget and rehearsed thresholds. | In progress — rollback-only hosted tranches cover 250 submitted entries and a 250-member private league, including plans, payloads and full cursor traversal. Full group-stage and full-tournament result volume, WAL/bloat, knockout cascade and six-concurrent-reader evidence are also recorded under ACQ-R03. What remains is a genuine peak write/concurrent-user rehearsal, a connection-pool budget, autovacuum behaviour at realistic spacing and explicit go/no-go thresholds. |',
    'ACQ-R13',
)

old_foundations = '''## Completed repository foundations

- Manual encrypted, restore-rehearsed production-backup workflow merged and first-run verified (green run `30264080847`, disposable restore passed, off-GitHub encrypted custody — `reconciliations/2026-07-27-production-backup-workflow.md`).
- Protected administrator routes with complete result and qualification mutation workflows, revision history, Browser E2E and a narrow production results capability.
- Contracts 39–44 are production-hosted: actual Round-of-16 population, third-place boundary resolution, automatic valid-entry submission, bounded reads, paginated overall standings and operating-cap enforcement.
- Contracts 45–46 are development-hosted in draft PR #138: paginated private-league standings, independent caller context, owner-only transfer search and lightweight activity summaries.
- Rollback-only hosted evidence covers both 250-entry non-league reads/recomputation and complete 250-member private-league traversal without retained synthetic data.

No separate `ACQ` row covers operating-cap enforcement; its residual peak/concurrency evidence remains tracked under `ACQ-R13`.
'''
new_foundations = '''## Completed repository foundations

These are durable controls, not a second hosted-status table. Exact repository, Development, Production and Netlify levels are read from the live authorities named at the top of this register.

- Manual encrypted, restore-rehearsed production backup with off-GitHub encrypted custody and a disposable restore proof.
- Protected administrator result/qualification routes, server-owned capabilities, immutable revisions, audit evidence and authorised/unauthorised browser journeys.
- The fixed Euro production baseline includes automatic valid-entry submission, bounded/paginated overall and private-league standings, independent current-user context and operating-cap enforcement.
- Direct Data API exposure, security-definer execution, schema/enum freshness, trigger bindings, migration inventory and environment-target compatibility are executable repository guards rather than review notes.
- Rollback-only evidence covers 250-entry non-league reads/recomputation, complete 250-member private-league traversal, full group/tournament result volume, WAL/bloat, knockout cascade and concurrent-reader behaviour without retained synthetic data.
- The multi-competition/season backend now includes game-owned locks, recurring Match Predictor processing, LMS settlement/replay and restart transition, Championship split persistence/derived standings and provider-response custody; incomplete product surfaces do not close unrelated acquisition risks.

No separate `ACQ` row covers operating-cap enforcement; its residual peak/concurrency evidence remains tracked under `ACQ-R13`.
'''
replace_once(old_foundations, new_foundations, 'completed foundations')

for stale in (
    'user notification/email remains pending Auth/SMTP ownership',
    'a `pg_cron` tier carries the idempotent submission job; scoring, reconciliation/lifecycle jobs',
    'Connection-pool/concurrent peak testing and full-result-volume evidence remain',
    'Contracts 45–46 are development-hosted in draft PR #138',
):
    if stale in text:
        raise RuntimeError(f'stale acquisition-risk statement survived: {stale}')

for required in (
    '**Last reconciled:** 5 August 2026',
    'no scheduled in-app/email reminder authority is implemented',
    'recurring season Match Predictor lock processing',
    'Full group-stage and full-tournament result volume',
    'These are durable controls, not a second hosted-status table.',
):
    if required not in text:
        raise RuntimeError(f'missing acquisition-risk reconciliation guard: {required}')

# Do not silently re-rate the risks not in this batch.
for untouched in (
    '| ACQ-R09 | Password, breach screening and anti-bot controls are insufficiently fail-closed for launch.',
    '| ACQ-R10 | League invite generation/probing can support enumeration.',
    '| ACQ-R12 | No product analytics supports funnel or retention decisions.',
    '| ACQ-R24 | Score values lack a practical upper bound.',
):
    if untouched not in text:
        raise RuntimeError(f'untouched risk disappeared: {untouched}')

path.write_text(text, encoding='utf-8')
print('Reconciled acquisition risk evidence without re-rating unresolved risks')
