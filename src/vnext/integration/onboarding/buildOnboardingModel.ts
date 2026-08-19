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
import type { RegistrationOutlook } from '../../models/games'
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
  /**
   * Where registration stands, per competition key and game key, resolved by
   * `registrationOutlookOf` against the SERVER's clock. A competition or a game
   * the read did not carry is absent, and absence fails closed.
   */
  readonly entry: Readonly<Record<string, Readonly<Record<string, RegistrationOutlook>>>>
  readonly displayName: string | null
  readonly commit: OnboardingCommit
  readonly generatedAt: string
}

const NOTE =
  'Following a competition only decides what you see. It does not enter you into any of its games — you choose those next.'

/**
 * WHY A GAME CANNOT BE CHOSEN, in the player's words — or null where it can.
 *
 * THE ORDER MATTERS AND IS THE SERVER'S. `enter_competition_game` checks the
 * game is active, then `completed_at`, then the two registration windows, so a
 * finished game is finished whatever its windows say. The catalogue's own
 * `coming-soon` is checked first because it means the competition has not
 * opened this game at all, which is a fact about the competition rather than
 * about a window.
 */
function refusalOf(
  status: HubCompetition['games'][number]['status'],
  entry: RegistrationOutlook,
): string | null {
  // "Not open yet" and "this platform does not have that game" are different
  // facts, and a player who cannot tell them apart keeps looking for it.
  if (status === 'coming-soon') return 'This competition has not opened this game yet.'
  switch (entry) {
    case 'finished':
      return 'This one has finished for the season.'
    case 'not-open':
      return 'Registration has not opened yet.'
    case 'closed':
      return 'Registration has closed for this season.'
    default:
      return null
  }
}

function gameOffers(
  competition: HubCompetition,
  source: OnboardingSource,
): readonly OnboardingGameOffer[] {
  const chosen = gamesFor(source.draft, competition.seasonRowName)
  const outlooks = source.entry[competition.seasonRowName] ?? {}
  return competition.games.map((game) => {
    // ABSENT MEANS UNREADABLE, AND UNREADABLE FAILS CLOSED. The windows come
    // from the membership read; a game the catalogue lists but that read did not
    // carry cannot be shown as joinable, because the one thing worse than not
    // offering a game is offering one the server will refuse at Finish.
    const entry: RegistrationOutlook = outlooks[game.gameKey] ?? 'not-open'
    const refusal = refusalOf(game.status, entry)
    return {
      gameKey: game.gameKey,
      name: game.name,
      description: game.description,
      cadence: GAME_PRESENTATION[game.gameKey].cadence,
      joined: game.joined,
      // A REFUSED GAME IS NEVER SHOWN AS CHOSEN. The draft can still hold it —
      // a window can close while the player is deciding — and showing a tick
      // beside a sentence saying it cannot be entered is the surface
      // contradicting itself.
      chosen: refusal === null && chosen.includes(game.gameKey),
      entry,
      refusal,
    }
  })
}

function offerOf(
  competition: HubCompetition,
  source: OnboardingSource,
): OnboardingCompetitionOffer {
  return {
    key: competition.seasonRowName,
    name: competition.name,
    seasonLabel: competition.seasonLabel,
    summary: competition.summary,
    followed: source.draft.followed.includes(competition.seasonRowName),
    games: gameOffers(competition, source),
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
      // Already joined, no longer served, or something the server would now
      // refuse: none of those is something Finish will do, so none is listed as
      // something it will. The window can close between choosing and reviewing.
      if (served === undefined || served.joined) continue
      const outlook = source.entry[key]?.[gameKey] ?? 'not-open'
      if (served.status === 'coming-soon' || outlook !== 'open') continue
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
        offers: catalogue.map((entry) => offerOf(entry, source)),
        note: NOTE,
      }
    case 'clubs':
      return { step, groups: clubGroups(followed, source) }
    case 'games':
      return { step, offers: followed.map((entry) => offerOf(entry, source)) }
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
