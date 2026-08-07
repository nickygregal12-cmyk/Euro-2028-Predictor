# Production backup authority repair

**Status date:** 6 August 2026  
**Status:** Authority routing implemented; exact-head validation pending  
**Scope:** Ensure a production backup validates the hosted Production source rather than the repository migration tip.

## Defect found

`.github/workflows/production-backup.yml` runs `scripts/deployment-contract-expectations.mjs` before restoring the dump. That command previously always derived its expectation from `config/deployment-contract.json` and the complete migration directory.

At the current boundary those values are contract 125, while hosted Production is contract 63. A fresh production backup would therefore restore the correct contract-63 dump and then reject it for not containing 125 migrations.

This is a verification-authority defect, not a production database defect. No backup was run and no hosted state changed while finding or repairing it.

## Repair implemented

The branch now contains:

- `config/production-hosted-contract.json` — the independently verified hosted Production record;
- `scripts/production-hosted-contract-expectations.mjs` — derives the exact hosted boundary from that record and verifies it against the canonical migration chain;
- `tests/scripts/productionHostedContractExpectations.test.ts` — proves the reader selects the hosted boundary rather than the repository tip and fails closed on count/name drift or an authorised-promotion claim;
- `tests/scripts/productionBackupExpectationRouting.test.ts` — proves only the workflow named `Production backup` is routed to hosted Production while other guards remain on the repository deployment contract;
- `tsconfig.gates.json` coverage for both production-gate scripts.

The existing workflow command is intentionally retained. When GitHub sets `GITHUB_WORKFLOW=Production backup`, `deployment-contract-expectations.mjs` now emits:

```text
EXPECTED_PROJECT_REF=vkfnsqdyhvtwyqkisxhk
EXPECTED_MIGRATION_COUNT=63
EXPECTED_LATEST_MIGRATION_VERSION=20260729154931
EXPECTED_LATEST_MIGRATION_NAME=prediction_consensus_minimum_cohort
```

For every other caller it continues to emit the repository deployment-contract boundary. The routing produces a preformatted environment payload rather than carrying a union of incompatible formatter function signatures through the checked-JavaScript gate.

## Gate

Do not trigger `Production backup` until:

1. exact-head CI and the Netlify preview build pass the new typecheck and tests;
2. the two required secrets are confirmed by workflow preflight without exposing their values;
3. the restored dump verifies at contract 63;
4. the encrypted artifact is retained under the existing custody procedure;
5. only then is the contract 64–67 forward rehearsal performed against a disposable restored target.

No production promotion is authorised by this repair.
