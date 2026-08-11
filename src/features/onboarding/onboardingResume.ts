import type { PlayerPreferences } from '../../services/supabase/playerPreferencesModel'
import type { HubCompetition } from '../hub/competitionCatalogue'
import { EMPTY_DRAFT, type OnboardingDraft } from './onboardingDraft'

/**
 * Turning what the server already holds back into a draft, so a half-finished
 * onboarding resumes where it stopped.
 *
 * THIS IS THE HALF THAT MAKES PERSISTENCE WORTH ANYTHING. Writing progress and
 * then starting from step one on the next sign-in would be strictly worse than
 * not writing it: the player would answer the same questions again and wonder
 * why. Contract 157 stores the step AND the follows, so both come back.
 *
 * GAME MEMBERSHIPS ARE NOT RESUMED INTO THE DRAFT, deliberately. A game the
 * player has already joined is a server fact with its own authority, not a
 * pending choice; re-offering it as an unticked box would invite them to
 * "choose" something they already have, and re-offering it as a ticked box
 * would make Finish look like it was about to join them again. The games step
 * shows what is already joined from the membership model instead.
 *
 * THE STEP IS VALIDATED, NOT TRUSTED. `onboarding_step` is free text on the
 * server — it takes whatever a client sent — so an unrecognised value resumes
 * at the first step rather than rendering nothing. A build that removed a step
 * must not strand every player who stopped on it.
 *
 * PURE. Preferences and catalogue in, draft and step out.
 */

export const ONBOARDING_STEPS = ['competitions', 'clubs', 'games', 'review'] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

export function isOnboardingStep(value: string | null): value is OnboardingStep {
  return value !== null && (ONBOARDING_STEPS as readonly string[]).includes(value)
}

/** Where to resume. The first step for anyone the server has never seen. */
export function resumeStep(preferences: PlayerPreferences | null): OnboardingStep {
  const step = preferences?.onboarding.step ?? null
  return isOnboardingStep(step) ? step : 'competitions'
}

/**
 * The draft a returning player should see: every competition they already
 * follow, already selected, with the club they already named.
 *
 * A FOLLOW FOR A COMPETITION THE CATALOGUE DOES NOT CARRY IS DROPPED FROM THE
 * DRAFT AND NOT FROM THE SERVER. It can happen — a season the weekly catalogue
 * stops publishing — and the honest handling is to leave the stored row alone
 * and simply not offer a choice about something that is not on screen. Nothing
 * here deletes a preference.
 */
export function draftFromPreferences(
  preferences: PlayerPreferences | null,
  catalogue: readonly HubCompetition[],
): OnboardingDraft {
  if (!preferences) return EMPTY_DRAFT

  const byTournament = new Map(catalogue.map((entry) => [entry.tournamentId, entry]))
  const followed: string[] = []
  const favourites: Record<string, string | null> = {}

  for (const follow of preferences.follows) {
    const competition = byTournament.get(follow.tournamentId)
    if (!competition) continue
    followed.push(competition.seasonRowName)
    favourites[competition.seasonRowName] = follow.favouriteTeamId
  }

  return { followed, games: {}, favourites }
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step)
  return ONBOARDING_STEPS[index + 1] ?? null
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step)
  return index > 0 ? (ONBOARDING_STEPS[index - 1] ?? null) : null
}
