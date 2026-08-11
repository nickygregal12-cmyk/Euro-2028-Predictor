import { Link } from 'react-router'
import { Alert, Button, ClubMatchCard, Skeleton } from '../../design-system'
import { MatchweekPoints } from '../scoring/MatchweekPoints'
import { MAIN_PREDICTOR_REGISTRATION_COPY } from './lmsRegistrationModel'
import type { SeasonLmsRegistrationGateway } from './lmsRegistrationModel'
import { commandRefusal, type MatchPredictorGateway } from './matchPredictorModel'
import { SeasonCompetitionShell, type SeasonShellSection } from './SeasonCompetitionShell'
import { SeasonGameSubNav } from './SeasonGameSubNav'
import { SeasonConsensusPanel } from './SeasonConsensusPanel'
import type { SeasonConsensus } from '../../services/supabase/seasonConsensusModel'
import { SeasonLmsRegistration } from './SeasonLmsRegistration'
import { useSeasonMatchPredictor } from './useSeasonMatchPredictor'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import styles from './SeasonMatchPredictorPage.module.css'

export type SeasonMatchPredictorPageProps = {
  gateway: MatchPredictorGateway
  matchweek: number
  competitionName: string
  seasonLabel: string
  destinations?: Partial<Record<SeasonShellSection, string>>
  registration?: SeasonLmsRegistrationGateway
  /**
   * The post-lock consensus read, supplied by the route. Omitted by the DEV
   * harness, which has no season to read one from — the panel is then absent
   * rather than empty.
   */
  consensus?: (matchweek: number) => Promise<SeasonConsensus>
  /**
   * Where another matchweek of this card lives. Supplied by the route, which
   * owns URL construction; omitted by the DEV harness, which is not on one.
   */
  matchweekHref?: (matchweek: number) => string
}

const SKELETON_ROWS = 10

/**
 * Moving between matchweeks.
 *
 * THIS IS WHY THE ROUTE TAKES `?matchweek=` AT ALL. The parameter landed with
 * the Match Centre's link into it, so a player could reach the card that
 * predicts a fixture they were looking at — but from the card itself there was
 * still no way to the matchweek either side, and "Matchweek 3 of 38" was a
 * label rather than a control. Editing the address bar was the only way
 * forward, which is not a way forward.
 *
 * A LINK EACH SIDE, AND NOTHING AT A BOUND. Matchweek 1 has no previous and the
 * last has no next, so those render absent rather than as a greyed arrow: a
 * control that cannot be pressed is what this batch is removing, not something
 * it should be adding. `of` is the season's own matchweek count as the card
 * read reports it, so the bound is the server's rather than a guess.
 *
 * They are links, not buttons, because they go somewhere — which keeps
 * open-in-new-tab, middle-click and the browser's own back behaviour working
 * for a player stepping back through a season.
 */
function MatchweekStepper({
  number,
  of,
  href,
}: {
  number: number
  of: number
  href: (matchweek: number) => string
}) {
  return (
    <nav className={styles.stepper} aria-label="Matchweek">
      {number > 1 ? (
        <Link className={styles.step} to={href(number - 1)} aria-label="Previous matchweek">
          ←
        </Link>
      ) : (
        <span className={styles.stepSpacer} aria-hidden="true" />
      )}
      <p className={styles.stepLabel}>
        Matchweek {number} of {of}
      </p>
      {number < of ? (
        <Link className={styles.step} to={href(number + 1)} aria-label="Next matchweek">
          →
        </Link>
      ) : (
        <span className={styles.stepSpacer} aria-hidden="true" />
      )}
    </nav>
  )
}

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

export function SeasonMatchPredictorPage({
  gateway,
  matchweek,
  competitionName,
  seasonLabel,
  destinations,
  registration,
  consensus,
  matchweekHref,
}: SeasonMatchPredictorPageProps) {
  const view = useSeasonMatchPredictor(gateway, matchweek)

  if (view.status === 'loading') {
    return (
      <SeasonCompetitionShell
        competitionName={competitionName}
        seasonLabel={seasonLabel}
        statusStrip={[]}
        active="games"
        destinations={destinations}
      >
        <SeasonGameSubNav game="match-predictor" />
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
        competitionName={competitionName}
        seasonLabel={seasonLabel}
        statusStrip={[]}
        active="games"
        destinations={destinations}
      >
        <SeasonGameSubNav game="match-predictor" />
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
  // The matchweek is in the strip only where there is no stepper to say it.
  // Printing "Matchweek 3 of 38" twice on one screen is how a page starts
  // looking like two pages stitched together.
  const statusStrip = [
    ...(matchweekHref ? [] : [`Matchweek ${page.matchweek.number} of ${page.matchweek.of}`]),
    presentation.lock.label,
    `${presentation.entered}/${presentation.total} entered`,
  ]
  if (page.settledPoints !== null) statusStrip.push(`${page.settledPoints} pts`)

  const lockConsequence = atLockCopy(presentation.atLock, presentation.entered, presentation.total)

  // Why each of the two card-level commands would be refused, asked of the
  // model that owns the answer. `null` means the command would be accepted, and
  // that — not a disabled attribute — decides whether a control renders at all.
  const jokerRefusal = commandRefusal(
    presentation,
    { kind: 'setJoker', played: !page.joker.playedHere },
    page.joker,
  )
  const confirmRefusal = commandRefusal(presentation, { kind: 'confirmCard' }, page.joker)

  return (
    <SeasonCompetitionShell
      competitionName={competitionName}
      seasonLabel={seasonLabel}
      statusStrip={statusStrip}
      active="games"
      destinations={destinations}
      // The flagship desktop composition the direction names: the prediction
      // workspace in the main column, what everybody else predicted beside it
      // rather than a scroll below it. On a phone the panel is not a panel —
      // it stacks under the card in source order, exactly where it was.
      asideLabel="Match insights"
      aside={
        consensus ? (
          <SeasonConsensusPanel matchweek={page.matchweek.number} load={consensus} />
        ) : undefined
      }
    >
      <SeasonGameSubNav game="match-predictor" />

      {matchweekHref ? (
        <MatchweekStepper
          number={page.matchweek.number}
          of={page.matchweek.of}
          href={matchweekHref}
        />
      ) : null}

      {registration ? (
        <SeasonLmsRegistration
          gateway={registration}
          copy={MAIN_PREDICTOR_REGISTRATION_COPY}
          onJoined={view.reload}
        />
      ) : null}

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
                // `ClubMatchCard.kickoff` is a LABEL, not an instant. This page
                // shipped passing `kickoffAt` straight through, so a player on
                // the Match Predictor read the raw ISO timestamp in the card's
                // eyebrow — the one thing the UI direction's § 3 forbids
                // outright. The card list carries no date heading above it, so
                // the day travels with the time ("Sat 22 Aug · 17:45"), and an
                // unformattable instant drops the line rather than printing
                // anything.
                kickoff={formatKickoffWithDay(fixture.kickoffAt)}
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

        {/* NOTHING HERE IS DISABLED, and the two that used to be were the last
            disabled controls in the product. Each was a STATEMENT wearing a
            button's clothes — "Card confirmed" is a fact about the card, and a
            greyed Joker is the sentence "you have none left" spelled in
            opacity. Both now say what they mean, and the words come from
            `commandRefusal`, the model that already decides why a command is
            refused, rather than from copy written a second time here. */}
        <div className={styles.actions}>
          {jokerRefusal === null ? (
            <button
              type="button"
              className={styles.joker}
              aria-pressed={page.joker.playedHere}
              onClick={() => view.setJoker(!page.joker.playedHere)}
            >
              <span className={styles.jokerLabel}>
                {page.joker.playedHere ? 'Joker played' : 'Play Joker'}
              </span>
              <span className={styles.jokerMeta}>
                Doubles this whole matchweek · {page.joker.remainingThisHalf} left this half
              </span>
            </button>
          ) : (
            <p className={styles.jokerState}>
              <span className={styles.jokerLabel}>
                {page.joker.playedHere
                  ? 'Joker played on this matchweek'
                  : 'No Joker on this matchweek'}
              </span>
              <span className={styles.jokerMeta}>{jokerRefusal}</span>
            </p>
          )}

          {presentation.editable ? (
            page.cardStatus === 'confirmed' ? (
              <p className={styles.actionState}>
                Card confirmed. You can still change a prediction until this matchweek locks.
              </p>
            ) : confirmRefusal !== null ? (
              <p className={styles.actionState}>{confirmRefusal}</p>
            ) : (
              <Button variant="primary" onClick={view.confirmCard}>
                Confirm card
              </Button>
            )
          ) : null}
        </div>
      </section>

      {/* The status strip says "28 pts" and nothing said where it came from.
          This is the other half of `explainFixtureScore`, which the Match Centre
          has been using to explain ONE fixture since it shipped: the same
          authority, for the whole card, once. It renders nothing at all until
          the matchweek settles. */}
      <MatchweekPoints card={page} />
    </SeasonCompetitionShell>
  )
}
