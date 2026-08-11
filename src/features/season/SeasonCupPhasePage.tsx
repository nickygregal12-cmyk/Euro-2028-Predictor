import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import type { SeasonCupGateway } from './cupPhaseModel'
import {
  CHAMPIONSHIP_REGISTRATION_COPY,
  type SeasonLmsRegistrationGateway,
} from './lmsRegistrationModel'
import { SeasonLmsRegistration } from './SeasonLmsRegistration'
import { useSeasonCupPhase } from './useSeasonCupPhase'
import styles from './SeasonCupPhasePage.module.css'

/**
 * The Predictor Championship: the caller's phase and their own group's table.
 *
 * IT NAMES ITS GAME IN THE HEADING, like the standings table next door: a
 * season is not a game, and when a second game runs in the same season two
 * surfaces headed "Table" would be indistinguishable. ADR 0020 names this one
 * the Predictor Championship in the interface.
 *
 * OPPONENTS APPEAR AS ENTRANTS AT A RANK, NOT BY NAME. Contract 120 returns
 * no display name — that disclosure belongs to the profile reads — and this
 * page renders what the read discloses rather than working around it. The
 * caller's own row is marked "You", tinted and text-marked, never colour
 * alone.
 *
 * THE SPLIT EXPLAINS ITSELF ONCE, ABOVE THE TABLE. ADR 0014: the split is the
 * same competition continuing with a narrower field, points carry through,
 * nobody is eliminated. A player seeing their group shrink deserves that
 * sentence, and it must never read as an elimination notice.
 */

export type SeasonCupPhasePageProps = {
  gateway: SeasonCupGateway
  /**
   * Registration for this competition, when the caller can name it. Optional
   * for the same reason it is on the Last Man Standing page: the route knows
   * which competition the player is looking at, and this surface must not
   * resolve that for itself.
   */
  registration?: SeasonLmsRegistrationGateway
}

const SKELETON_ROWS = 6

export function SeasonCupPhasePage({ gateway, registration }: SeasonCupPhasePageProps) {
  const { status, page, presentation, error, reload } = useSeasonCupPhase(gateway)

  // The panel hides itself once the caller is entered, so the entered branch
  // below stays the single statement of membership.
  const registrationPanel = registration ? (
    <SeasonLmsRegistration
      gateway={registration}
      copy={CHAMPIONSHIP_REGISTRATION_COPY}
      onJoined={reload}
    />
  ) : null

  if (status === 'loading') {
    return (
      <section className={styles.panel} aria-busy="true">
        <h2 className={styles.heading}>Predictor Championship</h2>
        <ul className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className={styles.row}>
              <Skeleton width="100%" height={44} />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (status === 'failed' || !page || !presentation) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>Predictor Championship</h2>
        <Alert variant="error" title="We could not load your Championship group">
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  if (!page.entered) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>Predictor Championship</h2>
        {/* The join sits above the explanation rather than below it: the
            player's question here is "can I get in", and an empty-state
            paragraph answering "no group to show" was the whole dead end. */}
        {registrationPanel}
        <EmptyState
          title="You are not entered"
          description="You are not entered in this Championship, so there is no group to show."
        />
      </section>
    )
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        {presentation.phaseLine ? (
          <p className={styles.eyebrow}>{presentation.phaseLine}</p>
        ) : null}
        <h2 className={styles.heading}>Predictor Championship</h2>
        {presentation.groupLine ? (
          <p className={styles.caption}>
            {presentation.groupLine}
            {/* Contract 169: which authority ranked this table. It is here
                rather than absent because the two initial-phase authorities
                measure different spans, and a player comparing their group to
                someone else's is entitled to know they are reading the same
                kind of table. It says the source and stops — the span and any
                qualification consequence belong to the server. */}
            {presentation.tableSourceLine ? (
              <> {presentation.tableSourceLine}</>
            ) : null}
          </p>
        ) : null}
      </header>

      {presentation.phaseExplanation ? (
        <Alert variant="info" title="Your group has reached the split">
          {presentation.phaseExplanation}
        </Alert>
      ) : null}

      {presentation.rows.length === 0 ? (
        <EmptyState
          title="No table yet"
          description="The table appears once rounds settle. Confirmed results decide it — provisional scores never do."
        />
      ) : (
        <>
          <div className={styles.columns} aria-hidden="true">
            <span className={styles.rank}>#</span>
            <span className={styles.name}>Entrant</span>
            <span className={styles.numeric}>
              <abbr title="Prediction points for">PF</abbr>
            </span>
            <span className={styles.numeric}>
              <abbr title="Prediction points against">PA</abbr>
            </span>
            <span className={styles.points}>Pts</span>
          </div>

          <ul className={styles.list}>
            {presentation.rows.map((row) => (
              <li
                key={row.key}
                className={[styles.row, row.isYou ? styles.rowYou : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* One sentence for assistive technology; the cells below are visual. */}
                <span className={styles.srOnly}>{row.accessibleSummary}</span>
                <span className={styles.rank} aria-hidden="true">
                  {row.rankLabel}
                </span>
                <span className={styles.name} aria-hidden="true">
                  {row.label}
                  {row.isYou ? <span className={styles.youTag}>You</span> : null}
                </span>
                <span className={styles.numeric} aria-hidden="true">
                  {row.pointsFor}
                </span>
                <span className={styles.numeric} aria-hidden="true">
                  {row.pointsAgainst}
                </span>
                <span className={styles.points} aria-hidden="true">
                  {row.tablePoints}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
