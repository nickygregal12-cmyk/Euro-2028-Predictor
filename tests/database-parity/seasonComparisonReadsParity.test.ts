import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contracts 129, 130 and 131 — the three season reads that compare players.
 *
 * WHAT THESE GUARDS EXIST FOR is the reveal boundary. All three expose one
 * player's data to another, and the only thing standing between a pick and its
 * opponent is that the matchweek has locked. The tournament reads compare
 * against ONE instant, `tournaments.lock_at`; a season has no such instant, and
 * a read that reached for one would reveal matchweek 30 the moment matchweek 1
 * locked. So every one of them is asserted to derive the lock per matchweek,
 * from the same authority the write trigger enforces, and to HIDE rather than
 * reveal when that authority returns null.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

const CONTRACT_129 = '20260806200000_season_head_to_head.sql'
const CONTRACT_130 = '20260806210000_season_prediction_consensus.sql'
const CONTRACT_131 = '20260806220000_period_standings_display_names.sql'
const CONTRACT_122 = '20260806130000_season_period_standings.sql'
const TOURNAMENT_CONSENSUS = '20260729154931_prediction_consensus_minimum_cohort.sql'

const headToHead = migration(CONTRACT_129)
const consensus = migration(CONTRACT_130)
const names = migration(CONTRACT_131)

/** Comments stripped, whitespace collapsed. Prose is not the contract. */
function executable(text: string): string {
  return text
    .replaceAll(/--.*$/gm, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

describe.each([
  // The head-to-head's SQL doubles the apostrophe in "players'", so the
  // fragment matched here starts after it.
  ['the head-to-head', headToHead, 'predictions are hidden until the matchweek locks'],
  ['the consensus', consensus, 'Prediction consensus is hidden until the matchweek locks'],
])('%s reveals per matchweek', (_label, source, message) => {
  const body = executable(source)

  it('derives the lock from the matchweek authority', () => {
    expect(body).toContain('predictor_internal.season_matchweek_lock_at(')
  })

  it('never reaches for the tournament-wide lock instant', () => {
    // `tournaments.lock_at` is the Euro's single reveal. Reading it here would
    // make matchweek 30 visible the moment matchweek 1 locked.
    expect(body).not.toContain('lock_at from public.tournaments')
    expect(body).not.toContain('tournament.lock_at')
  })

  it('hides on a null lock rather than revealing', () => {
    // `season_matchweek_lock_at` returns null when the round's fixture list has
    // incomplete kickoffs. The write trigger calls that locked; revealing on it
    // would expose a season whose kickoffs were never published.
    expect(body).toContain('if v_locks_at is null or now() < v_locks_at then')
    expect(source).toContain(message)
  })

  it('takes the buffer from game_definitions rather than a literal', () => {
    expect(body).toContain("where definition.game_key = 'main_predictor'")
    expect(body).not.toMatch(/make_interval\(mins => \d/)
  })

  it('requires the caller to hold an entry', () => {
    expect(body).toContain('predictor_internal.require_season_entry(v_ctx.o_entry_id)')
  })

  it('resolves the matchweek through contract 114 rather than its own query', () => {
    expect(body).toContain(
      'predictor_internal.season_card_context(p_tournament_id, p_matchweek)',
    )
  })

  it('writes nothing', () => {
    for (const write of ['insert into', 'update public.', 'delete from']) {
      expect(body).not.toContain(write)
    }
  })
})

describe('the head-to-head builds both sides identically', () => {
  const body = executable(headToHead)

  it('calls one side-builder twice rather than inlining two blocks', () => {
    // A copied block that diverges by one join is how a comparison ends up
    // showing the caller their own Joker beside their opponent's points.
    // Two call sites, differing only in whose entry they are given.
    expect(body).toContain(
      "predictor_internal.season_entrant_matchweek( p_tournament_id, v_ctx.o_entry_id, v_ctx.o_round_id, v_uid)",
    )
    expect(body).toContain(
      "predictor_internal.season_entrant_matchweek( p_tournament_id, v_opponent_entry, v_ctx.o_round_id, p_opponent_id)",
    )
    // One definition, one revoke, two calls — and no third block building a
    // side by hand.
    const calls = body.match(/predictor_internal\.season_entrant_matchweek\(/g) ?? []
    expect(calls).toHaveLength(4)
  })

  it('reads season sources and no tournament ones', () => {
    for (const relation of ['match_predictions', 'predicted_progression', 'entry_totals']) {
      expect(body).not.toContain(relation)
    }
    expect(body).toContain('public.season_predictions')
    expect(body).toContain('public.season_matchweek_scores')
  })

  it('exposes a result only for a played fixture', () => {
    // The protected confirmation gate: a provider may have scored a fixture
    // provisionally, and `status = 'played'` is what makes it official.
    expect(body).toContain("case when fixture.status = 'played' then fixture.home_score end")
    expect(body).toContain("case when fixture.status = 'played' then fixture.away_score end")
  })

  it('refuses a self-comparison and a player who has not entered', () => {
    expect(headToHead).toContain('You cannot compare yourself with yourself')
    expect(headToHead).toContain('That player has not entered this season')
  })
})

describe('the consensus counts the right cohort', () => {
  const body = executable(consensus)

  it('reuses the tournament minimum rather than choosing a new one', () => {
    const tournament = migration(TOURNAMENT_CONSENSUS)
    const declared = /v_minimum_entries constant integer := (\d+)/.exec(tournament)
    expect(declared?.[1]).toBe('10')
    expect(body).toContain(`v_minimum constant integer := ${declared?.[1]}`)
  })

  it('counts entries that predicted THIS matchweek', () => {
    // A season-wide count would report a matchweek six people played as safe
    // because fifty entered in August.
    expect(body).toContain('select count(distinct prediction.entry_id)::integer into v_cohort')
    expect(body).toContain('where fixture.competition_round_id = v_ctx.o_round_id')
    expect(body).not.toContain('entry.submitted_at is not null')
  })

  it('suppresses by returning rather than raising', () => {
    expect(body).toMatch(/if v_cohort < v_minimum then return jsonb_build_object\( 'suppressed', true/)
  })

  it('names no individual', () => {
    // The FUNCTION only. The migration's own apply-time assertion quotes
    // `public.profiles` to check for exactly this, and scanning the whole file
    // would trip on the guard rather than on the read.
    const fn = body.slice(
      body.indexOf('create or replace function public.get_season_prediction_consensus'),
      body.indexOf('$consensus$;'),
    )
    for (const identifying of ['public.profiles', 'display_name', 'user_id']) {
      expect(fn).not.toContain(identifying)
    }
  })

  it('bounds the scoreline distribution', () => {
    expect(body).toMatch(/group by p\.home_score, p\.away_score order by count\(\*\) desc[^;]*limit 5/)
  })
})

describe('the optional names preserve contract 122 as the default', () => {
  const body = executable(names)

  it('makes the flag required rather than defaulted', () => {
    // A DEFAULTED fourth parameter would overload rather than replace, and a
    // three-argument call would then match both signatures — which PostgreSQL
    // rejects as not unique.
    expect(body).toContain('p_include_names boolean')
    expect(body).not.toContain('p_include_names boolean default')
  })

  it('drops nothing and retires the old signature by revoking it', () => {
    // The first draft dropped it, and the additive checker refused: `drop
    // function` is destructive at migration level, and one optional display
    // name is not a reason to put a batch through the backup-and-rehearsal
    // rollout.
    expect(body).not.toContain('drop function')
    expect(body).toContain(
      'revoke all on function public.get_season_period_standings(uuid, text, integer) from public, anon, authenticated, service_role;',
    )
  })

  it('moves its one browser caller in the same change', () => {
    const service = readFileSync(
      resolve(repositoryRoot, 'src/services/supabase/seasonPeriodStandings.ts'),
      'utf8',
    )
    expect(service).toContain('p_include_names: includeNames')
    expect(service).toContain('includeNames = false')
  })

  it('leaves the parity-checked authorities alone', () => {
    // `season_monthly_standings` and `season_form_standings` are compared with
    // `src/domain/season/standings.ts` including array order. A profile join
    // inside either would end that.
    expect(body).not.toContain('function predictor_internal.season_monthly_standings')
    expect(body).not.toContain('function predictor_internal.season_form_standings')
  })

  it('maps over what they returned, preserving order', () => {
    expect(body).toContain('with ordinality')
    expect(body).toContain('order by row.ordinality')
    expect(body).toContain('order by month.ordinality')
  })

  it('keeps the refusal contract 122 exists for', () => {
    // The unplaceable-matchweek guard: a plausible-looking monthly table built
    // over a season with no derived windows would be wrong.
    const original = migration(CONTRACT_122)
    const refusal =
      'This season has a settled matchweek with no play window, so its monthly table cannot be built'
    expect(original).toContain(refusal)
    expect(names).toContain(refusal)
  })

  it('keeps the entry boundary', () => {
    expect(names).toContain('This season is not yours to read')
  })

  it('adds no name to the row shape beyond display_name', () => {
    const mapping = executable(
      names.slice(
        names.indexOf('create or replace function predictor_internal.name_season_standing_rows'),
        names.indexOf('$named$;'),
      ),
    )
    expect(mapping).toContain("'display_name', profile.display_name")
    for (const leak of ['email', 'entry.user_id,', 'auth.users']) {
      expect(mapping).not.toContain(leak)
    }
  })
})
