// Pure response parsing for the shared knockout prediction store (contract
// 50). No Supabase client, no clock — strict validation that fails closed.

export type KnockoutPredictionRead = {
  matchId: string
  homeScore: number
  awayScore: number
  /** Present exactly when a draw is predicted (the who-goes-through pick). */
  advancingTeamId: string | null
  version: number
}

export type KnockoutStoreRead = {
  serverNow: string
  /** Whether the caller has entered a game that reads the store. */
  storeEntrant: boolean
  predictions: KnockoutPredictionRead[]
}

function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Knockout predictions returned an invalid record.')
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Knockout predictions returned an invalid ${field}.`)
  }
  return value
}

function score(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Knockout predictions returned an invalid ${field}.`)
  }
  return value
}

export function mapKnockoutStoreResponse(value: unknown): KnockoutStoreRead {
  const root = recordOf(value)

  const serverNow = text(root.server_now, 'server time')
  if (Number.isNaN(new Date(serverNow).getTime())) {
    throw new Error('Knockout predictions returned an invalid server time.')
  }

  if (typeof root.store_entrant !== 'boolean') {
    throw new Error('Knockout predictions returned an invalid entrant flag.')
  }

  if (!Array.isArray(root.predictions)) {
    throw new Error('Knockout predictions returned an invalid prediction list.')
  }

  const predictions = root.predictions.map((entry): KnockoutPredictionRead => {
    const row = recordOf(entry)
    const homeScore = score(row.home_score, 'home score')
    const awayScore = score(row.away_score, 'away score')
    const advancingTeamId =
      row.advancing_team_id === null || row.advancing_team_id === undefined
        ? null
        : text(row.advancing_team_id, 'advancing team')

    // The through-shape contract: a pick exactly when a draw is predicted.
    if ((homeScore === awayScore) !== (advancingTeamId !== null)) {
      throw new Error('Knockout predictions returned an inconsistent through pick.')
    }

    return {
      matchId: text(row.match_id, 'match id'),
      homeScore,
      awayScore,
      advancingTeamId,
      version: score(row.version, 'version'),
    }
  })

  return { serverNow, storeEntrant: root.store_entrant, predictions }
}
