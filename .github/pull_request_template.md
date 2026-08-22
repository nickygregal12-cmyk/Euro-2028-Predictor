<!--
Every session — human or agent — answers the same five questions. Keep answers
short; the value is that they exist at all. Do not restate moving contract
numbers anywhere except the migration claim line: the live authorities own
those values (config/deployment-contract.json, docs/quality/current-status.md).
-->

## What changed, and under which authority

<!-- The roadmap item, audit finding, ADR or defect this serves — one or two
sentences. If no authority governs it, say so and why it is safe anyway. -->

## Migration / contract claim

<!-- "None" for most PRs. If this PR adds a migration, state the contract
number it claims and confirm it was checked against BOTH current main AND every
open migration PR at time of writing — duplicate claims have already made a PR
unmergeable once. One active migration branch at a time. -->

None.

## Overlap with open pull requests

<!-- Which open PRs were checked, and which files were deliberately avoided or
knowingly shared. "None open" or "Checked #NNN; no shared files" is enough. -->

## Hosted impact

<!-- "None" unless this PR is meant to change a hosted environment. A green
repository check is not evidence a hosted environment changed; hosted claims
need target-specific evidence, and production is promoted only as a separately
approved milestone. -->

None. Repository-only; no development or production mutation.

## Navigation evidence

<!-- Required for broad/cross-layer changes; "Not needed" for a bounded edit.
Name the method used: Graphify / Serena / repository search. A generated graph
narrows inspection but is not implementation or hosted-state evidence. When a
persistent Graphify snapshot was used, record its input fingerprint as well as
its source SHA so a source-SHA mismatch caused only by unrelated commits is not
mistaken for stale code navigation. -->

- Method: Not needed.
- Graph source SHA: Not applicable.
- Graph input fingerprint: Not applicable.
- Key paths or symbols: Not applicable.
- Why not used: Bounded change; remove this line when navigation evidence exists.

## Verification

<!-- What actually ran, with results. Delete lines that do not apply; name any
suite that could not run here (e.g. Docker-gated database parity) rather than
leaving it ambiguous. -->

- [ ] `npx oxlint --deny-warnings`
- [ ] `npx tsc -b`
- [ ] Full Vitest suite (state passed/skipped counts)
- [ ] `npm run build`
- [ ] Browser E2E / database parity, where the change class requires them
