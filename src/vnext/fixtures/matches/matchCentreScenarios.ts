/**
 * STAGE 8'S DETERMINISTIC MATCH CENTRE WORLDS.
 *
 * Twelve premises, each one a state the surface has to survive. They exist
 * beside the list worlds rather than inside them because a Match Centre is not
 * a row with more fields on it — it is a different composition over a different
 * model, and a fixture file that produced both from one shape would be the
 * universal model §38 forbids arriving through the back door.
 *
 * THE TWO THAT MATTER MOST ARE 14 AND 15. `liveWithMinute` and
 * `liveWithoutMinute` are the same match at the same moment, differing only in
 * whether a provider supplied a clock. Put them side by side: the one without a
 * minute must read as football happening now, not as a page that failed to
 * load.
 *
 * NOTHING HERE READS A CLOCK.
 */

import type {
  MatchCentreModel,
  MatchCentreSide,
  MatchCentreTable,
  MatchCompetitionRef,
  MatchState,
  MatchStageRef,
} from '../../models/matches'
import type { FormResult, Team } from '../../models/football'
import { workshopTeams } from '../teams/teams'

/** Module-local, for the same reason as `MATCHES_NOW`: every world carries it. */
const MATCH_CENTRE_NOW = '2027-08-21T15:52:00.000Z'

const T = workshopTeams

/**
 * An observation instant as a time of day.
 *
 * PINNED, WHERE THE MAPPER'S IS THE VIEWER'S — see the note on the same helper
 * in `scenarios.ts`. A world must be the same picture in every time zone; a
 * connected page must be the reader's own.
 */
const observedFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Europe/London',
})

function observedTime(iso: string): string {
  return observedFormatter.format(new Date(iso))
}

const premiership: MatchCompetitionRef = {
  id: 'competition-workshop-premiership',
  name: 'Caledonian Premiership',
  shortName: 'Premiership',
  seasonLabel: '2027/28',
  colours: { primary: '#0B2B5B', accent: '#4FA3FF' },
}

const cup: MatchCompetitionRef = {
  id: 'competition-workshop-cup',
  name: 'Caledonian Cup',
  shortName: 'Cup',
  seasonLabel: '2027/28',
  colours: { primary: '#5B1436', accent: '#FF6B8A' },
}

const matchweekFour: MatchStageRef = {
  id: 'round-mw-4',
  ordinal: 4,
  label: 'Matchweek 4',
  kind: null,
}

const quarterFinal: MatchStageRef = {
  id: 'round-qf',
  ordinal: 4,
  label: 'Quarter-finals',
  kind: null,
}

const form = (letters: string): readonly FormResult[] =>
  [...letters].map((letter) => (letter === 'W' ? 'win' : letter === 'D' ? 'draw' : 'loss'))

function side(team: Team, run: string, position: number | null, points: number | null): MatchCentreSide {
  return { team, form: form(run), tablePosition: position, tablePoints: points }
}

/** A bare side — no form, no table. The state a Match Centre must still draw. */
function bareSide(team: Team): MatchCentreSide {
  return { team, form: [], tablePosition: null, tablePoints: null }
}

const table: MatchCentreTable = {
  rows: [
    { position: 1, teamId: T.strathkelvin.id, teamName: T.strathkelvin.name, played: 4, points: 10, goalDifference: 6, isInThisMatch: true },
    { position: 2, teamId: T.porthaven.id, teamName: T.porthaven.name, played: 4, points: 9, goalDifference: 4, isInThisMatch: false },
    { position: 3, teamId: T.glenmore.id, teamName: T.glenmore.name, played: 4, points: 8, goalDifference: 3, isInThisMatch: true },
    { position: 4, teamId: T.carrickvale.id, teamName: T.carrickvale.name, played: 4, points: 7, goalDifference: 1, isInThisMatch: false },
    { position: 5, teamId: T.balmorral.id, teamName: T.balmorral.name, played: 4, points: 5, goalDifference: 0, isInThisMatch: false },
  ],
  provenanceLabel: 'After 4 of 38 matchweeks',
  provisional: true,
}

const headToHead: MatchCentreModel['headToHead'] = {
  played: 3,
  homeWins: 1,
  draws: 1,
  awayWins: 1,
  meetings: [
    {
      fixtureId: 'fixture-h2h-1',
      label: 'Matchweek 19 · 12 January',
      score: { home: 2, away: 2 },
      outcome: 'draw',
    },
    {
      fixtureId: 'fixture-h2h-2',
      label: 'Matchweek 4 · 30 August',
      score: { home: 0, away: 1 },
      outcome: 'loss',
    },
    {
      fixtureId: 'fixture-h2h-3',
      label: 'Cup quarter-final · 3 March',
      score: { home: 3, away: 1 },
      outcome: 'win',
    },
  ],
}

/**
 * EVERY TIER 3 MODULE IS NULL IN EVERY WORLD, WITHOUT EXCEPTION.
 *
 * Venue, broadcast, referee, the timeline, the statistics and the lineups. No
 * read on this platform supplies any of them, and a Storybook world that drew
 * one would be the exact thing §17, §18 and §19 forbid: a decorative module
 * that makes a reviewer accept a page the product cannot actually produce.
 *
 * Their ABSENCE is the design under review. What a Match Centre looks like with
 * only the football it can honestly get is the question this group asks.
 */
const deferred = {
  venue: null,
  broadcast: null,
  referee: null,
  timeline: null,
  statistics: null,
  lineups: null,
} as const

type CentreInput = {
  id: string
  competition?: MatchCompetitionRef
  stage?: MatchStageRef
  home: MatchCentreSide
  away: MatchCentreSide
  state: MatchState
  dayLabel?: string | null
  kickoffLabel?: string | null
  prediction?: MatchCentreModel['prediction']
  table?: MatchCentreTable | null
  headToHead?: MatchCentreModel['headToHead']
  unavailable?: readonly string[]
  links?: MatchCentreModel['links']
  you?: MatchCentreModel['you']
  leagues?: MatchCentreModel['leagues']
  everyone?: MatchCentreModel['everyone']
}

function summarise(input: CentreInput): string {
  const home = input.home.team.name
  const away = input.away.team.name
  const state = input.state
  switch (state.kind) {
    case 'finished': {
      const decided =
        state.decision === null
          ? ''
          : state.decision.kind === 'afterExtraTime'
            ? ', after extra time'
            : `, ${home} won ${state.decision.shootout.home} to ${state.decision.shootout.away} on penalties`
      return `${home} ${state.result.home}, ${away} ${state.result.away}, full time${decided}`
    }
    case 'live':
    case 'awaitingResult': {
      const score = state.observation.score
      const clock = state.observation.clock
      const phase = clock
        ? `${state.observation.phaseLabel.toLowerCase()}, ${clock.label}`
        : state.observation.phaseLabel.toLowerCase()
      return score
        ? `${home} ${score.home}, ${away} ${score.away}, ${phase}, provisional score`
        : `${home} against ${away}, ${phase}, no score reported`
    }
    case 'postponed':
      return `${home} against ${away}, postponed`
    case 'abandoned':
      return `${home} against ${away}, abandoned`
    case 'void':
      return `${home} against ${away}, void`
    default:
      return input.kickoffLabel
        ? `${home} against ${away}, kick-off ${input.kickoffLabel}`
        : `${home} against ${away}, kick-off to be confirmed`
  }
}

function centre(input: CentreInput): MatchCentreModel {
  return {
    generatedAt: MATCH_CENTRE_NOW,
    id: input.id,
    competition: input.competition ?? premiership,
    stage: input.stage ?? matchweekFour,
    home: input.home,
    away: input.away,
    state: input.state,
    dayLabel: input.dayLabel ?? 'Saturday 21 August',
    kickoffLabel: input.kickoffLabel ?? '15:00',
    accessibleSummary: summarise(input),
    prediction: input.prediction ?? null,
    // THE DEFAULT IS "THE HOST LOADED NONE OF THEM", which is the shape a
    // page-scoped harness, a story and a render test all legitimately have —
    // and is why every existing world below is unchanged by their arrival.
    you: input.you ?? null,
    leagues: input.leagues ?? null,
    everyone: input.everyone ?? null,
    table: input.table ?? null,
    headToHead: input.headToHead ?? null,
    ...deferred,
    links: input.links ?? [
      { kind: 'competition-matches', label: 'All Caledonian Premiership matches' },
    ],
    unavailable: input.unavailable ?? [],
  }
}

const rich = {
  home: side(T.glenmore, 'WWDLW', 3, 8),
  away: side(T.strathkelvin, 'WWWDW', 1, 10),
  table,
  headToHead,
} as const

/* ==========================================================================
   13. SCHEDULED
   ========================================================================== */

/** A match that has not kicked off. No score anywhere, and none available. */
const scheduledCentre: MatchCentreModel = centre({
  id: 'fixture-centre-scheduled',
  ...rich,
  state: { kind: 'scheduled', kickoff: '2027-08-21T14:00:00.000Z' },
  prediction: { kind: 'entered', score: { home: 2, away: 1 } },
  links: [
    { kind: 'match-predictor', label: 'Enter your prediction in the Match Predictor' },
    { kind: 'competition-matches', label: 'All Caledonian Premiership matches' },
  ],
})

/* ==========================================================================
   14. LIVE, WITH A MINUTE
   ========================================================================== */

/**
 * The state a richer provider allows, and the reason `MatchClockPresentation`
 * exists at all. NOTHING IN THIS REPOSITORY CAN CURRENTLY PRODUCE IT.
 */
const liveWithMinuteCentre: MatchCentreModel = centre({
  id: 'fixture-centre-live-minute',
  ...rich,
  state: {
    kind: 'live',
    kickoff: '2027-08-21T14:00:00.000Z',
    observation: {
      observedAt: '2027-08-21T15:51:10.000Z',
      observedAtLabel: observedTime('2027-08-21T15:51:10.000Z'),
      score: { home: 2, away: 1 },
      clock: { label: "67'", minute: 67, addedMinutes: null },
      phaseLabel: 'Live',
    },
  },
  prediction: { kind: 'locked', score: { home: 2, away: 1 } },
})

/* ==========================================================================
   15. LIVE, WITHOUT A MINUTE — THE REAL ONE
   ========================================================================== */

/**
 * THE STATE EVERY CONNECTED LIVE MATCH ACTUALLY LANDS IN.
 *
 * The provider says in play and reports a score. It does not say what minute it
 * is, because contract 135's projection has no minute field. The page says
 * "Live", gives the score as provisional, and says when the score was observed
 * — and it invents nothing. Put it beside world 14: the difference should be
 * one small label and not a page that looks broken.
 */
const liveWithoutMinuteCentre: MatchCentreModel = centre({
  id: 'fixture-centre-live-no-minute',
  ...rich,
  state: {
    kind: 'live',
    kickoff: '2027-08-21T14:00:00.000Z',
    observation: {
      observedAt: '2027-08-21T15:51:10.000Z',
      observedAtLabel: observedTime('2027-08-21T15:51:10.000Z'),
      score: { home: 2, away: 1 },
      clock: null,
      phaseLabel: 'Live',
    },
  },
  prediction: { kind: 'locked', score: { home: 2, away: 1 } },
})

/* ==========================================================================
   15b. LIVE, AND NO SCORE REPORTED AT ALL
   ========================================================================== */

/**
 * IN PLAY, AND THE PROVIDER HAS SENT NO NUMBERS.
 *
 * A real and reachable state: contract 135's block carries a `kind` and two
 * OPTIONAL scores, so a feed reporting a match in play before a goal has a
 * state and no scoreline — which `seasonFixtureListModel` documents as
 * information rather than as a gap.
 *
 * IT IS THE WORLD A DEFECT HID BEHIND. Every other live world here carries a
 * score, so nothing exercised the branch where the hero prints the KICKOFF TIME
 * (there being no score to print) while the line beneath it announced
 * "Provisional score observed at 15:41" — a score claimed where none exists,
 * directly under a number that is not one. The page now says "No score reported
 * yet · provider last reported at 15:41", and this world is what keeps it true.
 */
const liveWithoutScoreCentre: MatchCentreModel = centre({
  id: 'fixture-centre-live-no-score',
  ...rich,
  state: {
    kind: 'live',
    kickoff: '2027-08-21T14:00:00.000Z',
    observation: {
      observedAt: '2027-08-21T15:51:10.000Z',
      observedAtLabel: observedTime('2027-08-21T15:51:10.000Z'),
      score: null,
      clock: null,
      phaseLabel: 'Live',
    },
  },
  prediction: { kind: 'locked', score: { home: 2, away: 1 } },
})

/* ==========================================================================
   16. HALF-TIME
   ========================================================================== */

/**
 * Half-time, which the platform ALSO cannot currently prove — contract 135's
 * `in_play` does not distinguish the interval. The world exists for the same
 * reason as the minute: the presentation is ready, the mapper is not allowed to
 * pretend.
 */
const halfTimeCentre: MatchCentreModel = centre({
  id: 'fixture-centre-half-time',
  ...rich,
  state: {
    kind: 'live',
    kickoff: '2027-08-21T14:00:00.000Z',
    observation: {
      observedAt: '2027-08-21T14:47:00.000Z',
      observedAtLabel: observedTime('2027-08-21T14:47:00.000Z'),
      score: { home: 1, away: 0 },
      clock: { label: 'HT', minute: 45, addedMinutes: null },
      phaseLabel: 'Half-time',
    },
  },
  prediction: { kind: 'locked', score: { home: 2, away: 1 } },
})

/* ==========================================================================
   17. FULL TIME
   ========================================================================== */

/** The platform settled it. The score is official and says so. */
const fullTimeCentre: MatchCentreModel = centre({
  id: 'fixture-centre-full-time',
  ...rich,
  state: {
    kind: 'finished',
    kickoff: '2027-08-21T14:00:00.000Z',
    result: { home: 2, away: 1 },
    decision: null,
    aggregate: null,
  },
  prediction: {
    kind: 'settled',
    score: { home: 2, away: 1 },
    outcomeLabel: 'Exact score',
    points: 5,
  },
})

/* ==========================================================================
   18. AWAITING RESULT — the provider says over, the platform has not settled
   ========================================================================== */

/**
 * THE STATE THE WHOLE PROVIDER/PLATFORM DISTINCTION EXISTS FOR.
 *
 * A feed reports the match final. The platform has not confirmed a result, so
 * there is no official score — and the page must say the score is provisional
 * while saying the football is over. Collapsing this into `finished` would be a
 * browser promoting a feed to a settlement, which is the one thing the whole
 * ingestion boundary is built to prevent.
 */
const awaitingResultCentre: MatchCentreModel = centre({
  id: 'fixture-centre-awaiting',
  ...rich,
  state: {
    kind: 'awaitingResult',
    kickoff: '2027-08-21T14:00:00.000Z',
    observation: {
      observedAt: '2027-08-21T15:50:00.000Z',
      observedAtLabel: observedTime('2027-08-21T15:50:00.000Z'),
      score: { home: 2, away: 1 },
      clock: null,
      phaseLabel: 'Full time',
    },
  },
  prediction: { kind: 'locked', score: { home: 2, away: 1 } },
})

/* ==========================================================================
   19. POSTPONED
   ========================================================================== */

/**
 * NO LIVE FURNITURE ANYWHERE. No pulse, no minute, no score, no "follow live".
 * The state is said plainly, the reason is given where the competition gave
 * one, and the rest of the page is still the football context it always was.
 */
const postponedCentre: MatchCentreModel = centre({
  id: 'fixture-centre-postponed',
  ...rich,
  state: {
    kind: 'postponed',
    kickoff: '2027-08-21T14:00:00.000Z',
    note: 'Waterlogged pitch. A new date has not been set.',
  },
})

/* ==========================================================================
   20. EXTRA TIME AND PENALTIES
   ========================================================================== */

/** A knockout decided in extra time. `decision` is null from every read today. */
const extraTimeCentre: MatchCentreModel = centre({
  id: 'fixture-centre-extra-time',
  competition: cup,
  stage: quarterFinal,
  home: side(T.glenmore, 'WWDLW', null, null),
  away: side(T.carrickvale, 'DLWWD', null, null),
  // A cup tie has no league table, and drawing one would be meaningless — §21.
  table: null,
  headToHead,
  state: {
    kind: 'finished',
    kickoff: '2027-08-21T14:00:00.000Z',
    result: { home: 3, away: 1 },
    decision: { kind: 'afterExtraTime' },
    aggregate: null,
  },
  links: [{ kind: 'competition-matches', label: 'All Caledonian Cup matches' }],
})

/** A shootout, with the aggregate of a two-legged tie beside it. */
const penaltiesCentre: MatchCentreModel = centre({
  id: 'fixture-centre-penalties',
  competition: cup,
  stage: quarterFinal,
  home: side(T.strathkelvin, 'WWWDW', null, null),
  away: side(T.invercaledonian, 'LDWLL', null, null),
  table: null,
  headToHead,
  state: {
    kind: 'finished',
    kickoff: '2027-08-21T18:45:00.000Z',
    result: { home: 1, away: 1 },
    decision: { kind: 'afterPenalties', shootout: { home: 5, away: 4 } },
    aggregate: { label: '2–2 on aggregate', score: { home: 2, away: 2 } },
  },
  kickoffLabel: '19:45',
  links: [{ kind: 'competition-matches', label: 'All Caledonian Cup matches' }],
})

/* ==========================================================================
   21. RICH CONTEXT
   ========================================================================== */

/**
 * EVERYTHING THE PLATFORM CAN ACTUALLY SUPPLY, AT ONCE.
 *
 * A table, both form runs, this season's meetings and the player's own
 * prediction. This is the CEILING of an honest Match Centre today — and it is
 * worth noticing how much football that still is without a single provider
 * enrichment.
 */
const richContextCentre: MatchCentreModel = centre({
  id: 'fixture-centre-rich',
  ...rich,
  state: {
    kind: 'scheduled',
    kickoff: '2027-08-21T14:00:00.000Z',
  },
  prediction: { kind: 'entered', score: { home: 2, away: 1 } },
  links: [
    { kind: 'match-predictor', label: 'Enter your prediction in the Match Predictor' },
    { kind: 'competition-matches', label: 'All Caledonian Premiership matches' },
  ],
})

/* ==========================================================================
   22. CORE ONLY
   ========================================================================== */

/**
 * THE FLOOR, AND IT MUST STILL BE A GOOD PAGE.
 *
 * Two clubs, a kickoff, a stage and a competition. No table, no form, no
 * head-to-head, no prediction. Every optional module is absent rather than
 * empty: there are no headings over nothing, no zeroed statistics and no
 * "coming soon". This is what a brand-new competition's first fixture looks
 * like, and it is a real state a real player will meet.
 */
const coreOnlyCentre: MatchCentreModel = centre({
  id: 'fixture-centre-core',
  home: bareSide(T.dunveggie),
  away: bareSide(T.arbrennan),
  state: { kind: 'scheduled', kickoff: '2027-08-21T14:00:00.000Z' },
  table: null,
  headToHead: null,
  unavailable: ['table', 'recent form', 'head-to-head'],
})

/* ==========================================================================
   23. STALE PROVIDER
   ========================================================================== */

/**
 * A LIVE MATCH WHOSE FEED HAS NOT REPORTED FOR A LONG TIME.
 *
 * The observation instant is eleven minutes old. The page must not hide that
 * and must not silently keep drawing the number as though it were current —
 * "observed at 15:41" is checkable, and it is the only honest thing a surface
 * can say about a feed that has gone quiet. It also must not invent a minute to
 * fill the gap, which is precisely the temptation when a score stops moving.
 */
const staleProviderCentre: MatchCentreModel = centre({
  id: 'fixture-centre-stale',
  ...rich,
  state: {
    kind: 'live',
    kickoff: '2027-08-21T14:00:00.000Z',
    observation: {
      observedAt: '2027-08-21T14:41:00.000Z',
      observedAtLabel: observedTime('2027-08-21T14:41:00.000Z'),
      score: { home: 1, away: 0 },
      clock: null,
      phaseLabel: 'Live',
    },
  },
  unavailable: ['head-to-head'],
  headToHead: null,
})

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

/* ==========================================================================
   THE THREE SOCIAL SCOPES
   ==========================================================================

   Four worlds, chosen for the four things that are easiest to get wrong and
   hardest to cause on purpose: everything answering at once, a hidden league
   beside a revealed one, a cohort the server withheld, and three reads that
   each failed differently.
   ========================================================================== */

/** Everything answered. The world the modules were designed against. */
const socialRichCentre = centre({
  id: 'mc-social-rich',
  ...rich,
  state: {
    kind: 'finished',
    kickoff: '2027-08-21T14:00:00.000Z',
    result: { home: 2, away: 1 },
    decision: null,
    aggregate: null,
  },
  you: {
    kind: 'ready',
    prediction: '2 - 1',
    result: '2 - 1',
    provisional: null,
    outcome: 'scored',
    points: 5,
    exact: true,
    matchweekPoints: 34,
    jokerNote:
      'Your Joker is on this matchweek, so the matchweek total is doubled. It doubles the whole card, never one fixture.',
    explanation: 'Exact score. 5 points from this fixture.',
  },
  leagues: [
    {
      kind: 'ready',
      leagueId: 'lg-1',
      leagueName: 'The Sunday League',
      memberCount: 8,
      predictedCount: 6,
      rows: [
        {
          playerRef: 'p-1',
          displayName: 'Ada Lovelace',
          isSelf: true,
          predictionLabel: '2 - 1',
          outcome: 'exact',
          matchweekPoints: 34,
          jokerPlayed: true,
        },
        {
          playerRef: 'p-2',
          displayName: 'Bo Nilsson',
          isSelf: false,
          predictionLabel: '1 - 1',
          outcome: 'wrong',
          matchweekPoints: 21,
          jokerPlayed: false,
        },
      ],
    },
  ],
  everyone: {
    kind: 'ready',
    submittedEntries: 412,
    popular: [
      { label: '1 - 1', percentage: 18 },
      { label: '2 - 1', percentage: 14 },
      { label: '1 - 0', percentage: 11 },
    ],
    homeWinPercentage: 46,
    drawPercentage: 27,
    awayWinPercentage: 27,
  },
})

/**
 * A LOCKED LEAGUE BESIDE A HIDDEN ONE, which is the ordinary case in a player
 * who is in two: one matchweek has locked and one has not, and the two must not
 * read as the same thing.
 */
const socialHiddenLeagueCentre = centre({
  id: 'mc-social-hidden',
  ...rich,
  state: { kind: 'scheduled', kickoff: '2027-08-21T14:00:00.000Z' },
  you: {
    kind: 'ready',
    prediction: '1 - 0',
    result: null,
    provisional: null,
    outcome: 'pending',
    points: null,
    exact: false,
    matchweekPoints: null,
    jokerNote: null,
    explanation: 'This fixture has not been settled yet.',
  },
  leagues: [
    {
      kind: 'hidden',
      leagueId: 'lg-1',
      leagueName: 'The Sunday League',
      locksAt: '2027-08-21T14:00:00.000Z',
    },
    { kind: 'empty', leagueId: 'lg-2', leagueName: 'Work five-a-side' },
  ],
  everyone: { kind: 'withheld', minimumEntries: 25 },
})

/**
 * THREE FAILURES, EACH ITS OWN. The fixture above them is complete and
 * unaffected, which is the property that matters: an enrichment that did not
 * answer costs its own module and never the match.
 */
const socialUnavailableCentre = centre({
  id: 'mc-social-unavailable',
  ...rich,
  state: {
    kind: 'finished',
    kickoff: '2027-08-21T14:00:00.000Z',
    result: { home: 2, away: 1 },
    decision: null,
    aggregate: null,
  },
  you: { kind: 'unavailable' },
  leagues: [
    { kind: 'unavailable', leagueId: 'lg-1', leagueName: 'The Sunday League' },
  ],
  everyone: { kind: 'unavailable' },
})

/**
 * NOT PLAYING. Fixtures are readable by anyone following the competition, and
 * most readers have not joined every game behind them — so this is the common
 * case rather than the edge one, and it must not read as a missed deadline.
 */
const socialNotPlayingCentre = centre({
  id: 'mc-social-not-playing',
  ...rich,
  state: {
    kind: 'finished',
    kickoff: '2027-08-21T14:00:00.000Z',
    result: { home: 2, away: 1 },
    decision: null,
    aggregate: null,
  },
  you: { kind: 'not-playing' },
  leagues: [],
  everyone: {
    kind: 'ready',
    submittedEntries: 412,
    popular: [{ label: '1 - 1', percentage: 18 }],
    homeWinPercentage: 46,
    drawPercentage: 27,
    awayWinPercentage: 27,
  },
})

export const matchCentreScenarios = {
  scheduled: scheduledCentre,
  liveWithMinute: liveWithMinuteCentre,
  liveWithoutMinute: liveWithoutMinuteCentre,
  liveWithoutScore: liveWithoutScoreCentre,
  halfTime: halfTimeCentre,
  fullTime: fullTimeCentre,
  awaitingResult: awaitingResultCentre,
  postponed: postponedCentre,
  extraTime: extraTimeCentre,
  penalties: penaltiesCentre,
  richContext: richContextCentre,
  coreOnly: coreOnlyCentre,
  staleProvider: staleProviderCentre,
  socialRich: socialRichCentre,
  socialHiddenLeague: socialHiddenLeagueCentre,
  socialUnavailable: socialUnavailableCentre,
  socialNotPlaying: socialNotPlayingCentre,
} as const

export type MatchCentreScenarioName = keyof typeof matchCentreScenarios

export const matchCentreScenarioNames = Object.keys(
  matchCentreScenarios,
) as readonly MatchCentreScenarioName[]

export const matchCentreScenarioPremises: Readonly<
  Record<MatchCentreScenarioName, string>
> = {
  scheduled: 'Not kicked off. No score anywhere, and a clear path to the Match Predictor.',
  liveWithMinute: 'Live with a minute — the state a richer provider would allow. Nothing here can currently produce it.',
  liveWithoutMinute: 'Live WITHOUT a minute — the state every connected live match actually lands in. Compare it with the one above.',
  liveWithoutScore: 'Live, and the provider has sent NO score. The hero shows the kickoff because there is nothing else to show, and the page must not announce a provisional score that does not exist.',
  halfTime: 'Half-time. Also unprovable today: contract 135’s in_play does not distinguish the interval.',
  fullTime: 'The platform settled a result. The score is official and the page says so.',
  awaitingResult: 'A provider says the match is over; the platform has not settled it. The score is still provisional.',
  postponed: 'Postponed. No pulse, no minute, no score, no live affordance anywhere.',
  extraTime: 'A cup tie decided in extra time — and no league table, because a knockout has none.',
  penalties: 'A shootout, with a two-legged aggregate beside it. Neither is producible from any current read.',
  richContext: 'The ceiling of an honest Match Centre today: table, both form runs, this season’s meetings, the player’s prediction.',
  coreOnly: 'The floor. Two clubs, a kickoff, a stage. Every optional module ABSENT rather than empty.',
  staleProvider: 'A live feed that has not reported for eleven minutes. Said plainly, and no minute invented to fill the gap.',
  socialRich:
    'You, Your leagues and Everyone all answering at once. Three scopes, three sections, never merged.',
  socialHiddenLeague:
    'One league still hidden and one with nobody in it, beside a cohort the server withheld. Four different sentences, none of them silence.',
  socialUnavailable:
    'All three enrichments failed and the fixture above them is untouched. Each module names its own failure.',
  socialNotPlaying:
    'A reader who has not joined the Match Predictor. Not an error, not an empty prediction, and Everyone still answers.',
}
