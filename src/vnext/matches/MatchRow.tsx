import { motion } from 'framer-motion'
import type { MatchListItem, MatchPredictionBadge } from '../models/matches'
import { TeamCrest } from '../components/football/TeamCrest'
import { fixtureColourStyle } from '../foundations/teamColour'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatScoreline } from '../foundations/format'
import { MatchScoreMark, MatchStateMark } from './MatchState'
import text from '../foundations/typography.module.css'
import styles from './MatchRow.module.css'

export type MatchRowProps = {
  readonly match: MatchListItem
  readonly showCompetition: boolean
  readonly onOpen: (matchId: string) => void
}

/**
 * ONE FIXTURE IN A LIST, WITH A FOOTBALL-SCOREBOARD READING ORDER.
 *
 * The compact row used to put score/kickoff first, then stack both clubs in a
 * middle column and put state at the far edge. It was geometrically valid and
 * visually weak: the eye read three unrelated columns before it understood the
 * fixture. Real-use feedback caught what overflow tests could not.
 *
 * The new composition groups the clubs and score/time into ONE scoreboard.
 * Compact: home above away with the score/time in a stable adjacent column.
 * Wide: home identity | score/time | away identity. State/prediction remains a
 * secondary tail. Full names wrap and the whole row remains one 44px+ target.
 */
export function MatchRow({ match, showCompetition, onOpen }: MatchRowProps) {
  const press = useVNextMotion(vnextMotion.liftAndPress)
  const live = match.state.kind === 'live'
  const context = showCompetition
    ? (match.contextLabel ?? `${match.competition.name} · ${match.stage.label}`)
    : match.contextLabel

  return (
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
        <span className={text.srOnly}>{match.accessibleSummary}</span>

        <span className={styles.rowBody} aria-hidden="true">
          <span className={styles.scoreboard}>
            <span className={`${styles.club} ${styles.home}`} data-vnext-club="home">
              <TeamCrest team={match.home} size="sm" decorative />
              <span className={styles.clubName}>{match.home.name}</span>
            </span>

            <span className={styles.rowLead}>
              <MatchScoreMark state={match.state} kickoffLabel={match.kickoffLabel} />
            </span>

            <span className={`${styles.club} ${styles.away}`} data-vnext-club="away">
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