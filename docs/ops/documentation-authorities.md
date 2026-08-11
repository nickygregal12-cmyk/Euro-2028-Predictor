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

### Coverage

Added 11 August 2026. **Every tracked markdown file must be an authority, dated
evidence, or explicitly out of scope with a reason. There is no fourth state.**

The two rules above were sound and were working. They only ever applied to the
documents somebody had thought to list. Measured across the whole repository:

| | Files |
| --- | ---: |
| Declared authorities | 15 |
| Declared evidence | 122 |
| **Governed by nothing** | **101** |

Fifty-one of those 101 named contract numbers and nothing checked them; the
oldest named **35** while the repository was at 157. That is not a gap in the
rules — it is a gap in what the rules were pointed at, and it is the more
dangerous shape, because **an unlisted document looks exactly like a governed
one to a reader.** A control that covers the files someone remembered is a
control that decays as the repository grows, which is the failure the
per-contract guards had.

The rule paid for itself on its first run. It reached
`docs/quality/audit-2026-08-10-remediation.md`, which nothing had been watching,
and found a branch name ending in an eleven-digit workflow run id being read as
a contract numbered **314** — `\d{2,3}` taking the first three digits of the run
id and stopping. The extractor now anchors the end of a number: a contract
number is a whole number or it is not one.

## The four classifications

| Kind | Rule | Why |
| --- | --- | --- |
| `live` | newest named contract must be the current one | It describes current state, so being overtaken makes it wrong |
| `dispositions` | may name any contract that exists; must not name one that does not | A risk or decision register names the contract that resolved an entry. It has nothing to say about a contract that closed nothing, and forcing it to name one would make it lie |
| `reference` | the same rule as `dispositions` | An ADR, a procedure, a subsystem reference or the design system names what **built** the thing it describes, where a register names what **resolved** an entry. Neither claims where the repository is now; both are wrong on their face if they cite a contract that has never existed |
| `structural` | exempt here | Held in step by a stronger check against a real database — see `tests/database-parity/stageCTriggerBindingCoverage.test.ts` |

Dated evidence — audits, investigations, reconciliations, automation runs,
nightly reports, and the operator records in `docs/ops/records/` — is exempt
**by classification, in `evidenceDirectories`**, rather than by being forgotten.
Those documents are snapshots and must keep saying what was true when they were
written. The manifest test refuses to let a path be both evidence and an
authority.

### The sweep rule produced a duplication problem, and it is now closed

Measured 11 August 2026 across the 93 authority documents: **16 long paragraphs
appeared verbatim in more than one of them, 67,204 characters in total.** One
contract blockquote existed identically in **seven** files at once — `CLAUDE.md`,
`MASTER-TODO.md`, `docs/roadmap.md`, `docs/adr/README.md`,
`docs/competition-structure.md`, `docs/design/README.md` and
`docs/quality/feature-baseline.md`. **All of it is gone**; how is below.

Those are exactly the seven `sweep: true` documents, and that is not a
coincidence. **The sweep demands all seven be touched by every contract, and the
cheapest way to satisfy it is to paste the same paragraph into all seven.** The
control against staleness produced the duplication. This document had already
predicted the shape — *"marking everything would train people to add a
meaningless line to pass the gate"* — and what it actually trained was a
meaningful-*looking* line, which is harder to spot and more expensive to
maintain.

`tests/scripts/documentationDuplication.test.ts` holds the rule that
`DOC-AI-001` could only assert: no long paragraph is carried verbatim by two
authorities. Evidence is out of scope — an audit quotes what it audited, and
freezing that is what `DOC-AI-006` is for.

**The baseline is empty, and it is meant to stay empty.** It held 16 entries and
67,204 characters when it was written; every one is gone. An entry is not a way
to record duplication, it is a way to permit it.

### How the copies were removed, and what replaced them

Every swept document was already answering its own question about each contract
— in a single clause bolted to the end of a pasted paragraph. Read together, the
questions are strikingly distinct:

| Document | The question it asks of a contract |
| --- | --- |
| `MASTER-TODO.md` | What does this deliver, and what does it leave outstanding? |
| `docs/roadmap.md` | Does this reorder the Domestic Frontend Alpha? |
| `docs/adr/README.md` | Does this introduce an architectural decision? |
| `docs/competition-structure.md` | Does this change a competition, game, format or membership? |
| `docs/design/README.md` | Does this move a visual authority? |
| `docs/quality/feature-baseline.md` | Does this add a feature or move a rule? |

So each now carries a short table of **only** the contracts that had a
consequence for it, in its own words, and a contract with none is **absent
rather than restated**. `CLAUDE.md` keeps the narrative, because stating the
current implementation boundary is the job its manifest entry names.

`docs/adr/README.md` gained something else from this. Nine of its blockquotes
sat **above its own index**, so the file's actual purpose — which decision has
which status — began a screen and a half down.

**The sweep still works, and is now satisfied by a true sentence.** Each table
ends with the contract it is current to. A contract with a consequence adds a
row; a contract without one advances that line. Both are facts, where the
pasted paragraph was neither the document's own nor its business to maintain.

### What the cleanup moved, and the two things it nearly got wrong

The retirement pass of 11 August 2026 proposed six dispositions from reading
headers. Checking each against inbound references first changed two of them,
and that order is the lesson: **a document's own banner is the weakest evidence
about whether it is still load-bearing.**

| Document | Proposed | Done |
| --- | --- | --- |
| `docs/build-todo.md` | Delete | Deleted. Its job was discouraging a second checklist; the coverage rule now refuses one outright, so the signpost was redundant |
| `docs/quality/audit-prompt.md` | Move to `instruments/` | Moved. A 954-line instrument is run, not read, and sat beside the registers it produces |
| `docs/test-script.md` | Move to history, or re-date | Moved to `instruments/` instead, as `entry-flow-test-script.md`. A test guards it against regressing to obsolete phase language, which is only worth doing to something that will be run again |
| `docs/roadmap/acquisition-readiness-roadmap.md` | Retire to history | Retired, dated, with `acquisition-risk-register.md` repointed. Its phases were overtaken and it named contract 46 |
| `docs/visual/higgsfield-concept-review.md` | Move to history, retire the directory | **Left in place.** The directory holds 32 tracked concept and before/after images that the document links to, and splitting a record from its own evidence is worse than the tidier tree. `docs/visual/` is declared an evidence directory instead |
| `docs/predictor-cup-rules.md` | Supersession header, retire to history | **Left in place, and marked the other way.** Its banner says "Draft Competition Rules (v0.1)" and it reads retired — but `src/domain/season/cupGroupTable.ts` cites its §5 table columns and eight tie-breakers as its authority under ADR 0014. Retiring it would have moved a live scoring rule into an evidence directory. It now says so at the top |

Two smaller corrections came out of the same pass. `docs/design-system.md` was
listed twice after being promoted from `reference` to `live`; `classify` returns
the first match, so the second entry was invisible and the manifest was quietly
ambiguous about what it had decided. A test now refuses a duplicate path. And
the design set was **not** frozen as the plan proposed: `design/README.md` says
the modernisation plan is still the answer to what the product should look like
finished, and `ui-finalisation.md` says its delivery order stands — so both are
`reference`, and only `ui-finalisation.md` was promoted to `live`.

**Links versus mentions, in dated evidence.** A prose mention of an old path is
left exactly as written — it records where a file was when the record was made,
which is the point of a record. A markdown **link** is repointed, because
`tests/scripts/markdownDocumentation.test.ts` requires links to resolve and a
path is not a statement. Both halves are visible in this cleanup: the audits
still say `docs/ops-prod-cutover.md` in prose from an earlier move, and one
audit's link to the audit prompt was repointed.

### `docs/ops/` is procedures; `docs/ops/records/` is what happened

Until 11 August 2026 the two lived together, so eleven dated one-off records —
the contract 65 rollout recovery, releases 144 and 145, the production cutover,
the contract 63 object baseline — sat beside reusable runbooks and read as
current instructions because of where they were. They now sit in
`docs/ops/records/`, which is an evidence directory. **Not one word of them
changed**; only the path did. The inbound references from other *evidence* were
deliberately left alone, matching how an earlier move of the same file was
handled: a dated record cites the path that was true when it was written.

## Adding a document

Give it a classification, or the coverage rule will refuse it — which is the
point.

- One file: add it to `authorities` with a `kind`, a `sweep` flag and a `why`.
- A whole directory of the same kind of thing: add a prefix to
  `authorityDirectories` with a `kind` and a `why`. This is what keeps the
  manifest affordable — an ADR is a decision record whether or not anyone lists
  it individually.
- Dated evidence: put it under an `evidenceDirectories` prefix.
- Genuinely nothing the rules can say anything about: `outOfScope`, with the
  reason it cannot go stale. That list is the one state with no check behind it,
  so its length is the measure of how much is taken on trust, and a test caps it.

The `why` is required and tested for on all three, a manifest entry without a
reason being how a control becomes a ritual.

**Precedence is one rule, not a table of special cases.** An exact path always
wins, because naming a file is the most specific thing the manifest can do.
Otherwise the **longest matching directory prefix** wins, whichever list it came
from. That is what lets `docs/ops/` be procedures while `docs/ops/records/`
inside it is evidence, and `docs/quality/` be governance while its four dated
subdirectories are evidence — with neither nesting written down as an exception.

Set `sweep: true` only if the document genuinely needs revisiting on **every**
contract. Marking everything would train people to add a meaningless line to
pass the gate, which is worse than not having it.

## Running it

```bash
npm run check:documentation-authorities                 # coverage and freshness
node scripts/check-documentation-authorities.mjs A B    # and the sweep
```

CI runs the first form on pushes and the second on pull requests.

## The generated current-state surface

[`NOW.md`](../../NOW.md) is one page of current facts — contracts, pending
migrations, journey flags, outstanding requirement counts and where each
authority lives. It is **generated** by `scripts/generate-now.mjs` from the
machine-readable sources, and CI runs `npm run check:now` to fail an
out-of-date file or a hand edit.

It is deliberately **not** in the manifest above. The freshness rule asks a
document to name the current contract as its newest; an exact regeneration
check is stronger than that, and marking it `sweep` would force a manual touch
on a file whose whole point is that nobody types into it.

**Its requirement count was wrong, and the cause was the same one.** Measured
11 August 2026: the register held **63** rows and the page counted **35**. The
counter spelled out the prefixes it knew — SITE, ACCOUNT, EURO, AGE, PRIV,
INGEST, CAP — and matched three digits only, so every `DFA-0nn` row was invisible
because nobody had added its prefix, and every `MIG-UI-nn` row because its number
has two digits. The headline moved from 27 outstanding to **48**. A page whose
stated design is that it fails closed when two sources disagree was
under-reporting the gap by 28 requirements, in the one number it publishes about
them. It now matches any identifier the register uses, and a test asserts that
every prefix with outstanding rows appears in the page.

Three properties are held by `tests/scripts/generatedNowSurface.test.ts` rather
than by convention:

- **it fails closed** when two sources disagree — a contract count the migration
  chain does not support, a development or production contract ahead of the
  repository, a hosted record naming a migration that does not exist. A wrong
  current-state page is worse than none, because it is the page an agent trusts
  fastest;
- **production promotion authorisation is read, never inferred.** No amount of
  repository progress can make the page report production as authorised;
- **the requirement register is linked and counted, never copied.** A second
  list would be a second thing to keep in step.

It holds no rule and decides nothing. Every authority it names outranks it, and
where it disagrees with one, it is the one that is wrong.

## Safeguards for agent-readable documentation

Added 6 August 2026. The two mechanical rules above stop documents going stale about contract numbers. They do not stop the larger failure, which an audit measured rather than guessed: **current facts and historical narrative interleaved in the same file, so an agent searching for a phrase lands in a paragraph that was true in July and treats it as true now.**

These ten safeguards are the written rules. Some are enforceable and enforced; most are not, and saying which is which is more useful than pretending otherwise.

| ID | Requirement | Enforcement |
| --- | --- | --- |
| `DOC-AI-001` | Every important fact has **one authoritative home**. Supporting files may link to it; they must not restate a moving fact. | `tests/scripts/documentationDuplication.test.ts` enforces the verbatim half, with an empty baseline; restating a fact in different words remains convention |
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
