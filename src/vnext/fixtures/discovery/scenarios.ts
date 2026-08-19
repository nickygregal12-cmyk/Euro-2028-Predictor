import type { DiscoverableSeason, DiscoveryPageModel } from '../../models/discovery'

/**
 * DISCOVERY'S DETERMINISTIC WORLDS.
 *
 * THE BINDING WORLD IS `followUnknown`. The preferences read failed and the
 * catalogue did not, so the page shows the list and offers no follow control at
 * all — because a Follow sent against an unknown state can land on a
 * competition the player already follows, and that write clears their favourite
 * club. A fixture that resolved the unknown into a yes or a no would hide the
 * one state this surface is careful about.
 */

const DISCOVERY_NOW = '2027-08-01T12:00:00.000Z'

function season(over: Partial<DiscoverableSeason> = {}): DiscoverableSeason {
  return {
    tournamentId: 't-1',
    competitionName: 'Caledonian Premiership',
    seasonName: 'Caledonian Premiership 2027/28',
    route: { competitionSlug: 'caledonian', seasonKey: '2027-28' },
    status: 'active',
    follow: 'not-following',
    ...over,
  }
}

const HIGHLAND = season({
  tournamentId: 't-2',
  competitionName: 'Highland League',
  seasonName: 'Highland League 2027/28',
  route: { competitionSlug: 'highland', seasonKey: '2027-28' },
})

const BORDER = season({
  tournamentId: 't-3',
  competitionName: 'Border League',
  seasonName: 'Border League 2027/28',
  route: { competitionSlug: 'border', seasonKey: '2027-28' },
  status: 'scheduled',
})

function world(overrides: Partial<DiscoveryPageModel> = {}): DiscoveryPageModel {
  return {
    generatedAt: DISCOVERY_NOW,
    catalogue: { kind: 'seasons', seasons: [season(), HIGHLAND, BORDER] },
    followKnowledge: 'known',
    ...overrides,
  }
}

/* ==========================================================================
   THE WORLDS
   ========================================================================== */

/** The ordinary visit: three published seasons, none followed. */
const catalogue = world()

/** One followed, two not. Both controls visible, and never on one row. */
const someFollowed = world({
  catalogue: {
    kind: 'seasons',
    seasons: [{ ...season(), follow: 'following' }, HIGHLAND, BORDER],
  },
})

/** Everything followed. Only Unfollow anywhere. */
const allFollowed = world({
  catalogue: {
    kind: 'seasons',
    seasons: [
      { ...season(), follow: 'following' },
      { ...HIGHLAND, follow: 'following' },
      { ...BORDER, follow: 'following' },
    ],
  },
})

/**
 * THE BINDING WORLD. The follow state is unknown, so NO follow control is
 * drawn on any row — and the page says why, because the absence of a control is
 * not self-explaining.
 */
const followUnknown = world({ followKnowledge: 'unknown' })

/** A season the catalogue gives no status. The page prints nothing rather than a word. */
const noStatus = world({
  catalogue: { kind: 'seasons', seasons: [season({ status: null }), HIGHLAND] },
})

/** The platform publishes nothing. A real answer about the platform. */
const nothingPublished = world({ catalogue: { kind: 'empty' } })

/** The catalogue read failed. Different from publishing nothing. */
const unavailable = world({ catalogue: { kind: 'unavailable' } })

/** Long names and a fuller catalogue, for the width tests. */
const wideCatalogue = world({
  catalogue: {
    kind: 'seasons',
    seasons: [
      season({
        competitionName: 'Royal Caledonian and Borders Championship Premier Division',
        seasonName: 'Royal Caledonian and Borders Championship Premier Division 2027/28',
        follow: 'following',
      }),
      HIGHLAND,
      BORDER,
      season({
        tournamentId: 't-4',
        competitionName: 'Island League',
        seasonName: 'Island League 2027/28',
        route: { competitionSlug: 'island', seasonKey: '2027-28' },
      }),
      season({
        tournamentId: 't-5',
        competitionName: 'Lowland League',
        seasonName: 'Lowland League 2027/28',
        route: { competitionSlug: 'lowland', seasonKey: '2027-28' },
        status: null,
      }),
    ],
  },
})

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const discoveryScenarios = {
  catalogue,
  someFollowed,
  allFollowed,
  followUnknown,
  noStatus,
  nothingPublished,
  unavailable,
  wideCatalogue,
} as const

export type DiscoveryScenarioName = keyof typeof discoveryScenarios

export const discoveryScenarioNames = Object.keys(discoveryScenarios) as DiscoveryScenarioName[]

export const discoveryScenarioPremises: Readonly<Record<DiscoveryScenarioName, string>> = {
  catalogue: 'The ordinary visit. Three published seasons, none of them followed.',
  someFollowed:
    'One followed, two not. Follow and Unfollow both appear on the page and never together on one row — a toggle is the shape that re-sends a follow, and a re-sent follow clears the player’s favourite club.',
  allFollowed: 'Everything followed. Only Unfollow anywhere.',
  followUnknown:
    'THE binding world. The preferences read failed and the catalogue did not, so the list is shown and NO follow control is drawn — a Follow against an unknown state can land on a competition already followed, and that write discards a favourite. The page says why, because a missing control does not explain itself.',
  noStatus: 'A season the catalogue gives no status. Nothing is printed rather than a word invented.',
  nothingPublished: 'The platform publishes nothing. A real answer about the platform.',
  unavailable: 'The catalogue read did not answer. Different from publishing nothing.',
  wideCatalogue: 'Five seasons and a very long competition name. The width test.',
}
