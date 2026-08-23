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
  onOpenMatch?: ((matchId: string) => void) | undefined
}

/**
 * THE STAGE — one live match, given a whole zone.
 *
 * This is Matchday Arena's strongest piece and it is kept almost intact,
 * because it was already right: a card LISTS a fixture, this composes a
 * broadcast graphic. The field is painted in both clubs' colours, the scoreline
 * is at display size with the minute beside it, and the user's prediction is
 * folded INTO the football rather than parked below it — on a matchday "you are
 * currently exactly right" is a fact about the match, not a fact about your
 * account.
 *
 * THE ONE THING THAT CHANGED IS THE ACTION, and it is a product decision rather
 * than a visual one. Stage 3 made "Follow live" the loud primary and "Match
 * centre" the quiet secondary. There is no follow, subscribe or notify concept
 * anywhere in the model, in the product, or in anything that has been
 * specified — so the loudest control on the most important card on Home was a
 * promise of functionality that does not exist. It is gone, and Match Centre —
 * a surface the product is actually going to build — is the single primary
 * destination. One real action beats two, one of which is imaginary.
 *
 * The colour field carries a scrim, so text contrast is decided by the scrim
 * rather than by whichever two clubs happen to be playing.
 */
export function FeaturedMatch({ match, onOpenMatch }: FeaturedMatchProps) {
// `useId` RATHER THAN THE MATCH ID, AND THE REASON IS NOT HYPOTHETICAL. An id
// built from data is unique only while the data is, and the public landing
// page's product preview mounts this surface more than once in a document.
// `duplicate-id-aria` is a CRITICAL axe rule, and the effect is real: two
// elements with one id make `aria-labelledby` point at whichever the browser
// finds first, so one of the two headings labels both regions. React's `useId`
// is unique per instance by construction, which is the property this needed all
// along.
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

        {/* The scoreline below is `aria-hidden` — "2 – 1" read out of a grid is
            not a sentence — so the accessible name of the whole stage is
            written here instead. */}
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

        {/* ONE destination, and it is a real one. See the note above. */}
        <div className={styles.featureActions}>
          <button
            type="button"
            className={styles.featurePrimary}
            onClick={() => onOpenMatch?.(match.id)}
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

/**
 * The one sentence that says what the scoreline means for the user.
 *
 * WRITTEN, NOT COLOURED, so it survives greyscale — and it never claims points
 * have been awarded while a match is still being played. "Provisional" is not
 * decoration here: the backend awards points, and a presentation layer that
 * drops the qualifier has quietly told the user they have six points they may
 * not end up with.
 */
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

/** Which of the two prediction surfaces the call sits on. Never the only signal. */
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
