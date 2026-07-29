# CLAUDE.md — Euro 2028 Predictor

This file is a pointer index for coding-agent sessions. It deliberately holds no summary of the rules, the baseline, the scoring values or the order of work: it used to restate all four, drifted from every one of them, and a summary that disagrees with its source is worse than no summary. Read [`AGENTS.md`](AGENTS.md) first — it carries the operating rules and the documentation map naming what to read, what to ignore, and where the task queue lives.

## Where to look

| Question | Document |
| --- | --- |
| Operating rules, git and database discipline, architecture rules, hard boundaries, documentation map | [`AGENTS.md`](AGENTS.md) |
| Current implementation and hosted state, and every contract number | [`docs/quality/current-status.md`](docs/quality/current-status.md) |
| The order of work | [`docs/roadmap.md`](docs/roadmap.md) |
| What to work on now | GitHub Issues — no markdown file is a task queue |
| Scoring and entry validity | [`docs/scoring-rules.md`](docs/scoring-rules.md) |
| Tournament facts, structure and R16 allocation | [`docs/tournament-structure.md`](docs/tournament-structure.md) |
| Competition separation law | [`docs/competition-structure.md`](docs/competition-structure.md) |
| Predictor Cup rules | [`docs/predictor-cup-rules.md`](docs/predictor-cup-rules.md) |
| Visual and interaction rules | [`docs/design-system.md`](docs/design-system.md) |
| How the app understands the tournament | [`docs/architecture-and-tournament-states.md`](docs/architecture-and-tournament-states.md) |
| Platform architecture decisions | [`docs/adr/README.md`](docs/adr/README.md) |
| Capabilities and safeguards that must not silently regress | [`docs/quality/feature-baseline.md`](docs/quality/feature-baseline.md) |
| Current findings and risks | [`docs/quality/risk-register.md`](docs/quality/risk-register.md) |
| What is deliberately postponed, and so must not be done yet | [`docs/quality/deferred-decisions.md`](docs/quality/deferred-decisions.md) |
| Documentation governance and the archiving rules | [`docs/quality/README.md`](docs/quality/README.md) |
| Operational procedure | the relevant `docs/ops-*.md` runbook |

Everything under `docs/history/`, `docs/quality/history/`, `docs/quality/audits/`, `docs/quality/investigations/`, `docs/quality/reconciliations/` and `docs/audits/` is dated evidence about one commit on one date. It is never current truth and never a task list.

Do not import rules or features from previous projects, old branches, prototypes or chats.
