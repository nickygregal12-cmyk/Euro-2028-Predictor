import { formatKickoffTime, formatMatchDay } from '../../../shared/time/kickoff'
import type { ClubHeadToHead, SeasonClubForm } from '../../../services/supabase/seasonClubFormModel'
import type { CompetitionTable } from '../../../services/supabase/competitionTableModel'
import type { FormResult } from '../../models/football'
import type {
  MatchCentreLink,
  MatchCentreModel,
  MatchCentreSide,
  MatchCentreTable,
  MatchCompetitionRef,
} from '../../models/matches'
import { buildMatchesModel, matchStateOf, summarise } from './buildMatchesModel'
import type { MatchesSource } from './matchesSource'
import type { MatchCentreSource } from './matchCentreSource'

/**
 * `MatchCentreSource` → `MatchCentreModel`. PURE: no network, no storage, NO
 * CLOCK and no React.
 *
 * ============================ ONE STATE MACHINE, NOT TWO ==================
 *
 * `matchStateOf` and `summarise` are IMPORTED FROM THE LIST'S MAPPER rather
 * than restated here, and that is the most important line in this file. A
 * fixture must describe itself identically whether it was reached from the
 * calendar or from a link — that is the whole reason contract 148 returns
 * contract 139's entry field for field — and two state machines over one
 * payload is exactly how that stops being true. The list and the Match Centre
 * are different MODELS; they are not different opinions about whether a match
 * is live.
 *
 * ============================ THE THREE CONTEXT MODULES ===================
 *
 * Form, the table and the meetings each arrive from a different read, are each
 * independently nullable, and are each mapped to `null` rather than to an empty
 * shell when their read did not answer. `matchCentreModules()` then decides
 * what renders — one answer, so no section decides for itself and no empty card
 * can appear.
 */
export function buildMatchCentreModel(source: MatchCentreSource): MatchCentreModel {
  const fixture = source.fixture
  const state = matchStateOf(fixture)

  const competition: MatchCompetitionRef = {
    id: source.competition.id,
    name: source.competition.name,
    shortName: source.competition.name,
    seasonLabel: source.seasonLabel,
    colours: source.colours,
  }

  /**
   * THE CLUBS COME THROUGH THE LIST'S OWN TEAM MAPPING.
   *
   * `buildMatchesModel` over a one-fixture source is how this file gets a
   * `Team` without exporting a second club mapper — a club that looked
   * different on a Match Centre from how it looks in the list it was opened
   * from would be two identities for one club.
   */
  const asList = buildMatchesModel(listSourceOf(source))
  const listItem = asList.days[0]?.matches[0]
  const homeTeam = listItem?.home
  const awayTeam = listItem?.away

  if (!homeTeam || !awayTeam) {
    // Unreachable: contract 148's decoder refuses a fixture with one club, so a
    // decoded fixture always has both. The guard exists so the types narrow
    // without an assertion, which would be the one place this file could lie.
    throw new Error('A fixture reached the Match Centre mapper without two clubs.')
  }

  const formByName = new Map(
    (source.clubForm?.clubs ?? []).map((club): [string, SeasonClubForm] => [club.name, club]),
  )
  const homeForm = formByName.get(homeTeam.name) ?? null
  const awayForm = formByName.get(awayTeam.name) ?? null

  const table = tableOf(source.table, homeForm?.teamId ?? null, awayForm?.teamId ?? null)

  const kickoffLabel = formatKickoffTime(fixture.kickoffAt)

  return {
    generatedAt: source.generatedAt,
    // THE CANONICAL FIXTURE ID, carried through from the read that resolved it.
    id: fixture.id,
    competition,
    stage: {
      id: fixture.round.id,
      ordinal: fixture.round.ordinal,
      // The competition's own word for this stage, verbatim. See
      // `buildMatchesModel`'s `stageOf` for why `kind` is null.
      label: fixture.round.label,
      kind: null,
    },
    home: sideOf(homeTeam, homeForm, table),
    away: sideOf(awayTeam, awayForm, table),
    state,
    dayLabel: formatMatchDay(fixture.kickoffAt),
    kickoffLabel,
    accessibleSummary: summarise(homeTeam.name, awayTeam.name, state, kickoffLabel),
    // See `matchesSource.ts`: no bounded read answers this fixture's prediction
    // status without the whole matchweek card, which this page does not read.
    prediction: null,

    /* --- TIER 2 --- */
    table,
    headToHead: headToHeadOf(source.headToHead),

    /* --- TIER 3: absent from the platform, every one of them --- */
    // `season_fixtures` has no venue column. The tournament shape has one; a
    // league season does not, and borrowing a value across competition shapes
    // would be inventing a ground.
    venue: null,
    // No broadcast source exists anywhere in the repository.
    broadcast: null,
    // No official is stored.
    referee: null,
    // NO CANONICAL EVENT SOURCE EXISTS — §18. The type is capable and this is
    // null; nothing here fabricates a timeline.
    timeline: null,
    // No canonical match statistics exist — §19. Not zeroes, not an empty
    // possession bar: absent.
    statistics: null,
    // No lineup source exists.
    lineups: null,

    links: linksOf(source, competition),
    unavailable: unavailableOf(source, homeForm, awayForm),
  }
}

/**
 * ONE SIDE OF THE MATCH.
 *
 * `position` IS THE SERVER'S AND IS NOT THE ARRAY INDEX. Contract 160 is
 * explicit that renumbering from the array would look identical today and
 * disagree silently the first time a stored tie-break order changes.
 */
function sideOf(
  team: MatchCentreSide['team'],
  form: SeasonClubForm | null,
  table: MatchCentreTable | null,
): MatchCentreSide {
  const teamId = form?.teamId ?? null
  const row = teamId === null ? null : (table?.rows.find((entry) => entry.teamId === teamId) ?? null)

  return {
    team,
    // The SERVER's letters, one for one. Contract 141 derives W/D/L from
    // settled fixtures and this does not re-read a goal difference to
    // second-guess who won.
    form: (form?.form ?? []).map(formResultOf),
    tablePosition: row?.position ?? null,
    tablePoints: row?.points ?? null,
  }
}

const FORM_RESULT: Readonly<Record<string, FormResult>> = {
  W: 'win',
  D: 'draw',
  L: 'loss',
}

function formResultOf(letter: string): FormResult {
  // The decoder upstream already drops anything that is not one of the three
  // letters, so the fallback is unreachable and exists to keep the map total.
  return FORM_RESULT[letter] ?? 'draw'
}

/**
 * A FEW ROWS OF THE COMPETITION'S OWN TABLE, AROUND THE TWO CLUBS.
 *
 * IT CONSUMES CONTRACT 160 AND BUILDS NO SECOND TABLE. §21's rule: points, the
 * order, the tie-breaks, deductions and published boundaries all belong to the
 * competition and are applied server-side. Nothing here sorts, adds or
 * renumbers anything — it takes a window of the server's own rows.
 *
 * A KNOCKOUT GETS NO TABLE. Contract 160 refuses any competition that is not a
 * league season by raising, so the read lands as `null` and this returns `null`
 * — which is exactly right: a table over a cup tie is meaningless, and §21 says
 * not to render one.
 */
function tableOf(
  table: CompetitionTable | null,
  homeTeamId: string | null,
  awayTeamId: string | null,
): MatchCentreTable | null {
  if (table === null || table.rows.length === 0) return null

  const involved = new Set([homeTeamId, awayTeamId].filter((id): id is string => id !== null))

  // The window around the two clubs. Where neither is identifiable — the form
  // read did not answer, so there are no team ids to match on — the top of the
  // table is the honest fallback: it is the competition's own context, and it
  // claims nothing about these two.
  const indices = table.rows
    .map((row, index) => (involved.has(row.teamId) ? index : -1))
    .filter((index) => index >= 0)

  const first = indices.length > 0 ? Math.min(...indices) : 0
  const last = indices.length > 0 ? Math.max(...indices) : Math.min(4, table.rows.length - 1)

  // One row of air either side, so a club's neighbours are visible — which is
  // what makes a position mean something — bounded so a mid-table pair against
  // a bottom club does not print the whole division.
  const from = Math.max(0, first - 1)
  const to = Math.min(table.rows.length, last + 2)
  const window = table.rows.slice(from, Math.max(to, from + 1))

  return {
    rows: window.map((row) => ({
      position: row.position,
      teamId: row.teamId,
      teamName: row.teamName,
      played: row.played,
      points: row.points,
      goalDifference: row.goalDifference,
      isInThisMatch: involved.has(row.teamId),
    })),
    // The server's own provenance, said in words. A table of a season with
    // matches outstanding is a real table of an incomplete season, and saying
    // how many results it counted is what stops it reading as final.
    provenanceLabel: provenanceLabelOf(table),
    provisional: table.provenance.fixturesOutstanding > 0,
  }
}

function provenanceLabelOf(table: CompetitionTable): string | null {
  const counted = table.provenance.fixturesCounted
  const outstanding = table.provenance.fixturesOutstanding
  if (counted === 0 && outstanding === 0) return null
  return outstanding === 0
    ? `${counted} ${counted === 1 ? 'match' : 'matches'} counted`
    : `${counted} counted · ${outstanding} still to play`
}

/**
 * THIS SEASON'S MEETINGS, AS CONTRACT 141 STATES THEM.
 *
 * `outcome` IS THE SERVER'S LETTER, from the perspective of the club the read
 * was addressed for — which is the home side of the fixture being viewed. It is
 * not re-derived from the goals here, which would be a second opinion about who
 * won.
 *
 * AN EMPTY MEETINGS LIST IS A REAL ANSWER and is kept: "they have not met yet
 * this season" is worth saying, and it is a different thing from a read that
 * did not respond, which is `null`.
 */
function headToHeadOf(h2h: ClubHeadToHead | null): MatchCentreModel['headToHead'] {
  if (h2h === null) return null

  return {
    played: h2h.summary.played,
    homeWins: h2h.summary.won,
    draws: h2h.summary.drawn,
    awayWins: h2h.summary.lost,
    meetings: h2h.meetings.map((meeting) => ({
      fixtureId: meeting.seasonFixtureId,
      label: [meeting.round, formatMatchDay(meeting.kickoffAt)].filter(Boolean).join(' · '),
      // Stated from the home side's view, matching `outcome`, so the scoreline
      // and the letter cannot disagree.
      score: { home: meeting.goalsFor, away: meeting.goalsAgainst },
      outcome: formResultOf(meeting.outcome),
    })),
  }
}

/**
 * WHERE THIS PAGE CAN SEND THE PLAYER — contextual navigation, not its purpose.
 *
 * The Match Predictor link appears only where the host says it can act on it.
 * §43 permits a clear path and forbids moving score entry here; this is one
 * button with one label and no payload.
 */
function linksOf(
  source: MatchCentreSource,
  competition: MatchCompetitionRef,
): readonly MatchCentreLink[] {
  const links: MatchCentreLink[] = []
  if (source.predictorReachable) {
    links.push({ kind: 'match-predictor', label: 'Open the Match Predictor' })
  }
  links.push({ kind: 'competition-matches', label: `All ${competition.name} matches` })
  return links
}

/**
 * WHICH CONTEXT THE APPLICATION COULD NOT ANSWER, NAMED.
 *
 * Said rather than silently drawn less. A reader who cannot see a form run
 * deserves to know it was unavailable rather than concluding the clubs have not
 * played. Tier 3's absences are NOT listed: they are not "unavailable just
 * now", they are things this platform does not hold, and listing them on every
 * match would be an apology for a product decision.
 */
function unavailableOf(
  source: MatchCentreSource,
  homeForm: SeasonClubForm | null,
  awayForm: SeasonClubForm | null,
): readonly string[] {
  const missing: string[] = []
  if (source.clubForm === null || (homeForm === null && awayForm === null)) {
    missing.push('recent form')
  }
  if (source.table === null) missing.push('the table')
  if (source.headToHead === null) missing.push('previous meetings')
  return missing
}

/**
 * The one-fixture list source, so the club mapping is shared rather than
 * duplicated. It is a private adapter and never leaves this file.
 */
function listSourceOf(source: MatchCentreSource): MatchesSource {
  return {
    generatedAt: source.generatedAt,
    competition: {
      tournamentId: source.competition.id,
      name: source.competition.name,
      seasonLabel: source.seasonLabel ?? source.competition.seasonKey,
      colours: source.colours,
    },
    // A one-fixture window. Nothing reads it: the Match Centre draws no window
    // label, and `buildMatchesModel` only formats it.
    window: {
      from: source.fixture.kickoffAt ?? source.generatedAt,
      to: source.fixture.kickoffAt ?? source.generatedAt,
    },
    serverNow: source.serverNow,
    fixtures: [source.fixture],
    competitionRead: source.competition,
    playerCompetitionCount: null,
    combined: null,
  }
}
