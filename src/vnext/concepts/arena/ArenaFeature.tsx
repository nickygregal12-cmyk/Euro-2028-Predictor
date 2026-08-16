import type { Match, MatchSide } from '../../models/football'
import {
  formatCountdown,
  formatKickoffLabel,
  formatOrdinal,
  formatShare,
} from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { FormRun } from '../../components/football/FormRun'
import { LiveIndicator } from '../../components/football/LiveIndicator'
import { TeamCrest } from '../../components/football/TeamCrest'
import { fixtureColourStyle } from '../shared/teamColour'
import styles from './arena.module.css'

export type ArenaFeatureProps = {
  match: Match
  now: string
}

/**
 * The stage: one match, given a whole zone.
 *
 * This is not "the MatchCard, bigger". A card lists a fixture; this composes a
 * broadcast graphic — the field painted in both clubs' colours, the scoreline
 * at display size with the minute beside it, and the user's own prediction
 * folded INTO the football rather than parked beneath it as a separate chip.
 * That last decision is the concept's whole argument: on a matchday, "you are
 * currently exactly right" is a fact about the match, not a fact about your
 * account.
 *
 * The colour field carries a scrim above it, so the text contrast is decided
 * by the scrim rather than by whichever two clubs happen to be playing.
 */
export function ArenaFeature({ match, now }: ArenaFeatureProps) {
  const isLive = match.status === 'live' || match.status === 'halfTime'
  const countdown = match.lockAt ? formatCountdown(match.lockAt, now) : null
  const prediction = match.prediction
  const community = match.consensus?.community ?? null
  const friends = match.consensus?.friends ?? null

  return (
    <article
      className={styles.feature}
      style={fixtureColourStyle(match.home.team, match.away.team)}
      aria-labelledby={`${match.id}-arena-heading`}
    >
      <div className={styles.featureField} aria-hidden="true" />

      <div className={styles.featureInner}>
        <header className={styles.featureHead}>
          {isLive ? (
            <LiveIndicator status={match.status} clock={match.clock} />
          ) : (
            <span className={`${typography.label} ${styles.featureKickoff}`}>
              {match.status === 'fullTime'
                ? 'Full time'
                : formatKickoffLabel(match.kickoff, now)}
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

        {/* The scoreline below is `aria-hidden` — "2 – 1" read out of a grid is
            not a sentence — so the accessible name of the whole stage is
            written here instead. */}
        <h2 id={`${match.id}-arena-heading`} className={typography.srOnly}>
          {match.score
            ? `${match.home.team.name} ${match.score.home}–${match.score.away} ${match.away.team.name}`
            : `${match.home.team.name} versus ${match.away.team.name}`}
        </h2>

        <div className={styles.scoreboard}>
          <FeatureSide side={match.home} align="start" />
          <p className={`${styles.featureScore} ${typography.numeric}`} aria-hidden="true">
            {match.score ? (
              <>
                <span>{match.score.home}</span>
                <span className={styles.featureScoreDash}>–</span>
                <span>{match.score.away}</span>
              </>
            ) : (
              <span className={styles.featureKickoffBig}>
                {formatKickoffLabel(match.kickoff, now).replace('Today ', '')}
              </span>
            )}
          </p>
          <FeatureSide side={match.away} align="end" />
        </div>

        {/* The prediction, inside the football. */}
        {prediction ? (
          <div className={styles.featureCall}>
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
              Not predicted{countdown ? ` — locks in ${countdown}` : ''}
            </span>
          </div>
        )}

        {community ? (
          <div className={styles.featureCrowd}>
            <span className={typography.label}>The crowd</span>
            <p className={`${typography.caption} ${styles.featureCrowdLine}`}>
              {crowdLine(match, community.homeWinShare, community.awayWinShare)}
              {friends
                ? ` · ${friends.label}: ${formatShare(friends.awayWinShare)} away`
                : ''}
            </p>
          </div>
        ) : null}

        <div className={styles.featureActions}>
          <button type="button" className={styles.featurePrimary}>
            {isLive ? 'Follow live' : match.prediction ? 'Change prediction' : 'Predict'}
          </button>
          <button type="button" className={styles.featureSecondary}>
            Match centre
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

/**
 * The one sentence that says what the scoreline means for the user. It is
 * written rather than coloured, so it survives greyscale — and it never claims
 * points have been awarded while a match is still being played.
 */
function describeCall(match: Match): string {
  const prediction = match.prediction
  if (!prediction || !match.score) return 'Submitted'
  const exact =
    prediction.score.home === match.score.home &&
    prediction.score.away === match.score.away
  if (exact) {
    return prediction.pointsAreProvisional
      ? 'Exact right now — provisional'
      : 'Exact score'
  }
  const resultOf = (home: number, away: number) =>
    home === away ? 'draw' : home > away ? 'home' : 'away'
  const sameResult =
    resultOf(prediction.score.home, prediction.score.away) ===
    resultOf(match.score.home, match.score.away)
  if (sameResult) {
    return prediction.pointsAreProvisional
      ? 'Right result as it stands — provisional'
      : 'Right result'
  }
  return prediction.pointsAreProvisional ? 'Off the pace as it stands' : 'Missed'
}

function crowdLine(match: Match, homeShare: number, awayShare: number): string {
  const homeLeads = homeShare >= awayShare
  const share = homeLeads ? homeShare : awayShare
  const team = homeLeads ? match.home.team.shortName : match.away.team.shortName
  return `${formatShare(share)} backed ${team}`
}
