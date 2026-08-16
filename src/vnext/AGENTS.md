# vNext frontend instructions

These instructions apply to work under `src/vnext/`.

This directory is being established as a scoped context boundary before vNext application code exists. Do not add fake runtime code merely to make the directory look populated.

## Read first

1. [`../../docs/product/ui.md`](../../docs/product/ui.md) — vNext product/presentation direction.
2. [`../../AGENTS.md`](../../AGENTS.md) — repository-wide invariants and task routing.
3. The exact domain/service contract for the data the component actually needs.

Do not load database, provider, AI Lab or deployment history for ordinary component/layout work unless the surface genuinely crosses one of those boundaries.

## vNext rules

- vNext is a parallel frontend lane, not a gradual reskin of the legacy production UI.
- Home is the first gold-standard screen and should establish the quality bar before broad propagation.
- Early workshop/concept work uses realistic mocked data. Do not create a Supabase dependency just to make a concept feel real.
- Preserve existing backend/domain/scoring/auth/service infrastructure. Integration should use bounded read models/services when the real-data phase begins.
- Desktop may use substantially more information and a different composition from mobile; do not simply stretch a phone stack across a wide screen.
- Prioritise football state, prediction action, social/rival comparison and useful context over decorative dashboard furniture.
- Motion should explain hierarchy/state or add deliberate delight, with reduced-motion behaviour designed at the same time.
- Storybook/browser review, responsive states, keyboard/focus behaviour, text scaling and accessibility are part of frontend acceptance.
- Presentation may not invent scoring, locks, reveal, settlement, progression, membership or provider authority.
- Do not broadly restyle legacy components as a shortcut. If shared infrastructure is worth reusing, separate infrastructure reuse from visual inheritance.

## Context budget

For a local component change, the expected context is normally this file + `docs/product/ui.md` + the component/test/read-model involved. Escalate to broader authorities only when the task itself requires them.
