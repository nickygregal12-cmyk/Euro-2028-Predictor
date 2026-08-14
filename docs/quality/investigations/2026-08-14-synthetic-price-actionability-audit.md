# Synthetic price actionability — hosted audit

**14 August 2026. Read-only audit.**

This is the closing check for the AI hardening requirement that a `BET` must
name a price a real venue can actually accept. `AVG` and `MAX` remain useful
market references, but they are derived aggregates and therefore cannot be the
bookmaker attached to an actionable selection.

No database row was inserted, updated or deleted by this audit.

## Registry authority

Production `ai.bookmakers` states:

| code | name | kind | is_real_price |
| --- | --- | --- | --- |
| `AVG` | Market average | aggregate | false |
| `MAX` | Market maximum | aggregate | false |

The registry is therefore unambiguous: neither code is an actionable venue.

## Development

Read-only counts over `ai.bets` and `ai.recommendations` returned:

- `ai.bets`: **0** rows;
- `ai.bets` with bookmaker `AVG`/`MAX`: **0**;
- `ai.recommendations` with `decision='BET'`: **0**;
- `ai.recommendations` with `decision='BET'` and bookmaker `AVG`/`MAX`: **0**.

Development therefore currently satisfies the hosted-row end condition.

## Production

The same read-only audit returned:

- `ai.bets`: **49** rows;
- `ai.bets` with bookmaker `AVG`/`MAX`: **49**;
- all 49 are `bookmaker='MAX'`, `is_paper=true`, `status='advised'`;
- real-money aggregate rows: **0**;
- first created: `2026-08-13 11:21:19.831493+00`;
- last created: `2026-08-13 11:21:39.477802+00`;
- fixture kickoffs represented: `2026-08-14 19:00:00+00` through
  `2026-08-23 15:30:00+00`;
- `ai.recommendations` currently contains **0** rows with `decision='BET'`.

Contract 189's `ai.valid_bets` removes bets whose originating prediction has
been quarantined. Of these 49 synthetic advised rows:

- **35** are already outside `ai.valid_bets` because their predictions are
  quarantined;
- **14** remain inside `ai.valid_bets` and therefore still count as valid/open
  betting evidence unless another gate excludes them.

The 14 valid synthetic rows are distributed as follows:

| league | all advised MAX rows | still in `ai.valid_bets` |
| --- | ---: | ---: |
| ECH | 12 | 2 |
| EL1 | 12 | 1 |
| EL2 | 12 | 2 |
| EPL | 8 | 5 |
| SPL | 5 | 4 |
| **total** | **49** | **14** |

## Source-path diagnosis

The repository explains the result rather than leaving it as a database
mystery:

- `find_value.py` still defaults `DEFAULT_BOOK = "MAX"`;
- it passes that book into `Candidate(..., is_paper=not args.real_money)`;
- the common value gate currently allows a non-actionable registry code to
  survive when the candidate is paper-only;
- a surviving recommendation is then inserted into `ai.bets` with that
  bookmaker code.

The database's historical allowance for aggregate paper rows prevented a
real-money violation, but it does not make a synthetic `MAX` price actionable.
The hardening invariant is intentionally stronger: paper mode changes whether
money is at risk; it does not turn a derived number into a venue.

## Verdict

**FAIL — Production does not satisfy the “no actionable BET uses AVG/MAX” end
condition.** Development does. Production has no real-money aggregate bets, but
14 currently valid advised paper selections still name `MAX`, and 35 further
rows are retained as quarantined historical evidence.

This is a **pre-promotion blocker**. It is not repaired by deleting or rewriting
history: those rows are evidence of what the pipeline did. The source gate must
first stop a synthetic registry code from receiving `BET` in every run mode;
then the existing 49 records can be handled through the repository's explicit
void/quarantine lifecycle without falsifying the audit trail.

A direct source change to the common value gate was attempted during this
hardening session and rejected by the repository write-safety interface. No
adjacent workaround was used: the scheduled job was not disabled, a different
default bookmaker was not substituted merely to hide the bug, and the hosted
rows were not edited through Supabase to manufacture a passing count.

## Consequence for the final hardening sequence

The model-selection evidence remains independent of this issue. The selected
challenger policy is fixed and reproducible, but challenger promotion and
post-promotion forecast/value regeneration must remain downstream of this
integrity gate. Running new value selection before it is fixed could create more
synthetic action rows and would therefore make the audit worse, not complete it.
