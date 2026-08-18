# AI and development-tooling integrations

This is a usage guide, not a current-state authority. Hosted truth remains in the existing quality/ops authorities, model-selection truth remains in AI Lab evidence, and product behaviour remains in ADR/design authorities.

## Adopted integration layers

| Repository | Integration in this repo | Default effect |
| --- | --- | --- |
| `obra/superpowers` | `predictor-spec-driven-delivery` skill mirrors its useful plan/TDD/review/verify discipline while keeping repository authorities in charge. Harness-level plugin installation remains external. | Process only; no runtime change. |
| `github/spec-kit` | `.specify/memory/constitution.md` plus the local delivery skill establish a Spec Kit-compatible spec -> plan -> tasks -> implementation flow. | Process only; no runtime change. |
| `microsoft/playwright-mcp` | Repository `.mcp.json`, pinned to `@playwright/mcp@0.0.79`. | Available to compatible coding agents; normal Playwright E2E remains authoritative CI. |
| `evidentlyai/evidently` | Optional AI Lab observability extras and a drift-report CLI. | Local/CI opt-in; no hosted service or data upload. |
| `shap/shap` | Optional probability-space SHAP path for the rejected-but-retained GBM family, with permutation SHAP and then deterministic occlusion fallbacks when TreeSHAP cannot supply the required probability contract. | No model probability change. |
| `treeverse/dvc` (`iterative/dvc`) | Repository-local DVC metadata and an AI Lab reproducibility stage. No remote is configured. | Local opt-in; no model/data upload. |
| `TanStack/query` | Shared QueryClient provider is installed and tested for deliberate server-state migrations. It is not mounted in the application shell. | Zero production bundle/runtime effect until a feature explicitly adopts it. |
| `storybookjs/storybook` | React/Vite Storybook workspace for isolated design-system and football-state stories, plus a path-scoped PR build gate. | Development/CI only. |
| `PostHog/posthog` | Privacy-safe client adapter is installed and tested, but is not imported or initialised by the application shell. Automatic capture is disabled. | Zero production bundle/runtime effect until explicitly adopted and configured. |
| `recharts/recharts` | Reusable probability/performance chart primitive for AI/admin and football-data surfaces. It is not mounted or imported by the player-facing application. | Zero production bundle/runtime effect until the component is mounted. |

## Installation boundaries

### Python observability extras

The normal locked AI environment intentionally stays lean. Install the
optional layer only where it is needed:

```bash
bash scripts/agent-tools/ai-sync.sh observability
source ai/.venv/bin/activate
```

`ai/pyproject.toml` keeps the optional group separate, while `ai/uv.lock`
still pins it so an observability run is reproducible rather than freshly
resolved.

No Evidently Cloud, DVC remote, or other external destination is configured by this repository. Reports and DVC metadata are local unless an operator deliberately adds a remote/service later.

### Playwright MCP

Compatible agents can load `.mcp.json` from the repository. The MCP server is a developer exploration tool. It does **not** replace `npm run test:e2e`, authenticated E2E, production smoke tests, or the existing browser acceptance gates.

### Superpowers

Superpowers installs at the coding-harness level, not as an application dependency. The repository-side skill exists so agents without the plugin still follow the same high-value sequence. If the plugin is available, its native skills can be used, but repository authorities still win conflicts.

### Spec Kit

The repo-side constitution is intentionally small and stable. A developer with the `specify` CLI can initialize/use Spec Kit against the repository, but generated feature specifications must link to existing ADR/design/ops authorities rather than copying moving state into `.specify`.

## AI Lab commands

Generate a local Evidently drift report from two point-in-time feature extracts:

```bash
python ai/observability.py drift \
  --reference reference_features.csv \
  --current current_features.csv \
  --output ai/reports/evidently/feature-drift.html
```

Run the DVC reproducibility stage after installing the optional group:

```bash
dvc repro ai-offline-guardrails
```

`GradientBoostedModel.contributions()` prefers TreeSHAP only when the estimator can provide the required probability-space contract. For multiclass estimators where that is unavailable, it falls back to permutation SHAP over `predict_proba`; if SHAP itself is unavailable or unsupported, it retains the deterministic occlusion-vs-training-median explanation. Every path labels its method honestly.

## Frontend opt-in boundary

TanStack Query, PostHog and Recharts are dependencies because their adapters/components are committed, typechecked and tested. They are deliberately absent from the current application import graph, so merely installing this integration does not increase the player-facing production JavaScript bundle.

A feature that adopts TanStack Query should wrap the relevant tree with `ClientToolingProvider` (or deliberately move that provider to the application shell once broad adoption justifies it). Existing Supabase reads are not migrated implicitly.

The PostHog adapter is also inert until application code explicitly calls `initProductAnalytics()`. If a future product decision enables it, configure the public project values:

```dotenv
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Setting environment variables alone does not enable analytics while the adapter is not imported by the application. Do not place service-role keys, database credentials, provider secrets, or private AI Lab data in PostHog properties. Automatic capture, pageview and pageleave capture remain disabled by the adapter so events stay intentional and reviewable.

The Recharts probability primitive follows the same rule: importing/mounting `ProbabilityTrendChart` is a separate product change and must pass the normal bundle and visual-contract gates.

## Rollout rule

Tooling adoption is deliberately layered:

1. process/browser tooling;
2. optional AI observability and reproducibility;
3. install and test frontend capabilities without changing the production import graph;
4. isolated Storybook/chart examples;
5. only then page-level adoption based on a specific product need.

Runtime adoption of a frontend library must pass the existing compressed bundle budget rather than raising the budget merely because the dependency has been installed. That order keeps this change from silently rewriting data-fetch behaviour, model authority, privacy rules, player-facing UI, or performance merely because a library exists in the repository.
