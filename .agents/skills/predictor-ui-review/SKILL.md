---
name: predictor-ui-review
description: Review Football Prediction Hub UI work against the repository design authority, using external UI heuristics only as advisory evidence for hierarchy, density, responsiveness, accessibility and interaction quality.
---

# Predictor UI review

Use this skill when designing, implementing or reviewing Hub/Euro frontend work.

## Authority first

Before offering a visual recommendation, read:

1. `docs/design/README.md`;
2. the relevant current/target design authority it points to;
3. the governing ADR where the surface crosses competition boundaries, membership, reveal, lock or lifecycle rules;
4. the existing component/read-model contract.

External UI systems, galleries, style catalogues and heuristics are **critics**, never authorities. They may improve execution but cannot silently change a decided journey or product rule.

## Review dimensions

Evaluate each surface on:

- **information hierarchy** — the next action and most important football state are obvious;
- **desktop use of space** — desktop gains density, persistent navigation and useful secondary context rather than stretching the phone layout;
- **mobile action quality** — primary prediction/game actions remain thumb-friendly and do not require precision tapping;
- **data density without clutter** — tables, form, odds, confidence, standings and player context use progressive disclosure instead of hiding useful evidence;
- **state completeness** — loading, empty, stale, locked, error, partial-data, offline/retry and permission states are designed, not incidental;
- **accessibility** — semantic controls, visible focus, contrast, text reflow, zoom, reduced motion, screen-reader labels and minimum touch targets;
- **interaction feedback** — saves, locks, destructive actions and retries have immediate, unambiguous feedback;
- **token discipline** — use existing semantic design tokens and component patterns before inventing new raw values;
- **competition clarity** — Hub and Euro presentation may differ, while scoring/membership/lifecycle remain owned by their backend authorities;
- **local time** — kick-off time follows the user's locale where the design authority requires it.

## Advisory design search

When a coding/design agent has access to a UI knowledge base such as UI UX Pro Max, use it to generate alternatives for layout, typography, responsive density, chart/table choice, accessibility and anti-pattern review. Then filter every suggestion through the repository authority above.

Do not import a generated palette, font pairing, component library or visual style wholesale merely because a tool recommends it.

## Output contract

For review-only tasks, return findings in this order:

1. **must fix** — violates repository authority, accessibility or a required state;
2. **high-value polish** — materially improves comprehension, density or interaction;
3. **optional exploration** — aesthetic alternatives that do not alter behaviour.

Each finding should name the affected surface/file and the authority or measurable heuristic behind it.

## Boundaries

This skill is presentation-only. It may not invent or alter scoring, locks, reveal rules, membership, settlement, progression, privacy, model logic or hosted configuration.