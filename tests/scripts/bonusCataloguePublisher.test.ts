import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `scripts/bonus-games/publish-catalogue.sql` is the only committed writer of
 * `bonus_competition_windows`, it is documented as safe to rerun, and the
 * Browser E2E workflow runs it on every job.
 *
 * Contract 107 made "safe to rerun" conditional. Every statement in the script
 * targets the LIVE competition — `visibility_kind = 'public' and completed_at
 * is null` — which after a Last Man Standing restart is the SUCCESSOR. The
 * calendar the script carries is fixed and original, so a rerun would give a
 * fresh competition all seven Euro rounds with lock instants already in the
 * past. `recompute_lms_for_tournament` would then settle every one of them
 * against a field that has made no selections, and crown the entire field
 * champion. `supabase/tests/159_successor_window_calendar_guard.sql` reproduces
 * that outcome rather than describing it.
 *
 * Contract 108 refuses those rows at the table, which is the real protection.
 * The script refuses earlier and with a message that names the missing piece,
 * and this test is what keeps that refusal in the file — the database guard
 * cannot be asserted from here, and a script that fails on an opaque constraint
 * violation is a worse operator experience than one that explains itself.
 */

const publisher = readFileSync(
  resolve(process.cwd(), 'scripts/bonus-games/publish-catalogue.sql'),
  'utf8',
)

describe('bonus games catalogue publisher', () => {
  it('refuses to publish the original calendar once a live competition is a successor', () => {
    expect(publisher).toContain('predecessor_competition_id is not null')
    expect(publisher).toMatch(/raise\s+exception[\s\S]{0,400}restarted successors/i)
    expect(publisher).toContain("using errcode = '23514'")
  })

  it('checks that before writing anything, not after', () => {
    const guardAt = publisher.indexOf('predecessor_competition_id is not null')
    const firstWrite = publisher.indexOf('insert into public.bonus_competitions')
    const windowWrite = publisher.indexOf('insert into public.bonus_competition_windows')

    expect(guardAt).toBeGreaterThan(-1)
    expect(firstWrite).toBeGreaterThan(-1)
    expect(windowWrite).toBeGreaterThan(-1)
    // A guard that ran after the window insert would refuse a transaction that
    // had already built the rows it exists to prevent. It would still roll
    // back, but the script would be asserting something it had just done.
    expect(guardAt).toBeLessThan(firstWrite)
    expect(guardAt).toBeLessThan(windowWrite)
  })

  it('still scopes every write to the live public competition', () => {
    // The successor guard replaces none of contract 103's targeting. If these
    // disappeared, the script would start writing to completed predecessors,
    // which is a different defect wearing this one's clothes.
    const liveTargeting = publisher.match(
      /visibility_kind = 'public'\s*\n\s*and competition\.completed_at is null|competition\.visibility_kind = 'public'\s*\n\s*and competition\.completed_at is null/g,
    )
    expect(liveTargeting?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(publisher).toContain(
      "on conflict (tournament_id, game_key)\n  where visibility_kind = 'public' and completed_at is null",
    )
  })

  it('names what a successor actually needs, rather than only refusing', () => {
    // An operator hitting this needs to know the script is not broken and what
    // is missing. The message says so; a bare "refused" would not.
    expect(publisher).toMatch(/window scheduler/i)
    expect(publisher).toMatch(/next eligible round/i)
  })
})
