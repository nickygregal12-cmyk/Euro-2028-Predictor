import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'

/**
 * The choices a player makes during first sign-in, before anything is saved.
 *
 * IT IS A DRAFT AND SAYS SO IN ITS NAME. Nothing in the repository can persist
 * a followed competition, a favourite team or onboarding progress — the audit
 * is `MIG-UI-10` — so this models the choices in memory and the components
 * built on it are deliberately not wired into the live first-sign-in journey.
 * A flow that collected these and lost them on refresh would be worse than no
 * flow: it would look finished.
 *
 * FOLLOW, JOIN GAME AND FAVOURITE ARE THREE FIELDS, NOT ONE. The scalability
 * contract makes that binding, and the shape here enforces it: `followed` is a
 * set of competitions, `games` is a per-competition set of game keys, and
 * `favouriteTeamId` is a single optional id. Selecting a competition adds
 * NOTHING to `games` — the direction's "nothing is silently selected" is a
 * property of this model rather than a promise made by a component.
 *
 * GAME CHOICES SURVIVE UNFOLLOWING AND RETURN WITH IT. A player who
 * unfollows a competition and changes their mind should not have to re-pick
 * their games; the draft keeps the entry and the review only reads games for
 * competitions currently followed. Nothing is submitted for an unfollowed
 * competition.
 *
 * PURE. No storage, no clock, no network. Every function returns a new draft.
 */

export type OnboardingDraft = {
  /** Competition keys the player has chosen to follow. Order is selection order. */
  followed: readonly string[]
  /** Game choices per competition key. Present only where the player has chosen. */
  games: Readonly<Record<string, readonly CompetitionGameKey[]>>
  /** Canonical team id, or null. Optional by design and skippable. */
  favouriteTeamId: string | null
}

export const EMPTY_DRAFT: OnboardingDraft = {
  followed: [],
  games: {},
  favouriteTeamId: null,
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

export function setFavourite(draft: OnboardingDraft, teamId: string | null): OnboardingDraft {
  return { ...draft, favouriteTeamId: teamId }
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
