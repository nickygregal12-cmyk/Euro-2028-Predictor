import type {
  SeasonFixtureCompetition,
  SeasonListFixture,
} from '../../../services/supabase/seasonFixtureListModel'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT MATCHES.
 *
 * ============================ ONE READ, AND IT IS ENOUGH ==================
 *
 * Contract 139's `get_season_fixtures` answers a DATE WINDOW of one competition
 * season and carries, per fixture: the kickoff, the platform's own status, the
 * settled result, the provider's current live block with its observation
 * instant, both clubs' identity tokens, and the round as a LABEL. That is every
 * field the fixture list draws.
 *
 * THE WINDOW IS THE SERVER'S TO BOUND AND TO REFUSE — it defaults to the last
 * week and the next fortnight, caps at 120 days and at 500 fixtures. Nothing
 * here holds its own copy of any of that.
 *
 * ============================ WHAT IS DELIBERATELY ABSENT =================
 *
 * NO PREDICTION STATUS, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT.
 *
 * §14 of the brief permits a prediction badge "ONLY where existing
 * authoritative presentation state can supply it cheaply and without N+1", and
 * requires it omitted otherwise. The only read that carries a player's
 * predictions is `get_season_matchweek_card`, which answers ONE MATCHWEEK.
 * This list answers a date window that ordinarily spans three matchweeks and, on
 * a week with a rescheduled fixture, deliberately mixes them.
 *
 * So one card read would badge SOME rows and not others — and a row with no
 * badge in a list where other rows have one does not read as "we could not
 * answer this one", it reads as "nothing is needed here". That is the exact
 * trade Stage 7.6 refused for the shell's attention layer, for the same reason,
 * and it is refused here. `MatchListItem.prediction` therefore stays `null` on
 * every connected row; the deterministic worlds carry the design, and
 * `docs/product/vnext-matches.md` § "Backend gaps" records the minimum contract
 * that would close it.
 *
 * NO HEAD-TO-HEAD, NO FORM, NO TABLE. All three exist and all three belong to
 * ONE FIXTURE — see `matchCentreSource.ts`. `MatchListItem` has no field for
 * any of them, so a list cannot start issuing per-fixture requests even by
 * accident. That is §39 held by the type rather than by discipline.
 *
 * ============================ NOTHING HERE IS A CLOCK =====================
 *
 * `generatedAt` is supplied by the caller. The mapper is pure and reads no
 * clock, which is what makes "the live minute is never browser-inferred" a
 * property a test can hold rather than a claim in a comment.
 */

/** The competition season the page is about, from `get_season_play_context`. */
type MatchesSourceCompetition = {
  readonly tournamentId: string
  readonly name: string
  readonly seasonLabel: string
  /**
   * The competition's palette. NO APPLICATION READ HOLDS ONE, so this arrives
   * from the presentation lane's own resolution or is `null` — never invented
   * from a club colour, which would paint a competition in one team's kit.
   */
  readonly colours: { readonly primary: string; readonly accent: string } | null
}

export type MatchesSource = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly competition: MatchesSourceCompetition
  /** Contract 139's window, as the server bounded it. */
  readonly window: { readonly from: string; readonly to: string }
  /** The server's own instant, where it sent one. Never used as a clock. */
  readonly serverNow: string | null
  /** Contract 139's fixtures, in the server's kickoff order. Preserved exactly. */
  readonly fixtures: readonly SeasonListFixture[]
  /** Contract 139's competition block, for the slug and the season key. */
  readonly competitionRead: SeasonFixtureCompetition
  /**
   * HOW MANY COMPETITIONS THIS PLAYER IS IN, where the host knows.
   *
   * It decides whether the SCOPE CONTROL is worth rendering at all, and nothing
   * else. `null` means the host cannot say, which is treated exactly as one:
   * no control. A scope control offered on a guess is a control that promises a
   * mode the application may not be able to enter.
   */
  readonly playerCompetitionCount: number | null
  /**
   * THE CROSS-COMPETITION CALENDAR, WHEN THE APPLICATION CAN ANSWER ONE.
   *
   * `null` today, on every path, and that is a recorded backend position rather
   * than a design decision. Contract 197's `get_my_football_calendar` is in the
   * repository — it answers exactly this, server-side, bounded, with contract
   * 111's fixture projection field for field — but it is one of eight
   * migrations PENDING on hosted development and is therefore absent from the
   * generated database types. Consuming it today would mean either an
   * un-typed RPC call or a cast, and both would be this lane asserting a
   * capability the running database does not have.
   *
   * The type is here so the day 197 is applied and the types are regenerated,
   * the combined mode is a source change and not a redesign.
   */
  readonly combined: MatchesCombinedSource | null
}

/**
 * The player's whole football calendar, across the competitions they have
 * entered. Shaped for contract 197 exactly: one competition list, one
 * chronological fixture list, and a `competitionId` on every fixture.
 */
type MatchesCombinedSource = {
  readonly competitions: readonly {
    readonly id: string
    readonly name: string
    readonly seasonLabel: string
  }[]
  readonly fixtures: readonly (SeasonListFixture & { readonly competitionId: string })[]
}
