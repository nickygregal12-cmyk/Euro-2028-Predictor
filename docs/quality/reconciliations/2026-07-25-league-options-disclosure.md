# A11Y-002 — league options disclosure semantics

**Date:** 25 July 2026  
**Issue:** #75

## Finding

The risk register still describes the league options control as requiring either a full ARIA menu-button model or simpler disclosure semantics.

## Current implementation

`src/features/leagues/LeagueOptionsDisclosure.tsx` already implements the simpler disclosure model:

- the trigger is a native button with `aria-expanded` and `aria-controls`;
- the revealed actions remain ordinary native buttons;
- no `menu`, `menuitem` or `aria-haspopup` semantics are used;
- Escape closes the disclosure and restores focus to the trigger;
- pointer interaction outside the disclosure closes it;
- activating an action closes the disclosure before running the action.

`tests/features/leagues/LeagueOptionsDisclosure.test.tsx` verifies the disclosure semantics, absence of menu roles, owner/member actions, Escape focus restoration and outside-pointer closure.

## Verdict

`A11Y-002` is resolved in repository code and tests. No application, database, scoring, production or hosted configuration change is required. Reopen only if the control regresses to misleading menu semantics or loses the tested keyboard/focus behaviour.
