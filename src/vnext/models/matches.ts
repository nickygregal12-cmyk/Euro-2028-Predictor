/**
 * THE vNEXT MATCHES PRESENTATION CONTRACT — STAGE 8.
 *
 * ============================ WHAT THIS ANSWERS ===========================
 *
 * Two questions, and deliberately not one:
 *
 *   WHAT FOOTBALL IS HAPPENING?          → `MatchesModel`
 *   WHAT IS HAPPENING IN THIS MATCH?     → `MatchCentreModel`
 *
 * They are RELATED AND DIFFERENT, which is why there is no single `MatchModel`
 * carrying a hundred and twenty fields for both. A list row needs the clubs,
 * the state and one line of context; a Match Centre needs the competition's
 * table, the two form runs and this season's meetings. A universal model would
 * force every row in a list of ten to carry a table it never draws, and would
 * make "does this surface have a table?" a question about `null` rather than
 * about the type.
 *
 * ============================ FOOTBALL IS NOT A GAME ======================
 *
 * The load-bearing distinction of the whole stage, and it is held here by
 * vocabulary rather than by a comment. A `Match` in this file is a REAL FOOTBALL
 * FIXTURE. A "game" — Match Predictor, Last Man Standing, the Predictor
 * Championship — is a joinable prediction format and has no type in this file at
 * all. The one place the two touch is `MatchPredictionBadge`, which is a STATUS
 * a fixture row may carry, is optional, and can never become a score entry: it
 * holds no command, no editability and no lock.
 *
 * ============================ THE LIVE-DATA RULE ==========================
 *
 * A MATCH CLOCK IS PROVIDER DATA OR IT DOES NOT EXIST.
 *
 * Nothing in this file, and nothing that maps into it, may derive a minute, a
 * half, injury time, a full-time whistle, a postponement or an abandonment from
 * `Date.now() - kickoff`. The type system is arranged so that trying is awkward:
 * a clock exists ONLY inside `MatchObservation`, an observation exists ONLY on
 * the two states a provider has actually reported on, and every observation
 * carries the instant it was observed at. A scheduled match has no field that
 * could hold a minute; a settled match has no field that could hold one either.
 *
 * `LIVE` WITHOUT A MINUTE IS A FIRST-CLASS, DESIGNED STATE, not a degradation.
 * `MatchObservation.clock` is nullable precisely because the platform's live
 * projection (contract 135) carries a status and a score and NO minute at all.
 * See `docs/product/vnext-matches.md` § "Live data honesty".
 *
 * ============================ PROVIDER VERSUS PLATFORM ====================
 *
 * The repository keeps two different claims in two different fields and so does
 * this contract:
 *
 *   PROVIDER  — what a feed currently says (`season_fixture_live_state.kind`,
 *               its scores, its observation instant). Provisional. Decides
 *               nothing.
 *   PLATFORM  — what the application settled (`season_fixtures.status` and the
 *               result it is allowed to carry). Official. Decides everything.
 *
 * `awaitingResult` exists because of exactly that gap: a provider may report a
 * match FINAL while the platform has not confirmed a result, and a surface that
 * collapsed the two would be a browser promoting a feed to a settlement. That
 * is the confirmation boundary the whole ingestion lane exists to hold.
 *
 * ============================ IT IS NOT A RULE AUTHORITY ==================
 *
 * Nothing here defines a lock, a score, a settlement, a reveal, an eligibility
 * or a membership. Every label is either copy the mapper formatted from an
 * authoritative field, or a value the application supplied.
 */

import type { FormResult, Team } from './football'

/* ==========================================================================
   SHARED PRIMITIVES — small, and shared on purpose
   ========================================================================== */

/** A scoreline. Two numbers that are always known together or not at all. */
export type MatchScore = {
  readonly home: number
  readonly away: number
}

/**
 * WHICH COMPETITION A FIXTURE BELONGS TO.
 *
 * IT IS ON EVERY FIXTURE, INCLUDING IN COMPETITION-SCOPED MODE. The combined
 * view's binding requirement is that the reader always knows which competition
 * a match is in, and the cheapest way to guarantee that is for the field to be
 * non-optional — a row rendered without it would not compile. In scoped mode a
 * surface is free not to DRAW it, because the page already says so once.
 */
export type MatchCompetitionRef = {
  readonly id: string
  readonly name: string
  /** For dense rows. Never a different competition. */
  readonly shortName: string
  readonly seasonLabel: string | null
  readonly colours: { readonly primary: string; readonly accent: string } | null
}

/**
 * WHERE A FIXTURE SITS IN ITS COMPETITION'S OWN STRUCTURE.
 *
 * `label` IS THE SERVER'S WORD AND IS NEVER CONSTRUCTED HERE. "Matchweek 7",
 * "Quarter-finals", "Group A · Matchday 2" — a domestic league, a knockout and
 * a group stage each name their own rounds, and presentation printing
 * "Matchweek 7" over a quarter-final because it counted rounds would be
 * inventing a competition structure. `competition_rounds.label` is that word;
 * this carries it verbatim.
 *
 * `ordinal` IS FOR ORDERING AND FOR NOTHING ELSE. It is the server's own
 * sequence number. It may not be printed as "week N" and may not be compared
 * with a date to decide what stage a competition is at.
 *
 * `kind` IS NULL TODAY, AND THAT IS A RECORDED BACKEND GAP RATHER THAN A
 * DESIGN. `competition_rounds.kind` genuinely holds `league_matchweek`,
 * `group_matchday` and `knockout_round`, but neither contract 139 nor contract
 * 148 projects it, so no mapper in this lane can produce anything but `null`.
 * The field exists so the day it is projected the presentation is already
 * shaped for it; until then a surface must behave identically for every
 * competition type and lean on `label`. See `docs/product/vnext-matches.md`
 * § "Backend gaps".
 */
export type MatchStageKind = 'league-matchweek' | 'group-matchday' | 'knockout-round'

export type MatchStageRef = {
  readonly id: string
  readonly ordinal: number
  /** The competition's own name for this stage. Printed verbatim. */
  readonly label: string
  /** Null until a fixture read projects it. Never inferred from the label. */
  readonly kind: MatchStageKind | null
}

/* ==========================================================================
   THE MATCH STATE MODEL
   ========================================================================== */

/**
 * A MATCH CLOCK, WHICH ONLY A PROVIDER MAY SUPPLY.
 *
 * `label` is what the surface prints, and it arrives pre-rendered so no
 * component ever assembles "67" + "'" and no component ever has to decide what
 * `addedMinutes: 2` looks like. `minute` and `addedMinutes` are carried beside
 * it for a surface that wants to order or compare, and both are nullable
 * because a feed reporting "half-time" has a label and no minute.
 *
 * NOTHING IN THIS LANE CAN CONSTRUCT ONE FROM A CLOCK. The mappers take an
 * observation from the read or produce `null`; there is no code path from a
 * kickoff instant to this type.
 */
export type MatchClockPresentation = {
  readonly label: string
  readonly minute: number | null
  readonly addedMinutes: number | null
}

/**
 * WHAT A PROVIDER SAID, AND WHEN IT SAID IT.
 *
 * `observedAt` IS REQUIRED, and that is the whole freshness contract. A surface
 * may say "updated 34 seconds ago" only because this instant came from the
 * server's own observation record — never from when a component mounted, and
 * never from when a model was built. A provider block with no observation
 * instant is not decoded at all upstream, so there is no partial case here.
 *
 * `score` is nullable because "in play, no goals reported yet" is real
 * information and is not zero–zero.
 */
export type MatchObservation = {
  readonly observedAt: string
  readonly score: MatchScore | null
  /** Null wherever the provider proves the state but not the minute. */
  readonly clock: MatchClockPresentation | null
  /**
   * How the phase reads in words — "Live", "Half-time", "Second half". Copy
   * from the mapper, never a computed period.
   */
  readonly phaseLabel: string
}

/**
 * HOW A TIE WAS DECIDED BEYOND NINETY MINUTES.
 *
 * NULL FROM EVERY CURRENT READ. `season_fixtures` carries one score pair and a
 * status; there is no extra-time column, no shootout column and no aggregate.
 * The type exists so a knockout competition can be drawn honestly the day the
 * backend states it, and `tests/vnext/matchesIntegration.test.ts` asserts that
 * today's mappers never produce one.
 */
export type MatchDecision =
  | { readonly kind: 'afterExtraTime' }
  | { readonly kind: 'afterPenalties'; readonly shootout: MatchScore }

/**
 * A TWO-LEGGED TIE'S RUNNING TOTAL. Null from every current read, for the same
 * reason as `MatchDecision`: no aggregate is stored or projected anywhere.
 */
export type MatchAggregate = {
  readonly label: string
  readonly score: MatchScore
}

/**
 * THE STATE OF A FOOTBALL MATCH, AS A DISCRIMINATED UNION.
 *
 * ============================ WHY A UNION AND NOT FLAGS ===================
 *
 * The brief's own example — a scheduled match carrying `minute: 73` and
 * `finalScore: 2-1` — is not merely discouraged here, it does not typecheck.
 * `scheduled` has no observation and no result; `live` has an observation and
 * no result; `finished` has a result; `postponed`, `abandoned` and `void` have
 * neither. A surface asking "is there a score?" narrows the union rather than
 * testing three nullable fields against each other and hoping.
 *
 * ============================ THE SEVEN STATES ============================
 *
 *   scheduled       the platform says this is on and nothing has happened
 *   live            a provider currently reports it in play
 *   awaitingResult  a provider reports it OVER; the platform has not settled it
 *   finished        the PLATFORM settled a result
 *   postponed       the platform moved it out of its slot
 *   abandoned       the platform recorded it as abandoned
 *   void            the platform voided it (the nearest thing to "cancelled")
 *
 * The last three are the platform's administrative vocabulary
 * (`season_fixtures.status`) and are not a provider's opinion, which is
 * deliberate: a feed that briefly reports "postponed" for a delayed kickoff
 * must not empty a fixture list.
 *
 * `kickoff` IS NULLABLE ON EVERY STATE, because a fixture the league has not
 * timed yet is an ordinary fixture and not a broken one. It is the instant, not
 * a label; labels are the mapper's.
 */
export type MatchState =
  | {
      readonly kind: 'scheduled'
      readonly kickoff: string | null
    }
  | {
      readonly kind: 'live'
      readonly kickoff: string | null
      /** Required. An in-play match with no observation is not live. */
      readonly observation: MatchObservation
    }
  | {
      readonly kind: 'awaitingResult'
      readonly kickoff: string | null
      readonly observation: MatchObservation
    }
  | {
      readonly kind: 'finished'
      readonly kickoff: string | null
      /** THE PLATFORM'S RESULT. Required — that is what `finished` means. */
      readonly result: MatchScore
      readonly decision: MatchDecision | null
      readonly aggregate: MatchAggregate | null
    }
  | {
      readonly kind: 'postponed'
      readonly kickoff: string | null
      /** Whatever the competition said about the move. Null where it said nothing. */
      readonly note: string | null
    }
  | {
      readonly kind: 'abandoned'
      readonly kickoff: string | null
      readonly note: string | null
    }
  | {
      readonly kind: 'void'
      readonly kickoff: string | null
      readonly note: string | null
    }

export type MatchStateKind = MatchState['kind']

/**
 * The three groups a browsing filter offers, derived from the state and never
 * from a clock. `awaitingResult` sits with the finished ones because the
 * football is over — which is what a reader scanning "what just finished" means.
 */
export type MatchPhase = 'upcoming' | 'live' | 'finished'

export function matchPhase(state: MatchState): MatchPhase {
  switch (state.kind) {
    case 'live':
      return 'live'
    case 'finished':
    case 'awaitingResult':
      return 'finished'
    default:
      // scheduled, postponed, abandoned and void are all "not football that has
      // happened", and a postponed fixture belongs where a reader looking for
      // what is coming will find it.
      return 'upcoming'
  }
}

/**
 * THE SCORE A SURFACE MAY PRINT, AND WHAT KIND OF CLAIM IT IS.
 *
 * ONE FUNCTION, SO THE DISTINCTION CANNOT BE LOST BY ACCIDENT. Every surface in
 * this stage asks it, so there is exactly one place that decides that a
 * provider's numbers are `provisional` and the platform's are `official`. A
 * component that reached into `state.observation.score` itself would be the
 * place the distinction quietly disappears.
 */
export type MatchScoreClaim = {
  readonly score: MatchScore
  readonly basis: 'official' | 'provisional'
  /** The provider observation instant, on a provisional claim only. */
  readonly observedAt: string | null
}

export function matchScoreClaim(state: MatchState): MatchScoreClaim | null {
  switch (state.kind) {
    case 'finished':
      return { score: state.result, basis: 'official', observedAt: null }
    case 'live':
    case 'awaitingResult':
      return state.observation.score === null
        ? null
        : {
            score: state.observation.score,
            basis: 'provisional',
            observedAt: state.observation.observedAt,
          }
    default:
      return null
  }
}

/* ==========================================================================
   PREDICTION STATUS — the ONE place football meets a game
   ========================================================================== */

/**
 * WHAT THE PLAYER'S MATCH PREDICTOR ENTRY SAYS ABOUT THIS FIXTURE.
 *
 * IT IS A STATUS AND NOT A FORM. There is no command here, no editability, no
 * lock instant and no joker toggle: Matches asks "what is happening in
 * football", the Match Predictor asks "what do I predict", and §14 of the brief
 * forbids merging them. A surface may draw this badge and may offer a LINK to
 * the Match Predictor; it may not collect a score.
 *
 * IT IS OPTIONAL AT THE MODEL LEVEL AND MUST STAY THAT WAY. A Matches page is
 * required to be drawable with `prediction: null` on every row, because the
 * only bounded way to fill it is a card read the player may not have — and
 * §14's other half forbids a per-fixture prediction request. See
 * `integration/matches/matchesSource.ts`.
 */
export type MatchPredictionBadge =
  | { readonly kind: 'needed' }
  | { readonly kind: 'entered'; readonly score: MatchScore }
  | { readonly kind: 'locked'; readonly score: MatchScore }
  | {
      readonly kind: 'settled'
      readonly score: MatchScore
      /** The application's own outcome word. Never derived from the result here. */
      readonly outcomeLabel: string
      readonly points: number | null
    }

/* ==========================================================================
   THE LIST — `MatchesModel`
   ========================================================================== */

/** One club, on a fixture. The shared visual primitive, not a second one. */
export type MatchTeam = Team

/**
 * ONE ROW IN A FIXTURE LIST.
 *
 * DELIBERATELY SMALL. Teams, state, where it sits, one optional badge and the
 * accessible sentence. No table, no form, no head-to-head, no consensus and no
 * events: those belong to one fixture in full, and a list of ten carrying them
 * is either ten extra requests or ten fields nobody draws.
 */
export type MatchListItem = {
  /** THE CANONICAL FIXTURE ID. The only thing a Match Centre is addressed by. */
  readonly id: string
  readonly competition: MatchCompetitionRef
  readonly stage: MatchStageRef
  readonly home: MatchTeam
  readonly away: MatchTeam
  readonly state: MatchState
  /** "15:00" in the viewer's zone, or null for a fixture with no kickoff. */
  readonly kickoffLabel: string | null
  /**
   * The one line of secondary context this row has room for — a matchweek where
   * the day mixes them, a competition where the scope is combined. Copy.
   */
  readonly contextLabel: string | null
  readonly prediction: MatchPredictionBadge | null
  /** "Glenmore Athletic 2, Porthaven City 1, full time." One sentence. */
  readonly accessibleSummary: string
}

/** A calendar day's worth of fixtures, which is how football is browsed. */
export type MatchDayGroup = {
  /** `YYYY-MM-DD`, or `undated`. Stable, sortable, never printed. */
  readonly key: string
  /** "Saturday 21 August", or "Date to be confirmed". */
  readonly label: string
  /** True when this day carries more than one stage — a rescheduled fixture. */
  readonly mixedStages: boolean
  readonly matches: readonly MatchListItem[]
}

/**
 * WHOSE FOOTBALL THE LIST IS SHOWING.
 *
 * `competition` is the default and the architecture's root: the player is
 * inside a competition and this is that competition's football. `combined` is
 * the SECONDARY across-your-competitions mode — never a fifth destination, and
 * never the landing state. See `docs/product/vnext-matches.md` § "The combined
 * view".
 */
export type MatchesScope = 'competition' | 'combined'

/** A stage a reader can jump to. Built from the labels the server sent. */
export type MatchStageOption = {
  readonly id: string
  readonly label: string
  readonly ordinal: number
  readonly matches: number
}

/**
 * WHAT THE SCOPE CONTROL MAY OFFER.
 *
 * `combinedAvailable` is FALSE where the application cannot answer a
 * cross-competition calendar, and the control then does not render at all — the
 * same rule the shell applies to a one-competition switcher. An offered mode
 * that refuses is worse than an absent one.
 */
export type MatchesScopeOffer = {
  readonly active: MatchesScope
  readonly combinedAvailable: boolean
  /** How many of the player's competitions the combined mode would span. */
  readonly competitionCount: number
}

export type MatchesFilter = 'all' | MatchPhase

export type MatchesModel = {
  /**
   * The instant the model describes, supplied rather than read. Every relative
   * time on the page is measured against this and nothing else.
   */
  readonly generatedAt: string
  /**
   * The competition this page belongs to. Present even in combined scope,
   * because the player is still inside a competition — that is the architecture.
   */
  readonly competition: MatchCompetitionRef
  readonly scope: MatchesScopeOffer
  /** The window the server answered, as words. "18 August – 8 September". */
  readonly windowLabel: string | null
  readonly days: readonly MatchDayGroup[]
  /** Stages present in the answered window, in the server's own order. */
  readonly stages: readonly MatchStageOption[]
  /** How many matches sit in each filter, so a control can label itself. */
  readonly counts: Readonly<Record<MatchesFilter, number>>
  /**
   * Enrichments the application could not answer, named so the surface can be
   * honest instead of silently drawing less. Never an error.
   */
  readonly unavailable: readonly string[]
}

/* ==========================================================================
   SELECTORS OVER THE LIST — reading the model, never re-deriving it
   ========================================================================== */

function matchesInModel(model: MatchesModel): readonly MatchListItem[] {
  return model.days.flatMap((day) => day.matches)
}

/**
 * The days that survive a filter, with empty days dropped.
 *
 * A DAY WITH NO SURVIVING MATCH IS NOT AN EMPTY DAY, it is a day that is not in
 * this view — leaving the heading behind would draw a Saturday with nothing
 * under it and read as football that had disappeared.
 */
export function filterMatchDays(
  model: MatchesModel,
  filter: MatchesFilter,
): readonly MatchDayGroup[] {
  if (filter === 'all') return model.days
  return model.days
    .map((day) => ({
      ...day,
      matches: day.matches.filter((match) => matchPhase(match.state) === filter),
    }))
    .filter((day) => day.matches.length > 0)
}

/** How many competitions actually appear in the answered window. */
export function competitionsInModel(model: MatchesModel): readonly MatchCompetitionRef[] {
  const seen = new Map<string, MatchCompetitionRef>()
  for (const match of matchesInModel(model)) {
    if (!seen.has(match.competition.id)) seen.set(match.competition.id, match.competition)
  }
  return [...seen.values()]
}

/* ==========================================================================
   THE MATCH CENTRE — `MatchCentreModel`
   ========================================================================== */

/**
 * ONE SIDE OF A MATCH, WITH WHATEVER CONTEXT THE APPLICATION HAS.
 *
 * Every context field is independently nullable, because every one of them
 * comes from a DIFFERENT read that is allowed to fail on its own. A missing
 * table costs the header its positions and costs the page nothing else.
 */
export type MatchCentreSide = {
  readonly team: MatchTeam
  /** Contract 141's letters, most recent first. Empty where unread. */
  readonly form: readonly FormResult[]
  /** Contract 160's authoritative position. Never an array index. */
  readonly tablePosition: number | null
  readonly tablePoints: number | null
}

/** One previous meeting between the two clubs, from contract 141. */
export type MatchCentreMeeting = {
  readonly fixtureId: string
  readonly label: string
  readonly score: MatchScore
  /** From the perspective of the home side of the fixture being viewed. */
  readonly outcome: FormResult
}

/**
 * THIS SEASON'S MEETINGS BETWEEN THESE TWO CLUBS.
 *
 * ONE FIXTURE, ONE REQUEST — and only ever from the Match Centre. A list of ten
 * fixtures may not ask ten times; §20 of the brief and the read's own
 * pair-at-a-time shape both say so, and `MatchListItem` has no field for it, so
 * the list cannot start.
 */
export type MatchCentreHeadToHead = {
  readonly played: number
  readonly homeWins: number
  readonly draws: number
  readonly awayWins: number
  readonly meetings: readonly MatchCentreMeeting[]
}

/** A few rows of the competition's own table, around the two clubs. */
export type MatchCentreTableRow = {
  readonly position: number
  readonly teamId: string
  readonly teamName: string
  readonly played: number
  readonly points: number
  readonly goalDifference: number
  /** True for either of the two clubs in this fixture. */
  readonly isInThisMatch: boolean
}

export type MatchCentreTable = {
  readonly rows: readonly MatchCentreTableRow[]
  /** "After 5 of 38 matchweeks" — the server's own provenance, as words. */
  readonly provenanceLabel: string | null
  /** True where the server says the season is not complete. */
  readonly provisional: boolean
}

/**
 * ONE THING THAT HAPPENED IN A MATCH.
 *
 * DEFERRED, AND THE TYPE IS HERE ANYWAY. No canonical event source exists
 * anywhere in this repository — not in `season_fixtures`, not in the live
 * projection, not in any read. §18 of the brief is explicit that the answer is
 * to leave the contract CAPABLE and record the gap rather than fabricate a
 * timeline, so `MatchCentreModel.timeline` is `null` from every mapper today
 * and a test holds that it stays that way.
 */
export type MatchEventKind =
  | 'goal'
  | 'ownGoal'
  | 'penaltyScored'
  | 'penaltyMissed'
  | 'yellowCard'
  | 'secondYellow'
  | 'redCard'
  | 'substitution'
  | 'varDecision'

export type MatchEventPresentation = {
  readonly id: string
  readonly kind: MatchEventKind
  readonly side: 'home' | 'away'
  /** "23'", "90+4'". The provider's, never counted here. */
  readonly clockLabel: string
  readonly headline: string
  readonly detail: string | null
}

/**
 * WHERE A MATCH CENTRE CAN SEND THE PLAYER.
 *
 * CONTEXTUAL NAVIGATION, NOT THE PAGE'S PURPOSE. §43 permits a clear path to
 * the Match Predictor and forbids moving score entry here. This is that path
 * and it is one link with one label; there is no command, no payload and no
 * second submission authority.
 */
export type MatchCentreLink = {
  readonly kind: 'match-predictor' | 'competition-matches' | 'competition-table'
  readonly label: string
}

export type MatchCentreModel = {
  readonly generatedAt: string
  /** THE CANONICAL FIXTURE ID this page resolved from. */
  readonly id: string
  readonly competition: MatchCompetitionRef
  readonly stage: MatchStageRef
  readonly home: MatchCentreSide
  readonly away: MatchCentreSide
  readonly state: MatchState
  /** "Saturday 21 August", from the fixture's own kickoff. */
  readonly dayLabel: string | null
  readonly kickoffLabel: string | null
  readonly accessibleSummary: string
  readonly prediction: MatchPredictionBadge | null

  /* --- TIER 2: existing trusted context, each independently absent --- */
  readonly table: MatchCentreTable | null
  readonly headToHead: MatchCentreHeadToHead | null

  /* --- TIER 3: provider enrichment, none of which the platform supplies --- */
  /** Null everywhere. `season_fixtures` holds no venue. */
  readonly venue: string | null
  /** Null everywhere. No broadcast source exists. */
  readonly broadcast: string | null
  /** Null everywhere. No official is stored. */
  readonly referee: string | null
  /** Null everywhere. No canonical event source exists — see §18. */
  readonly timeline: readonly MatchEventPresentation[] | null
  /** Null everywhere. No canonical match statistics exist. */
  readonly statistics: readonly MatchCentreStatistic[] | null
  /** Null everywhere. No lineup source exists. */
  readonly lineups: MatchCentreLineups | null

  readonly links: readonly MatchCentreLink[]
  readonly unavailable: readonly string[]
}

/** A single comparable match statistic. Deferred; see `statistics` above. */
export type MatchCentreStatistic = {
  readonly label: string
  readonly home: number
  readonly away: number
  /** How the pair should be read — a percentage, a count. */
  readonly unit: 'count' | 'percent'
}

/** Named elevens. Deferred; see `lineups` above. */
export type MatchCentreLineups = {
  readonly home: readonly string[]
  readonly away: readonly string[]
  readonly formationHome: string | null
  readonly formationAway: string | null
}

/**
 * WHICH TIER 2/3 MODULES A MATCH CENTRE SHOULD ACTUALLY RENDER.
 *
 * ONE ANSWER, SO NO COMPONENT DECIDES FOR ITSELF. §17's rule is that a module
 * appears only where the data genuinely exists, and the failure mode it guards
 * against is a decorative empty card that makes the product look richer than it
 * is. Asking the model is how a surface stays honest without every section
 * writing its own `?.length > 0`.
 */
export function matchCentreModules(model: MatchCentreModel): {
  readonly table: boolean
  readonly headToHead: boolean
  readonly form: boolean
  readonly timeline: boolean
  readonly statistics: boolean
  readonly lineups: boolean
  readonly venue: boolean
  readonly broadcast: boolean
} {
  return {
    table: model.table !== null && model.table.rows.length > 0,
    // A head-to-head with no meetings is a real answer — "they have not met
    // this season" — and worth saying. An absent read is not.
    headToHead: model.headToHead !== null,
    form: model.home.form.length > 0 || model.away.form.length > 0,
    timeline: model.timeline !== null && model.timeline.length > 0,
    statistics: model.statistics !== null && model.statistics.length > 0,
    lineups: model.lineups !== null,
    venue: model.venue !== null,
    broadcast: model.broadcast !== null,
  }
}
