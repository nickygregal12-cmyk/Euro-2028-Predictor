import { describe, expect, it } from 'vitest'
import { buildShellModel } from '../../src/vnext/integration/shell/buildShellModel'
import type { ShellSource } from '../../src/vnext/integration/shell/shellSource'
import {
  attentionElsewhere,
  shellActiveContext,
  shellJumpAvailable,
  shellSwitchable,
} from '../../src/vnext/models/shell'

/**
 * WHAT THE CONNECTED SHELL SAYS, AND WHAT IT REFUSES TO SAY.
 *
 * `buildShellModel` is the whole of the Stage 7.6 integration: one competition
 * in, one shell model out, pure. It has no network, no storage, no clock and no
 * React, so every case below is a plain function call — the same split that
 * makes `buildHomeModel` and `buildPredictorModel` testable without Supabase.
 *
 * HALF THIS SUITE IS ABOUT WHAT IS ABSENT. The application cannot currently
 * answer a cross-competition attention summary or the player's whole
 * competition list from where a connected vNext page stands, and §9 and §26 of
 * the brief forbid adding a read to make it. The honest failure mode is a
 * mapper that invents a plausible-looking default; these assertions are what
 * makes that fail loudly instead of shipping.
 */

const SOURCE: ShellSource = {
  competition: {
    tournamentId: 'tournament-1',
    name: 'Scottish Premiership',
    seasonLabel: '2026/27',
    colours: { primary: '#0b2a4a', accent: '#7fc7ff' },
  },
  playerName: 'Rowan Adeyemi',
  outstandingPredictions: 3,
  canNavigateAway: true,
}

describe('the connected shell states one football context', () => {
  it('names the competition the page was addressed by, and only it', () => {
    const model = buildShellModel(SOURCE)

    expect(model.contexts).toHaveLength(1)
    expect(shellActiveContext(model)?.competition.name).toBe('Scottish Premiership')
    expect(shellActiveContext(model)?.competition.seasonLabel).toBe('2026/27')
    // The page was reached BY this competition's play context, which the
    // application only answers for a competition the player is in.
    expect(shellActiveContext(model)?.relationship).toBe('playing')
  })

  it('is the one-competition shape, not a degraded one', () => {
    const model = buildShellModel(SOURCE)

    // No switcher, no shortcut group, no accelerator — because the application
    // has not claimed there is anything to switch to.
    expect(shellSwitchable(model)).toBe(false)
    expect(shellJumpAvailable(model)).toBe(false)
  })

  it('carries the competition’s own palette rather than a house one', () => {
    expect(shellActiveContext(buildShellModel(SOURCE))?.competition.colours).toEqual({
      primary: '#0b2a4a',
      accent: '#7fc7ff',
    })
  })

  it('paints an unknown competition neutrally rather than in the launch colours', () => {
    const colours = shellActiveContext(
      buildShellModel({ ...SOURCE, competition: { ...SOURCE.competition, colours: null } }),
    )?.competition.colours

    expect(colours).toBeDefined()
    expect(colours).not.toEqual(SOURCE.competition.colours)
  })

  it('derives a monogram from the competition’s own words', () => {
    expect(shellActiveContext(buildShellModel(SOURCE))?.competition.monogram).toBe('SP')
    expect(
      shellActiveContext(
        buildShellModel({
          ...SOURCE,
          competition: { ...SOURCE.competition, name: 'Bundesliga' },
        }),
      )?.competition.monogram,
    ).toBe('BU')
  })
})

describe('the connected shell invents nothing', () => {
  it('reports no cross-competition attention, because no read answers it', () => {
    // THE INTEGRATION GAP, AS DATA. An attention item derived from a deadline in
    // the page's own model would be presentation asserting something the
    // application never said — and it would look entirely plausible.
    const model = buildShellModel(SOURCE)
    expect(model.attention).toEqual([])
    expect(attentionElsewhere(model)).toEqual([])
  })

  it('claims no games and no private leagues it was not handed', () => {
    const context = shellActiveContext(buildShellModel(SOURCE))
    expect(context?.games).toEqual([])
    expect(context?.leagues).toEqual([])
  })

  it('states no tempo, because the shell has no read for one', () => {
    // Home answers "is football happening here" INSIDE the page. The chrome
    // saying it too would be Home's job leaking upwards, and guessing it would
    // be worse.
    expect(shellActiveContext(buildShellModel(SOURCE))?.tempoLabel).toBeNull()
  })

  it('promises no catalogue size it did not count', () => {
    expect(buildShellModel(SOURCE).discovery.catalogueSize).toBeNull()
  })
})

describe('discovery follows the host, not the shell', () => {
  it('offers discovery where the host can act on it', () => {
    expect(buildShellModel(SOURCE).discovery.reachable).toBe(true)
  })

  it('offers none where the host has nowhere to send the player', () => {
    // A control that exists and refuses teaches a player the product is broken —
    // the same rule `PlayerReach` records for a name with no address.
    expect(buildShellModel({ ...SOURCE, canNavigateAway: false }).discovery.reachable)
      .toBe(false)
  })
})

describe('the outstanding count rides on Games', () => {
  it('puts the badge on the destination the Match Predictor lives in', () => {
    const games = buildShellModel(SOURCE).destinations.find((entry) => entry.id === 'games')
    expect(games?.badge).toBe(3)

    // And nowhere else. Under Stage 5's platform navigation it rode on
    // `Fixtures`, beside the football; the Competition Deck separates the two.
    for (const entry of buildShellModel(SOURCE).destinations) {
      if (entry.id !== 'games') expect(entry.badge).toBeUndefined()
    }
  })

  it('renders no badge at all for zero, and none for "cannot say"', () => {
    // `null` is never zero and zero is never a badge: a navigation item marked
    // "0" is an item that has to be read every time to learn it has nothing to
    // say.
    for (const outstanding of [0, null]) {
      const model = buildShellModel({ ...SOURCE, outstandingPredictions: outstanding })
      expect(model.destinations.every((entry) => entry.badge === undefined)).toBe(true)
    }
  })
})

describe('the player is presentation and never an identity', () => {
  it('uses the name the auth authority stated', () => {
    expect(buildShellModel(SOURCE).player).toEqual({
      name: 'Rowan Adeyemi',
      initials: 'RA',
    })
  })

  it('names the control rather than inventing a person when there is no name', () => {
    const player = buildShellModel({ ...SOURCE, playerName: null }).player
    expect(player.name).toBe('Your account')
    expect(player.initials).toBe('·')
  })
})
