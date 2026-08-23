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

const COMPETITION = {
  tournamentId: 'tournament-1',
  name: 'Scottish Premiership',
  seasonLabel: '2026/27',
  colours: { primary: '#0b2a4a', accent: '#7fc7ff' },
} as const

const SOURCE: ShellSource = {
  competition: COMPETITION,
  playerName: 'Rowan Adeyemi',
  outstandingPredictions: 3,
  canNavigateAway: true,
  elsewhere: null,
}

describe('the connected shell states one football context', () => {
  it('names the competition the page was addressed by, and only it', () => {
    const model = buildShellModel(SOURCE)

    expect(model.contexts).toHaveLength(1)
    expect(shellActiveContext(model)?.competition.name).toBe('Scottish Premiership')
    expect(shellActiveContext(model)?.competition.seasonLabel).toBe('2026/27')
    expect(shellActiveContext(model)?.relationship).toBe('playing')
  })

  it('is the one-competition shape, not a degraded one', () => {
    const model = buildShellModel(SOURCE)
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
      buildShellModel({ ...SOURCE, competition: { ...COMPETITION, colours: null } }),
    )?.competition.colours

    expect(colours).toBeDefined()
    expect(colours).not.toEqual(COMPETITION.colours)
  })

  it('derives a monogram from the competition’s own words', () => {
    expect(shellActiveContext(buildShellModel(SOURCE))?.competition.monogram).toBe('SP')
    expect(
      shellActiveContext(
        buildShellModel({
          ...SOURCE,
          competition: { ...COMPETITION, name: 'Bundesliga' },
        }),
      )?.competition.monogram,
    ).toBe('BU')
  })
})

describe('the connected shell invents nothing', () => {
  it('reports no cross-competition attention, because no read answers it', () => {
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
    expect(buildShellModel({ ...SOURCE, canNavigateAway: false }).discovery.reachable)
      .toBe(false)
  })
})

describe('the outstanding count rides on Games', () => {
  it('puts the badge on the destination the Match Predictor lives in', () => {
    const games = buildShellModel(SOURCE).destinations.find((entry) => entry.id === 'games')
    expect(games?.badge).toBe(3)

    for (const entry of buildShellModel(SOURCE).destinations) {
      if (entry.id !== 'games') expect(entry.badge).toBeUndefined()
    }
  })

  it('renders no badge at all for zero, and none for cannot say', () => {
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

  it.each([null, '', '   '])(
    'keeps the account control recognisable when the display name is %p',
    (playerName) => {
      const player = buildShellModel({ ...SOURCE, playerName }).player
      expect(player).toEqual({ name: 'Your account', initials: 'YA' })
      expect(player.initials).not.toMatch(/^\W$/)
    },
  )
})

describe('the shell can be chrome for a page outside every competition', () => {
  const PLATFORM: ShellSource = { ...SOURCE, competition: null }

  it('is in no context rather than in an invented one', () => {
    const model = buildShellModel(PLATFORM)
    expect(model.activeContextId).toBeNull()
    expect(shellActiveContext(model)).toBeNull()
  })

  it('offers no context to switch to, rather than a fabricated one', () => {
    expect(buildShellModel(PLATFORM).contexts).toEqual([])
  })

  it('still names the player, because the account control has to be nameable', () => {
    const model = buildShellModel(PLATFORM)
    expect(model.player.name).toBe('Rowan Adeyemi')
    expect(model.player.initials).toBe('RA')
  })

  it('still offers the four destinations, which are the product’s and not a competition’s', () => {
    expect(buildShellModel(PLATFORM).destinations.map((d) => d.id)).toEqual([
      'home',
      'matches',
      'games',
      'leagues',
    ])
  })

  it('carries discovery reachability unchanged', () => {
    expect(buildShellModel(PLATFORM).discovery.reachable).toBe(true)
    expect(buildShellModel({ ...PLATFORM, canNavigateAway: false }).discovery.reachable).toBe(false)
  })
})
