# AI and development-tooling integrations

This is a usage guide, not a current-state authority. Hosted truth remains in the existing quality/ops authorities, model-selection truth remains in AI Lab evidence, and product behaviour remains in ADR/design authorities.

## Adopted integration layers

| Repository | Integration in this repo | Default effect |
| --- | --- | --- |
| `obra/superpowers` | `predictor-spec-driven-delivery` skill mirrors its useful plan/TDD/review/verify discipline while keeping repository authorities in charge. Harness-level plugin installation remains external. | Process only; no runtime change. |
| `github/spec-kit` | `.specify/memory/constitution.md` plus the local delivery skill establish a Spec Kit-compatible spec -> plan -> tasks -> implementation flow. | Process only; no runtime change. |
| `microsoft/playwright-mcp` | Repository `.mcp.json`, pinned to `@playwright/mcp@0.0.79`. | Available to compatible coding agents; normal Playwright E2E remains authoritative CI. |
| `evidentlyai/evidently` | Optional AI Lab observability extras and a drift-report CLI. | Local/CI opt-in; no hosted service or data upload. |
| `shap/shap` | Optional TreeSHAP path for the rejected-but-retained GBM family, with deterministic fallback to the existing occlusion explanation when the extra is absent. | No model probability change. |
| `treeverse/dvc` (`iterative/dvc`) | Repository-local DVC metadata and an AI Lab reproducibility stage. No remote is configured. | Local opt-in; no model/data upload. |
| `TanStack/query` | Shared QueryClient provider for server-state caching/refetch policy. | Runtime dependency; behaviour remains opt-in per query. |
| `storybookjs/storybook` | React/Vite Storybook workspace for isolated design-system and football-state stories. | Development-only. |
| `PostHog/posthog` | Privacy-safe client initializer that is disabled unless explicit Vite variables are supplied. | Disabled by default. |
| `recharts/recharts` | Reusable probability/performance chart primitive for AI/admin and football-data surfaces. | Runtime library; no page changes unless the component is mounted. |

## Installation boundaries

### Python observability extras

The normal `ai/requirements.txt` intentionally stays lean. Install the optional layer only where it is needed:

```bash
pip install -r ai/requirements.txt -r ai/requirements-observability.txt
```

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

Run the DVC reproducibility stage after installing the optional requirements:

```bash
dvc repro ai-offline-guardrails
```

SHAP is used automatically by `GradientBoostedModel.contributions()` when installed and supported. If it cannot be loaded for the fitted estimator, the method falls back to the pre-existing occlusion-vs-training-median calculation and labels the method honestly.

## Frontend environment variables

Product analytics remains off unless both of these are explicitly configured:

```dotenv
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Do not place service-role keys, database credentials, provider secrets, or private AI Lab data in PostHog properties. Analytics events are for player-facing product behaviour only.

## Rollout rule

Tooling adoption is deliberately layered:

1. process/browser tooling;
2. optional AI observability and reproducibility;
3. frontend dependencies and providers;
4. isolated Storybook/chart examples;
5. only then page-level adoption based on a specific product need.

That order keeps this change from silently rewriting data-fetch behaviour, model authority, privacy rules, or player-facing UI merely because a library was installed.
