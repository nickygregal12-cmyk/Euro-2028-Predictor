import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, EmptyState, Skeleton, StatusBadge } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import type { Team } from '../../services/supabase/tournamentData'
import {
  deriveLmsSelectionOutcome,
  type LmsSelectionOutcome,
} from '../../domain/competitions/lmsSelection'
import { fetchMyLms, saveLmsSelection } from '../../services/supabase/lms'
import type { LmsRead, LmsWindowRead } from '../../services/supabase/lmsModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import g from './games.module.css'

const OUTCOME_COPY: Record<string, string> = {
  active: 'You’re in — pick a team each round to stay alive.',
  survived: 'Still standing — pick again next round.',
  eliminated: 'You’ve been eliminated. Thanks for playing!',
  champion: 'Last one standing — champion!',
}

const SELECTION_COPY: Record<LmsSelectionOutcome, string> = {
  pending: 'Awaiting official result',
  survived: 'Survived',
  out: 'Out',
}

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
  | { status: 'ready'; read: LmsRead }

export function LmsPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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
    fetchMyLms(tournamentId)
      .then((read) => {
        if (active) setState({ status: 'ready', read })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(
              error,
              'Last Man Standing is unavailable. Please try again.',
            ),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data.status, reloadKey, tournamentId])

  const teamById = useMemo(() => {
    if (data.status !== 'ready') return new Map<string, Team>()
    return new Map(data.data.teams.map((team) => [team.id, team]))
  }, [data])

  function teamName(teamId: string | null): string {
    if (!teamId) return 'TBC'
    return teamById.get(teamId)?.name ?? 'TBC'
  }

  async function handlePick(window: LmsWindowRead, teamId: string) {
    if (saving) return
    setSaving(true)
    setActionError(null)
    try {
      await saveLmsSelection(window.id, teamId, window.mySelection?.version ?? null)
      setReloadKey((key) => key + 1)
    } catch (error) {
      setActionError(userFacingError(error, 'We couldn’t save that pick. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/games')}>
        <ChevronLeftIcon size={16} /> Games
      </button>
      <h1 className={s.title}>Last Man Standing</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn’t load Last Man Standing">
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

  if (state.status === 'loading' || data.status !== 'ready') {
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
          title="You haven’t entered Last Man Standing"
          description="Enter from the Games hub, then pick one team each round. Win and you live; lose, draw or forget to pick and you’re out. Each team can be used only once."
          action={<Button onClick={() => navigate('/games')}>Open the Games hub</Button>}
        />
      </div>
    )
  }

  const nowMs = new Date(read.serverNow).getTime()
  const eliminated = read.entrant.outcome === 'eliminated'
  const usedElsewhere = (window: LmsWindowRead) =>
    new Set(
      read.usedTeamIds.filter((teamId) => teamId !== window.mySelection?.teamId),
    )

  return (
    <div className={s.page}>
      {header}

      <div className={s.card}>
        <span className={s.eyebrow}>Your survival</span>
        <p className={g.stateLine}>
          {OUTCOME_COPY[read.entrant.outcome] ?? OUTCOME_COPY.active}
        </p>
        <p className={g.deadline}>
          {read.remainingCount} of {read.entrantCount} still standing
        </p>
      </div>

      {actionError ? (
        <Alert variant="error" title="That didn’t work">
          {actionError}
        </Alert>
      ) : null}

      {read.windows.length === 0 ? (
        <EmptyState
          title="No rounds scheduled yet"
          description="Rounds appear here once the admin publishes the round plan."
        />
      ) : (
        read.windows.map((window) => {
          const opened =
            window.opensAt !== null && nowMs >= new Date(window.opensAt).getTime()
          const locked =
            window.locksAt !== null && nowMs >= new Date(window.locksAt).getTime()
          const pickable = opened && !locked && !eliminated
          const blocked = usedElsewhere(window)
          const selectionOutcome = window.mySelection
            ? deriveLmsSelectionOutcome(window.fixtures, window.mySelection.teamId)
            : null

          return (
            <section key={window.id} className={`${s.card} ${g.gameCard}`}>
              <div className={g.gameHeader}>
                <h2 className={g.gameName}>{window.label}</h2>
                {locked ? <StatusBadge variant="locked" /> : null}
                {window.mySelection && !locked ? (
                  <StatusBadge variant="submitted" label="Picked" />
                ) : null}
              </div>

              {window.locksAt ? (
                <p className={g.deadline}>
                  {locked ? 'Deadline passed' : `Deadline: ${formatInstant(window.locksAt)}`}
                </p>
              ) : (
                <p className={g.deadline}>Deadline to be confirmed</p>
              )}

              {window.mySelection ? (
                <p className={g.stateLine}>
                  Your pick: <strong>{teamName(window.mySelection.teamId)}</strong>
                  {locked && selectionOutcome
                    ? ` — ${SELECTION_COPY[selectionOutcome]}`
                    : ''}
                </p>
              ) : locked ? (
                <p className={g.stateLine}>No pick made — eliminated at settle.</p>
              ) : null}

              {pickable ? (
                <div className={g.actions} role="group" aria-label={`Pick for ${window.label}`}>
                  {window.fixtures
                    .flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId])
                    .filter((teamId): teamId is string => teamId !== null)
                    .map((teamId) => (
                      <Button
                        key={teamId}
                        variant={
                          window.mySelection?.teamId === teamId ? 'primary' : 'secondary'
                        }
                        disabled={saving || blocked.has(teamId)}
                        onClick={() => void handlePick(window, teamId)}
                      >
                        {teamName(teamId)}
                      </Button>
                    ))}
                </div>
              ) : null}
            </section>
          )
        })
      )}
    </div>
  )
}
