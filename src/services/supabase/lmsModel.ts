// Pure response parsing for the Last Man Standing read (contract 53).

import type { LmsFixtureRead } from '../../domain/competitions/lmsSelection'
import type { EntrantOutcome } from '../../domain/competitions/competitionModel'

export type LmsSelectionRead = {
  teamId: string
  version: number
}

export type LmsWindowRead = {
  id: string
  sequence: number
  label: string
  opensAt: string | null
  locksAt: string | null
  settlesAt: string | null
  mySelection: LmsSelectionRead | null
  fixtures: LmsFixtureRead[]
}

export type LmsRead = {
  serverNow: string
  competitionId: string
  entrant: { joinedAt: string; outcome: EntrantOutcome } | null
  entrantCount: number
  remainingCount: number
  usedTeamIds: string[]
  windows: LmsWindowRead[]
}

const OUTCOMES: readonly EntrantOutcome[] = [
  'active',
  'qualified',
  'survived',
  'eliminated',
  'champion',
]

const RESULT_STATES = ['scheduled', 'confirmed', 'corrected'] as const

function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Last Man Standing returned an invalid record.')
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Last Man Standing returned an invalid ${field}.`)
  }
  return value
}

function textOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  return text(value, field)
}

function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Last Man Standing returned an invalid ${field}.`)
  }
  return value
}

function scoreOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null
  return count(value, field)
}

function arrayOf(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Last Man Standing returned an invalid ${field}.`)
  }
  return value
}

function fixtureOf(value: unknown): LmsFixtureRead {
  const row = recordOf(value)
  const resultState = text(row.result_state, 'fixture result state')
  if (!(RESULT_STATES as readonly string[]).includes(resultState)) {
    throw new Error('Last Man Standing returned an unknown fixture result state.')
  }
  return {
    matchId: text(row.match_id, 'fixture match id'),
    round: text(row.round, 'fixture round'),
    kickoffAt: textOrNull(row.kickoff_at, 'fixture kickoff'),
    homeTeamId: textOrNull(row.home_team_id, 'fixture home team'),
    awayTeamId: textOrNull(row.away_team_id, 'fixture away team'),
    resultState: resultState as LmsFixtureRead['resultState'],
    homeScore: scoreOrNull(row.home_score, 'fixture home score'),
    awayScore: scoreOrNull(row.away_score, 'fixture away score'),
    winnerTeamId: textOrNull(row.winner_team_id, 'fixture winner'),
  }
}

export function mapLmsResponse(value: unknown): LmsRead {
  const root = recordOf(value)

  const serverNow = text(root.server_now, 'server time')
  if (Number.isNaN(new Date(serverNow).getTime())) {
    throw new Error('Last Man Standing returned an invalid server time.')
  }

  let entrant: LmsRead['entrant'] = null
  if (root.entrant !== null && root.entrant !== undefined) {
    const row = recordOf(root.entrant)
    const outcome = text(row.outcome, 'entrant outcome')
    if (!(OUTCOMES as readonly string[]).includes(outcome)) {
      throw new Error('Last Man Standing returned an unknown entrant outcome.')
    }
    entrant = {
      joinedAt: text(row.joined_at, 'entrant joined instant'),
      outcome: outcome as EntrantOutcome,
    }
  }

  const windows = arrayOf(root.windows, 'window list').map((entry): LmsWindowRead => {
    const row = recordOf(entry)
    let mySelection: LmsSelectionRead | null = null
    if (row.my_selection !== null && row.my_selection !== undefined) {
      const selection = recordOf(row.my_selection)
      mySelection = {
        teamId: text(selection.team_id, 'selection team'),
        version: count(selection.version, 'selection version'),
      }
    }
    return {
      id: text(row.id, 'window id'),
      sequence: count(row.sequence, 'window sequence'),
      label: text(row.label, 'window label'),
      opensAt: textOrNull(row.opens_at, 'window open instant'),
      locksAt: textOrNull(row.locks_at, 'window deadline'),
      settlesAt: textOrNull(row.settles_at, 'window settle instant'),
      mySelection,
      fixtures: arrayOf(row.fixtures, 'window fixtures').map(fixtureOf),
    }
  })

  return {
    serverNow,
    competitionId: text(root.competition_id, 'competition id'),
    entrant,
    entrantCount: count(root.entrant_count, 'entrant count'),
    remainingCount: count(root.remaining_count, 'remaining count'),
    usedTeamIds: arrayOf(root.used_team_ids, 'used team list').map((team) =>
      text(team, 'used team'),
    ),
    windows,
  }
}
