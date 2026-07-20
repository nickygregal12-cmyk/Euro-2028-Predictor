import type { CatchUp } from '../../domain/tournament/homeDashboard'
import h from './home.module.css'

export type CatchUpLineProps = {
  catchUp: CatchUp
}

/**
 * "Since you were last here: +N pts" (design-system §6). Shown only when there
 * was meaningful change (the caller passes null to hide it). The rank delta
 * ("up N places") appears once rank_history exists; until then it's points only.
 * Presentational.
 */
export function CatchUpLine({ catchUp }: CatchUpLineProps) {
  return (
    <div className={h.catchUp}>
      <span className={h.catchUpEyebrow}>Since you were last here</span>
      <span className={h.catchUpText}>
        <strong className={h.catchUpPts}>+{catchUp.pointsDelta} pts</strong>
        {catchUp.rankDelta !== null && catchUp.rankDelta > 0 && (
          <span> · up {catchUp.rankDelta} place{catchUp.rankDelta === 1 ? '' : 's'}</span>
        )}
      </span>
    </div>
  )
}
