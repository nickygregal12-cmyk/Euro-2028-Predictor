import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'

/**
 * The choices a player makes during first sign-in, before anything is saved.
 *
 * IT IS STILL A DRAFT, AND IT IS NOW SUBMITTED. Contract 157 (`MIG-UI-10`)
 * supplies the persistence, and `OnboardingJourney` writes this draft through
 * it. The draft remains the in-memory shape for one reason: a player moving
 * between steps must be able to change their mind without each keystroke
 * becoming a server write, and the review step has to be able to show what will
 * happen before it happens.
 *
 * A FAVOURITE IS PER COMPETITION, because the server stores it on the follow
 * row and constrains it to a club that plays in that competition. It was one
 * optional id when nothing could persist it and there was nothing to be wrong
 * about; a single id would now mean writing an Arsenal preference against the
 * Scottish Premiership, which `set_competition_follow` refuses outright.
 *
 * FOLLOW, JOIN GAME AND FAVOURITE ARE THREE FIELDS, NOT ONE. The scalability
 * contract makes that binding, and the shape here enforces it: `followed` is a
 * set of competitions, `games` is a per-competition set of game keys, and
 * `favouriteTeamId` is a single optional id. Selecting a competition adds
 * NOTHING to `games` — the direction's "nothing is silently selected" is a
 * property of this model rather than a promise made by a component.
 *
 * GAME AND FAVOURITE CHOICES SURVIVE UNFOLLOWING AND RETURN WITH IT. A player
 * who unfollows a competition and changes their mind should not have to re-pick
 * their games or their club; the draft keeps both entries and the review only
 * reads them for competitions currently followed. Nothing is submitted for an
 * unfollowed competition.
 *
 * PURE. No storage, no clock, no network. Every function returns a new draft.
 */

export type OnboardingDraft = {
  /** Competition keys the player has chosen to follow. Order is selection order. */
  followed: readonly string[]
  /** Game choices per competition key. Present only where the player has chosen. */
  games: Readonly<Record<string, readonly CompetitionGameKey[]>>
  /**
   * Canonical team id per competition key, where the player named one.
   * Optional by design and skippable, competition by competition.
   */
  favourites: Readonly<Record<string, string | null>>
}

export const EMPTY_DRAFT: OnboardingDraft = {
  followed: [],
  games: {},
  favourites: {},
}

export function toggleFollowed(draft: OnboardingDraft, key: string): OnboardingDraft {
  const following = draft.followed.includes(key)
  return {
    ...draft,
    followed: following
      ? draft.followed.filter((entry) => entry !== key)
      : [...draft.followed, key],
    // `games` is untouched on purpose: unfollowing is not a decision about
    // which games the player wanted, and re-following should not cost them the
    // choice again.
    games: draft.games,
  }
}

export function toggleGame(
  draft: OnboardingDraft,
  key: string,
  game: CompetitionGameKey,
): OnboardingDraft {
  const current = draft.games[key] ?? []
  const chosen = current.includes(game)
  return {
    ...draft,
    games: {
      ...draft.games,
      [key]: chosen ? current.filter((entry) => entry !== game) : [...current, game],
    },
  }
}

/**
 * "Apply these game choices to all selected competitions."
 *
 * IT REPLACES RATHER THAN MERGES, and the interface must say so. Merging would
 * make the control's effect depend on what the player had already picked
 * elsewhere — press it twice with different selections and the result is a
 * union nobody chose. Replacing is the only behaviour a player can predict, and
 * the review step shows the outcome before anything is submitted.
 */
export function applyGamesToAll(
  draft: OnboardingDraft,
  games: readonly CompetitionGameKey[],
): OnboardingDraft {
  const next: Record<string, readonly CompetitionGameKey[]> = { ...draft.games }
  for (const key of draft.followed) next[key] = [...games]
  return { ...draft, games: next }
}

export function setFavourite(
  draft: OnboardingDraft,
  key: string,
  teamId: string | null,
): OnboardingDraft {
  return { ...draft, favourites: { ...draft.favourites, [key]: teamId } }
}

/** The favourite chosen for a competition the player is actually following. */
export function favouriteFor(draft: OnboardingDraft, key: string): string | null {
  return draft.followed.includes(key) ? (draft.favourites[key] ?? null) : null
}

/** The games chosen for a competition the player is actually following. */
export function gamesFor(draft: OnboardingDraft, key: string): readonly CompetitionGameKey[] {
  return draft.followed.includes(key) ? (draft.games[key] ?? []) : []
}

/**
 * Whether every followed competition has at least one game chosen.
 *
 * NOT A VALIDATION RULE. Following a competition without joining a game is a
 * legitimate outcome — that is the whole point of keeping Follow separate — so
 * this exists only so the review step can say what will happen, never to block
 * the player.
 */
export function competitionsWithoutGames(draft: OnboardingDraft): readonly string[] {
  return draft.followed.filter((key) => (draft.games[key] ?? []).length === 0)
}

export function totalGameChoices(draft: OnboardingDraft): number {
  return draft.followed.reduce((total, key) => total + (draft.games[key] ?? []).length, 0)
}
