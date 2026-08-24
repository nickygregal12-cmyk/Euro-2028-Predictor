# Synthetic journey probe

**Operational reference.** How the acquisition journey is walked, what the record
means, and what the probe deliberately cannot see.

## What it walks

`scripts/journey-probe/checks.mjs` describes the journey a **new player** takes,
as steps a person does rather than requests a server answers:

1. A stranger opens the site for the first time.
2. They follow an invitation somebody sent them.
3. The invitation gives away no private league.
4. A search engine is told not to index invitations.

Steps 2–4 are the disclosure shape the invite document was built to hold: a
rewrite that silently reverted to serving `index.html` would still answer `200`
and still look like the application, so the probe checks for the invite
document's own markers rather than for a status code.

## What it deliberately cannot see

**It carries no credential, and that is a limit rather than an oversight.**
Production answers `401` to every anonymous request —
`.github/workflows/production-anonymous-smoke.yml` asserts exactly that and fails
if it changes. A journey there therefore needs the site password, which is an
explicit operator action in `production-smoke.yml` and not something a scheduled
job should hold.

So the probe runs against an origin where the journey can actually be walked, and
**names that origin in the record**. Pointing it at a password-protected origin
would report a journey nobody can take as a broken product, which is a wrong
answer stated confidently. The workflow refuses to guess: with no origin
configured it fails with the exact variable to set.

## What it does not replace

| Already covered, elsewhere | By |
| --- | --- |
| DNS, TLS, the password perimeter | `production-anonymous-smoke.yml`, every six hours |
| Headers, CSP parity, release identity, route status | `scripts/production-smoke.mjs` |
| A password-bearing production check | `scripts/production-health.mjs`, operator-invoked |

None of those walks anybody through anything, which is the gap this fills.

## Running it

```sh
node scripts/journey-probe/run.mjs --origin https://deploy-preview-1--example.netlify.app
node scripts/journey-probe/run.mjs --origin <origin> --write <path>
```

It exits non-zero when the journey is broken. Transport failures are retried
three times; findings are not retried at all — the same rule
`production-smoke.mjs` arrived at, because a red that means nothing teaches
people to ignore red.

## The record and the page

`config/journey-probe-record.json` holds the most recent **published** run: when,
which origin, each step's outcome, and a reason for anything that failed. It
carries **no player data** — there is none in it to carry.

**The record publishes itself, under guard.** The workflow is two jobs, and the
split is the security boundary:

- `walk` touches the network and holds **no** write access and no push
  credential. It writes its record to the runner's temporary directory and
  uploads it as an artifact.
- `publish` holds `contents: write` and makes **no network request of its own**.
  It takes the artifact the first job produced and commits it to `main`.

Neither job can both fetch a remote document and push to the default branch,
which is the combination worth denying.

### What the publisher refuses to do

- **It will not commit anything but the record.** Before committing it asserts
  that nothing else in the workspace is modified, and stops if anything is.
- **It will not fill the history with runs that say nothing new.**
  `scripts/journey-probe/publishDecision.mjs` decides, and it is a pure function
  with its own tests. It publishes when the *answer* changes — including a
  recovery, and including the same failure for a different reason — and
  otherwise no more than once a day.

  Both naive rules are wrong and both are tested as such. Committing every run
  gives four commits a day that differ only in a timestamp. Committing only on
  change makes a stopped probe look exactly like a stable system, which is the
  failure this whole stage exists to avoid.
- **It will not report a run it did not make.** The summary is gated on the walk
  having run, and the record is read from the runner's temp rather than the
  tracked file, which exists the moment checkout finishes.
- **It publishes a BROKEN journey too.** The publish job runs on `always()`,
  because a publisher that only ran on success would hold the page green through
  an outage.

`/status` renders that record, built by the `euro28-status-document` plugin the
same way the invite document is built. Three rules govern it, and they are
asserted in `tests/app/statusDocument.test.ts`:

- **it never claims to be live** — it is published with the next deploy, so it
  describes the moment the record names and no other;
- **it never says anything about the competition** — not whether predictions are
  open, not a deadline, not a score. Reliability instrumentation must never
  become a lock or scoring authority, and a status page is where that line gets
  crossed by accident;
- **it carries no player data.**

It is dark-only on purpose: the application's tokens switch on an attribute the
theme provider sets from a stored choice, which a static document cannot read, so
it takes the `:root` values — which is also what a first-time visitor sees.
