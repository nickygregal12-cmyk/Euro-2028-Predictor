import type {
  MatchDataQuality,
  MatchLifecycleState,
  MatchSourceMetadata,
} from './matchCentreContract'

export type MatchCentreStatusTone = 'neutral' | 'live' | 'warning' | 'danger' | 'success'

export type MatchCentreStatusPresentation = {
  label: string
  tone: MatchCentreStatusTone
  isLive: boolean
  isTerminal: boolean
}

const LIFECYCLE_PRESENTATION: Record<MatchLifecycleState, MatchCentreStatusPresentation> = {
  SCHEDULED: { label: 'Upcoming', tone: 'neutral', isLive: false, isTerminal: false },
  PRE_MATCH: { label: 'Starting soon', tone: 'neutral', isLive: false, isTerminal: false },
  LIVE_FIRST_HALF: { label: 'Live · first half', tone: 'live', isLive: true, isTerminal: false },
  HALF_TIME: { label: 'Half-time', tone: 'live', isLive: true, isTerminal: false },
  LIVE_SECOND_HALF: { label: 'Live · second half', tone: 'live', isLive: true, isTerminal: false },
  EXTRA_TIME: { label: 'Live · extra time', tone: 'live', isLive: true, isTerminal: false },
  PENALTIES: { label: 'Live · penalties', tone: 'live', isLive: true, isTerminal: false },
  FULL_TIME: { label: 'Full-time', tone: 'success', isLive: false, isTerminal: true },
  POSTPONED: { label: 'Postponed', tone: 'warning', isLive: false, isTerminal: false },
  SUSPENDED: { label: 'Suspended', tone: 'danger', isLive: false, isTerminal: false },
  CANCELLED: { label: 'Cancelled', tone: 'danger', isLive: false, isTerminal: true },
}

const QUALITY_LABELS: Record<MatchDataQuality, string | null> = {
  verified: null,
  provisional: 'Provisional data',
  delayed: 'Live data delayed',
  unavailable: 'Live data unavailable',
}

export function presentMatchLifecycle(
  lifecycle: MatchLifecycleState,
): MatchCentreStatusPresentation {
  return LIFECYCLE_PRESENTATION[lifecycle]
}

export function sourceQualityLabel(source: MatchSourceMetadata): string | null {
  return QUALITY_LABELS[source.dataQuality]
}

export function sourceFreshnessLabel(source: MatchSourceMetadata): string | null {
  if (source.dataQuality === 'unavailable') return 'Latest verified match data is unavailable.'
  if (!source.isStale) return null

  const minutes = Math.max(1, Math.floor(source.freshnessSeconds / 60))
  if (minutes < 60) return `Last updated ${minutes} min ago.`

  const hours = Math.floor(minutes / 60)
  return `Last updated ${hours} hr${hours === 1 ? '' : 's'} ago.`
}

export function shouldShowLivePulse(
  lifecycle: MatchLifecycleState,
  source: MatchSourceMetadata,
): boolean {
  return presentMatchLifecycle(lifecycle).isLive && source.dataQuality !== 'unavailable'
}
