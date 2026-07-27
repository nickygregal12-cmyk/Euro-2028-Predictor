type ErrorShape = {
  code?: unknown
  message?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

/** Returns dedicated copy only for the authoritative total-league cap. */
export function leagueCapacityError(error: unknown): string | null {
  const shape =
    error && typeof error === 'object' ? (error as ErrorShape) : ({ message: error } as ErrorShape)
  const code = text(shape.code)
  const message = text(shape.message)

  if (
    code === 'pt429' ||
    message.includes('league limit reached') ||
    message.includes('total_league_limit_reached')
  ) {
    return 'League limit reached. Contact admin.'
  }

  return null
}
