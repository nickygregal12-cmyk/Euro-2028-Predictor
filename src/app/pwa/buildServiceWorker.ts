import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformWithOxc } from 'vite'

/**
 * Turn `serviceWorker.ts` into the classic script a build emits as `/sw.js`.
 *
 * WHY A TRANSFORM RATHER THAN A BUNDLE. The worker imports nothing, on purpose,
 * so stripping its types and substituting two build-time constants is the whole
 * job. Keeping it to a transform means no second bundler configuration, no
 * second dependency, and — the part that matters — the file a reader opens is
 * the file that ships, rather than an entry point to a graph they have to
 * assemble in their head.
 *
 * WHY THIS IS A MODULE AND NOT INLINE IN `vite.config.ts`. The test suite runs
 * this exact function and then EXECUTES its output against a fake service
 * worker scope. Testing the transform's product rather than a paraphrase of it
 * is what makes "the worker never answers a write" a fact about the deployed
 * artefact instead of a claim about a source file.
 *
 * `type: 'module'` workers are deliberately not used. Support is now broad, but
 * a classic script is what every browser that can install a progressive web app
 * accepts, and this worker gains nothing from module syntax.
 *
 * THE TWO BUILD CONSTANTS ARE SUBSTITUTED AS TEXT, AFTER the transform rather
 * than by it. Vite 8's transform is Oxc, which strips the types but does not
 * offer esbuild's `define`; and esbuild itself is no longer bundled with Vite
 * and cannot run in the test runner's environment at all. The two identifiers
 * are unique, ambient and never re-declared, which is what makes a textual
 * replacement safe here and what `assertSubstituted` refuses to assume.
 */

export { SERVICE_WORKER_PATH } from './serviceWorkerPath.js'

/**
 * The worker's source on disk.
 *
 * Vite serves this module to the test runner over http, where `import.meta.url`
 * is not a file URL and `fileURLToPath` throws — so the location is taken from
 * the module URL where that is possible and from the repository root where it
 * is not. Both resolve to the same file; the test would be worthless if they
 * did not.
 */
const moduleUrl = new URL('./serviceWorker.ts', import.meta.url)
const sourcePath =
  moduleUrl.protocol === 'file:'
    ? fileURLToPath(moduleUrl)
    : resolve(process.cwd(), 'src/app/pwa/serviceWorker.ts')

export type ServiceWorkerBuild = {
  /** Root-relative paths the worker precaches at install. */
  readonly precache: readonly string[]
  /** Names this build's cache; a change here retires the previous one. */
  readonly version: string
}

/**
 * A version that changes whenever anything precached changes.
 *
 * The release commit alone is not enough locally, where it is the literal
 * string `local` for every build; the precache list alone is not enough
 * either, because `/index.html`, the manifest and the icons keep their names
 * across content changes. Hashing the list under the release covers both.
 */
export function serviceWorkerVersion(
  release: string,
  precache: readonly string[],
): string {
  const digest = createHash('sha256')
    .update(JSON.stringify([...precache].sort()))
    .digest('hex')
    .slice(0, 12)
  return `${release}-${digest}`
}

/** The emitted `/sw.js` for one build. */
export async function buildServiceWorker(
  build: ServiceWorkerBuild,
): Promise<string> {
  const source = readFileSync(sourcePath, 'utf8')
  const { code } = await transformWithOxc(source, sourcePath, {
    lang: 'ts',
    target: 'es2022',
  })

  return [
    ['__SW_PRECACHE__', JSON.stringify(build.precache)],
    ['__SW_VERSION__', JSON.stringify(build.version)],
  ].reduce(
    (emitted, [token, value]) => substitute(emitted, token!, value!),
    code,
  )
}

/**
 * Replace one ambient constant, and refuse a build that has none to replace.
 *
 * A silent no-op here would emit a worker referencing an undefined identifier —
 * which throws on the very first line the browser runs, leaving every installed
 * player with a worker that cannot start and no signal that anything is wrong.
 * Renaming the constant in the source should break the build, loudly.
 */
function substitute(code: string, token: string, value: string): string {
  const pattern = new RegExp(`\\b${token}\\b`, 'g')
  if (!pattern.test(code)) {
    throw new Error(
      `The service worker source no longer references ${token}. ` +
        'The build constants and src/app/pwa/serviceWorker.ts must agree.',
    )
  }
  return code.replace(new RegExp(`\\b${token}\\b`, 'g'), value)
}
