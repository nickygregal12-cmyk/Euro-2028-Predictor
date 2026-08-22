import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('agent task routing documentation', () => {
  it('keeps routing metadata explicitly below repository authorities', () => {
    const guide = read('docs/ops/agent-task-routing.md')
    const rootAgents = read('AGENTS.md')

    expect(guide).toContain('navigation infrastructure, not a decision authority')
    expect(guide).toContain('Use one fact, one home')
    expect(rootAgents).toContain('Neither is a product or hosted-state authority')
  })

  it('keeps the vNext router materially smaller than the old combined contract', () => {
    expect(statSync(resolve(root, 'src/vnext/AGENTS.md')).size).toBeLessThan(10_000)
  })
})
