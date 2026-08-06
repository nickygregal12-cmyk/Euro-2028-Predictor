# Keeping the documents that describe current state current

**Authority:** `config/documentation-authorities.json` is the manifest.
`scripts/check-documentation-authorities.mjs` enforces it, and
`tests/scripts/documentationAuthorities.test.ts` tests the enforcement.

## The problem, measured

Every contract that merges makes some documents stale that had no reason to be
touched by it. On 5 August 2026, with the repository at contract 109, **ten of
the live-authority documents named 107 or older as their newest contract**. Not
one of them was wrong when it was written.

The cost was being paid afterwards, by separate reconciliation pull requests
that had to rediscover what had drifted — and those had their own problem. The
guards they left behind were written one per contract, asserting literal
phrases, and two of them failed on prose rather than content:

- one could not see `Contract 108` because the line wrapped between the word and
  the number;
- another could not see contract 109 inside `Contract 107–109`.

A guard that forces the writing to get worse in order to pass is a guard that
gets worked around. And a guard added per contract is a cost that grows with
every contract, which is the opposite of what a control should do.

## What replaces it

Two rules, neither of which is a phrase.

### Freshness

A document that names contract numbers must name the **current** one as its
highest. Naming none is always fine — a document that states no numbers cannot
be stale about them, which is already the roadmap's stated preference for
itself.

Numbers are read the way they are written: across a line wrap, in a range
(`Contract 107–109` names both), in the plural, and with a hyphen. Ordinary
numbers are not mistaken for contracts.

### The sweep

**A change that adds a migration must also touch every document marked `sweep`
in the manifest.** This is the half that prevents the drift instead of
reporting it later. It runs on pull requests, where a base and head exist.

If one of those documents genuinely has nothing to say about a particular
contract, say so in it. A one-line "no change for this contract" is a fact worth
recording; silence is indistinguishable from an oversight, which is the whole
problem.

## The three classifications

| Kind | Rule | Why |
| --- | --- | --- |
| `live` | newest named contract must be the current one | It describes current state, so being overtaken makes it wrong |
| `dispositions` | may name any contract that exists; must not name one that does not | A risk or decision register names the contract that resolved an entry. It has nothing to say about a contract that closed nothing, and forcing it to name one would make it lie |
| `structural` | exempt here | Held in step by a stronger check against a real database — see `tests/database-parity/stageCTriggerBindingCoverage.test.ts` |

Dated evidence — audits, investigations, reconciliations, automation runs,
nightly reports — is exempt **by classification, in `evidenceDirectories`**,
rather than by being forgotten. Those documents are snapshots and must keep
saying what was true when they were written. The manifest test refuses to let a
path be both evidence and an authority.

## Adding a document

Add it to `authorities` with a `kind`, a `sweep` flag and a `why`. The `why` is
required and tested for: a manifest entry without a reason is how a control
becomes a ritual.

Set `sweep: true` only if the document genuinely needs revisiting on **every**
contract. Marking everything would train people to add a meaningless line to
pass the gate, which is worse than not having it.

## Running it

```bash
npm run check:documentation-authorities                 # freshness only
node scripts/check-documentation-authorities.mjs A B    # freshness and sweep
```

CI runs the first form on pushes and the second on pull requests.

## Safeguards for agent-readable documentation

Added 6 August 2026. The two mechanical rules above stop documents going stale about contract numbers. They do not stop the larger failure, which an audit measured rather than guessed: **current facts and historical narrative interleaved in the same file, so an agent searching for a phrase lands in a paragraph that was true in July and treats it as true now.**

These ten safeguards are the written rules. Some are enforceable and enforced; most are not, and saying which is which is more useful than pretending otherwise.

| ID | Requirement | Enforcement |
| --- | --- | --- |
| `DOC-AI-001` | Every important fact has **one authoritative home**. Supporting files may link to it; they must not restate a moving fact. | Convention |
| `DOC-AI-002` | Every active authority declares its authority class, status, scope, exclusions, last verification date, supersession position and implementation evidence — the control block below. | Convention |
| `DOC-AI-003` | **No planning statement may be described as implemented without merged code, a migration, an executable test or verified hosted evidence**, named. | Convention; `tests/scripts/adrStatusFreshness.test.ts` enforces the ADR-status half |
| `DOC-AI-004` | **No open pull request or branch is repository truth.** Proposed work is labelled proposed, and concurrent ownership is checked before editing a file. | Convention |
| `DOC-AI-005` | **No material statement disappears during cleanup.** It is retained, moved with a traceable link, superseded explicitly, rejected with a recorded reason, or deferred with a stable identifier. | Convention; a reconciliation states the disposition of every statement it moves |
| `DOC-AI-006` | Dated audits, investigations, reconciliations, automation reports and historical roadmaps **remain historical evidence** and are not rewritten to resemble current truth. | `evidenceDirectories` in the manifest; the manifest test refuses a path that is both evidence and an authority |
| `DOC-AI-007` | Contract numbers, hosted-state values and moving commit facts belong **only** in the live-status and machine-readable authorities. | `scripts/check-documentation-authorities.mjs` freshness rule |
| `DOC-AI-008` | Accepted but unimplemented decisions appear in a planning authority with **a stable identifier and acceptance evidence**. | [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) is the register |
| `DOC-AI-009` | Documentation cleanup reduces **duplicated authority**, never product scope or a deferred requirement. | Convention; `DOC-AI-005` is how it is checked |
| `DOC-AI-010` | An external audit or reference document supplied for a reconciliation **is not committed** as a repository document. Its supported facts are integrated into their existing authorities. | Convention |

### The control block

An active authority carries this near the top. It is for agents: it answers "what does this file decide, what does it not decide, and is it still true?" without reading the file.

```md
| Field | Value |
| --- | --- |
| Authority | Primary / Supporting / Historical |
| Status | Active / Partially implemented / Blocked / Superseded |
| Last verified | YYYY-MM-DD |
| Governs | Exact subject owned by this file |
| Does not govern | Subjects owned elsewhere |
| Supersedes | Prior authority or `None` |
| Superseded by | Later authority or `None` |
| Related work | Issues and open PRs |
| Implementation truth | Code, migration, tests or hosted authority |
```

Where a consistent body order helps, use: `Current decision`, `Implemented position`, `Remaining work`, `Explicitly not implemented`, `Dependencies and blockers`, `Concurrent work`, `Evidence`, `Supersession and history`.

**Do not apply either shape to dated evidence.** A historical record forced into a current-authority format stops looking historical, which is exactly what `DOC-AI-006` exists to prevent. The block is being added to active authorities as they are next touched, rather than in one sweep — a mechanical pass over every document would be a large diff that changes no fact and reviews as noise.
