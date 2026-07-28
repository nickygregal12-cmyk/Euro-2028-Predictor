import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Alert,
  Button,
  ConfirmModal,
  EmptyState,
  Skeleton,
  StatusBadge,
} from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import type {
  BonusGameKey,
  CompetitionState,
  CompetitionStatus,
  CompetitionWindow,
} from '../../domain/competitions/competitionModel'
import { resolveCompetitionStatus } from '../../domain/competitions/resolveCompetitionStatus'
import { deriveWindowFixtureAggregate } from '../../domain/competitions/windowFixtures'
import {
  fetchBonusGames,
  registerBonusCompetition,
  withdrawBonusCompetition,
} from '../../services/supabase/bonusGames'
import type { BonusGameRead } from '../../services/supabase/bonusGamesModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import g from './games.module.css'

const GAME_META: Record<BonusGameKey, { name: string; tagline: string }> = {
  ko_predictor: {
    name: 'KO Predictor',
    tagline: 'Predict every knockout scoreline. Join before any round — no jokers.',
  },
  last_man_standing: {
    name: 'Last Man Standing',
    tagline: 'One pick per round. Survive elimination longer than everyone else.',
  },
  predictor_cup: {
    name: 'Predictor Cup',
    tagline: 'Your predictions become fixtures in a head-to-head knockout cup.',
  },
}

// One user-facing line per canonical state (architecture §8; precedence in
// resolveCompetitionStatus). The domain decides the state — this only words it.
const STATE_COPY: Record<CompetitionState, string> = {
  not_open: 'Not open yet',
  registration_open: 'Registration open — join now',
  entered: 'You’re in — waiting for the first round',
  registration_closed: 'Registration closed',
  waiting_for_draw: 'Waiting for the draw',
  waiting_for_round: 'You’re in — next round pending',
  action_required: 'Action required — make your picks',
  round_live: 'Round in play',
  round_awaiting_confirmation: 'Round finished — awaiting official results',
  qualified: 'Qualified for the next round',
  survived: 'Survived this round',
  eliminated: 'Eliminated',
  champion: 'Champion!',
  complete: 'Competition complete',
}

function badgeFor(status: CompetitionStatus) {
  if (status.state === 'round_live') return <StatusBadge variant="live" />
  if (status.entered) return <StatusBadge variant="submitted" label="Entered" />
  if (status.state === 'registration_closed') return <StatusBadge variant="locked" />
  return null
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
  | { status: 'ready'; serverNow: string; games: BonusGameRead[] }

export function GamesPage() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [withdrawTarget, setWithdrawTarget] = useState<BonusGameRead | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!tournamentId || !userId) {
      setState({ status: 'loading' })
      return
    }

    let active = true
    setState({ status: 'loading' })
    fetchBonusGames(tournamentId, userId)
      .then((read) => {
        if (active) setState({ status: 'ready', serverNow: read.serverNow, games: read.games })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(error, 'The bonus games are unavailable. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data.status, reloadKey, tournamentId, userId])

  const refresh = useCallback(() => setReloadKey((key) => key + 1), [])

  async function handleRegister(game: BonusGameRead) {
    if (acting) return
    setActing(true)
    setActionError(null)
    try {
      await registerBonusCompetition(game.competition.id)
      refresh()
    } catch (error) {
      setActionError(
        userFacingError(error, 'We couldn’t register your entry. Please try again.'),
      )
    } finally {
      setActing(false)
    }
  }

  async function handleWithdraw() {
    if (acting || !withdrawTarget) return
    setActing(true)
    setActionError(null)
    try {
      await withdrawBonusCompetition(withdrawTarget.competition.id)
      setWithdrawTarget(null)
      refresh()
    } catch (error) {
      setActionError(
        userFacingError(error, 'We couldn’t withdraw your entry. Please try again.'),
      )
    } finally {
      setActing(false)
    }
  }

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/more')}>
        <ChevronLeftIcon size={16} /> More
      </button>
      <h1 className={s.title}>Games</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn’t load the bonus games">
          {state.message}
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={refresh}>
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
          <Skeleton lines={3} />
        </div>
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
      </div>
    )
  }

  const now = new Date(state.serverNow)

  return (
    <div className={s.page}>
      {header}

      {actionError ? (
        <Alert variant="error" title="That didn’t work">
          {actionError}
        </Alert>
      ) : null}

      {state.games.length === 0 ? (
        <EmptyState
          title="No bonus games yet"
          description="Bonus competitions open closer to the tournament. Your Original Predictor entry is unaffected."
        />
      ) : (
        state.games.map((game) => {
          const windows: CompetitionWindow[] = game.windows.map((window) => ({
            id: window.id,
            competitionId: window.competitionId,
            sequence: window.sequence,
            label: window.label,
            opensAt: window.opensAt,
            locksAt: window.locksAt,
            settlesAt: window.settlesAt,
            requiresTieBreakInput: window.requiresTieBreakInput,
            fixtures: deriveWindowFixtureAggregate(window.fixtures, now),
          }))
          const status = resolveCompetitionStatus({
            competition: game.competition,
            windows,
            entrant: game.entrant,
            now,
          })
          const meta = GAME_META[game.competition.gameKey]
          const canRegister = !status.entered && status.state === 'registration_open'
          const canWithdraw =
            status.entered &&
            status.state !== 'complete' &&
            status.state !== 'champion' &&
            status.state !== 'eliminated'

          return (
            <section key={game.competition.id} className={`${s.card} ${g.gameCard}`}>
              <div className={g.gameHeader}>
                <h2 className={g.gameName}>{meta.name}</h2>
                {badgeFor(status)}
              </div>
              <p className={g.tagline}>{meta.tagline}</p>
              <p className={g.stateLine}>{STATE_COPY[status.state]}</p>
              {status.nextDeadline ? (
                <p className={g.deadline}>Deadline: {formatInstant(status.nextDeadline)}</p>
              ) : null}
              <div className={g.actions}>
                {canRegister ? (
                  <Button onClick={() => void handleRegister(game)} disabled={acting}>
                    Enter
                  </Button>
                ) : null}
                {canWithdraw ? (
                  <Button
                    variant="secondary"
                    onClick={() => setWithdrawTarget(game)}
                    disabled={acting}
                  >
                    Withdraw
                  </Button>
                ) : null}
              </div>
            </section>
          )
        })
      )}

      {state.games.some(
        (game) =>
          game.entrant !== null &&
          (game.competition.gameKey === 'ko_predictor' ||
            game.competition.gameKey === 'predictor_cup'),
      ) ? (
        <section className={`${s.card} ${g.gameCard}`}>
          <h2 className={g.gameName}>Knockout predictions</h2>
          <p className={g.tagline}>
            One shared set of knockout scorelines, read by every game you’ve entered.
            Each match locks at its own kickoff.
          </p>
          <div className={g.actions}>
            <Button variant="secondary" onClick={() => navigate('/games/knockout')}>
              Make knockout predictions
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmModal
        open={withdrawTarget !== null}
        onClose={() => {
          if (!acting) setWithdrawTarget(null)
        }}
        onConfirm={handleWithdraw}
        title="Withdraw from this game?"
        confirmLabel="Withdraw"
        destructive
        loading={acting}
      >
        <p>
          You’ll leave{' '}
          {withdrawTarget ? GAME_META[withdrawTarget.competition.gameKey].name : 'this game'}.
          Your Original Predictor entry is not affected, and you can re-enter while
          registration stays open.
        </p>
      </ConfirmModal>
    </div>
  )
}
