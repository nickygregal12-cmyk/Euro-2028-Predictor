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
  // Its own category rather than folded into `season-predictor`: the standings
  // are a read of settled scores while the card is a write path under a lock,
  // and a failure in one says nothing about the other.
  if (pathname.startsWith('/dev/season-standings')) return 'season-standings'
  if (pathname.startsWith('/predict')) return 'predictor'
  if (pathname.startsWith('/league')) return 'league'
  if (pathname.startsWith('/h2h/')) return 'head-to-head'
  if (pathname.startsWith('/match')) return 'matches'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/more')) return 'more'
  if (pathname === '/' || pathname === '/welcome') return 'home'
  return 'unknown'
}
