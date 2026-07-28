import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, EmptyState, Skeleton, StatusBadge } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { fetchMyCup } from '../../services/supabase/cup'
import type { CupRead } from '../../services/supabase/cupModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import g from './games.module.css'

function formatInstant(instant: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(instant))
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; read: CupRead }

export function CupPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!tournamentId) {
      setState({ status: 'loading' })
      return
    }

    let active = true
    setState({ status: 'loading' })
    fetchMyCup(tournamentId)
      .then((read) => {
        if (active) setState({ status: 'ready', read })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(
              error,
              'The Predictor Cup is unavailable. Please try again.',
            ),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data.status, reloadKey, tournamentId])

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/games')}>
        <ChevronLeftIcon size={16} /> Games
      </button>
      <h1 className={s.title}>Predictor Cup</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn’t load the Predictor Cup">
          {state.message}
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }

  const read = state.read

  if (!read.entrant) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          title="You haven’t entered the Predictor Cup"
          description="Enter from the Games hub before the field closes. Your predictions become head-to-head cup ties against other players."
          action={<Button onClick={() => navigate('/games')}>Open the Games hub</Button>}
        />
      </div>
    )
  }

  if (!read.drawCompletedAt) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          title="Waiting for the draw"
          description={
            read.registrationClosesAt
              ? `The field (${read.entrantCount} so far) closes ${formatInstant(read.registrationClosesAt)}. The transparent random draw follows, and your group appears here.`
              : `${read.entrantCount} entrants so far. The draw follows once the field closes, and your group appears here.`
          }
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      {header}

      {read.myGroup ? (
        <section className={`${s.card} ${g.gameCard}`}>
          <div className={g.gameHeader}>
            <h2 className={g.gameName}>Group {read.myGroup.ordinal}</h2>
            <StatusBadge variant="submitted" label={`${read.myGroup.size} players`} />
          </div>
          <p className={g.tagline}>
            {read.groupCount} groups · {read.entrantCount} players. Win 3 · draw 1 ·
            loss 0 on prediction-point totals per matchday.
          </p>
          {read.myGroup.members.map((member) => (
            <p key={member.userId} className={g.stateLine}>
              #{member.drawNumber} {member.displayName}
            </p>
          ))}
        </section>
      ) : (
        <Alert variant="error" title="No group assigned">
          The draw is complete but you have no group — contact the admin.
        </Alert>
      )}

      <section className={`${s.card} ${g.gameCard}`}>
        <h2 className={g.gameName}>Your ties</h2>
        {read.myFixtures.length === 0 ? (
          <p className={g.tagline}>No ties scheduled yet.</p>
        ) : (
          read.myFixtures.map((fixture) => (
            <div key={fixture.fixtureId}>
              <p className={g.stateLine}>
                {fixture.windowLabel}
                {fixture.matchday ? ` (Matchday ${fixture.matchday})` : ''} — you vs{' '}
                <strong>{fixture.opponent.displayName}</strong>
              </p>
              {fixture.windowLocksAt ? (
                <p className={g.deadline}>
                  Predictions lock {formatInstant(fixture.windowLocksAt)}
                </p>
              ) : null}
            </div>
          ))
        )}
        <p className={g.deadline}>
          Scores and tables arrive with the next Cup build stage; your matchday
          points come from your Original Predictor scorelines (no jokers).
        </p>
      </section>
    </div>
  )
}
