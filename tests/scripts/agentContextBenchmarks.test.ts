import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

interface BenchmarkResult {
  ok: boolean
  limits: {
    maxGraphifyBudget: number
    maxCandidatePaths: number
    maxAuthorities: number
    maxSelectedSkills: number
    maxPacketBytesWithoutGraph: number
  }
  routing: {
    graphifyBudget: number
    maxCandidatePaths: number
    maxAuthorities: number
  }
  cases: Array<{
    id: string
    routes: number
    authorities: number
    skills: number
    packetBytes: number
    graphRequired: boolean
  }>
  failures: string[]
}

function runBenchmark(): BenchmarkResult {
  const output = execFileSync(
    process.execPath,
    ['scripts/agent-tools/benchmark-context.mjs', '--check', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  return JSON.parse(output) as BenchmarkResult
}

describe('agent context acceptance benchmark', () => {
  it('keeps representative simple prompts inside the bounded task-packet contract', () => {
    const result = runBenchmark()

    expect(result.ok, result.failures.join('\n')).toBe(true)
    expect(result.failures).toEqual([])
    expect(result.cases).toHaveLength(15)
    expect(result.routing.graphifyBudget).toBeLessThanOrEqual(1200)
    expect(result.routing.maxCandidatePaths).toBeLessThanOrEqual(8)
    expect(result.routing.maxAuthorities).toBeLessThanOrEqual(3)
    expect(Math.max(...result.cases.map((benchmarkCase) => benchmarkCase.skills))).toBeLessThanOrEqual(3)
    expect(Math.max(...result.cases.map((benchmarkCase) => benchmarkCase.packetBytes))).toBeLessThanOrEqual(8192)
  })

  it('keeps the benchmark prompts unique and includes a deliberate graph-required case', () => {
    const benchmark = JSON.parse(
      readFileSync(resolve(root, 'config/agent-context-benchmarks.json'), 'utf8'),
    ) as {
      cases: Array<{ id: string; prompt: string; expectNoDeterministicFallback?: boolean }>
    }

    expect(new Set(benchmark.cases.map((benchmarkCase) => benchmarkCase.id)).size).toBe(benchmark.cases.length)
    expect(new Set(benchmark.cases.map((benchmarkCase) => benchmarkCase.prompt)).size).toBe(benchmark.cases.length)
    expect(benchmark.cases.some((benchmarkCase) => benchmarkCase.expectNoDeterministicFallback)).toBe(true)
  })

  it('keeps the documented benchmark command wired through package scripts', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts['agent:bench']).toBe('node scripts/agent-tools/benchmark-context.mjs')
  })
})
