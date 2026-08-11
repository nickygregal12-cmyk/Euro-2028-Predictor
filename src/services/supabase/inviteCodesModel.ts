import type { CompetitionGameKey } from './competitionGamesModel'

/**
 * What one invite code turns out to be (contract 155, `MIG-UI-07`; widened by
 * contract 158 from six characters to six-to-sixteen).
 *
 * ONE CODE ENTRY POINT, TWO KINDS OF CONTAINER. `resolve_invite_code` reads the
 * single shared namespace contract 152 created, so a code is a league or a
 * private competition and can never be both. The union here mirrors that: there
 * is no "maybe league maybe competition" state to render.
 *
 * NOT FOUND IS NOT AN ERROR, AND IT IS DELIBERATELY UNINFORMATIVE. A malformed
 * code, an unknown code and a rotated code all come back `found: false` with
 * nothing else, so a caller cannot tell them apart — which is the point. Any
 * copy this decoder's consumers write must not distinguish them either, because
 * "that code used to exist" is a probe result.
 *
 * THERE IS NO CONTAINER ID AND NO MEMBER COUNT, AND THEIR ABSENCE IS THE
 * CONTRACT (contract 159). Contract 155's resolver returned both; contract 158
 * narrowed `get_league_preview` to `(name, is_member)` for exactly the reason
 * that a member count and an id turn a guessed code into a positively
 * identified private group, and contract 159 closed the same door on the
 * resolver — which was the wider and, until then, entirely unmetered one. This
 * decoder therefore has no `id` field to render or navigate with. A caller who
 * needs an id gets it from the JOIN, which returns one, and only after the
 * caller has actually been let in.
 *
 * WHAT THE SERVER SAYS ABOUT JOINING, THE CLIENT DOES NOT RE-DECIDE.
 * `alreadyIn`, `closed` and `requiresGameEntry` are the server's answers and are
 * carried verbatim. In particular `requiresGameEntry` exists so a league invite
 * can send a player to join the underlying game FIRST, instead of offering a
 * button the database will refuse.
 *
 * PURE. No clock: `closed` is resolved server-side against the server's own now,
 * because a device clock deciding whether registration has closed is a
 * disagreement waiting to happen.
 */

export type ResolvedLeagueInvite = {
  found: true
  kind: 'league'
  name: string
  /** The competition season the league is played in, by name. */
  season: string | null
  /** The underlying game's display name, as the catalogue holds it. */
  game: string | null
  alreadyIn: boolean
  /** True when the caller holds no active membership in the league's game. */
  requiresGameEntry: boolean
  joinWith: 'join_league'
}

export type ResolvedCompetitionInvite = {
  found: true
  kind: 'competition'
  name: string
  season: string | null
  game: string | null
  gameKey: CompetitionGameKey | null
  alreadyIn: boolean
  isOwner: boolean
  /** Finished, or registration closed — including by an organiser launching. */
  closed: boolean
  joinWith: 'join_private_competition'
}

export type UnresolvedInvite = { found: false }

export type ResolvedInvite =
  | ResolvedLeagueInvite
  | ResolvedCompetitionInvite
  | UnresolvedInvite

const GAME_KEYS: readonly string[] = [
  'main_predictor',
  'last_man_standing',
  'predictor_cup',
  'original_predictor',
  'ko_predictor',
]

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function gameKeyOf(value: unknown): CompetitionGameKey | null {
  return typeof value === 'string' && GAME_KEYS.includes(value)
    ? (value as CompetitionGameKey)
    : null
}

export function mapResolvedInvite(payload: unknown): ResolvedInvite {
  const root = objectOf(payload)
  if (root.found !== true) return { found: false }

  const name = stringOrNull(root.name)
  // A resolved container with no name cannot be presented: it would show a
  // player an unnamed group to accept. It degrades to the same answer an
  // unknown code gets. There is deliberately no id to check for — contract 159
  // stopped returning one.
  if (!name) return { found: false }

  const shared = {
    name,
    season: stringOrNull(root.season),
    game: stringOrNull(root.game),
    alreadyIn: root.already_in === true,
  }

  if (root.kind === 'league') {
    return {
      found: true,
      kind: 'league',
      ...shared,
      requiresGameEntry: root.requires_game_entry === true,
      joinWith: 'join_league',
    }
  }

  if (root.kind === 'competition') {
    return {
      found: true,
      kind: 'competition',
      ...shared,
      gameKey: gameKeyOf(root.game_key),
      isOwner: root.is_owner === true,
      closed: root.closed === true,
      joinWith: 'join_private_competition',
    }
  }

  // An unrecognised container kind is a client that is older than the server.
  // Answering "not found" is wrong in principle and right in practice: it is the
  // only answer that cannot offer a join this build does not understand.
  return { found: false }
}

/**
 * How the invite code the player typed is normalised before it is sent.
 *
 * Upper-cased and trimmed to match what the server does to it, and stripped of
 * the separators people paste from a chat message. It deliberately does NOT
 * validate length or alphabet: contract 158 widened codes from six characters to
 * six-to-sixteen, and a client that re-implements the shape is a client that
 * starts refusing valid codes the day the server issues a longer one.
 */
export function normaliseInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '')
}
