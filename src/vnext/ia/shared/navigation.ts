import { useCallback, useMemo, useState } from 'react'
import type { GameKey, IaModel } from '../../models/ia'
import { activeContext, contextById } from '../../models/ia'

/**
 * WHERE A CONCEPT CAN SEND THE PLAYER, AND WHAT IT COSTS TO GET BACK.
 *
 * THE THREE CONCEPTS SHARE THIS AND DIFFER ONLY IN THEIR CHROME. That is the
 * whole design of the lab: if each concept brought its own destination set, a
 * reviewer would be comparing three products rather than three navigations, and
 * the concept whose author happened to build the nicest league page would win a
 * question about information architecture.
 *
 * SO THE VARIABLE UNDER TEST IS THE CHROME — what is permanently on screen,
 * what a switch costs, what is one press away and what is three. Everything
 * below the chrome is identical by construction.
 *
 * THE DESTINATIONS ARE NOT ROUTES AND MUST NOT BECOME ONE. `docs/product/`'s
 * route migration matrix is the accounting device for the real address space;
 * this is a mental model. A destination here may correspond to no route
 * (`attention` is a view of things the application already answers) or to
 * several (`people` covers a global table and a private league today).
 */
export type IaDestination =
  | { readonly kind: 'home' }
  /** The cross-competition activity inbox. Concept B's front door. */
  | { readonly kind: 'attention' }
  | { readonly kind: 'matches'; readonly contextId: string }
  /**
   * The competition's game index — every game it runs, and what each is doing.
   *
   * A DESTINATION IN ITS OWN RIGHT, because one of the three concepts makes it
   * one and the other two deliberately do not. If it existed only inside the
   * concept that uses it, the comparison would be unfair in that concept's
   * favour: it would be the only one with a place where Last Man Standing and
   * the Match Predictor sit side by side as peers.
   */
  | { readonly kind: 'games'; readonly contextId: string }
  | { readonly kind: 'game'; readonly contextId: string; readonly game: GameKey }
  /** Every people surface in one context, or across all of them when null. */
  | { readonly kind: 'people'; readonly contextId: string | null }
  | { readonly kind: 'league'; readonly scopeId: string }
  | {
      readonly kind: 'player'
      readonly playerId: string
      /**
       * WHERE THE PLAYER WAS OPENED FROM, CARRIED RATHER THAN REMEMBERED.
       *
       * The brief asks that a player can "return to the league/competition
       * context they came from". Browser history cannot answer that — a deep
       * link may be the first address opened, which is the same reason
       * `weeklyRoutes.logicalWeeklyParent` exists in the production app. So the
       * origin travels WITH the destination and the return is deterministic.
       */
      readonly fromScopeId: string
    }
  | { readonly kind: 'discover' }
  | { readonly kind: 'me' }

export type IaNavigation = {
  readonly model: IaModel
  readonly destination: IaDestination
  readonly contextId: string | null
  /** The context the current destination is about, resolved. */
  readonly context: ReturnType<typeof activeContext>
  readonly go: (destination: IaDestination) => void
  /** Change the football context without changing what the player is doing. */
  readonly switchContext: (contextId: string) => void
  /** The deterministic way out of the current destination. Never history. */
  readonly back: (() => void) | null
  readonly backLabel: string | null
  /** Every destination visited, newest last. The review surface prints it. */
  readonly trail: readonly IaDestination[]
}

/**
 * SWITCHING COMPETITION KEEPS THE PLAYER DOING WHAT THEY WERE DOING, where the
 * new competition can support it.
 *
 * This is the rule the production authority already states for the legacy
 * masthead selector — "preserving the equivalent section across the switch" —
 * and it is the single most consequential behaviour in a
 * context-plus-game architecture. Switching from a competition's Match
 * Predictor to a competition that runs no Match Predictor cannot land on a
 * refusal, so it falls back to that competition's Matches, which every
 * competition has.
 */
function carryAcross(
  destination: IaDestination,
  model: IaModel,
  nextContextId: string,
): IaDestination {
  const next = contextById(model, nextContextId)
  switch (destination.kind) {
    case 'game': {
      const offered = next?.games.find(
        (game) => game.key === destination.game && game.availability !== 'not-offered',
      )
      return offered
        ? { kind: 'game', contextId: nextContextId, game: destination.game }
        : { kind: 'matches', contextId: nextContextId }
    }
    // THE QUEUE SURVIVES A CONTEXT SWITCH. Concept B's whole architecture is
    // that the competition is a filter over the work, so switching it must
    // narrow the queue rather than leave it — landing on a competition's front
    // door would turn the filter into a destination change.
    case 'attention':
      return { kind: 'attention' }
    case 'matches':
      return { kind: 'matches', contextId: nextContextId }
    case 'games':
      return { kind: 'games', contextId: nextContextId }
    case 'people':
      return { kind: 'people', contextId: nextContextId }
    // A league, a player and the discovery catalogue are not "a section of a
    // competition", so there is nothing to carry: the switch lands on the new
    // competition's own front door rather than on a stranger's league table.
    default:
      return { kind: 'home' }
  }
}

function contextOfDestination(
  destination: IaDestination,
  model: IaModel,
  fallback: string | null,
): string | null {
  switch (destination.kind) {
    case 'matches':
    case 'games':
    case 'game':
      return destination.contextId
    case 'people':
      return destination.contextId
    case 'league':
      return model.people.find((scope) => scope.id === destination.scopeId)?.contextId ?? fallback
    case 'player':
      return (
        model.people.find((scope) => scope.id === destination.fromScopeId)?.contextId ?? fallback
      )
    default:
      return fallback
  }
}

/**
 * The deterministic parent of a destination, in the same spirit as the
 * production route tree's own parent map: derived from the destination, never
 * from how the player happened to arrive.
 */
function parentOf(
  destination: IaDestination,
  model: IaModel,
): { readonly to: IaDestination; readonly label: string } | null {
  switch (destination.kind) {
    case 'home':
      return null
    case 'player': {
      const scope = model.people.find((entry) => entry.id === destination.fromScopeId)
      if (!scope) return { to: { kind: 'home' }, label: 'Back' }
      return {
        to:
          scope.kind === 'private-league'
            ? { kind: 'league', scopeId: scope.id }
            : { kind: 'people', contextId: scope.contextId },
        label: `Back to ${scope.title}`,
      }
    }
    case 'league': {
      const scope = model.people.find((entry) => entry.id === destination.scopeId)
      return {
        to: { kind: 'people', contextId: scope?.contextId ?? null },
        label: 'Back to leagues',
      }
    }
    case 'game':
      return {
        to: { kind: 'games', contextId: destination.contextId },
        label: 'Back to games',
      }
    default:
      return { to: { kind: 'home' }, label: 'Back' }
  }
}

/**
 * The shared navigation state.
 *
 * IT IS `useState` AND NOT A ROUTER. vNext has no router and Stage 7.5 is not
 * the stage that adds one — the dependency rule is explicit, and a lab that
 * installed a routing library to compare three navigations would have answered
 * a different question. The trail is kept so the review surface can show what a
 * journey actually cost in presses.
 */
export function useIaNavigation(model: IaModel): IaNavigation {
  const initial = useMemo<IaDestination>(
    () => (model.activeContextId === null ? { kind: 'discover' } : { kind: 'home' }),
    [model.activeContextId],
  )
  const [destination, setDestination] = useState<IaDestination>(initial)
  const [contextId, setContextId] = useState<string | null>(model.activeContextId)
  const [trail, setTrail] = useState<readonly IaDestination[]>([initial])

  const go = useCallback(
    (next: IaDestination) => {
      setDestination(next)
      setTrail((current) => [...current, next])
      setContextId((current) => contextOfDestination(next, model, current))
    },
    [model],
  )

  const switchContext = useCallback(
    (nextContextId: string) => {
      setContextId(nextContextId)
      setDestination((current) => {
        const next = carryAcross(current, model, nextContextId)
        setTrail((entries) => [...entries, next])
        return next
      })
    },
    [model],
  )

  const parent = parentOf(destination, model)

  return {
    model,
    destination,
    contextId,
    context: contextById(model, contextId),
    go,
    switchContext,
    back: parent ? () => go(parent.to) : null,
    backLabel: parent?.label ?? null,
    trail,
  }
}
