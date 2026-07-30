import type { ExternalMatchData } from './matchCentreContract'
import {
  presentMatchLifecycle,
  type MatchCentreStatusPresentation,
} from './matchCentrePresentation'

export type LegacyMatchCentreHeader = {
  statusPresentation: MatchCentreStatusPresentation
  matchSource: ExternalMatchData['source']
  home: { name: string; countryCode: string }
  away: { name: string; countryCode: string }
  result: { home: number; away: number } | null
  liveMinute: string | null
}

export function bridgeExternalMatchToLegacyHeader(
  external: ExternalMatchData,
): LegacyMatchCentreHeader {
  return {
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
