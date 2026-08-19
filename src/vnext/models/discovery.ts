/**
 * vNEXT DISCOVERY — the published catalogue, and what the player already follows.
 *
 * ============================ WHAT THE MATRIX ASKS FOR ==================
 *
 * `/competitions` is RETAIN + HIDE: it keeps its address and stops being a
 * permanent navigation slot, reached instead from the shell's Explore control.
 * Its purpose in the matrix's own words is "deliberate discovery over the whole
 * published catalogue" — the whole platform's, not the player's list, which is
 * what every other surface shows.
 *
 * ============================ FOLLOW IS NOT MEMBERSHIP ==================
 *
 * Contract 157's migration asserts it, in a guard that reads the function's own
 * text and refuses to install if it ever stops being true:
 *
 *     if v_follow ~* 'game_memberships|bonus_competition_entrants|insert into
 *                     public\.entries' then
 *       raise exception 'Following a competition must not create game entry';
 *
 * So nothing on this surface may suggest that following gets you into a game.
 * A player who follows the Premier League and has joined nothing is a real and
 * supported state, and this model has no field that could be mistaken for a
 * membership.
 *
 * ============================ WHY THERE IS NO PLAIN "FOLLOW" TOGGLE =====
 *
 * `set_competition_follow` is an upsert:
 *
 *     insert into public.competition_follows (user_id, tournament_id,
 *                                             favourite_team_id)
 *     values (v_uid, p_tournament_id, p_favourite_team_id)
 *     on conflict (user_id, tournament_id) do update
 *       set favourite_team_id = excluded.favourite_team_id;
 *
 * `favourite_team_id` defaults to null, so re-sending a follow for a
 * competition the player ALREADY follows CLEARS their favourite club. The
 * service layer made that null explicit on purpose — it is how a favourite is
 * cleared deliberately — which means the destructive path is one argument away
 * from the ordinary one.
 *
 * This surface therefore offers `follow` only where the player does not already
 * follow, and `unfollow` only where they do. There is no state in which a
 * single control re-sends a follow, so there is no path here that can silently
 * discard a favourite. Changing a favourite belongs beside the competition,
 * where the club list is already read.
 */

/** What this player has to do with a listed season. The server's, never inferred. */
export type FollowState = 'following' | 'not-following'

export type DiscoverableSeason = {
  /** The season row id every season read is addressed by. */
  readonly tournamentId: string
  readonly competitionName: string
  readonly seasonName: string
  /**
   * Both halves of the address. Contract 147 stores the slug and this lane
   * never derives one from a name — the mistake the season routes exist to
   * avoid.
   */
  readonly route: { readonly competitionSlug: string; readonly seasonKey: string }
  /**
   * The season's lifecycle, as the catalogue holds it. NOT a publication
   * decision: the weekly platform has no equivalent of Euro's publication
   * state, and this lane does not pretend `status` is one.
   */
  readonly status: string | null
  readonly follow: FollowState
}

/**
 * THE CATALOGUE PANEL.
 *
 * `empty` means the platform publishes nothing, which is a real answer about
 * the platform. It is not the same as a read that did not land, and the two
 * send a player to different screens.
 */
export type CataloguePanel =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'seasons'; readonly seasons: readonly DiscoverableSeason[] }

/**
 * WHETHER THE PAGE KNOWS WHAT THE PLAYER FOLLOWS.
 *
 * Contract 157 can fail while contract 147 answers. When it does, the catalogue
 * still renders — a platform's published seasons are not private to the
 * player — but every row's follow state is UNKNOWN, and an unknown follow state
 * must not be drawn as "not following". Offering Follow for something already
 * followed is the upsert that clears a favourite.
 */
export type FollowKnowledge = 'known' | 'unknown'

export type DiscoveryPageModel = {
  readonly generatedAt: string
  readonly catalogue: CataloguePanel
  readonly followKnowledge: FollowKnowledge
}

/* ==========================================================================
   SELECTORS
   ========================================================================== */

/**
 * Whether the page may offer to follow or unfollow this season.
 *
 * ONE PLACE, so the rule the surface renders and the rule a test asserts cannot
 * drift. Both answers are false while the follow state is unknown: a Follow
 * offered against an unknown state can land on a competition the player already
 * follows, and that upsert discards their favourite club.
 */
export function offersFollow(season: DiscoverableSeason, knowledge: FollowKnowledge): boolean {
  return knowledge === 'known' && season.follow === 'not-following'
}

export function offersUnfollow(season: DiscoverableSeason, knowledge: FollowKnowledge): boolean {
  return knowledge === 'known' && season.follow === 'following'
}
