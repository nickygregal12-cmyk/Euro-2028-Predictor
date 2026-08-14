# Agent skills architecture

## Status

This document describes a development-process layer only. It creates no product, scoring, lock, membership, privacy, settlement, progression, model-promotion or hosted authority.

The repository's existing authority order remains unchanged. `NOW.md` is a generated index; `docs/quality/current-status.md`, ADRs, design authorities, accepted requirements, roadmap/MASTER-TODO, machine contract records, migrations and executable tests keep their existing roles.

## Why this exists

The project has accumulated enough history that loading every operating rule, contract narrative, audit and implementation note into every coding session now creates avoidable context pressure. The solution is not another master document. It is **progressive disclosure**: a small universal entrypoint plus task-specific skills that point agents to the existing authority they need.

The project-specific skills live under `.agents/skills/` so hosts that understand the Agent Skills directory convention can discover them without flattening their content into one root prompt.

The complementary ChatGPT → GitHub → Claude Code → PR → Codex operating workflow originally prepared in draft PR #783 is carried forward on the same current-main branch as this architecture, together with its bounded AI work-order issue template. That removes the need for two competing agent-workflow PRs.

## Phase-one skills

### `predictor-context`

Loads current state first, then the smallest authority subset needed for the task. It formalises one-fact/one-home behaviour, durable handoffs, exact evidence references and context compaction.

### `predictor-ui-review`

Reviews frontend work against the repository design authority. External UI knowledge bases may propose hierarchy, density, typography, chart/table, responsive and accessibility improvements, but they remain advisory and cannot change decided product behaviour.

### `predictor-ai-lab-verifier`

Defines an adversarial verification lens for the private AI Lab: ordered evidence, feature provenance, artefact identity, reload reproducibility, prediction identity, real-bookmaker evidence and human-controlled promotion.

### `predictor-graph-navigation`

Uses an optional local code knowledge graph to narrow broad dependency, call-flow and subsystem questions before opening many files. Graph results are navigation hints only: important conclusions still require direct source/test/authority verification. The generated `graphify-out/` directory is disposable and ignored by git.

## External projects reviewed

The following public repositories informed the architecture. Their code is **not vendored into this repository** by this phase.

- `nextlevelbuilder/ui-ux-pro-max-skill` — useful as an advisory UI/UX search and critique layer. Repository design authorities continue to win every conflict.
- `muratcankoylan/Agent-Skills-for-Context-Engineering` — useful patterns include progressive disclosure, filesystem context, compact durable handoffs, long-horizon task briefs, independent evaluation and harness boundaries.
- `NeoLabHQ/context-engineering-kit` — useful selectively for fresh-context subagent review, judge/reflection patterns and complex task decomposition. Its full alternative specification hierarchy is deliberately not adopted because this repository already has ADRs, accepted requirements, roadmap, design and contract authorities. It is also kept external rather than vendored wholesale.
- `FareedKhan-dev/kimi-k3-in-c` — the model itself is not relevant to the product runtime. The useful idea is its validation philosophy: exact artefact identity plus progressive reference gates that prove the loaded implementation still reproduces a known oracle.
- `Graphify-Labs/graphify` — useful as an optional local structural knowledge graph for cross-file navigation. Code parsing is local/deterministic and the tool supports query/path/explain plus incremental rebuilds. It is deliberately not a runtime dependency, CI gate or repository authority, and its strict/always-on hooks are not enabled by default.

## AI Lab reproducibility phase one

`ai/reproducibility.py` adds three primitives without changing the database contract:

1. **training-data fingerprint** — SHA-256 over the exact ordered fit evidence, including natural-key/result context where present and the selected feature columns;
2. **bundle-contract fingerprint** — SHA-256 over the semantic model contract: feature order/version/groups, family, league/version, calibration shape, training-through date and ensemble component configuration;
3. **reference gate** — a small self-contained feature-vector oracle containing recorded raw and calibrated probabilities and its own manifest hash.

The existing artefact SHA-256 remains authoritative for the exact stored bytes. These additions answer different questions and must not replace it.

The initial tests prove that data/order changes alter the data fingerprint, feature order changes alter the semantic fingerprint, a joblib round trip reproduces the reference gate, changed model behaviour is refused, and manifest tampering is refused.

## Graph navigation phase one

`docs/ops/graphify-navigation.md` and `predictor-graph-navigation` define a deliberately bounded Graphify adoption:

1. use it to reduce architecture-discovery/context cost, especially across `src/`, `ai/`, `supabase/`, `scripts/`, tests and configuration;
2. prefer code-focused structural scans for routine work rather than automatically semantic-indexing the entire historical documentation corpus;
3. verify returned paths directly in source and treat inferred relationships as hypotheses;
4. keep generated graph output local/disposable and out of git;
5. keep Graphify outside application runtime, hosted environments and required CI;
6. do not enable strict/always-on hooks repo-wide until optional use demonstrates a measurable benefit.

## Integration sequence

1. Land the project-specific skills, AI-assisted development workflow, work-order template, optional graph-navigation layer and reproducibility primitives with tests.
2. Close draft PR #783 as superseded by the current-main integration branch once this branch contains its two files unchanged in meaning.
3. Wire the reproducibility primitives into the challenger training/write path so a freshly reloaded artefact must pass before database insertion.
4. Surface the new fingerprints in the existing AI Lab evidence/admin read where useful; do this through the normal migration/contract process if schema persistence is required.
5. Slim `AGENTS.md` and `CLAUDE.md` after moving-contract work is settled, retaining only universal operating rules and pointers to current authorities/skills. Historical contract narratives remain preserved in their authoritative/historical homes rather than auto-loaded on every task.
6. Add independent review/judge execution selectively for high-risk migrations, AI Lab changes and cross-layer work; do not require expensive multi-agent orchestration for routine one-file edits.
7. Trial Graphify on broad architecture/refactor investigations and measure whether it materially reduces source reads/context without missing negative cases before considering stronger hooks or automation.

## Non-goals

- no new product specification tree;
- no replacement for ADRs, design authority, accepted requirements, roadmap or machine contracts;
- no automatic Production writes or model promotion;
- no general-purpose LLM added to the football prediction pipeline;
- no external UI design system imported over the existing tokens/components;
- no required Graphify service, graph database or committed generated graph;
- no requirement that every task use multiple agents.

## Definition of done for the wider migration

The wider agent-architecture migration is complete when root auto-loaded instructions are compact, task-specific detail is discoverable just in time, long work has durable evidence-based handoffs, high-risk work has independent verification, graph-assisted navigation can be used without becoming a second truth source, and the AI Lab can prove that the artefact promoted is the same semantic/scoring artefact that passed its recorded gates.
