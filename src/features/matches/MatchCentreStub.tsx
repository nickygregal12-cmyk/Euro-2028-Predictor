import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState, Button } from '../../design-system'
import { CalendarIcon, ChevronLeftIcon } from '../../design-system/icons'
import s from '../shared.module.css'

/**
 * Placeholder match-centre page (`/match/:matchRef`). The full per-fixture page
 * is Phase 3 (design-system §6 Match Centre); this stub exists so navigation
 * targets from Home's Today card and elsewhere already resolve.
 */
export function MatchCentreStub() {
  const { matchRef } = useParams<{ matchRef: string }>()
  const navigate = useNavigate()
  return (
    <div className={s.page}>
      <div className={s.header}>
        <button type="button" className={s.backLink} onClick={() => navigate('/')}>
          <ChevronLeftIcon size={16} /> Home
        </button>
        <h1 className={s.title}>Match</h1>
      </div>
      <EmptyState
        icon={<CalendarIcon size={22} />}
        title="Match centre coming soon"
        description={`The per-fixture page (${matchRef ?? 'this match'}) — result, your stake, what your leagues predicted, and how it changed the tables — arrives in Phase 3.`}
      />
      <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
        Back to Home
      </Button>
    </div>
  )
}
