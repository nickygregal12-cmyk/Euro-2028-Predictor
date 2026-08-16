/**
 * Club colour as inline custom properties.
 *
 * The rule this exists to keep is the one `TeamCrest` already states: a club
 * colour comes from football, not from the theme, so it can never be a design
 * token. All three concepts answer the workshop's open "how strongly should
 * team colour influence a fixture?" question differently, and they can only do
 * that honestly if they are all reading the SAME colours off the SAME fixture.
 *
 * `onPrimary` is carried through rather than computed, for the same reason the
 * fixture states it: guessing it is guessing at a contrast failure. A concept
 * painting a large field in a club colour uses it to pick the text colour; a
 * concept using the colour as a hairline ignores it.
 */

import type { CSSProperties } from 'react'
import type { Team } from '../../models/football'

/** The four properties every vNext surface reads a club colour from. */
export function teamColourStyle(team: Team): CSSProperties {
  return {
    '--vnext-team-primary': team.colours.primary,
    '--vnext-team-secondary': team.colours.secondary,
    '--vnext-team-accent': team.colours.accent,
    '--vnext-team-on-primary':
      team.colours.onPrimary === 'dark'
        ? 'var(--vnext-canvas-deep)'
        : 'var(--vnext-text-on-live)',
  } as CSSProperties
}

/**
 * A two-club field: the home colour entering from the inline start and the away
 * colour from the inline end, for the concepts that paint a whole fixture.
 */
export function fixtureColourStyle(home: Team, away: Team): CSSProperties {
  return {
    '--vnext-fixture-home': home.colours.primary,
    '--vnext-fixture-home-accent': home.colours.accent,
    '--vnext-fixture-away': away.colours.primary,
    '--vnext-fixture-away-accent': away.colours.accent,
  } as CSSProperties
}
