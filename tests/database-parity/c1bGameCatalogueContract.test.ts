import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260803070000_c1b_game_catalogue_memberships.sql',
)
const source = readFileSync(migrationPath, 'utf8')

function functionHeader(name: string): string {
  const escaped = name.replace('.', '\\.')
  const match = source.match(
    new RegExp(`create or replace function ${escaped}\\([\\s\\S]*?\\nas \\$`, 'i'),
  )
  expect(match, `${name} definition`).toBeTruthy()
  return match![0]
}

describe('C1b game catalogue and membership contract', () => {
  it('keeps one per-season availability root instead of adding a parallel table', () => {
    expect(source).toContain('bonus_competitions is now the canonical per-season game availability root')
    expect(source).not.toMatch(/create table public\.(?:game_availabilities|competition_games)\b/i)
  })

  it('persists the three canonical C1b relations', () => {
    for (const table of ['game_definitions', 'game_memberships', 'game_membership_events']) {
      expect(source).toMatch(new RegExp(`create table public\\.${table}\\b`, 'i'))
      expect(source).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
      )
    }
  })

  it('pins game-owned lock policies without a competition-wide fallback', () => {
    expect(source).toContain("('original_predictor', 'Original Predictor', true,  'entry', 0,  true)")
    expect(source).toContain("('main_predictor',     'Main Predictor',     true,  'round', 0,  true)")
    expect(source).toContain("('last_man_standing',  'Last Man Standing',  false, 'round', 30, false)")
    expect(source).not.toMatch(/competition_lock_buffer|default_lock_policy/i)
  })

  it('links both legacy entry stores to one canonical membership truth', () => {
    expect(source).toContain('add column game_membership_id uuid')
    expect(source).toContain('entries_membership_fkey')
    expect(source).toContain('bonus_entrants_membership_fkey')
    expect(source).toContain('references public.game_memberships')
  })

  it('records lifecycle events automatically and makes them immutable', () => {
    expect(source).toContain('record_game_membership_event')
    expect(source).toContain("event_type in ('joined', 'rejoined', 'left', 'disqualified')")
    expect(source).toContain('Game membership events are immutable')
  })

  it('keeps the LMS same-running rejoin refusal explicit', () => {
    expect(source).toContain("('last_man_standing',  'Last Man Standing',  false, 'round', 30, false)")
    expect(source).toContain('This game cannot be rejoined after leaving')
  })

  it('keeps C2 ownership and profile changes out of C1b', () => {
    expect(source).not.toMatch(/alter table public\.profiles/i)
    expect(source).not.toMatch(/auth_user_id/i)
    expect(source).not.toMatch(/pseudonym/i)
    expect(source).not.toMatch(/drop constraint entries_user_id_fkey/i)
    expect(source).not.toMatch(/references public\.profiles/i)
  })

  it('keeps every new security-definer function on an empty search path', () => {
    const functions = [
      'public.get_competition_games',
      'public.join_competition_game',
      'public.leave_competition_game',
      'public.admin_disqualify_competition_game_entry',
      'public.create_game_league',
      'public.get_my_game_leagues',
      'predictor_internal.record_game_membership_event',
      'predictor_internal.prepare_entry_game_membership',
    ]

    for (const name of functions) {
      expect(functionHeader(name)).toMatch(/security definer/i)
      expect(functionHeader(name)).toMatch(/set search_path = ''/i)
    }
  })

  it('keeps the lock triggers security invoker', () => {
    for (const name of [
      'public.enforce_entry_lock_generic',
      'public.enforce_entry_lock_scores',
      'public.enforce_joker_rules',
    ]) {
      expect(functionHeader(name)).not.toMatch(/security definer/i)
      expect(functionHeader(name)).toMatch(/set search_path = ''/i)
    }
  })

  it('seeds only draft domestic season roots without invented dates', () => {
    expect(source).toContain("('premier-league', 'Premier League 2026/27')")
    expect(source).toContain("('scottish-premiership', 'Scottish Premiership 2026/27')")
    expect(source).toContain("'Europe/London'")
    expect(source).not.toMatch(/2026-08-\d{2}/)
  })
})
