import {
  catalogueFromPublishedSeasons,
  type HubCompetition,
} from '../../../features/hub/competitionCatalogue'
import {
  presentPlayerCompetitions,
  type PlayerCompetitions,
} from '../../../features/hub/playerCompetitions'
import { draftFromPreferences, resumeStep } from '../../../features/onboarding/onboardingResume'
import type { OnboardingDraft } from '../../../features/onboarding/onboardingDraft'
import type { OnboardingStep } from '../../../features/onboarding/onboardingResume'
import type { HubSeasonMembership } from '../../../services/supabase/competitionGames'
import type { RegistrationOutlook } from '../../models/games'
import { registrationOutlookOf } from '../games/registrationOutlook'

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
 * ============================ THE ENTRY RULE COMES FROM THE SAME READ ===
 *
 * `fetchHubMembership` returns each season's raw game rows, registration
 * windows and all, and `catalogueFromPublishedSeasons` then reduces them to a
 * display catalogue that keeps only `active`. So the catalogue alone cannot say
 * whether a game can still be ENTERED — and an earlier draft of this lane, which
 * had only the catalogue, offered a tick box for a game whose registration had
 * closed. The windows are read here, from the rows that carry them, and mapped
 * by the same `registrationOutlookOf` the games hub uses.
 *
 * ============================ AND IT WRITES NOTHING =====================
 *
 * No progress stamp, no follows, no game entries. See `models/onboarding.ts`:
 * the commit order lives in `features/onboarding/commitOnboarding.ts` and this
 * lane does not keep a second copy of it. This module reads.
 */

export type OnboardingReadResult = {
  readonly catalogue: readonly HubCompetition[]
  /**
   * THE MEMBERSHIP READ ITSELF, NOT ONLY THE CATALOGUE IT REDUCES TO.
   *
   * A game entry is addressed by its `game_competition_id`, and that id belongs
   * to the served membership row — the display catalogue's `HubGame` carries a
   * key and a presentation and no id at all. So a host that has to COMMIT the
   * draft cannot do it from `catalogue`, and re-reading membership at the
   * commit would be a second read of something this one already answered.
   *
   * It is carried rather than committed here: this module still writes nothing.
   * See the header.
   */
  readonly player: PlayerCompetitions
  readonly draft: OnboardingDraft
  readonly step: OnboardingStep
  /** Per season row name, per game key. See the header. */
  readonly entry: Readonly<Record<string, Readonly<Record<string, RegistrationOutlook>>>>
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
    player,
    draft: draftFromPreferences(preferences, player.catalogue),
    step: resumeStep(preferences),
    entry: entryOutlook(seasons),
  }
}

/**
 * WHERE REGISTRATION STANDS FOR EVERY GAME THE READ CARRIED.
 *
 * Keyed on the season's NAME because that is what the catalogue keys on and
 * what the draft keys on; the membership read supplies the same name.
 *
 * A SEASON WHOSE READ CARRIED NO SERVER CLOCK IS OMITTED ENTIRELY, and the
 * mapper's absence rule then fails it closed. Resolving a registration window
 * against a device clock would offer a game that has closed to a player whose
 * laptop is slow — the one failure `serverNow` exists to prevent.
 */
function entryOutlook(
  seasons: readonly HubSeasonMembership[],
): Record<string, Record<string, RegistrationOutlook>> {
  const bySeason: Record<string, Record<string, RegistrationOutlook>> = {}
  for (const season of seasons) {
    const serverNow = season.seasonGames.serverNow
    if (serverNow === null) continue
    const games: Record<string, RegistrationOutlook> = {}
    for (const game of season.seasonGames.games) {
      games[game.gameKey] = registrationOutlookOf(game, serverNow)
    }
    bySeason[season.seasonName] = games
  }
  return bySeason
}
