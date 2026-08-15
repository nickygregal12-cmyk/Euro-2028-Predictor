# UI product direction

**Status:** accepted direction for the next frontend phase  
**Scope:** presentation, interaction and frontend composition only  
**Does not govern:** scoring, locks, membership, reveal, settlement, progression, authentication authority, provider truth or database lifecycle

This is the small product authority for new frontend work. It deliberately does not contain a full visual specification; the next UI PR will establish the vNext workshop and Home concepts.

## Current UI and vNext are different lanes

The UI that is currently deployed is the **legacy/current production UI**. It remains supported, but it should not receive broad cosmetic redesign or another general visual-polish pass unless that work is explicitly authorised. Bug fixes, accessibility fixes and narrowly scoped functional changes remain valid.

Legacy production presentation references are indexed in [`../design/README.md`](../design/README.md). They do not define the visual language for vNext.

New product exploration should happen in a **parallel vNext frontend**. vNext is not a reskin of the current interface and should not be implemented by gradually restyling legacy screens in place.

## vNext direction

The intended experience is a premium football prediction game that makes prediction, football context and rivalry feel central rather than presenting them as a plain utility.

The first gold-standard vNext surface will be **Home**. It should establish the interaction and visual quality bar before that language is propagated to other screens.

Initial workshop/concept work should:

- use realistic mocked football, prediction and social data rather than binding the concepts to Supabase;
- preserve the existing backend, domain, scoring, authentication and service infrastructure as the future integration boundary;
- allow desktop and mobile to use materially different compositions when that uses the available space better;
- make recent form, head-to-head context, venue, team/shirt identity, live state, predictions and consensus easy to understand where they add value;
- make rival, league and comparison context feel like a first-class part of the game;
- use motion deliberately for hierarchy, state change and delight rather than adding constant decoration;
- feel substantially more expressive and premium than the current production UI.

FPL, Sky Bet and Netflix are useful **inspiration references** for product confidence, information hierarchy, browsing and content presentation. They are not component libraries or designs to copy.

## Boundaries for the next PR

The next vNext PR should be a design/workshop slice, not a backend rewrite. It may establish concepts, mocked states, Storybook/examples and a proposed frontend design language, but it must not silently change game rules or make mocked assumptions authoritative.

When real integration begins later:

- components should consume existing domain/read-model/service boundaries rather than call Supabase directly;
- backend authorities remain responsible for locks, official results, scoring, progression, reveal and access;
- provider enrichment remains provisional context unless a separate authority promotes a field to a stronger role;
- responsive, accessibility and reduced-motion behaviour are part of acceptance, not later polish.

## Where to go next

- vNext implementation scope: [`../../src/vnext/AGENTS.md`](../../src/vnext/AGENTS.md)
- legacy/current production UI maintenance: [`../design/README.md`](../design/README.md)
- product/rule decisions: [`../adr/README.md`](../adr/README.md)
- current moving state: [`../../NOW.md`](../../NOW.md)
- accepted but unimplemented requirements: [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md)
