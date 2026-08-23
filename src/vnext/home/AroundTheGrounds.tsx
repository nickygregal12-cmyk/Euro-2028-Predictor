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
  onOpenMatch?: ((matchId: string) => void) | undefined
  onOpenPredictor?: (() => void) | undefined
}

type GroundsGroup = {
  key: string
  title: string
  matches: readonly Match[]
}

/**
 * AROUND THE GROUNDS — the rest of the football.
 *
 * ROWS, NOT CARDS, AND THAT IS THE POINT. The dominant zone above already
 * spends a whole area on one match. If everything else were also a card, the
 * page would be a grid of equal things again and the hierarchy Home exists to
 * express would be gone. A row is dense enough that four fixtures — with form,
 * the user's call and the state of each — fit in the space one card would take.
 *
 * GROUPED BY WHAT THE USER CAN STILL DO ABOUT THEM: matches in play, matches
 * with a deadline ahead, matches already settled, matches not happening. The
 * headings say so, so the grouping is never carried by position alone.
 *
 * A ROW IS SIZED AGAINST ITS OWN COLUMN. Stage 3 measured this three times and
 * got it wrong three times: a four-column row that fits at 1920 starves club
 * names to "Ca…" and "E" at 1440, because this column is ~420px there and never
 * the ~680px such a row needs. It stays stacked at every width. A list that
 * fits is worth more than a table that does not.
 */
export function AroundTheGrounds({
  matches,
  now,
  title = 'Around the grounds',
  onOpenMatch,
  onOpenPredictor,
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
                <GroundRow
                  match={match}
                  now={now}
                  onOpenMatch={onOpenMatch}
                  onOpenPredictor={onOpenPredictor}
                />
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
  onOpenMatch,
  onOpenPredictor,
}: {
  match: Match
  now: string
  onOpenMatch?: ((matchId: string) => void) | undefined
  onOpenPredictor?: (() => void) | undefined
}) {
  const inPlay = match.status === 'live' || match.status === 'halfTime'
  const needsPrediction = match.prediction === null && match.status === 'upcoming'
  const countdown = match.lockAt ? formatCountdown(match.lockAt, now) : null

  const open = () => {
    if (match.status === 'upcoming') {
      onOpenPredictor?.()
      return
    }
    onOpenMatch?.(match.id)
  }

  return (
    <article
      className={`${styles.ground} ${needsPrediction ? styles.groundOpen : ''}`}
      style={teamColourStyle(match.home.team)}
      aria-label={`${match.home.team.name} versus ${match.away.team.name}${
        match.score ? `, ${match.score.home}–${match.score.away}` : ''
      }`}
    >
      {/* The colour spine: the home club's colour as a 4px edge. Enough identity
          to tell two rows apart at a glance, nowhere near enough to be mistaken
          for a state — semantic colour never arrives as a club colour. */}
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

      {/* A postponed fixture offers nothing to do, so it gets no control. An
          empty button labelled with a verb the product cannot honour is worse
          than a row that simply says the match is off. */}
      {match.status === 'postponed' ? null : (
        <button
          type="button"
          className={styles.groundAction}
          aria-label={`${actionLabel(match)} — ${match.home.team.name} versus ${
            match.away.team.name
          }`}
          onClick={open}
          data-vnext-control="home-fixture-action"
        >
          {actionLabel(match)}
        </button>
      )}
    </article>
  )
}

/**
 * The verb on a row.
 *
 * Only two destinations exist in this product's vocabulary: the predictor and
 * Match Centre. Stage 3's rows offered "Follow" and "Breakdown", neither of
 * which names anything that has been specified — so an in-play or settled row
 * goes to Match Centre, which is a page that is actually going to be built, and
 * an open fixture goes to the prediction it is asking for.
 */
function actionLabel(match: Match): string {
  if (match.status === 'upcoming') {
    return match.prediction === null ? 'Predict' : 'Change'
  }
  return 'Match centre'
}
