import { useId } from 'react'
import { motion } from 'framer-motion'
import type { Match } from '../../models/football'
import type { HomeModel } from '../../models/home'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import {
  formatCountdown,
  formatKickoffLabel,
  formatOrdinal,
  formatShare,
} from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { FormRun } from '../../components/football/FormRun'
import { LiveIndicator } from '../../components/football/LiveIndicator'
import { fixtureColourStyle } from '../shared/teamColour'
import styles from './cinematic.module.css'

export type CinematicHeroProps = {
  match: Match
  model: HomeModel
  now: string
}

/**
 * The hero: one decision, at the size of the screen.
 *
 * THE COPY IS THE DESIGN. A cinematic surface fails the moment it is beautiful
 * and says nothing, so the hero states, in order: how long is left, which match,
 * what the crowd has done, and what happens if the user does nothing. The last
 * of those — "you have not called it" — is the tension the whole concept is
 * built around, and it is written in words rather than implied by a colour.
 *
 * THE LIVE STACK BESIDE IT is why this concept can spend a whole screen on one
 * upcoming match without hiding the football that is actually on. From the
 * `regular` composition upward the hero carries the live matches beside the
 * copy, so "what is happening now" is answered inside the first screen rather
 * than one rail below it.
 */
export function CinematicHero({ match, model, now }: CinematicHeroProps) {
  const headingId = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)
  const countdown = match.lockAt ? formatCountdown(match.lockAt, now) : null
  const crowd = match.consensus?.community ?? null
  const friends = match.consensus?.friends ?? null

  return (
    <motion.section
      className={styles.hero}
      style={fixtureColourStyle(match.home.team, match.away.team)}
      aria-labelledby={headingId}
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      <div className={styles.heroField} aria-hidden="true" />

      <div className={styles.heroInner}>
        <motion.div
          className={styles.heroCopy}
          data-vnext-zone="hero"
          variants={rise}
        >
          <p className={`${typography.label} ${styles.heroEyebrow}`}>
            {countdown ? `Locks in ${countdown}` : 'Locked'} ·{' '}
            {formatKickoffLabel(match.kickoff, now)}
          </p>

          <h2 id={headingId} className={`${styles.heroTitle} ${typography.clamp2}`}>
            {match.home.team.name}
            <span className={styles.heroVersus}> v </span>
            {match.away.team.name}
          </h2>

          <p className={`${typography.lead} ${styles.heroLine}`}>
            {heroLine(match, crowd?.awayWinShare ?? null)}
          </p>

          <div className={styles.heroFacts}>
            <span className={styles.heroFact}>
              <span className={typography.label}>Home</span>
              <span className={styles.heroFactValue}>
                {match.home.leaguePosition === null
                  ? match.home.team.shortName
                  : `${formatOrdinal(match.home.leaguePosition)} · ${match.home.team.shortName}`}
              </span>
              <FormRun form={match.home.form} teamName={match.home.team.name} />
            </span>
            <span className={styles.heroFact}>
              <span className={typography.label}>Away</span>
              <span className={styles.heroFactValue}>
                {match.away.leaguePosition === null
                  ? match.away.team.shortName
                  : `${formatOrdinal(match.away.leaguePosition)} · ${match.away.team.shortName}`}
              </span>
              <FormRun form={match.away.form} teamName={match.away.team.name} />
            </span>
            {match.venue ? (
              <span className={styles.heroFact}>
                <span className={typography.label}>Venue</span>
                <span className={styles.heroFactValue}>{match.venue.name}</span>
                <span className={typography.micro}>{match.venue.city}</span>
              </span>
            ) : null}
            {match.headToHead ? (
              <span className={styles.heroFact}>
                <span className={typography.label}>Head to head</span>
                <span className={styles.heroFactValue}>
                  {match.headToHead.homeWins}W {match.headToHead.draws}D{' '}
                  {match.headToHead.awayWins}L in {match.headToHead.played}
                </span>
                {match.headToHead.lastMeeting ? (
                  <span className={typography.micro}>
                    Last time: {match.headToHead.lastMeeting.summary.toLowerCase()}
                  </span>
                ) : null}
              </span>
            ) : null}
            {friends ? (
              <span className={styles.heroFact}>
                <span className={typography.label}>{friends.label}</span>
                <span className={styles.heroFactValue}>
                  {friends.sampleSize} have called it
                </span>
                <span className={typography.micro}>
                  {formatShare(friends.awayWinShare)} on the away side
                </span>
              </span>
            ) : null}
          </div>

          <div className={styles.heroActions}>
            <button type="button" className={styles.heroPrimary}>
              {match.prediction ? 'Change your call' : 'Make your call'}
            </button>
            <button type="button" className={styles.heroSecondary}>
              See the crowd
            </button>
          </div>

          <p className={`${typography.micro} ${styles.heroProgress}`}>
            {model.primaryAction.progress
              ? `${model.primaryAction.progress.completed} of ${model.primaryAction.progress.total} predictions in for ${model.competition.matchweekLabel}`
              : model.primaryAction.title}
          </p>
        </motion.div>

        {/* What is on RIGHT NOW, inside the first screen. */}
        <motion.aside
          className={styles.heroLive}
          aria-label="Live right now"
          data-vnext-zone="football"
          variants={rise}
        >
          <p className={`${typography.label} ${styles.heroLiveTitle}`}>Live right now</p>
          <ul className={styles.heroLiveList}>
            {model.liveMatches.map((live) => (
              <li key={live.id} className={styles.heroLiveItem}>
                <LiveIndicator status={live.status} clock={live.clock} />
                <span className={styles.heroLiveScore}>
                  <span className={`${typography.body} ${typography.truncate}`}>
                    {live.home.team.shortName}
                  </span>
                  <span className={`${styles.heroLiveGoals} ${typography.numeric}`}>
                    {live.score?.home ?? '–'}–{live.score?.away ?? '–'}
                  </span>
                  <span className={`${typography.body} ${typography.truncate}`}>
                    {live.away.team.shortName}
                  </span>
                </span>
                <span className={`${typography.micro} ${styles.heroLiveCall}`}>
                  {live.prediction
                    ? `Your ${live.prediction.score.home}–${live.prediction.score.away} · ${live.prediction.points ?? 0} pts on the pitch`
                    : 'No call on this one'}
                </span>
              </li>
            ))}
          </ul>
        </motion.aside>
      </div>
    </motion.section>
  )
}

/**
 * The line that carries the tension. It never claims a rule — it states what
 * the crowd did and what the user has not done, both of which are facts the
 * model already holds.
 */
function heroLine(match: Match, awayShare: number | null): string {
  const unanswered = match.prediction === null
  const crowd =
    awayShare === null
      ? null
      : `${formatShare(awayShare)} of everyone has backed ${match.away.team.shortName}.`
  if (unanswered) {
    return crowd
      ? `${crowd} You have not called it yet.`
      : 'You have not called this one yet.'
  }
  return crowd
    ? `${crowd} You went ${match.prediction?.score.home}–${match.prediction?.score.away}.`
    : 'Your call is in.'
}
