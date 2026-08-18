import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  PlayerProfileSource,
  PlayerProfileTarget,
  ProfileRead,
  RankHistoryRead,
  RivalryRead,
} from './playerProfileSource'

/**
 * ACQUIRE WHAT A vNEXT PLAYER PROFILE NEEDS, through the reads that own it.
 *
 * This hook fetches and CLASSIFIES, and nothing else. `buildPlayerProfileModel`
 * is the only thing that turns an answer into something a page can draw, which
 * is what makes every mapping case testable with no Supabase, no auth and no
 * network.
 *
 * ============================ THREE READS, ALWAYS THREE ==================
 *
 * Contract 151 for the season, and contract 192 twice for the positions and the
 * comparison. They go out CONCURRENTLY because none of them addresses the
 * others, and the page costs three calls whatever the season's length — the
 * bound Stage 10's predicate requires. Nothing here loops over matchweeks,
 * fixtures or rows.
 *
 * ============================ EACH READ FAILS, AND REFUSES, ALONE ========
 *
 * ONLY THE PLAY CONTEXT CAN FAIL THE WHOLE PAGE, because without it there is no
 * competition name and no id to address anything with. Everything after it
 * resolves to its own outcome, and the three panels are drawn from three of
 * them. That is not defensiveness — it is the ONLY way to draw the real state
 * where the profile is refused for want of a shared private league and the two
 * contract-192 reads answer anyway, which is a state the server produces.
 *
 * ============================ A REFUSAL IS NOT A FAILURE =================
 *
 * The three classifiers below are the whole point of this file. A refusal will
 * answer identically every time, so it must never reach a retry; a fault might
 * not, so it must. Getting this backwards produces a button that spends a press
 * proving a permission has not changed, or a page that reports a transient
 * network fault as a privacy boundary.
 *
 * ============================ A PAYLOAD BELONGS TO ITS REQUEST ===========
 *
 * Everything here is somebody's private standing. The identity that addressed
 * the reads travels WITH the payload, and a payload whose identity no longer
 * matches is not a payload — it is loading. Without that, one render composes
 * the previous player's season with the current player's name, and one render
 * is enough to paint. Every write below is behind the same `active` guard, so
 * a superseded request cannot store state under an identity that has moved on.
 */

export type VNextPlayerProfileSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noCompetition' }
  | { status: 'noPlayer' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready'
      source: PlayerProfileSource
      retry: () => void
      /**
       * A RETRY IS IN FLIGHT OVER THE PAYLOAD ON SCREEN.
       *
       * Keeping the page mounted across a retry removed the only signal a
       * reader had that the press did anything: there was no longer a `loading`
       * render, so no skeleton, no `aria-busy`, and — because the `role=status`
       * text never changed — no announcement either, on press OR on a second
       * failure. This flag is what a surface uses to say "trying" without
       * throwing the page away to do it.
       */
      refreshing: boolean
    }

export type VNextPlayerProfileSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  /** The account id the profile is addressed by. */
  readonly playerId: string | undefined
  /**
   * Contract 191's season-scoped entry reference, which addresses BOTH
   * contract-192 reads. Null where the doorway had none — a gap in what this
   * build was handed, and not a refusal.
   */
  readonly playerRef: string | null
  /*
   * THERE IS NO `displayName` INPUT, AND THAT IS A PROPERTY RATHER THAN AN
   * OMISSION. Stage 9's doorway emits two identifiers and no name, so nothing
   * routing here has one to pass — and the page is named by whichever read
   * answered. No caller, route or query string decides what a player is called.
   */
  /** The game's own name, as the host states it. */
  readonly gameName: string
}

type RequestIdentity = string

function requestIdentity(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
  playerId: string
  playerRef: string | null
  gameName: string
}): RequestIdentity {
  // EVERYTHING THE STORED PAYLOAD DESCRIBES, not only what addresses a read.
  // Both identifiers are here because they address different reads and a
  // payload gathered under one pair answers a different question from one
  // gathered under another. `gameName` addresses nothing — but it is carried
  // into the payload's context and drawn in the header, so a payload built
  // under one game does not describe another. Leaving it out was survivable
  // only while the page cleared on every effect run; now that a same-identity
  // payload is KEPT, omitting it would render the previous game's name over the
  // new game's reads until they landed.
  return JSON.stringify([
    input.userId,
    input.competitionSlug,
    input.seasonSlug,
    input.playerId,
    input.playerRef,
    input.gameName,
  ])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | { status: 'loaded'; identity: RequestIdentity; payload: PlayerProfileSource }

const IDLE: InternalState = { status: 'idle' }

export function useVNextPlayerProfileSource(
  input: VNextPlayerProfileSourceInput,
): VNextPlayerProfileSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)

  /**
   * THE IDENTITY OF THE PAYLOAD CURRENTLY IN STATE, READABLE FROM THE EFFECT.
   *
   * A ref rather than the state itself, for two reasons. Reading `state` in the
   * effect would mean listing it as a dependency, and the effect writes it — a
   * loop. And a functional `setState` updater cannot answer the question
   * either: React invokes it during the RENDER phase, not at the call site, so
   * a flag assigned inside one is still false by the time the effect reads it.
   * That is not a hypothetical — it is what the first version of this did.
   */
  const loadedIdentity = useRef<RequestIdentity | null>(null)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const {
    userId,
    authLoading,
    competitionSlug,
    seasonSlug,
    playerId,
    playerRef,
    gameName,
  } = input

  useEffect(() => {
    if (authLoading || !userId || !competitionSlug || !seasonSlug || !playerId) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({
      userId,
      competitionSlug,
      seasonSlug,
      playerId,
      playerRef,
      gameName,
    })

    let active = true

    /*
     * A RETRY MUST NOT UNMOUNT THE PAGE, AND A NEW PLAYER MUST.
     *
     * This surface is the first with THREE independent in-page retries, and
     * clearing state on every effect run made each of them take the whole page
     * down: the memo reads `idle` as `loading`, the screen swaps in the
     * skeleton, and the two panels that succeeded — plus the `role="status"`
     * the reader just heard, plus the button they are standing on — are
     * unmounted, dropping keyboard focus to the body. That is precisely the
     * outcome `Unavailable`'s live-region shape was chosen to avoid.
     *
     * So a LOADED payload for the identity being asked about again is kept
     * while the reads run; anything else is cleared.
     *
     * WHAT KEEPS ANOTHER PLAYER'S PAYLOAD OFF THE SCREEN IS THE MEMO, not this
     * write. The memo reads any stored identity that is not the current one as
     * `loading`, so a stale payload is unrenderable whatever this does.
     * Clearing here is still worth doing — it stops the hook HOLDING somebody
     * else's private standing in memory after the reader has moved on — but the
     * guard a reviewer should check is the identity comparison below.
     */
    // Only a KEPT payload needs an in-flight flag. Where the page cleared, the
    // skeleton is already saying it.
    const kept = loadedIdentity.current === identity
    if (!kept) loadedIdentity.current = null
    setState((current) => {
      if (current.status === 'idle') return current
      if (current.status === 'loaded' && current.identity === identity) return current
      return IDLE
    })
    setRefreshing(kept)

    void (async () => {
      try {
        const { createSeasonPlayContextGateway } = await import(
          '../../../services/supabase/seasonPlayContext'
        )

        // WAVE ONE. Every read below is addressed by the id this returns, and
        // it is the only thing whose failure is the page's failure.
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
        if (!active) return

        const isYou = playerId === userId

        // WAVE TWO. Three reads, concurrently, each classified on its own.
        const [profile, rankHistory, rivalry] = await Promise.all([
          readProfile(context.tournamentId, playerId),
          readRankHistory(context.tournamentId, playerRef),
          readRivalry(context.tournamentId, playerRef, isYou),
        ])
        if (!active) return

        const target: PlayerProfileTarget = { playerId, ref: playerRef, isYou }
        loadedIdentity.current = identity
        setRefreshing(false)

        setState({
          status: 'loaded',
          identity,
          payload: {
            // The one legitimate clock read on this path, stamped once here and
            // passed down as data so the mapper stays pure.
            generatedAt: new Date().toISOString(),
            context: {
              tournamentId: context.tournamentId,
              competitionName: context.competitionName,
              seasonLabel: context.seasonLabel,
              gameName,
            },
            target,
            profile,
            rankHistory,
            rivalry,
          },
        })
      } catch {
        if (!active) return
        loadedIdentity.current = null
        setRefreshing(false)
        setState({ status: 'failed', identity })
      }
    })()

    return () => {
      active = false
      setRefreshing(false)
    }
  }, [
    authLoading,
    userId,
    competitionSlug,
    seasonSlug,
    playerId,
    playerRef,
    gameName,
    nonce,
  ])

  /**
   * DERIVED FROM THE CURRENT INPUTS, IN THIS ORDER, and the order is the safety
   * property: auth, then the user, then the competition, then the player are
   * answered from what is true THIS RENDER. Only then does stored state get a
   * say, and only if its identity is the one being asked about now.
   */
  return useMemo<VNextPlayerProfileSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }
    if (!playerId) return { status: 'noPlayer' }

    const identity = requestIdentity({
      userId,
      competitionSlug,
      seasonSlug,
      playerId,
      playerRef,
      gameName,
    })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }

    return { status: 'ready', source: state.payload, retry, refreshing }
  }, [
    state,
    refreshing,
    authLoading,
    userId,
    competitionSlug,
    seasonSlug,
    playerId,
    playerRef,
    // Listed because `requestIdentity` now reads it. Without this the memo
    // compares against an identity built from a stale game name and reads a
    // current payload as loading.
    gameName,
    retry,
  ])
}

/**
 * CONTRACT 151, CLASSIFIED BY THE PREDICATE THAT LIVES BESIDE THE READ.
 *
 * `seasonProfileRefused` is exported from the service module rather than
 * written here, so the vNext page and the production season route tell a
 * privacy boundary from a fault by the same rule.
 */
async function readProfile(tournamentId: string, playerId: string): Promise<ProfileRead> {
  const services = await import('../../../services/supabase/seasonPlayerProfile')
  try {
    return { kind: 'ok', profile: await services.fetchSeasonPlayerProfile(tournamentId, playerId) }
  } catch (error) {
    return services.seasonProfileRefused(error) ? { kind: 'refused' } : { kind: 'failed' }
  }
}

async function readRankHistory(
  tournamentId: string,
  playerRef: string | null,
): Promise<RankHistoryRead> {
  // NOT A REFUSAL AND NOT A FAULT. The read is addressed by contract 191's
  // entry reference; with none there is nothing to ask, and calling with the
  // account id instead would be substituting one identifier for another.
  if (playerRef === null) return { kind: 'unaddressable' }

  const services = await import('../../../services/supabase/seasonRankHistory')
  try {
    return {
      kind: 'ok',
      history: await services.fetchSeasonRankHistory(tournamentId, playerRef),
    }
  } catch (error) {
    // `instanceof` AGAINST THE MODULE'S OWN CLASSES, which is what
    // `SeasonHeadToHead.tsx` does with contract 129's two refusals. Matching on
    // `error.name` instead would pass for any error that happened to carry the
    // same string, and a refusal is the one classification that must not be
    // reachable by coincidence.
    //
    // THIS READ REFUSES IN TWO WAYS TOO. A reference that names nobody in the
    // season is about THEM, not about permission — the same distinction the
    // rivalry makes, and it is reachable here by exactly the same stale link.
    if (error instanceof services.RankHistoryNotPermittedError) return { kind: 'refused' }
    if (error instanceof services.OpponentNotEnteredError) return { kind: 'not-entered' }
    return { kind: 'failed' }
  }
}

async function readRivalry(
  tournamentId: string,
  playerRef: string | null,
  isYou: boolean,
): Promise<RivalryRead> {
  // NOT ASKED AT ALL. The RPC refuses a self-comparison in terms and the answer
  // would render one column twice, so the state is decided here rather than
  // spent on a call whose only possible reply is an error.
  if (isYou) return { kind: 'self' }
  if (playerRef === null) return { kind: 'unaddressable' }

  const services = await import('../../../services/supabase/seasonRivalry')
  try {
    return { kind: 'ok', rivalry: await services.fetchSeasonRivalry(tournamentId, playerRef) }
  } catch (error) {
    if (error instanceof services.RivalryNotPermittedError) return { kind: 'refused' }
    if (error instanceof services.OpponentNotEnteredError) return { kind: 'not-entered' }
    return { kind: 'failed' }
  }
}
