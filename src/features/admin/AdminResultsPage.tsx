import { useMemo, useState } from 'react'
import { Button, EmptyState } from '../../design-system'
import { CalendarIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import type { Match } from '../../services/supabase/tournamentData'
import { ResultEntryPanel } from './ResultEntryPanel'
import s from '../shared.module.css'
import a from './admin.module.css'

export function AdminResultsPage() {
  const tournament = useTournamentData()
  const [selected, setSelected] = useState<Match | null>(null)

  const summary = useMemo(() => {
    if (tournament.status !== 'ready') return null

    const matches = tournament.data.matches
    const confirmed = matches.filter((match) => match.homeScore !== null && match.awayScore !== null)
    const awaiting = matches.filter((match) => match.homeScore === null || match.awayScore === null)
    const teamNames = new Map(tournament.data.teams.map((team) => [team.id, team.name]))

    return {
      total: matches.length,
      confirmed: confirmed.length,
      awaiting,
      teamNames,
    }
  }, [tournament])

  if (tournament.status === 'error') {
    return (
      <div className={s.page}>
        <EmptyState icon={<CalendarIcon size={22} />} title="Couldn’t load result administration" description={tournament.message} />
      </div>
    )
  }

  if (!summary) return <div className={s.page} />

  const teamName = (teamId: string | null, source: string) =>
    (teamId ? summary.teamNames.get(teamId) : null) ?? source ?? 'TBC'

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Admin control room</span>
        <h1 className={s.title}>Results Centre</h1>
        <p className={a.intro}>Review and validate match results. Saving remains unavailable in this build.</p>
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

      {selected ? (
        <ResultEntryPanel
          match={selected}
          homeName={teamName(selected.homeTeamId, selected.homeSource)}
          awayName={teamName(selected.awayTeamId, selected.awaySource)}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <section className={s.card} aria-labelledby="awaiting-results-heading">
        <div className={a.sectionHeading}>
          <div>
            <span className={s.eyebrow}>Fixture queue</span>
            <h2 id="awaiting-results-heading" className={a.sectionTitle}>Awaiting result</h2>
          </div>
          <span className={a.count}>{summary.awaiting.length}</span>
        </div>

        {summary.awaiting.length === 0 ? (
          <p className={a.muted}>Every fixture currently has a recorded score.</p>
        ) : (
          <div className={a.fixtureList}>
            {summary.awaiting.slice(0, 12).map((match) => (
              <div key={match.id} className={a.fixtureRow}>
                <div>
                  <strong>{teamName(match.homeTeamId, match.homeSource)} vs {teamName(match.awayTeamId, match.awaySource)}</strong>
                  <span className={a.fixtureMeta}>{match.matchRef} · {match.round === 'group' ? 'Group stage' : match.round.toUpperCase()}</span>
                </div>
                <Button variant="secondary" onClick={() => setSelected(match)}>Enter result</Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
