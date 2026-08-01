import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Classification = 'C1' | 'C2' | 'shared-before-state'
type InventoryRow = {
  assertion: string
  classification: Classification
  source: string
}
type SourceContract = {
  classification: Exclude<Classification, 'C2'>
  expectedCount: number
  kind: 'sql' | 'typescript'
  path: string
}

const repositoryRoot = process.cwd()
const classificationPath = resolve(
  repositoryRoot,
  'docs/architecture/stage-c1-contract-classification.md',
)

const SOURCE_CONTRACTS: Record<string, SourceContract> = {
  'stageCRelationCoverage.test.ts': {
    classification: 'C1',
    expectedCount: 3,
    kind: 'typescript',
    path: 'tests/database-parity/stageCRelationCoverage.test.ts',
  },
  'stageCFunctionCoverage.test.ts': {
    classification: 'C1',
    expectedCount: 4,
    kind: 'typescript',
    path: 'tests/database-parity/stageCFunctionCoverage.test.ts',
  },
  'stageCTriggerBindingCoverage.test.ts': {
    classification: 'C1',
    expectedCount: 3,
    kind: 'typescript',
    path: 'tests/database-parity/stageCTriggerBindingCoverage.test.ts',
  },
  'stageCTournamentIdCompatibility.test.ts': {
    classification: 'C1',
    expectedCount: 3,
    kind: 'typescript',
    path: 'tests/database-parity/stageCTournamentIdCompatibility.test.ts',
  },
  'stageCEuroSeedPreservation.test.ts': {
    classification: 'C1',
    expectedCount: 6,
    kind: 'typescript',
    path: 'tests/database-parity/stageCEuroSeedPreservation.test.ts',
  },
  '031_stage_c_reference_scope_before_state.sql': {
    classification: 'C1',
    expectedCount: 10,
    kind: 'sql',
    path: 'supabase/tests/031_stage_c_reference_scope_before_state.sql',
  },
  '032_stage_c_lock_before_state.sql': {
    classification: 'C1',
    expectedCount: 16,
    kind: 'sql',
    path: 'supabase/tests/032_stage_c_lock_before_state.sql',
  },
  'accountDeletionSemantics.test.ts': {
    classification: 'shared-before-state',
    expectedCount: 9,
    kind: 'typescript',
    path: 'tests/database-parity/accountDeletionSemantics.test.ts',
  },
}

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

function inventoryRows(): InventoryRow[] {
  const document = readFileSync(classificationPath, 'utf8')
  const section = document.split('## Assertion inventory')[1]?.split('## C1 transition rule')[0]
  expect(section, 'Stage C1 assertion inventory section').toBeTruthy()

  const rows: InventoryRow[] = []
  const rowPattern =
    /^\|\s*`([^`]+)`\s*\|\s*`(C1|C2|shared-before-state)`\s*\|\s*(.*?)\s*\|$/gm

  for (const match of section!.matchAll(rowPattern)) {
    rows.push({
      source: match[1],
      classification: match[2] as Classification,
      assertion: match[3],
    })
  }

  return rows
}

function typescriptAssertions(source: string): string[] {
  return [...source.matchAll(/\bit\(\s*(['"])(.*?)\1\s*,/g)].map((match) => match[2])
}

function sqlAssertions(source: string): string[] {
  const assertions: string[] = []
  const callPattern = /select\s+(?:throws_ok|lives_ok|is)\s*\(([\s\S]*?)^\s*\);\s*$/gim

  for (const call of source.matchAll(callPattern)) {
    const literals = [...call[1].matchAll(/'((?:''|[^'])*)'/g)].map((match) =>
      match[1].replaceAll("''", "'"),
    )
    const assertion = literals.at(-1)
    expect(assertion, 'pgTAP assertion description').toBeTruthy()
    assertions.push(assertion!)
  }

  return assertions
}

function sourceAssertions(contract: SourceContract): string[] {
  const source = read(contract.path)
  if (contract.kind === 'typescript') return typescriptAssertions(source)

  const plan = source.match(/select\s+plan\((\d+)\)/i)?.[1]
  expect(plan, `${contract.path} pgTAP plan`).toBeTruthy()
  expect(Number(plan)).toBe(contract.expectedCount)
  return sqlAssertions(source)
}

const rows = inventoryRows()

describe('Stage C1 assertion classification', () => {
  it('classifies every assertion without authorising a C2 after-state', () => {
    expect(rows.filter((row) => row.classification === 'C1')).toHaveLength(45)
    expect(rows.filter((row) => row.classification === 'C2')).toHaveLength(0)
    expect(rows.filter((row) => row.classification === 'shared-before-state')).toHaveLength(9)
    expect(rows).toHaveLength(54)
  })

  it('contains no duplicated source/assertion row', () => {
    const keys = rows.map((row) => `${row.source} :: ${row.assertion}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses only the reviewed source set', () => {
    expect([...new Set(rows.map((row) => row.source))].sort()).toEqual(
      Object.keys(SOURCE_CONTRACTS).sort(),
    )
  })

  it.each(Object.entries(SOURCE_CONTRACTS))(
    '%s has an exact executable classification',
    (sourceName, contract) => {
      const documented = rows
        .filter((row) => row.source === sourceName)
        .map((row) => row.assertion)
        .sort()
      const actual = sourceAssertions(contract).sort()

      expect(documented).toHaveLength(contract.expectedCount)
      expect(actual).toHaveLength(contract.expectedCount)
      expect(documented).toEqual(actual)
      expect(
        rows
          .filter((row) => row.source === sourceName)
          .every((row) => row.classification === contract.classification),
      ).toBe(true)
    },
  )

  it('keeps the governance boundary and executable guard discoverable', () => {
    const governance = read('docs/architecture/stage-c1-c2-governance.md')
    expect(governance).toContain('stage-c1-contract-classification.md')
    expect(governance).toContain('stageC1NonInterference.test.ts')
    expect(governance).toContain('issue #272')
  })
})
