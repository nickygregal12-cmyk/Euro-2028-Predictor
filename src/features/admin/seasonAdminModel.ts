import { userFacingError } from '../../shared/errors/userFacingError'
import type { SeasonFixture } from '../../services/supabase/seasonFixtures'
import type { CompetitionGame } from '../../services/supabase/competitionGamesModel'
import type { SeasonOpenOutcome } from '../../services/supabase/seasonAdmin'

/**
 * Presentation model for the Development competition administration surface
 * (`DFA-009`).
 *
 * NEVER A SECOND RULES ENGINE — that is the requirement's own wording, and it
 * is the whole design here. Nothing in this file decides whether an action is
 * permitted. `require_competition_admin()` and `require_result_admin()` decide
 * who may act; `record_season_fixture_result` decides which result transitions
 * are legal; `open_season_competition` decides what opening a competition means
 * for each game. This turns a fixture's OWN STORED STATUS into which control to
 * show, and turns the server's answer into a sentence.
 *
 * The distinction matters at exactly one place, and it is worth naming. A
 * fixture that is `scheduled` offers Confirm and a fixture that is `played`
 * offers Correct and Clear — that is not this file predicting a refusal, it is
 * this file reading the same stored fact the server reads. The moment it would
 * have to reason about WHO is asking, or about points already banked, it stops
 * and lets the call be refused.
 */

export type FixtureResultAction = 'confirm' | 'correct' | 'clear'

export type AdminFixtureRow = {
  id: string
  label: string
  /** "2 - 1" when the server holds a result, otherwise null. */
  score: string | null
  status: string
  /** Which entry points this fixture's stored status makes available. */
  actions: readonly FixtureResultAction[]
  /**
   * Whether a reason is mandatory. Confirming a first result needs none;
   * changing or removing one that has already been scored does, because points
   * have been banked against it and someone will ask why they moved.
   */
  reasonRequired: boolean
}

export type SeasonReadiness = {
  matchweek: number
  matchweekCount: number
  fixtures: number
  withResult: number
  /** Fixtures the league has not given a kickoff instant. */
  withoutKickoff: number
  rows: readonly AdminFixtureRow[]
}

export type OpenableGame = {
  competitionId: string
  gameKey: string
  name: string
  /**
   * Null when the game can be offered. A sentence when it cannot — read from
   * the game's own stored lifecycle rather than from a guess about the draw.
   */
  unavailable: string | null
}

const GAME_NAMES: Record<string, string> = {
  main_predictor: 'Match Predictor',
  last_man_standing: 'Last Man Standing',
  predictor_cup: 'Predictor Championship',
  ko_predictor: 'Knockout Predictor',
}

export function gameName(gameKey: string): string {
  return GAME_NAMES[gameKey] ?? gameKey
}

function scoreOf(fixture: SeasonFixture): string | null {
  return fixture.homeScore !== null && fixture.awayScore !== null
    ? `${fixture.homeScore} - ${fixture.awayScore}`
    : null
}

/**
 * Which result controls a fixture's stored status makes available.
 *
 * `postponed` offers Confirm alongside `scheduled`, because a postponed fixture
 * that is eventually played is the ordinary case and the server accepts it. A
 * status this does not know offers nothing: an unknown state is not a licence
 * to guess, and the operator can still see what the server calls it.
 */
export function actionsFor(status: string): readonly FixtureResultAction[] {
  if (status === 'scheduled' || status === 'postponed') return ['confirm']
  if (status === 'played') return ['correct', 'clear']
  return []
}

export function presentSeasonReadiness(page: {
  matchweek: number
  matchweekCount: number
  fixtures: readonly SeasonFixture[]
}): SeasonReadiness {
  const rows = page.fixtures.map((fixture): AdminFixtureRow => {
    const actions = actionsFor(fixture.status)
    return {
      id: fixture.id,
      label: `${fixture.homeName} v ${fixture.awayName}`,
      score: scoreOf(fixture),
      status: fixture.status,
      actions,
      // Only the confirm-only case is reason-optional. Anything offering
      // correct or clear will be refused without one.
      reasonRequired: !(actions.length === 1 && actions[0] === 'confirm'),
    }
  })

  return {
    matchweek: page.matchweek,
    matchweekCount: page.matchweekCount,
    fixtures: page.fixtures.length,
    withResult: page.fixtures.filter((fixture) => scoreOf(fixture) !== null).length,
    withoutKickoff: page.fixtures.filter((fixture) => fixture.kickoffAt === null).length,
    rows,
  }
}

/**
 * The games an operator may ask to open, with the ones that cannot stated
 * rather than hidden.
 *
 * A COMPLETED COMPETITION IS SHOWN AND REFUSED IN THE INTERFACE, because the
 * server refuses it too (`already_completed`) and an operator who cannot see it
 * at all will assume it was never created. Hiding a thing is not the same as
 * explaining it — the mistake the competition dashboard's dead Join button made
 * in the other direction.
 */
export function openableGames(games: readonly CompetitionGame[]): readonly OpenableGame[] {
  return games.map((game) => ({
    competitionId: game.id,
    gameKey: game.gameKey,
    name: game.displayName ?? gameName(game.gameKey),
    unavailable: game.completedAt
      ? 'This competition has finished. Opening it would be creating a second competition inside the first.'
      : null,
  }))
}

/**
 * Read the server's opening outcome back as a sentence.
 *
 * KEYED ON THE SERVER'S OWN VOCABULARY, and deliberately not exhaustive-typed:
 * a later contract adding an outcome should degrade to naming it rather than
 * failing to compile a surface that had nothing to do with the change. The
 * fallback prints what the server said it did, which for an operator surface
 * is more useful than "something happened".
 */
export function openOutcomeMessage(outcome: SeasonOpenOutcome): string {
  const game = gameName(outcome.gameKey ?? '')

  switch (outcome.outcome) {
    case 'opened':
      return outcome.windows === null
        ? `${game} is open for play.`
        : `${game} is open for play, with ${outcome.windows} round${
            outcome.windows === 1 ? '' : 's'
          } scheduled${outcome.setupWritten ? ' and the public Classic setup written' : ''}.`
    case 'already_open':
      return `${game} already holds a calendar. Nothing was changed.`
    case 'already_launched':
      return `${game} has already been drawn. Nothing was changed.`
    case 'no_schedulable_round':
      return `${game} could not be opened: this season has no matchweek left whose lock instant can be derived. Every fixture in a round needs a confirmed kickoff before the round can be scheduled.`
    case 'no_windows_required':
      return `${game} needs no calendar of its own — its rounds are the season's matchweeks.`
    case 'refused':
      return openRefusalMessage(outcome.reason, game)
    default:
      return `${game}: the server reported "${outcome.outcome}".`
  }
}

function openRefusalMessage(reason: string | null, game: string): string {
  switch (reason) {
    case 'already_completed':
      return `${game} has finished, so it cannot be opened.`
    case 'private_setup_not_chosen':
      return `${game} is private, so its rules are its organiser's to choose. Only a public competition gets the Classic setup written for it.`
    case 'below_threshold':
      return `${game} has too few entrants to be drawn yet.`
    default:
      return reason
      ? `${game} was refused: ${reason}.`
      : `${game} was refused, and the server gave no reason.`
  }
}

/**
 * Turn an administrator write refusal into the sentence that explains it.
 *
 * Same discipline as `lmsRefusal`: classify by error CODE and then say
 * something this repository wrote, so no raw database or RPC detail reaches the
 * page while the distinctions an operator needs survive. The distinctions here
 * are all rules — a confirmation over an existing result, a correction that
 * changes nothing, a missing reason — and telling an operator to "try again" on
 * any of them would send them round a loop that refuses identically every time.
 */
export function seasonAdminRefusal(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  switch (typeof code === 'string' ? code : '') {
    case '42501':
    case 'insufficient_privilege':
      // require_competition_admin / require_result_admin. Deliberately does not
      // say which: this surface offers both, and naming the wrong capability is
      // worse than naming neither.
      return 'Your account does not hold the administrator capability this action needs.'
    case '23514':
    case 'check_violation':
      // The transition rules: confirming over an existing result, correcting a
      // fixture with none, clearing one with none, a correction that changes
      // nothing. Reload rather than guess which — the fixture's current status
      // is the answer and it is one read away.
      return 'The server refused that change against this fixture\'s current state. Reload the matchweek to see where it stands.'
    case '22023':
    case 'invalid_parameter_value':
      return 'A reason is required to correct or clear a result, and both scores are required to record one.'
    case '23503':
    case 'foreign_key_violation':
      return 'That fixture no longer exists. Reload the matchweek.'
    default:
      return userFacingError(error)
  }
}
