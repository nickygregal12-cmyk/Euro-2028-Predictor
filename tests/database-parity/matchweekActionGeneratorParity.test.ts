import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const migration = read('supabase/migrations/20260811210000_matchweek_prediction_actions.sql')
const actionCentre = read('supabase/migrations/20260811130000_action_centre.sql')
const scheduler = read('supabase/migrations/20260804113000_season_matchweek_scheduler.sql')
const proof = read('supabase/tests/219_matchweek_prediction_actions.sql')

const section = (source: string, from: string, to: string): string => {
  const start = source.indexOf(from)
  expect(start, `${from} is not in this source`).toBeGreaterThan(-1)
  const end = source.indexOf(to, start)
  expect(end, `${to} does not follow ${from}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('contract 170 matchweek action generator', () => {
  const generator = section(
    migration,
    'create or replace function predictor_internal.generate_matchweek_prediction_actions(',
    'revoke all on function predictor_internal.generate_matchweek_prediction_actions',
  )

  it('selects a game by property, exactly as the matchweek scheduler does', () => {
    // Naming the Predictor would silently exclude the next matchweek-scoped
    // card the platform adds, and would include Last Man Standing the moment
    // somebody widened it. The scheduler already made this choice.
    expect(scheduler).toContain("where definition.lock_scope = 'matchweek'")
    expect(generator).toContain("definition.lock_scope = 'matchweek'")
    expect(generator).toContain('definition.requires_prediction_entry')
    expect(generator).not.toContain("'main_predictor'")
    expect(generator).not.toContain("'last_man_standing'")
  })

  it('takes both ends of "open" from the authorities that own them', () => {
    expect(generator).toContain('round.window_opens_at is not null')
    expect(generator).toContain('round.window_opens_at <= p_now')
    expect(generator).toContain('predictor_internal.season_matchweek_lock_at(')
    expect(generator).toContain('due.locks_at > p_now')

    // A round with no derivable lock is not due. Null is "not derivable",
    // never "no deadline".
    expect(generator).toContain('due.locks_at is not null')

    // And a round with no fixture is not a card — the state a season sits in
    // before its calendar imports.
    expect(generator).toContain('due.fixtures > 0')
  })

  it('completes on the card rather than on a prediction existing', () => {
    expect(generator).toContain('actionable.predicted >= actionable.fixtures')
    expect(generator).toContain("'fixtures', actionable.fixtures")
    expect(generator).toContain("'predicted', actionable.predicted")

    // Completion is monotonic, as contract 162 established: editing a
    // prediction is not undoing one.
    expect(generator).toContain('completed_at = coalesce(item.completed_at, excluded.completed_at)')
  })

  it('is idempotent by construction and does not churn updated_at', () => {
    expect(generator).toContain('on conflict (user_id, action_key) do update')
    expect(generator).toMatch(/where item\.deadline_at is distinct from excluded\.deadline_at/)
  })

  it('ranks below a Last Man Standing pick', () => {
    // A missed pick eliminates; a missed matchweek costs points.
    expect(actionCentre).toMatch(/-- matchweek that merely costs points\.\n\s*1,/)
    expect(generator).toMatch(/still in the competition next week\.\n\s*2,/)
  })

  describe('the expiry sweep', () => {
    const sweep = section(
      migration,
      'create or replace function predictor_internal.invalidate_expired_actions(',
      'revoke all on function predictor_internal.invalidate_expired_actions',
    )

    it('re-derives the matchweek lock instead of trusting the stored copy', () => {
      // THE ASSERTION THIS FILE EXISTS FOR. `expires_at` is a copy taken at
      // generation; contracts 117 and 119 move the lock. If it moves EARLIER
      // the generator stops selecting the round, so only a sweep that re-reads
      // the authority can ever close the item.
      expect(sweep).toContain('predictor_internal.season_matchweek_lock_at(')
      expect(sweep).toContain('public.competition_rounds')
    })

    it('keeps the Last Man Standing re-read it already had', () => {
      expect(sweep).toContain('public.bonus_competition_windows')
      expect(sweep).toContain("(item.context ->> 'window_id')::uuid")
    })

    it('closes an item whose lock has stopped being derivable', () => {
      // A withdrawn kickoff is contract 123's queue-for-an-owner case. An
      // action with no derivable deadline must not sit open against it.
      expect(sweep).toMatch(/coalesce\(\s*\n?\s*predictor_internal\.season_matchweek_lock_at/)
      expect(sweep).toContain('true))')
    })
  })

  describe('the driver', () => {
    const driver = section(
      migration,
      'create or replace function public.process_player_action_items()',
      'revoke all on function public.process_player_action_items()',
    )

    it('reports each generator separately', () => {
      // One number for two generators cannot say which of them stopped.
      expect(driver).toContain("'lms_pick_actions_written', v_lms")
      expect(driver).toContain("'matchweek_prediction_actions_written', v_matchweek")
    })

    it('sweeps after generating', () => {
      const generateAt = driver.indexOf('generate_matchweek_prediction_actions(v_now)')
      const sweepAt = driver.indexOf('invalidate_expired_actions(v_now)')
      expect(generateAt).toBeGreaterThan(-1)
      expect(sweepAt).toBeGreaterThan(generateAt)
    })

    it('stays out of reach of a browser and is scheduled by no migration', () => {
      expect(migration).toContain(
        'revoke all on function public.process_player_action_items() from public, anon, authenticated;',
      )
      expect(migration).toContain(
        'grant execute on function public.process_player_action_items() to service_role;',
      )
      expect(migration).not.toMatch(/cron\.schedule/i)
    })
  })

  it('creates no relation and writes no prediction', () => {
    expect(migration).not.toMatch(/^create table/im)
    expect(migration).not.toMatch(/^alter table/im)
    expect(migration).not.toMatch(/insert into public\.season_predictions/i)
  })

  it('proves selection by contrast rather than by a single positive case', () => {
    // Four rounds, each excluded or included for its own reason. One positive
    // case cannot tell a correct filter from a filter that matches everything.
    expect(proof).toContain('has NOT opened yet')
    expect(proof).toContain('holds no fixture')
    expect(proof).toContain('already LOCKED')
    expect(proof).toContain('THE SWEEP CLOSES IT')
    expect(proof).toContain('a withdrawn kickoff makes the lock underivable')
  })
})
