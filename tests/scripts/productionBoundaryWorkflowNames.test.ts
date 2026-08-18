import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A promotion workflow names the migration it starts from and the one it ends
 * at. Those names are prose in a YAML file, and prose does not fail to compile.
 *
 * The 198-to-203 pair was derived from the 190-to-198 pair, and carried the
 * OLDER pair's `SOURCE_NAME` across while its `SOURCE_CONTRACT` and
 * `SOURCE_VERSION` were updated: it claimed contract 198 was
 * `ai_actionable_bet_evidence`, which is contract 190. The preflight caught it
 * against the live database -- "Production latest_name=cup_knockout_reservation,
 * expected ai_actionable_bet_evidence" -- but only after a backup had been taken
 * and only because Production happened to be reachable.
 *
 * The migration chain is committed, so this is answerable without a database
 * and before anything is dispatched. Every `SOURCE_*` and `TARGET_*` triple in
 * a promotion workflow must name a migration that EXISTS and must agree with
 * that file's own version and name.
 */
const repositoryRoot = resolve(import.meta.dirname, '..', '..')
const workflowDir = resolve(repositoryRoot, '.github', 'workflows')
const migrationDir = resolve(repositoryRoot, 'supabase', 'migrations')

/** version -> name, from the committed chain. */
function migrationChain(): Map<string, string> {
  const chain = new Map<string, string>()
  for (const file of readdirSync(migrationDir).filter((n) => n.endsWith('.sql'))) {
    const match = /^(\d{14})_(.+)\.sql$/.exec(file)
    if (match) chain.set(match[1]!, match[2]!)
  }
  return chain
}

function boundaryWorkflows(): string[] {
  return readdirSync(workflowDir).filter((name) =>
    /^production-\d+-to-\d+-(rehearsal|rollout)\.yml$/.test(name),
  )
}

function envValue(source: string, key: string): string | null {
  const match = new RegExp(`^\\s{2}${key}:\\s*'?([^'\\n]+)'?\\s*$`, 'm').exec(source)
  return match ? match[1]!.trim() : null
}

describe('a promotion workflow names migrations that exist', () => {
  const chain = migrationChain()
  const workflows = boundaryWorkflows()

  it('finds the promotion workflows to check', () => {
    // A glob that matches nothing passes every assertion below vacuously.
    expect(workflows.length).toBeGreaterThan(0)
    expect(chain.size).toBeGreaterThan(0)
  })

  for (const workflow of workflows) {
    const source = readFileSync(resolve(workflowDir, workflow), 'utf8')

    const sourceContract = envValue(source, 'SOURCE_CONTRACT')
    const targetContract = envValue(source, 'TARGET_CONTRACT')
    if (sourceContract !== null && targetContract !== null) {
      it(`${workflow} has no step named after a contract outside its own span`, () => {
        // The same copy-forward that mis-named SOURCE_NAME also left a step
        // called "Confirm Production is exactly 190 before dumping it" on a
        // workflow whose boundary is 198 to 204. The check under that heading
        // reads SOURCE_CONTRACT and was correct; only the words a human reads
        // while approving a Production apply were wrong, which is the half
        // nothing else verifies.
        //
        // Three digits, because contract numbers here are three digits and
        // "PostgreSQL 17 client tools" is a version of something else. Any
        // contract INSIDE the span is fine: "Apply exactly Contracts 199 to
        // 204" names the first migration applied, not a boundary.
        const low = Number(sourceContract)
        const high = Number(targetContract)
        const offenders: string[] = []
        for (const match of source.matchAll(/^\s*- name:\s*(.+)$/gm)) {
          const stepName = match[1]!.trim()
          for (const digits of stepName.match(/\b\d{3}\b/g) ?? []) {
            const value = Number(digits)
            if (value < low || value > high) offenders.push(`${stepName} (${digits})`)
          }
        }
        expect(
          offenders,
          `${workflow} spans contracts ${low} to ${high}, but a step is named ` +
            'after a contract outside that span. An approver reads the step ' +
            'names, not the env block.',
        ).toEqual([])
      })
    }

    for (const edge of ['SOURCE', 'TARGET'] as const) {
      const version = envValue(source, `${edge}_VERSION`)
      const name = envValue(source, `${edge}_NAME`)
      if (version === null || name === null) continue

      it(`${workflow} states a ${edge} migration that is in the chain`, () => {
        expect(
          chain.has(version),
          `${workflow} names ${edge}_VERSION ${version}, which is not a committed migration`,
        ).toBe(true)
      })

      it(`${workflow} agrees with the chain about the ${edge} name`, () => {
        expect(
          chain.get(version),
          `${workflow} says ${edge}_NAME is ${name}, but ${version} is ` +
            `${chain.get(version)}. A promotion that mis-names its own boundary ` +
            'cannot be trusted to recognise the database it is pointed at.',
        ).toBe(name)
      })
    }
  }
})
