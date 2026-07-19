import { EmptyState } from '../../design-system'
import { TrophyIcon } from '../../design-system/icons'
import s from '../shared.module.css'

// Placeholder in the v0.1 skeleton: the knockout bracket screen (winner-only
// selection, mobile one-round-at-a-time) is its own Phase 1 build item. The hub
// links here so the route exists and the flow is navigable end to end.
export function BracketPage() {
  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Predict</span>
        <h1 className={s.title}>Knockout bracket</h1>
      </div>
      <EmptyState
        icon={<TrophyIcon size={22} />}
        title="Bracket coming next"
        description="Pick your Round-of-16 winners through to the champion. This screen lands in the next Phase 1 build step; the group stage is fully playable now."
      />
    </div>
  )
}
