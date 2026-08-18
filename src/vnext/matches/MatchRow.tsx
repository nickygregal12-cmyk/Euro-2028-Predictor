import { motion } from 'framer-motion'
import type { MatchListItem, MatchPredictionBadge } from '../models/matches'
import { TeamCrest } from '../components/football/TeamCrest'
import { fixtureColourStyle } from '../foundations/teamColour'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatScoreline } from '../foundations/format'
import { MatchScoreMark, MatchStateMark } from './MatchState'
import text from '../foundations/typography.module.css'
import styles from './matches.module.css'

export type MatchRowProps = {
  readonly match: MatchListItem
  /** Whether this list is showing more than one competition. */
  readonly showCompetition: boolean
  readonly onOpen: (matchId: string) => void
}

/**
 * ONE FIXTURE IN A LIST.
 *
 * ============================ WHAT IS ON IT, AND WHY ======================
 *
 * Teams, the score or the kickoff, the state, and — where the surface needs it
 * — one line of context. That is the hierarchy §9 sets and it is the whole row.
 * Everything else the platform holds about a fixture is a Match Centre's job:
 * a row carrying a table, a form run and a head-to-head is a row that has
 * stopped being scannable and started being a database view.
 *
 * ============================ THE ROW MEASURES ITSELF =====================
 *
 * It declares `container-name: vnext-match-row` and its own body asks the
 * question. Stage 7 established this and it matters more here: at 1920 the
 * fixture column is roughly half the workspace, so a row that queried the PAGE
 * would compose as though it had all of it and would put a single-line desktop
 * layout into a 400px column.
 *
 * ============================ NO CLUB NAME IS TRUNCATED ===================
 *
 * There is no line clamp and no ellipsis on a club name anywhere below. The row
 * grows, the name wraps, and `overflow-wrap: anywhere` stops one long word
 * widening the row. "Inverness Caledonian Rangers" is a world in the Storybook
 * group precisely so this cannot quietly regress.
 *
 * ============================ ONE TARGET, NOT THREE =======================
 *
 * The whole row is ONE button. A row with a crest link, a name link and a
 * "match centre" link is three tab stops to reach one destination and three
 * ways to miss on a phone. The button is at least 44px tall by construction and
 * `e2e/vnext-matches.spec.ts` measures it at every width.
 */
export function MatchRow({ match, showCompetition, onOpen }: MatchRowProps) {
  const press = useVNextMotion(vnextMotion.liftAndPress)
  const live = match.state.kind === 'live'

  // The one line of secondary context this row has room for. In combined scope
  // the competition leads it, because knowing which competition a match is in
  // is the condition that mode exists under.
  const context = showCompetition
    ? (match.contextLabel ?? `${match.competition.name} · ${match.stage.label}`)
    : match.contextLabel

  return (
    /* THE CLUB COLOURS SIT ON A PLAIN ELEMENT, and the wrapper adds no box.
       Framer's `MotionStyle` cannot accept a `CSSProperties` carrying custom
       properties under `exactOptionalPropertyTypes`, and the repository's own
       idiom is already "colour arrives on a plain element" — `VNextShell` puts
       the competition palette on its own `<div>` for the same reason.
       `display: contents` means this element is not in the layout at all; it
       only carries the four `--vnext-fixture-*` properties the row inherits. */
    <div className={styles.rowFrame} style={fixtureColourStyle(match.home, match.away)}>
    <motion.button
      type="button"
      className={styles.row}
      data-vnext-match-row={match.id}
      data-vnext-match-state={match.state.kind}
      data-live={live ? 'true' : undefined}
      variants={press}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      onClick={() => onOpen(match.id)}
    >
      {/* THE ACCESSIBLE NAME IS ONE SENTENCE, and it is the model's.
          Name computation joins text nodes with no separator, so a row built
          from a crest label, two names and two loose numbers announces as
          "GLN Glenmore Athletic2Strathkelvin United1" — which is §31's exact
          counter-example. Everything visible is hidden from the name and the
          summary carries it. */}
      <span className={text.srOnly}>{match.accessibleSummary}</span>

      <span className={styles.rowBody} aria-hidden="true">
        <span className={styles.rowLead}>
          <MatchScoreMark state={match.state} kickoffLabel={match.kickoffLabel} />
        </span>

        {/* `data-vnext-club` IS A STRUCTURAL MARKER, not a style hook. The row's
            composition — stacked on a phone, across at a width that fits — is a
            container query, and `e2e/vnext-matches.spec.ts` proves which shape
            a row actually took by reading where these two names sit. Without a
            marker the measurement has to guess which spans are club names, and
            it guesses wrong the moment a row gains a badge. */}
        <span className={styles.rowClubs}>
          <span className={styles.club} data-vnext-club="home">
            <TeamCrest team={match.home} size="sm" decorative />
            <span className={styles.clubName}>{match.home.name}</span>
          </span>
          <span className={styles.club} data-vnext-club="away">
            <TeamCrest team={match.away} size="sm" decorative />
            <span className={styles.clubName}>{match.away.name}</span>
          </span>
        </span>

        <span className={styles.rowTail}>
          <MatchStateMark state={match.state} />
          {match.prediction ? <PredictionBadge badge={match.prediction} /> : null}
        </span>
      </span>

      {context ? (
        <span className={`${styles.rowContext} ${text.micro}`} aria-hidden="true">
          {context}
        </span>
      ) : null}
    </motion.button>
    </div>
  )
}

/**
 * WHAT THE PLAYER'S GAME SAYS ABOUT THIS FOOTBALL — and nothing more.
 *
 * IT IS A STATUS AND NEVER A CONTROL. There is no way to change a prediction
 * from a fixture list, because Matches asks what is happening in football and
 * the Match Predictor asks what you predict. §14 keeps them apart and this
 * component is where that could most easily have been eroded: a badge with an
 * `onClick` that opened a score entry would be the merge happening by accident.
 *
 * IT IS OPTIONAL AND ORDINARILY ABSENT. The connected list draws no badge at
 * all, because filling it for ten fixtures needs a card read the player may not
 * have — see `integration/matches/matchesSource.ts`.
 */
function PredictionBadge({ badge }: { readonly badge: MatchPredictionBadge }) {
  switch (badge.kind) {
    case 'needed':
      return (
        <span className={`${styles.badge} ${styles.badgeNeeded}`}>Prediction needed</span>
      )
    case 'entered':
      return (
        <span className={`${styles.badge} ${styles.badgeEntered} ${text.numeric}`}>
          You: {formatScoreline(badge.score.home, badge.score.away)}
        </span>
      )
    case 'locked':
      return (
        <span className={`${styles.badge} ${styles.badgeLocked} ${text.numeric}`}>
          Locked {formatScoreline(badge.score.home, badge.score.away)}
        </span>
      )
    default:
      return (
        <span className={`${styles.badge} ${styles.badgeSettled} ${text.numeric}`}>
          {badge.outcomeLabel}
          {badge.points === null ? null : ` · ${badge.points} pts`}
        </span>
      )
  }
}
