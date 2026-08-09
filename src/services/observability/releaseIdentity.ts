import { weeklyRoutePatterns } from '../../app/shellRoutes'

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

function matchesCompetitionPattern(pattern: string, pathname: string): boolean {
  const source = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(':competitionSlug', '[^/]+')
    .replace(':seasonSlug', '[^/]+')
  return new RegExp(`^${source}$`).test(pathname)
}

export function routeCategory(pathname: string): string {
  if (pathname.startsWith('/auth/')) return 'auth'
  if (pathname.startsWith('/join/')) return 'invite'

  // The DEV harnesses and their canonical production routes report under the
  // same surface categories. Production matching comes from the route authority
  // so observability cannot silently keep following a retired route alias.
  if (pathname.startsWith('/dev/season-standings')) return 'season-standings'
  if (matchesCompetitionPattern(weeklyRoutePatterns.matchPredictorStandings, pathname)) {
    return 'season-standings'
  }
  if (pathname.startsWith('/dev/season-predictor')) return 'season-predictor'
  if (matchesCompetitionPattern(weeklyRoutePatterns.matchPredictor, pathname)) {
    return 'season-predictor'
  }
  if (pathname.startsWith('/dev/season-lms')) return 'season-lms'
  if (matchesCompetitionPattern(weeklyRoutePatterns.lms, pathname)) return 'season-lms'

  if (pathname.startsWith('/predict')) return 'predictor'
  if (pathname.startsWith('/league')) return 'league'
  if (pathname.startsWith('/h2h/')) return 'head-to-head'
  if (pathname.startsWith('/match')) return 'matches'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/more')) return 'more'
  if (pathname === '/' || pathname === '/welcome') return 'home'
  return 'unknown'
}
