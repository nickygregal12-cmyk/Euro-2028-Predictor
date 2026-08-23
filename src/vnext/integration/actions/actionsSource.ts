import type { PlayerActionsFeed } from '../../../services/supabase/playerActions'

/**
 * WHAT THE REAL APPLICATION HANDS THE vNEXT ACTION CENTRE.
 *
 * ============================ ONE READ, AND IT IS BOUNDED ================
 *
 * `get_my_actions` (contract 162, granted to `authenticated`) returns at most
 * fifty rows with the caller's own seen and dismissed state joined on, ordered
 * by the server's own priority. It is a single round trip whatever the player's
 * competition count, which is the difference between it and the cross-competition
 * inbox the shell's attention layer is built from — that one costs a play-context
 * read plus up to three game reads PER COMPETITION.
 *
 * BOTH STILL EXIST, ON PURPOSE. They answer different questions and this file
 * replaces neither: the attention layer answers "what needs doing somewhere you
 * are not looking", live; this answers "what has the server recorded for you,
 * and have you seen it", durably. Collapsing the two would mean either losing
 * the durable half or asserting urgency the action feed does not state.
 *
 * ============================ THE NAMES COME FROM ELSEWHERE ==============
 *
 * The feed identifies a competition by `tournament_id` and carries NO name —
 * correctly, because a name is a caption and this is an identity. The player's
 * own competition list already holds both, and `usePlayerCompetitions` is
 * mounted once above the pages, so the mapper is handed that list rather than
 * issuing a second read for it.
 *
 * A tournament id the list does not cover resolves to a `null` name. That is a
 * REAL STATE — a competition the player has an action in and no membership row
 * for — and the surface says so rather than dropping the row or inventing a
 * label.
 */

/** One competition the player is relevant to, as the application already knows it. */
export type ActionsSourceCompetition = {
  /** The season row id the feed's `tournament_id` is joined to. */
  readonly tournamentId: string
  readonly name: string
}

export type ActionsSource = {
  /**
   * The server's feed, or `null` where it has not landed.
   *
   * `null` IS NOT AN EMPTY FEED. An empty one is the claim "nothing is waiting
   * for you", which is exactly the claim a player must not be given while the
   * read is still out — the same rule the shell's attention layer is written
   * under.
   */
  readonly feed: PlayerActionsFeed | null
  /** The player's competitions, for their names. Empty is ordinary. */
  readonly competitions: readonly ActionsSourceCompetition[]
}
