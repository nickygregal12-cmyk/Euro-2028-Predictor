import {
  GAME_PRESENTATION,
  type HubCompetition,
} from '../../../features/hub/competitionCatalogue'
import {
  favouriteFor,
  gamesFor,
  type OnboardingDraft,
} from '../../../features/onboarding/onboardingDraft'
import {
  ONBOARDING_STEPS,
  previousStep,
} from '../../../features/onboarding/onboardingResume'
import type { SeasonClub } from '../../../services/supabase/seasonClubs'
import type {
  OnboardingClubGroup,
  OnboardingStep,
  OnboardingCommit,
  OnboardingCompetitionOffer,
  OnboardingGameOffer,
  OnboardingPanel,
  OnboardingSummary,
  OnboardingView,
} from '../../models/onboarding'

/**
 * THE ONBOARDING MAPPER.
 *
 * Catalogue, draft and step in; what to draw out. It decides nothing the
 * existing onboarding authorities already decide — see `models/onboarding.ts`
 * for the four it defers to and why.
 *
 * ============================ THE THREE CHOICES STAY SEPARATE ===========
 *
 * `followed`, `games` and `favourites` are read from the draft through that
 * module's own accessors, never by indexing its record fields here. Following a
 * competition adds NOTHING to `games`, and the review step reads the game and
 * club choices only for competitions currently followed — both are properties
 * of `onboardingDraft.ts`, and re-deriving either here is how they would drift.
 *
 * ============================ A GAME ALREADY JOINED IS NOT A CHOICE =====
 *
 * `joined` comes from the membership read. Such a game is drawn as a fact and
 * carries no control, and it is never listed in the review's `games` — Finish
 * is not about to join it again.
 *
 * PURE.
 */

export type OnboardingSource = {
  /**
   * The published catalogue with the player's memberships already folded in,
   * exactly as `presentPlayerCompetitions` produces it. `null` while the reads
   * are outstanding; `'failed'` when they did not answer.
   */
  readonly catalogue: readonly HubCompetition[] | null | 'failed'
  readonly draft: OnboardingDraft
  readonly step: OnboardingStep
  /**
   * Clubs per competition key, for the favourite step. A key that is absent has
   * not been read; the step says so rather than drawing an empty list.
   */
  readonly clubs: Readonly<Record<string, readonly SeasonClub[]>>
  readonly displayName: string | null
  readonly commit: OnboardingCommit
  readonly generatedAt: string
}

const NOTE =
  'Following a competition only decides what you see. It does not enter you into any of its games — you choose those next.'

function gameOffers(
  competition: HubCompetition,
  draft: OnboardingDraft,
): readonly OnboardingGameOffer[] {
  const chosen = gamesFor(draft, competition.seasonRowName)
  return competition.games.map((game) => ({
    gameKey: game.gameKey,
    name: game.name,
    description: game.description,
    cadence: GAME_PRESENTATION[game.gameKey].cadence,
    joined: game.joined,
    chosen: chosen.includes(game.gameKey),
    refusal:
      game.status === 'coming-soon'
        ? 'This competition has not opened this game yet.'
        : null,
  }))
}

function offerOf(
  competition: HubCompetition,
  draft: OnboardingDraft,
): OnboardingCompetitionOffer {
  return {
    key: competition.seasonRowName,
    name: competition.name,
    seasonLabel: competition.seasonLabel,
    summary: competition.summary,
    followed: draft.followed.includes(competition.seasonRowName),
    games: gameOffers(competition, draft),
  }
}

function clubGroups(
  followed: readonly HubCompetition[],
  source: OnboardingSource,
): readonly OnboardingClubGroup[] {
  return followed.map((competition) => {
    const key = competition.seasonRowName
    const read = source.clubs[key]
    const picked = favouriteFor(source.draft, key)
    return {
      key,
      competitionName: competition.name,
      clubs:
        read === undefined
          ? null
          : read.map((club) => ({
              teamId: club.teamId,
              name: club.name,
              chosen: club.teamId === picked,
            })),
    }
  })
}

function summaryOf(
  followed: readonly HubCompetition[],
  source: OnboardingSource,
): OnboardingSummary {
  const draft = source.draft
  const follows = followed.map((competition) => competition.name)

  const clubs: { competition: string; club: string }[] = []
  const games: { competition: string; game: string }[] = []

  for (const competition of followed) {
    const key = competition.seasonRowName

    // THE CLUB IS NAMED FROM THE READ THAT OFFERED IT, OR NOT NAMED AT ALL.
    // The draft stores a team id, and the only thing that turns an id into a
    // name is the club list the favourite step was drawn from. Where that list
    // is not in hand the review says a club was chosen and stops: an id shown
    // to a player is not a name, and a guessed name is worse than neither.
    const favourite = favouriteFor(draft, key)
    if (favourite !== null) {
      const named = source.clubs[key]?.find((club) => club.teamId === favourite)
      clubs.push({
        competition: competition.name,
        club: named?.name ?? 'The club you chose',
      })
    }

    for (const gameKey of gamesFor(draft, key)) {
      const served = competition.games.find((game) => game.gameKey === gameKey)
      // Already joined, or no longer served: neither is something Finish will
      // do, so neither is listed as something it will.
      if (served === undefined || served.joined) continue
      games.push({ competition: competition.name, game: served.name })
    }
  }

  return {
    follows,
    clubs,
    games,
    empty: follows.length === 0 && clubs.length === 0 && games.length === 0,
  }
}

function panelOf(
  step: OnboardingStep,
  catalogue: readonly HubCompetition[],
  source: OnboardingSource,
): OnboardingPanel {
  const followed = catalogue.filter((entry) =>
    source.draft.followed.includes(entry.seasonRowName),
  )

  switch (step) {
    case 'competitions':
      return {
        step,
        offers: catalogue.map((entry) => offerOf(entry, source.draft)),
        note: NOTE,
      }
    case 'clubs':
      return { step, groups: clubGroups(followed, source) }
    case 'games':
      return { step, offers: followed.map((entry) => offerOf(entry, source.draft)) }
    default:
      return { step: 'review', summary: summaryOf(followed, source) }
  }
}

export function buildOnboardingModel(source: OnboardingSource): OnboardingView {
  if (source.catalogue === 'failed') {
    return {
      kind: 'unavailable',
      message:
        'We could not load the competitions to choose from. Your account is fine — this is our end.',
    }
  }
  if (source.catalogue === null) return { kind: 'loading' }

  const index = ONBOARDING_STEPS.indexOf(source.step)

  return {
    kind: 'ready',
    model: {
      // A name if the account has one. Not a placeholder standing in for one:
      // "Welcome, there" reads worse than a welcome that simply does not use a
      // name it was never given.
      greeting:
        source.displayName === null || source.displayName.length === 0
          ? 'Welcome'
          : `Welcome, ${source.displayName}`,
      panel: panelOf(source.step, source.catalogue, source),
      position: index + 1,
      total: ONBOARDING_STEPS.length,
      back: previousStep(source.step) !== null,
      isLast: index === ONBOARDING_STEPS.length - 1,
      commit: source.commit,
      generatedAt: source.generatedAt,
    },
  }
}
