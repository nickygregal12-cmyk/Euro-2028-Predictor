import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromRoot, reachableFrom } from '../app/importGraph'

/**
 * vNext IS A PARALLEL LANE, AND THIS IS THE THING THAT KEEPS IT PARALLEL.
 *
 * `src/vnext/AGENTS.md` says the workshop "is not wired into the running
 * product", and until now nothing failed if it became so. That mattered less
 * when vNext was four components; Stage 3 added three whole Home compositions,
 * and the way a design workshop stops being isolated is never a decision — it
 * is one import added from a production surface because a component looked
 * reusable, which then ships an unapproved design language and its tokens in
 * the production bundle while looking like an ordinary refactor.
 *
 * Same shape as `parkedEuroBoundary` and `premiumPrototypeBoundary`, and for
 * the same reason: a parallel tree that must not be wired in needs a test
 * saying so, because a comment does not fail.
 *
 * The `src/dev/` stop is the same one those suites need — the harnesses there
 * are behind `import.meta.env.DEV`, which Vite replaces with `false`, so the
 * branch is dead code in a production build. A static walker cannot see a
 * build-time constant.
 */

const repositoryRoot = process.cwd()

function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (/\.tsx?$/.test(path)) out.push(path)
  }
  return out
}

const vnextFiles = filesUnder(resolve(repositoryRoot, 'src/vnext'))
const productionGraph = reachableFrom(resolve(repositoryRoot, 'src/main.tsx'), {
  stopAt: ['/src/dev/'],
})

describe('the vNext workshop', () => {
  it('finds the tree and the graph, so the boundary is not vacuous', () => {
    // A renamed directory or a broken walk would otherwise empty this suite and
    // take the boundary with it.
    expect(vnextFiles.length).toBeGreaterThan(25)
    expect(productionGraph.size).toBeGreaterThan(100)
  })

  it('is unreachable from the production entry', () => {
    const reachable = vnextFiles.filter((file) => productionGraph.has(file))

    expect(
      reachable.map(fromRoot),
      'these vNext modules are reachable from src/main.tsx — a production ' +
        'surface has imported one, which ships an unapproved design language ' +
        'and its tokens in the production bundle',
    ).toEqual([])
  })

  it('does not import a production feature from the other direction either', () => {
    // vNext is allowed to use React, Framer Motion and lucide — the
    // dependencies the repository already has. It is not allowed to reach into
    // `src/features/`, `src/services/` or the legacy design system: the whole
    // premise is that it is a presentation lane on deterministic fixtures, and
    // an import from any of those is either a Supabase dependency arriving by
    // the back door or a visual inheritance the lane exists to avoid.
    const forbidden = ['/src/features/', '/src/services/', '/src/design-system/']
    const offenders: string[] = []

    for (const file of vnextFiles) {
      for (const reached of reachableFrom(file)) {
        if (forbidden.some((tree) => reached.includes(tree))) {
          offenders.push(`${fromRoot(file)} -> ${fromRoot(reached)}`)
        }
      }
    }

    expect([...new Set(offenders)], 'vNext reached into the production app').toEqual([])
  })
})
