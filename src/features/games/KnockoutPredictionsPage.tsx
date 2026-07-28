import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, EmptyState, ScoreInput, Skeleton, StatusBadge } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import type { Match, Team } from '../../services/supabase/tournamentData'
import {
  deleteKnockoutPrediction,
  fetchMyKnockoutPredictions,
  saveKnockoutPrediction,
} from '../../services/supabase/knockoutPredictions'
import type { KnockoutPredictionRead } from '../../services/supabase/knockoutPredictionsModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import g from './games.module.css'

const ROUND_LABEL: Record<string, string> = {
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
}

type Draft = {
  home: number | null
  away: number | null
  advancingTeamId: string | null
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      serverNow: string
      storeEntrant: boolean
      saved: Map<string, KnockoutPredictionRead>
    }

function draftOf(saved: KnockoutPredictionRead | undefined): Draft {
  if (!saved) return { home: null, away: null, advancingTeamId: null }
  return {
    home: saved.homeScore,
    away: saved.awayScore,
    advancingTeamId: saved.advancingTeamId,
  }
}

function whenOf(match: Match): number {
  return new Date(match.kickoffAt ?? match.matchDate).getTime()
}

export function KnockoutPredictionsPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map())
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null)
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
    fetchMyKnockoutPredictions(tournamentId)
      .then((read) => {
        if (!active) return
        const saved = new Map(read.predictions.map((p) => [p.matchId, p]))
        setState({
          status: 'ready',
          serverNow: read.serverNow,
          storeEntrant: read.storeEntrant,
          saved,
        })
        setDrafts(new Map())
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(
              error,
              'Your knockout predictions are unavailable. Please try again.',
            ),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data.status, reloadKey, tournamentId])

  const knockoutMatches = useMemo(() => {
    if (data.status !== 'ready') return []
    return data.data.matches
      .filter((match) => match.round !== 'group')
      .slice()
      .sort((a, b) => whenOf(a) - whenOf(b) || a.matchRef.localeCompare(b.matchRef))
  }, [data])

  const teamById = useMemo(() => {
    if (data.status !== 'ready') return new Map<string, Team>()
    return new Map(data.data.teams.map((team) => [team.id, team]))
  }, [data])

  function refresh() {
    setReloadKey((key) => key + 1)
  }

  function draftFor(match: Match, saved: KnockoutPredictionRead | undefined): Draft {
    return drafts.get(match.id) ?? draftOf(saved)
  }

  function setDraft(matchId: string, next: Draft) {
    setDrafts((current) => {
      const copy = new Map(current)
      copy.set(matchId, next)
      return copy
    })
  }

  async function handleSave(match: Match, draft: Draft, saved: KnockoutPredictionRead | undefined) {
    if (savingMatchId || draft.home === null || draft.away === null) return
    setSavingMatchId(match.id)
    setActionError(null)
    try {
      await saveKnockoutPrediction({
        matchId: match.id,
        homeScore: draft.home,
        awayScore: draft.away,
        advancingTeamId: draft.home === draft.away ? draft.advancingTeamId : null,
        expectedVersion: saved ? saved.version : null,
      })
      refresh()
    } catch (error) {
      setActionError(
        userFacingError(error, 'We couldn’t save that prediction. Please try again.'),
      )
    } finally {
      setSavingMatchId(null)
    }
  }

  async function handleClear(match: Match, saved: KnockoutPredictionRead) {
    if (savingMatchId) return
    setSavingMatchId(match.id)
    setActionError(null)
    try {
      await deleteKnockoutPrediction(match.id, saved.version)
      refresh()
    } catch (error) {
      setActionError(
        userFacingError(error, 'We couldn’t clear that prediction. Please try again.'),
      )
    } finally {
      setSavingMatchId(null)
    }
  }

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/games')}>
        <ChevronLeftIcon size={16} /> Games
      </button>
      <h1 className={s.title}>Knockout predictions</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn’t load your knockout predictions">
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

  if (state.status === 'loading' || data.status !== 'ready') {
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

  if (!state.storeEntrant) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          title="Enter a knockout game first"
          description="Knockout scoreline predictions are shared by the KO Predictor and the Predictor Cup. Enter one of them from the Games hub to start predicting."
          action={<Button onClick={() => navigate('/games')}>Open the Games hub</Button>}
        />
      </div>
    )
  }

  const nowMs = new Date(state.serverNow).getTime()

  return (
    <div className={s.page}>
      {header}

      <p className={g.tagline}>
        One prediction per real match, shared by every knockout game. Each match
        locks at its own kickoff. A drawn scoreline needs a “who goes through?”
        pick; a decisive one implies it.
      </p>

      {actionError ? (
        <Alert variant="error" title="That didn’t work">
          {actionError}
        </Alert>
      ) : null}

      {knockoutMatches.length === 0 ? (
        <EmptyState
          title="No knockout fixtures yet"
          description="Knockout ties appear here once the tournament schedule includes them."
        />
      ) : (
        knockoutMatches.map((match) => {
          const saved = state.saved.get(match.id)
          const draft = draftFor(match, saved)
          const scheduled = match.kickoffAt !== null
          const locked = scheduled && nowMs >= new Date(match.kickoffAt as string).getTime()
          const editable = scheduled && !locked
          const homeName = match.homeTeamId
            ? (teamById.get(match.homeTeamId)?.name ?? match.homeSource)
            : match.homeSource
          const awayName = match.awayTeamId
            ? (teamById.get(match.awayTeamId)?.name ?? match.awaySource)
            : match.awaySource
          const isDraw =
            draft.home !== null && draft.away !== null && draft.home === draft.away
          const teamsKnown = match.homeTeamId !== null && match.awayTeamId !== null
          const complete =
            draft.home !== null &&
            draft.away !== null &&
            (!isDraw || (teamsKnown && draft.advancingTeamId !== null))
          const dirty =
            draft.home !== (saved?.homeScore ?? null) ||
            draft.away !== (saved?.awayScore ?? null) ||
            (isDraw ? draft.advancingTeamId : null) !== (saved?.advancingTeamId ?? null)

          return (
            <section key={match.id} className={`${s.card} ${g.gameCard}`}>
              <div className={g.gameHeader}>
                <h2 className={g.gameName}>
                  {ROUND_LABEL[match.round] ?? match.round} · {match.matchRef}
                </h2>
                {locked ? <StatusBadge variant="locked" /> : null}
                {saved && !locked ? <StatusBadge variant="submitted" label="Saved" /> : null}
              </div>

              <div className={g.scoreRow}>
                <span className={g.teamName}>{homeName}</span>
                <ScoreInput
                  value={draft.home}
                  ariaLabel={`${homeName} score`}
                  locked={!editable}
                  onChange={(value) => setDraft(match.id, { ...draft, home: value })}
                />
                <span aria-hidden="true">–</span>
                <ScoreInput
                  value={draft.away}
                  ariaLabel={`${awayName} score`}
                  locked={!editable}
                  onChange={(value) => setDraft(match.id, { ...draft, away: value })}
                />
                <span className={g.teamName}>{awayName}</span>
              </div>

              {!scheduled ? <p className={g.deadline}>Kickoff to be confirmed</p> : null}

              {isDraw && editable ? (
                teamsKnown ? (
                  <div role="group" aria-label="Who goes through?" className={g.actions}>
                    <Button
                      variant={draft.advancingTeamId === match.homeTeamId ? 'primary' : 'secondary'}
                      onClick={() =>
                        setDraft(match.id, { ...draft, advancingTeamId: match.homeTeamId })
                      }
                    >
                      {homeName} through
                    </Button>
                    <Button
                      variant={draft.advancingTeamId === match.awayTeamId ? 'primary' : 'secondary'}
                      onClick={() =>
                        setDraft(match.id, { ...draft, advancingTeamId: match.awayTeamId })
                      }
                    >
                      {awayName} through
                    </Button>
                  </div>
                ) : (
                  <p className={g.deadline}>
                    A drawn scoreline needs a “who goes through?” pick once both teams are known.
                  </p>
                )
              ) : null}

              {editable ? (
                <div className={g.actions}>
                  <Button
                    onClick={() => void handleSave(match, draft, saved)}
                    disabled={!complete || !dirty || savingMatchId !== null}
                  >
                    Save
                  </Button>
                  {saved ? (
                    <Button
                      variant="secondary"
                      onClick={() => void handleClear(match, saved)}
                      disabled={savingMatchId !== null}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </section>
          )
        })
      )}
    </div>
  )
}
