import type { LmsClub, LmsRoundPage } from '../../../services/supabase/seasonLms'
import type {
  LmsBody,
  LmsFieldPanel,
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
 * ============================ THE LOCK: THE SERVER'S ANSWER WHEN THERE IS
 * ONE, AND ONE JUDGEMENT HERE WHEN THERE IS NOT ===========================
 *
 * Stage 11's predicate asks that "lock/deadline states come from authority, not
 * browser inference", so it matters exactly where the answer comes from.
 *
 * Contract 116 returns `opens_at` and `locks_at` and NO verdict. Contract 164
 * returns `round.revealed`, which is `locks_at is not null and locks_at <=
 * now()` evaluated BY THE DATABASE, against the database's own clock. That is
 * the authority, so this mapper prefers it — `serverLocked` below.
 *
 * IT IS ONLY ALLOWED TO SPEAK FOR A WINDOW IT IS ACTUALLY ABOUT. Both contracts
 * resolve the current window through the same `season_lms_current_window`, but
 * they are two calls and a round can lock between them. So the window ids are
 * COMPARED, and a mismatch discards the field read's verdict rather than
 * applying it to a round it did not describe. Silently trusting it would put
 * the worst possible answer — a confident wrong lock — on the most consequential
 * control in the product.
 *
 * WHEN THE FIELD READ DID NOT ANSWER, the fallback is the instants against the
 * instant the SOURCE supplied — never a clock read here or in a component. One
 * instant, one comparison, one answer, in this file and nowhere else. A
 * component that read its own clock could offer a control the header says is
 * closed, and the two would disagree on screen.
 *
 * EITHER WAY THE SERVER STILL ADJUDICATES THE WRITE. `save_lms_selection`
 * refuses a late pick regardless of what was offered; see the model's header.
 *
 * `revealed: false` IS NOT "OPEN". It says the lock has not passed, which is
 * equally true of a round that has not opened — so `opensAt` still decides
 * between `not-open` and `open`, and the server's answer is used for the one
 * question it actually answers.
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
 *
 * The same restraint applies to contract 164's `drawsRule`: it is CARRIED so a
 * surface can state the organiser's rule, and never applied to `pickOutcome` to
 * turn a draw into an elimination. Reporting a rule and running it are
 * different acts, and only the second is the settlement job's.
 *
 * ============================ IT COUNTS NOTHING ==========================
 *
 * The three pool counts are three separate server-side `count(*)`s and are
 * carried as three numbers, unmodified.
 *
 * AN EARLIER VERSION OF THIS COMMENT JUSTIFIED THAT WITH AN ARGUMENT THAT WAS
 * SIMPLY FALSE, and it is worth recording rather than quietly deleting. It said
 * a NULL `outcome` satisfies neither `<> 'eliminated'` nor `= 'eliminated'`, so
 * the three counts need not sum. The first half is a true fact about SQL; the
 * second does not follow here, because `bonus_competition_entrants.outcome` is
 * declared `text not null default 'active'` and no migration has ever relaxed
 * it. **`entrants` always equals `remaining + eliminated`.**
 *
 * So the honest reason to carry rather than derive is not arithmetic — a
 * derivation would currently agree — it is AUTHORITY. These are three
 * statements the database chose to make, and re-deriving one makes this lane
 * responsible for a number it did not compute, on the day the schema gains a
 * sixth outcome or a soft-deleted entrant. The guard against it is therefore a
 * mapper test that hands `buildLmsModel` a non-summing payload and requires it
 * to carry the figures through unrepaired — the mapper's job is to carry, not
 * to correct — and NOT a fixture world, because a fixture world is a page a
 * player could really see and those must sum.
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
  // NOT REACHABLE FROM `bodyFor`, WHICH RETURNS `not-entered` BEFORE CALLING
  // THIS — and kept anyway, because the ordering above is the rule and a
  // function that answers "why can this player not pick" should not have a hole
  // where the strongest reason goes. The union member it produces is likewise
  // unconstructible today; both exist so the order survives a caller change.
  if (!page.entered) return 'not-entered'
  if (page.entryOutcome === 'eliminated') return 'eliminated'
  if (state === 'not-open') return 'not-open'
  if (state === 'locked' || state === 'settled') return 'locked'
  return null
}

/**
 * CONTRACT 164'S LOCK VERDICT, IF IT IS ABOUT THIS ROUND.
 *
 * Null means "no authoritative answer available" — the read failed, the caller
 * is not entered, the field holds no round, or the two reads landed on
 * DIFFERENT WINDOWS. That last one is the reason this function exists rather
 * than a bare property access: two calls can straddle a lock boundary, and a
 * verdict about window 8 applied to window 7 would be worse than no verdict.
 */
function serverRound(source: LmsSource, windowId: string) {
  if (source.field.kind !== 'ok') return null
  const answer = source.field.field
  if (!answer.available || !answer.entered) return null
  const round = answer.round
  if (round === null || round.windowId !== windowId) return null
  return round
}

function serverLocked(source: LmsSource, windowId: string): boolean | null {
  const round = serverRound(source, windowId)
  if (round === null) return null
  // A LOCK FAILS CLOSED, NEVER OPEN. `seasonLmsFieldModel` decodes `revealed`
  // as `row.revealed === true`, so a missing or malformed field arrives here as
  // `false` — indistinguishable from a genuine "not locked yet", and `false`
  // short-circuits the instants below and forces the round OPEN. That is the
  // wrong direction for a control that spends a club: contract 164's own
  // `lms_round_revealed` fails closed on an unknown window and says why.
  //
  // So a verdict is only trusted where the payload also carried the instant it
  // is a verdict ABOUT. No `locksAt`, no verdict — fall back to the instants,
  // which then read an unscheduled window as `not-open`.
  if (round.locksAt === null) return null
  return round.revealed
}

/**
 * WHETHER THE ROUND HAS SETTLED — `settles_at <= now()`, the server's own
 * comparison, for the same window and under the same guard as the lock.
 */
function serverSettled(source: LmsSource, windowId: string): boolean | null {
  return serverRound(source, windowId)?.settled ?? null
}

/**
 * THE ROUND'S STATE.
 *
 * `settled` first, because a round that has produced a result is finished
 * whatever its timestamps say — and a null `locksAt` is an UNSCHEDULED window
 * rather than an open one, which is the reading the server's own window
 * selection uses (nulls last, so an unscheduled window never outranks a
 * scheduled one).
 *
 * Then the LOCK, from `locked` when contract 164 supplied a verdict for this
 * window and from the instants when it did not. See the header for why the
 * server's answer is preferred and why it is checked before it is trusted.
 */
function roundState(
  page: LmsRoundPage,
  generatedAt: string,
  locked: boolean | null,
  settled: boolean | null,
): LmsRoundState {
  // THE ROUND'S OWN SETTLEMENT, WHERE THE SERVER STATED IT.
  if (settled === true) return 'settled'

  // AND OTHERWISE ONLY A PLAYED VERDICT, NEVER MERELY A NON-NULL ONE.
  //
  // THIS LINE WAS `page.pickOutcome !== null` AND IT WAS BADLY WRONG. Contract
  // 116 computes `pick_outcome` through `lms_outcome_from_fixture`, whose FIRST
  // branch is `when p_status is distinct from 'played' then 'postponed'` — so a
  // player who has picked a club whose fixture has not kicked off yet gets
  // `'postponed'`, which is not null. `pickOutcome !== null` therefore means
  // "THE PLAYER HAS PICKED", not "the round produced a result".
  //
  // The consequence was the ordinary mid-week state of the game: pick a club on
  // Tuesday, and the page called the round settled, printed "Picks closed" over
  // a deadline days away, marked every other club `locked`, hid the prompt and
  // the remaining count, and refused an amendment `save_lms_selection` would
  // happily have accepted. It also discarded contract 164's verdict entirely,
  // because this branch runs first.
  //
  // `postponed` is excluded by name. A round without a standing result never
  // eliminates and is not over — `lmsRoundModel.ts` says so in as many words.
  if (page.pickOutcome !== null && page.pickOutcome !== 'postponed') return 'settled'

  const now = Date.parse(generatedAt)
  const opensAt = page.round?.opensAt ?? null
  const locksAt = page.round?.locksAt ?? null

  // THE SERVER SAID LOCKED. Nothing on this page outranks that, including an
  // `opensAt` a slow clock still reads as future.
  if (locked === true) return 'locked'

  if (opensAt !== null && Date.parse(opensAt) > now) return 'not-open'
  // An unscheduled window cannot be picked in: there is no deadline to beat,
  // and the write would have nothing to validate against.
  if (locksAt === null) return 'not-open'

  // THE SERVER SAID NOT LOCKED, and it has already been established that the
  // round has opened and has a deadline — so this is open, whatever this
  // machine's clock believes about `locksAt`.
  if (locked === false) return 'open'

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

function bodyFor(source: LmsSource, page: LmsRoundPage, generatedAt: string): LmsBody {
  // ABOUT THE COMPETITION, and it comes first: a season that does not run this
  // game has no round to be between and no entry to have missed.
  if (!page.available) return { kind: 'not-offered' }
  if (page.round === null) return { kind: 'no-round' }
  if (!page.entered) return { kind: 'not-entered' }

  const state = roundState(
    page,
    generatedAt,
    serverLocked(source, page.round.windowId),
    serverSettled(source, page.round.windowId),
  )
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

/**
 * CONTRACT 164 → THE FIELD PANEL.
 *
 * Every number is CARRIED. Nothing is added, subtracted or defaulted:
 *
 *   • the three counts come across as three counts (see the header);
 *   • `picked` keeps its NULL. Before the lock the server withholds how many
 *     rivals have committed, and `?? 0` would print a confident zero — the
 *     exact mistake `seasonLmsFieldModel.ts` warns about in its own header;
 *   • `rules` keeps its NULL. An organiser who wrote no setup has not chosen
 *     "0 lives", and saying so would invent a harsher game than the real one.
 *
 * `not-counted` covers contract 164's two `field: null` answers — the game is
 * not offered, or the caller is not entered — because entrancy is its
 * disclosure boundary. Which of the two it is, the ROUND's body already says,
 * so this panel does not say it a second time in different words.
 */
function fieldFor(source: LmsSource): LmsFieldPanel {
  if (source.field.kind !== 'ok') return { kind: 'unavailable' }

  const answer = source.field.field
  if (!answer.available || !answer.entered) return { kind: 'not-counted' }

  return {
    kind: 'field',
    counts: {
      entrants: answer.field.entrants,
      remaining: answer.field.remaining,
      eliminated: answer.field.eliminated,
      // NULL SURVIVES. Withheld until the lock, and never rendered as zero.
      picked: answer.field.picked,
    },
    rules:
      answer.rules === null
        ? null
        : {
            lives: answer.rules.lives,
            saves: answer.rules.saves,
            // STATED, NEVER APPLIED. See the header.
            drawsRule: answer.rules.drawsRule,
          },
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
      // STILL ITS OWN OUTCOME. The round read failing says nothing about the
      // field read, and a page that can still say how many are left should.
      field: fieldFor(source),
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
    body: bodyFor(source, page, source.generatedAt),
    field: fieldFor(source),
  }
}
