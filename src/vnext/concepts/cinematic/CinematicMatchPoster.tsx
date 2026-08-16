import { useId } from 'react'
import { motion } from 'framer-motion'
import type { Match } from '../../models/football'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import {
  formatCountdown,
  formatKickoffLabel,
  formatShare,
} from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { LiveIndicator } from '../../components/football/LiveIndicator'
import { TeamCrest } from '../../components/football/TeamCrest'
import { fixtureColourStyle } from '../shared/teamColour'
import styles from './cinematic.module.css'

export type CinematicMatchPosterProps = {
  match: Match
  now: string
  /** `wide` gives a live match a landscape poster; the default is portrait. */
  size?: 'standard' | 'wide'
}

/**
 * A match, as a poster.
 *
 * The card is an `<article>` and the action is a real `<button>` — the same
 * decision `MatchCard` documents, for the same reason: a card carrying two club
 * names, a scoreline, a prediction and a crowd share makes a terrible button,
 * and there is nowhere to put a second action later. The poster hovers because
 * it contains something to hover towards; only the button presses.
 *
 * The colour field is the club colours at full strength with a scrim over the
 * lower half, so the type at the bottom sits on a known ground rather than on
 * whichever colour the away side happens to play in.
 */
export function CinematicMatchPoster({
  match,
  now,
  size = 'standard',
}: CinematicMatchPosterProps) {
  const headingId = useId()
  const lift = useVNextMotion(vnextMotion.liftAndPress)
  const isLive = match.status === 'live' || match.status === 'halfTime'
  const countdown = match.lockAt ? formatCountdown(match.lockAt, now) : null
  const crowd = match.consensus?.community ?? null

  return (
    <motion.article
      className={`${styles.poster} ${size === 'wide' ? styles.posterWide : ''} ${
        isLive ? styles.posterLive : ''
      }`}
      style={fixtureColourStyle(match.home.team, match.away.team)}
      aria-labelledby={headingId}
      variants={lift}
      initial="rest"
      whileHover="hover"
    >
      <span className={styles.posterField} aria-hidden="true" />

      <div className={styles.posterTop}>
        {isLive ? (
          <LiveIndicator status={match.status} clock={match.clock} />
        ) : (
          <span className={`${typography.label} ${styles.posterWhen}`}>
            {match.status === 'fullTime'
              ? 'Full time'
              : formatKickoffLabel(match.kickoff, now)}
          </span>
        )}
        <span className={styles.posterCrests} aria-hidden="true">
          <TeamCrest team={match.home.team} size="sm" decorative />
          <TeamCrest team={match.away.team} size="sm" decorative />
        </span>
      </div>

      <div className={styles.posterBody}>
        <h3 id={headingId} className={`${styles.posterTitle} ${typography.clamp2}`}>
          {match.home.team.shortName} v {match.away.team.shortName}
        </h3>

        {match.score ? (
          <p className={`${styles.posterScore} ${typography.numeric}`}>
            <span className={typography.srOnly}>Score </span>
            {match.score.home}–{match.score.away}
          </p>
        ) : countdown ? (
          <p className={`${styles.posterCountdown} ${typography.numeric}`}>
            Locks in {countdown}
          </p>
        ) : null}

        <p className={`${typography.caption} ${styles.posterCall}`}>{callLine(match)}</p>

        {crowd ? (
          <p className={`${typography.micro} ${styles.posterCrowd}`}>
            {formatShare(Math.max(crowd.homeWinShare, crowd.awayWinShare))} of{' '}
            {crowd.sampleSize} went{' '}
            {crowd.homeWinShare >= crowd.awayWinShare
              ? match.home.team.shortName
              : match.away.team.shortName}
          </p>
        ) : null}

        <motion.button
          type="button"
          className={`${styles.posterAction} ${
            match.prediction === null && match.status === 'upcoming'
              ? styles.posterActionUrgent
              : ''
          }`}
          variants={lift}
          initial="rest"
          whileTap="tap"
          aria-label={`${actionLabel(match)} — ${match.home.team.name} versus ${
            match.away.team.name
          }`}
        >
          {actionLabel(match)}
        </motion.button>
      </div>
    </motion.article>
  )
}

/** The user's position on this match, written out rather than coloured in. */
function callLine(match: Match): string {
  const prediction = match.prediction
  if (!prediction) return 'You have not called this one'
  const call = `You went ${prediction.score.home}–${prediction.score.away}`
  if (prediction.outcome === 'exact') return `${call} — exact, ${prediction.points} pts`
  if (prediction.outcome === 'result') return `${call} — right result`
  if (prediction.outcome === 'missed') return `${call} — missed`
  if (prediction.pointsAreProvisional) {
    return `${call} — ${prediction.points ?? 0} pts on the pitch, provisional`
  }
  return prediction.isJoker ? `${call} — joker played` : `${call} — in`
}

function actionLabel(match: Match): string {
  if (match.status === 'live' || match.status === 'halfTime') return 'Follow live'
  if (match.status === 'fullTime') return 'See the breakdown'
  return match.prediction === null ? 'Make the call' : 'Change the call'
}
