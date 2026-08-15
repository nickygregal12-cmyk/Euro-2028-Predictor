# Historical evidence

Files under `docs/history/` are retained evidence from the point in time named by the file or its source commit. They are **not current project authority** and should not be loaded for ordinary implementation work.

Use history when you need to answer questions such as:

- why a decision or implementation changed;
- what a previous rollout or deployment claimed;
- regression or migration archaeology;
- comparison with an earlier project state;
- audit evidence that must remain immutable.

For current moving facts, start with [`../../NOW.md`](../../NOW.md). For current hosted detail, use [`../quality/current-status.md`](../quality/current-status.md) only when the task requires it.

## Context-reset snapshots

`context-reset-2026-08-16/` preserves the pre-reset root/design narratives verbatim:

- [`AGENTS.pre-reset.txt`](context-reset-2026-08-16/AGENTS.pre-reset.txt)
- [`CLAUDE.pre-reset.txt`](context-reset-2026-08-16/CLAUDE.pre-reset.txt)
- [`design-README.pre-reset.txt`](context-reset-2026-08-16/design-README.pre-reset.txt)

They use `.txt` deliberately: the content is an immutable snapshot, including links that were relative to the files' original locations, and should not be treated as a live Markdown authority or link target.

Existing dated audits, reconciliations, investigations and operations records remain where their existing evidence classification places them. Do not mass-move them merely to make the history tree look symmetrical.
