import { useId } from 'react'
import { motion } from 'framer-motion'
import type { Match, MatchSide } from '../../models/football'
import {
  formatCountdown,
  formatKickoffLabel,
  formatOrdinal,
  formatScoreline,
} from '../../foundations/format'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import surfaces from '../../foundations/surfaces.module.css'
import typography from '../../foundations/typography.module.css'
import { PredictionChip } from '../game/PredictionChip'
import { ConsensusBar } from '../social/ConsensusBar'
import { FormRun } from './FormRun'
import { LiveIndicator } from './LiveIndicator'
import { TeamCrest } from './TeamCrest'
import styles from './MatchCard.module.css'

export type MatchCardVariant = 'standard' | 'feature'

export type MatchCardProps = {
  match: Match
  /** The instant to measure deadlines against. Never read from the clock. */
  now: string
  variant?: MatchCardVariant
  /** Head-to-head, venue and consensus. Off by default in dense rails. */
  showContext?: boolean
  /** Optional single action. The card itself is never a giant button. */
  onAction?: (match: Match) => void
}

/**
 * The fixture card, in every state one match can be in.
 *
 * WHY THE CARD IS NOT ITSELF CLICKABLE. A card carrying a heading, two club
 * names, a form run, a prediction and a consensus bar makes a terrible button:
 * a screen reader would read the whole thing as one label, and there is nowhere
 * to put a second action later. So the card is an `<article>` and the action is
 * one real `<button>` with a name that says which match it acts on.
 *
 * WHAT DECIDES THE EMPHASIS. Live state and an unmet deadline are the two
 * things allowed to make a card louder than its neighbours — both are states
 * the user can still do something about. Nothing is emphasised for being
 * interesting.
 *
 * The scoreline is `aria-hidden` and restated in the heading, because "2 – 1"
 * read out of a grid is not a sentence.
 */
export function MatchCard({
  match,
  now,
  variant = 'standard',
  showContext = false,
  onAction,
}: MatchCardProps) {
  const headingId = useId()
  const lift = useVNextMotion(vnextMotion.liftAndPress)

  const isLive = match.status === 'live' || match.status === 'halfTime'
  const isFinished = match.status === 'fullTime'
  const countdown = match.lockAt ? formatCountdown(match.lockAt, now) : null
  const needsPrediction = match.prediction === null && match.status === 'upcoming'

  const heading = match.score
    ? `${match.home.team.name} ${formatScoreline(
        match.score.home,
        match.score.away,
      )} ${match.away.team.name}`
    : `${match.home.team.name} versus ${match.away.team.name}`

  return (
    <motion.article
      className={[
        surfaces.interactive,
        styles.card,
        variant === 'feature' ? styles.feature : '',
        isLive ? surfaces.live : '',
        needsPrediction ? styles.needsAction : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={headingId}
      variants={lift}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
    >
      <h3 id={headingId} className={typography.srOnly}>
        {heading}
      </h3>

      <header className={styles.header}>
        {isLive ? (
          <LiveIndicator status={match.status} clock={match.clock} />
        ) : (
          <span className={`${typography.label} ${styles.kickoff}`}>
            {isFinished ? 'Full time' : formatKickoffLabel(match.kickoff, now)}
          </span>
        )}
        {match.broadcast ? (
          <span className={typography.micro}>{match.broadcast}</span>
        ) : null}
      </header>

      <div className={styles.teams}>
        <TeamRow side={match.home} goals={match.score?.home ?? null} />
        <TeamRow side={match.away} goals={match.score?.away ?? null} />
      </div>

      {showContext ? (
        <dl className={styles.context}>
          {match.venue ? (
            <div className={styles.contextRow}>
              <dt className={typography.micro}>Venue</dt>
              <dd className={`${typography.caption} ${styles.contextValue}`}>
                {match.venue.name}, {match.venue.city}
              </dd>
            </div>
          ) : null}
          {match.headToHead ? (
            <div className={styles.contextRow}>
              <dt className={typography.micro}>Head to head</dt>
              <dd className={`${typography.caption} ${styles.contextValue}`}>
                {match.headToHead.homeWins}W {match.headToHead.draws}D{' '}
                {match.headToHead.awayWins}L in {match.headToHead.played}
                {match.headToHead.lastMeeting
                  ? ` · last time ${match.headToHead.lastMeeting.summary.toLowerCase()}`
                  : ''}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className={styles.predictionRow}>
        <PredictionChip prediction={match.prediction} />
        {countdown && needsPrediction ? (
          <span className={`${styles.countdown} ${typography.numeric}`}>
            Locks in {countdown}
          </span>
        ) : null}
      </div>

      {showContext && match.consensus ? (
        <ConsensusBar
          group={match.consensus.community}
          homeName={match.home.team.shortName}
          awayName={match.away.team.shortName}
          userScore={match.prediction?.score ?? null}
        />
      ) : null}

      {onAction ? (
        <button
          type="button"
          className={`${styles.action} ${needsPrediction ? styles.actionUrgent : ''}`}
          onClick={() => onAction(match)}
          // "Predict" is a useless name in a rail of five cards, so the name
          // says which match it acts on. It is an aria-label rather than a
          // visually hidden span because name computation drops the whitespace
          // between the visible text and the span and produces "Predict—
          // Inverness…". The visible text is contained in the name, which is
          // what WCAG 2.5.3 asks for.
          aria-label={`${actionLabel(match)} — ${match.home.team.name} versus ${
            match.away.team.name
          }`}
        >
          {actionLabel(match)}
        </button>
      ) : null}
    </motion.article>
  )
}

function TeamRow({ side, goals }: { side: MatchSide; goals: number | null }) {
  return (
    <div className={styles.teamRow}>
      <TeamCrest team={side.team} size="md" decorative />
      <div className={styles.teamNames}>
        <span className={`${typography.body} ${typography.clamp2} ${styles.teamName}`}>
          {side.team.name}
        </span>
        <span className={styles.teamMeta}>
          {side.leaguePosition === null ? null : (
            <span className={typography.micro}>
              {formatOrdinal(side.leaguePosition)}
            </span>
          )}
          <FormRun form={side.form} teamName={side.team.name} />
        </span>
      </div>
      <span
        className={`${styles.goals} ${typography.numeric}`}
        aria-hidden="true"
      >
        {goals ?? '–'}
      </span>
    </div>
  )
}

function actionLabel(match: Match): string {
  if (match.status === 'live' || match.status === 'halfTime') return 'Follow live'
  if (match.status === 'fullTime') return 'See how everyone did'
  return match.prediction === null ? 'Predict' : 'Change prediction'
}
