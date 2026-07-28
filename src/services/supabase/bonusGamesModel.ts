// Pure response parsing for the Games hub read (contract 50). No Supabase
// client, no clock — strict shape validation that fails closed on anything the
// contract does not promise.

import type {
  BonusGameKey,
  CompetitionEntrant,
  CompetitionRecord,
  EntrantOutcome,
} from '../../domain/competitions/competitionModel'
import type { WindowFixtureRead } from '../../domain/competitions/windowFixtures'

export type BonusWindowRead = {
  id: string
  competitionId: string
  sequence: number
  label: string
  opensAt: string | null
  locksAt: string | null
  settlesAt: string | null
  requiresTieBreakInput: boolean
  fixtures: WindowFixtureRead[]
}

export type BonusGameRead = {
  competition: CompetitionRecord
  windows: BonusWindowRead[]
  entrant: CompetitionEntrant | null
}

export type BonusGamesRead = {
  serverNow: string
  games: BonusGameRead[]
}

const GAME_KEYS: readonly BonusGameKey[] = [
  'ko_predictor',
  'last_man_standing',
  'predictor_cup',
]

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
    throw new Error('Bonus games returned an invalid record.')
  }
  return value as Record<string, unknown>
}

function arrayOf(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Bonus games returned an invalid ${field}.`)
  }
  return value
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Bonus games returned an invalid ${field}.`)
  }
  return value
}

function instantOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  const instant = text(value, field)
  if (Number.isNaN(new Date(instant).getTime())) {
    throw new Error(`Bonus games returned an invalid ${field}.`)
  }
  return instant
}

function booleanOf(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Bonus games returned an invalid ${field}.`)
  }
  return value
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Bonus games returned an invalid ${field}.`)
  }
  return value
}

function gameKeyOf(value: unknown): BonusGameKey {
  const key = text(value, 'game key')
  if (!(GAME_KEYS as readonly string[]).includes(key)) {
    throw new Error('Bonus games returned an unknown game.')
  }
  return key as BonusGameKey
}

function outcomeOf(value: unknown): EntrantOutcome {
  const outcome = text(value, 'entrant outcome')
  if (!(OUTCOMES as readonly string[]).includes(outcome)) {
    throw new Error('Bonus games returned an unknown entrant outcome.')
  }
  return outcome as EntrantOutcome
}

function fixtureOf(value: unknown): WindowFixtureRead {
  const row = recordOf(value)
  const resultState = text(row.result_state, 'fixture result state')
  if (!(RESULT_STATES as readonly string[]).includes(resultState)) {
    throw new Error('Bonus games returned an unknown fixture result state.')
  }
  return {
    kickoffAt: instantOrNull(row.kickoff_at, 'fixture kickoff'),
    resultState: resultState as WindowFixtureRead['resultState'],
  }
}

function windowOf(value: unknown, competitionId: string): BonusWindowRead {
  const row = recordOf(value)
  return {
    id: text(row.id, 'window id'),
    competitionId,
    sequence: integer(row.sequence, 'window sequence'),
    label: text(row.label, 'window label'),
    opensAt: instantOrNull(row.opens_at, 'window open instant'),
    locksAt: instantOrNull(row.locks_at, 'window lock instant'),
    settlesAt: instantOrNull(row.settles_at, 'window settle instant'),
    requiresTieBreakInput: booleanOf(
      row.requires_tie_break_input,
      'window tie-break flag',
    ),
    fixtures: arrayOf(row.fixtures, 'window fixtures').map(fixtureOf),
  }
}

function entrantOf(
  value: unknown,
  competitionId: string,
  userId: string,
): CompetitionEntrant | null {
  if (value === null || value === undefined) return null
  const row = recordOf(value)
  return {
    competitionId,
    userId,
    joinedAt: text(row.joined_at, 'entrant joined instant'),
    outcome: outcomeOf(row.outcome),
    // No bonus game collects inputs before the B4 shared prediction store, so
    // nothing can be owed yet. The read model supplies real counts later.
    pendingInputs: 0,
  }
}

export function mapBonusGamesResponse(
  value: unknown,
  tournamentId: string,
  userId: string,
): BonusGamesRead {
  const root = recordOf(value)
  const serverNow = text(root.server_now, 'server time')
  if (Number.isNaN(new Date(serverNow).getTime())) {
    throw new Error('Bonus games returned an invalid server time.')
  }

  const games = arrayOf(root.competitions, 'competition list').map((entry) => {
    const row = recordOf(entry)
    const id = text(row.id, 'competition id')
    const competition: CompetitionRecord = {
      id,
      gameKey: gameKeyOf(row.game_key),
      tournamentId,
      // The hub read only ever returns published competitions.
      published: true,
      registrationOpensAt: instantOrNull(
        row.registration_opens_at,
        'registration open instant',
      ),
      registrationClosesAt: instantOrNull(
        row.registration_closes_at,
        'registration close instant',
      ),
      drawRequired: booleanOf(row.draw_required, 'draw flag'),
      drawCompletedAt: instantOrNull(row.draw_completed_at, 'draw completion'),
      completedAt: instantOrNull(row.completed_at, 'completion instant'),
    }
    return {
      competition,
      windows: arrayOf(row.windows, 'window list').map((window) =>
        windowOf(window, id),
      ),
      entrant: entrantOf(row.entrant, id, userId),
    }
  })

  return { serverNow, games }
}
