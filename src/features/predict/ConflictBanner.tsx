import { Alert, Button } from '../../design-system'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import s from './conflictBanner.module.css'

// Non-blocking banner shown when a prediction row was changed on another device
// (optimistic-concurrency conflict, SQLSTATE 'PT409'). Renders nothing until a
// conflict exists. The two actions are the ONLY way a conflict is resolved —
// there is no silent resolution in either direction, and local edits are never
// discarded without the user choosing "Load latest". Reuses Alert + Button.
export function ConflictBanner() {
  const { hasConflict, resolveConflict } = usePredictions()
  if (!hasConflict) return null
  return (
    <Alert variant="warning" title="These picks were changed on another device">
      <p className={s.body}>
        Your latest edits haven’t been saved. Choose which version to keep.
      </p>
      <div className={s.actions}>
        <Button variant="secondary" onClick={() => resolveConflict('latest')}>
          Load latest
        </Button>
        <Button variant="primary" onClick={() => resolveConflict('mine')}>
          Keep mine
        </Button>
      </div>
    </Alert>
  )
}
