/**
 * STAGE 8'S DETERMINISTIC MATCH WORLDS.
 *
 * Twelve fixture-list worlds and twelve Match Centre worlds, each one a
 * PREMISE rather than a data dump: the reason it exists is written beside it,
 * and a reviewer reading the Storybook group is reading the reasons.
 *
 * NOTHING HERE READS A CLOCK. Every instant is a fixed ISO string and every
 * model carries the `generatedAt` it describes, so a story rendered at midnight
 * and a story rendered at noon are the same picture. That is not tidiness: the
 * whole point of this stage is that live state comes from an observation and
 * never from `Date.now()`, and a fixture file that reached for a clock would be
 * the first place that rule broke.
 *
 * THESE ARE PRESENTATION INPUTS AND NOT A CLUB REGISTRY. The clubs are the
 * workshop's invented sides; the competitions are invented too. Nothing
 * downstream may treat either as real football data.
 */

import type {
  MatchCompetitionRef,
  MatchDayGroup,
  MatchListItem,
  MatchState,
  MatchStageRef,
  MatchesModel,
  MatchTeam,
} from '../../models/matches'
import { workshopTeams } from '../teams/teams'

/**
 * The instant every world below describes.
 *
 * MODULE-LOCAL. A world carries its own `generatedAt`, so nothing outside this
 * file needs the constant — and an exported name with no caller is a second
 * vocabulary waiting for somebody to use it where the model's own field would
 * have done.
 */
const MATCHES_NOW = '2027-08-21T15:52:00.000Z'

/* ==========================================================================
   COMPETITIONS
   ========================================================================== */

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

const continental: MatchCompetitionRef = {
  id: 'competition-workshop-continental',
  name: 'Northern Isles Champions Trophy',
  shortName: 'Champions Trophy',
  seasonLabel: '2027/28',
  colours: { primary: '#12324A', accent: '#48D6C6' },
}

/**
 * A competition whose real name is far longer than any rail, chip or row was
 * designed for. It exists so "long competition name" is a world rather than a
 * thing somebody remembers to try.
 */
const longNamed: MatchCompetitionRef = {
  id: 'competition-workshop-long',
  name: 'Highlands and Northern Islands Invitational Championship Series',
  shortName: 'Highlands and Northern Islands Invitational',
  seasonLabel: '2027/28',
  colours: { primary: '#2C1A4A', accent: '#A78BFA' },
}

/* ==========================================================================
   STAGES — the competition's own words, never constructed
   ========================================================================== */

const matchweek: (ordinal: number) => MatchStageRef = (ordinal) => ({
  id: `round-mw-${ordinal}`,
  ordinal,
  label: `Matchweek ${ordinal}`,
  // Null everywhere, exactly as the real read leaves it. A fixture world that
  // filled this in would be proving a capability the backend does not have.
  kind: null,
})

const groupStage: MatchStageRef = {
  id: 'round-group-a-2',
  ordinal: 2,
  label: 'Group A · Matchday 2',
  kind: null,
}

const quarterFinal: MatchStageRef = {
  id: 'round-qf',
  ordinal: 4,
  label: 'Quarter-finals',
  kind: null,
}

const semiFinalSecondLeg: MatchStageRef = {
  id: 'round-sf-2',
  ordinal: 5,
  label: 'Semi-final, second leg',
  kind: null,
}

/* ==========================================================================
   STATE BUILDERS — the only place a world states a match state
   ========================================================================== */

/**
 * An observation instant as a time of day.
 *
 * PINNED, WHERE THE MAPPER'S IS THE VIEWER'S. The connected mapper resolves the
 * reader's own zone, which is the product rule; a WORLD may not, or the same
 * story would be a different picture in two time zones and a screenshot could
 * not be compared with yesterday's. That difference is deliberate and is the
 * only one: the field, its meaning and its position are identical.
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

const scheduled = (kickoff: string | null, rescheduled = false): MatchState => ({
  kind: 'scheduled',
  kickoff,
  rescheduled,
})

/** Live, WITH a minute — the state a richer provider would allow. */
const liveWithMinute = (
  kickoff: string,
  home: number,
  away: number,
  minute: number,
  observedAt: string,
): MatchState => ({
  kind: 'live',
  kickoff,
  observation: {
    observedAt,
    observedAtLabel: observedTime(observedAt),
    score: { home, away },
    clock: { label: `${minute}'`, minute, addedMinutes: null },
    phaseLabel: 'Live',
  },
})

/**
 * LIVE WITHOUT A MINUTE — and this is the state the PLATFORM can actually
 * prove today.
 *
 * Contract 135's projection carries a status, two optional scores and an
 * observation instant. There is no minute, no period and no added time
 * anywhere in it. Every connected fixture in play therefore lands here, and
 * the worlds that carry a minute exist to prove the presentation is ready for
 * a provider that supplies one — not to suggest that one does.
 */
const liveWithoutMinute = (
  kickoff: string,
  score: { home: number; away: number } | null,
  observedAt: string,
): MatchState => ({
  kind: 'live',
  kickoff,
  observation: {
    observedAt,
    observedAtLabel: observedTime(observedAt),
    score,
    clock: null,
    phaseLabel: 'Live',
  },
})

const halfTime = (kickoff: string, home: number, away: number, observedAt: string): MatchState => ({
  kind: 'live',
  kickoff,
  observation: {
    observedAt,
    observedAtLabel: observedTime(observedAt),
    score: { home, away },
    clock: { label: 'HT', minute: 45, addedMinutes: null },
    phaseLabel: 'Half-time',
  },
})

const finished = (kickoff: string, home: number, away: number): MatchState => ({
  kind: 'finished',
  kickoff,
  result: { home, away },
  decision: null,
  aggregate: null,
})

const postponed = (
  kickoff: string | null,
  note: string | null = null,
  rescheduled = false,
): MatchState => ({
  kind: 'postponed',
  kickoff,
  note,
  rescheduled,
})

/* ==========================================================================
   ROWS
   ========================================================================== */

type RowInput = {
  id: string
  competition?: MatchCompetitionRef
  stage?: MatchStageRef
  home: MatchTeam
  away: MatchTeam
  state: MatchState
  kickoffLabel?: string | null
  contextLabel?: string | null
  prediction?: MatchListItem['prediction']
}

/**
 * The accessible sentence, written the way it is READ.
 *
 * "Glenmore Athletic 2, Porthaven City 1" and never "2 1 Glenmore Porthaven" —
 * §31's requirement, and the reason it is built here rather than in a component
 * is that a component assembling it from three spans is exactly how a score
 * ends up announced as two loose numbers.
 */
function summarise(input: RowInput, context: string | null): string {
  const { home, away, state } = input
  // WORD FOR WORD THE MAPPER'S SENTENCE, including the trailing context clause.
  // A world whose wording drifts from the connected one means the sentence
  // under review in Storybook is not the sentence that ships — the same "one
  // state machine, not two" argument this stage makes about state, applied to
  // the one string a screen-reader user actually receives.
  const where = context === null ? '' : `, ${context}`
  switch (state.kind) {
    case 'finished':
      return `${home.name} ${state.result.home}, ${away.name} ${state.result.away}, full time${where}`
    case 'live':
    case 'awaitingResult': {
      const score = state.observation.score
      const clock = state.observation.clock
      const phase = clock
        ? `${state.observation.phaseLabel.toLowerCase()}, ${clock.label}`
        : state.observation.phaseLabel.toLowerCase()
      return score
        ? `${home.name} ${score.home}, ${away.name} ${score.away}, ${phase}, provisional score${where}`
        : `${home.name} against ${away.name}, ${phase}, no score reported${where}`
    }
    case 'postponed':
      return `${home.name} against ${away.name}, postponed${where}`
    case 'abandoned':
      return `${home.name} against ${away.name}, abandoned${where}`
    case 'void':
      return `${home.name} against ${away.name}, void${where}`
    default:
      return input.kickoffLabel
        ? `${home.name} against ${away.name}, kick-off ${input.kickoffLabel}${where}`
        : `${home.name} against ${away.name}, kick-off to be confirmed${where}`
  }
}

function row(input: RowInput): MatchListItem {
  const contextLabel = input.contextLabel ?? null
  return {
    id: input.id,
    competition: input.competition ?? premiership,
    stage: input.stage ?? matchweek(4),
    home: input.home,
    away: input.away,
    state: input.state,
    kickoffLabel: input.kickoffLabel ?? null,
    contextLabel,
    prediction: input.prediction ?? null,
    // The context travels into the sentence, exactly as the mapper does it:
    // everything visible on a row is `aria-hidden`, so this IS the row's name.
    accessibleSummary: summarise(input, contextLabel),
  }
}

const T = workshopTeams

/* ==========================================================================
   MODEL BUILDER
   ========================================================================== */

function countsOf(days: readonly MatchDayGroup[]): MatchesModel['counts'] {
  const all = days.flatMap((day) => day.matches)
  const phase = (item: MatchListItem) =>
    item.state.kind === 'live'
      ? 'live'
      : item.state.kind === 'finished' || item.state.kind === 'awaitingResult'
        ? 'finished'
        : 'upcoming'
  return {
    all: all.length,
    live: all.filter((item) => phase(item) === 'live').length,
    upcoming: all.filter((item) => phase(item) === 'upcoming').length,
    finished: all.filter((item) => phase(item) === 'finished').length,
  }
}

function stagesOf(days: readonly MatchDayGroup[]): MatchesModel['stages'] {
  const seen = new Map<string, { id: string; label: string; ordinal: number; matches: number }>()
  for (const match of days.flatMap((day) => day.matches)) {
    const found = seen.get(match.stage.id)
    if (found) seen.set(match.stage.id, { ...found, matches: found.matches + 1 })
    else
      seen.set(match.stage.id, {
        id: match.stage.id,
        label: match.stage.label,
        ordinal: match.stage.ordinal,
        matches: 1,
      })
  }
  return [...seen.values()].sort((left, right) => left.ordinal - right.ordinal)
}

function day(key: string, label: string, matches: readonly MatchListItem[]): MatchDayGroup {
  const stages = new Set(matches.map((match) => match.stage.id))
  return { key, label, mixedStages: stages.size > 1, matches }
}

function model(input: {
  competition?: MatchCompetitionRef
  days: readonly MatchDayGroup[]
  scope?: Partial<MatchesModel['scope']>
  windowLabel?: string | null
  unavailable?: readonly string[]
}): MatchesModel {
  return {
    generatedAt: MATCHES_NOW,
    competition: input.competition ?? premiership,
    scope: {
      active: input.scope?.active ?? 'competition',
      combinedAvailable: input.scope?.combinedAvailable ?? false,
      competitionCount: input.scope?.competitionCount ?? 1,
    },
    windowLabel: input.windowLabel ?? '14 August – 4 September',
    days: input.days,
    stages: stagesOf(input.days),
    counts: countsOf(input.days),
    unavailable: input.unavailable ?? [],
  }
}

/* ==========================================================================
   1. A NORMAL UPCOMING MATCHWEEK
   ========================================================================== */

/**
 * The ordinary Saturday, and the one the whole design has to be good at.
 * Nothing is live, nothing has finished, and the page's job is "what is on and
 * which one do I want to open".
 */
const upcomingMatchweek: MatchesModel = model({
  days: [
    day('2027-08-21', 'Saturday 21 August', [
      row({
        id: 'fixture-upc-1',
        home: T.glenmore,
        away: T.strathkelvin,
        state: scheduled('2027-08-21T14:00:00.000Z'),
        kickoffLabel: '15:00',
        prediction: { kind: 'entered', score: { home: 2, away: 1 } },
      }),
      row({
        id: 'fixture-upc-2',
        home: T.carrickvale,
        away: T.balmorral,
        state: scheduled('2027-08-21T14:00:00.000Z'),
        kickoffLabel: '15:00',
        prediction: { kind: 'needed' },
      }),
      row({
        id: 'fixture-upc-3',
        home: T.porthaven,
        away: T.eastcraig,
        state: scheduled('2027-08-21T16:30:00.000Z'),
        kickoffLabel: '17:30',
        prediction: { kind: 'needed' },
      }),
    ]),
    day('2027-08-22', 'Sunday 22 August', [
      row({
        id: 'fixture-upc-4',
        home: T.invercaledonian,
        away: T.dunveggie,
        state: scheduled('2027-08-22T11:30:00.000Z'),
        kickoffLabel: '12:30',
        prediction: { kind: 'needed' },
      }),
      row({
        id: 'fixture-upc-5',
        home: T.kirktonmuir,
        away: T.arbrennan,
        state: scheduled('2027-08-22T14:00:00.000Z'),
        kickoffLabel: '15:00',
        prediction: { kind: 'needed' },
      }),
    ]),
  ],
})

/* ==========================================================================
   2. SEVERAL MATCHES LIVE
   ========================================================================== */

/**
 * THE STATE THE PRODUCT EXISTS FOR, and the honest version of it.
 *
 * Three matches in play. Two carry a minute; ONE DOES NOT, and it is not an
 * error state — it is what the platform can actually prove today. Put this
 * beside the row that has a minute and check that the one without still reads
 * as football happening right now.
 */
const severalLive: MatchesModel = model({
  days: [
    day('2027-08-21', 'Saturday 21 August', [
      row({
        id: 'fixture-live-1',
        home: T.glenmore,
        away: T.strathkelvin,
        state: liveWithMinute('2027-08-21T14:00:00.000Z', 2, 1, 67, '2027-08-21T15:51:10.000Z'),
        kickoffLabel: '15:00',
        prediction: { kind: 'locked', score: { home: 2, away: 1 } },
      }),
      row({
        id: 'fixture-live-2',
        home: T.carrickvale,
        away: T.balmorral,
        state: halfTime('2027-08-21T14:00:00.000Z', 0, 3, '2027-08-21T15:47:00.000Z'),
        kickoffLabel: '15:00',
        prediction: { kind: 'locked', score: { home: 1, away: 1 } },
      }),
      row({
        id: 'fixture-live-3',
        home: T.porthaven,
        away: T.eastcraig,
        state: liveWithoutMinute(
          '2027-08-21T14:00:00.000Z',
          { home: 1, away: 1 },
          '2027-08-21T15:49:30.000Z',
        ),
        kickoffLabel: '15:00',
        prediction: { kind: 'locked', score: { home: 0, away: 2 } },
      }),
      row({
        id: 'fixture-live-4',
        home: T.invercaledonian,
        away: T.dunveggie,
        state: scheduled('2027-08-21T16:30:00.000Z'),
        kickoffLabel: '17:30',
        prediction: { kind: 'needed' },
      }),
    ]),
  ],
})

/* ==========================================================================
   3. MIXED — live, upcoming and finished on one page
   ========================================================================== */

/** The hardest ordinary state: three phases in one column, at one glance. */
const mixedMatchday: MatchesModel = model({
  days: [
    day('2027-08-20', 'Friday 20 August', [
      row({
        id: 'fixture-mix-1',
        home: T.kirktonmuir,
        away: T.arbrennan,
        state: finished('2027-08-20T18:45:00.000Z', 1, 1),
        kickoffLabel: '19:45',
        prediction: {
          kind: 'settled',
          score: { home: 1, away: 1 },
          outcomeLabel: 'Exact score',
          points: 5,
        },
      }),
    ]),
    day('2027-08-21', 'Saturday 21 August', [
      row({
        id: 'fixture-mix-2',
        home: T.glenmore,
        away: T.strathkelvin,
        state: liveWithMinute('2027-08-21T14:00:00.000Z', 2, 1, 67, '2027-08-21T15:51:10.000Z'),
        kickoffLabel: '15:00',
        prediction: { kind: 'locked', score: { home: 2, away: 1 } },
      }),
      row({
        id: 'fixture-mix-3',
        home: T.carrickvale,
        away: T.balmorral,
        state: finished('2027-08-21T11:30:00.000Z', 0, 2),
        kickoffLabel: '12:30',
        prediction: {
          kind: 'settled',
          score: { home: 1, away: 1 },
          outcomeLabel: 'Missed',
          points: 0,
        },
      }),
      row({
        id: 'fixture-mix-4',
        home: T.porthaven,
        away: T.eastcraig,
        state: scheduled('2027-08-21T16:30:00.000Z'),
        kickoffLabel: '17:30',
        prediction: { kind: 'needed' },
      }),
      // A fixture postponed out of an earlier matchweek and played today. The
      // day therefore MIXES stages, which is the case the stage label exists
      // for — and the reason a list is ordered by kickoff and labelled by
      // stage rather than grouped by stage.
      row({
        id: 'fixture-mix-5',
        home: T.invercaledonian,
        away: T.dunveggie,
        stage: matchweek(2),
        state: scheduled('2027-08-21T18:45:00.000Z'),
        kickoffLabel: '19:45',
        contextLabel: 'Matchweek 2',
        prediction: { kind: 'needed' },
      }),
    ]),
  ],
})

/* ==========================================================================
   4. ALL FINISHED
   ========================================================================== */

/** A matchweek that is over. Nothing to do, everything to read. */
const allFinished: MatchesModel = model({
  days: [
    day('2027-08-14', 'Saturday 14 August', [
      row({
        id: 'fixture-fin-1',
        stage: matchweek(3),
        home: T.glenmore,
        away: T.carrickvale,
        state: finished('2027-08-14T14:00:00.000Z', 3, 0),
        kickoffLabel: '15:00',
        prediction: {
          kind: 'settled',
          score: { home: 2, away: 0 },
          outcomeLabel: 'Right result',
          points: 2,
        },
      }),
      row({
        id: 'fixture-fin-2',
        stage: matchweek(3),
        home: T.strathkelvin,
        away: T.balmorral,
        state: finished('2027-08-14T14:00:00.000Z', 1, 1),
        kickoffLabel: '15:00',
        prediction: {
          kind: 'settled',
          score: { home: 1, away: 1 },
          outcomeLabel: 'Exact score',
          points: 5,
        },
      }),
      row({
        id: 'fixture-fin-3',
        stage: matchweek(3),
        home: T.porthaven,
        away: T.invercaledonian,
        state: finished('2027-08-14T16:30:00.000Z', 0, 2),
        kickoffLabel: '17:30',
        prediction: {
          kind: 'settled',
          score: { home: 1, away: 0 },
          outcomeLabel: 'Missed',
          points: 0,
        },
      }),
    ]),
  ],
  windowLabel: '7 – 14 August',
})

/* ==========================================================================
   5. NO MATCHES
   ========================================================================== */

/**
 * AN EMPTY WINDOW, WHICH IS NOT AN ERROR AND MUST NOT LOOK LIKE ONE.
 *
 * An international break is the ordinary cause. The page has to say so without
 * apologising and without inventing a fixture to avoid the state.
 */
const noMatches: MatchesModel = model({
  days: [],
  windowLabel: '21 August – 4 September',
})

/* ==========================================================================
   6. POSTPONED
   ========================================================================== */

/**
 * A POSTPONED FIXTURE MUST NOT LOOK LIVE, AND MUST NOT DISAPPEAR.
 *
 * It sits in its original slot with its state said plainly. The one below it
 * has no kickoff at all — a rearranged fixture the league has not timed yet,
 * which is a real row and not a broken one.
 *
 * CONTRACT 209 ADDS THE OTHER TWO ROWS OF THE LIFECYCLE, and the reason they
 * are in this scenario rather than a new one is that they only mean anything
 * beside each other. All four rows below are "this fixture is not where you
 * left it", and a reader has to be able to tell them apart AT A GLANCE:
 *
 *   off, no date        Postponed / New date to be confirmed, no time shown
 *   off, date known     Postponed / Now due …, the new time shown
 *   on, moved here      Rescheduled, the time leading
 *   on, ordinary        the time alone, no chip at all
 *
 * If two of them ever render the same, this is the scenario that shows it.
 */
const postponedDay: MatchesModel = model({
  days: [
    day('2027-08-21', 'Saturday 21 August', [
      row({
        id: 'fixture-pp-1',
        home: T.glenmore,
        away: T.strathkelvin,
        state: postponed('2027-08-21T14:00:00.000Z', 'New date to be confirmed'),
        kickoffLabel: '15:00',
      }),
      row({
        id: 'fixture-pp-4',
        home: T.invercaledonian,
        away: T.dunveggie,
        // Off, but the league has already named the replacement. The instant on
        // the row IS the new one, which is why the mark says "now due" and the
        // page stops calling it "was due".
        state: postponed('2027-09-14T18:45:00.000Z', 'Now due Tue 14 Sep · 19:45', true),
        kickoffLabel: '19:45',
      }),
      row({
        id: 'fixture-pp-5',
        home: T.eastcraig,
        away: T.glenmore,
        // On, and playing today only because it was moved here out of an
        // earlier matchweek — which is what the stage label beside it says.
        stage: matchweek(2),
        state: scheduled('2027-08-21T16:30:00.000Z', true),
        kickoffLabel: '17:30',
        contextLabel: 'Matchweek 2',
        prediction: { kind: 'needed' },
      }),
      row({
        id: 'fixture-pp-2',
        home: T.carrickvale,
        away: T.balmorral,
        state: scheduled('2027-08-21T14:00:00.000Z'),
        kickoffLabel: '15:00',
        prediction: { kind: 'needed' },
      }),
    ]),
    day('undated', 'Date to be confirmed', [
      row({
        id: 'fixture-pp-3',
        home: T.porthaven,
        away: T.eastcraig,
        stage: matchweek(2),
        state: scheduled(null),
        contextLabel: 'Matchweek 2',
      }),
    ]),
  ],
})

/* ==========================================================================
   7. LONG CLUB NAMES
   ========================================================================== */

/**
 * THE WORST REALISTIC STRING, ON PURPOSE.
 *
 * "Inverness Caledonian Rangers" against "Kirktonmuir Wanderers" in a
 * competition whose own name is sixty characters. Nothing may clip: the row
 * grows, the name wraps, and no ellipsis appears anywhere.
 */
const longNames: MatchesModel = model({
  competition: longNamed,
  days: [
    day('2027-08-21', 'Saturday 21 August', [
      row({
        id: 'fixture-long-1',
        competition: longNamed,
        stage: semiFinalSecondLeg,
        home: T.invercaledonian,
        away: T.kirktonmuir,
        state: liveWithMinute('2027-08-21T14:00:00.000Z', 1, 1, 72, '2027-08-21T15:50:00.000Z'),
        kickoffLabel: '15:00',
        contextLabel: 'Semi-final, second leg',
      }),
      row({
        id: 'fixture-long-2',
        competition: longNamed,
        stage: semiFinalSecondLeg,
        home: T.strathkelvin,
        away: T.carrickvale,
        state: scheduled('2027-08-21T18:45:00.000Z'),
        kickoffLabel: '19:45',
        contextLabel: 'Semi-final, second leg',
      }),
    ]),
  ],
})

/* ==========================================================================
   8. MISSING OPTIONAL METADATA — the reduced world
   ========================================================================== */

/**
 * EVERYTHING OPTIONAL, ABSENT.
 *
 * No prediction badge on any row, no stage context, no window label, and one
 * fixture with no kickoff. THIS IS THE SHAPE THE CONNECTED PAGE ACTUALLY
 * PRODUCES for a player who has not joined the Match Predictor, so it is not an
 * edge case — it is the honest default, and it must still look like a premium
 * football product rather than a stripped one.
 */
const sparseMetadata: MatchesModel = model({
  days: [
    day('2027-08-21', 'Saturday 21 August', [
      row({
        id: 'fixture-sparse-1',
        home: T.glenmore,
        away: T.strathkelvin,
        state: liveWithoutMinute('2027-08-21T14:00:00.000Z', null, '2027-08-21T15:48:00.000Z'),
        kickoffLabel: '15:00',
      }),
      row({
        id: 'fixture-sparse-2',
        home: T.carrickvale,
        away: T.balmorral,
        state: scheduled('2027-08-21T16:30:00.000Z'),
        kickoffLabel: '17:30',
      }),
    ]),
    day('undated', 'Date to be confirmed', [
      row({ id: 'fixture-sparse-3', home: T.porthaven, away: T.eastcraig, state: scheduled(null) }),
    ]),
  ],
  windowLabel: null,
  unavailable: ['prediction status'],
})

/* ==========================================================================
   9. GROUP STAGE
   ========================================================================== */

/**
 * A COMPETITION THAT IS NOT A WEEKLY LEAGUE.
 *
 * "Group A · Matchday 2" is the competition's own word for where these matches
 * sit, printed exactly as the server states it. Nothing here says "Matchweek",
 * and nothing counts rounds to produce a name — which is the whole point of §10.
 */
const groupStageMatchday: MatchesModel = model({
  competition: continental,
  days: [
    day('2027-08-21', 'Tuesday 21 September', [
      row({
        id: 'fixture-grp-1',
        competition: continental,
        stage: groupStage,
        home: T.glenmore,
        away: T.arbrennan,
        state: liveWithoutMinute(
          '2027-08-21T18:45:00.000Z',
          { home: 0, away: 0 },
          '2027-08-21T19:20:00.000Z',
        ),
        kickoffLabel: '19:45',
        contextLabel: 'Group A · Matchday 2',
      }),
      row({
        id: 'fixture-grp-2',
        competition: continental,
        stage: groupStage,
        home: T.porthaven,
        away: T.dunveggie,
        state: scheduled('2027-08-21T18:45:00.000Z'),
        kickoffLabel: '19:45',
        contextLabel: 'Group A · Matchday 2',
      }),
    ]),
  ],
})

/* ==========================================================================
   10. KNOCKOUT — extra time and penalties
   ========================================================================== */

/**
 * THE TWO STATES NO CURRENT READ CAN PRODUCE, DRAWN ANYWAY.
 *
 * `season_fixtures` holds one score pair and a status: there is no extra-time
 * column, no shootout and no aggregate. `MatchDecision` and `MatchAggregate`
 * exist so a knockout competition is drawable the day the backend states them,
 * and this world is the design for that day. A test asserts that today's
 * mappers produce `decision: null` and `aggregate: null` for every fixture, so
 * this world can never be mistaken for a claim about the platform.
 */
const knockoutRound: MatchesModel = model({
  competition: cup,
  days: [
    day('2027-08-21', 'Saturday 21 August', [
      row({
        id: 'fixture-ko-1',
        competition: cup,
        stage: quarterFinal,
        home: T.glenmore,
        away: T.carrickvale,
        state: {
          kind: 'finished',
          kickoff: '2027-08-21T14:00:00.000Z',
          result: { home: 2, away: 2 },
          decision: { kind: 'afterPenalties', shootout: { home: 4, away: 3 } },
          aggregate: null,
        },
        kickoffLabel: '15:00',
        contextLabel: 'Quarter-finals',
      }),
      row({
        id: 'fixture-ko-2',
        competition: cup,
        stage: quarterFinal,
        home: T.strathkelvin,
        away: T.balmorral,
        state: {
          kind: 'finished',
          kickoff: '2027-08-21T16:30:00.000Z',
          result: { home: 3, away: 1 },
          decision: { kind: 'afterExtraTime' },
          aggregate: null,
        },
        kickoffLabel: '17:30',
        contextLabel: 'Quarter-finals',
      }),
      row({
        id: 'fixture-ko-3',
        competition: cup,
        stage: semiFinalSecondLeg,
        home: T.porthaven,
        away: T.invercaledonian,
        state: {
          kind: 'finished',
          kickoff: '2027-08-21T18:45:00.000Z',
          result: { home: 1, away: 0 },
          decision: null,
          aggregate: { label: '2–2 on aggregate', score: { home: 2, away: 2 } },
        },
        kickoffLabel: '19:45',
        contextLabel: 'Semi-final, second leg',
      }),
    ]),
  ],
})

/* ==========================================================================
   11. ONE COMPETITION ONLY — the binding product test
   ========================================================================== */

/**
 * THE ONE-COMPETITION PLAYER, AND THE THING THE WHOLE ARCHITECTURE PROMISES.
 *
 * `combinedAvailable` is FALSE and `competitionCount` is 1, so no scope control
 * renders at all. There is nothing on this page to suggest a platform exists —
 * no "across your competitions", no other competition's name, no chooser with
 * one option in it. The Premier League player gets Premier League matches.
 */
const singleCompetition: MatchesModel = model({
  days: upcomingMatchweek.days,
  scope: { active: 'competition', combinedAvailable: false, competitionCount: 1 },
})

/* ==========================================================================
   12. COMBINED — across the player's competitions
   ========================================================================== */

/**
 * THE SECONDARY MODE, AND THE RULE IT LIVES UNDER.
 *
 * EVERY FIXTURE NAMES ITS COMPETITION. That is not a nicety here, it is the
 * condition on which the mode is allowed to exist at all: the moment a reader
 * cannot tell which competition a match is in, the combined view has erased the
 * architecture it is a layer over.
 *
 * IT IS THE PLAYER'S COMPETITIONS AND NEVER THE PLATFORM'S. Three, because this
 * player is in three. A platform with twenty published competitions produces
 * the same three rows.
 */
const combinedTonight: MatchesModel = model({
  scope: { active: 'combined', combinedAvailable: true, competitionCount: 3 },
  days: [
    day('2027-08-21', 'Saturday 21 August', [
      row({
        id: 'fixture-comb-1',
        competition: premiership,
        home: T.glenmore,
        away: T.strathkelvin,
        state: liveWithoutMinute(
          '2027-08-21T14:00:00.000Z',
          { home: 2, away: 1 },
          '2027-08-21T15:50:00.000Z',
        ),
        kickoffLabel: '15:00',
        contextLabel: 'Caledonian Premiership · Matchweek 4',
      }),
      row({
        id: 'fixture-comb-2',
        competition: continental,
        stage: groupStage,
        home: T.porthaven,
        away: T.dunveggie,
        state: scheduled('2027-08-21T18:45:00.000Z'),
        kickoffLabel: '19:45',
        contextLabel: 'Northern Isles Champions Trophy · Group A · Matchday 2',
      }),
      row({
        id: 'fixture-comb-3',
        competition: cup,
        stage: quarterFinal,
        home: T.kirktonmuir,
        away: T.arbrennan,
        state: scheduled('2027-08-21T18:45:00.000Z'),
        kickoffLabel: '19:45',
        contextLabel: 'Caledonian Cup · Quarter-finals',
      }),
    ]),
    day('2027-08-22', 'Sunday 22 August', [
      row({
        id: 'fixture-comb-4',
        competition: premiership,
        home: T.carrickvale,
        away: T.balmorral,
        state: scheduled('2027-08-22T14:00:00.000Z'),
        kickoffLabel: '15:00',
        contextLabel: 'Caledonian Premiership · Matchweek 4',
      }),
    ]),
  ],
})

/* ==========================================================================
   THE LIST REGISTRY
   ========================================================================== */

export const matchesScenarios = {
  upcomingMatchweek,
  severalLive,
  mixedMatchday,
  allFinished,
  noMatches,
  postponedDay,
  longNames,
  sparseMetadata,
  groupStageMatchday,
  knockoutRound,
  singleCompetition,
  combinedTonight,
} as const

export type MatchesScenarioName = keyof typeof matchesScenarios

export const matchesScenarioNames = Object.keys(matchesScenarios) as readonly MatchesScenarioName[]

/** Why each world exists, for the Storybook description and for a reviewer. */
export const matchesScenarioPremises: Readonly<Record<MatchesScenarioName, string>> = {
  upcomingMatchweek: 'The ordinary Saturday. Nothing live, nothing finished — the state the design has to be best at.',
  severalLive: 'Three matches in play, and ONE of them has no minute because the platform cannot prove one. That row must still read as live.',
  mixedMatchday: 'Finished, live and upcoming in one column, plus a fixture postponed out of an earlier matchweek and played today.',
  allFinished: 'A matchweek that is over. Nothing to do, everything to read.',
  noMatches: 'An empty window — an international break. Not an error, and it must not look like one.',
  postponedDay: 'A postponed fixture beside a normal one, and a rearranged fixture with no kickoff at all.',
  longNames: 'The worst realistic strings: a sixty-character competition, two long club names, a long stage name. Nothing may clip.',
  sparseMetadata: 'Every optional field absent — the shape the connected page actually produces for a player who has not joined the game.',
  groupStageMatchday: 'A competition that is not a weekly league. "Group A · Matchday 2" is the server’s own word, printed verbatim.',
  knockoutRound: 'Penalties, extra time and an aggregate — three things no current read can produce. The design for the day they can.',
  singleCompetition: 'The binding product test: one competition, no scope control, no sign anywhere that a platform exists.',
  combinedTonight: 'The SECONDARY across-your-competitions mode. Every fixture names its competition, and the list is the player’s three.',
}
