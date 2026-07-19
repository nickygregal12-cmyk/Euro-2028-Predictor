import { EmptyState } from '../../design-system'
import { TrophyIcon } from '../../design-system/icons'
import s from '../shared.module.css'

// League = Original Predictor only (docs/competition-structure.md §2). v0.1 will
// show the overall leaderboard; private leagues expand this tab at Phase 2.
// Until the tournament produces results there is nothing to rank yet.
export function LeaguePage() {
  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>League</h1>
      </div>
      <EmptyState
        icon={<TrophyIcon size={22} />}
        title="No standings yet"
        description="Standings appear once the tournament starts and results come in. Private leagues arrive in a later update."
      />
    </div>
  )
}
