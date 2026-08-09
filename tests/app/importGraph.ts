import { readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

/**
 * A static import walker, shared by the guards that need to know what a module
 * can actually reach.
 *
 * WHY A GRAPH RATHER THAN A GREP. Both boundaries this serves fail silently:
 * a route that reaches the tournament providers without them mounted throws
 * only when someone navigates to it, and a retired Euro journey re-imported
 * from a weekly surface ships in the bundle while looking like nothing. Neither
 * shows up in a search for one import line, because the reach is usually two or
 * three modules deep.
 *
 * IT IS DELIBERATELY CRUDE. It resolves relative specifiers only and does not
 * understand conditional imports, so it OVER-reports reach rather than under-
 * reporting it. For a boundary guard that is the safe direction: a false
 * positive is a conversation, a false negative is the defect shipping.
 */

const repositoryRoot = process.cwd()

/** Resolve a relative specifier to a real file, trying the usual extensions. */
export function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      /* not there, or a directory: try the next shape */
    }
  }
  return null
}

/** Every specifier a module imports, static and dynamic alike. */
export function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  return [
    ...[...source.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*'([^']+)'/g)].map(
      (match) => match[1] as string,
    ),
    ...[...source.matchAll(/\bimport\('([^']+)'\)/g)].map((match) => match[1] as string),
  ]
}

export type ReachOptions = {
  /**
   * Path fragments the walk must not follow through. The one caller that needs
   * this uses it for `src/dev/`: those harnesses are behind
   * `import.meta.env.DEV`, which Vite replaces with `false` so the dynamic
   * import is dead code and never reaches a production bundle — but this walker
   * cannot see a build-time constant, so without the stop it reports the whole
   * component gallery as production-reachable.
   *
   * A stop rather than a filter on the RESULT, because the point is what the
   * gallery drags in behind it, not the gallery itself.
   */
  stopAt?: readonly string[]
}

/** Every file reachable from an entry, including the entry itself. */
export function reachableFrom(entry: string, options: ReachOptions = {}): Set<string> {
  const stops = options.stopAt ?? []
  const seen = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    if (stops.some((stop) => file.includes(stop))) continue
    for (const specifier of importsOf(file)) {
      const resolved = resolveSpecifier(file, specifier)
      if (resolved && !seen.has(resolved)) queue.push(resolved)
    }
  }

  return seen
}

/** Whether any of `targets` is reachable from `entry`. */
export function reaches(entry: string, targets: readonly string[]): boolean {
  const absolute = targets.map((path) => resolve(repositoryRoot, path))
  const graph = reachableFrom(entry)
  return absolute.some((target) => graph.has(target))
}

/** Repository-relative, for a failure message somebody has to act on. */
export function fromRoot(file: string): string {
  return relative(repositoryRoot, file)
}
