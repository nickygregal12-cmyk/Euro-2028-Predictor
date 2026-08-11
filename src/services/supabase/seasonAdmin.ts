// Administrator writes for a competition season.
//
// FOUR PROTECTED RPCs, AND NOT ONE RULE. Every refusal below belongs to the
// server: `require_competition_admin()` decides who may open a competition,
// `require_result_admin()` decides who may record a result, and
// `predictor_internal.record_season_fixture_result` decides which transitions
// are legal — a confirmation over an existing result is refused so the
// correction's audit trail cannot be lost, a correction that changes nothing is
// refused, and a reason is mandatory to correct or clear but not to confirm,
// because by then points have been banked against the result.
//
// This module sends the call and returns what came back. It must never grow a
// pre-check that predicts a refusal: two copies of a rule is one copy that will
// be wrong, and the one in the browser is the one nobody can trust.
//
// NO TABLE ACCESS. `season_fixtures`, `bonus_competitions` and
// `season_lms_setups` are revoked from every browser role; the entry points are
// the boundary and there is no fallback.

import { db } from './client'
import { rpcArgs } from './rpcArguments'

/** What `admin_open_season_competition` reports back about one competition. */
export type SeasonOpenOutcome = {
  /**
   * The server's own vocabulary, passed through rather than mapped: `opened`,
   * `already_open`, `already_launched`, `no_schedulable_round`,
   * `no_windows_required`, `refused`, and whatever a later contract adds.
   * Presentation decides how to read it; the wire keeps the server's word.
   */
  outcome: string
  /** Present on a refusal: `already_completed`, `private_setup_not_chosen`, … */
  reason: string | null
  gameKey: string | null
  /** Last Man Standing: whether the public Classic setup row was written. */
  setupWritten: boolean | null
  /** Last Man Standing: how many round windows the calendar generated. */
  windows: number | null
  /** Everything the payload carried, for an outcome this decoder predates. */
  raw: Record<string, unknown>
}

export type SeasonResultAction = 'confirm' | 'correct' | 'clear'

/** What one of the three result entry points reports back. */
export type SeasonResultOutcome = {
  fixtureId: string
  action: SeasonResultAction
  /** Monotonic per fixture: the immutable revision this write recorded. */
  revision: number | null
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function decodeOpenOutcome(value: unknown): SeasonOpenOutcome {
  const row = objectOf(value)
  const outcome = stringOrNull(row.outcome)
  // An unreadable outcome is an error, not an empty state. A surface that
  // rendered "" here would report a write it cannot describe as if it had
  // reported something.
  if (!outcome) {
    throw new Error('The season opening response did not say what it did.')
  }

  return {
    outcome,
    reason: stringOrNull(row.reason),
    gameKey: stringOrNull(row.gameKey),
    setupWritten: typeof row.setupWritten === 'boolean' ? row.setupWritten : null,
    windows: typeof row.windows === 'number' ? row.windows : null,
    raw: row,
  }
}

/**
 * Open one season competition for play.
 *
 * An operator action rather than a job, and contract 127 says why: the launch
 * fixes the format, the draw and the whole fixture list at whatever field size
 * it finds, and refuses ever after. A cron tick would be choosing the
 * competition's shape.
 *
 * Idempotent in every branch, so a second press reports `already_open` rather
 * than creating a second calendar.
 */
export async function openSeasonCompetition(competitionId: string): Promise<SeasonOpenOutcome> {
  const { data, error } = await db.rpc('admin_open_season_competition', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return decodeOpenOutcome(data)
}

function decodeResultOutcome(value: unknown, action: SeasonResultAction): SeasonResultOutcome {
  const row = objectOf(value)
  const fixtureId = stringOrNull(row.fixtureId)
  if (!fixtureId) {
    throw new Error('The season result response did not name the fixture it wrote.')
  }
  return {
    fixtureId,
    action,
    revision: typeof row.revision === 'number' ? row.revision : null,
  }
}

/**
 * Record, change or remove one season fixture's official result.
 *
 * Three entry points rather than one with a mode, matching the migration:
 * their argument lists genuinely differ — confirming takes an optional reason,
 * correcting a mandatory one, clearing a reason and no scores — and collapsing
 * them here would mean inventing the arguments the server did not ask for.
 *
 * SETTLES NOTHING. `process_due_season_matchweek_scores` rederives every league
 * season on every run precisely so a correction is picked up without its writer
 * knowing anything about scoring, which is why nothing here recomputes a total.
 */
export async function recordSeasonFixtureResult(input: {
  fixtureId: string
  action: SeasonResultAction
  home?: number
  away?: number
  reason?: string | null
}): Promise<SeasonResultOutcome> {
  const reason = input.reason?.trim() ? input.reason.trim() : null

  if (input.action === 'clear') {
    const { data, error } = await db.rpc(
      'admin_clear_season_fixture_result',
      rpcArgs('admin_clear_season_fixture_result', ['p_reason'], {
        p_season_fixture_id: input.fixtureId,
        p_reason: reason,
      }),
    )
    if (error) throw error
    return decodeResultOutcome(data, 'clear')
  }

  const rpc =
    input.action === 'confirm'
      ? 'admin_confirm_season_fixture_result'
      : 'admin_correct_season_fixture_result'

  // A MISSING SCORE IS SENT AS NULL, NOT DROPPED, AND THE DIFFERENCE IS VISIBLE
  // TO THE ADMINISTRATOR.
  //
  // `SeasonAdminPage` deliberately forwards an absent score rather than
  // refusing locally — "the server refuses a result with a missing score and
  // says so; refusing here first would be this page holding an opinion about
  // the rule". That refusal is real: the shared writer raises `A season result
  // needs both scores` (errcode 22023) when either arrives null.
  //
  // It was not what happened. `p_home: undefined` is dropped by JSON
  // serialisation, and neither `admin_confirm_season_fixture_result` nor
  // `admin_correct_season_fixture_result` declares a default for `p_home` or
  // `p_away`, so the call resolved to no function at all and PostgREST answered
  // with a schema-cache error instead of the domain refusal the page promised
  // to show. Sending null keeps the function resolvable and lets its own guard
  // speak. Typing the client is what surfaced this.
  const { data, error } = await db.rpc(
    rpc,
    rpcArgs(rpc, ['p_home', 'p_away', 'p_reason'], {
      p_season_fixture_id: input.fixtureId,
      p_home: input.home ?? null,
      p_away: input.away ?? null,
      p_reason: reason,
    }),
  )
  if (error) throw error
  return decodeResultOutcome(data, input.action)
}
