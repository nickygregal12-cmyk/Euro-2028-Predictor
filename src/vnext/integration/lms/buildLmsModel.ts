import type { LmsClub, LmsRoundPage } from '../../../services/supabase/seasonLms'
import type {
  LmsBody,
  LmsFixtureChoice,
  LmsPageModel,
  LmsPickAction,
  LmsRound,
  LmsRoundState,
  LmsTeamOption,
} from '../../models/lms'
import type { LmsSource } from './lmsSource'

/**
 * `LmsSource` → `LmsPageModel`. PURE: no network, no storage, no clock and no
 * React — the four rules every vNext mapper is written under, and the third one
 * matters more here than anywhere else in the lane.
 *
 * ============================ THE LOCK IS JUDGED ONCE, HERE ==============
 *
 * Contract 116 returns `opens_at` and `locks_at` and no state field, so
 * something has to turn two instants into "can this be picked in". That
 * judgement happens in this file and nowhere else, against the instant the
 * SOURCE supplied — never against a clock read here or in a component.
 *
 * One instant, one comparison, one answer. A component that read its own clock
 * could offer a control the header says is closed, and the two would disagree
 * on screen. The server still adjudicates the write; see the model's header.
 *
 * ============================ IT DECIDES NO ELIGIBILITY ==================
 *
 * BE PRECISE ABOUT WHOSE ANSWER `used` IS, because the whole stage turns on
 * that distinction. The LIST is the server's: `lms_used_team_ids` returns the
 * team ids the caller has consumed IN THEIR CURRENT CYCLE, which is the list
 * ADR 0013's reset makes the right one. The per-club `used` FLAG is that list
 * projected onto each club BY ID, once, in `seasonLms.ts`.
 *
 * That projection is a set membership test on a server-issued id and nothing
 * else. Nothing in this lane compares club names, counts rounds, or works out
 * what a cycle is. A club is spent because the server listed it.
 *
 * ============================ IT DERIVES NO SURVIVAL =====================
 *
 * `standing` is carried from `entryOutcome` untouched, and `pick.result` from
 * `pickOutcome` untouched, and NOTHING HERE READS ONE TO PRODUCE THE OTHER. A
 * club that won does not make a player safe — only the settlement job says
 * that, and it says it in `entryOutcome`.
 */

/**
 * WHY A PICK CANNOT BE MADE, WHERE IT CANNOT.
 *
 * Ordered deliberately, and the order is the message. Being ELIMINATED outranks
 * a lock: a player who is out should be told they are out, not that they were
 * too slow. Not being ENTERED outranks both, because a pick was never theirs to
 * miss.
 */
function blockingReason(
  page: LmsRoundPage,
  state: LmsRoundState,
): 'locked' | 'not-open' | 'eliminated' | 'not-entered' | null {
  if (!page.entered) return 'not-entered'
  if (page.entryOutcome === 'eliminated') return 'eliminated'
  if (state === 'not-open') return 'not-open'
  if (state === 'locked' || state === 'settled') return 'locked'
  return null
}

/**
 * THE ROUND'S STATE, FROM THE SERVER'S INSTANTS AND ONE SUPPLIED INSTANT.
 *
 * `settled` first, because a round that has produced a result is finished
 * whatever its timestamps say — and a null `locksAt` is an UNSCHEDULED window
 * rather than an open one, which is the reading the server's own window
 * selection uses (nulls last, so an unscheduled window never outranks a
 * scheduled one).
 */
function roundState(page: LmsRoundPage, generatedAt: string): LmsRoundState {
  if (page.pickOutcome !== null) return 'settled'

  const now = Date.parse(generatedAt)
  const opensAt = page.round?.opensAt ?? null
  const locksAt = page.round?.locksAt ?? null

  if (opensAt !== null && Date.parse(opensAt) > now) return 'not-open'
  // An unscheduled window cannot be picked in: there is no deadline to beat,
  // and the write would have nothing to validate against.
  if (locksAt === null) return 'not-open'
  return Date.parse(locksAt) <= now ? 'locked' : 'open'
}

/**
 * ONE CLUB'S ACTION.
 *
 * THE ONLY PLACE A TEAM ID ENTERS THE PRESENTATION MODEL, and it enters on
 * exactly one branch. Everything else about a club — its name, its row — is
 * carried without an address, so a used or locked club cannot be submitted by
 * a component that decides to try.
 */
function actionFor(
  club: LmsClub,
  chosenTeamId: string | null,
  blocked: ReturnType<typeof blockingReason>,
): LmsPickAction {
  if (club.teamId === chosenTeamId) return { kind: 'chosen' }
  if (blocked !== null) return { kind: 'unavailable', reason: blocked }
  // The server's used-list for the current cycle, matched by id. See header.
  if (club.used) return { kind: 'used' }
  return { kind: 'pick', teamId: club.teamId }
}

function optionFor(
  club: LmsClub,
  key: string,
  chosenTeamId: string | null,
  blocked: ReturnType<typeof blockingReason>,
): LmsTeamOption {
  return {
    // A FACT ABOUT THE ROW, NOT AN ADDRESS — the fixture and the side. Stable
    // across renders, and useless as a submission.
    key,
    // Already shortened by the club-name authority in the gateway.
    name: club.name,
    action: actionFor(club, chosenTeamId, blocked),
  }
}

function choicesFor(
  page: LmsRoundPage,
  blocked: ReturnType<typeof blockingReason>,
): readonly LmsFixtureChoice[] {
  const chosenTeamId = page.pick?.teamId ?? null

  // The server's fixture order is kept. Home before away, as the production
  // presentation does, because a pick list that reordered itself between loads
  // is a pick list somebody mis-taps.
  return page.fixtures.map((fixture) => ({
    key: fixture.fixtureId,
    kickoffAt: fixture.kickoffAt,
    home: optionFor(fixture.home, `${fixture.fixtureId}:home`, chosenTeamId, blocked),
    away: optionFor(fixture.away, `${fixture.fixtureId}:away`, chosenTeamId, blocked),
  }))
}

function bodyFor(page: LmsRoundPage, generatedAt: string): LmsBody {
  // ABOUT THE COMPETITION, and it comes first: a season that does not run this
  // game has no round to be between and no entry to have missed.
  if (!page.available) return { kind: 'not-offered' }
  if (page.round === null) return { kind: 'no-round' }
  if (!page.entered) return { kind: 'not-entered' }

  const state = roundState(page, generatedAt)
  const blocked = blockingReason(page, state)

  const round: LmsRound = {
    windowId: page.round.windowId,
    sequence: page.round.sequence,
    label: page.round.label,
    state,
    opensAt: page.round.opensAt,
    locksAt: page.round.locksAt,
    choices: choicesFor(page, blocked),
  }

  const chosen = page.pick
    ? page.fixtures
        .flatMap((fixture) => [fixture.home, fixture.away])
        .find((club) => club.teamId === page.pick?.teamId) ?? null
    : null

  return {
    kind: 'round',
    round,
    // THE PICK IS NAMED, NOT ADDRESSED. Its club id is not carried: a made pick
    // is a fact to display, and re-submitting it is not an action this page
    // offers. `pickOutcome` is carried untouched and is NOT a survival verdict.
    pick: chosen === null ? null : { clubName: chosen.name, result: page.pickOutcome },
  }
}

export function buildLmsModel(source: LmsSource): LmsPageModel {
  const context = {
    competitionName: source.context.competitionName,
    seasonLabel: source.context.seasonLabel,
    gameName: source.context.gameName,
  }

  if (source.read.kind !== 'ok') {
    return {
      generatedAt: source.generatedAt,
      context,
      // THE READ DID NOT ANSWER, SO THE PAGE KNOWS NOTHING ABOUT THE PLAYER.
      // Null rather than a guess: "active" would tell somebody they are still
      // in a competition this page failed to read.
      standing: null,
      usedClubNamesInRound: [],
      body: { kind: 'unavailable' },
    }
  }

  const { page } = source.read

  return {
    generatedAt: source.generatedAt,
    context,
    // Carried untouched. The settlement job's word, never derived from a result.
    standing: page.entryOutcome,
    usedClubNamesInRound: page.fixtures
      .flatMap((fixture) => [fixture.home, fixture.away])
      .filter((club) => club.used)
      .map((club) => club.name),
    body: bodyFor(page, source.generatedAt),
  }
}
