import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

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
 * The invariant is not equality. The contract legitimately declares
 * service-role-only RPCs the browser never calls, including scheduled jobs,
 * operating controls, Predictor Cup administration and provider custody, so:
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
    for (const literal of at(statement, 1).matchAll(/'([^']+)'/g)) {
      found.add(normalise(at(literal, 1)))
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
      // Contract 185's paid-odds boundary. The Edge Function performs the
      // preflight and custody write. The dispatcher is owner/pg_cron-only and
      // therefore deliberately absent from this service-role list.
      'ai_odds_budget_check(integer)',
      'archive_provider_response(text,text,text,integer,jsonb,text,uuid)',
      // Contract 163's four delivery jobs. A browser role that could run any of
      // them could cause mail to be sent, or claim a batch and never resolve it.
      'claim_due_reminders(integer,boolean)',
      'process_due_entry_submissions(timestampwithtimezone)',
      // Contract 162's driver. An action item carries a deadline and a
      // completion verdict, so generating one is a server act by definition.
      'process_player_action_items()',
      'process_reminder_schedule(interval,boolean)',
      'reclaim_stalled_reminders(interval)',
      'record_ai_odds_snapshot(text,integer,jsonb,text,jsonb,integer,integer,integer,integer,text,text)',
      'record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text)',
      // Contract 216's callback, on exactly the same terms as the four above:
      // the sender closes the run the dispatcher opened, and a browser role
      // that could close one could report a delivery that never happened. The
      // dispatcher itself is owner/pg_cron-only and deliberately absent, as
      // contract 155's provider-poll dispatcher is.
      'record_reminder_dispatch_run(uuid,text,integer,integer,integer,integer,text)',
      'record_reminder_result(uuid,boolean,text,text,text)',
      // Contract 178's verification run. A job rather than an action: it
      // writes integrity evidence, and a browser session that could start one
      // could also flood the ledger. The administrator reads the result
      // through `admin_shadow_scoring_report`, which is browser-reachable.
      'run_shadow_scoring_verification(uuid,integer)',
      // Contract 181's per-league ceiling, on exactly contract 44's terms for
      // the two site-wide ones beside it: an operating limit is an operations
      // action, and a browser role that could raise one could raise its own.
      'set_league_member_limit(integer)',
      'set_operating_limits(integer,integer)',
    ])
  })

  it('agrees on the anonymous pre-auth surface exactly', () => {
    // The functions anonymous visitors may execute. Anything appearing here that
    // is not listed below is a pre-auth data exposure. Both entries are reviewed
    // decisions, and the list is deliberately exhaustive rather than a floor:
    // adding a third is a decision someone has to come here and make.
    expect([...pgTapExpectations('expected_anon_functions')]).toEqual([
      'get_public_capacity()',
      // Contract 143. Whether Euro 2028 is published has to be answerable
      // before a visitor signs in, because ADR 0026 requires the public site
      // and its route guard to fail closed from server truth rather than from
      // a client-side catalogue filter. The read is bounded to the state and
      // the instant it last changed: no actor, no reason and no history, all
      // of which stay in predictor_internal with no browser grant at all. The
      // mutation is not here — admin_transition_euro_publication_state is
      // granted to `authenticated` only and gates on super_admin internally.
      'euro_publication_state()',
    ])
    expect(contract.has('get_public_capacity()')).toBe(true)
    expect(contract.has('euro_publication_state()')).toBe(true)
  })
})
