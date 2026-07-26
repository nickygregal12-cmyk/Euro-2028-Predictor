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
  return (
    <section
      className={`${s.panel} ${s[content.emphasis]}`}
      aria-labelledby="match-centre-lifecycle-heading"
      data-emphasis={content.emphasis}
    >
      <h2 id="match-centre-lifecycle-heading" className={s.heading}>
        {content.heading}
      </h2>
      <p className={s.summary}>{content.summary}</p>
    </section>
  )
}
