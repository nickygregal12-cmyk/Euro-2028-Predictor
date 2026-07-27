import { userFacingError } from '../../shared/errors/userFacingError'

type ErrorShape = {
  code?: unknown
  message?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

export function friendlyLeagueError(error: unknown): string {
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

  return userFacingError(error, 'Could not create the league. Try again.')
}
