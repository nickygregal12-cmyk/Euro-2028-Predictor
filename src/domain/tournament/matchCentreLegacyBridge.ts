import type { MatchTemporalState } from './matchCentre'
import type { ExternalMatchData } from './matchCentreContract'
import {
  presentMatchLifecycle,
  type MatchCentreStatusPresentation,
} from './matchCentrePresentation'

export type LegacyMatchCentreHeader = {
  temporalState: MatchTemporalState
  statusPresentation: MatchCentreStatusPresentation
  matchSource: ExternalMatchData['source']
  home: { name: string; countryCode: string }
  away: { name: string; countryCode: string }
  result: { home: number; away: number } | null
  liveMinute: string | null
}

const LIVE_STATES = new Set<ExternalMatchData['lifecycle']>([
  'LIVE_FIRST_HALF',
  'HALF_TIME',
  'LIVE_SECOND_HALF',
  'EXTRA_TIME',
  'PENALTIES',
])

export function lifecycleToLegacyTemporalState(
  lifecycle: ExternalMatchData['lifecycle'],
): MatchTemporalState {
  if (lifecycle === 'FULL_TIME' || lifecycle === 'CANCELLED') return 'after'
  if (LIVE_STATES.has(lifecycle)) return 'during'
  return 'before'
}

export function bridgeExternalMatchToLegacyHeader(
  external: ExternalMatchData,
): LegacyMatchCentreHeader {
  return {
    temporalState: lifecycleToLegacyTemporalState(external.lifecycle),
    statusPresentation: presentMatchLifecycle(external.lifecycle),
    matchSource: external.source,
    home: {
      name: external.home.name,
      countryCode: external.home.countryCode ?? '',
    },
    away: {
      name: external.away.name,
      countryCode: external.away.countryCode ?? '',
    },
    result: external.score
      ? {
          home: external.score.home,
          away: external.score.away,
        }
      : null,
    liveMinute: external.clockLabel,
  }
}
