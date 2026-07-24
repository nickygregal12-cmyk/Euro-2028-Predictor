# League options disclosure reconciliation

**Date:** 24 July 2026  
**Finding:** `A11Y-002`  
**Scope:** League-detail owner/member action control.

## Previous mismatch

The control declared `aria-haspopup="menu"`, `role="menu"` and `role="menuitem"`, but implemented only click selection, outside close and Escape. It did not implement the keyboard focus and arrow-key model expected of an ARIA menu.

## Implemented

- replaced the incomplete menu pattern with a disclosure pattern;
- the trigger exposes `aria-expanded` and `aria-controls`;
- revealed actions remain ordinary native buttons;
- misleading menu/menuitem roles are removed;
- outside pointer interaction closes the disclosure;
- Escape closes it and restores focus to the trigger;
- owner transfer/delete and member leave confirmation flows are unchanged.

## Executable evidence

`tests/features/leagues/LeagueOptionsDisclosure.test.tsx` verifies:

- disclosure state and controlled panel relationship;
- absence of `aria-haspopup`, menu and menuitem semantics;
- owner and member action rendering;
- member action execution and close;
- Escape close with trigger focus restoration;
- outside pointer close.

The implementation head passed dependency installation, both Netlify prebuild guards, production build, lint, the complete test suite and production dependency audit.

## Hosted evidence

Deploy preview `6a6339743b4b2a0008b077c0` reached ready state with:

- performance: 98;
- accessibility: 100;
- best practices: 100;
- SEO: 100.

## Status

`A11Y-002` is resolved. Reopen if the control again advertises menu semantics without implementing the complete menu interaction model, or if Escape/focus restoration regresses.

## Safety boundary

No Supabase project, Auth setting, database schema, migration history, production data, Netlify environment variable, deployment contract or legacy World Cup environment changed.
