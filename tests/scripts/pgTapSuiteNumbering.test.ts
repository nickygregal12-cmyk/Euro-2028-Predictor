import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * A pgTAP suite number identifies exactly one file.
 *
 * WHY THIS EXISTS. `supabase/tests` is numbered so a reader can see the order
 * work landed in, and authority documents cite suites by that number —
 * `AGENTS.md`, `MASTER-TODO.md`, `docs/roadmap.md` and
 * `docs/quality/current-status.md` all do. When two files share a number the
 * citation stops resolving: "168 holds 27 assertions" is true of
 * `168_provider_fixture_revision_import.sql` and false of
 * `168_tournament_only_browser_reads.sql`, and nothing on the page says which
 * is meant.
 *
 * That is not hypothetical tidiness. Three collisions already exist, and the
 * 168 pair arrived on 5 August 2026 from two sessions building concurrently —
 * the same day four CONTRACT numbers collided the same way, one of which
 * (#506/#507, both "Contract 118") had to be reconciled by renumbering after
 * the fact. The migration side has `scripts/check-migration-timestamps.mjs`
 * precisely because a collision there is expensive. The test side had nothing,
 * so the next pair costs another manual reconciliation.
 *
 * WHY THE EXISTING THREE ARE RECORDED RATHER THAN RENAMED. Renaming them would
 * dangle every reference already published in merged pull request bodies, which
 * cannot be edited, and this repository's rule is to correct the live authority
 * and preserve history rather than rewrite the record to look cleaner. So the
 * pairs are named here with which file is which — this file becomes the one
 * place that disambiguates them — and any NEW collision fails.
 *
 * If the owner would rather renumber the three, that is a deliberate choice
 * with a documentation sweep attached, not something this guard should decide.
 */

const testsDirectory = resolve(process.cwd(), 'supabase/tests')

/**
 * Collisions that predate this guard, with the disambiguation the number alone
 * no longer carries. An entry here is a record, not a permission slip: nothing
 * may be added to it, because a new collision is exactly what this file is for.
 */
const RECORDED_COLLISIONS: Readonly<Record<string, string>> = {
  '102':
    'other_player_profiles and private_league_summary_activity — unrelated ' +
    'suites that took the same slot before the sequence was busy enough for ' +
    'anyone to notice.',
  '118':
    'c1b_game_catalogue_memberships and final_standings — note this is a TEST ' +
    'number and has nothing to do with database contract 118, which is the ' +
    'neutral window fixture facts.',
  '168':
    'provider_fixture_revision_import (contract 117, 27 assertions) and ' +
    'tournament_only_browser_reads (the reviewed-list guard from #505). Both ' +
    'are cited by number in authority documents; this is the pair that made ' +
    'the ambiguity concrete.',
}

function suiteFiles(): string[] {
  return readdirSync(testsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

/**
 * The slot a file occupies, which is the digits plus any single-letter suffix.
 *
 * `098z_paginated_leaderboard_capacity_setup.sql` and
 * `099z_restore_operating_limits.sql` use that suffix to sort AFTER the plainly
 * numbered suite they bracket, which is a deliberate ordering device rather
 * than a collision. Reading `098z` as `098` would report the two as sharing a
 * slot and make this guard fail on a convention that is working.
 */
function numberOf(file: string): string | null {
  const match = /^(\d+[a-z]?)_/.exec(file)
  return match ? at(match, 1) : null
}

function filesByNumber(): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const file of suiteFiles()) {
    const number = numberOf(file)
    if (number === null) continue
    const existing = grouped.get(number)
    if (existing) existing.push(file)
    else grouped.set(number, [file])
  }
  return grouped
}

describe('pgTAP suite numbering', () => {
  it('gives every suite a number, so the sequence has no unordered members', () => {
    expect(suiteFiles().filter((file) => numberOf(file) === null)).toEqual([])
  })

  it('assigns each number to exactly one file, apart from the recorded pairs', () => {
    const unrecorded = [...filesByNumber().entries()]
      .filter(([number, files]) => files.length > 1 && !(number in RECORDED_COLLISIONS))
      .map(([number, files]) => `${number}: ${files.join(', ')}`)
      .sort()

    expect(unrecorded).toEqual([])
  })

  it('keeps the recorded pairs honest — a resolved one is deleted from the list', () => {
    const grouped = filesByNumber()
    const noLongerColliding = Object.keys(RECORDED_COLLISIONS)
      .filter((number) => (grouped.get(number)?.length ?? 0) < 2)
      .sort()

    expect(noLongerColliding).toEqual([])
  })

  it('never lets the recorded list grow — a new collision is a failure, not an entry', () => {
    expect(Object.keys(RECORDED_COLLISIONS).sort()).toEqual(['102', '118', '168'])
  })

  it('tells a new suite which number is free', () => {
    const numbers = [...filesByNumber().keys()].map((slot) => Number.parseInt(slot, 10))
    const next = String(Math.max(...numbers) + 1).padStart(3, '0')

    // Not a style preference: picking "the next one" by eye off a directory
    // listing is how both halves of the 168 pair were chosen.
    expect(suiteFiles().some((file) => file.startsWith(`${next}_`))).toBe(false)
  })
})
