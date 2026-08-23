import { useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type {
  MatchesFilter,
  MatchesModel,
  MatchesScope,
} from '../models/matches'
import { competitionsInModel, filterMatchDays } from '../models/matches'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { LeagueTablePanel, type MatchesLeagueTableState } from './LeagueTablePanel'
import { MatchesBrowse, MatchesStageSummary } from './MatchesBrowse'
import { MatchRow } from './MatchRow'
import text from '../foundations/typography.module.css'
import styles from './matches.module.css'

export type MatchesIntent =
  | { readonly kind: 'openMatch'; readonly matchId: string }
  | { readonly kind: 'filter'; readonly filter: MatchesFilter }
  | { readonly kind: 'scope'; readonly scope: MatchesScope }

export type MatchesView = {
  readonly filter: MatchesFilter
}

export type VNextMatchesProps = {
  readonly model: MatchesModel
  /**
   * SECONDARY FOOTBALL CONTEXT. Presentation defaults to unavailable so the
   * deterministic/marketing renders remain fixture-only. The connected route
   * supplies the existing authoritative table read when one exists.
   */
  readonly leagueTable?: MatchesLeagueTableState | undefined
  readonly initialView?: MatchesView | undefined
  readonly onIntent?: ((intent: MatchesIntent) => void) | undefined
}

/**
 * vNEXT MATCHES — WHAT FOOTBALL IS HAPPENING?
 *
 * Fixtures remain the page purpose. League standings are context: collapsed
 * behind one compact control on phone and placed in the spare secondary column
 * on wide desktop. They never become a permanent block above the football.
 *
 * The fixture row itself measures its own container. On compact rows the two
 * clubs read like a small football scoreboard with the score/kickoff beside the
 * pairing; once the row has room it becomes the conventional
 * `home · score/time · away` line. Full club names wrap rather than truncate.
 */
export function VNextMatches({
  model,
  leagueTable = { kind: 'unavailable' },
  initialView,
  onIntent,
}: VNextMatchesProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)
  const dayIds = useId()
  const [filter, setFilter] = useState<MatchesFilter>(initialView?.filter ?? 'all')

  const days = useMemo(() => filterMatchDays(model, filter), [model, filter])
  const competitions = useMemo(() => competitionsInModel(model), [model])
  const combined = model.scope.active === 'combined'

  function chooseFilter(next: MatchesFilter) {
    setFilter(next)
    onIntent?.({ kind: 'filter', filter: next })
  }

  return (
    <VNextShell
      destination="matches"
      competitionColours={model.competition.colours}
      header={
        <VNextPageHeader
          title="Matches"
          competition={
            model.competition.seasonLabel
              ? `${model.competition.name} · ${model.competition.seasonLabel}`
              : model.competition.name
          }
          context={
            combined
              ? `Across your ${model.scope.competitionCount} competitions`
              : (model.windowLabel ?? undefined)
          }
        />
      }
    >
      <div className={styles.page} data-vnext-matches-scope={model.scope.active}>
        <motion.div
          className={styles.controls}
          variants={rise}
          initial="hidden"
          animate="visible"
        >
          <MatchesBrowse
            model={model}
            filter={filter}
            onFilter={chooseFilter}
            onScope={(scope) => onIntent?.({ kind: 'scope', scope })}
          />
          <MatchesStageSummary model={model} />
          {model.unavailable.length > 0 ? (
            <p className={`${text.micro} ${styles.unavailable}`}>
              Not available just now: {model.unavailable.join(', ')}.
            </p>
          ) : null}
          <LeagueTablePanel table={leagueTable} />
        </motion.div>

        <motion.div
          className={styles.fixtures}
          data-vnext-zone="fixtures"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {days.length === 0 ? (
            <MatchesEmpty model={model} filter={filter} />
          ) : (
            days.map((day) => (
              <motion.section
                key={day.key}
                className={styles.day}
                variants={rise}
                aria-labelledby={`${dayIds}-${day.key}`}
              >
                <h2 id={`${dayIds}-${day.key}`} className={`${text.label} ${styles.dayHeading}`}>
                  {day.label}
                  <span className={`${styles.dayCount} ${text.numeric}`}>
                    {day.matches.length}
                    <span className={text.srOnly}>
                      {day.matches.length === 1 ? ' match' : ' matches'}
                    </span>
                  </span>
                </h2>
                <ul className={styles.dayList}>
                  {day.matches.map((match) => (
                    <li key={match.id}>
                      <MatchRow
                        match={match}
                        showCompetition={combined || competitions.length > 1}
                        onOpen={(matchId) => onIntent?.({ kind: 'openMatch', matchId })}
                      />
                    </li>
                  ))}
                </ul>
              </motion.section>
            ))
          )}
        </motion.div>
      </div>
    </VNextShell>
  )
}

function MatchesEmpty({
  model,
  filter,
}: {
  readonly model: MatchesModel
  readonly filter: MatchesFilter
}) {
  const filtered = filter !== 'all' && model.counts.all > 0

  return (
    <div className={styles.empty} data-vnext-matches-empty={filtered ? 'filter' : 'window'}>
      <p className={text.title}>
        {filtered ? 'Nothing here right now' : 'No matches in this window'}
      </p>
      <p className={`${text.body} ${styles.emptyBody}`}>
        {filtered
          ? `There are ${model.counts.all} matches in this window, but none of them are ${filter}.`
          : model.windowLabel
            ? `${model.competition.name} has no fixtures between ${model.windowLabel}.`
            : `${model.competition.name} has no fixtures in this window.`}
      </p>
    </div>
  )
}