import { motion } from 'framer-motion'
import type {
  OnboardingClubGroup,
  OnboardingGameKey,
  OnboardingCompetitionOffer,
  OnboardingModel,
  OnboardingPanel,
  OnboardingView,
} from '../models/onboarding'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { VNextNotice } from '../states/VNextStates'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './onboarding.module.css'

/**
 * vNEXT ONBOARDING — the first screen, in the system the rest of the product
 * uses.
 *
 * ============================ THE STEP IS NOT A SCORE ===================
 *
 * "Step 2 of 4" and nothing else. No percentage complete, no progress bar
 * filling up, no encouragement: a player setting up an account is not
 * competing, and a meter implies both that there is a finish worth racing to
 * and that stopping short is a failure. Nothing after the first step is
 * required, and the page never suggests otherwise.
 *
 * ============================ NOTHING IS PRE-TICKED =====================
 *
 * Every control is off until the player turns it on. The one exception is a
 * game they have ALREADY JOINED, which is drawn as a fact with no control at
 * all — the draft model's own rule, not a decision taken here.
 *
 * ============================ SKIP IS A REAL CONTROL ====================
 *
 * The two optional steps — the club and the games — offer "Skip this" beside
 * Continue, with the same weight. A skip hidden as a small grey link is a skip
 * the product does not really mean.
 *
 * IT IS NOT OFFERED ON THE FIRST STEP, where there is nothing yet to skip
 * past, AND NOT ON THE REVIEW. The review is the commitment point: a control
 * there reading "Skip this" would look like skipping a summary and would
 * actually discard everything the player had just chosen. Their way out of the
 * review is Back, or Finish — and finishing with nothing chosen is a complete
 * outcome the page says so in as many words.
 *
 * ============================ AND FINISH ADMITS WHAT IT DID =============
 *
 * Where some of the setup was refused, the page names exactly what did not
 * happen and still lets the player leave. Follows and game entries are separate
 * server authorities; one refusing is not a reason to hold somebody on a setup
 * screen.
 */

export type OnboardingIntent =
  | { readonly kind: 'toggle-follow'; readonly key: string }
  | { readonly kind: 'toggle-game'; readonly key: string; readonly gameKey: OnboardingGameKey }
  | { readonly kind: 'choose-club'; readonly key: string; readonly teamId: string | null }
  | { readonly kind: 'back' }
  | { readonly kind: 'continue' }
  /** The last step. The host performs the commit; see `models/onboarding.ts`. */
  | { readonly kind: 'finish' }
  /** Leave setup with whatever was already saved. */
  | { readonly kind: 'leave' }
  | { readonly kind: 'retry' }

export type VNextOnboardingProps = {
  readonly view: OnboardingView
  readonly onIntent?: ((intent: OnboardingIntent) => void) | undefined
}

export function VNextOnboarding({ view, onIntent }: VNextOnboardingProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)

  if (view.kind === 'loading') {
    return (
      <VNextNotice
        destination="none"
        heading="Welcome"
        title="Getting things ready"
        body="Loading the competitions you can follow."
      />
    )
  }

  if (view.kind === 'unavailable') {
    return (
      <VNextNotice
        destination="none"
        heading="Welcome"
        title="We could not load this"
        body={view.message}
        onRetry={() => onIntent?.({ kind: 'retry' })}
      />
    )
  }

  const model = view.model

  return (
    <VNextShell
      // NOT ONE OF THE FOUR. Onboarding is the way in, not a place to return
      // to, and lighting a destination up would be the navigation telling a
      // brand-new player they are already somewhere.
      destination="none"
      header={
        <VNextPageHeader
          title={model.greeting}
          context={`Step ${model.position} of ${model.total}`}
        />
      }
    >
      <div className={styles.page}>
        <motion.div
          key={model.panel.step}
          variants={rise}
          initial="hidden"
          animate="visible"
          className={styles.body}
        >
          <Panel panel={model.panel} onIntent={onIntent} />
          <Commit model={model} onIntent={onIntent} />
        </motion.div>
      </div>
    </VNextShell>
  )
}

/* ========================================================================== */

function Panel({
  panel,
  onIntent,
}: {
  readonly panel: OnboardingPanel
  readonly onIntent: ((intent: OnboardingIntent) => void) | undefined
}) {
  switch (panel.step) {
    case 'competitions':
      return (
        <section className={styles.step} aria-labelledby="vnext-onboarding-step">
          <h2 id="vnext-onboarding-step" className={text.title}>
            Which competitions do you follow?
          </h2>
          {/* The sentence people misread, on the step where they misread it. */}
          <p className={`${text.body} ${styles.note}`}>{panel.note}</p>
          {panel.offers.length === 0 ? (
            <p className={`${text.body} ${styles.empty}`}>
              There are no competitions published to follow yet. You can carry on
              and pick some later.
            </p>
          ) : (
            <ul className={styles.list}>
              {panel.offers.map((offer) => (
                <li key={offer.key}>
                  <FollowChoice offer={offer} onIntent={onIntent} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )

    case 'clubs':
      return (
        <section className={styles.step} aria-labelledby="vnext-onboarding-step">
          <h2 id="vnext-onboarding-step" className={text.title}>
            Have you got a club?
          </h2>
          <p className={`${text.body} ${styles.note}`}>
            Optional, and one per competition. It only changes what we show you
            first — it never affects your predictions or your points.
          </p>
          {panel.groups.length === 0 ? (
            <p className={`${text.body} ${styles.empty}`}>
              You are not following a competition yet, so there are no clubs to
              choose from.
            </p>
          ) : (
            panel.groups.map((group) => (
              <ClubGroup key={group.key} group={group} onIntent={onIntent} />
            ))
          )}
        </section>
      )

    case 'games':
      return (
        <section className={styles.step} aria-labelledby="vnext-onboarding-step">
          <h2 id="vnext-onboarding-step" className={text.title}>
            Which games do you want to play?
          </h2>
          <p className={`${text.body} ${styles.note}`}>
            You can join any of these later from the games page. Nothing here is
            permanent except the fun.
          </p>
          {panel.offers.length === 0 ? (
            <p className={`${text.body} ${styles.empty}`}>
              Games belong to a competition, and you are not following one yet.
              Go back a step if you would like to.
            </p>
          ) : (
            panel.offers.map((offer) => (
              <GameGroup key={offer.key} offer={offer} onIntent={onIntent} />
            ))
          )}
        </section>
      )

    default:
      return (
        <section className={styles.step} aria-labelledby="vnext-onboarding-step">
          <h2 id="vnext-onboarding-step" className={text.title}>
            Ready when you are
          </h2>
          {panel.summary.empty ? (
            <p className={`${text.body} ${styles.empty}`}>
              You have not chosen anything, and that is a perfectly good way to
              start. Everything here is available whenever you want it.
            </p>
          ) : (
            <>
              {/* THREE LISTS, NOT ONE. They are three server authorities and
                  one can be refused while the others go through, so the review
                  never merges them into a single "your setup". */}
              <Summary title="Following" items={panel.summary.follows} />
              <Summary
                title="Your clubs"
                items={panel.summary.clubs.map((row) => `${row.club} — ${row.competition}`)}
              />
              <Summary
                title="Joining"
                items={panel.summary.games.map((row) => `${row.game} — ${row.competition}`)}
              />
              <p className={`${text.caption} ${styles.pending}`}>
                Nothing above has been saved yet. It is saved when you finish.
              </p>
            </>
          )}
        </section>
      )
  }
}

function Summary({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  if (items.length === 0) return null
  return (
    <div className={styles.summary}>
      <h3 className={text.label}>{title}</h3>
      <ul className={styles.summaryList}>
        {items.map((item) => (
          <li key={item} className={text.body}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FollowChoice({
  offer,
  onIntent,
}: {
  readonly offer: OnboardingCompetitionOffer
  readonly onIntent: ((intent: OnboardingIntent) => void) | undefined
}) {
  return (
    <label className={styles.choice} data-selected={offer.followed}>
      <input
        type="checkbox"
        className={text.srOnly}
        checked={offer.followed}
        onChange={() => onIntent?.({ kind: 'toggle-follow', key: offer.key })}
      />
      <span className={styles.choiceBody}>
        <span className={text.emphasis}>{offer.name}</span>
        <span className={`${text.caption} ${styles.meta}`}>{offer.seasonLabel}</span>
        <span className={`${text.caption} ${styles.meta}`}>{offer.summary}</span>
      </span>
      <span aria-hidden="true" className={styles.tick}>
        {offer.followed ? '✓' : ''}
      </span>
    </label>
  )
}

function ClubGroup({
  group,
  onIntent,
}: {
  readonly group: OnboardingClubGroup
  readonly onIntent: ((intent: OnboardingIntent) => void) | undefined
}) {
  return (
    <div className={styles.group}>
      <h3 className={text.label}>{group.competitionName}</h3>
      {group.clubs === null ? (
        // NOT AN EMPTY LIST. "We have not read the clubs yet" and "this
        // competition has no clubs" are different, and only one is worth
        // waiting for.
        <p className={`${text.caption} ${styles.meta}`}>Loading clubs…</p>
      ) : group.clubs.length === 0 ? (
        <p className={`${text.caption} ${styles.meta}`}>
          We could not list the clubs for this competition. You can set a
          favourite later.
        </p>
      ) : (
        <ul className={styles.clubs}>
          {group.clubs.map((club) => (
            <li key={club.teamId}>
              <button
                type="button"
                className={styles.club}
                data-selected={club.chosen}
                aria-pressed={club.chosen}
                onClick={() =>
                  onIntent?.({
                    kind: 'choose-club',
                    key: group.key,
                    // Pressing the chosen club again clears it. A favourite is
                    // optional, so there has to be a way back to none.
                    teamId: club.chosen ? null : club.teamId,
                  })
                }
              >
                {club.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GameGroup({
  offer,
  onIntent,
}: {
  readonly offer: OnboardingCompetitionOffer
  readonly onIntent: ((intent: OnboardingIntent) => void) | undefined
}) {
  return (
    <div className={styles.group}>
      <h3 className={text.label}>{offer.name}</h3>
      <ul className={styles.list}>
        {offer.games.map((game) => (
          <li key={game.gameKey}>
            {game.joined ? (
              // A SERVER FACT, NOT A CONTROL. See the header.
              <p className={styles.joined} data-vnext-game={game.gameKey}>
                <span className={text.emphasis}>{game.name}</span>
                <span className={`${text.caption} ${styles.meta}`}>Already joined</span>
              </p>
            ) : game.refusal !== null ? (
              <p className={styles.joined} data-vnext-game={game.gameKey}>
                <span className={text.emphasis}>{game.name}</span>
                <span className={`${text.caption} ${styles.meta}`}>{game.refusal}</span>
              </p>
            ) : (
              <label
                className={styles.choice}
                data-selected={game.chosen}
                data-vnext-game={game.gameKey}
              >
                <input
                  type="checkbox"
                  className={text.srOnly}
                  checked={game.chosen}
                  onChange={() =>
                    onIntent?.({
                      kind: 'toggle-game',
                      key: offer.key,
                      gameKey: game.gameKey,
                    })
                  }
                />
                <span className={styles.choiceBody}>
                  <span className={text.emphasis}>{game.name}</span>
                  <span className={`${text.caption} ${styles.meta}`}>{game.description}</span>
                  <span className={`${text.caption} ${styles.meta}`}>{game.cadence}</span>
                </span>
                <span aria-hidden="true" className={styles.tick}>
                  {game.chosen ? '✓' : ''}
                </span>
              </label>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Commit({
  model,
  onIntent,
}: {
  readonly model: OnboardingModel
  readonly onIntent: ((intent: OnboardingIntent) => void) | undefined
}) {
  const working = model.commit.kind === 'working'

  return (
    <div className={styles.footer}>
      {model.commit.kind === 'partial' ? (
        <div className={styles.refused} role="status">
          <p className={text.emphasis}>Some of that did not go through</p>
          <ul className={styles.summaryList}>
            {model.commit.refused.map((row) => (
              <li key={row} className={text.body}>
                {row}
              </li>
            ))}
          </ul>
          <p className={`${text.caption} ${styles.meta}`}>
            Everything else was saved. You can set these up again from the games
            page whenever you like.
          </p>
        </div>
      ) : null}

      {model.commit.kind === 'failed' ? (
        <p className={styles.error} role="alert">
          {model.commit.message}
        </p>
      ) : null}

      <div className={styles.actions}>
        {model.back ? (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => onIntent?.({ kind: 'back' })}
          >
            Back
          </button>
        ) : null}

        {model.commit.kind === 'partial' ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => onIntent?.({ kind: 'leave' })}
          >
            Carry on
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            onClick={() => onIntent?.({ kind: model.isLast ? 'finish' : 'continue' })}
            aria-busy={working}
            disabled={working}
          >
            {working ? 'Saving…' : model.isLast ? 'Finish setup' : 'Continue'}
          </button>
        )}

        {/* SKIP CARRIES THE SAME WEIGHT AS CONTINUE, on the two steps that are
            genuinely optional. Never on the review — see the header. */}
        {model.back && !model.isLast && model.commit.kind !== 'partial' ? (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => onIntent?.({ kind: 'continue' })}
          >
            Skip this
          </button>
        ) : null}
      </div>
    </div>
  )
}
