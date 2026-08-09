import { useEffect, useState } from 'react'
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
import {
  useSeasonMatchCentre,
  type SeasonMatchCentreCardReader,
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
 * THERE IS NO "OPEN THIS MATCHWEEK" LINK, and the reason is a route fact rather
 * than a design preference. The Match Predictor route carries no matchweek: it
 * opens at whichever one the play context says is current. A link from a
 * September fixture would therefore land the player on a different matchweek
 * from the one they were reading about, which is worse than no link. It becomes
 * possible when that route takes a matchweek, and not before.
 */

/**
 * Contract 141's two reads, supplied by the route. Both optional: this panel is
 * complete without either.
 */
export type SeasonFootballContext = {
  /** The club's form, already fetched for the whole season. Null if unknown. */
  formFor: (clubName: string) => SeasonClubForm | null
  /** This season's meetings between two clubs, fetched when a fixture opens. */
  headToHead?: (teamId: string, opponentId: string) => Promise<ClubHeadToHead>
}

export type SeasonMatchCentreProps = {
  fixture: FixtureListRow
  read: SeasonMatchCentreCardReader
  football?: SeasonFootballContext
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
  const home = football?.formFor(homeName)?.teamId ?? null
  const away = football?.formFor(awayName)?.teamId ?? null
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

export function SeasonMatchCentre({ fixture, read, football }: SeasonMatchCentreProps) {
  const state = useSeasonMatchCentre(read, fixture)
  const homeForm = summariseClubForm(football?.formFor(fixture.home.name) ?? null)
  const awayForm = summariseClubForm(football?.formFor(fixture.away.name) ?? null)
  const headToHead = useHeadToHead(football, fixture.home.name, fixture.away.name)

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
      <p className={styles.round}>
        {fixture.round.name}
        {fixture.kickoff ? ` · ${fixture.kickoff}` : ''}
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
        </>
      )}

      {/* The football, below the player's own side of it and outside the
          card's loading and failure branches: it is the same for everybody and
          is unaffected by whether an entry could be read. */}
      {football ? (
        <div className={styles.football}>
          <h4 className={styles.footballHeading}>Recent form</h4>
          <FormRow name={fixture.home.name} summary={homeForm} />
          <FormRow name={fixture.away.name} summary={awayForm} />

          {headToHead ? (
            <>
              <p className={styles.note}>{headToHead.headline}</p>
              {headToHead.meetings.length > 0 ? (
                <ul className={styles.meetings}>
                  {headToHead.meetings.map((meeting, index) => (
                    <li key={index} className={styles.meeting} data-outcome={meeting.outcome}>
                      {fixture.home.name} {meeting.text}
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
