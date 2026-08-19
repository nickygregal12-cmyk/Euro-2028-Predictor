import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ANYTHING POSITIONED BY A COMPUTED COORDINATE IS MEASURED IN A BROWSER.
 *
 * ============================ WHY THIS EXISTS ============================
 *
 * A drawing is the one thing in this lane that can be completely wrong and
 * completely green. Markup assertions see the elements; jsdom gives an `<svg>`
 * no geometry at all; a unit test of the scaling function proves the function
 * and says nothing about what reached the screen. A rank chart drawn upside
 * down renders without error, passes every render test, and is invisible to
 * every assertion that cannot see where the points went.
 *
 * `src/vnext/player/RankChart.tsx` is where that was first got right, and
 * `playwright.vnext.config.ts` records the technique on the spec that measures
 * it: the browser "reads the plotted coordinates out of the rendered SVG"
 * rather than recomputing them. `e2e/vnext-player-profile.spec.ts` then asserts
 * the RELATIONSHIPS — a climb is a decreasing `cy`, the series advances in
 * `cx`, and the extremes sit where the table beside the chart says they do.
 * Note what it does NOT do: an earlier version asserted only
 * `min(cy) < max(cy)`, which is true of a chart drawn upside down.
 *
 * ============================ WHY IT EXISTS *NOW* ========================
 *
 * That was one component's comment rather than the lane's rule, and Stage 12
 * draws a knockout bracket — ordering, connectors, byes and walkovers, every
 * one of them wrong in ways that render successfully. Recorded as `TEST-003`
 * in `docs/quality/risk-register.md` from the 19 August 2026 programme review,
 * which asked for the precedent to become the rule BEFORE the bracket is drawn.
 * It is, and this is the half of it that fails.
 *
 * ============================ WHAT IT CHECKS =============================
 *
 * A registry, in the shape this repository already uses for the e2e project
 * gating: every vNext component that positions anything by a computed
 * coordinate names the browser spec that reads those coordinates back. The
 * check runs in BOTH directions, so the registry cannot rot — an unregistered
 * drawing fails, and a registered file that has stopped drawing fails too.
 *
 * It deliberately does not fire on a drawing whose coordinates are all
 * literals. A static icon is a shape somebody typed, not a calculation that can
 * invert itself, and making the lane's future icon set answer to a chart rule
 * would be the kind of gate people work around rather than satisfy.
 *
 * WHAT IT CANNOT CHECK is that the assertions inside the named spec are the
 * RIGHT ones. Nothing mechanical can. It proves a browser reads the geometry
 * back; the reviewer still has to ask whether what it compares them against is
 * the model's own answer.
 */

const repositoryRoot = process.cwd()

/**
 * One entry per vNext source file that positions something by a computed
 * coordinate, naming the browser spec that measures what reached the screen.
 *
 * Adding a drawing means adding a line here and the measurements it points to.
 * That is the whole cost, and it is meant to be paid while the drawing is being
 * written rather than after somebody notices it is upside down.
 */
const MEASURED_BY: Record<string, string> = {
  'src/vnext/player/RankChart.tsx': 'e2e/vnext-player-profile.spec.ts',
}

/**
 * SVG geometry and placement attributes, when they are given an EXPRESSION.
 *
 * The lookbehind is load-bearing rather than tidy: without it `d=\{` matches
 * the `d` in every `id={...}` in the lane, and the registry would have to list
 * every component that gives an element an identifier.
 */
const COMPUTED_GEOMETRY =
  /(?<![\w-])(cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|dx|dy|points|d|width|height|viewBox|transform|offset|pathLength)=\{/

/**
 * A read of the geometry that actually reached the document, rather than a
 * recomputation of it. `getBBox` and `getBoundingClientRect` count for the same
 * reason `getAttribute('cx')` does: all three are answered by the browser.
 */
const READS_RENDERED_GEOMETRY =
  /getAttribute\(\s*['"](cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|points|d|transform|viewBox)['"]\s*\)|getBBox\(|getBoundingClientRect\(/

function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (path.endsWith('.tsx')) out.push(path)
  }
  return out
}

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

/** Draws, in the sense this rule means: an `<svg>` whose numbers are worked out. */
function drawsByComputedCoordinate(source: string): boolean {
  return source.includes('<svg') && COMPUTED_GEOMETRY.test(source)
}

const drawings = filesUnder(resolve(repositoryRoot, 'src/vnext'))
  .map((path) => relative(repositoryRoot, path))
  .filter((path) => drawsByComputedCoordinate(read(path)))
  .sort()

const vnextPlaywrightConfig = read('playwright.vnext.config.ts')

describe('a vNext drawing is measured in a browser', () => {
  it('registers every component that positions something by a computed coordinate', () => {
    expect(
      drawings.filter((path) => !(path in MEASURED_BY)),
      'a vNext component draws by computed coordinate and no browser spec is named for it. ' +
        'Add it to MEASURED_BY with the spec that reads its coordinates back out of the ' +
        'rendered document — a drawing that is only render-tested can be upside down and green.',
    ).toEqual([])
  })

  it('keeps the registry honest in the other direction too', () => {
    for (const path of Object.keys(MEASURED_BY)) {
      expect(existsSync(resolve(repositoryRoot, path)), `${path} is registered and does not exist`).toBe(
        true,
      )
      expect(
        drawings,
        `${path} is registered as a drawing and no longer draws by computed coordinate. ` +
          'Remove the entry rather than leaving a rule pointing at nothing.',
      ).toContain(path)
    }
  })

  it('names a spec that exists, runs, and reads the geometry back', () => {
    for (const [source, spec] of Object.entries(MEASURED_BY)) {
      expect(existsSync(resolve(repositoryRoot, spec)), `${spec} does not exist`).toBe(true)

      // A spec nothing runs is a rule nothing enforces. `playwright.vnext.config.ts`
      // lists its suite explicitly, so registration there is what makes the
      // measurement part of the gate rather than a file in a directory.
      expect(
        vnextPlaywrightConfig,
        `${spec} is named for ${source} but is not registered in playwright.vnext.config.ts, so it never runs`,
      ).toContain(spec.replace('e2e/', ''))

      expect(
        READS_RENDERED_GEOMETRY.test(read(spec)),
        `${spec} is named as the measurement for ${source} but never reads a rendered ` +
          'coordinate. Opening the story and asserting its markup is what this rule exists ' +
          'to stop being sufficient.',
      ).toBe(true)
    }
  })

  it('still recognises the drawing the rule was written from', () => {
    // A detector that silently matches nothing would pass every assertion above.
    // This is the fixed point that proves it is still looking.
    expect(drawings).toContain('src/vnext/player/RankChart.tsx')
  })
})
