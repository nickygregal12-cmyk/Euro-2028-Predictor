import { Alert, Button, Skeleton } from '../../design-system'
import { ClubIdentity } from '../../design-system/ClubIdentity'
import type { FixtureListRow } from './fixtureListModel'
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
 * THERE IS NO "OPEN THIS MATCHWEEK" LINK, and the reason is a route fact rather
 * than a design preference. The Match Predictor route carries no matchweek: it
 * opens at whichever one the play context says is current. A link from a
 * September fixture would therefore land the player on a different matchweek
 * from the one they were reading about, which is worse than no link. It becomes
 * possible when that route takes a matchweek, and not before.
 */

export type SeasonMatchCentreProps = {
  fixture: FixtureListRow
  read: SeasonMatchCentreCardReader
}

export function SeasonMatchCentre({ fixture, read }: SeasonMatchCentreProps) {
  const state = useSeasonMatchCentre(read, fixture)

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
    </div>
  )
}
