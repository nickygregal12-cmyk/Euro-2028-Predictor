# Knockout bracket-tree integrity reconciliation

**Workstream:** `FUNC-001-KNOCKOUT-BRACKET-TREE-INTEGRITY`  
**Primary finding:** `FUNC-001`  
**Evidence boundary:** repository and disposable local Supabase/PostgreSQL only

This note records the repository position after adding full predicted bracket replay and real winner propagation. It does not rewrite the dated 23 July 2026 audits or silently change the historical risk register.

## Predicted entry contract

The database no longer accepts a predicted knockout bracket solely because it contains the expected progression-stage counts.

For a tournament with a configured knockout stage, submission now:

1. uses the persisted predicted group-position snapshots;
2. derives the six third-placed teams from saved group scores;
3. ranks them by points, goal difference, goals scored and wins;
4. applies only an exact-set saved third-place resolution;
5. rejects an unresolved tie that crosses the fourth/fifth qualification boundary;
6. applies the committed 15-combination third-place allocation table;
7. resolves all eight Round of 16 fixtures;
8. replays exactly one predicted winner through every R16, QF, SF and the final; and
9. requires all 15 knockout matches to resolve into one internally consistent tree.

A repeat submission is validated again. This matters because the existing product rule allows an entry to remain editable before tournament lock even after `submitted_at` has first been stamped.

Existing submitted entries are checked during migration. A submitted entry that cannot replay a valid bracket stops the migration for explicit remediation rather than being accepted through legacy stage counts.

Tournaments with no knockout fixtures retain their previous submission contract. Once any knockout fixture exists, the complete configured source tree is mandatory.

## Real result propagation

For winner-fed QF, SF and final slots:

- confirming or correcting an upstream result writes its authoritative `winner_team_id` into the matching `W-<match-ref>` child side;
- clearing the upstream result removes that propagated participant while the child remains scheduled;
- direct participant forgery is denied, including through the service role;
- an upstream winner cannot change while a downstream result remains confirmed or corrected; and
- the downstream result must be cleared first, preserving an explicit and auditable correction order.

The current source-tree check requires:

- eight R16 matches;
- four quarter-finals;
- two semi-finals;
- one final;
- each QF/SF/final source to reference the required preceding round; and
- every R16, QF and SF match to feed exactly one later fixture.

## Executable evidence

The disposable database workflow now proves:

- full migration rebuild and database lint;
- first and second R16 winner propagation into a QF;
- rejection of an upstream winner correction beneath a confirmed downstream result;
- successful clear-then-correct propagation;
- removal of a child participant after an upstream clear;
- denial of direct winner-fed participant writes;
- six complete predicted group tables and 24 persisted positions;
- best-third selection and eight predicted R16 fixtures;
- acceptance of a valid complete 15-match predicted tree;
- successful submission of that tree; and
- rejection of a hostile bracket that retains the old accepted stage counts but cannot represent a valid match-by-match path.

The existing group-order differential suite and all earlier entry/result lifecycle tests continue to pass in the same disposable run.

## Finding reconciliation

| Finding | Repository/local result | Remaining boundary |
| --- | --- | --- |
| `FUNC-001` — bracket progression can be internally inconsistent | Full predicted match-by-match replay and real winner-fed QF/SF/final propagation are implemented and executable locally | Hosted migration application and targeted finding-status review remain outstanding |
| `TEST-001` — no database or browser integration assurance | Further narrowed by executable predicted-tree, propagation and correction-order coverage | Browser E2E and hosted authenticated journeys remain open |
| `REL-004` — compound bracket writes are not atomic | No change to the client persistence path | A server transaction for replacing the complete predicted progression set remains open |
| `DATA-003` — incomplete same-tournament/reference constraints | Knockout sources and propagated participants are validated within this workflow | Wider immutable reference-data constraints remain open |

## Explicitly not included

This work does not provide:

- automatic population of the real R16 participants from confirmed group standings and the real best-third table;
- an atomic client RPC for replacing a user's complete bracket;
- a browser administration interface for result entry and correction;
- browser end-to-end tests;
- hosted migration or legacy-data verification; or
- any scoring-value change.

## Hosted boundary

No development or production Supabase project was linked, queried or modified. These migrations remain repository changes until an explicitly approved hosted rollout and remediation plan is executed. A failing preflight must not be bypassed.
