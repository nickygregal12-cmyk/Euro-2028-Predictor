import { describe, expect, it } from 'vitest'
import {
  type CupPhasePage,
  type CupTableRow,
  presentCupPhase,
} from '../../../src/features/season/cupPhaseModel'

/**
 * The Championship phase presentation: shows what the server ranked, discloses
 * no identity, and never turns the split into an elimination.
 */

function row(overrides: Partial<CupTableRow> = {}): CupTableRow {
  return {
    userId: 'entrant-1',
    isYou: false,
    groupRank: 1,
    tablePoints: 9,
    pointsFor: 41,
    pointsAgainst: 30,
    windowPoints: 41,
    exacts: 3,
    corrects: 8,
    scorelineError: 12,
    ...overrides,
  }
}

function page(overrides: Partial<CupPhasePage> = {}): CupPhasePage {
  return {
    competitionId: 'competition-1',
    entered: true,
    phaseKind: 'initial',
    tableSource: 'season_initial',
    group: {
      id: 'group-1',
      ordinal: 1,
      size: 6,
      phaseKind: 'initial',
      parentGroupId: null,
    },
    table: [
      row(),
      row({
        userId: 'you',
        isYou: true,
        groupRank: 2,
        tablePoints: 7,
        pointsFor: 38,
        pointsAgainst: 33,
      }),
    ],
    ...overrides,
  }
}

describe('presentCupPhase', () => {
  it('presents nothing for a non-entrant', () => {
    const presentation = presentCupPhase(
      page({ entered: false, phaseKind: null, tableSource: null, group: null, table: [] }),
    )

    expect(presentation.phaseLine).toBeNull()
    expect(presentation.phaseExplanation).toBeNull()
    expect(presentation.groupLine).toBeNull()
    expect(presentation.tableSourceLine).toBeNull()
    expect(presentation.rows).toEqual([])
  })

  it('names the league phase without a split explanation', () => {
    const presentation = presentCupPhase(page())

    expect(presentation.phaseLine).toBe('League phase')
    expect(presentation.phaseExplanation).toBeNull()
    expect(presentation.groupLine).toBe('Group of 6.')
  })

  // Contract 169. The two initial-phase authorities measure different spans,
  // which is the whole reason the second one was written, so the surface names
  // the one that answered rather than leaving a reader to assume.
  it('names the authority the server said produced the table', () => {
    expect(presentCupPhase(page()).tableSourceLine).toBe(
      'Ranked by the season group table.',
    )
    expect(
      presentCupPhase(page({ tableSource: 'tournament_initial' })).tableSourceLine,
    ).toBe('Ranked by the tournament group table.')
    expect(
      presentCupPhase(
        page({
          phaseKind: 'split',
          tableSource: 'split',
          group: {
            id: 'group-2',
            ordinal: 1,
            size: 3,
            phaseKind: 'split',
            parentGroupId: 'group-1',
          },
        }),
      ).tableSourceLine,
    ).toBe('Ranked by the split group table.')
  })

  it('says nothing at all when the source is one this build does not know', () => {
    // A label is a claim about provenance. An unrecognised token means the
    // server has an authority this build has never heard of, and guessing which
    // of the known ones it resembles is exactly the inference contract 169
    // removed from the browser.
    expect(presentCupPhase(page({ tableSource: null })).tableSourceLine).toBeNull()
  })

  it('makes no span claim of its own in the group line', () => {
    // It used to end "ranked from settled rounds", which is a statement about
    // the span — and the span is the thing that differs between authorities.
    expect(presentCupPhase(page()).groupLine).not.toMatch(/settled|round|matchday/i)
  })

  it('explains the split as a continuation, never an elimination', () => {
    const presentation = presentCupPhase(
      page({
        phaseKind: 'split',
        group: {
          id: 'group-2',
          ordinal: 1,
          size: 3,
          phaseKind: 'split',
          parentGroupId: 'group-1',
        },
      }),
    )

    expect(presentation.phaseLine).toBe('The split')
    expect(presentation.phaseExplanation).toContain('Points carry through')
    expect(presentation.phaseExplanation).toContain('nobody is eliminated')
    expect(presentation.phaseExplanation).not.toMatch(/you (were|are) eliminated/i)
  })

  it('labels rows without disclosing any identity', () => {
    const presentation = presentCupPhase(page())

    expect(presentation.rows.map((r) => r.label)).toEqual(['Entrant', 'You'])
    // The raw identifier is a key, never rendered text.
    for (const presented of presentation.rows) {
      expect(presented.accessibleSummary).not.toContain('entrant-1')
    }
    expect(presentation.rows[0].accessibleSummary).toBe(
      'An entrant, 1, 9 table points, 41 for, 30 against',
    )
    expect(presentation.rows[1].accessibleSummary).toBe(
      'You, 2, 7 table points, 38 for, 33 against',
    )
  })

  it('marks shared ranks the server assigned, deriving nothing itself', () => {
    const presentation = presentCupPhase(
      page({
        table: [
          row(),
          row({ userId: 'entrant-2', groupRank: 2 }),
          row({ userId: 'you', isYou: true, groupRank: 2, tablePoints: 7 }),
          row({ userId: 'entrant-4', groupRank: 4 }),
        ],
      }),
    )

    expect(presentation.rows.map((r) => r.rankLabel)).toEqual(['1', '=2', '=2', '4'])
    expect(presentation.rows[1].accessibleSummary).toContain('joint 2')
  })
})
