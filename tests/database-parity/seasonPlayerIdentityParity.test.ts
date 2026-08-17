import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 191 — the weekly-season player address, and the one visibility
 * authority underneath it.
 *
 * WHAT THESE GUARDS EXIST FOR is that this contract creates an ADDRESS without
 * moving a RULE, and both halves fail silently if they are got wrong. An
 * address that leaks the auth identifier onto every row of a season table looks
 * identical on screen to one that does not. A profile boundary quietly widened
 * from "shares a private league" to "is in the same season" also looks
 * identical — until somebody who never agreed to be looked up is looked up.
 *
 * The pgTAP suite proves the BEHAVIOUR against a real database. These assert
 * the properties that survive a rewrite: that no function outside the authority
 * carries the rule, and that the reach probe stays off the whole-field scan.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

const CONTRACT_191 = '20260817120000_season_player_identity.sql'

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

/** Comments stripped, whitespace collapsed. Prose is not the contract. */
function executable(text: string): string {
  return text
    .replaceAll(/--.*$/gm, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

const identity = migration(CONTRACT_191)
const identityBody = executable(identity)

describe('the visibility rule lives in exactly one function', () => {
  it('installs the authority and its catalogue guard', () => {
    expect(identityBody).toContain(
      'create or replace function predictor_internal.season_player_reach(',
    )
    expect(identityBody).toContain(
      'create or replace function predictor_internal.assert_single_season_player_visibility_authority(',
    )
  })

  it('runs the guard against the catalogue it has just built', () => {
    // A guard that is installed and never called is documentation. It must fire
    // inside the same transaction, after every redefinition this migration
    // makes, so a migration that reintroduces a second copy cannot commit.
    expect(identityBody).toContain(
      'perform predictor_internal.assert_single_season_player_visibility_authority();',
    )
  })

  it('leaves no other migration carrying the season co-membership self-join', () => {
    // THE ASSERTION THIS FILE IS REALLY FOR. Contract 151 was not the only copy
    // — contracts 157 and 176 each had their own — and this contract
    // consolidates all three. A fourth would make the guard fail at apply time
    // on a real database; this catches it in CI, on the text, before then.
    const offenders = readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith('.sql'))
      .filter((name) => name > CONTRACT_191)
      .filter((name) => {
        const body = executable(migration(name))
        return (
          body.includes('theirs.user_id') &&
          body.includes('league.tournament_id = p_tournament_id')
        )
      })

    expect(offenders).toEqual([])
  })

  it('takes the profile boundary from the authority rather than restating it', () => {
    // Contract 151's own `exists` must be gone from the redefined profile read.
    const profile = identityBody.slice(
      identityBody.indexOf('create or replace function public.get_season_player_profile('),
      identityBody.indexOf('create or replace function public.get_season_leaderboard('),
    )
    expect(profile).toContain('predictor_internal.season_player_reach(')
    expect(profile).not.toContain('theirs.user_id')
  })
})

describe('the rule is implemented, not widened', () => {
  it('keeps profile disclosure at a shared private league', () => {
    expect(identityBody).toContain('join public.league_members theirs on theirs.league_id = mine.league_id')
    expect(identityBody).toContain("then 'profile'")
  })

  it('refuses a compare-only viewer at the profile read', () => {
    // `compare` is contract 129's comparison grant. If the profile read ever
    // accepts it, every entrant in a season can read every other entrant's
    // profile, which is the decision registered as `PROF-001` and not taken.
    expect(identityBody).toContain("if v_reach not in ('self', 'profile') then")
  })

  it('never accepts a caller-supplied instant anywhere', () => {
    // Reveal boundaries belong to the reads that own them, and every one of
    // them derives its own clock. A timestamp PARAMETER would let a browser ask
    // what a matchweek looked like before it locked.
    //
    // Asserted on declared parameter TYPES rather than on names: the migration
    // itself contains the strings `p_now` and `p_as_of` inside the guard that
    // forbids them, so a name-based assertion here matches its own guard and
    // fails on a correct implementation.
    expect(identityBody).not.toMatch(/p_\w+ timestamp/)
    expect(identityBody).not.toMatch(/p_\w+ timestamptz/)
  })
})

describe('the identifier is season-scoped and conditional', () => {
  it('addresses a player by their entry rather than by their auth identifier', () => {
    expect(identityBody).toContain("'playerRef', row.entry_id")
  })

  it('emits the auth identifier only where a profile will answer', () => {
    // Three reads emit it, and all three must gate it the same way. A single
    // ungated `'playerId', row.user_id` publishes a cross-competition
    // identifier to an entire season.
    const emissions = identityBody.match(/'playerId', (?:case when|to_jsonb)/g) ?? []
    expect(emissions.length).toBeGreaterThanOrEqual(3)
    expect(identityBody).not.toMatch(/'playerId', row\.user_id\b/)
    expect(identityBody).not.toMatch(/'playerId', entry\.user_id\b/)
  })

  it('resolves one reference at a time and cannot enumerate', () => {
    expect(identityBody).toContain('create or replace function public.resolve_season_player(')
    // Two arguments: the season and one reference. A third that took a page
    // size, a name fragment or an array would make this a directory.
    expect(identityBody).toContain('resolve_season_player( p_tournament_id uuid, p_player_ref uuid )')
  })

  it('refuses rather than answering emptily when there is no permitted destination', () => {
    expect(identityBody).toContain("if v_reach = 'none' then")
    expect(identityBody).toContain("raise exception 'You may not view that player'")
  })
})

describe('the reads stay bounded', () => {
  it('probes reach only after the page has been cut', () => {
    // `ordered` spans the whole field. The probe must appear for the first time
    // after `candidates`, which is where the page has already been limited —
    // the same property the migration asserts on the installed definition.
    const orderedAt = identityBody.indexOf('ordered as (')
    const candidatesAt = identityBody.indexOf('candidates as (')
    const probeAt = identityBody.indexOf('predictor_internal.season_player_reach( p_tournament_id, v_uid, candidate.user_id)')

    expect(orderedAt).toBeGreaterThan(-1)
    expect(candidatesAt).toBeGreaterThan(orderedAt)
    expect(probeAt).toBeGreaterThan(candidatesAt)
  })

  it('leaves contract 95’s ordering, cursor and page bound untouched', () => {
    // The identity keys are additive. If any of these moved, the leaderboard
    // and the neighbourhood could disagree about position, which
    // `232_season_clubs_and_neighbourhood` requires they never do.
    expect(identityBody).toContain('order by named.standing_rank, named.sort_name, named.display_name collate "C", named.entry_key')
    expect(identityBody).toContain('v_limit := least(p_limit, 100);')
    expect(identityBody).toContain('v_window := least(greatest(coalesce(p_window, 3), 1), 10);')
  })
})

describe('nothing here writes', () => {
  it('contains no insert, update or delete against a competitive relation', () => {
    // `set_pinned_rival` is redefined here and does write — to `pinned_rivals`,
    // which is a note to self. Nothing else may, and no score, standing,
    // settlement or prediction may be touched at all.
    const writes = identityBody.match(/\b(insert into|update|delete from) public\.(\w+)/g) ?? []
    expect(writes.every((statement) => statement.endsWith('public.pinned_rivals'))).toBe(true)
  })
})
