# REL-008 — deploy-preview reliability investigation

**Date:** 29 July 2026  
**Scope:** Netlify status evidence only; no configuration change or retrigger

## Result

PR #195 supplies the missing data point: its documentation/config-notes-only diff also failed the overall `netlify/euro28predictor/deploy-preview` status.

This makes the failure reproducible across PRs #194 and #195, but it does **not** prove that documentation-only diffs are the cause. Six documentation-only PRs among the preceding ten merged PRs passed.

## Comparison

| PR | Head branch | Diff classification | Netlify deploy-preview |
| ---: | --- | --- | --- |
| #183 | `agent/full-docs-audit-contract-60` | documentation only | success |
| #184 | `agent/bonus-games-production-release` | application, script, tests and documentation | success |
| #185 | `agent/bonus-games-release-evidence` | documentation only | success |
| #186 | `agent/clarify-release-evidence-label` | documentation only | success |
| #187 | `agent/bonus-games-browser-e2e` | workflow, browser test and publication script | success |
| #188 | `agent/bonus-games-e2e-evidence` | documentation only | success |
| #189 | `agent/h2h-rank-history-pgtap` | database test only | success |
| #190 | `agent/h2h-rank-history-evidence` | documentation only | success |
| #191 | `agent/result-revision-content-pgtap` | database test only | success |
| #192 | `agent/result-revision-evidence` | documentation only | success |
| #194 | `chore/branch-inventory` | documentation only | failure — Redirect rules, Header rules and Pages changed reported failed |
| #195 | `chore/baseline-reconciliation` | documentation and deployment-contract notes only | failure — overall deploy-preview failed; individual rule output is not exposed in GitHub status/comment data |

## Repository-visible correlation

The strongest visible correlation is branch naming:

- the ten successful comparison PRs use `agent/*` branches;
- both reproduced failures use `chore/*` branches;
- documentation-only content is not sufficient to explain the failure because #183, #185, #186, #188, #190 and #192 passed;
- time or a repo-wide Netlify outage is also insufficient because PR #193's later `agent/*` deploy preview succeeded.

This correlation does not prove that the branch prefix is causal. Possible causes include Netlify branch-context selection, rule-plugin input, changed-page detection or another deploy setting visible only in Netlify logs.

## Required owner log review

Read both exact logs and compare the Redirect rules, Header rules and Pages changed sections:

- PR #194: https://app.netlify.com/projects/euro28predictor/deploys/6a69f38423093d0008219c30
- PR #195: https://app.netlify.com/projects/euro28predictor/deploys/6a6a0f0f3a259b000896c462

Record:

1. the first failing command/rule in each deploy;
2. whether both failures have the same error text;
3. the Netlify context and branch-specific environment values selected;
4. whether the branch prefix changes plugin or environment behaviour;
5. whether the three checks are intended to pass, skip or report neutral on a no-runtime-change diff.

## Finding disposition

`REL-008` remains **Open — reproduced, cause not yet isolated**.

The proportionate-checks policy is unreliable for at least two `chore/*` documentation branches. It must not be treated as a proven application regression or dismissed as “docs-only” until the exact logs identify the rule behaviour. No Netlify configuration was changed and no build was retriggered.
