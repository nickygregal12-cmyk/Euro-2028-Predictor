import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { ClubIdentity } from '../../design-system/ClubIdentity'
import type { FixtureListRow } from './fixtureListModel'
import {
  summariseClubForm,
  summariseHeadToHead,
  type ClubFormSummary,
  type HeadToHeadSummary,
} from './clubFormModel'
import type {
  ClubHeadToHead,
  SeasonClubForm,
} from '../../services/supabase/seasonClubFormModel'
import type { CompetitionTableRow } from '../../services/supabase/competitionTableModel'
import { presentLmsStake } from './lmsStakeModel'
import { entryStandingLine, type SeasonEntryStanding } from './seasonEntryStanding'
import type { LmsRoundPage } from './lmsRoundModel'
import {
  useSeasonMatchCentre,
  type SeasonMatchCentreCardReader,
  type SeasonMatchCentreState,
} from './useSeasonMatchCentre'
import styles from './SeasonMatchCentre.module.css'

/**
 * Alpha item 14, for one fixture: the football, the player's prediction and the
 * consequence, with provisional-versus-official truth kept intact.
 *
 * IT OPENS INSIDE THE MATCHES LIST rather than on a route of its own. A season
 * fixture has no addressable page today — nothing maps a fixture id to its
 * matchweek without the list that already carries it — and inventing a URL
 * whose read does not exist would be a route that 404s from the outside. The
 * list knows the round, so the panel is where the knowledge is.
 *
 * TWO FIELDS, TWO FIELDS. The official result and a provider's current score
 * appear in different places, worded differently, and no arithmetic crosses
 * between them. `matchCentreModel` derives points from the settled result
 * only; this file's job is not to undo that by putting a provisional score
 * where a result goes.
 *
 * IT ASKS FOR NOTHING IT DOES NOT SHOW. One card read, for one matchweek, when
 * a fixture is opened.
 *
 * THE FOOTBALL CONTEXT IS OPTIONAL AND SEPARATE FROM THE PLAYER'S SIDE.
 * Contract 141's club form and season head-to-head are the same for everybody
 * and cost no provider request; the matchweek card is the caller's own entry.
 * They arrive independently and fail independently, so a form read that is
 * absent or slow never delays or breaks the prediction and points this panel
 * exists for.
 *
 * THE FORM READ IS JOINED TO THE FIXTURE BY CLUB NAME, because contract 139's
 * fixture read carries no team id and contract 141's form read does. Both names
 * come from `public.teams.name` — the same column of the same rows — so it is
 * an equality on one source of truth rather than a fuzzy match, and the team
 * ids it yields are what make the head-to-head callable at all.
 *
 * IT NOW LINKS TO THE MATCHWEEK IT BELONGS TO. This file used to record that it
 * could not: the Match Predictor route carried no matchweek and always opened
 * at the current one, so a link from a September fixture would land the player
 * somewhere else, which is worse than no link. `?matchweek=` closes that, and
 * the link is the thing a player was missing — seeing a match and having no way
 * to reach the card that predicts it is where the journey used to stop.
 */

/**
 * Contract 141's two reads, supplied by the route. Both optional: this panel is
 * complete without either.
 */
export type SeasonFootballContext = {
  /**
   * The club's form, already fetched for the whole season. ABSENT means the
   * form read has not answered — which is not the same as a club with no
   * settled matches, and the panel must not render the form block at all
   * rather than show two clubs as having played nothing.
   */
  formFor?: ((clubName: string) => SeasonClubForm | null) | undefined
  /** This season's meetings between two clubs, fetched when a fixture opens. */
  headToHead?: (teamId: string, opponentId: string) => Promise<ClubHeadToHead>
  /**
   * The caller's CURRENT Last Man Standing round, if they are in one.
   * `get_season_lms_round` takes no round argument, so this can only speak
   * about fixtures in the round that is open now — see `lmsStakeModel`.
   */
  lmsRound?: LmsRoundPage | null
  /**
   * Whether this competition runs a Match Predictor and whether the caller is
   * in it. The card read cannot say — it returns an empty card for a
   * non-entrant rather than refusing — so without this the panel showed "Your
   * prediction: None" to somebody who had never joined.
   */
  entryStanding?: SeasonEntryStanding
  /**
   * Contract 160's table row for a club, by name. Supplied by the route, which
   * reads the table once for the whole season.
   *
   * ABSENT UNTIL THE TABLE HAS ANSWERED, and absent for ever where the
   * competition has none — `get_competition_table` refuses anything that is not
   * a league season. Both cases render no table block rather than two clubs
   * shown as having no position, which is a claim about the football.
   */
  tableFor?: ((clubName: string) => CompetitionTableRow | null) | undefined
}

/**
 * One club's league position and record.
 *
 * ORDINAL AND RECORD IN ONE LINE, because a position without a record is a
 * rank against nothing — "3rd" says less than "3rd · 24 pts from 12". Every
 * figure is the server's, applied under the competition's stored rules; there
 * is no arithmetic in this component.
 */
function TableRow({ name, row }: { name: string; row: CompetitionTableRow }) {
  const difference = row.goalDifference > 0 ? `+${row.goalDifference}` : `${row.goalDifference}`
  return (
    <div className={styles.formRow}>
      <span className={styles.formClub}>{name}</span>
      <span className={styles.formRecord}>
        {ordinalPosition(row.position)} · {row.points} pts from {row.played} · {difference} GD
      </span>
    </div>
  )
}

/**
 * A position as an ordinal.
 *
 * Local and deliberately tiny: the league ordinal helper lives under the
 * tournament's `features/league/`, and a season surface importing from there
 * would cross a boundary for four lines of string handling.
 */
function ordinalPosition(position: number): string {
  const tens = position % 100
  if (tens >= 11 && tens <= 13) return `${position}th`
  const suffix = ['th', 'st', 'nd', 'rd'][position % 10] ?? 'th'
  return `${position}${suffix}`
}

export type SeasonMatchCentreProps = {
  fixture: FixtureListRow
  read: SeasonMatchCentreCardReader
  football?: SeasonFootballContext | undefined
  /**
   * Where this fixture's matchweek is predicted. Supplied by the route, which
   * owns the slugs; absent where the Match Predictor is not reachable.
   */
  predictHref?: ((matchweek: number) => string) | undefined
}

function FormRow({ name, summary }: { name: string; summary: ClubFormSummary }) {
  return (
    <div className={styles.formRow}>
      <span className={styles.formClub}>{name}</span>
      {summary.record === null ? (
        // Not "0 form" and not an empty row of pills: a club that has not
        // played yet reads as a bad run, and at Matchweek 1 that is everybody.
        <span className={styles.formNone}>No settled matches yet</span>
      ) : (
        <>
          <span className={styles.formLetters} aria-hidden="true">
            {summary.letters.map((letter, index) => (
              <span key={index} className={styles.formLetter} data-outcome={letter}>
                {letter}
              </span>
            ))}
          </span>
          {/* The spoken version is the sentence, not the letters: "W W D L"
              read aloud one character at a time is noise. */}
          <span className={styles.formRecord}>
            {summary.record}
            {summary.goalDifference ? ` · ${summary.goalDifference} goals` : ''}
          </span>
        </>
      )}
    </div>
  )
}

function useHeadToHead(
  football: SeasonFootballContext | undefined,
  homeName: string,
  awayName: string,
): HeadToHeadSummary | null {
  const [summary, setSummary] = useState<HeadToHeadSummary | null>(null)
  const home = football?.formFor?.(homeName)?.teamId ?? null
  const away = football?.formFor?.(awayName)?.teamId ?? null
  const load = football?.headToHead

  useEffect(() => {
    if (!load || !home || !away) {
      setSummary(null)
      return
    }
    let active = true
    setSummary(null)
    load(home, away)
      .then((head) => {
        if (active) setSummary(summariseHeadToHead(head))
      })
      // Silent, and the panel simply has no meetings section. This is context
      // beside the answer, never the answer.
      .catch(() => {
        if (active) setSummary(null)
      })
    return () => {
      active = false
    }
  }, [load, home, away])

  return summary
}

export function SeasonMatchCentre({
  fixture,
  read,
  football,
  predictHref,
}: SeasonMatchCentreProps) {
  const state = useSeasonMatchCentre(read, fixture)
  return (
    <SeasonMatchCentreView
      fixture={fixture}
      state={state}
      football={football}
      predictHref={predictHref}
    />
  )
}

/**
 * The same panel, rendered from a state the caller already holds.
 *
 * WHY IT IS SEPARATE. The Match Centre PAGE needs the card for more than this
 * panel — the `INNOV-001` projection and the `INNOV-011` divergence line both
 * compare the player's own prediction with something else on the page — so the
 * page reads it once and renders this. The fixture LIST still uses the loading
 * component above, because there the card is genuinely per-opened-fixture.
 *
 * One panel, two ways in, and no second read.
 */
export type SeasonMatchCentreViewProps = Omit<SeasonMatchCentreProps, 'read'> & {
  state: SeasonMatchCentreState & { reload: () => void }
}

export function SeasonMatchCentreView({
  fixture,
  state,
  football,
  predictHref,
}: SeasonMatchCentreViewProps) {
  const homeForm = summariseClubForm(football?.formFor?.(fixture.home.name) ?? null)
  const awayForm = summariseClubForm(football?.formFor?.(fixture.away.name) ?? null)
  const headToHead = useHeadToHead(football, fixture.home.name, fixture.away.name)
  /**
   * Both clubs' table rows, or nothing.
   *
   * BOTH OR NEITHER, deliberately. Showing one club's position beside a blank
   * for the other invites the reading that the second is unranked, when in fact
   * the table simply does not contain a name this fixture used — which is a
   * defect worth seeing as an absence rather than as a half-drawn comparison.
   */
  const homeRow = football?.tableFor?.(fixture.home.name) ?? null
  const awayRow = football?.tableFor?.(fixture.away.name) ?? null
  const tableRows = homeRow && awayRow ? { home: homeRow, away: awayRow } : null
  const lmsStake = presentLmsStake(fixture, football?.lmsRound ?? null)
  // Preferred over anything the card says about a prediction: an empty card and
  // no entry look identical in the payload and mean completely different things
  // to the person reading them.
  const noEntry = entryStandingLine(football?.entryStanding ?? 'unknown')

  return (
    <div className={styles.panel}>
      <div className={styles.fixture}>
        <span className={styles.club}>
          <ClubIdentity name={fixture.home.name} tokens={fixture.home.tokens} size="card" />
          <span className={styles.clubName}>{fixture.home.name}</span>
        </span>
        <span className={styles.versus} aria-hidden="true">
          v
        </span>
        <span className={styles.club}>
          <ClubIdentity name={fixture.away.name} tokens={fixture.away.tokens} size="card" />
          <span className={styles.clubName}>{fixture.away.name}</span>
        </span>
      </div>
      {/* CONTRACT 207. The matchweek, then the kick-off if there is still a
          valid one, then the reason there is not. `fixture.kickoff` is already
          null for a postponement with no replacement date — the presenter
          refuses to format an instant that is only a memory — so this line
          would otherwise say "Matchweek 5" and leave the page looking like an
          ordinary fixture that simply has no time yet. */}
      <p className={styles.round}>
        {fixture.round.name}
        {fixture.kickoff ? ` · ${fixture.kickoff}` : ''}
        {fixture.abnormal ? (
          <span className={styles.abnormal}>
            {fixture.abnormal}
            {fixture.scheduleNote ? ` · ${fixture.scheduleNote}` : ''}
          </span>
        ) : fixture.scheduleNote ? (
          <span className={styles.abnormal}>{fixture.scheduleNote}</span>
        ) : null}
      </p>

      {state.status === 'loading' ? (
        <div aria-busy="true">
          <Skeleton lines={3} />
        </div>
      ) : state.status === 'not_playing' ? (
        // Not an error, and not an empty prediction either. Saying "no
        // prediction" to somebody who never joined the game would read as
        // though they had missed a deadline.
        <p className={styles.note}>
          You are not playing the Match Predictor in this competition, so this fixture
          has no entry of yours behind it. The fixture and its result are the same for
          everyone following the season.
        </p>
      ) : noEntry ? (
        // Not an error, and not an empty prediction either. Saying "None" to
        // somebody who never joined reads as though they had missed a deadline.
        //
        // AHEAD OF THE FAILURE BRANCH ON PURPOSE, which a browser had to teach
        // twice. The card read emits `'joker', null` for a caller with no
        // entry, and the gateway's `requireShape` rejects a payload whose
        // `joker.matchweek_count` is not a number — so for a non-entrant the
        // read THROWS, and checking `failed` first showed "Your entry could not
        // be read" over a competition that simply does not run the game. A fact
        // that explains the failure outranks a generic report of it.
        <p className={styles.note}>{noEntry}</p>
      ) : state.status === 'failed' ? (
        <Alert variant="warning" title="Your entry could not be read">
          {state.error}
          <div className={styles.retry}>
            <Button variant="secondary" onClick={state.reload}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : (
        <>
          <dl className={styles.grid}>
            <div className={styles.cell}>
              <dt className={styles.label}>Your prediction</dt>
              <dd className={styles.value}>{state.view.prediction ?? 'None'}</dd>
            </div>
            <div className={styles.cell}>
              <dt className={styles.label}>Result</dt>
              {/* "Not confirmed" rather than a dash: the absence is a
                  statement about the confirmation gate, not missing data. */}
              <dd className={styles.value}>{state.view.result ?? 'Not confirmed'}</dd>
            </div>
            {state.view.outcome.kind === 'scored' ? (
              <div className={styles.cell}>
                <dt className={styles.label}>This fixture</dt>
                <dd className={styles.value}>{state.view.outcome.points} pts</dd>
              </div>
            ) : null}
            {state.view.matchweekPoints !== null ? (
              <div className={styles.cell}>
                <dt className={styles.label}>Matchweek total</dt>
                <dd className={styles.value}>{state.view.matchweekPoints} pts</dd>
              </div>
            ) : null}
          </dl>

          {state.view.provisional ? (
            // Below the official row, labelled, and never in it. A provisional
            // score sitting in the Result cell is the one mistake this whole
            // surface exists to avoid.
            <p className={styles.provisional}>
              <span className={styles.provisionalTag}>Provisional</span>
              {state.view.provisional.score}
              {state.view.provisional.at ? ` · reported ${state.view.provisional.at}` : ''}
            </p>
          ) : null}

          <p className={styles.note}>{state.view.explanation}</p>
          {state.view.jokerNote ? <p className={styles.note}>{state.view.jokerNote}</p> : null}

          {/* The way out, which is the whole point of opening a fixture and
              was missing: seeing a match and being unable to reach the card
              that predicts it is where the journey stopped. It is a real link
              rather than a button because it goes somewhere. */}
          {predictHref ? (
            <Link className={styles.predict} to={predictHref(fixture.round.ordinal)}>
              Open {fixture.round.name}
            </Link>
          ) : null}
        </>
      )}

      {/* The football, below the player's own side of it and outside the
          card's loading and failure branches: it is the same for everybody and
          is unaffected by whether an entry could be read. */}
      {lmsStake ? (
        // Above the form, because it is the strongest thing this panel can say
        // about the fixture: form is context, and a survival stake is a reason
        // to care. Marked rather than merely coloured (§11.8).
        <p
          className={
            lmsStake.stake.kind === 'my_pick' ? styles.stakeRiding : styles.stake
          }
        >
          <span className={styles.stakeTag}>Last Man Standing</span>
          {lmsStake.line}
        </p>
      ) : null}

      {football?.formFor ? (
        <div className={styles.football}>
          <h4 className={styles.footballHeading}>Recent form</h4>
          <FormRow name={fixture.home.name} summary={homeForm} />
          <FormRow name={fixture.away.name} summary={awayForm} />

          {/* Third in the hierarchy, after form and before the meetings: where
              each club actually sits. Form is a run and can flatter; the table
              is the season. Both numbers are contract 160's, applied under the
              competition's own rules server-side — nothing here re-ranks. */}
          {tableRows ? (
            <>
              <h4 className={styles.footballHeading}>In the table</h4>
              <TableRow name={fixture.home.name} row={tableRows.home} />
              <TableRow name={fixture.away.name} row={tableRows.away} />
            </>
          ) : null}

          {headToHead ? (
            <>
              <p className={styles.note}>{headToHead.headline}</p>
              {headToHead.meetings.length > 0 ? (
                <ul className={styles.meetings}>
                  {headToHead.meetings.map((meeting, index) => (
                    <li key={index} className={styles.meeting} data-outcome={meeting.outcome}>
                      {/* Whole, from the model. The club whose result this is
                          comes from the head-to-head read rather than from the
                          fixture row, so one name describes one result. */}
                      {meeting.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
