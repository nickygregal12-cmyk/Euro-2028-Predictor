import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Parity between the two independently-maintained allow-lists of the same RPCs.
 *
 * `config/deployment-contract.json` declares what the *application* requires, so
 * a deploy fails when the target database cannot serve it. `supabase/tests/
 * 080_function_privileges.sql` declares what the *database* grants, and asserts
 * that exhaustively in both directions against `pg_proc`.
 *
 * The invariant is not equality. The contract legitimately declares
 * service-role-only RPCs the browser never calls — scheduled processing,
 * administration, operating controls and internal provider custody — so:
 *
 *   contract = pgTAP-authenticated ∪ (some subset of pgTAP-service-role)
 */

const repositoryRoot = process.cwd()

const contractSignatures: string[] = (
  JSON.parse(
    readFileSync(resolve(repositoryRoot, 'config/deployment-contract.json'), 'utf8'),
  ) as { requiredRpcSignatures: string[] }
).requiredRpcSignatures

const privilegeTest = readFileSync(
  resolve(repositoryRoot, 'supabase/tests/080_function_privileges.sql'),
  'utf8',
)

function normalise(signature: string): string {
  return signature.replace(/^public\./, '').replace(/\s+/g, '')
}

function pgTapExpectations(table: string): Set<string> {
  const found = new Set<string>()
  const pattern = new RegExp(
    `insert into ${table} \\(signature\\) values([\\s\\S]*?);`,
    'g',
  )
  for (const statement of privilegeTest.matchAll(pattern)) {
    for (const literal of statement[1].matchAll(/'([^']+)'/g)) {
      found.add(normalise(literal[1]))
    }
  }
  return found
}

const contract = new Set(contractSignatures.map(normalise))
const authenticated = pgTapExpectations('expected_authenticated_functions')
const serviceRole = pgTapExpectations('expected_service_functions')

describe('deployment contract and database privilege allow-list parity', () => {
  it('parses both allow-lists at all', () => {
    expect(contract.size).toBeGreaterThan(30)
    expect(authenticated.size).toBeGreaterThan(30)
    expect(serviceRole.size).toBeGreaterThan(10)
  })

  it('contract-declares every RPC the database grants to authenticated', () => {
    const undeclared = [...authenticated]
      .filter((signature) => !contract.has(signature))
      .sort()

    expect(undeclared).toEqual([])
  })

  it('declares nothing the database grants to no one', () => {
    const grantedToNobody = [...contract]
      .filter(
        (signature) =>
          !authenticated.has(signature) && !serviceRole.has(signature),
      )
      .sort()

    expect(grantedToNobody).toEqual([])
  })

  it('keeps the non-browser contract entries service-role only', () => {
    const serviceOnly = [...contract]
      .filter((signature) => !authenticated.has(signature))
      .sort()

    expect(serviceOnly).toEqual([
      'admin_disqualify_competition_game_entry(uuid,uuid,text)',
      'admin_draw_predictor_cup(uuid,text)',
      'admin_finalise_predictor_cup_groups(uuid)',
      'admin_settle_predictor_cup_round(uuid,uuid)',
      'archive_provider_response(text,text,text,integer,jsonb,text,uuid)',
      'process_due_entry_submissions(timestampwithtimezone)',
      'record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text)',
      'set_operating_limits(integer,integer)',
    ])
  })

  it('agrees on the anonymous surface being the capacity read alone', () => {
    expect([...pgTapExpectations('expected_anon_functions')]).toEqual([
      'get_public_capacity()',
    ])
    expect(contract.has('get_public_capacity()')).toBe(true)
  })
})
