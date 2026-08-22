import { useId } from 'react'
import type { Match } from '../models/football'
import {
  formatCountdown,
  formatKickoffLabel,
  formatOrdinal,
} from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { FormRun } from '../components/football/FormRun'
import { LiveIndicator } from '../components/football/LiveIndicator'
import { teamColourStyle } from '../foundations/teamColour'
import styles from './home.module.css'

export type AroundTheGroundsProps = {
  matches: readonly Match[]
  now: string
  /** Heading for the zone. The competition emphasis calls it something else. */
  title?: string
  /** Row intent only. This presentation component owns no application route. */
  onActivate?: ((match: Match) => void) | undefined
}

type GroundsGroup = {
  key: string
  title: string
  matches: readonly Match[]
}

export function AroundTheGrounds({
  matches,
  now,
  title = 'Around the grounds',
  onActivate,
}: AroundTheGroundsProps) {
  const headingId = useId()
  const groups: readonly GroundsGroup[] = [
    {
      key: 'live',
      title: 'In play',
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

  if (groups.length === 0) return null

  return (
    <section className={styles.grounds} aria-labelledby={headingId}>
      <h2 id={headingId} className={`${typography.label} ${styles.zoneTitle}`}>
        {title}
      </h2>
      {groups.map((group) => (
        <div key={group.key} className={styles.groundsGroup}>
          <h3 className={`${typography.micro} ${styles.groundsGroupTitle}`}>
            {group.title}
          </h3>
          <ul className={styles.groundsList}>
            {group.matches.map((match) => (
              <li key={match.id}>
                <GroundRow match={match} now={now} onActivate={onActivate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function GroundRow({
  match,
  now,
  onActivate,
}: {
  match: Match
  now: string
  onActivate?: ((match: Match) => void) | undefined
}) {
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
            <span
              className={`${typography.body} ${styles.groundTeamName} ${typography.clamp2}`}
            >
              {side.team.shortName}
            </span>
            {side.leaguePosition === null ? null : (
              <span className={typography.micro}>
                {formatOrdinal(side.leaguePosition)}
              </span>
            )}
            <FormRun form={side.form} teamName={side.team.name} />
            <span
              className={`${styles.groundGoals} ${typography.numeric}`}
              aria-hidden="true"
            >
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
          onClick={() => onActivate?.(match)}
          data-vnext-control="home-fixture-action"
        >
          {actionLabel(match)}
        </button>
      )}
    </article>
  )
}

function actionLabel(match: Match): string {
  if (match.status === 'upcoming') {
    return match.prediction === null ? 'Predict' : 'Change'
  }
  return 'Match centre'
}
