import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A SMALL STATIC GUARD FOR THE CLASS OF BUG THAT STARTED THIS BATCH.
 *
 * `data-vnext-control` is deliberately reserved for release-critical controls
 * that also have browser journey assertions. This test is not a substitute for
 * those journeys: an `onClick` can still call an unwired optional host callback.
 * It catches the cheaper failure first — markup that looks like a control but
 * has no interaction at all — while Playwright proves the host-side observable
 * effect under the shipping router.
 */
function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (/\.tsx$/.test(path)) out.push(path)
  }
  return out
}

function releaseControls(source: string): Array<{ name: string; nearby: string }> {
  const found: Array<{ name: string; nearby: string }> = []
  const marker = /data-vnext-control=["']([^"']+)["']/g
  for (const match of source.matchAll(marker)) {
    const index = match.index ?? 0
    found.push({
      name: match[1] ?? 'unnamed',
      // Opening JSX tags in these presentation files keep their event binding
      // adjacent to the marker. A deliberately generous window survives normal
      // formatting without pretending this is a JSX parser.
      nearby: source.slice(Math.max(0, index - 450), Math.min(source.length, index + 700)),
    })
  }
  return found
}

describe('marked shipping-vNext controls are not inert markup', () => {
  const files = filesUnder(resolve(process.cwd(), 'src/vnext'))
  const controls = files.flatMap((file) =>
    releaseControls(readFileSync(file, 'utf8')).map((control) => ({ file, ...control })),
  )

  it('finds the release-control vocabulary so the guard cannot pass vacuously', () => {
    expect(new Set(controls.map((control) => control.name)).size).toBeGreaterThanOrEqual(4)
  })

  it('gives every marked control an interaction binding in its JSX neighbourhood', () => {
    const inert = controls
      .filter(
        (control) =>
          !/\bonClick\s*=|\bonChange\s*=|\bonSubmit\s*=|\bhref\s*=/.test(control.nearby),
      )
      .map((control) => `${control.file}: ${control.name}`)

    expect(
      inert,
      `Release-critical controls with no nearby interaction binding:\n${inert.join('\n')}`,
    ).toEqual([])
  })
})
