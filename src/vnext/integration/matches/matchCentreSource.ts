import type {
  SeasonFixtureCompetition,
  SeasonListFixture,
} from '../../../services/supabase/seasonFixtureListModel'
import type {
  ClubHeadToHead,
  SeasonClubFormTable,
} from '../../../services/supabase/seasonClubFormModel'
import type { CompetitionTable } from '../../../services/supabase/competitionTableModel'

/**
 * WHAT THE REAL APPLICATION HANDS ONE FIXTURE'S MATCH CENTRE.
 *
 * ============================ ADDRESSED BY THE FIXTURE ID =================
 *
 * Contract 148's `get_season_fixture` takes a fixture id and nothing else. That
 * is the whole addressability story: a Match Centre URL is self-contained, a
 * deep refresh resolves the same fixture, and there is no day hint, no window
 * and no search. `MIG-UI-11` records what that replaced — a three-week window
 * around a date in the URL, which could honestly report "not in this window"
 * for a perfectly valid link.
 *
 * NOTHING IS IDENTIFIED BY `home + away + date` OR BY ARRAY POSITION. §29, and
 * it is held by the source shape: there is no other way in.
 *
 * ============================ FOUR READS, ALL BOUNDED =====================
 *
 *   contract 148  the fixture                       — required
 *   contract 141  the season's club form            — one read, whole season
 *   contract 160  the competition's league table    — one read, whole season
 *   contract 141  this pair's meetings              — ONE call, this fixture
 *
 * THE HEAD-TO-HEAD IS ONE FIXTURE'S AND STAYS THAT WAY. `get_season_club_head_
 * to_head` is addressed by two team ids, so it is pair-at-a-time by
 * construction — which is fine for a page about one pair and is precisely why
 * §20 forbids it in a list. `MatchListItem` has no field for it, so a list
 * cannot begin.
 *
 * THE TEAM IDS COME FROM THE FORM READ, JOINED BY NAME. Contract 148 sends
 * `teams.name` and no id; contract 141 sends both. Both names are the same
 * column of the same rows, so the join is an equality on one source of truth
 * rather than a fuzzy comparison — the same reasoning `SeasonMatchCentreRoute`
 * records for the same join. Where the form read did not answer, there is no
 * head-to-head; that is a missing enrichment, not a failed page.
 *
 * ============================ EVERY ENRICHMENT FAILS ALONE ================
 *
 * The fixture is the core: without it there is no match to show. The form, the
 * table and the meetings are each nullable and each one's absence costs the
 * page one module and nothing else — the same degradation model `homeSource.ts`
 * states, for the same reason.
 *
 * ============================ WHAT IS NOT HERE, AND WHY ===================
 *
 * NO LINEUPS, NO EVENT TIMELINE, NO MATCH STATISTICS, NO INJURIES, NO REFEREE,
 * NO VENUE, NO BROADCAST. Not one of them exists in this platform: there is no
 * column, no table and no read for any of them for a league season, and
 * contract 135's live projection carries a status, two scores and an
 * observation instant. §17, §18 and §19 all say the same thing about that —
 * leave the presentation contract capable, record the gap, and do not build a
 * decorative module that makes the page look complete. That is what has been
 * done: `MatchCentreModel` has a field for each, every mapper produces `null`,
 * and `docs/product/vnext-matches.md` § "Backend gaps" states the minimum
 * contract each would need.
 */
export type MatchCentreSource = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  /** Contract 148's fixture. The one required read. */
  readonly fixture: SeasonListFixture
  /** Contract 148's competition block — the season this fixture belongs to. */
  readonly competition: SeasonFixtureCompetition
  /** The season label as the play context states it, where the host knows it. */
  readonly seasonLabel: string | null
  /** The competition's palette, from the presentation lane. Never invented. */
  readonly colours: { readonly primary: string; readonly accent: string } | null
  readonly serverNow: string | null
  /** Contract 141's club form for the whole season. Null where unread. */
  readonly clubForm: SeasonClubFormTable | null
  /** Contract 160's authoritative table. Null where unread OR not a league. */
  readonly table: CompetitionTable | null
  /** Contract 141's meetings between these two clubs. Null where unread. */
  readonly headToHead: ClubHeadToHead | null
  /**
   * Whether the host can send the player to this competition's Match Predictor.
   *
   * A CONTROL THAT EXISTS AND REFUSES TEACHES A PLAYER THE PRODUCT IS BROKEN —
   * the shell's own rule for Explore. A host with nowhere to send them gets no
   * link rather than an inert one, and a player who has not joined the game has
   * no predictor to be sent to.
   */
  readonly predictorReachable: boolean
}
