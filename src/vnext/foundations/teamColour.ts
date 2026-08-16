/**
 * Club colour as inline custom properties.
 *
 * The rule this exists to keep is the one `TeamCrest` already states: a club
 * colour comes from football, not from the theme, so it can never be a design
 * token. It lives in `foundations/` rather than beside one surface because
 * every vNext page that draws a fixture needs the same four properties read off
 * the same fixture — Home settled the question, and Match Centre, Matches and
 * the Predictor inherit the answer rather than each inventing one.
 *
 * THE PRINCIPLE HOME SETTLED. Team colour creates ATMOSPHERE; semantic colour
 * communicates STATE. A club playing in green never borrows the meaning of
 * `--vnext-hit`, and a club in red never borrows `--vnext-live`, because club
 * colour only ever arrives through these custom properties and only ever paints
 * fields, spines and washes — never a state chip, a badge or a border that says
 * something is live, late or correct.
 *
 * `onPrimary` is carried through rather than computed, for the same reason the
 * fixture states it: guessing it is guessing at a contrast failure. A surface
 * painting a large field in a club colour uses it to pick the text colour; a
 * surface using the colour as a hairline ignores it.
 */

import type { CSSProperties } from 'react'
import type { Team } from '../models/football'

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
 * colour from the inline end, for the surfaces that paint a whole fixture.
 */
export function fixtureColourStyle(home: Team, away: Team): CSSProperties {
  return {
    '--vnext-fixture-home': home.colours.primary,
    '--vnext-fixture-home-accent': home.colours.accent,
    '--vnext-fixture-away': away.colours.primary,
    '--vnext-fixture-away-accent': away.colours.accent,
  } as CSSProperties
}

/**
 * The competition's own two colours, for the page-level atmosphere.
 *
 * Same rule as a club colour and for the same reason: a competition's palette
 * is football, not theme, so it arrives per render rather than as a token. It
 * is used at very low opacity behind the whole surface and never on a control,
 * a chip or a border — an atmosphere the user should feel and not read.
 */
export function competitionColourStyle(colours: {
  readonly primary: string
  readonly accent: string
}): CSSProperties {
  return {
    '--vnext-competition-primary': colours.primary,
    '--vnext-competition-accent': colours.accent,
  } as CSSProperties
}
