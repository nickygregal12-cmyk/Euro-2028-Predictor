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
 * Each is separately enforced — the contract by `validate-deployment-contract.mjs`
 * and pgTAP by the parity job — but nothing related them. They can drift into
 * disagreeing about the same function: an RPC granted to `authenticated` but
 * never contract-declared falls outside the deploy guarantee, and a contract
 * entry the database grants to nobody is a requirement no environment satisfies.
 *
 * The invariant is not equality. The contract legitimately declares six
 * service-role-only RPCs the browser never calls — the Cron-invoked submission
 * sweep, the operating-limit setter and the three Predictor Cup administration
 * functions — so:
 *
 *   contract = pgTAP-authenticated ∪ (some subset of pgTAP-service-role)
 *
 * Text-based, so it needs no database and runs in ordinary CI alongside the
 * execution-based parity subjects.
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

/** Compare signatures without whitespace or the `public.` qualifier. */
function normalise(signature: string): string {
  return signature.replace(/^public\./, '').replace(/\s+/g, '')
}

/**
 * Signatures inserted into one of the pgTAP expectation tables. The table is
 * populated by several `insert … values` statements, so all of them are read.
 *
 * Comments are stripped BEFORE the literals are scanned, and that is not
 * tidiness. This scanner pairs quotes positionally, so a single apostrophe
 * anywhere in a `--` comment inside the values list re-pairs every quote after
 * it: the parse shifts by one and real signatures fall out of the set. It
 * happened — a comment reading "so a browser session must never be able to
 * trigger it" on behalf of "a player's" entry silently dropped
 * `set_operating_limits` from the service-role allow-list, and the failure
 * pointed at a function nobody had touched.
 *
 * A comment must never be able to change what a parser thinks the data is.
 */
function pgTapExpectations(table: string): Set<string> {
  const found = new Set<string>()
  const source = privilegeTest.replace(/--[^\n]*/g, '')
  const pattern = new RegExp(
    `insert into ${table} \\(signature\\) values([\\s\\S]*?);`,
    'g',
  )
  for (const statement of source.matchAll(pattern)) {
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
    // Without this, a renamed pgTAP table would empty the comparison and make
    // every assertion below pass vacuously.
    expect(contract.size).toBeGreaterThan(30)
    expect(authenticated.size).toBeGreaterThan(30)
    expect(serviceRole.size).toBeGreaterThan(10)
  })

  it('contract-declares every RPC the database grants to authenticated', () => {
    // A browser-callable RPC outside the contract is outside the deploy
    // guarantee: nothing fails the build when the target database lacks it.
    const undeclared = [...authenticated]
      .filter((signature) => !contract.has(signature))
      .sort()

    expect(undeclared).toEqual([])
  })

  it('declares nothing the database grants to no one', () => {
    // The other direction. A contract entry that neither role can execute is a
    // requirement no environment can satisfy, so it would never fail loudly —
    // it would just never be true.
    const grantedToNobody = [...contract]
      .filter(
        (signature) =>
          !authenticated.has(signature) && !serviceRole.has(signature),
      )
      .sort()

    expect(grantedToNobody).toEqual([])
  })

  it('keeps the non-browser contract entries service-role only', () => {
    // Pinned so that a function moving from service-role-only to
    // browser-callable has to be a deliberate, visible change here as well as in
    // the privilege test.
    const serviceOnly = [...contract]
      .filter((signature) => !authenticated.has(signature))
      .sort()

    expect(serviceOnly).toEqual([
      'admin_disqualify_competition_game_entry(uuid,uuid,text)',
      'admin_draw_predictor_cup(uuid,text)',
      'admin_finalise_predictor_cup_groups(uuid)',
      'admin_settle_predictor_cup_round(uuid,uuid)',
      'process_due_entry_submissions(timestampwithtimezone)',
      'set_operating_limits(integer,integer)',
    ])
  })

  it('agrees on the anonymous surface being the capacity read alone', () => {
    // The one function anonymous visitors may execute. Anything else appearing
    // here is a pre-auth data exposure.
    expect([...pgTapExpectations('expected_anon_functions')]).toEqual([
      'get_public_capacity()',
    ])
    expect(contract.has('get_public_capacity()')).toBe(true)
  })
})
