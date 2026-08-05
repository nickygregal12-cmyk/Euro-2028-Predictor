import { Alert, Button, ClubMatchCard, Skeleton } from '../../design-system'
import type { MatchPredictorGateway } from './matchPredictorModel'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { useSeasonMatchPredictor } from './useSeasonMatchPredictor'
import styles from './SeasonMatchPredictorPage.module.css'

/**
 * The phone-first season Match Predictor matchweek card.
 *
 * Renders the read model and issues commands; it computes no lock, no score and
 * no allowance of its own. Every state it can show comes from `presentCard`,
 * which implements §12.1's state machine, so a state this page displays is a
 * state the plan defines rather than one the component invented.
 *
 * WHAT THE PLAYER IS TOLD AT THE TOP, ALWAYS. §12.1's Match Predictor branch is
 * the least intuitive rule in the game: an untouched matchweek banks nothing,
 * while a matchweek the player touched banks exactly what they entered and
 * scores zero for the blanks. A player who does not know that cannot tell the
 * difference between "I left it" and "I left it half done", and the second one
 * costs them. So it is stated on the card rather than buried in a help page —
 * and it changes wording as the card changes state, because the consequence
 * changes with it.
 *
 * LOADING IS A LAYOUT-SHAPED SKELETON, not a spinner (§11.2, §13.4). The
 * skeleton renders the same number of fixture rows at the same heights, so the
 * content does not jump when it arrives — which is also what keeps cumulative
 * layout shift at zero on this route.
 */

export type SeasonMatchPredictorPageProps = {
  gateway: MatchPredictorGateway
  matchweek: number
}

const SKELETON_ROWS = 10

function atLockCopy(atLock: 'unbanked' | 'banks_entered' | null, entered: number, total: number) {
  if (atLock === 'unbanked') {
    return 'You have not started this matchweek. If you leave it untouched, it banks nothing and scores nothing — that is different from entering predictions and leaving some blank.'
  }
  if (atLock === 'banks_entered') {
    return entered === total
      ? 'All fixtures entered. At kickoff this card banks every prediction you have made.'
      : `At kickoff this card banks the ${entered} prediction${entered === 1 ? '' : 's'} you have entered. The remaining ${total - entered} will score zero — nothing is filled in for you.`
  }
  return null
}

export function SeasonMatchPredictorPage({ gateway, matchweek }: SeasonMatchPredictorPageProps) {
  const view = useSeasonMatchPredictor(gateway, matchweek)

  if (view.status === 'loading') {
    return (
      <SeasonCompetitionShell
        competitionName="Loading competition"
        seasonLabel="Season"
        statusStrip={[]}
        active="play"
      >
        <div className={styles.card} aria-busy="true" aria-live="polite">
          <span className={styles.srOnly}>Loading this matchweek</span>
          <Skeleton width="60%" height={20} />
          <div className={styles.fixtures}>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <Skeleton key={index} height={96} radius="card" />
            ))}
          </div>
        </div>
      </SeasonCompetitionShell>
    )
  }

  if (view.status === 'failed' || view.page === null || view.presentation === null) {
    return (
      <SeasonCompetitionShell
        competitionName="Match Predictor"
        seasonLabel="Season"
        statusStrip={[]}
        active="play"
      >
        <Alert variant="error" title="This matchweek is unavailable">
          {view.loadError ?? 'This matchweek could not be loaded.'}
        </Alert>
        <Button variant="secondary" onClick={view.reload}>
          Try again
        </Button>
      </SeasonCompetitionShell>
    )
  }

  const { page, presentation } = view
  const statusStrip = [
    `Matchweek ${page.matchweek.number} of ${page.matchweek.of}`,
    presentation.lock.label,
    `${presentation.entered}/${presentation.total} entered`,
  ]
  if (page.settledPoints !== null) statusStrip.push(`${page.settledPoints} pts`)

  const lockConsequence = atLockCopy(presentation.atLock, presentation.entered, presentation.total)

  return (
    <SeasonCompetitionShell
      competitionName={page.competition.name}
      seasonLabel={page.competition.seasonLabel}
      statusStrip={statusStrip}
      active="play"
    >
      {presentation.state === 'conflict_requires_refresh' ? (
        <Alert variant="error" title="This matchweek changed somewhere else">
          Your predictions were edited on another device, so this page is out of date. Reload it to
          see the saved version before editing again.
          <div className={styles.alertAction}>
            <Button variant="secondary" onClick={view.reload}>
              Reload matchweek
            </Button>
          </div>
        </Alert>
      ) : null}

      {presentation.state === 'unavailable' ? (
        <Alert variant="warning" title={presentation.lock.label}>
          {presentation.lock.detail}
          {presentation.lock.retryable ? (
            <div className={styles.alertAction}>
              <Button variant="secondary" onClick={view.reload}>
                Try again
              </Button>
            </div>
          ) : null}
        </Alert>
      ) : null}

      {view.refusal !== null ? (
        <Alert variant="warning" title="That is not possible right now">
          {view.refusal}
        </Alert>
      ) : null}

      <section className={styles.card} aria-label={`Matchweek ${page.matchweek.number} card`}>
        <p className={styles.lockLine}>{presentation.lock.detail}</p>
        {lockConsequence !== null ? <p className={styles.consequence}>{lockConsequence}</p> : null}

        {presentation.total === 0 ? (
          <Alert variant="info" title="No fixtures yet">
            This matchweek has no fixtures published, so there is nothing to predict yet.
          </Alert>
        ) : (
          <div className={styles.fixtures}>
            {page.fixtures.map((fixture) => (
              <ClubMatchCard
                key={fixture.fixtureId}
                state={
                  fixture.result !== null
                    ? 'scored'
                    : presentation.editable
                      ? 'editable'
                      : 'locked'
                }
                matchweek={page.matchweek.number}
                kickoff={fixture.kickoffAt}
                home={{ name: fixture.home.name, tokens: fixture.home.tokens }}
                away={{ name: fixture.away.name, tokens: fixture.away.tokens }}
                homeScore={fixture.prediction?.home ?? null}
                awayScore={fixture.prediction?.away ?? null}
                onHomeScoreChange={
                  presentation.editable
                    ? (value) =>
                        view.setPrediction(
                          fixture.fixtureId,
                          value === null
                            ? null
                            : { home: value, away: fixture.prediction?.away ?? 0 },
                        )
                    : undefined
                }
                onAwayScoreChange={
                  presentation.editable
                    ? (value) =>
                        view.setPrediction(
                          fixture.fixtureId,
                          value === null
                            ? null
                            : { home: fixture.prediction?.home ?? 0, away: value },
                        )
                    : undefined
                }
                saveStatus={view.saveStatus[fixture.fixtureId]}
                onRetrySave={() => view.retrySave(fixture.fixtureId)}
                result={fixture.result ?? undefined}
              />
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.joker}
            aria-pressed={page.joker.playedHere}
            disabled={!presentation.editable || (!page.joker.playable && !page.joker.playedHere)}
            onClick={() => view.setJoker(!page.joker.playedHere)}
          >
            <span className={styles.jokerLabel}>
              {page.joker.playedHere ? 'Joker played' : 'Play Joker'}
            </span>
            <span className={styles.jokerMeta}>
              Doubles this whole matchweek · {page.joker.remainingThisHalf} left this half
            </span>
          </button>

          {presentation.editable ? (
            <Button
              variant="primary"
              disabled={presentation.entered === 0 || page.cardStatus === 'confirmed'}
              onClick={view.confirmCard}
            >
              {page.cardStatus === 'confirmed' ? 'Card confirmed' : 'Confirm card'}
            </Button>
          ) : null}
        </div>
      </section>
    </SeasonCompetitionShell>
  )
}
