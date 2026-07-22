import { describe, it, expect } from 'vitest'
import {
  nextStageFromStatus,
  groupCompletion,
  nextStagePath,
  nextStageLabel,
  type NextStage,
} from '../../../src/features/predict/entryFlow'
import type { HubStatus } from '../../../src/features/predict/hubStatus'
import type { TournamentData, Match } from '../../../src/services/supabase/tournamentData'
import type { Prediction } from '../../../src/app/providers/PredictionsProvider'

// A hub status with only the fields nextStageFromStatus reads (third-place state
// + bracket picks); the rest are filled to satisfy the type.
function status(over: {
  thirdState?: HubStatus['thirdPlace']['state']
  bracketPicked?: number
}): HubStatus {
  return {
    groups: { predicted: 36, total: 36, complete: true },
    thirdPlace: { state: over.thirdState ?? 'settled', tieCount: 0 },
    bracket: { picked: over.bracketPicked ?? 15, total: 15 },
    jokers: { placed: 0, total: 5 },
    reviewUnlocked: true,
    overallPercent: 100,
  }
}

const allGroupsDone = ['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => ({ letter, complete: true }))

describe('nextStageFromStatus', () => {
  it('points to the first incomplete group in A–F order', () => {
    const groups = [
      { letter: 'A', complete: true },
      { letter: 'B', complete: true },
      { letter: 'C', complete: false },
      { letter: 'D', complete: false },
    ]
    expect(nextStageFromStatus(groups, status({}))).toEqual({ kind: 'group', letter: 'C' })
  })

  it('third-place while ties are pending (all groups done)', () => {
    expect(nextStageFromStatus(allGroupsDone, status({ thirdState: 'ties' }))).toEqual({
      kind: 'third',
    })
  })

  it('bracket — not started — once groups + thirds are settled', () => {
    expect(
      nextStageFromStatus(allGroupsDone, status({ thirdState: 'settled', bracketPicked: 0 })),
    ).toEqual({ kind: 'bracket', started: false })
  })

  it('bracket — started — when partially picked', () => {
    expect(
      nextStageFromStatus(allGroupsDone, status({ thirdState: 'settled', bracketPicked: 7 })),
    ).toEqual({ kind: 'bracket', started: true })
  })

  it('review once everything is complete', () => {
    expect(
      nextStageFromStatus(allGroupsDone, status({ thirdState: 'settled', bracketPicked: 15 })),
    ).toEqual({ kind: 'review' })
  })

  it('groups take priority over a settled-looking later stage', () => {
    const groups = [
      { letter: 'A', complete: true },
      { letter: 'B', complete: false },
    ]
    expect(
      nextStageFromStatus(groups, status({ thirdState: 'settled', bracketPicked: 15 })),
    ).toEqual({ kind: 'group', letter: 'B' })
  })
})

describe('groupCompletion', () => {
  const mk = (id: string, groupId: string | null, round: Match['round'] = 'group'): Match => ({
    id,
    matchRef: id,
    round,
    groupId,
    matchday: 1,
    homeSource: '',
    awaySource: '',
    homeTeamId: null,
    awayTeamId: null,
    matchDate: '2028-06-09',
    kickoffAt: null,
    venue: '',
    homeScore: null,
    awayScore: null,
  })
  const data = {
    tournament: { id: 't', name: 'T', year: 2028, startsOn: null, endsOn: null, lockAt: null },
    // deliberately out of order to prove the A–F sort
    groups: [
      { id: 'gB', letter: 'B' },
      { id: 'gA', letter: 'A' },
    ],
    teams: [],
    matches: [mk('a1', 'gA'), mk('a2', 'gA'), mk('b1', 'gB'), mk('k1', null, 'r16')],
  } satisfies TournamentData

  const preds = (scored: Record<string, boolean>) => (matchId: string): Prediction =>
    scored[matchId]
      ? { homeScore: 1, awayScore: 0, joker: false }
      : { homeScore: null, awayScore: null, joker: false }

  it('returns groups in A–F order with per-group completeness', () => {
    // A fully scored, B not.
    const result = groupCompletion(data, preds({ a1: true, a2: true }))
    expect(result).toEqual([
      { letter: 'A', complete: true },
      { letter: 'B', complete: false },
    ])
  })

  it('a group with a half-predicted match is incomplete', () => {
    const result = groupCompletion(data, preds({ a1: true, a2: false, b1: true }))
    expect(result.find((g) => g.letter === 'A')?.complete).toBe(false)
    expect(result.find((g) => g.letter === 'B')?.complete).toBe(true)
  })
})

describe('nextStagePath', () => {
  it('maps each stage to its route', () => {
    expect(nextStagePath({ kind: 'group', letter: 'D' })).toBe('/predict/groups/D')
    expect(nextStagePath({ kind: 'third' })).toBe('/predict/third-place')
    expect(nextStagePath({ kind: 'bracket', started: true })).toBe('/predict/bracket')
    expect(nextStagePath({ kind: 'review' })).toBe('/predict/review')
  })
})

describe('nextStageLabel', () => {
  const cases: [NextStage, string, string][] = [
    [{ kind: 'group', letter: 'B' }, 'Continue to Group B →', 'Next: Group B →'],
    [{ kind: 'third' }, 'Best third-placed teams →', 'Next: Best third-placed teams →'],
    [{ kind: 'bracket', started: false }, 'Start your bracket →', 'Next: Knockout bracket →'],
    [{ kind: 'bracket', started: true }, 'Continue your bracket →', 'Next: Knockout bracket →'],
    [{ kind: 'review' }, 'Review your entry →', 'Next: Review →'],
  ]
  it('uses action wording when editable', () => {
    for (const [stage, open] of cases) expect(nextStageLabel(stage, false)).toBe(open)
  })
  it('uses neutral "Next:" wording when locked (no implied editability)', () => {
    for (const [stage, , locked] of cases) expect(nextStageLabel(stage, true)).toBe(locked)
  })
})
