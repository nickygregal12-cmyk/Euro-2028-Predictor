import type { Match } from '../../models/football'
import {
  formatCountdown,
  formatKickoffLabel,
  formatOrdinal,
} from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { FormRun } from '../../components/football/FormRun'
import { LiveIndicator } from '../../components/football/LiveIndicator'
import { teamColourStyle } from '../shared/teamColour'
import styles from './arena.module.css'

export type ArenaGroundsProps = {
  matches: readonly Match[]
  now: string
}

type GroundsGroup = {
  key: string
  title: string
  matches: readonly Match[]
}

/**
 * Around the grounds.
 *
 * ROWS, NOT CARDS, AND THAT IS THE POINT. The stage above already spends a
 * whole zone on one match. If everything else were also a card the page would
 * be a grid of equal things again and the hierarchy the concept exists to test
 * would be gone. A row is dense enough that four fixtures — with form, the
 * user's call and the state of each — fit in the space one card would take.
 *
 * Grouped by what the user can still do about them: matches in play, matches
 * with a deadline ahead, matches already settled. Headings say so, so the
 * grouping is not carried by position alone.
 */
export function ArenaGrounds({ matches, now }: ArenaGroundsProps) {
  const groups: readonly GroundsGroup[] = [
    {
      key: 'live',
      title: 'Also in play',
      matches: matches.filter(
        (match) => match.status === 'live' || match.status === 'halfTime',
      ),
    },
    {
      key: 'upcoming',
      title: 'Still to kick off',
      matches: matches.filter((match) => match.status === 'upcoming'),
    },
    {
      key: 'settled',
      title: 'Already settled',
      matches: matches.filter((match) => match.status === 'fullTime'),
    },
    {
      key: 'postponed',
      title: 'Not going ahead',
      matches: matches.filter((match) => match.status === 'postponed'),
    },
  ].filter((group) => group.matches.length > 0)

  return (
    <div className={styles.groundsBody}>
      <h2 className={`${typography.label} ${styles.groundsTitle}`}>
        Around the grounds
      </h2>
      {groups.map((group) => (
        <div key={group.key} className={styles.groundsGroup}>
          <h3 className={`${typography.micro} ${styles.groundsGroupTitle}`}>
            {group.title}
          </h3>
          <ul className={styles.groundsList}>
            {group.matches.map((match) => (
              <li key={match.id}>
                <GroundRow match={match} now={now} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function GroundRow({ match, now }: { match: Match; now: string }) {
  const inPlay = match.status === 'live' || match.status === 'halfTime'
  const needsPrediction = match.prediction === null && match.status === 'upcoming'
  const countdown = match.lockAt ? formatCountdown(match.lockAt, now) : null

  return (
    <article
      className={`${styles.ground} ${needsPrediction ? styles.groundOpen : ''}`}
      style={teamColourStyle(match.home.team)}
      aria-label={`${match.home.team.name} versus ${match.away.team.name}${
        match.score ? `, ${match.score.home}–${match.score.away}` : ''
      }`}
    >
      {/* The colour spine: the home club's colour as a 4px edge. Enough
          identity to tell two rows apart at a glance, nowhere near enough to
          become a semantic colour. */}
      <span className={styles.groundSpine} aria-hidden="true" />

      <div className={styles.groundState}>
        {inPlay ? (
          <LiveIndicator status={match.status} clock={match.clock} />
        ) : (
          <span className={`${typography.label} ${styles.groundKickoff}`}>
            {match.status === 'fullTime'
              ? 'Full time'
              : match.status === 'postponed'
                ? 'Postponed'
                : formatKickoffLabel(match.kickoff, now)}
          </span>
        )}
      </div>

      <div className={styles.groundTeams}>
        {[match.home, match.away].map((side, index) => (
          <div key={side.team.id} className={styles.groundTeamRow}>
            <span className={`${typography.body} ${styles.groundTeamName} ${typography.truncate}`}>
              {side.team.shortName}
            </span>
            {side.leaguePosition === null ? null : (
              <span className={typography.micro}>
                {formatOrdinal(side.leaguePosition)}
              </span>
            )}
            <FormRun form={side.form} teamName={side.team.name} />
            <span className={`${styles.groundGoals} ${typography.numeric}`} aria-hidden="true">
              {match.score ? (index === 0 ? match.score.home : match.score.away) : '–'}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.groundCall}>
        {match.prediction ? (
          <>
            <span className={typography.label}>Your call</span>
            <span className={`${styles.groundCallScore} ${typography.numeric}`}>
              {match.prediction.score.home}–{match.prediction.score.away}
              {match.prediction.isJoker ? (
                <span className={styles.groundJoker}>
                  Joker
                  <span className={typography.srOnly}>, played on this match</span>
                </span>
              ) : null}
            </span>
            {match.prediction.points === null ? null : (
              <span className={`${typography.micro} ${styles.groundCallPoints}`}>
                {match.prediction.points} pts
                {match.prediction.pointsAreProvisional ? ' on the pitch' : ''}
              </span>
            )}
          </>
        ) : (
          <>
            <span className={typography.label}>Your call</span>
            <span className={`${styles.groundCallScore} ${styles.groundCallOpen}`}>
              Not predicted
            </span>
            {countdown ? (
              <span className={`${typography.micro} ${styles.groundCountdown}`}>
                Locks in {countdown}
              </span>
            ) : null}
          </>
        )}
      </div>

      {match.status === 'postponed' ? null : (
        <button
          type="button"
          className={styles.groundAction}
          aria-label={`${actionLabel(match)} — ${match.home.team.name} versus ${
            match.away.team.name
          }`}
        >
          {actionLabel(match)}
        </button>
      )}
    </article>
  )
}

function actionLabel(match: Match): string {
  if (match.status === 'live' || match.status === 'halfTime') return 'Follow'
  if (match.status === 'fullTime') return 'Breakdown'
  return match.prediction === null ? 'Predict' : 'Change'
}
