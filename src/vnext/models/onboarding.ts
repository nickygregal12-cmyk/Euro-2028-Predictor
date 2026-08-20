/**
 * vNEXT ONBOARDING — first sign-in, drawn in the system the player will live in.
 *
 * ============================ WHAT IS OWED, AND WHAT IS NOT =============
 *
 * The route migration matrix marks `/welcome` **REDESIGN**, and states the
 * scope in the row itself: the four-step journey is *"built and routed"*, so
 * REDESIGN here is **vNext presentation over an existing flow, not a flow to be
 * written**. Stage 13's predicate then names the outcome that presentation has
 * to produce:
 *
 *   > new-user onboarding → competition/game entry is coherent
 *
 * Coherent means one visual system from the first screen to the games hub. A
 * cutover that left `/welcome` on the production design would make a new
 * player's VERY FIRST screen the one place vNext does not reach — the same
 * defect as the Account button, at the worse end of the journey.
 *
 * ============================ THE RULES ARE NOT RESTATED HERE ===========
 *
 * Everything this model holds is derived by an existing authority and mapped:
 *
 *   • `onboardingResume.ts` decides WHERE a returning player resumes and what
 *     they had already chosen — from contract 157's stored step and follows;
 *   • `onboardingDraft.ts` owns what a choice DOES to the draft, including the
 *     three separations (follow ≠ join ≠ favourite) the scalability contract
 *     makes binding;
 *   • `competitionCatalogue.ts` decides which competitions and games exist and
 *     which are already joined.
 *
 * This lane adds no fifth opinion about any of them. Where a rule would have to
 * be decided again to render something, the thing is not rendered.
 *
 * ============================ AND THE COMMIT IS NOT WRITTEN HERE ========
 *
 * Finishing onboarding writes follows, then game entries, then completion, and
 * reports which parts failed without abandoning the parts that worked.
 * `features/onboarding/commitOnboarding.ts` already does that, has done it in
 * production since contract 157 — as the body of `OnboardingJourney` until
 * `/welcome` gained a second presentation and it moved out to a module both
 * hosts call — and is the only place in the repository that does.
 *
 * So `VNextOnboarding` does not do it a second time. `finish` is an INTENT
 * carrying the draft, and the host performs it. Writing a parallel commit would
 * be two commit orders for one contract and three chances to disagree about
 * which of follows, entries and completion is allowed to fail.
 *
 * ============================ EVERY STEP AFTER THE FIRST IS SKIPPABLE ===
 *
 * Following nothing, naming no club and joining no game is a COMPLETE outcome.
 * The model therefore has no notion of a step being invalid, and no state in
 * which the player is prevented from moving on. The only thing onboarding
 * insists on is that it happened.
 *
 * PURE. No clock, no storage, no network. The step, the catalogue and the draft
 * go in; what to draw comes out.
 */

/* ==========================================================================
   WHERE THE PLAYER IS
   ========================================================================== */

/**
 * The four steps, in order.
 *
 * DECLARED HERE AND PINNED TO THE AUTHORITY BY A TEST, rather than imported
 * from it. The production boundary forbids a vNext model from reaching into
 * `src/features`, for the good reason that a model importing application code
 * drags the application into every story and fixture that touches it. So the
 * tuple is restated and `tests/vnext/onboarding.test.tsx` asserts it is
 * identical to `ONBOARDING_STEPS` — a build that added a fifth step on one side
 * only fails there rather than shipping two disagreeing step counts.
 *
 * The mapper, which IS allowed to reach the authority, is the only thing that
 * converts between them, and it does so by type identity rather than by cast.
 */
export const ONBOARDING_STEP_ORDER = ['competitions', 'clubs', 'games', 'review'] as const

export type OnboardingStep = (typeof ONBOARDING_STEP_ORDER)[number]

/**
 * THE GAME KEYS THE CATALOGUE USES — `game_definitions`' own identifiers.
 *
 * Restated for the same boundary reason, and deliberately NOT named `GameKey`:
 * `models/ia.ts` has one of those and it is the information architecture's
 * vocabulary, not the database's.
 *
 * PINNED BY THE COMPILER RATHER THAN BY A TEST, which is worth saying because
 * an earlier draft claimed a test did it and none does. Removing a key fails
 * `buildOnboardingModel.ts` where the catalogue's keys are assigned in, and
 * adding one fails `VNextOnboardingScreen.tsx` where the intent is passed to
 * `toggleGame`. `npx tsc -b` is the gate; a mutation here leaves the suite
 * green and the build red.
 */
export type OnboardingGameKey =
  | 'main_predictor'
  | 'last_man_standing'
  | 'predictor_cup'
  | 'original_predictor'
  | 'ko_predictor'

import type { RegistrationOutlook } from './games'

/* ==========================================================================
   WHAT IS ON OFFER
   ========================================================================== */

/**
 * ONE GAME A COMPETITION SERVES, and whether it can be chosen.
 *
 * `refusal` carries the catalogue's `coming-soon` in words, and is stated
 * rather than hidden: "this competition has not opened it yet" and "this
 * platform does not have it" are different facts, and a player who cannot tell
 * them apart keeps looking for the game.
 *
 * `joined` is a server fact, never a draft entry. A game already joined offers
 * no control at all — an unticked box would invite the player to choose
 * something they already have, and a ticked one would make Finish look like it
 * were about to join them twice.
 *
 * AND `entry` IS THE SAME RULE THE GAMES HUB USES, not a second opinion. An
 * earlier draft carried only the catalogue's `coming-soon` flag, so a game
 * whose registration had CLOSED, or that had FINISHED, still got a tick box and
 * a promise that Finish would enter the player into it — which
 * `enter_competition_game` refuses outright. The hub had always refused those;
 * onboarding did not; and two surfaces in one stage disagreeing about one
 * server rule is the failure a shared authority exists to prevent.
 * `registrationOutlookOf` is now that authority for both.
 */
export type OnboardingGameOffer = {
  readonly gameKey: OnboardingGameKey
  readonly name: string
  readonly description: string
  /** How often it asks for something — the catalogue's own presentation. */
  readonly cadence: string
  readonly joined: boolean
  readonly chosen: boolean
  /** Where registration stands. Only `open` may be chosen. */
  readonly entry: RegistrationOutlook
  /** Why it cannot be chosen, in the player's words. Null when it can. */
  readonly refusal: string | null
}

/** One competition on offer, and what the player has decided about it. */
export type OnboardingCompetitionOffer = {
  /** The catalogue's season row name. The draft is keyed on it. */
  readonly key: string
  readonly name: string
  readonly seasonLabel: string
  readonly summary: string
  readonly followed: boolean
  readonly games: readonly OnboardingGameOffer[]
}

/**
 * A club the player may name as their favourite in ONE competition.
 *
 * Per competition, because the server stores the favourite on the follow row
 * and constrains it to a club that plays there: one id across all follows would
 * mean writing an Arsenal preference against the Scottish Premiership, which
 * `set_competition_follow` refuses outright.
 */
type OnboardingClubChoice = {
  readonly teamId: string
  readonly name: string
  readonly chosen: boolean
}

export type OnboardingClubGroup = {
  readonly key: string
  readonly competitionName: string
  /**
   * `null` where the clubs for that competition have not been read. The step
   * says so rather than drawing an empty list, because "no clubs" and "we have
   * not asked yet" are different and only one of them is worth waiting for.
   */
  readonly clubs: readonly OnboardingClubChoice[] | null
}

/* ==========================================================================
   THE STEPS
   ========================================================================== */

export type OnboardingPanel =
  | {
      readonly step: 'competitions'
      /** Everything published, in catalogue order. Selection is not pinned. */
      readonly offers: readonly OnboardingCompetitionOffer[]
      /** Stated on this step because it is the one people misread. */
      readonly note: string
    }
  | {
      readonly step: 'clubs'
      readonly groups: readonly OnboardingClubGroup[]
    }
  | {
      readonly step: 'games'
      /** Only followed competitions. Nothing else has games to choose. */
      readonly offers: readonly OnboardingCompetitionOffer[]
    }
  | {
      readonly step: 'review'
      readonly summary: OnboardingSummary
    }

/**
 * What Finish will actually do, in the player's words and never as a promise
 * that it is already done.
 *
 * The three parts are listed apart because they are three server authorities
 * and one may refuse while the others succeed.
 */
export type OnboardingSummary = {
  readonly follows: readonly string[]
  readonly clubs: readonly { readonly competition: string; readonly club: string }[]
  readonly games: readonly { readonly competition: string; readonly game: string }[]
  /** True when the player chose nothing at all — a valid, complete outcome. */
  readonly empty: boolean
}

/* ==========================================================================
   THE MODEL
   ========================================================================== */

/**
 * WHAT THE COMMIT IS STILL DOING, as a state rather than a boolean pair.
 *
 * `partial` is the one that matters and the one a boolean cannot carry: some
 * follows or entries were refused and the rest went through. Onboarding is
 * over either way — stranding somebody on a setup screen because a game filled
 * up is the worst possible reading of "optional steps do not block entry" — so
 * `partial` names what did not happen and still lets them leave.
 */
export type OnboardingCommit =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working' }
  | { readonly kind: 'partial'; readonly refused: readonly string[] }
  | { readonly kind: 'failed'; readonly message: string }

export type OnboardingModel = {
  readonly greeting: string
  /** Which step, and everything that step needs. */
  readonly panel: OnboardingPanel
  /** 1-based, for "Step 2 of 4". Never a percentage of a player's setup. */
  readonly position: number
  readonly total: number
  readonly back: boolean
  /** The last step commits; every earlier one advances. */
  readonly isLast: boolean
  readonly commit: OnboardingCommit
  readonly generatedAt: string
}

export type OnboardingView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable'; readonly message: string }
  | { readonly kind: 'ready'; readonly model: OnboardingModel }
