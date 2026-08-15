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

## UI UX Pro Max advisory profile

The repository deliberately does **not** vendor UI UX Pro Max as a runtime library or let it replace the local design authority. When its design-intelligence catalogue is available, use it as a structured critic for the existing product.

For this football platform, prefer the parts of that catalogue that reinforce the accepted direction:

- **performance / analytics dashboard thinking** — make points, rank, form, confidence, odds and match state scannable before adding decoration;
- **vibrant block hierarchy selectively** — the primary action or live football state may carry more visual weight, but secondary information stays neutral and token-led;
- **micro-interactions over spectacle** — short state feedback and hover/focus affordances are useful; perpetual motion and page-wide animation are not;
- **responsive composition** — phone keeps the direct task flow, while tablet/desktop may align metadata, deadlines and football context into dedicated lanes rather than stretching the phone stack;
- **resilient text** — essential club names, competition names, headings and state labels must reflow under narrow widths, zoom and text scaling instead of being silently clipped; compact truncation is acceptable only where an operable full-value path exists;
- **pre-delivery accessibility checks** — visible keyboard focus, semantic controls, minimum contrast, reduced-motion support, stable touch targets and non-colour state meaning remain mandatory;
- **real icons, not emoji furniture** — use the repository icon wrappers or semantic text rather than emoji as interface controls.

Treat UI UX Pro Max's palette, font and named-style recommendations as **optional exploration only**. The existing Prediction Hub token system, typography, light/dark themes and component language remain authoritative unless the owner explicitly changes them.

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
