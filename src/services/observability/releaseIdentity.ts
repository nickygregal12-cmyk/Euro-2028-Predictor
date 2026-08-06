export type ReleaseEnvironment =
  | 'production'
  | 'deploy-preview'
  | 'branch-deploy'
  | 'dev'
  | 'local'
  | 'unknown'

export interface ReleaseIdentity {
  readonly application: 'euro28-predictor'
  readonly environment: ReleaseEnvironment
  readonly commit: string
  readonly deployId: string
  readonly applicationContract: number
  readonly hostedContract: number | null
  readonly supabaseProjectRef: string | null
}

const release = __EURO28_RELEASE__

export const releaseIdentity: ReleaseIdentity = Object.freeze({
  application: 'euro28-predictor',
  environment: normaliseEnvironment(release.environment),
  commit: release.commit,
  deployId: release.deployId,
  applicationContract: release.applicationContract,
  hostedContract: release.hostedContract,
  supabaseProjectRef: release.supabaseProjectRef,
})

function normaliseEnvironment(value: string): ReleaseEnvironment {
  switch (value) {
    case 'production':
    case 'deploy-preview':
    case 'branch-deploy':
    case 'dev':
    case 'local':
      return value
    default:
      return 'unknown'
  }
}

/**
 * `/competitions/<competition>/<season>/main-predictor`.
 *
 * A pattern rather than a `startsWith`, because the two slugs are arbitrary and
 * the prefix they share — `/competitions/` — is also the competition dashboard,
 * which is a different surface with different failure modes.
 */
const SEASON_MAIN_PREDICTOR = /^\/competitions\/[^/]+\/[^/]+\/main-predictor(\/|$)/

export function routeCategory(pathname: string): string {
  if (pathname.startsWith('/auth/')) return 'auth'
  if (pathname.startsWith('/join/')) return 'invite'
  // Season surfaces are categorised BEFORE `/predict`, and separately from it,
  // because they are a different competition served by a different journey. The
  // modernisation plan's §13.4 requires errors to be observable by old versus
  // new implementation; sharing `predictor` with the tournament flow would make
  // a regression in one look like a regression in the other, which is the
  // opposite of what the gate asks for.
  if (pathname.startsWith('/dev/season-predictor')) return 'season-predictor'
  // The production address for the same surface. Categorised identically and
  // deliberately so: §13.4 wants errors observable per implementation, and the
  // DEV harness and the real route render the same page over different data —
  // splitting them would report the surface's health in two halves, one of
  // which nobody plays.
  if (SEASON_MAIN_PREDICTOR.test(pathname)) return 'season-predictor'
  // Its own category rather than folded into `season-predictor`: the standings
  // are a read of settled scores while the card is a write path under a lock,
  // and a failure in one says nothing about the other.
  if (pathname.startsWith('/dev/season-standings')) return 'season-standings'
  // Its own category again: a pick that consumes a club for a cycle fails
  // differently from a card write and from a standings read.
  if (pathname.startsWith('/dev/season-lms')) return 'season-lms'
  if (pathname.startsWith('/predict')) return 'predictor'
  if (pathname.startsWith('/league')) return 'league'
  if (pathname.startsWith('/h2h/')) return 'head-to-head'
  if (pathname.startsWith('/match')) return 'matches'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/more')) return 'more'
  if (pathname === '/' || pathname === '/welcome') return 'home'
  return 'unknown'
}
