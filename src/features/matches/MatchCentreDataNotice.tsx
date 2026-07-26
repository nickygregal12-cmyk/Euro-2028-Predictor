import { Alert } from '../../design-system'
import {
  sourceFreshnessLabel,
  sourceQualityLabel,
  type MatchCentreStatusPresentation,
} from '../../domain/tournament/matchCentrePresentation'
import type { MatchSourceMetadata } from '../../domain/tournament/matchCentreContract'

type MatchCentreDataNoticeProps = {
  status: MatchCentreStatusPresentation
  source: MatchSourceMetadata
}

export function MatchCentreDataNotice({ status, source }: MatchCentreDataNoticeProps) {
  const qualityLabel = sourceQualityLabel(source)
  const freshnessLabel = sourceFreshnessLabel(source)

  if (!qualityLabel && !freshnessLabel) return null

  const title =
    source.dataQuality === 'unavailable'
      ? 'Live match data unavailable'
      : source.dataQuality === 'delayed'
        ? 'Live match data delayed'
        : 'Match data is provisional'

  const variant = source.dataQuality === 'unavailable' ? 'error' : 'warning'
  const detail = freshnessLabel ?? qualityLabel

  return (
    <Alert variant={variant} title={title}>
      {detail}
      {status.isLive && source.dataQuality !== 'verified'
        ? ' The score and match state may change when the feed refreshes.'
        : null}
    </Alert>
  )
}
