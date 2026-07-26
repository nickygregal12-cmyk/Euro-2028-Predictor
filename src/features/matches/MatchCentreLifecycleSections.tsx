import type { ReactNode } from 'react'
import type { MatchCentreLifecycleContent } from '../../domain/tournament/matchCentreLifecycleContent'
import { MatchCentreLifecyclePanel } from './MatchCentreLifecyclePanel'

export type MatchCentreLifecycleSectionsProps = {
  content: MatchCentreLifecycleContent
  predictionContext: ReactNode
  matchImpact?: ReactNode
}

/**
 * Applies the domain-owned lifecycle visibility decisions without teaching the
 * screen component how individual fixture states should behave.
 */
export function MatchCentreLifecycleSections({
  content,
  predictionContext,
  matchImpact,
}: MatchCentreLifecycleSectionsProps) {
  return (
    <>
      <MatchCentreLifecyclePanel content={content} />
      {content.showPredictionContext ? predictionContext : null}
      {content.showMatchImpact ? matchImpact : null}
    </>
  )
}
