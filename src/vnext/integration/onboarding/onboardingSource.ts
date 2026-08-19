import {
  catalogueFromPublishedSeasons,
  type HubCompetition,
} from '../../../features/hub/competitionCatalogue'
import { presentPlayerCompetitions } from '../../../features/hub/playerCompetitions'
import { draftFromPreferences, resumeStep } from '../../../features/onboarding/onboardingResume'
import type { OnboardingDraft } from '../../../features/onboarding/onboardingDraft'
import type { OnboardingStep } from '../../../features/onboarding/onboardingResume'

/**
 * WHAT ONBOARDING NEEDS BEFORE IT CAN ASK ANYTHING.
 *
 * ============================ THREE READS, AND A RESUME =================
 *
 *   contract 147  published seasons   what there is to follow
 *   `fetchHubMembership`              what the player is already in
 *   contract 157  preferences         where they stopped, and what they chose
 *
 * The first two are the same pair the production journey issues, through the
 * same two functions, folded together by the same `catalogueFromPublishedSeasons`
 * and `presentPlayerCompetitions`. Nothing here re-derives a catalogue.
 *
 * ============================ THE ORDER IS A DEPENDENCY, NOT A HABIT ====
 *
 * `fetchHubMembership` takes the season names contract 147 returned, so it
 * cannot be issued until 147 has answered. Preferences can, and is issued
 * beside it. Nothing else is serialised.
 *
 * ============================ PREFERENCES FAILING IS NOT A FAILED PAGE ==
 *
 * A player whose preferences do not answer still has a catalogue to choose
 * from; they simply start at step one with nothing pre-selected, which is
 * exactly what a brand-new player sees and is the correct fallback for someone
 * whose stored progress could not be read. Only the catalogue is load-bearing.
 *
 * ============================ AND IT WRITES NOTHING =====================
 *
 * No progress stamp, no follows, no game entries. See `models/onboarding.ts`:
 * the commit order lives in `OnboardingJourney` and this lane does not keep a
 * second copy of it. This module reads.
 */

export type OnboardingReadResult = {
  readonly catalogue: readonly HubCompetition[]
  readonly draft: OnboardingDraft
  readonly step: OnboardingStep
}

export type OnboardingReads = {
  readonly fetchPublishedWeeklySeasons: typeof import('../../../services/supabase/weeklyCatalogue').fetchPublishedWeeklySeasons
  readonly fetchHubMembership: typeof import('../../../services/supabase/competitionGames').fetchHubMembership
  readonly fetchPlayerPreferences: typeof import('../../../services/supabase/playerPreferences').fetchPlayerPreferences
}

export async function readOnboarding(reads: OnboardingReads): Promise<OnboardingReadResult> {
  const published = await reads.fetchPublishedWeeklySeasons()

  const [seasons, preferences] = await Promise.all([
    reads.fetchHubMembership(published.map((season) => season.seasonName)),
    // A CATCH ON THIS PROMISE ALONE. See the header — losing the resume is a
    // player starting at step one, and losing the catalogue is no page at all.
    reads.fetchPlayerPreferences().catch(() => null),
  ])

  const catalogue = catalogueFromPublishedSeasons(published, seasons)
  // Memberships are folded in here so an already-joined game is a server fact
  // on the offer rather than something the steps have to look up again.
  const player = presentPlayerCompetitions(catalogue, seasons, {
    ...(preferences ? { preferences } : {}),
  })

  return {
    catalogue: player.catalogue,
    draft: draftFromPreferences(preferences, player.catalogue),
    step: resumeStep(preferences),
  }
}
