import { useMemo, useState, type FormEvent } from 'react'
import { EmptyState } from '../../design-system'
import { CalendarIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { confirmGroupMatchResult } from '../../services/supabase/adminResults'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import a from './admin.module.css'

type PendingResult = {
  matchId: string
  matchLabel: string
  homeLabel: string
  awayLabel: string
  homeScore: number
  awayScore: number
}

export function AdminResultsPage() {
  const tournament = useTournamentData()
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [pending, setPending] = useState<PendingResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const summary = useMemo(() => {
    if (tournament.status !== 'ready') return null

    const matches = tournament.data.matches
    const teamNames = new Map(tournament.data.teams.map((team) => [team.id, team.name]))
    const awaiting = matches.filter(
      (match) => match.homeScore === null || match.awayScore === null,
    )
    const editable = awaiting.filter(
      (match) => match.round === 'group' && match.homeTeamId && match.awayTeamId,
    )

    return {
      total: matches.length,
      confirmed: matches.length - awaiting.length,
      awaiting,
      editable,
      teamNames,
    }
  }, [tournament])

  if (tournament.status === 'error') {
    return (
      <div className={s.page}>
        <EmptyState
          icon={<CalendarIcon size={22} />}
          title="Couldn’t load result administration"
          description={tournament.message}
        />
      </div>
    )
  }

  if (!summary) return <div className={s.page} />

  const selectedMatch = summary.editable.find((match) => match.id === selectedMatchId)

  function labelForTeam(teamId: string | null, fallback: string) {
    return (teamId && summary?.teamNames.get(teamId)) || fallback
  }

  function prepareReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (!selectedMatch) {
      setMessage('Choose a group-stage fixture first.')
      return
    }

    const parsedHome = Number(homeScore)
    const parsedAway = Number(awayScore)
    if (
      !Number.isInteger(parsedHome) ||
      !Number.isInteger(parsedAway) ||
      parsedHome < 0 ||
      parsedAway < 0 ||
      parsedHome > 99 ||
      parsedAway > 99
    ) {
      setMessage('Enter whole-number scores between 0 and 99.')
      return
    }

    setPending({
      matchId: selectedMatch.id,
      matchLabel: selectedMatch.matchRef,
      homeLabel: labelForTeam(selectedMatch.homeTeamId, selectedMatch.homeSource),
      awayLabel: labelForTeam(selectedMatch.awayTeamId, selectedMatch.awaySource),
      homeScore: parsedHome,
      awayScore: parsedAway,
    })
  }

  async function confirmPendingResult() {
    if (!pending || submitting) return
    setSubmitting(true)
    setMessage(null)

    try {
      await confirmGroupMatchResult({
        matchId: pending.matchId,
        homeScore: pending.homeScore,
        awayScore: pending.awayScore,
      })
      setPending(null)
      setSelectedMatchId('')
      setHomeScore('')
      setAwayScore('')
      setMessage(`${pending.matchLabel} was confirmed successfully.`)
      tournament.reload()
    } catch (error) {
      setMessage(userFacingError(error, 'The result could not be confirmed.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Admin control room</span>
        <h1 className={s.title}>Results Centre</h1>
        <p className={a.intro}>
          Confirm group-stage results through the authorised server workflow. Every
          accepted result enters the existing revision and scoring lifecycle.
        </p>
      </div>

      <div className={a.summaryGrid} aria-label="Result status summary">
        <div className={s.card}>
          <span className={s.eyebrow}>Fixtures</span>
          <strong className={a.metric}>{summary.total}</strong>
        </div>
        <div className={s.card}>
          <span className={s.eyebrow}>Confirmed</span>
          <strong className={a.metric}>{summary.confirmed}</strong>
        </div>
        <div className={s.card}>
          <span className={s.eyebrow}>Awaiting result</span>
          <strong className={a.metric}>{summary.awaiting.length}</strong>
        </div>
      </div>

      <section className={s.card} aria-labelledby="enter-result-heading">
        <div className={a.sectionHeading}>
          <div>
            <span className={s.eyebrow}>Controlled write</span>
            <h2 id="enter-result-heading" className={a.sectionTitle}>
              Enter a group result
            </h2>
          </div>
        </div>

        <form className={a.resultForm} onSubmit={prepareReview}>
          <label className={a.field}>
            <span>Fixture</span>
            <select
              value={selectedMatchId}
              onChange={(event) => {
                setSelectedMatchId(event.target.value)
                setPending(null)
                setMessage(null)
              }}
              disabled={submitting}
            >
              <option value="">Choose a fixture</option>
              {summary.editable.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.matchRef}: {labelForTeam(match.homeTeamId, match.homeSource)} vs{' '}
                  {labelForTeam(match.awayTeamId, match.awaySource)}
                </option>
              ))}
            </select>
          </label>

          <div className={a.scoreGrid}>
            <label className={a.field}>
              <span>{selectedMatch ? labelForTeam(selectedMatch.homeTeamId, 'Home') : 'Home score'}</span>
              <input
                type="number"
                min="0"
                max="99"
                step="1"
                inputMode="numeric"
                value={homeScore}
                onChange={(event) => {
                  setHomeScore(event.target.value)
                  setPending(null)
                }}
                disabled={submitting}
              />
            </label>
            <label className={a.field}>
              <span>{selectedMatch ? labelForTeam(selectedMatch.awayTeamId, 'Away') : 'Away score'}</span>
              <input
                type="number"
                min="0"
                max="99"
                step="1"
                inputMode="numeric"
                value={awayScore}
                onChange={(event) => {
                  setAwayScore(event.target.value)
                  setPending(null)
                }}
                disabled={submitting}
              />
            </label>
          </div>

          <button className={a.primaryAction} type="submit" disabled={submitting}>
            Review result
          </button>
        </form>

        {pending ? (
          <div className={a.reviewPanel} role="region" aria-label="Result confirmation">
            <strong>Confirm {pending.matchLabel}</strong>
            <p>
              {pending.homeLabel} {pending.homeScore}–{pending.awayScore} {pending.awayLabel}
            </p>
            <p className={a.warningText}>
              This will create the authoritative result and trigger the existing scoring lifecycle.
            </p>
            <div className={a.actionRow}>
              <button
                className={a.secondaryAction}
                type="button"
                onClick={() => setPending(null)}
                disabled={submitting}
              >
                Go back
              </button>
              <button
                className={a.primaryAction}
                type="button"
                onClick={confirmPendingResult}
                disabled={submitting}
              >
                {submitting ? 'Confirming…' : 'Confirm result'}
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className={a.statusMessage} role="status">{message}</p> : null}
      </section>

      <section className={s.card} aria-labelledby="awaiting-results-heading">
        <div className={a.sectionHeading}>
          <div>
            <span className={s.eyebrow}>Fixture queue</span>
            <h2 id="awaiting-results-heading" className={a.sectionTitle}>
              Awaiting result
            </h2>
          </div>
          <span className={a.count}>{summary.awaiting.length}</span>
        </div>
        <div className={a.fixtureList}>
          {summary.awaiting.slice(0, 12).map((match) => (
            <div key={match.id} className={a.fixtureRow}>
              <strong>{match.matchRef}</strong>
              <span className={a.fixtureMeta}>{match.round.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
