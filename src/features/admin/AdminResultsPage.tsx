import { useMemo } from 'react'
import { EmptyState } from '../../design-system'
import { CalendarIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import s from '../shared.module.css'
import a from './admin.module.css'

export function AdminResultsPage() {
  const tournament = useTournamentData()

  const summary = useMemo(() => {
    if (tournament.status !== 'ready') return null

    const teamNames = new Map(
      tournament.data.teams.map((team) => [team.id, team.name]),
    )
    const matches = tournament.data.matches
    const confirmed = matches.filter(
      (match) => match.homeScore !== null && match.awayScore !== null,
    )
    const awaiting = matches.filter(
      (match) => match.homeScore === null || match.awayScore === null,
    )

    return { matches, confirmed, awaiting, teamNames }
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

  const teamName = (teamId: string | null, source: string) =>
    (teamId ? summary.teamNames.get(teamId) : null) ?? source

  return (
    <div className={s.page}>
      <header className={s.header}>
        <span className={s.eyebrow}>Admin control room</span>
        <h1 className={s.title}>Results Centre</h1>
        <p className={a.intro}>
          Review the development tournament state. Result-writing controls remain
          disabled until the independently authorised RPC boundary is installed.
        </p>
      </header>

      <div className={a.summaryGrid} aria-label="Result status summary">
        <div className={s.card}>
          <span className={s.eyebrow}>Fixtures</span>
          <strong className={a.metric}>{summary.matches.length}</strong>
        </div>
        <div className={s.card}>
          <span className={s.eyebrow}>Confirmed</span>
          <strong className={a.metric}>{summary.confirmed.length}</strong>
        </div>
        <div className={s.card}>
          <span className={s.eyebrow}>Awaiting result</span>
          <strong className={a.metric}>{summary.awaiting.length}</strong>
        </div>
      </div>

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
          {summary.awaiting.slice(0, 16).map((match) => (
            <div key={match.id} className={a.fixtureRow}>
              <div>
                <strong>
                  {teamName(match.homeTeamId, match.homeSource)} vs{' '}
                  {teamName(match.awayTeamId, match.awaySource)}
                </strong>
                <span className={a.fixtureMeta}>
                  {match.matchRef} · {match.round === 'group' ? `Matchday ${match.matchday}` : match.round.toUpperCase()}
                </span>
              </div>
              <span className={a.status}>Awaiting</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
