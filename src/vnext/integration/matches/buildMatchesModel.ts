import type { SeasonFixtureClub, SeasonListFixture } from '../../../services/supabase/seasonFixtureListModel'
import type { ClubIdentityTokens } from '../../../domain/clubIdentity/clubIdentityTypes'
import {
  formatKickoffTime,
  formatMatchDay,
  matchDayKey,
} from '../../../shared/time/kickoff'
import type { Team, TeamKitPattern } from '../../models/football'
import type {
  MatchCompetitionRef,
  MatchDayGroup,
  MatchListItem,
  MatchObservation,
  MatchStageRef,
  MatchState,
  MatchesFilter,
  MatchesModel,
  MatchesScope,
} from '../../models/matches'
import { matchPhase } from '../../models/matches'
import type { MatchesSource } from './matchesSource'
import { postponedScheduleNote } from '../../../shared/fixtures/scheduleNote'

/**
 * `MatchesSource` → `MatchesModel`. PURE: no network, no storage, NO CLOCK and
 * no React — the same four rules `buildHomeModel`, `buildPredictorModel` and
 * `buildShellModel` are written under.
 *
 * ============================ THE ONE THAT MATTERS ========================
 *
 * ONE AMBIENT INPUT, NAMED. "Pure" here means no network, no storage, no clock
 * and no React — it does NOT mean environment-independent. `formatKickoffTime`,
 * `formatMatchDay` and `matchDayKey` are called without a zone, so they resolve
 * the VIEWER's, which is the repository's timezone authority since the owner's
 * 10 August 2026 direction. The consequence is real and is the intended one:
 * the same source produces different day groupings on two devices, because a
 * 22:45 kickoff genuinely falls on different days for different readers. It is
 * still deterministic for a given zone, which is what the tests pin.
 *
 * NO CLOCK. Not `Date.now()`, not `new Date()`, not a comparison of a kickoff
 * against anything. Every state below is read from `fixture.status` and
 * `fixture.live.kind` — two fields the SERVER decided — and the only instants
 * this file touches are ones it formats for display.
 *
 * That is what makes "the live minute is never browser-inferred" testable
 * rather than promised: `tests/vnext/matchesIntegration.test.ts` maps a fixture
 * that kicked off four hours ago with no live block and requires the answer to
 * be `scheduled` with no observation, which is exactly what a clock-reading
 * mapper would get wrong.
 *
 * ============================ TWO KINDS OF TRUTH, KEPT APART ==============
 *
 * `fixture.status` is the PLATFORM's administrative state and it wins.
 * `fixture.live.kind` is a PROVIDER's current opinion and it may only ever
 * REFINE a fixture the platform still calls `scheduled` — into `live`, or into
 * `awaitingResult` where the feed says the football is over and the platform
 * has not settled a result.
 *
 * A PROVIDER MAY NOT POSTPONE, ABANDON OR CANCEL A FIXTURE **HERE**. Contract
 * 135's vocabulary includes all three, and a feed reports them for ordinary
 * reasons — a delayed kickoff, a momentary outage, a mis-mapped fixture.
 * Letting one through would empty a fixture list on a provider's say-so, which
 * is the confirmation boundary the whole ingestion lane exists to hold. The
 * platform's own `postponed`, `abandoned` and `void` are the only ones that
 * reach the model.
 *
 * THAT REFUSAL IS UNCHANGED BY CONTRACT 207, AND IS WHY IT WAS THE RIGHT ONE.
 * Until that contract, `season_fixtures.status` could only become `postponed`
 * by an administrator pressing approve, so the practical effect of this file's
 * rule was that a real postponement never appeared at all. Contract 207 moved
 * the decision to where it belongs — the ingestion boundary applies a
 * provider's postponement, records it, and reverses it when the provider
 * recants — so `fixture.status` now carries the answer this mapper always
 * insisted on reading, and this mapper still reads nothing else.
 *
 * WHAT A MOVED FIXTURE LOOKS LIKE. `fixture.schedule.rescheduled` is contract
 * 117's stored fact, and it travels onto the two states a moved fixture can be
 * in. Nothing here compares a kickoff against anything to decide it — see
 * `MatchState`.
 */
export function buildMatchesModel(source: MatchesSource): MatchesModel {
  const scope: MatchesScope = source.combined === null ? 'competition' : 'combined'
  const competition = competitionRefOf(source)

  const combined = source.combined === null ? null : combinedItems(source)
  const items = combined === null
    ? source.fixtures.map((fixture) => itemOf(fixture, competition, false))
    : combined.items

  const days = groupByDay(items)

  return {
    generatedAt: source.generatedAt,
    competition,
    scope: {
      active: scope,
      // OFFERED ONLY WHERE THE APPLICATION COULD ACTUALLY ENTER IT. A host that
      // cannot answer a cross-competition calendar gets no control rather than
      // one that refuses — the same rule the shell applies to Explore.
      // BOTH CONDITIONS, NOT EITHER — the authority says "and", and the
      // difference is a control that refuses. A host that knows the player has
      // three competitions but cannot answer a cross-competition calendar would,
      // under an `||`, render "Across your 3 competitions" and emit an intent
      // nothing can act on. That is the same defect `matchCentreSource.ts`
      // names for the Match Predictor link: a control that exists and refuses
      // teaches a player the product is broken.
      combinedAvailable:
        source.combined !== null &&
        source.playerCompetitionCount !== null &&
        source.playerCompetitionCount > 1,
      competitionCount: source.playerCompetitionCount ?? 1,
    },
    windowLabel: windowLabelOf(source.window),
    days,
    stages: stagesOf(items),
    counts: countsOf(items),
    // NAMED RATHER THAN SILENTLY DROPPED. Today the only thing the mapper can
    // discover is a combined fixture it could not attribute to a competition;
    // which READS failed is the acquisition hook's knowledge and reaches the
    // model through the screen.
    unavailable: combined?.unavailable ?? [],
  }
}

/* ==========================================================================
   STATE — the file's whole reason for existing
   ========================================================================== */

/**
 * The platform's own vocabulary. `season_fixtures.status` is constrained to
 * exactly these five by the schema, so an unknown value is a payload
 * disagreeing with its own table rather than a state to invent a name for.
 */
export function matchStateOf(fixture: SeasonListFixture): MatchState {
  const kickoff = fixture.kickoffAt
  const rescheduled = fixture.schedule.rescheduled

  switch (fixture.status) {
    case 'postponed':
      // NO PROVIDER SCORE IS CARRIED. A postponed fixture that a feed once
      // reported in play must not keep the numbers: that is how a postponed
      // match ends up drawn with a live scoreline.
      return {
        kind: 'postponed',
        kickoff,
        note: postponedScheduleNote(kickoff, rescheduled),
        rescheduled,
      }

    case 'abandoned':
      return { kind: 'abandoned', kickoff, note: null }

    case 'void':
      return { kind: 'void', kickoff, note: null }

    case 'played':
      // The schema guarantees a score exactly when the status is `played`
      // (`season_fixtures_scores_match_status`), so a null result here is a
      // payload contradicting its own constraint.
      //
      // IT FALLS BACK TO `scheduled`, NOT TO THE PROVIDER. Refining it would
      // let a feed decide the state of a fixture the PLATFORM has already
      // ruled on — the one thing this function exists to prevent — and would
      // put a provisional score on a match the platform calls played. There is
      // no state to show, so the honest answer is the one that shows none.
      return fixture.result === null
        ? { kind: 'scheduled', kickoff, rescheduled }
        : {
            kind: 'finished',
            kickoff,
            result: { home: fixture.result.home, away: fixture.result.away },
            // NULL, ALWAYS. There is no extra-time column, no shootout column
            // and no aggregate anywhere in `season_fixtures`. A knockout drawn
            // with either would be presentation inventing a competition rule.
            decision: null,
            aggregate: null,
          }

    default:
      // `scheduled` — and the only state a provider is allowed to refine.
      return providerRefined(kickoff, fixture)
  }
}

function providerRefined(kickoff: string | null, fixture: SeasonListFixture): MatchState {
  const live = fixture.live
  const rescheduled = fixture.schedule.rescheduled
  if (live === null) return { kind: 'scheduled', kickoff, rescheduled }

  switch (live.kind) {
    case 'in_play':
      return { kind: 'live', kickoff, observation: observationOf(live, 'Live') }

    case 'final':
      // THE PROVIDER SAYS OVER AND THE PLATFORM HAS NOT SETTLED IT. This is the
      // whole reason `awaitingResult` exists: promoting it to `finished` would
      // be a browser turning a feed into a result.
      return { kind: 'awaitingResult', kickoff, observation: observationOf(live, 'Full time') }

    default:
      // `scheduled`, `postponed`, `abandoned`, `cancelled`, `unknown`. None of
      // them may move the platform's own state — see the header.
      return { kind: 'scheduled', kickoff, rescheduled }
  }
}

/**
 * WHAT THE PROVIDER SAID, AND WHEN.
 *
 * `clock: null`, UNCONDITIONALLY, AND THAT IS THE POINT OF THIS FUNCTION.
 * Contract 135's `season_fixture_live_state` carries a provider, a status
 * token, a kind, two optional scores and an observation instant. THERE IS NO
 * MINUTE, no period and no added time in it — so there is no expression in this
 * file that could produce one, and no argument in scope that a minute could be
 * computed from. The presentation is ready for a clock; the platform does not
 * have one, and this is where that stays honest.
 */
function observationOf(
  live: NonNullable<SeasonListFixture['live']>,
  phaseLabel: string,
): MatchObservation {
  return {
    observedAt: live.observedAt,
    // Formatted HERE, in the viewer's own zone, so no component has to choose
    // one. See `MatchObservation.observedAtLabel`.
    observedAtLabel: formatKickoffTime(live.observedAt),
    // A one-sided score is not a scoreline. The read sends both or neither for
    // a reported goal, and a half-pair means the payload disagrees with itself.
    score:
      live.home !== null && live.away !== null ? { home: live.home, away: live.away } : null,
    clock: null,
    phaseLabel,
  }
}

/* ==========================================================================
   ROWS
   ========================================================================== */

function itemOf(
  fixture: SeasonListFixture,
  competition: MatchCompetitionRef,
  nameCompetition: boolean,
): MatchListItem {
  const state = matchStateOf(fixture)
  const kickoffLabel = formatKickoffTime(fixture.kickoffAt)
  const stage = stageOf(fixture)
  const home = teamOf(fixture.home)
  const away = teamOf(fixture.away)

  // In combined scope the competition LEADS the line, because knowing which
  // competition a match is in is the condition that mode exists under. In
  // competition scope the page already says it once and the stage is the
  // useful half.
  const contextLabel = nameCompetition ? `${competition.name} · ${stage.label}` : stage.label

  return {
    id: fixture.id,
    competition,
    stage,
    home,
    away,
    state,
    kickoffLabel,
    contextLabel,
    // See `matchesSource.ts`: no bounded read answers prediction status across a
    // multi-matchweek window, and a badge on some rows reads as "nothing needed"
    // on the rest.
    prediction: null,
    // THE CONTEXT TRAVELS INTO THE SENTENCE, and that is not a nicety.
    //
    // Everything visible on a row is `aria-hidden`, because a row assembled
    // from separate nodes announces as "Glenmore Athletic2Strathkelvin
    // United1". So the accessible name IS this sentence — and a sentence
    // without the competition made the combined mode's binding rule
    // unenforceable for anyone using a screen reader: four rows spanning three
    // competitions all announced as "X against Y, kick-off 19:45", with nothing
    // to tell them apart. The stage was invisible the same way, in every scope.
    accessibleSummary: summarise(home.name, away.name, state, kickoffLabel, contextLabel),
  }
}

/**
 * THE PLAYER'S WHOLE CALENDAR — and an unattributable fixture is DROPPED.
 *
 * The mode's binding rule is that every fixture names its competition. A
 * fixture whose `competitionId` is not in the payload's own competition list
 * cannot satisfy it, and the tempting fallback — use the ACTIVE competition —
 * is the worst available answer: the row would not fail to name a competition,
 * it would confidently name the WRONG one, in that competition's colours, and
 * every "names its competition" check would still pass because the row does
 * contain a competition name.
 *
 * So it is excluded, and the exclusion is REPORTED. A silent drop reads as "we
 * covered everything", which is the failure the repository names by hand
 * elsewhere; a named one lets a reader see that a competition is missing and
 * lets the backend lane see that the payload's two halves disagree.
 */
function combinedItems(source: MatchesSource): {
  readonly items: readonly MatchListItem[]
  readonly unavailable: readonly string[]
} {
  const combined = source.combined
  if (combined === null) return { items: [], unavailable: [] }

  const byId = new Map(
    combined.competitions.map((entry): [string, MatchCompetitionRef] => [
      entry.id,
      {
        id: entry.id,
        name: entry.name,
        shortName: entry.name,
        seasonLabel: entry.seasonLabel,
        // No read holds a competition palette, and borrowing the ACTIVE
        // competition's colours for another competition's fixtures would paint
        // three competitions as one.
        colours: null,
      },
    ]),
  )

  const items: MatchListItem[] = []
  let unattributed = 0
  for (const fixture of combined.fixtures) {
    const ref = byId.get(fixture.competitionId)
    if (ref === undefined) {
      unattributed += 1
      continue
    }
    items.push(itemOf(fixture, ref, true))
  }

  return {
    items,
    unavailable:
      unattributed === 0
        ? []
        : [
            `${unattributed} ${unattributed === 1 ? 'match' : 'matches'} from a competition this page could not name`,
          ],
  }
}

/**
 * THE COMPETITION'S OWN NAME FOR THIS STAGE, CARRIED VERBATIM.
 *
 * `competition_rounds.label` is "Matchweek 7" in a domestic league,
 * "Quarter-finals" in a cup and "Group A · Matchday 2" in a group stage,
 * because a competition names its own rounds. Nothing here builds a label from
 * an ordinal, and nothing here reads a date to decide what stage a competition
 * is at — §10, and the failure it prevents is a quarter-final filed under
 * "Matchweek 4".
 *
 * `kind` is `null` because neither contract 139 nor contract 148 projects
 * `competition_rounds.kind`, even though the column holds it. Recorded in
 * `docs/product/vnext-matches.md` § "Backend gaps".
 */
function stageOf(fixture: SeasonListFixture): MatchStageRef {
  return {
    id: fixture.round.id,
    ordinal: fixture.round.ordinal,
    label: fixture.round.label,
    kind: null,
  }
}

/**
 * A CLUB, AS PRESENTATION.
 *
 * The same mapping `buildHomeModel` performs, and deliberately the same: a club
 * must look identical on Home and in a fixture list, and two mappings over one
 * set of identity tokens is how that stops being true. The domain supplies a
 * primary and sometimes a secondary; a club with only one gets its primary in
 * both roles rather than a highlight derived here, because a derived colour is
 * a colour no club plays in.
 */
const KIT_PATTERN: Readonly<Record<string, TeamKitPattern>> = {
  solid: 'solid',
  stripes: 'stripes',
  hoops: 'hoops',
  halves: 'halves',
  // The domain has a fifth pattern the presentation lane does not draw. It
  // resolves to solid rather than being dropped, because a club with no crest
  // still needs a mark.
  sash: 'solid',
}

function teamOf(club: SeasonFixtureClub): Team {
  const tokens: ClubIdentityTokens = club.tokens
  const primary = tokens.primary
  const secondary = tokens.secondary ?? primary

  return {
    // THE CLUB NAME IS THE ONLY STABLE IDENTITY A FIXTURE READ CARRIES.
    // Contract 139 sends `teams.name` and no team id; the id is available from
    // the form read and is joined by name there. A fixture list needs no id at
    // all, so it uses the one thing it has.
    id: club.name,
    name: club.name,
    // The application holds ONE name per club. Inventing a short form here
    // would be presentation deciding how to abbreviate a club, and the rows
    // wrap rather than clip precisely so no short form is needed.
    shortName: club.name,
    abbreviation: tokens.monogram,
    colours: {
      primary,
      secondary,
      accent: secondary,
      onPrimary: tokens.onPrimary ?? 'light',
    },
    kitPattern: KIT_PATTERN[tokens.pattern ?? 'solid'] ?? 'solid',
    // No crest source is agreed anywhere in the application. Presentation falls
    // back to the abbreviation, which every vNext surface already does.
    crestUrl: null,
  }
}

/**
 * THE ACCESSIBLE SENTENCE, BUILT WHERE THE FACTS ARE.
 *
 * "Glenmore Athletic 2, Porthaven City 1, full time" — read the way a person
 * says it. §31's counter-example is "2 1 Glenmore Porthaven", which is exactly
 * what name computation produces when a row is assembled from separate visible
 * nodes and nobody wrote a sentence. Writing it here rather than in the row
 * means the row can hide everything visible from the accessibility tree and
 * announce this instead.
 *
 * A PROVISIONAL SCORE SAYS SO IN WORDS. Colour carries it visually; the word
 * carries it for everybody else.
 */
export function summarise(
  home: string,
  away: string,
  state: MatchState,
  kickoffLabel: string | null,
  context: string | null = null,
): string {
  const where = context === null ? '' : `, ${context}`
  switch (state.kind) {
    case 'finished':
      return `${home} ${state.result.home}, ${away} ${state.result.away}, full time${where}`
    case 'live':
    case 'awaitingResult': {
      const score = state.observation.score
      const phase = state.observation.clock
        ? `${state.observation.phaseLabel.toLowerCase()}, ${state.observation.clock.label}`
        : state.observation.phaseLabel.toLowerCase()
      return score === null
        ? `${home} against ${away}, ${phase}, no score reported${where}`
        : `${home} ${score.home}, ${away} ${score.away}, ${phase}, provisional score${where}`
    }
    case 'postponed':
      // The note is part of the sentence, not decoration: "postponed" alone
      // leaves a listener asking the one question the card answers visually.
      return state.note === null
        ? `${home} against ${away}, postponed${where}`
        : `${home} against ${away}, postponed, ${state.note.toLowerCase()}${where}`
    case 'abandoned':
      return `${home} against ${away}, abandoned${where}`
    case 'void':
      return `${home} against ${away}, void${where}`
    default: {
      // A rescheduled fixture says so in the sentence too. A reader scanning a
      // Saturday for a match that was moved into it has no other way to tell.
      const moved = state.kind === 'scheduled' && state.rescheduled ? ', rescheduled' : ''
      return kickoffLabel
        ? `${home} against ${away}${moved}, kick-off ${kickoffLabel}${where}`
        : `${home} against ${away}${moved}, kick-off to be confirmed${where}`
    }
  }
}

/* ==========================================================================
   GROUPING
   ========================================================================== */

/**
 * ORDERED BY KICKOFF, LABELLED BY STAGE — the owner's 5 August amendment, and
 * the reason this groups by DAY rather than by matchweek.
 *
 * A fixture postponed out of matchweek 5 into November keeps
 * `competition_round_id = 5` deliberately, so grouping by round files a
 * November match under a September heading and puts it nowhere near the matches
 * it is actually played beside. The day is the grouping key; the stage is
 * something each row prints.
 *
 * THE SERVER'S ORDER IS PRESERVED. Re-sorting here would be a second opinion
 * about when a match is played; the days are emitted in first-appearance order,
 * which is kickoff order because the read already is.
 *
 * A FIXTURE WITH NO KICKOFF IS NOT DROPPED. A rearranged match the league has
 * not timed yet is still a fixture, and it collects under its own heading at
 * the end — where the server already sorts it.
 */
function groupByDay(items: readonly MatchListItem[]): readonly MatchDayGroup[] {
  const order: string[] = []
  const buckets = new Map<string, { label: string; matches: MatchListItem[] }>()

  for (const item of items) {
    const kickoff = item.state.kickoff
    const key = kickoff ? matchDayKey(kickoff) : null
    const label = kickoff ? formatMatchDay(kickoff) : null

    const bucketKey = key ?? 'undated'
    const bucketLabel = label ?? 'Date to be confirmed'

    const existing = buckets.get(bucketKey)
    if (existing) existing.matches.push(item)
    else {
      buckets.set(bucketKey, { label: bucketLabel, matches: [item] })
      order.push(bucketKey)
    }
  }

  // Undated last, always. An unscheduled match is not the next thing to happen.
  const dated = order.filter((key) => key !== 'undated')
  const keys = buckets.has('undated') ? [...dated, 'undated'] : dated

  return keys.map((key) => {
    const bucket = buckets.get(key)
    const matches = bucket?.matches ?? []
    const stages = new Set(matches.map((match) => match.stage.id))
    return {
      key,
      label: bucket?.label ?? 'Date to be confirmed',
      // The case the stage label exists for: a Saturday carrying a match
      // postponed out of six weeks ago.
      mixedStages: stages.size > 1,
      matches,
    }
  })
}

function stagesOf(items: readonly MatchListItem[]): MatchesModel['stages'] {
  const seen = new Map<string, { id: string; label: string; ordinal: number; matches: number }>()
  for (const item of items) {
    const found = seen.get(item.stage.id)
    if (found) seen.set(item.stage.id, { ...found, matches: found.matches + 1 })
    else
      seen.set(item.stage.id, {
        id: item.stage.id,
        label: item.stage.label,
        ordinal: item.stage.ordinal,
        matches: 1,
      })
  }
  // The server's own ordinal, which is the competition's own sequence. It
  // orders the list and is never printed.
  return [...seen.values()].sort((left, right) => left.ordinal - right.ordinal)
}

function countsOf(items: readonly MatchListItem[]): Readonly<Record<MatchesFilter, number>> {
  let live = 0
  let upcoming = 0
  let finished = 0
  for (const item of items) {
    const phase = matchPhase(item.state)
    if (phase === 'live') live += 1
    else if (phase === 'upcoming') upcoming += 1
    else finished += 1
  }
  return { all: items.length, live, upcoming, finished }
}

function competitionRefOf(source: MatchesSource): MatchCompetitionRef {
  return {
    id: source.competition.tournamentId,
    name: source.competition.name,
    shortName: source.competition.name,
    seasonLabel: source.competition.seasonLabel,
    colours: source.competition.colours,
  }
}

/**
 * The window the server answered, as words a reader can check the page against.
 *
 * It formats the SERVER's own bounds. A page that printed a window it chose
 * itself would be describing a request rather than an answer, and the two
 * differ the moment the server clamps one.
 */
function windowLabelOf(window: { from: string; to: string }): string | null {
  const from = formatMatchDay(window.from)
  const to = formatMatchDay(window.to)
  if (from === null || to === null) return null
  return `${from} – ${to}`
}
