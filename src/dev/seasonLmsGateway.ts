import type {
  EntryOutcome,
  LmsRoundPage,
  PickOutcome,
  SeasonLmsGateway,
} from '../features/season/lmsRoundModel'

/**
 * A fixture-backed gateway for the season Last Man Standing round.
 *
 * The states worth driving here are the ones a healthy database will not
 * produce on demand: an eliminated entrant, a locked round, a drawn pick (the
 * case the surface must NOT read as an elimination), a reused club and a server
 * that refuses the write. Waiting for a real season to reach each of them is
 * not a review strategy.
 *
 * The shapes it returns are the contract-116 payload's, already mapped — this
 * stands in for the gateway, not for the RPC, so the page and hook see exactly
 * what they will see in production.
 */

export type LmsScenario =
  | 'healthy'
  | 'already_picked'
  | 'drew'
  | 'eliminated'
  | 'locked'
  | 'not_entered'
  | 'not_launched'
  | 'used_clubs'
  | 'save_refused'
  | 'version_conflict'

const CLUBS: readonly (readonly [string, string])[] = [
  ['arsenal', 'Arsenal'],
  ['newcastle', 'Newcastle'],
  ['crystal-palace', 'Crystal Palace'],
  ['brentford', 'Brentford'],
  ['manchester-city', 'Manchester City'],
  ['nottingham-forest', 'Nottingham Forest'],
]

function conflictError() {
  // Shaped like PostgREST's PT409 so `isVersionConflict` classifies it exactly
  // as it will in production.
  return Object.assign(new Error('selection version conflict'), { code: 'PT409' })
}

export function createDevSeasonLmsGateway(
  scenario: LmsScenario = 'healthy',
  now: () => Date = () => new Date(),
): SeasonLmsGateway {
  let picked: string | null = scenario === 'already_picked' || scenario === 'drew' ? 'arsenal' : null

  const build = (): LmsRoundPage => {
    const at = now().getTime()
    const locked = scenario === 'locked'
    const used = new Set(scenario === 'used_clubs' ? ['arsenal', 'crystal-palace'] : [])
    if (picked) used.add(picked)

    const entryOutcome: EntryOutcome | null =
      scenario === 'not_entered' ? null : scenario === 'eliminated' ? 'eliminated' : 'active'
    const pickOutcome: PickOutcome | null = scenario === 'drew' ? 'drew' : null

    const club = (id: string, name: string) => ({ teamId: id, name, used: used.has(id) })

    return {
      available: scenario !== 'not_launched',
      entered: scenario !== 'not_entered',
      entryOutcome,
      round:
        scenario === 'not_launched'
          ? null
          : {
              windowId: 'window-2',
              sequence: 2,
              label: 'Matchweek 2',
              opensAt: new Date(at - 86_400_000).toISOString(),
              locksAt: new Date(at + (locked ? -3_600_000 : 172_800_000)).toISOString(),
            },
      fixtures:
        scenario === 'not_launched'
          ? []
          : [
              {
                fixtureId: 'f1',
                kickoffAt: new Date(at + 172_800_000).toISOString(),
                status: 'scheduled',
                home: club(...CLUBS[0]),
                away: club(...CLUBS[1]),
                score: null,
              },
              {
                fixtureId: 'f2',
                kickoffAt: new Date(at + 176_400_000).toISOString(),
                status: 'scheduled',
                home: club(...CLUBS[2]),
                away: club(...CLUBS[3]),
                score: null,
              },
              {
                fixtureId: 'f3',
                kickoffAt: new Date(at + 180_000_000).toISOString(),
                status: 'scheduled',
                home: club(...CLUBS[4]),
                away: club(...CLUBS[5]),
                score: null,
              },
            ],
      pick: picked ? { teamId: picked } : null,
      pickOutcome,
    }
  }

  return {
    async load(): Promise<LmsRoundPage> {
      return build()
    },
    async pick(teamId: string): Promise<void> {
      if (scenario === 'version_conflict') throw conflictError()
      if (scenario === 'save_refused') {
        // Carries the errcode PostgREST surfaces, because `lmsRefusal`
        // classifies by code and a fixture without one would exercise the
        // fallback instead of the path production takes.
        throw Object.assign(new Error('Each team can only be used once in Last Man Standing'), {
          code: '23505',
        })
      }
      picked = teamId
    },
  }
}
