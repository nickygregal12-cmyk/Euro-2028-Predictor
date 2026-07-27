export type PublicCapacity = {
  publicUsersUsed: number
  publicUserLimit: number
  signupAvailable: boolean
  leaguesUsed: number
  totalLeagueLimit: number
  leagueCreationAvailable: boolean
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Public capacity returned an invalid ${field}.`)
  }
  return value
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Public capacity returned an invalid ${field}.`)
  }
  return value
}

export function mapPublicCapacityRow(value: unknown): PublicCapacity {
  const row = recordOf(value)
  const publicUsersUsed = integer(row.public_users_used, 'public user count')
  const publicUserLimit = integer(row.public_user_limit, 'public user limit')
  const leaguesUsed = integer(row.leagues_used, 'league count')
  const totalLeagueLimit = integer(row.total_league_limit, 'league limit')

  if (publicUserLimit < 1 || totalLeagueLimit < 1) {
    throw new Error('Public capacity returned an unavailable operating limit.')
  }

  return {
    publicUsersUsed,
    publicUserLimit,
    signupAvailable: boolean(row.signup_available, 'signup availability'),
    leaguesUsed,
    totalLeagueLimit,
    leagueCreationAvailable: boolean(
      row.league_creation_available,
      'league creation availability',
    ),
  }
}
