import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The premium prototype stays a reference, not a production architecture.
 *
 * `src/premium/` is a parallel mock application — its own router, mock store,
 * mock data, modal system and Lenis scroll loop — built to show what the
 * finished product should feel like. `docs/design/ui-modernisation-execution.md`
 * classifies it as a visual reference from which patterns are EXTRACTED into
 * the production design system, and records why wiring it in wholesale is
 * prohibited: a second router, a second component language, and the provisional
 * Touchline brand while brand selection remains deferred under ADR 0019.
 *
 * That classification only holds while the prototype stays unreachable from
 * the production application. A single convenient import — a component reused
 * "just for now", a route mounted behind a flag — would pull the mock store,
 * the second router and the deferred brand into the real bundle. So the
 * boundary is pinned here rather than trusted.
 *
 * Lenis gets its own assertion because it is the one prototype dependency that
 * ships in `package.json` dependencies: a whole-page scroll hijack is a named
 * suspect in the design preview's Lighthouse performance collapse, and it must
 * not reach a production surface without route-level performance evidence.
 */

const srcRoot = resolve(__dirname, '../../src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path)
    return /\.(ts|tsx)$/.test(entry) ? [path] : []
  })
}

const productionFiles = walk(srcRoot).filter(
  (path) => !path.startsWith(join(srcRoot, 'premium')),
)

describe('premium prototype boundary', () => {
  it('finds the prototype where the classification says it is', () => {
    expect(readdirSync(join(srcRoot, 'premium'))).toContain('PremiumApp.tsx')
  })

  it('no production source imports from src/premium', () => {
    const importers = productionFiles.filter((path) =>
      /from\s+['"][^'"]*premium\//i.test(readFileSync(path, 'utf8')),
    )
    expect(importers).toEqual([])
  })

  it('no production source imports lenis', () => {
    const importers = productionFiles.filter((path) =>
      /from\s+['"]lenis['"]/.test(readFileSync(path, 'utf8')),
    )
    expect(importers).toEqual([])
  })

  it('the application entry mounts the production App', () => {
    const main = readFileSync(join(srcRoot, 'main.tsx'), 'utf8')
    expect(main).toContain("import App from './App.tsx'")
    expect(main).not.toContain('Premium')
  })
})
