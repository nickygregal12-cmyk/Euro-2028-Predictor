# Operator announcement banner

A short service message the operator can put in front of players — "results for
matchweek 3 are delayed", "maintenance at 21:00", "we know the leaderboard is
wrong and are fixing it" — and take back down.

## Why this is not in the database

The obvious design is a table plus an admin panel. It was measured and rejected
on two grounds, the first decisive.

**`TYPE-001` would ship it blocked.** `src/services/supabase/database.types.ts`
is generated from hosted Development, and every call from `src/` is typechecked
against it. A new table or RPC is a hard compile error until those types are
regenerated — verified by compiling `db.rpc('a_function_that_does_not_exist')`
and `db.from('a_table_that_does_not_exist')`, both of which fail. Development
trails the repository, and regenerating needs a credential no agent session
holds. A database-backed banner would therefore land exactly where stage 2's
account switch is: merged, correct, and unusable. One stage blocked on that
credential is a fact to report; two would be a choice.

**A banner in the database cannot be shown when the database is down.** That is
the outage most worth announcing. Publishing from the repository inverts the
dependency: the message is in the bundle, so it survives precisely the failure
it exists to describe. The cost is honest and worth stating — publishing takes a
build and deploy rather than being instant.

## Shape

`config/operator-announcement.json` holds one record. Empty is the normal state.

```json
{ "message": null, "level": null, "publishedAt": null, "expiresAt": null }
```

The operator publishes and withdraws through
`.github/workflows/operator-announcement.yml`, a `workflow_dispatch` with the
same guarded commit step the journey probe uses: it writes one file, refuses to
push if anything else in the workspace is modified, and rebases rather than
forcing when `main` has moved. This repository already operates this way —
`netlify-production-publish-dispatch-once.yml` and the rollout lanes are all
dispatches — so the control is idiomatic rather than novel, and git history
becomes the audit trail for free.

## Rules the implementation must keep

**Text, never markup.** The message is rendered as text content. An operator
announcement is the one string on the page written outside the codebase, and it
must not be able to introduce an element, a link or a script.

**Time-boxed and self-removing.** Every announcement carries an expiry, and an
expired one does not render. This matches the decided design-system idiom for
the matchday recap card. A banner nobody remembers to take down is how a
maintenance notice ends up greeting players a week later.

**Bounded.** A message longer than the cap does not render at all rather than
being truncated mid-sentence into something that reads differently from what was
written. Length is checked where the record is parsed, not where it is drawn.

**Absent by default, and absent on anything malformed.** A missing file, a null
message, an unparseable date or an unknown level renders nothing. The failure
mode of a broken announcement record is silence, never a broken page and never a
half-rendered message.

**Withdrawal is a real operation.** Clearing the record must be as easy as
publishing, and must not require editing JSON by hand.

## Deliberately not in this stage

- **Per-viewer dismissal.** It needs somewhere to remember the dismissal, and
  the expiry already solves the problem it would solve.
- **Targeting** — by competition, by league, by cohort. There is one product
  voice and one banner; segmentation is a product decision nobody has asked for.
- **A database-backed path**, for the reasons above. If the type regeneration
  ever lands, this record is small enough to move and the decision can be
  revisited on its merits rather than on a blocker.

## Acceptance

- With the empty record, nothing renders and nothing changes.
- A published, unexpired message renders once, as text, at the chosen level.
- An expired message renders nothing.
- A malformed record renders nothing rather than throwing.
- An over-long message renders nothing.
- Markup in the message reaches the page as characters, not as elements.
- The workflow commits only the announcement file, and refuses if anything else
  is modified.
