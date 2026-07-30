import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Stage C changes the scope behind many validators, but the function definition
 * alone is not the protection: the trigger binding is. This guard resolves the
 * effective non-internal trigger bindings expressed by committed migrations and
 * compares them with the reviewed Stage C inventory.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const triggerInventoryPath = resolve(
  repositoryRoot,
  'docs/architecture/stage-c-trigger-bindings.md',
)
const coverageManifestPath = resolve(
  repositoryRoot,
  'docs/architecture/stage-c-schema-coverage.md',
)

type TriggerBinding = {
  functionName: string
  table: string
  trigger: string
}

type TriggerEvent =
  | { action: 'remove'; bindingKey: string }
  | { action: 'set'; binding: TriggerBinding; bindingKey: string }

function blankCharacter(character: string): string {
  return character === '\n' ? '\n' : ' '
}

/** Remove comments, strings and dollar-quoted bodies while preserving layout. */
function stripNonCode(source: string): string {
  let output = ''
  let index = 0

  while (index < source.length) {
    if (source.startsWith('--', index)) {
      while (index < source.length && source[index] !== '\n') {
        output += ' '
        index += 1
      }
      continue
    }

    if (source.startsWith('/*', index)) {
      let depth = 1
      output += '  '
      index += 2

      while (index < source.length && depth > 0) {
        if (source.startsWith('/*', index)) {
          depth += 1
          output += '  '
          index += 2
          continue
        }
        if (source.startsWith('*/', index)) {
          depth -= 1
          output += '  '
          index += 2
          continue
        }
        output += blankCharacter(source[index])
        index += 1
      }
      continue
    }

    if (source[index] === "'") {
      output += ' '
      index += 1

      while (index < source.length) {
        if (source[index] === '\\' && index + 1 < source.length) {
          output += ` ${blankCharacter(source[index + 1])}`
          index += 2
          continue
        }
        if (source[index] === "'" && source[index + 1] === "'") {
          output += '  '
          index += 2
          continue
        }
        if (source[index] === "'") {
          output += ' '
          index += 1
          break
        }
        output += blankCharacter(source[index])
        index += 1
      }
      continue
    }

    if (source[index] === '$') {
      const dollarTag = source
        .slice(index)
        .match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0]

      if (dollarTag) {
        output += ' '.repeat(dollarTag.length)
        index += dollarTag.length

        while (index < source.length && !source.startsWith(dollarTag, index)) {
          output += blankCharacter(source[index])
          index += 1
        }

        if (source.startsWith(dollarTag, index)) {
          output += ' '.repeat(dollarTag.length)
          index += dollarTag.length
        }
        continue
      }
    }

    output += source[index]
    index += 1
  }

  return output
}

function publicTable(schema: string | undefined, table: string): string | null {
  if (schema && schema.toLowerCase() !== 'public') return null
  return table.toLowerCase()
}

function triggerEvents(source: string): TriggerEvent[] {
  const events: TriggerEvent[] = []

  for (const statement of stripNonCode(source).split(';')) {
    const create = statement.match(
      /\bcreate\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+([a-z_][a-z0-9_]*)[\s\S]*?\bon\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\b[\s\S]*?\bexecute\s+(?:function|procedure)\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s*\(/i,
    )

    if (create) {
      const table = publicTable(create[2], create[3])
      if (table) {
        const trigger = create[1].toLowerCase()
        const functionName = `${create[4]?.toLowerCase() ?? 'public'}.${create[5].toLowerCase()}`
        events.push({
          action: 'set',
          binding: { functionName, table, trigger },
          bindingKey: `${table}.${trigger}`,
        })
      }
      continue
    }

    const drop = statement.match(
      /\bdrop\s+trigger\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)\s+on\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\b/i,
    )

    if (drop) {
      const table = publicTable(drop[2], drop[3])
      if (table) {
        events.push({
          action: 'remove',
          bindingKey: `${table}.${drop[1].toLowerCase()}`,
        })
      }
    }
  }

  return events
}

function effectiveTriggerBindings(): string[] {
  const bindings = new Map<string, TriggerBinding>()

  for (const migration of readdirSync(migrationsDirectory).sort()) {
    if (!migration.endsWith('.sql')) continue
    const source = readFileSync(resolve(migrationsDirectory, migration), 'utf8')

    for (const event of triggerEvents(source)) {
      if (event.action === 'remove') {
        bindings.delete(event.bindingKey)
      } else {
        bindings.set(event.bindingKey, event.binding)
      }
    }
  }

  return [...bindings]
    .map(
      ([bindingKey, binding]) =>
        `${bindingKey} -> ${binding.functionName}`,
    )
    .sort()
}

function reviewedTriggerBindings(): string[] {
  const inventory = readFileSync(triggerInventoryPath, 'utf8')
  const section = inventory.split('## Current effective bindings')[1]?.split('## Change rules')[0]
  expect(section, 'current trigger binding inventory section').toBeTruthy()

  const bindings: string[] = []
  const rowPattern =
    /^\|\s*`([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)`\s*\|\s*`([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)`\s*\|/gm

  for (const match of section!.matchAll(rowPattern)) {
    bindings.push(`${match[1]} -> ${match[2]}`)
  }

  return bindings.sort()
}

function manifestTriggerAuthorityFunctions(): string[] {
  const manifest = readFileSync(coverageManifestPath, 'utf8')
  const section = manifest
    .split('## 7. Existing validators and authorities')[1]
    ?.split('## 8. RLS, views, grants and definer coverage')[0]
  expect(section, 'Stage C trigger authority manifest section').toBeTruthy()

  const functions = new Set<string>()
  const pattern = /^-\s+`([a-z_][a-z0-9_]*)`\s*$/gm
  for (const match of section!.matchAll(pattern)) functions.add(match[1])
  return [...functions].sort()
}

const effectiveBindings = effectiveTriggerBindings()
const reviewedBindings = reviewedTriggerBindings()
const effectiveFunctionNames = effectiveBindings.map((binding) =>
  binding.split(' -> ')[1].split('.').at(-1)!,
)
const manifestFunctions = manifestTriggerAuthorityFunctions()

describe('Stage C trigger binding coverage', () => {
  it('keeps the parser positive control at the current trigger boundary', () => {
    expect(effectiveBindings).toHaveLength(43)
    expect(
      effectiveBindings.filter((binding) =>
        binding.endsWith(' -> public.enforce_entry_lock_generic'),
      ),
    ).toHaveLength(5)
    expect(
      effectiveBindings.filter((binding) =>
        binding.endsWith(' -> public.enforce_write_version'),
      ),
    ).toHaveLength(3)
    expect(
      effectiveBindings.filter((binding) =>
        binding.endsWith(' -> predictor_internal.enforce_match_result_boundary'),
      ),
    ).toHaveLength(2)
  })

  it('reviews every effective public-table trigger binding exactly once', () => {
    expect(reviewedBindings).toEqual(effectiveBindings)
  })

  it('keeps every named Stage C trigger authority attached', () => {
    const unattached = manifestFunctions.filter(
      (functionName) => !effectiveFunctionNames.includes(functionName),
    )

    expect(unattached).toEqual([])
  })
})
