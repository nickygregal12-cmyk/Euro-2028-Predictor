import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 174 redefines `predictor_internal.consume_provider_responses` from
 * contract 135's committed text with one added call. THIS FILE IS THE DIFF THAT
 * CLAIM REFERS TO, and it exists because the first attempt did not have one.
 *
 * ---------------------------------------------------------------------------
 * WHAT WENT WRONG, AND WHY A SUBSTRING CHECK IS NOT A DIFF
 * ---------------------------------------------------------------------------
 *
 * Contract 174's migration originally asserted the redefinition by checking
 * that certain function NAMES still appeared in the new body — that it still
 * called `stage_provider_fixture_proposals`, `import_provider_fixture_revisions`
 * and so on. Every one of those checks passed against a body that had been
 * hand-copied wrong in five places:
 *
 *   * `processing.decoded` for `processing.succeeded` — a column that does not
 *     exist, so the function raised on its first real call;
 *   * `processing.raw_response_id` for `raw.id as raw_response_id`;
 *   * the `normalized_payload is not null` conjunct, dropped;
 *   * `order by processing.processed_at, processing.id`, dropped;
 *   * `coalesce(p_limit, 20)` changed to 25 — a silent behaviour change.
 *
 * Database parity caught it, in suite `186`, with `column processing.decoded
 * does not exist`. Contract 124 established this control after a hand-copied
 * tail drifted; the lesson it recorded is that reading a copy does not catch a
 * substituted one, and a substring assertion is a way of reading it.
 *
 * So the check is now a real diff: both function bodies are extracted from the
 * committed migrations and compared line by line. The only permitted difference
 * is the contract 174 call.
 */

const repositoryRoot = process.cwd()
const migrations = resolve(repositoryRoot, 'supabase/migrations')

const CONSUMER = /create or replace function predictor_internal\.consume_provider_responses[\s\S]*?\n\$consume\$;\n/

function consumerIn(migration: string): string {
  const source = readFileSync(resolve(migrations, migration), 'utf8')
  const match = CONSUMER.exec(source)
  if (!match) throw new Error(`no consume_provider_responses definition in ${migration}`)
  return match[0]
}

const committed = consumerIn('20260809050000_provider_result_authority.sql')
const redefined = consumerIn('20260811234000_provider_calendar_change_proposals.sql')

describe('contract 174 redefines the provider consumer from committed text', () => {
  it('finds both definitions at all', () => {
    // The positive control. A renamed function or a changed dollar-quote tag
    // would otherwise make every assertion below compare nothing to nothing.
    expect(committed).toContain('provider_response_consumption')
    expect(redefined).toContain('provider_response_consumption')
    expect(committed.length).toBeGreaterThan(2000)
  })

  it('changes nothing except adding the contract 174 call', () => {
    const before = committed.split('\n')
    const after = redefined.split('\n')

    // Every line of the original must survive, in order, apart from the single
    // line the added block extends — which reappears with its terminator moved.
    const added = after.filter((line) => !before.includes(line))
    const removed = before.filter((line) => !after.includes(line))

    expect(
      added.every(
        (line) =>
          line.includes('detect_provider_calendar_changes') ||
          line.includes('CONTRACT 174') ||
          line.trimStart().startsWith('--') ||
          line.includes("'changes',") ||
          line.includes('v_row.raw_response_id, p_now, null, null)') ||
          line.includes('v_row.provider, v_tournament_id, v_row.normalized_payload,'),
      ),
      `unexpected added lines:\n${added.join('\n')}`,
    ).toBe(true)

    expect(
      removed,
      'the redefinition dropped a line of the committed consumer',
    ).toEqual(['              v_row.raw_response_id, p_now));'])
  })

  it('keeps the exact selection the committed consumer used', () => {
    // Named individually as well as diffed, because these five are what the
    // hand-copy got wrong and each is silent in a different way: a wrong column
    // raises, a dropped null guard passes bad payloads on, a dropped ordering
    // changes which response is consumed first, and a changed limit changes how
    // much work one tick does.
    for (const fragment of [
      'where processing.succeeded',
      'and processing.normalized_payload is not null',
      'order by processing.processed_at, processing.id',
      'limit greatest(coalesce(p_limit, 20), 1)',
      'raw.id as raw_response_id',
    ]) {
      expect(redefined, `the redefinition lost: ${fragment}`).toContain(fragment)
    }
  })

  it('adds no second call and no coverage window', () => {
    const calls = redefined.match(/detect_provider_calendar_changes/g) ?? []
    expect(calls).toHaveLength(1)

    // The automatic path must never declare a payload complete. If it ever
    // does, withdrawal detection starts proposing that real fixtures be voided
    // on the strength of a silence nobody promised.
    expect(redefined).not.toMatch(/detect_provider_calendar_changes\s*\([^;]*p_covers/)
  })
})
