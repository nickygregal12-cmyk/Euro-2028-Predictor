import { useEffect, useMemo, useState } from 'react'
import type { MatchPredictorGateway } from '../../../features/season/matchPredictorModel'
import { useSeasonMatchPredictor } from '../../../features/season/useSeasonMatchPredictor'
import type { PredictorActions } from '../../models/predictor'
import type { ShellIntent } from '../../models/shell'
import { VNextConnectedShell } from '../shell/VNextConnectedShell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { VNextMatchPredictor } from '../../predictor/VNextMatchPredictor'
import { buildPredictorModel } from './buildPredictorModel'
import type { PredictorSource } from './predictorSource'
import {
  useVNextPredictorContext,
  type PredictorContextReady,
  type VNextPredictorContextInput,
} from './useVNextPredictorContext'
import { VNextPredictorLoading, VNextPredictorNotice } from './VNextPredictorStates'

/**
 * THE CONNECTED vNEXT MATCH PREDICTOR.
 *
 * Its whole job is to resolve the state, build the model and render the surface.
 * It holds no layout, no zone, no football copy and no presentation decision —
 * everything visible in the ready state belongs to `VNextMatchPredictor`, and this
 * file could not change how the page looks without importing something it does not
 * import.
 *
 * `VNextMatchPredictor({ model, actions })` STAYS USABLE WITHOUT ANY OF THIS,
 * which is the point of the split and the reason a test holds it. Storybook and
 * every focused render test hand the page a model directly.
 *
 * WHY THE STATES ARE A SWITCH AND NOT A `??`. Loading, signed out, no competition,
 * season over and failed are five different sentences and four of them are not
 * errors. Collapsing them would put "something went wrong" in front of a player
 * who is merely signed out, and would offer a retry to a season that has played
 * its last matchweek.
 *
 * WHY THE CARD LIVES IN A CHILD COMPONENT WITH A `key`. `useSeasonMatchPredictor`
 * is the existing authority for loading and saving a matchweek and it is used as
 * it is — it owns optimistic saving, save ordering, conflict classification and
 * reload, and a second implementation here would be exactly the weaker duplicate
 * §28 of the brief warns against. But hooks cannot be called conditionally, and
 * that hook keeps its loaded card in state across a gateway change until the next
 * load resolves. Giving the component that calls it a `key` of the request
 * identity means a change of account, competition or matchweek REMOUNTS it: there
 * is no previous player's card left to compose with the current player's identity,
 * not even for one render. That is Stage 6's rule kept by the means available here
 * rather than by forking a shared hook.
 *
 * WHY IT SUPPLIES A SHELL MODEL — STAGE 7.6. The shell around this page owns the
 * active football context, competition switching, discovery and the four
 * destinations, and the page owns none of them; something on the connected path
 * has to hand the shell the world, and this is the file that knows the
 * competition. It states the ONE competition the play context answered for and
 * nothing else — see `../shell/shellSource.ts` for what the application cannot
 * say yet and why nothing is invented to fill it.
 *
 * THE OUTSTANDING COUNT IS NOT SUPPLIED HERE, and that is deliberate. The card
 * lives one component down, behind `useSeasonMatchPredictor`; hoisting the count
 * up to this level to badge the navigation would mean loading the card twice or
 * lifting a hook that owns optimistic saving. The page itself prints the
 * progress in its own brief, which is where a player entering scores is looking.
 */

export type VNextPredictorScreenProps = VNextPredictorContextInput & {
  /**
   * What the host does with a shell intent. Supplying it is what makes Explore
   * and the account control appear: a host with nowhere to send the player gets
   * no control rather than an inert one.
   */
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function VNextPredictorScreen(props: VNextPredictorScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextPredictorContext(props)
  const createGateway = useGatewayFactory()

  const shell = useMemo(
    () =>
      state.status === 'ready'
        ? buildShellModel({
            competition: {
              tournamentId: state.competition.tournamentId,
              name: state.competition.name,
              seasonLabel: state.competition.seasonLabel,
              // No application read holds a competition palette; the mapper
              // resolves one from the model, and the model is built below this
              // point. The shell falls back to a neutral canvas rather than
              // painting an unknown competition somebody else's colours.
              colours: null,
            },
            playerName: null,
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
          })
        : null,
    [state, props.onShellIntent, elsewhere],
  )

  return shell === null ? (
    <VNextPredictorBody state={state} createGateway={createGateway} />
  ) : (
    <VNextConnectedShell model={shell} onIntent={props.onShellIntent}>
      <VNextPredictorBody state={state} createGateway={createGateway} />
    </VNextConnectedShell>
  )
}

/** The five sentences and the card, unchanged by Stage 7.6. */
function VNextPredictorBody({
  state,
  createGateway,
}: {
  readonly state: ReturnType<typeof useVNextPredictorContext>
  readonly createGateway: GatewayFactory | null
}) {
  switch (state.status) {
    case 'loading':
      return <VNextPredictorLoading />

    case 'signedOut':
      return (
        <VNextPredictorNotice
          title="Sign in to make your predictions"
          body="Your card, your Joker and your points are tied to your account."
        />
      )

    case 'noCompetition':
      return (
        <VNextPredictorNotice
          title="No competition to predict"
          body="Pick a competition and season, and this is where its matchweek card will be."
        />
      )

    case 'seasonOver':
      return (
        <VNextPredictorNotice
          title="This season has no matchweek left to play"
          body={`Every matchweek of ${state.competitionName} ${state.seasonLabel} has passed its lock. Results and standings stay available; there is nothing further to enter.`}
        />
      )

    case 'failed':
      return <VNextPredictorNotice title={state.title} body={state.detail} onRetry={state.retry} />

    default:
      // The gateway factory is imported lazily, so for the first render or two
      // there is nothing to load the card with. That is loading, and saying so is
      // more honest than mounting the card hook against a stub that fails.
      return createGateway === null ? (
        <VNextPredictorLoading />
      ) : (
        <PredictorCard key={state.identity} context={state} createGateway={createGateway} />
      )
  }
}

type GatewayFactory = (options: {
  tournamentId: string
  competitionName: string
  seasonLabel: string
  timeZone: string
  now: () => Date
}) => MatchPredictorGateway

/**
 * The application's own gateway factory, IMPORTED LAZILY.
 *
 * `services/supabase/client` throws at module load without configuration, so
 * importing this at module scope would drag credentials into the module graph of
 * anything that renders a sibling of this file — including Storybook and the
 * deterministic tests. The Home adapter imports Supabase inside its effect for
 * exactly this reason; the same rule, one level up, because a gateway has to exist
 * before the hook that consumes it is mounted.
 */
function useGatewayFactory(): GatewayFactory | null {
  // Wrapped in an object so a function value is never mistaken for the lazy
  // initialiser form of `useState`.
  const [factory, setFactory] = useState<{ create: GatewayFactory } | null>(null)

  useEffect(() => {
    let active = true
    void import('../../../services/supabase/seasonMatchPredictor').then((module) => {
      if (active) setFactory({ create: module.createSeasonMatchPredictorRpcGateway })
    })
    return () => {
      active = false
    }
  }, [])

  return factory?.create ?? null
}

/**
 * The card itself, through the existing hook.
 *
 * EVERY COMMAND GOES OUT THROUGH THAT HOOK AND NOWHERE ELSE. `setPrediction`,
 * `setJoker` and `confirmCard` are `MatchPredictorCommand`'s three cases; `retry`
 * and `reload` are its own recovery controls, and `refreshAfterDeadline` is its
 * save-safe re-read — the one the deadline clock is given, so a timer can never
 * run the destructive recovery path over a write that has not settled. Nothing
 * here decides when that is safe: the hook does, from its own save controller.
 * Nothing here writes to Supabase, and
 * `clearPrediction` is `setPrediction(id, null)` — the application's own way of
 * clearing, because `save_season_prediction` deletes the row on a null home score
 * rather than treating null as an absent argument.
 */
function PredictorCard({
  context,
  createGateway,
}: {
  context: PredictorContextReady
  createGateway: GatewayFactory
}) {
  /**
   * ONE GATEWAY PER CONTEXT, memoised.
   *
   * Rebuilding it every render would restart the hook's load effect every render.
   * The clock it carries is the GATEWAY's own, for the domain's lock resolution —
   * `resolveLockState` needs a `now` and this supplies the input rather than making
   * the decision. It is deliberately not the instant the model is stamped with;
   * that one is read once per model build, below.
   */
  const gateway = useMemo(
    () =>
      createGateway({
        tournamentId: context.competition.tournamentId,
        competitionName: context.competition.name,
        seasonLabel: context.competition.seasonLabel,
        timeZone: context.competition.timeZone,
        now: () => new Date(),
      }),
    [createGateway, context.competition],
  )

  const view = useSeasonMatchPredictor(gateway, context.matchweek)

  const { setPrediction, setJoker, confirmCard, retrySave, reload, refreshAfterDeadline } = view

  const actions: PredictorActions = useMemo(
    () => ({
      setPrediction: (fixtureId, score) => setPrediction(fixtureId, score),
      clearPrediction: (fixtureId) => setPrediction(fixtureId, null),
      setJoker,
      confirmCard,
      retrySave,
      reload,
      refreshAfterDeadline,
    }),
    [setPrediction, setJoker, confirmCard, retrySave, reload, refreshAfterDeadline],
  )

  const model = useMemo(() => {
    if (view.page === null || view.presentation === null) return null

    const source: PredictorSource = {
      // ONE INSTANT FOR THE WHOLE MODEL, stamped where a clock read is legitimate
      // and passed down as data. It is the moment the APPLICATION answered, so the
      // mapper — which reads no clock — bands `lock.urgency` against the same
      // moment the card was resolved at.
      //
      // IT DOES NOT TICK, AND IT SHOULD NOT. Rebuilding the model on a timer to
      // keep a countdown moving would mean re-deriving everything on it, urgency
      // included, from a clock in the browser once a minute. Instead the surface's
      // `useDeadlineClock` anchors a separate DISPLAY instant to this one and
      // advances that, and when it reaches an open card's `lock.at` it calls
      // `reload` below — so a stale card is answered by the authority rather than
      // by arithmetic here.
      generatedAt: new Date().toISOString(),
      competition: {
        name: context.competition.name,
        seasonLabel: context.competition.seasonLabel,
        matchweekCount: context.competition.matchweekCount,
      },
      card: view.page,
      presentation: view.presentation,
      saveStatus: view.saveStatus,
      refusal: view.refusal,
      clubForm: context.clubForm,
      table: context.table,
      consensus: context.consensus,
    }

    return buildPredictorModel(source)
  }, [view.page, view.presentation, view.saveStatus, view.refusal, context])

  if (view.status === 'failed') {
    return (
      <VNextPredictorNotice
        title="This matchweek is unavailable"
        // The gateway's own player-facing message where it has one.
        body={view.loadError ?? 'This matchweek could not be loaded.'}
        onRetry={view.reload}
      />
    )
  }

  // A ready hook with no model is unreachable: the memo builds one for exactly
  // that case. The guard exists so the type narrows without a non-null assertion,
  // which would be the one place this file could lie.
  if (model === null) return <VNextPredictorLoading />

  return <VNextMatchPredictor model={model} actions={actions} />
}
