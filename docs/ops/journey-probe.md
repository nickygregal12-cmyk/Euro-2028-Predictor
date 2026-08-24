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

**Publishing is deliberate, and the workflow cannot do it.** The scheduled job
holds read-only permissions and no push credential: it writes its record to the
runner's temporary directory, prints it to the job summary and uploads it as an
artifact. Nothing carries that into the repository, so `/status` shows the last
record somebody committed.

That is a choice rather than an omission. Granting a scheduled job write access
to the repository is an operator decision — `OPS-010` is the open row about a
verified record failing to reach `main`, and this stage did not want to add a
second way for that to matter. **Until a record is committed, `/status` honestly
says no check has been recorded yet.** To publish one, commit the artifact's
contents to `config/journey-probe-record.json` in a pull request.

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
