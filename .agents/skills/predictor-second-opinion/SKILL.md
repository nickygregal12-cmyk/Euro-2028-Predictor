---
name: predictor-second-opinion
description: Use as a separate read-only critic for high-stakes architecture, security-sensitive or release-critical decisions where an independent model can catch blind spots. It is not a replacement for repository tests or the normal review skill.
---

# Predictor second-opinion adapter

Use this as a **critic**, normally in a separate post-implementation/review pass so ordinary task context stays small.

1. Materialize the immutable Trail of Bits skill with `npm run agent:skill -- second-opinion` and read only the printed entrypoint plus the one invocation reference needed for the chosen reviewer.
2. Independence matters more than advisor count. Use a genuinely different model/runtime from the primary implementer when available. If Claude implemented the change, Codex or the repository-supported OpenCode/Ox Alpha lane can be used as an independent read-only reviewer. If Codex implemented it, use Claude or another available genuinely independent reviewer rather than asking Codex to rubber-stamp itself. Do not call two terminals independent if they route to the same underlying model.
3. Keep the review read-only and diff-bounded. Include only the relevant repository authority/conventions plus the branch/commit diff; do not give the external reviewer broad write authority.
4. For Ox Alpha/OpenCode, follow `docs/ops/ox-alpha-cloud-development.md`. Treat OpenRouter/model inference as an external data boundary: never include repository secrets, Production credentials or exported player data in the review context.
5. **Do not automatically use Gemini's upstream `--yolo` path or OpenCode blanket `--auto`.** Any reviewer that requires auto-approved tool execution must be explicitly authorised; otherwise use a read-only reviewer or skip it.
6. Ask for concrete findings with file/symbol/evidence and focus the prompt when the risk is known (auth/RLS, permissions, data integrity, performance, error handling, architecture).
7. Reconcile findings against source, tests and canonical authorities. An external model is a critic, never a product/database/hosted truth source.
8. If no genuinely independent reviewer is available in the current environment, report the skipped critic briefly and continue with repository-native review/gates. Never pretend independence.
9. Do not run this on routine one-file edits merely because it is installed. Use it when the cost of a missed flaw justifies the extra model/context cost.

Where multiple independent reviews are used, preserve disagreement rather than forcing artificial consensus.
