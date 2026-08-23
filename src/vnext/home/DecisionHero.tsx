import { useId } from 'react'
import type { HeadToHead, Match, MatchSide } from '../models/football'
import {
  formatCountdown,
  formatKickoffLabel,
  formatOrdinal,
  formatScoreline,
} from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { FormRun } from '../components/football/FormRun'
import { TeamCrest } from '../components/football/TeamCrest'
import { ConsensusBar } from '../components/social/ConsensusBar'
import { fixtureColourStyle } from '../foundations/teamColour'
import styles from './home.module.css'

export type DecisionHeroProps = {
  match: Match
  now: string
  onAction?: (() => void) | undefined
}

/**
 * YOUR NEXT DECISION, AS THE EVENT — the one place Cinematic Football is
 * allowed to win.
 *
 * WHY THIS ZONE AND NOT THE WHOLE PAGE. Concept C's argument was that a
 * prediction game's best moment is the moment before you commit, and it is
 * right about that moment and wrong about every other one: a poster treatment
 * applied to five fixtures is five posters and no hierarchy. So the cinematic
 * treatment is spent HERE, once, on the single decision the user actually has
 * to make, and the rest of Home keeps Arena's density.
 *
 * WHAT MAKES IT CINEMATIC RATHER THAN MERELY BIG. A deeper two-club colour
 * field than the live stage gets, display-scale club names, and the football
 * context a decision genuinely needs — form, league position, venue, head to
 * head, and where the crowd has gone — arranged so the eye lands on the clubs,
 * then the deadline, then the button. What it deliberately does NOT import from
 * C is the empty half-screen above the fold: every band here carries
 * information, because a hero with nothing in it is a scroll tax.
 *
 * IT IS STILL THE SAME HOME. Same tokens, same radii, same surfaces, same
 * masthead above it and same ticker under that. Only the emphasis moved.
 */
export function DecisionHero({ match, now, onAction }: DecisionHeroProps) {
// `useId` RATHER THAN THE MATCH ID, AND THE REASON IS NOT HYPOTHETICAL. An id
// built from data is unique only while the data is, and the public landing
// page's product preview mounts this surface more than once in a document.
// `duplicate-id-aria` is a CRITICAL axe rule, and the effect is real: two
// elements with one id make `aria-labelledby` point at whichever the browser
// finds first, so one of the two headings labels both regions. React's `useId`
// is unique per instance by construction, which is the property this needed all
// along.
  const headingId = useId()
  const countdown = match.lockAt ? formatCountdown(match.lockAt, now) : null
  const community = match.consensus?.community ?? null
  const prediction = match.prediction

  return (
    <article
      className={styles.decision}
      style={fixtureColourStyle(match.home.team, match.away.team)}
      aria-labelledby={headingId}
    >
      <div className={styles.decisionField} aria-hidden="true" />

      <div className={styles.decisionInner}>
        <header className={styles.decisionHead}>
          <p className={typography.label}>
            {prediction ? 'Your next match' : 'Your next decision'}
          </p>
          <p className={`${styles.decisionWhen} ${typography.numeric}`}>
            {formatKickoffLabel(match.kickoff, now)}
          </p>
        </header>

        <h2 id={headingId} className={typography.srOnly}>
          {match.home.team.name} versus {match.away.team.name},{' '}
          {formatKickoffLabel(match.kickoff, now)}
          {countdown ? `, predictions close in ${countdown}` : ''}
        </h2>

        <div className={styles.matchup}>
          <DecisionSide side={match.home} align="start" />
          <span className={`${styles.matchupVersus} ${typography.numeric}`} aria-hidden="true">
            v
          </span>
          <DecisionSide side={match.away} align="end" />
        </div>

        {/* The deadline, as the loudest single fact after the clubs. A
            countdown that has run out is a different state and the formatter
            returns null rather than "0 min", so this simply says the fixture
            is closed instead of counting backwards from nothing. */}
        <p className={styles.decisionDeadline}>
          {countdown ? (
            <>
              <span className={`${styles.decisionClock} ${typography.numeric}`}>
                {countdown}
              </span>
              <span className={typography.caption}>
                {' '}
                until predictions close
              </span>
            </>
          ) : (
            <span className={typography.caption}>Predictions are closed</span>
          )}
        </p>

        <ul className={styles.decisionContext}>
          {match.venue ? (
            <li className={typography.micro}>
              {match.venue.name}, {match.venue.city}
            </li>
          ) : null}
          {match.broadcast ? (
            <li className={typography.micro}>{match.broadcast}</li>
          ) : null}
          {match.headToHead ? (
            <li className={typography.micro}>{headToHeadLine(match)}</li>
          ) : null}
          {match.headToHead?.lastMeeting ? (
            <li className={typography.micro}>
              Last meeting: {match.headToHead.lastMeeting.summary} (
              {formatScoreline(
                match.headToHead.lastMeeting.score.home,
                match.headToHead.lastMeeting.score.away,
              )}
              )
            </li>
          ) : null}
        </ul>

        {community ? (
          <div className={styles.decisionCrowd}>
            <ConsensusBar
              group={community}
              homeName={match.home.team.shortName}
              awayName={match.away.team.shortName}
              userScore={prediction?.score ?? null}
            />
          </div>
        ) : null}

        <div className={styles.decisionActions}>
          <span className={`${typography.caption} ${styles.decisionStatus}`}>
            {prediction
              ? `Your call: ${formatScoreline(prediction.score.home, prediction.score.away)}`
              : 'You have not predicted this one'}
          </span>
          <button type="button" className={styles.decisionPrimary} onClick={onAction}>
            {prediction ? 'Change prediction' : 'Make your prediction'}
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

function DecisionSide({ side, align }: { side: MatchSide; align: 'start' | 'end' }) {
  return (
    <div className={`${styles.matchupSide} ${styles[align]}`}>
      <TeamCrest team={side.team} size="lg" decorative />
      <span className={`${styles.matchupName} ${typography.clamp2}`}>
        {side.team.name}
      </span>
      <span className={styles.matchupMeta}>
        {side.leaguePosition === null ? null : (
          <span className={typography.micro}>{formatOrdinal(side.leaguePosition)}</span>
        )}
        <FormRun form={side.form} teamName={side.team.name} />
      </span>
    </div>
  )
}

/** "Last 6 meetings: Glenmore 2, drawn 1, Strathkelvin 3". */
function headToHeadLine(match: Match): string {
  const h2h = match.headToHead as HeadToHead
  return (
    `Last ${h2h.played} meetings: ${match.home.team.shortName} ${h2h.homeWins}, ` +
    `drawn ${h2h.draws}, ${match.away.team.shortName} ${h2h.awayWins}`
  )
}
