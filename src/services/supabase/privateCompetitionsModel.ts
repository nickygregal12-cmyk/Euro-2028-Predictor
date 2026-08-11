/**
 * Creating and launching a private competition (contracts 153 and 154,
 * `MIG-UI-05` and `MIG-UI-06`).
 *
 * TWO GAMES, TWO SHAPES, ONE VOCABULARY. A private Last Man Standing opens for
 * play the moment it is created — the calendar comes from the same generator
 * the public competition uses, so its first round is real football on a real
 * date. A private Championship does not: its draw is fixed at whatever field
 * size the organiser launches with and refuses ever after, so creation and
 * launch are two deliberate acts. The union below keeps that difference
 * visible instead of flattening both into "created".
 *
 * THE ORGANISER'S RULES ARE THE SERVER'S TO REFUSE. `season_lms_setups`
 * constrains lives, saves, the draw rule and the wipeout answer, and
 * `create_private_season_lms` turns each refusal into a readable message. The
 * ranges are restated here ONLY as the option lists a form renders — never as
 * validation that decides whether the call is made, because a client that
 * validates independently is a client that starts refusing a range the server
 * later widens.
 *
 * `no_schedulable_round` IS A REAL OUTCOME, NOT A FAILURE. A competition
 * created after the season's last matchweek has locked exists, is named and has
 * a code, and has no round to play. Saying so is the honest answer; hiding it
 * behind "created" would leave an organiser inviting friends to nothing.
 *
 * PURE. Server JSON in, presentation model out.
 */

export const LMS_LIVES_OPTIONS = [0, 1, 2, 3] as const
export const LMS_SAVES_OPTIONS = [0, 1, 2] as const

export type LmsDrawsRule = 'eliminate' | 'survive'
export type LmsWipeoutRule = 'play_on' | 'shared_win' | 'reset'

export type PrivateLmsSetup = {
  /** Extra lives each entrant carries. The server's range is 0–3. */
  lives: number
  /** Selection saves each entrant may spend. The server's range is 0–2. */
  saves: number
  drawsRule: LmsDrawsRule
  /** A private competition MUST answer this; the table requires it. */
  endgameOnWipeout: LmsWipeoutRule
}

export const DEFAULT_LMS_SETUP: PrivateLmsSetup = {
  lives: 0,
  saves: 0,
  drawsRule: 'eliminate',
  endgameOnWipeout: 'play_on',
}

export type CreatedPrivateCompetition = {
  competitionId: string
  name: string
  inviteCode: string
  /** Rounds opened at creation. Championships create none until they launch. */
  windows: number
  /**
   * `opened` — playable now. `no_schedulable_round` — created, with no round
   * left in the season. `created` — a Championship awaiting its launch.
   */
  outcome: 'opened' | 'no_schedulable_round' | 'created'
  /** False for every freshly created Championship; the draw has not been made. */
  launched: boolean
}

export type CupLaunchResult =
  | {
      outcome: 'launched'
      entrants: number
      /** Rounds in the group stage the server actually scheduled. */
      leagueRounds: number
      fixtures: number
    }
  | { outcome: 'already_launched' }
  /** The field is too small, or too little calendar remains, for any format. */
  | { outcome: 'no_viable_format'; entrants: number; reason: string | null }
  /** The competition has already finished. */
  | { outcome: 'refused'; reason: string | null }
  /** Anything the server said that this build does not model. Never guessed at. */
  | { outcome: 'unknown'; reason: string | null }

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function countOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0
}

export function mapCreatedPrivateCompetition(payload: unknown): CreatedPrivateCompetition {
  const row = objectOf(payload)
  const competitionId = stringOrNull(row.competition_id)
  const inviteCode = stringOrNull(row.invite_code)

  // Without an id there is nothing to navigate to and without a code there is
  // nothing to share, and a success screen missing either is a dead end. It
  // throws rather than degrading: the competition WAS created, so a caller that
  // treated this as "creation failed" would encourage a duplicate.
  if (!competitionId || !inviteCode) {
    throw new Error('The competition was created but the server returned no id or code')
  }

  const outcome = stringOrNull(row.outcome)
  return {
    competitionId,
    name: stringOrNull(row.name) ?? '',
    inviteCode,
    windows: countOf(row.windows),
    outcome:
      outcome === 'opened' || outcome === 'no_schedulable_round' ? outcome : 'created',
    launched: row.launched === true,
  }
}

export function mapCupLaunchResult(payload: unknown): CupLaunchResult {
  const row = objectOf(payload)
  const outcome = stringOrNull(row.outcome)

  switch (outcome) {
    case 'launched':
      return {
        outcome: 'launched',
        entrants: countOf(row.entrants),
        leagueRounds: countOf(row.leagueRounds),
        fixtures: countOf(row.fixtures),
      }
    case 'already_launched':
      return { outcome: 'already_launched' }
    case 'no_viable_format':
    // `not_open` is the PUBLIC Championship's threshold and contract 154 skips
    // it for a private one, so it should never arrive here. It is mapped to the
    // same answer rather than to `unknown` because if it ever does, the useful
    // thing to tell an organiser is that the field is not launchable yet.
    case 'not_open':
      return {
        outcome: 'no_viable_format',
        entrants: countOf(row.entrants),
        reason: stringOrNull(row.reason),
      }
    case 'refused':
      return { outcome: 'refused', reason: stringOrNull(row.reason) }
    default:
      return { outcome: 'unknown', reason: outcome }
  }
}
