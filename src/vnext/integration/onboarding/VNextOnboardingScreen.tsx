import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HubCompetition } from '../../../features/hub/competitionCatalogue'
import {
  EMPTY_DRAFT,
  setFavourite,
  toggleFollowed,
  toggleGame,
  type OnboardingDraft,
} from '../../../features/onboarding/onboardingDraft'
import {
  nextStep,
  previousStep,
  type OnboardingStep,
} from '../../../features/onboarding/onboardingResume'
import type { SeasonClub } from '../../../services/supabase/seasonClubs'
import type { RegistrationOutlook } from '../../models/games'
import { VNextOnboarding, type OnboardingIntent } from '../../onboarding/VNextOnboarding'
import { VNextNotice } from '../../states/VNextStates'
import type { OnboardingCommit } from '../../models/onboarding'
import { buildOnboardingModel } from './buildOnboardingModel'
import { readOnboarding } from './onboardingSource'

/**
 * THE CONNECTED ONBOARDING SURFACE.
 *
 * ============================ IT HOLDS THE DRAFT AND NOTHING ELSE =======
 *
 * Every change to the draft goes through `onboardingDraft.ts`, and every move
 * between steps through `onboardingResume.ts`. This file chooses which of those
 * functions an intent calls and holds the result in state; it decides nothing
 * about what a choice means.
 *
 * ============================ IT WRITES NOTHING =========================
 *
 * Not the progress stamp, not the follows, not the game entries. `finish` is
 * handed to the host with the draft and the catalogue it was made against —
 * see `models/onboarding.ts` for why the commit is not written twice — and the
 * host reports back through `commit`, which is why that is a prop rather than
 * state. A host that supplies no `onFinish` gets a page that draws the whole
 * journey and cannot save it, which is the honest thing for a lane that has not
 * cut over.
 *
 * ============================ CLUBS ARE READ WHEN THEY ARE NEEDED =======
 *
 * The favourite step is the only thing that wants them, one read per followed
 * competition, and following twenty would be twenty reads on arrival for a step
 * most players skip. They are fetched when that step is reached and kept, so
 * stepping back and forward does not re-read them.
 */

type OnboardingFinish = {
  readonly draft: OnboardingDraft
  readonly catalogue: readonly HubCompetition[]
}

export type VNextOnboardingScreenProps = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly displayName?: string | null
  /** What the host's commit is doing. `idle` where there is no host commit. */
  readonly commit?: OnboardingCommit
  readonly onFinish?: ((finish: OnboardingFinish) => void) | undefined
  /** Leave setup, keeping whatever the host already saved. */
  readonly onLeave?: (() => void) | undefined
  /**
   * Which step the player moved to, AND WHICH WAY.
   *
   * The host owns contract 157's progress stamp and this screen only reports
   * the move — but a host that stamped every report would walk a player's
   * stored progress BACKWARDS the moment they pressed Back, and would then
   * resume them there on their next sign-in. `direction` is what lets the host
   * stamp forward moves only, without this screen deciding the host's rule for
   * it.
   */
  readonly onStep?:
    | ((step: OnboardingStep, direction: 'forward' | 'back') => void)
    | undefined
  readonly readClubs?: ((tournamentId: string) => Promise<readonly SeasonClub[]>) | undefined
}

type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready'
      catalogue: readonly HubCompetition[]
      entry: Readonly<Record<string, Readonly<Record<string, RegistrationOutlook>>>>
    }

export function VNextOnboardingScreen(props: VNextOnboardingScreenProps) {
  const { userId, authLoading, onStep } = props
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT)
  const [step, setStep] = useState<OnboardingStep>('competitions')
  const [clubs, setClubs] = useState<Record<string, readonly SeasonClub[]>>({})
  const [attempt, setAttempt] = useState(0)
  const [generatedAt] = useState(() => new Date().toISOString())

  /**
   * MOUNTED, NOT "IS THIS PARTICULAR EFFECT RUN STILL CURRENT".
   *
   * This was a per-run `active` flag, and it lost reads. The club effect marks
   * a competition as asked-for BEFORE it awaits, so a read still in flight when
   * the effect tore down — pressing Back on the club step, or any host that
   * passes an inline `readClubs` and re-renders — had its answer discarded by
   * `if (!active) return` while the key stayed marked. Nothing re-asked, and
   * the step sat on "Loading clubs…" for the rest of the session.
   *
   * A club list is keyed, immutable and idempotent: an answer that arrives
   * after the step changed is still the right answer for that competition, and
   * storing it costs nothing. The only thing that must not happen is a setState
   * after unmount, so that — and only that — is what this guards.
   */
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const requestedClubs = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (authLoading || userId === null) return
    setLoad({ status: 'loading' })
    // THE CLUB LISTS BELONG TO THE PREVIOUS READ, NOT TO THE NEXT ONE. They are
    // keyed on a season row name, which a different account can follow too, so
    // carrying them across a re-read would show one player the lists fetched
    // for another. Cheap to re-read and impossible to reason about otherwise.
    requestedClubs.current = new Set()
    setClubs({})
    void (async () => {
      try {
        const [weekly, games, preferences] = await Promise.all([
          import('../../../services/supabase/weeklyCatalogue'),
          import('../../../services/supabase/competitionGames'),
          import('../../../services/supabase/playerPreferences'),
        ])
        const result = await readOnboarding({
          fetchPublishedWeeklySeasons: weekly.fetchPublishedWeeklySeasons,
          fetchHubMembership: games.fetchHubMembership,
          fetchPlayerPreferences: preferences.fetchPlayerPreferences,
        })
        if (!mounted.current) return
        setLoad({ status: 'ready', catalogue: result.catalogue, entry: result.entry })
        // Resume, rather than restart. Both halves come from the server.
        setDraft(result.draft)
        setStep(result.step)
      } catch {
        if (mounted.current) setLoad({ status: 'failed' })
      }
    })()
  }, [authLoading, userId, attempt])

  const catalogue = load.status === 'ready' ? load.catalogue : []

  const followedIds = useMemo(
    () =>
      catalogue
        .filter((entry) => draft.followed.includes(entry.seasonRowName))
        .map((entry) => ({ key: entry.seasonRowName, tournamentId: entry.tournamentId })),
    [catalogue, draft.followed],
  )

  const readClubs = props.readClubs

  useEffect(() => {
    if (step !== 'clubs') return
    void (async () => {
      const fetchClubs =
        readClubs ??
        (await import('../../../services/supabase/seasonClubs')).fetchSeasonClubs
      for (const entry of followedIds) {
        // Already asked for. Stepping back and forward must not re-read.
        if (requestedClubs.current.has(entry.key)) continue
        requestedClubs.current.add(entry.key)
        try {
          const rows = await fetchClubs(entry.tournamentId)
          if (!mounted.current) return
          setClubs((held) => ({ ...held, [entry.key]: rows }))
        } catch {
          // The step says it could not list them for that competition and the
          // player carries on; a favourite is optional and nothing depends on
          // it. Empty is how the model distinguishes read-and-none from
          // not-read-yet.
          if (!mounted.current) return
          setClubs((held) => ({ ...held, [entry.key]: [] }))
        }
      }
    })()
  }, [step, followedIds, readClubs])

  const goTo = useCallback(
    (target: OnboardingStep, direction: 'forward' | 'back') => {
      setStep(target)
      onStep?.(target, direction)
    },
    [onStep],
  )

  const view = useMemo(
    () =>
      buildOnboardingModel({
        catalogue:
          load.status === 'failed' ? 'failed' : load.status === 'loading' ? null : load.catalogue,
        entry: load.status === 'ready' ? load.entry : {},
        draft,
        step,
        clubs,
        displayName: props.displayName ?? null,
        commit: props.commit ?? { kind: 'idle' },
        generatedAt,
      }),
    [load, draft, step, clubs, props.displayName, props.commit, generatedAt],
  )

  const onIntent = useCallback(
    (intent: OnboardingIntent) => {
      switch (intent.kind) {
        case 'toggle-follow':
          setDraft((held) => toggleFollowed(held, intent.key))
          return
        case 'toggle-game':
          setDraft((held) => toggleGame(held, intent.key, intent.gameKey))
          return
        case 'choose-club':
          setDraft((held) => setFavourite(held, intent.key, intent.teamId))
          return
        case 'back': {
          const target = previousStep(step)
          if (target !== null) goTo(target, 'back')
          return
        }
        case 'continue': {
          const target = nextStep(step)
          if (target !== null) goTo(target, 'forward')
          return
        }
        case 'finish':
          props.onFinish?.({ draft, catalogue })
          return
        case 'retry':
          // THE CLUB READS GO WITH IT. A retry that re-read the catalogue and
          // left a failed club list marked as read would leave "we could not
          // list the clubs" on screen permanently, with a Try again that
          // visibly did nothing about it.
          requestedClubs.current = new Set()
          setClubs({})
          setAttempt((count) => count + 1)
          return
        default:
          props.onLeave?.()
      }
    },
    [step, goTo, draft, catalogue, props],
  )

  // SIGNED OUT IS NOT A FAILED READ. Onboarding is the first thing a new
  // account sees, so there is always an account; saying "we could not load
  // this" to somebody who is simply not signed in would send them looking for a
  // fault that is not there.
  if (authLoading) {
    return (
      <VNextNotice
        destination="none"
        heading="Welcome"
        title="One moment"
        body="Checking who you are signed in as."
      />
    )
  }

  if (userId === null) {
    return (
      <VNextNotice
        destination="none"
        heading="Welcome"
        title="Sign in to set up your account"
        body="Your competitions, your club and your games are saved against an account, so we need to know who you are first."
      />
    )
  }

  return <VNextOnboarding view={view} onIntent={onIntent} />
}
