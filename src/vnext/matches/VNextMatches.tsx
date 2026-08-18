import { useMemo, useState } from 'react'
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
import { MatchesBrowse, MatchesStageSummary } from './MatchesBrowse'
import { MatchRow } from './MatchRow'
import text from '../foundations/typography.module.css'
import styles from './matches.module.css'

/**
 * WHAT THE PLAYER ASKED THIS SURFACE FOR.
 *
 * ONE INTENT TYPE, NOT FOUR CALLBACKS — the shell's own idiom, for the shell's
 * own reason. In Storybook the host is `useState`; in the dev harness it is a
 * state hook; after the production cutover it will be a router writing a query
 * string. None of those is this page's business, and a page holding four `onX`
 * props would have to be re-plumbed for each of them.
 */
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
   * The browsing state to open with. A host that preserves it in a URL passes
   * it back on the way in; a story passes nothing.
   *
   * IT IS AN INITIAL VALUE AND NOT A CONTROLLED PROP. §30 asks for deliberate
   * state and warns against an enormous query-string machine, and this is the
   * smaller of the two shapes: the page owns the interaction, the host owns
   * persistence, and pressing a filter never has to survive a round trip
   * through a router before the list changes.
   */
  readonly initialView?: MatchesView | undefined
  readonly onIntent?: ((intent: MatchesIntent) => void) | undefined
}

/**
 * vNEXT MATCHES — WHAT FOOTBALL IS HAPPENING?
 *
 * ============================ IT IS A COMPETITION'S FOOTBALL ==============
 *
 * The Competition Deck is the selected architecture, so this page is the ACTIVE
 * COMPETITION's matches and not a platform fixture database filtered down to
 * them. That is a data shape rather than a promise: `MatchesModel` carries one
 * `competition`, and the combined mode is a secondary scope over the player's
 * own competitions — never the landing state, and never a fifth destination.
 *
 * ============================ FOOTBALL, NOT GAMES =========================
 *
 * Everything on this page is a real fixture. The Match Predictor, Last Man
 * Standing and the Predictor Championship are GAMES and live behind `Games`;
 * the only thing of theirs that appears here is an optional status badge on a
 * row, which cannot be pressed and cannot collect a score.
 *
 * ============================ THE COMPOSITION =============================
 *
 *   compact  (< 760px)   one column: browse controls, then days, then rows.
 *                        A row is TWO LINES — the clubs stacked, the score or
 *                        kickoff leading — because that is what stays scannable
 *                        at 375 without abbreviating a club to three letters.
 *   regular  (>= 760px)  the same column with more room per row; the day
 *                        heading gains its count.
 *   expanded (>= 1120px) TWO COLUMNS. The fixtures keep the working column and
 *                        the browsing controls move BESIDE them, where they
 *                        stop consuming vertical space above the football. The
 *                        row becomes single-line, because at that width the
 *                        clubs, the score and the state fit on one.
 *
 * Desktop is not a stretched phone and mobile is not a squeezed scoreboard:
 * the row's own container query decides which shape it takes, so a row in a
 * 400px side column composes as a phone row even at 1920.
 *
 * ============================ NOTHING HERE READS A CLOCK ==================
 *
 * Not one component below compares an instant to `Date.now()`. Live is
 * `state.kind === 'live'`, the minute is the provider's or absent, and the day
 * headings and kickoff labels were formatted by the mapper against the model's
 * own `generatedAt`.
 */
export function VNextMatches({ model, initialView, onIntent }: VNextMatchesProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)

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
            // SAID, RATHER THAN SILENTLY DRAWN LESS. An enrichment that did not
            // answer is a fact about this page, and a reader who cannot see
            // their prediction status deserves to know it is missing rather
            // than concluding they have not predicted.
            <p className={`${text.micro} ${styles.unavailable}`}>
              Not available just now: {model.unavailable.join(', ')}.
            </p>
          ) : null}
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
                aria-labelledby={`vnext-day-${day.key}`}
              >
                <h2 id={`vnext-day-${day.key}`} className={`${text.label} ${styles.dayHeading}`}>
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
                        // The competition is named on every row in combined
                        // scope — the condition that mode exists under — and
                        // also whenever the window itself spans more than one.
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

/**
 * NO FOOTBALL, SAID PROPERLY.
 *
 * THE TWO EMPTY STATES ARE DIFFERENT SENTENCES. "Nothing in this window" is a
 * fact about the competition — an international break, a season that has not
 * started. "Nothing matches this filter" is a fact about the CONTROL the player
 * just pressed, and the useful thing to offer is the way back. Collapsing them
 * would tell a player who filtered to Live on a Tuesday that their competition
 * has no fixtures.
 *
 * NEITHER INVENTS CONTENT. There is no "you might like", no sample fixture and
 * no placeholder row — §25's rule, and the one an empty state is most often
 * broken by.
 */
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
