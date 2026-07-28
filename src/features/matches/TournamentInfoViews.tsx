// The Tables / Bracket / Stats sub-views of the Matches tab (design-system
// §Matches — the time-shaped tournament view). Presentational: every ordering
// and record comes in via the tournamentInfoPipeline view models; the user's
// derived predicted goals total is the one entry-side fact shown (the awards
// race), passed in ready-made.

import { GroupTable, ThirdPlaceTable, EmptyState } from '../../design-system'
import { InfoIcon, TrophyIcon } from '../../design-system/icons'
import type {
  LiveTablesView,
  BracketRoundVM,
  BracketTieVM,
  StatsView,
} from './tournamentInfoPipeline'
import type { GroupGoalsSummary } from '../../domain/tournament/groupGoals'
import s from './MatchesTab.module.css'

// --- Tables ---------------------------------------------------------------

export function MatchesTablesView({ view }: { view: LiveTablesView }) {
  return (
    <>
      <p className={s.statusLine}>
        {view.playedCount === 0
          ? 'No results yet — tables show the tournament draw.'
          : `After ${view.playedCount} of ${view.totalCount} group games.`}
      </p>
      {view.hasUnresolvedTies ? (
        <p className={s.tieNote}>
          <InfoIcon size={14} className={s.noteIcon} />
          <span>Teams level on every criterion share a position until results separate them.</span>
        </p>
      ) : null}

      {view.groups.map((g) => (
        <section key={g.letter} className={s.tableSection}>
          <h2 className={s.sectionTitle}>{g.caption}</h2>
          <GroupTable caption={g.caption} rows={g.rows} />
        </section>
      ))}

      <section className={s.tableSection}>
        <h2 className={s.sectionTitle}>Best thirds</h2>
        {view.thirds ? (
          <ThirdPlaceTable rows={view.thirds} />
        ) : (
          <p className={s.statusLine}>The best-thirds race appears once group games are played.</p>
        )}
      </section>
    </>
  )
}

// --- Bracket --------------------------------------------------------------

function BracketTieCard({ tie, onOpen }: { tie: BracketTieVM; onOpen: (ref: string) => void }) {
  const sideClass = (side: 'home' | 'away') => {
    const vm = side === 'home' ? tie.home : tie.away
    if (!vm.known) return `${s.tieTeam} ${s.tieUnknown}`
    if (tie.winner === null) return s.tieTeam
    return tie.winner === side ? `${s.tieTeam} ${s.tieWinner}` : `${s.tieTeam} ${s.tieLoser}`
  }
  return (
    <button type="button" className={s.tie} onClick={() => onOpen(tie.ref)}>
      <span className={s.tieMeta}>
        {tie.dateLabel} · {tie.venue}
      </span>
      <span className={s.tieLine}>
        <span className={sideClass('home')}>{tie.home.name}</span>
        <span className={s.tieScore}>{tie.score ? `${tie.score.home}–${tie.score.away}` : 'v'}</span>
        <span className={`${sideClass('away')} ${s.tieAway}`}>{tie.away.name}</span>
      </span>
      {tie.detail ? <span className={s.tieDetail}>{tie.detail}</span> : null}
    </button>
  )
}

export function MatchesBracketView({
  rounds,
  onOpen,
}: {
  rounds: BracketRoundVM[]
  onOpen: (ref: string) => void
}) {
  if (rounds.length === 0) {
    return <EmptyState icon={<TrophyIcon size={22} />} title="No knockout fixtures yet" />
  }
  return (
    <>
      <p className={s.statusLine}>
        Slots fill from real group standings as groups finish — this is the tournament's bracket,
        not your predictions.
      </p>
      {rounds.map((round) => (
        <section key={round.key} className={s.tableSection}>
          <h2 className={s.sectionTitle}>{round.label}</h2>
          <div className={s.rows}>
            {round.ties.map((tie) => (
              <BracketTieCard key={tie.ref} tie={tie} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

// --- Stats ----------------------------------------------------------------

export function MatchesStatsView({
  view,
  predictedGroupGoals,
  tournamentDates,
  hostCities,
}: {
  view: StatsView
  predictedGroupGoals: GroupGoalsSummary
  tournamentDates: string
  hostCities: string[]
}) {
  const fullyPredicted =
    predictedGroupGoals.matchCount > 0 &&
    predictedGroupGoals.predictedCount === predictedGroupGoals.matchCount

  return (
    <>
      <section className={s.tableSection}>
        <h2 className={s.sectionTitle}>Group-stage goals</h2>
        <div className={s.statCard}>
          <p className={s.statBig}>
            {view.groupGoals.total}
            <span className={s.statBigUnit}> goals</span>
          </p>
          <p className={s.statSub}>
            after {view.groupGoals.played} of {view.groupGoals.matchCount} group games
          </p>
          {fullyPredicted ? (
            <p className={s.statSub}>You said {predictedGroupGoals.total}</p>
          ) : null}
        </div>
      </section>

      <section className={s.tableSection}>
        <h2 className={s.sectionTitle}>Records</h2>
        {view.records.length === 0 ? (
          <p className={s.statusLine}>Records appear once matches are played.</p>
        ) : (
          <div className={s.statCard}>
            <dl className={s.factList}>
              {view.records.map((r) => (
                <div key={r.label} className={s.factRow}>
                  <dt className={s.factLabel}>{r.label}</dt>
                  <dd className={s.factValue}>{r.value}</dd>
                </div>
              ))}
              {view.goalsPerMatch !== null ? (
                <div className={s.factRow}>
                  <dt className={s.factLabel}>Goals per match</dt>
                  <dd className={s.factValue}>{view.goalsPerMatch}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        )}
      </section>

      <section className={s.tableSection}>
        <h2 className={s.sectionTitle}>Top-scoring teams</h2>
        {view.topTeams.length === 0 ? (
          <p className={s.statusLine}>Team goal counts appear once matches are played.</p>
        ) : (
          <div className={s.statCard}>
            <ol className={s.teamGoalList}>
              {view.topTeams.map((t) => (
                <li key={t.name} className={s.teamGoalRow}>
                  <span className={s.teamGoalName}>{t.name}</span>
                  <span className={s.teamGoalCount}>
                    {t.goals} {t.goals === 1 ? 'goal' : 'goals'} · {t.played} played
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className={s.tableSection}>
        <h2 className={s.sectionTitle}>Tournament</h2>
        <div className={s.statCard}>
          <dl className={s.factList}>
            <div className={s.factRow}>
              <dt className={s.factLabel}>Dates</dt>
              <dd className={s.factValue}>{tournamentDates}</dd>
            </div>
            <div className={s.factRow}>
              <dt className={s.factLabel}>Host cities</dt>
              <dd className={s.factValue}>{hostCities.join(' · ')}</dd>
            </div>
            <div className={s.factRow}>
              <dt className={s.factLabel}>Matches</dt>
              <dd className={s.factValue}>
                {view.played} of {view.totalMatches} played
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </>
  )
}
