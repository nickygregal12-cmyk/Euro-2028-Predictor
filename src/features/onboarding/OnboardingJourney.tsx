import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, ProgressBar, Skeleton } from '../../design-system'
import {
  catalogueFromPublishedSeasons,
  GAME_PRESENTATION,
  type HubCompetition,
} from '../hub/competitionCatalogue'
import {
  presentPlayerCompetitions,
  type PlayerCompetitions,
} from '../hub/playerCompetitions'
import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import type { PlayerPreferences } from '../../services/supabase/playerPreferencesModel'
import type { SeasonClub } from '../../services/supabase/seasonClubs'
import { userFacingError } from '../../shared/errors/userFacingError'
import { OnboardingCompetitionStep } from './OnboardingCompetitionStep'
import { OnboardingFavouriteStep } from './OnboardingFavouriteStep'
import { OnboardingGamesStep, type OnboardingCompetitionOffer } from './OnboardingGamesStep'
import { OnboardingReviewStep } from './OnboardingReviewStep'
import {
  applyGamesToAll,
  favouriteFor,
  gamesFor,
  setFavourite,
  toggleFollowed,
  toggleGame,
  type OnboardingDraft,
} from './onboardingDraft'
import {
  draftFromPreferences,
  nextStep,
  previousStep,
  resumeStep,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from './onboardingResume'
import styles from './onboarding.module.css'

/**
 * First sign-in, end to end (contract 157, `MIG-UI-10`).
 *
 * WHAT IT REPLACES. `/welcome` was one static screen with a Continue button.
 * The four steps below existed, were tested, were rendered in the component
 * gallery, and were wired into nothing — because until contract 157 there was
 * nowhere to put the answers, and a flow that collected them and lost them on
 * refresh would have been worse than no flow. There is somewhere now.
 *
 * PROGRESS IS WRITTEN AS THE PLAYER MOVES, NOT ONLY AT THE END. Each step
 * advance writes `set_onboarding_progress`, so a player who closes the tab on
 * step three resumes on step three — on this device or another one. The write
 * is deliberately NOT awaited before the next step renders: a slow network must
 * not make the interface feel broken, and the worst case of a lost progress
 * write is that a returning player starts one step earlier than they left.
 *
 * FOLLOWS ARE WRITTEN AT THE END, IN ONE PASS. They could be written per tap,
 * and are not: the player is still deciding, and a competition followed and
 * unfollowed three times on the way to a decision should not be three round
 * trips and three chances to half-fail. The review step is the commitment
 * point, and it says so.
 *
 * A FAILED GAME JOIN DOES NOT FAIL ONBOARDING. Follows and games are separate
 * server authorities and one may refuse — a registration window that closed
 * while the player was choosing, most likely. The journey reports exactly which
 * games could not be joined, keeps everything that did succeed, and still
 * finishes: stranding somebody on a setup screen because a game filled up would
 * be the worst possible reading of "optional steps do not block entry".
 *
 * EVERY STEP AFTER THE FIRST IS SKIPPABLE. Following nothing, choosing no club
 * and joining no game is a complete, valid outcome that lands on the Hub. The
 * only thing onboarding insists on is that it happened.
 *
 * A PENDING INVITE OUTRANKS THE HUB AT THE END. Somebody who arrived from an
 * invite link came here to join something; onboarding is the interruption, not
 * the destination.
 */

type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready'
      player: PlayerCompetitions
      preferences: PlayerPreferences
    }

export type OnboardingJourneyProps = {
  displayName: string | null
  /** Where to go when setup finishes. The caller owns the invite decision. */
  onFinished: () => void
}

export function OnboardingJourney({ displayName, onFinished }: OnboardingJourneyProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [step, setStep] = useState<OnboardingStep>('competitions')
  const [draft, setDraft] = useState<OnboardingDraft>({
    followed: [],
    games: {},
    favourites: {},
  })
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [partialFailures, setPartialFailures] = useState<readonly string[]>([])
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setLoad({ status: 'loading' })
    void (async () => {
      try {
        const [{ fetchHubMembership }, { fetchPublishedWeeklySeasons }, { fetchPlayerPreferences }] =
          await Promise.all([
            import('../../services/supabase/competitionGames'),
            import('../../services/supabase/weeklyCatalogue'),
            import('../../services/supabase/playerPreferences'),
          ])
        const published = await fetchPublishedWeeklySeasons()
        const [seasons, preferences] = await Promise.all([
          fetchHubMembership(published.map((season) => season.seasonName)),
          fetchPlayerPreferences(),
        ])
        if (!active) return
        const catalogue = catalogueFromPublishedSeasons(published, seasons)
        const player = presentPlayerCompetitions(catalogue, seasons, { preferences })
        setLoad({ status: 'ready', player, preferences })
        // Resume, rather than restart. Both halves come from the server: which
        // step they reached, and what they had already chosen.
        setStep(resumeStep(preferences))
        setDraft(draftFromPreferences(preferences, catalogue))
      } catch {
        if (active) setLoad({ status: 'failed' })
      }
    })()
    return () => {
      active = false
    }
  }, [nonce])

  const catalogue = load.status === 'ready' ? load.player.catalogue : []

  const followedCompetitions = useMemo(
    () => catalogue.filter((entry) => draft.followed.includes(entry.seasonRowName)),
    [catalogue, draft.followed],
  )

  const offers = useMemo<OnboardingCompetitionOffer[]>(
    () =>
      followedCompetitions.map((competition) => ({
        key: competition.seasonRowName,
        name: competition.name,
        games: competition.games.map((game) => ({
          gameKey: game.gameKey,
          name: game.name,
          description: game.description,
          cadence: GAME_PRESENTATION[game.gameKey].cadence,
          action: GAME_PRESENTATION[game.gameKey].action,
          // `coming-soon` is the catalogue's word for a game this competition
          // has not opened. It is stated rather than hidden: "not open yet" and
          // "this platform does not have that game" are different facts, and a
          // player who cannot tell them apart will keep looking for it.
          refusal:
            game.status === 'coming-soon'
              ? 'This competition has not opened this game yet.'
              : null,
          joined: game.joined,
        })),
      })),
    [followedCompetitions],
  )

  const goTo = useCallback((target: OnboardingStep) => {
    setStep(target)
    // Best effort, not awaited. See the header: a slow write must not hold the
    // interface, and the cost of losing one is a single repeated step.
    void (async () => {
      try {
        const { setOnboardingProgress } = await import(
          '../../services/supabase/playerPreferences'
        )
        await setOnboardingProgress(target)
      } catch {
        // Deliberately silent. The player is not the person who can fix this,
        // and interrupting their setup to say so would be noise.
      }
    })()
  }, [])

  const finish = useCallback(async () => {
    if (load.status !== 'ready') return
    setFinishing(true)
    setFinishError(null)
    setPartialFailures([])

    const byName = new Map(catalogue.map((entry) => [entry.seasonRowName, entry]))
    const failures: string[] = []

    try {
      const [{ setCompetitionFollow, setOnboardingProgress }, { registerBonusCompetition }] =
        await Promise.all([
          import('../../services/supabase/playerPreferences'),
          import('../../services/supabase/bonusGames'),
        ])

      // 1. Follows, including the favourite club the player named for each.
      //    A follow that fails is reported and does not stop the rest.
      for (const key of draft.followed) {
        const competition = byName.get(key)
        if (!competition) continue
        try {
          await setCompetitionFollow(
            competition.tournamentId,
            true,
            favouriteFor(draft, key),
          )
        } catch {
          failures.push(`Following ${competition.name}`)
        }
      }

      // 2. Game entries. A separate server authority, and separately fallible:
      //    a registration window can close between choosing and finishing.
      for (const key of draft.followed) {
        const competition = byName.get(key)
        if (!competition) continue
        for (const gameKey of gamesFor(draft, key)) {
          const served = competition.games.find((game) => game.gameKey === gameKey)
          if (!served || served.joined) continue
          const gameCompetitionId = servedCompetitionId(load.player, key, gameKey)
          if (!gameCompetitionId) {
            failures.push(`${served.name} in ${competition.name}`)
            continue
          }
          try {
            await registerBonusCompetition(gameCompetitionId)
          } catch {
            failures.push(`${served.name} in ${competition.name}`)
          }
        }
      }

      // 3. Onboarding is over either way. The server stamps completion once and
      //    never rewrites it, so a player who runs setup again later keeps the
      //    date they first finished.
      await setOnboardingProgress('review', true)

      if (failures.length > 0) {
        setPartialFailures(failures)
        setFinishing(false)
        return
      }

      onFinished()
    } catch (error) {
      setFinishError(
        userFacingError(error, 'We could not finish your setup. Please try again.'),
      )
      setFinishing(false)
    }
  }, [catalogue, draft, load, onFinished])

  if (load.status === 'loading') {
    return (
      <div className={styles.journey} aria-busy="true">
        <Skeleton lines={6} />
      </div>
    )
  }

  if (load.status === 'failed') {
    return (
      <div className={styles.journey}>
        <Alert variant="warning" title="We couldn’t load the competitions">
          Setup needs the list of competitions the platform publishes, and that read did not
          answer.
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={() => setNonce((value) => value + 1)}>
              Try again
            </Button>
          </div>
        </Alert>
        {/* Never a trap. A failed catalogue read must not be able to keep
            somebody out of a product they have already signed up for. */}
        <Button variant="secondary" onClick={onFinished}>
          Skip setup for now
        </Button>
      </div>
    )
  }

  const index = ONBOARDING_STEPS.indexOf(step)
  const back = previousStep(step)
  const forward = nextStep(step)

  return (
    <div className={styles.journey}>
      <header className={styles.journeyHeader}>
        <p className={styles.journeyEyebrow}>
          {displayName ? `Welcome, ${displayName}` : 'Welcome'}
        </p>
        <h1 className={styles.journeyTitle}>Set up your season</h1>
        <ProgressBar
          value={index + 1}
          max={ONBOARDING_STEPS.length}
          label={`Step ${index + 1} of ${ONBOARDING_STEPS.length}`}
        />
      </header>

      {step === 'competitions' ? (
        <OnboardingCompetitionStep
          player={load.player}
          draft={draft}
          onToggle={(key) => setDraft((current) => toggleFollowed(current, key))}
        />
      ) : null}

      {step === 'clubs' ? (
        <FavouriteClubsStep
          competitions={followedCompetitions}
          draft={draft}
          onSelect={(key, teamId) =>
            setDraft((current) => setFavourite(current, key, teamId))
          }
        />
      ) : null}

      {step === 'games' ? (
        <OnboardingGamesStep
          competitions={offers}
          draft={draft}
          onToggleGame={(key, game) => setDraft((current) => toggleGame(current, key, game))}
          onApplyToAll={(games) => setDraft((current) => applyGamesToAll(current, games))}
        />
      ) : null}

      {step === 'review' ? (
        <OnboardingReviewStep
          competitions={offers}
          teams={[]}
          draft={draft}
          onFinish={() => void finish()}
          finishing={finishing}
        />
      ) : null}

      {finishError ? (
        <Alert variant="error" title="Setup did not finish">
          {finishError}
        </Alert>
      ) : null}

      {partialFailures.length > 0 ? (
        // Named, not summarised. "Some things did not save" leaves a player with
        // no idea what to check; a list tells them exactly what to do again.
        <Alert variant="warning" title="Some of your choices did not save">
          <p>These did not go through: {partialFailures.join('; ')}.</p>
          <p>Everything else was saved. You can set these up again at any time.</p>
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={onFinished}>
              Continue to your Hub
            </Button>
          </div>
        </Alert>
      ) : null}

      <nav className={styles.journeyNav} aria-label="Setup steps">
        {back ? (
          <Button variant="secondary" onClick={() => goTo(back)} disabled={finishing}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {forward ? (
          <Button onClick={() => goTo(forward)}>
            {/* "Skip" rather than "Next" wherever the step is genuinely
                optional and the player has answered nothing, so skipping is a
                visible, offered choice rather than a thing you work out. */}
            {stepIsAnswered(step, draft) ? 'Continue' : 'Skip for now'}
          </Button>
        ) : null}
      </nav>
    </div>
  )
}

/**
 * Whether the player has answered the step in front of them.
 *
 * It changes one word on one button and nothing else. It is not validation:
 * every step may be passed unanswered, which is what makes the optional steps
 * genuinely optional.
 */
function stepIsAnswered(step: OnboardingStep, draft: OnboardingDraft): boolean {
  switch (step) {
    case 'competitions':
      return draft.followed.length > 0
    case 'clubs':
      return draft.followed.some((key) => favouriteFor(draft, key) !== null)
    case 'games':
      return draft.followed.some((key) => gamesFor(draft, key).length > 0)
    case 'review':
      return true
    default:
      return true
  }
}

/**
 * The `game_competition_id` a join is addressed by, for one competition and one
 * game.
 *
 * IT COMES FROM THE MEMBERSHIP READ AND IS NEVER CONSTRUCTED. The catalogue's
 * `HubGame` carries the game's key and presentation; the id belongs to the
 * served row, and a join sent to anything else would be a join to a competition
 * nobody chose. A missing id is reported as a failed game rather than guessed.
 */
function servedCompetitionId(
  player: PlayerCompetitions,
  seasonRowName: string,
  gameKey: CompetitionGameKey,
): string | null {
  const relevance = player.mine.find(
    (entry) => entry.competition.seasonRowName === seasonRowName,
  )
  return relevance?.games.find((game) => game.gameKey === gameKey)?.id ?? null
}

type FavouriteClubsStepProps = {
  competitions: readonly HubCompetition[]
  draft: OnboardingDraft
  onSelect: (key: string, teamId: string | null) => void
}

/**
 * A favourite club, per followed competition.
 *
 * ONE PICKER PER COMPETITION, because that is how the server stores it: the
 * favourite lives on the follow row and must be a club that plays in that
 * competition. A single account-level club would have to belong to one
 * competition or none, and `set_competition_follow` refuses the mismatch
 * outright.
 *
 * FOLLOWING NOTHING IS A REAL ANSWER, and this step says so rather than looking
 * broken. It is the one step that can be empty through no fault of the read.
 */
function FavouriteClubsStep({ competitions, draft, onSelect }: FavouriteClubsStepProps) {
  const [clubs, setClubs] = useState<Record<string, readonly SeasonClub[]>>({})
  const [failed, setFailed] = useState<readonly string[]>([])

  useEffect(() => {
    let active = true
    void (async () => {
      const { fetchSeasonClubs } = await import('../../services/supabase/seasonClubs')
      for (const competition of competitions) {
        try {
          const loaded = await fetchSeasonClubs(competition.tournamentId)
          if (!active) return
          setClubs((current) => ({ ...current, [competition.seasonRowName]: loaded }))
        } catch {
          if (!active) return
          setFailed((current) => [...current, competition.seasonRowName])
        }
      }
    })()
    return () => {
      active = false
    }
  }, [competitions])

  if (competitions.length === 0) {
    return (
      <section className={styles.step}>
        <h2 className={styles.stepTitle}>Favourite club</h2>
        <p className={styles.stepLead}>
          You have not followed a competition yet, so there are no clubs to choose from. Go back a
          step, or carry on — a favourite club can be set at any time from your account.
        </p>
      </section>
    )
  }

  return (
    <section className={styles.step}>
      <h2 className={styles.stepTitle}>Favourite club</h2>
      <p className={styles.stepLead}>
        Optional, one per competition, and presentation only — it changes nothing you score, join
        or unlock.
      </p>
      {competitions.map((competition) => {
        const key = competition.seasonRowName
        const loaded = clubs[key]
        if (failed.includes(key)) {
          return (
            <div className={styles.group} key={key}>
              <h3 className={styles.groupTitle}>{competition.name}</h3>
              <p className={styles.none}>We couldn’t load this competition’s clubs.</p>
            </div>
          )
        }
        return (
          <div className={styles.group} key={key}>
            <h3 className={styles.groupTitle}>{competition.name}</h3>
            {!loaded ? (
              <Skeleton lines={2} />
            ) : (
              <OnboardingFavouriteStep
                teams={loaded.map((club) => ({
                  teamId: club.teamId,
                  name: club.name,
                  tokens: club.tokens,
                }))}
                selectedTeamId={favouriteFor(draft, key)}
                onSelect={(teamId) => onSelect(key, teamId)}
              />
            )}
          </div>
        )
      })}
    </section>
  )
}
