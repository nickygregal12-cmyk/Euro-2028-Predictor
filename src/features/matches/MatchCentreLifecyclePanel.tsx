import { useId } from 'react'
import type { MatchCentreLifecycleContent } from '../../domain/tournament/matchCentreLifecycleContent'
import s from './MatchCentreLifecyclePanel.module.css'

export type MatchCentreLifecyclePanelProps = {
  content: MatchCentreLifecycleContent
}

/**
 * Renders repository-owned lifecycle guidance without deriving match state in
 * the component. The domain decides the copy, emphasis and downstream section
 * visibility; this component only presents that decision.
 */
export function MatchCentreLifecyclePanel({ content }: MatchCentreLifecyclePanelProps) {
  const headingId = useId()

  return (
    <section
      className={`${s.panel} ${s[content.emphasis]}`}
      aria-labelledby={headingId}
      data-emphasis={content.emphasis}
    >
      <h2 id={headingId} className={s.heading}>
        {content.heading}
      </h2>
      <p className={s.summary}>{content.summary}</p>
    </section>
  )
}
