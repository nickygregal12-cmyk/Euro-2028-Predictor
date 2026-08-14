# AI-assisted development workflow

**Status:** repeatable development process  
**Authority:** process guidance only; it does not define product rules, implementation status, hosted state, scoring, locks, privacy, schema or release authority  
**Owner:** product owner  

This workflow keeps ChatGPT, Claude Code and Codex useful without making any conversation a second project database. **GitHub is the shared handoff layer and the repository remains the source of truth.**

The goal is not to make three agents implement the same task. Each has a deliberately different job:

| Role | Default tool | Responsibility |
| --- | --- | --- |
| Product lead | ChatGPT | Product thinking, UX, research, architecture discussion, feature definition and acceptance criteria |
| Implementer | Claude Code | Inspect the real repository, implement the approved work order, debug, refactor and run relevant verification |
| Independent reviewer | Codex | Review the resulting diff against the work order and repository authorities; find defects rather than produce a competing implementation |
| Shared memory | GitHub | Code, decisions, work orders, pull requests, tests and durable project documentation |

A different tool may take a role when there is a practical reason, but **one task has one implementation owner at a time**. Avoid two coding agents making overlapping changes to the same slice concurrently.

## 1. Start from repository truth, not chat history

Before planning or changing anything, orient from the repository:

1. inspect current `main`, open pull requests and relevant branch ancestry;
2. read [`../../AGENTS.md`](../../AGENTS.md) and the authority it points to;
3. use [`../quality/current-status.md`](../quality/current-status.md) for live implementation/hosted state;
4. use [`../adr/README.md`](../adr/README.md) for decisions;
5. use [`../design/README.md`](../design/README.md) and [`../design-system.md`](../design-system.md) for presentation authority;
6. use [`../roadmap.md`](../roadmap.md), [`../../MASTER-TODO.md`](../../MASTER-TODO.md) and [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) only for the roles those documents declare;
7. inspect the relevant code and executable tests before concluding what exists.

Do not paste an old conversation into a new coding session as a substitute for those checks. A useful fact from a conversation becomes durable only when it is recorded in the correct repository authority, issue or merged implementation.

## 2. Use GitHub Issues as the normal feature handoff

A bounded piece of implementation work should normally begin as a GitHub issue created from the **AI work order** template.

The issue is a work order, not a new product authority. It should link to the existing ADR, design, requirement or roadmap authority when one exists. If planning reveals a genuinely new product or architecture decision, record that decision through the repository's existing governance before implementation rather than hiding it inside the issue.

A good work order answers:

- what user or operator problem is being solved;
- what is in scope and explicitly out of scope;
- which repository authorities constrain the work;
- the required UX states and edge cases when relevant;
- measurable acceptance criteria;
- the verification expected before completion.

Prefer one issue for one coherent deliverable. Split work when two parts can be implemented, verified or rolled back independently.

Permanent feature documents should be created only when the information itself is a durable reference that belongs in the documentation system. Do not create a growing `docs/features/` backlog just to preserve temporary implementation prompts.

## 3. ChatGPT: define the work before code is written

Use ChatGPT primarily to turn an idea into a bounded work order.

A planning session should:

1. inspect the current repository and relevant authorities;
2. distinguish already-built behaviour from proposed behaviour;
3. identify dependencies and conflicts with open work;
4. define the user story or operator outcome;
5. define mobile and desktop behaviour where the surface is user-facing;
6. cover loading, empty, error, locked/unavailable and success states as applicable;
7. write acceptance criteria that another agent can independently verify;
8. identify whether the work needs an ADR, accepted requirement, migration, provider decision or owner approval before implementation;
9. create or update the GitHub work-order issue when the scope is ready.

Do not generate a replacement implementation merely because another agent's implementation differs stylistically. Once a work order is approved, switch from design discussion to review of evidence and outcomes.

### Suggested planning prompt

```text
Inspect the current Predictor repository and the relevant authorities before proposing changes.

Turn this idea into one bounded implementation work order:
<idea>

Define:
- user/operator outcome
- current behaviour
- scope
- out of scope
- authority/dependency links
- UX states and edge cases
- acceptance criteria
- verification required

Do not write implementation code yet. Do not treat old chats as implementation evidence.
```

## 4. Claude Code: implement the work order

Claude Code's normal job is to enter the repository and complete an already-bounded issue.

At the beginning of a coding session:

1. start a fresh session for the work order rather than extending an unrelated long conversation;
2. inspect current `main`, open pull requests and branch ancestry;
3. read `CLAUDE.md`, `AGENTS.md` and the authorities linked by the issue;
4. inspect the existing implementation and tests before editing;
5. confirm that concurrent branches do not own overlapping files or contracts;
6. state a short implementation plan, then execute it.

During implementation:

- reuse existing components and authorities before creating parallel ones;
- make the smallest coherent change that satisfies the work order;
- do not widen scope to unrelated cleanup unless it blocks correctness;
- do not invent a product, scoring, lock, privacy or lifecycle decision;
- do not mutate Production merely to prove development code;
- preserve the repository's existing environment and migration guards;
- add or update tests for changed behaviour;
- close documentation impact in the same pull request when the governed truth changes.

At completion, leave the branch and pull request in a state that can be independently reviewed. Report what changed, what was verified, what was not verified and any remaining blocker. Do not declare a hosted change without target-specific evidence.

### Suggested implementation prompt

```text
Implement GitHub issue #<number> in this repository.

Before editing:
- inspect current main, open PRs and branch ancestry
- read CLAUDE.md and AGENTS.md
- read every authority linked by the issue
- inspect the existing code and relevant tests
- check for concurrent overlapping work

Implement only the approved scope. Reuse existing components and authorities. Do not change product rules or database schema unless the issue explicitly authorises it.

Run the relevant verification, complete the repository documentation-impact check, then report the exact evidence and anything still unverified.
```

## 5. Codex: review the diff, not rebuild the feature

Codex is the default second pair of eyes after implementation.

Review the actual branch or pull-request diff against:

1. the GitHub work order;
2. `AGENTS.md`;
3. the linked product/design/architecture authorities;
4. relevant tests and runtime boundaries.

Prioritise:

- correctness bugs;
- security/privacy failures;
- broken repository authority boundaries;
- React/TypeScript/database mistakes;
- missing failure or empty states;
- accessibility and mobile/desktop regressions;
- performance regressions that are material to the changed journey;
- acceptance criteria that are not actually proved.

Do **not** request changes merely because another implementation style is possible. Rank findings by impact and identify the evidence for each finding.

The implementation owner should address valid findings on the same branch, rerun affected verification and return the PR for another focused review if needed.

### Suggested review prompt

```text
Review this PR against its linked GitHub work order and repository authorities.

Focus on defects, missing acceptance criteria, security/privacy issues, architectural boundary violations, accessibility, mobile/desktop UX and material performance problems.

Do not rewrite the feature because you prefer another implementation.

Rank findings:
- Critical
- Important
- Minor

For every finding, name the affected file/behaviour and explain why it violates the work order, an authority or an executable invariant. If there are no material findings, say so explicitly.
```

## 6. Standard lifecycle

Use this flow for normal feature work:

```text
Idea
  ↓
ChatGPT — inspect, plan, define acceptance criteria
  ↓
GitHub Issue — bounded AI work order
  ↓
Claude Code — implement on one branch
  ↓
Pull Request — implementation + verification evidence
  ↓
Codex — independent diff review
  ↓
Claude Code — fix valid findings only
  ↓
Required checks / hosted evidence where applicable
  ↓
Merge
  ↓
Issue closes; repository authorities reflect the new truth
```

Database, security, production and other protected changes still follow their existing repository-specific gates. This workflow does not weaken them.

## 7. Context and usage discipline

To keep sessions efficient:

- **repository over transcript** — retrieve files and commits instead of pasting the codebase;
- **issue over giant prompt** — give the implementer the work-order number and authority links;
- **diff over reimplementation** — give the reviewer the branch/PR, not a request to build a second version;
- **new session per coherent task** — avoid carrying hundreds of unrelated messages into implementation;
- **one implementation owner** — do not spend two coding-agent budgets producing competing versions;
- **small prompts for small changes** — reserve deeper reasoning for genuinely ambiguous architecture, debugging or model work;
- **no repeated research** — once a decision is accepted, point to its repository authority rather than reopening the question by default;
- **no speculative provider calls** — use retained evidence and repository fixtures for development whenever the project rules allow it.

A chat is a workspace. It is not project memory.

## 8. Definition of done

A work order is complete only when the applicable items below are true:

- its acceptance criteria are satisfied;
- relevant tests/checks pass;
- the implementation does not contain unrelated changes;
- the documentation-impact check is complete;
- protected environment/production evidence exists when the claim requires it;
- the independent review has no unresolved material finding;
- the PR description records the evidence and known limitations;
- the issue can be closed without relying on facts that exist only in a chat.

If a task stops short of those conditions, record the precise blocker on the issue or PR. Do not preserve the blocker only in a model conversation.

## 9. What belongs where

| Information | Home |
| --- | --- |
| Current implementation and hosted state | `docs/quality/current-status.md` and machine contract records |
| Product/architecture decision | ADR system |
| Accepted but unbuilt requirement | `docs/quality/accepted-requirements.md` |
| Current delivery sequence | `docs/roadmap.md` |
| Detailed active/parked inventory | `MASTER-TODO.md` |
| Finished-product presentation target | `docs/design/README.md` and its governed design references |
| Temporary bounded implementation specification | GitHub AI work-order issue |
| Implementation | Branch + commits + tests |
| Review evidence | Pull request review/comments/checks |
| Historical rollout/audit evidence | Existing dated evidence directories |
| Conversation-only idea | Chat until accepted; never implementation authority |

This separation is the mechanism that lets ChatGPT, Claude Code and Codex start fresh without forcing the product owner to explain the whole Predictor project again.