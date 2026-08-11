import type {
  CupPhasePage,
  CupTableRow,
  SeasonCupGateway,
} from '../features/season/cupPhaseModel'

/**
 * A fixture-backed gateway for the Predictor Championship phase.
 *
 * The state that matters most is `split`: hosted development has never
 * produced a populated split group — the phase-transition driver that creates
 * one is still unbuilt — so this harness is currently the only place a
 * reviewer can see the split rendering at all, and the sentence it must get
 * right is that the split is a continuation, never an elimination.
 *
 * The shapes it returns are the contract-120 payload's, already mapped — this
 * stands in for the gateway, not for the RPC, so the page and hook see exactly
 * what they will see in production.
 */

export type CupScenario =
  | 'initial'
  | 'split'
  | 'tied_ranks'
  | 'empty_table'
  | 'not_entered'
  | 'load_failed'

const COMPETITION_ID = 'dev-cup-competition'
const GROUP_ID = 'dev-cup-group'
const PARENT_GROUP_ID = 'dev-cup-parent-group'

function row(
  ordinal: number,
  overrides: Partial<CupTableRow> = {},
): CupTableRow {
  return {
    userId: `entrant-${ordinal}`,
    isYou: false,
    groupRank: ordinal,
    tablePoints: 12 - ordinal * 2,
    pointsFor: 46 - ordinal * 3,
    pointsAgainst: 30 + ordinal * 2,
    windowPoints: 46 - ordinal * 3,
    exacts: Math.max(4 - ordinal, 0),
    corrects: 9 - ordinal,
    scorelineError: 10 + ordinal * 2,
    ...overrides,
  }
}

export function createDevSeasonCupGateway(
  scenario: CupScenario = 'initial',
): SeasonCupGateway {
  const build = (): CupPhasePage => {
    if (scenario === 'not_entered') {
      return {
        competitionId: COMPETITION_ID,
        entered: false,
        phaseKind: null,
        tableSource: null,
        group: null,
        table: [],
      }
    }

    const split = scenario === 'split'
    const table: readonly CupTableRow[] =
      scenario === 'empty_table'
        ? []
        : scenario === 'tied_ranks'
          ? [
              row(1),
              // Two rows the authority ranked level: both show "=2".
              row(2, { userId: 'entrant-2', groupRank: 2 }),
              row(3, { userId: 'you', isYou: true, groupRank: 2, tablePoints: 8 }),
              row(4),
            ]
          : split
            ? [
                row(1),
                row(2, { userId: 'you', isYou: true }),
                row(3),
                row(4),
              ]
            : [
                row(1),
                row(2),
                row(3, { userId: 'you', isYou: true }),
                row(4),
                row(5),
                row(6),
              ]

    return {
      competitionId: COMPETITION_ID,
      entered: true,
      phaseKind: split ? 'split' : 'initial',
      // Contract 169. A season Championship is what this harness stands for, so
      // the initial phase is the SEASON authority — the one contract 169 added.
      // The tournament label is exercised by the model's own suite rather than
      // by inventing a tournament scenario here, because this gateway describes
      // a season competition and a tournament one would be a different fixture.
      tableSource: split ? 'split' : 'season_initial',
      group: {
        id: GROUP_ID,
        ordinal: 1,
        size: split ? 4 : 6,
        phaseKind: split ? 'split' : 'initial',
        parentGroupId: split ? PARENT_GROUP_ID : null,
      },
      table,
    }
  }

  return {
    async load(): Promise<CupPhasePage> {
      if (scenario === 'load_failed') {
        throw new Error('The Predictor Championship response was not in the expected shape.')
      }
      return build()
    },
  }
}
