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

    if (sourceContract !== null && targetContract !== null) {
      it(`${workflow} expects as many migrations as its own span`, () => {
        // The number of migrations in a boundary IS the span: 198 to 204 is six.
        // Stating it a second time creates something that can disagree with the
        // contracts beside it, and it did -- retargeting 198-to-203 to
        // 198-to-204 left `[ "${count}" = 5 ]` behind, so the rehearsal refused
        // the correct six-migration set with "boundary holds 6 migrations,
        // expected 5", and it took dispatching it against Production to notice.
        //
        // Deriving the number is the fix and the current workflows do that. A
        // literal is still permitted, because the finished historical
        // boundaries carry one and rewriting them would change a record of what
        // actually ran -- but a literal that CONTRADICTS the span is refused.
        const span = Number(targetContract) - Number(sourceContract)
        const literals = [...source.matchAll(/boundary holds \$\{count\} migrations, expected (\d+)\./g)]
        for (const found of literals) {
          expect(
            Number(found[1]!),
            `${workflow} spans contracts ${sourceContract} to ${targetContract} — ` +
              `${span} migrations — but expects ${found[1]}. Derive the count from ` +
              'TARGET_CONTRACT minus SOURCE_CONTRACT so retargeting cannot leave it behind.',
          ).toBe(span)
        }
      })
    }

    it(`${workflow} compares only keys its before-snapshot actually measures`, () => {
      // The rehearsal verification compares an after-measurement against a
      // before-measurement, key by key:
      //
      //   for (const k of ['ai_predictions','ai_bets','ai_models_current']) eq(k, b[k])
      //
      // Those three keys were added to the AFTER measurement and to this list,
      // and never to the BEFORE one. `b[k]` was therefore undefined and the
      // assertion could not pass at all -- it failed the 198-to-205 rehearsal
      // with "ai_bets=230, expected undefined", AFTER a Production dump, a
      // restore and seven green pgTAP suites had already been paid for.
      //
      // A comparison against a key nobody measured is not a weak check, it is
      // an impossible one, and it is answerable from the file alone.
      const measured = new Set<string>()
      const beforeStep = /Measure the disposable copy before applying|Capture exact pre-apply Production state/.exec(source)
      if (beforeStep === null) return
      const afterBefore = source.slice(beforeStep.index)
      const sqlEnd = afterBefore.indexOf('- name:', 40)
      const beforeSql = sqlEnd === -1 ? afterBefore : afterBefore.slice(0, sqlEnd)
      for (const key of beforeSql.matchAll(/^\s*'([a-z_]+)',\(select/gm)) measured.add(key[1]!)

      const compared = new Set<string>()
      for (const list of source.matchAll(/for \(const k of \[([^\]]+)\]\) eq\(k, b\[k\]\)/g)) {
        for (const quoted of list[1]!.matchAll(/'([a-z_]+)'/g)) compared.add(quoted[1]!)
      }
      if (compared.size === 0 || measured.size === 0) return

      const unmeasured = [...compared].filter((key) => !measured.has(key)).sort()
      expect(
        unmeasured,
        `${workflow} compares ${unmeasured.join(', ')} against a before-snapshot that ` +
          'never measures them, so the comparison is against undefined and cannot pass. ' +
          'Add the key to the before measurement rather than dropping it from the check.',
      ).toEqual([])
    })

    it(`${workflow} has balanced parentheses in every embedded jsonb_build_object`, () => {
      // The 198-to-205 ROLLOUT applied all seven migrations to Production and
      // then failed, because its postflight measurement carried one closing
      // parenthesis too many:
      //
      //   'pass_codes_explained',(select ... not like 'No explanation%')),
      //
      // That closed jsonb_build_object early, so psql reported "syntax error at
      // or near )" against the LAST line of a 64-line statement, 60 lines from
      // the actual mistake. Production was left correctly migrated with its own
      // verification never having run -- the worst moment for a check to be
      // unrunnable, and entirely detectable from the file.
      //
      // SQL line comments are stripped BEFORE counting. The first version of
      // this guard did not, so an apostrophe inside a comment ("the boundary's
      // own count") flipped the string state and it reported both files
      // unbalanced -- including one already proven to execute end to end. A
      // guard that cries wolf on correct files is worse than none.
      for (const block of source.matchAll(/select jsonb_build_object\(/g)) {
        const rest = source.slice(block.index!)
        const end = rest.indexOf('\n          SQL')
        const raw = end === -1 ? rest : rest.slice(0, end)
        const text = raw
          .split('\n')
          .map((line) => line.replace(/^\s*--.*$/, ''))
          .join('\n')
        let depth = 0
        let inString = false
        for (let i = 0; i < text.length; i += 1) {
          const ch = text[i]
          if (ch === "'") {
            if (inString && text[i + 1] === "'") { i += 1; continue }
            inString = !inString
          } else if (!inString && ch === '(') depth += 1
          else if (!inString && ch === ')') depth -= 1
        }
        expect(
          depth,
          `${workflow} has an unbalanced jsonb_build_object block (depth ${depth}). ` +
            'A stray parenthesis closes the object early and psql blames the last ' +
            'line of the statement, not the line that is wrong.',
        ).toBe(0)
      }
    })

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
