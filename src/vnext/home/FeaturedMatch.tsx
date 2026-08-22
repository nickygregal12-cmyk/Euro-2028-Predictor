import { useId } from 'react'
import type { Match, MatchSide } from '../models/football'
import { formatOrdinal, formatShare } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { FormRun } from '../components/football/FormRun'
import { LiveIndicator } from '../components/football/LiveIndicator'
import { TeamCrest } from '../components/football/TeamCrest'
import { fixtureColourStyle } from '../foundations/teamColour'
import styles from './home.module.css'

export type FeaturedMatchProps = {
  match: Match
  onActivate?: (() => void) | undefined
}

/**
 * THE STAGE — one live match, given a whole zone.
 *
 * The primary control emits intent through Home rather than knowing a route.
 * The connected screen decides what the real application can open.
 */
export function FeaturedMatch({ match, onActivate }: FeaturedMatchProps) {
  const headingId = useId()
  const isLive = match.status === 'live' || match.status === 'halfTime'
  const prediction = match.prediction
  const community = match.consensus?.community ?? null
  const friends = match.consensus?.friends ?? null

  return (
    <article
      className={styles.feature}
      style={fixtureColourStyle(match.home.team, match.away.team)}
      aria-labelledby={headingId}
    >
      <div className={styles.featureField} aria-hidden="true" />

      <div className={styles.featureInner}>
        <header className={styles.featureHead}>
          {isLive ? (
            <LiveIndicator status={match.status} clock={match.clock} />
          ) : (
            <span className={`${typography.label} ${styles.featureState}`}>
              {match.status === 'fullTime' ? 'Full time' : 'Next up'}
            </span>
          )}
          <span className={styles.featureMeta}>
            {match.broadcast ? (
              <span className={typography.micro}>{match.broadcast}</span>
            ) : null}
            {match.venue ? (
              <span className={typography.micro}>
                {match.venue.name}, {match.venue.city}
              </span>
            ) : null}
          </span>
        </header>

        <h2 id={headingId} className={typography.srOnly}>
          {match.score
            ? `${match.home.team.name} ${match.score.home}–${match.score.away} ${match.away.team.name}`
            : `${match.home.team.name} versus ${match.away.team.name}`}
        </h2>

        <div className={styles.scoreboard}>
          <FeatureSide side={match.home} align="start" />
          <p className={`${styles.featureScore} ${typography.numeric}`} aria-hidden="true">
            <span>{match.score ? match.score.home : '–'}</span>
            <span className={styles.featureScoreDash}>–</span>
            <span>{match.score ? match.score.away : '–'}</span>
          </p>
          <FeatureSide side={match.away} align="end" />
        </div>

        {prediction ? (
          <div
            className={`${styles.featureCall} ${
              callTone(match) === 'hit' ? styles.featureCallHit : styles.featureCallCold
            }`}
          >
            <span className={typography.label}>Your call</span>
            <span className={`${styles.featureCallScore} ${typography.numeric}`}>
              {prediction.score.home}–{prediction.score.away}
            </span>
            <span className={`${typography.caption} ${styles.featureCallLine}`}>
              {describeCall(match)}
            </span>
            {prediction.points === null ? null : (
              <span className={`${styles.featureCallPoints} ${typography.numeric}`}>
                {prediction.points} pts
                <span className={styles.featureCallQualifier}>
                  {prediction.pointsAreProvisional ? ' on the pitch' : ' banked'}
                </span>
              </span>
            )}
          </div>
        ) : (
          <div className={`${styles.featureCall} ${styles.featureCallOpen}`}>
            <span className={typography.label}>Your call</span>
            <span className={`${typography.body} ${styles.featureCallLine}`}>
              Not predicted
            </span>
          </div>
        )}

        {community ? (
          <p className={`${typography.caption} ${styles.featureCrowd}`}>
            <span className={typography.label}>The crowd</span>{' '}
            {crowdLine(match, community.homeWinShare, community.awayWinShare)}
            {friends
              ? ` · ${friends.label}: ${formatShare(friends.awayWinShare)} on ${match.away.team.shortName}`
              : ''}
          </p>
        ) : null}

        <div className={styles.featureActions}>
          <button
            type="button"
            className={styles.featurePrimary}
            onClick={onActivate}
            data-vnext-control="home-featured-match"
          >
            Match centre
            <span className={typography.srOnly}>
              {' '}
              for {match.home.team.name} versus {match.away.team.name}
            </span>
          </button>
        </div>
      </div>
    </article>
  )
}

function FeatureSide({ side, align }: { side: MatchSide; align: 'start' | 'end' }) {
  return (
    <div className={`${styles.featureSide} ${styles[align]}`}>
      <TeamCrest team={side.team} size="lg" decorative />
      <span className={`${styles.featureTeamName} ${typography.clamp2}`}>
        {side.team.name}
      </span>
      <span className={styles.featureSideMeta}>
        {side.leaguePosition === null ? null : (
          <span className={typography.micro}>{formatOrdinal(side.leaguePosition)}</span>
        )}
        <FormRun form={side.form} teamName={side.team.name} />
      </span>
    </div>
  )
}

function describeCall(match: Match): string {
  const prediction = match.prediction
  if (!prediction || !match.score) return 'Submitted'
  if (isExact(match)) {
    return prediction.pointsAreProvisional
      ? 'Exact right now — provisional'
      : 'Exact score'
  }
  if (isSameResult(match)) {
    return prediction.pointsAreProvisional
      ? 'Right result as it stands — provisional'
      : 'Right result'
  }
  return prediction.pointsAreProvisional ? 'Off the pace as it stands' : 'Missed'
}

function callTone(match: Match): 'hit' | 'cold' {
  return isExact(match) || isSameResult(match) ? 'hit' : 'cold'
}

function isExact(match: Match): boolean {
  const prediction = match.prediction
  if (!prediction || !match.score) return false
  return (
    prediction.score.home === match.score.home &&
    prediction.score.away === match.score.away
  )
}

function isSameResult(match: Match): boolean {
  const prediction = match.prediction
  if (!prediction || !match.score) return false
  const outcome = (home: number, away: number) =>
    home === away ? 'draw' : home > away ? 'home' : 'away'
  return (
    outcome(prediction.score.home, prediction.score.away) ===
    outcome(match.score.home, match.score.away)
  )
}

function crowdLine(match: Match, homeShare: number, awayShare: number): string {
  const homeLeads = homeShare >= awayShare
  const share = homeLeads ? homeShare : awayShare
  const team = homeLeads ? match.home.team.shortName : match.away.team.shortName
  return `${formatShare(share)} backed ${team}`
}
