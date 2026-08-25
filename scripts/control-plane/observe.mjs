/**
 * Observe one pull request over the GitHub REST API, and observe nothing else.
 *
 * WHY THIS IS NOT IN `github.mjs`. That module opens by saying fetching is
 * deliberately not there: "different callers reach GitHub by different routes
 * ... and none of them should be able to change the verdict." This is the
 * fetcher. It produces the raw observation `normalisePullRequest` expects and
 * takes no part in deciding anything, so the split it describes still holds.
 *
 * WHY IT EXISTS AT ALL. `delivery.push` parks a task on `WAITING_CI` with
 * `nextAction: 'a watcher supplies check evidence for this head'`, and until
 * now nothing supplied it. A parked task that nothing can release is not a
 * checkpoint, it is a dead end.
 *
 * WHAT IT MAY DO. `ci.read`, `review.read` and `repository.read` are the three
 * READ_ONLY entries in the bounded owner-authority allowlist, and this needs
 * exactly those. Every request is a GET, the method is not a parameter, and the
 * repository comes from the tracked identity record rather than from a caller —
 * so this cannot be pointed at another repository any more than the push
 * wrapper can.
 */

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** The pinned `owner/repo`, read the same way every enforcing edge reads it. */
export function pinnedRepository(
  runCommand = (/** @type {string[]} */ argv) =>
    execFileSync(/** @type {string} */ (argv[0]), argv.slice(1), {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
) {
  return runCommand([
    'node',
    resolve(REPOSITORY_ROOT, 'scripts/check-pre-live-owner-authority.mjs'),
    '--repository',
  ]).trim()
}

/**
 * A pull request number, or a refusal.
 *
 * The number reaches a URL path, so it is checked as a number rather than
 * trusted as a string. `'1 OR 1'`, `'../../other/pulls/1'` and `''` all read as
 * plausible in a config file and none of them is a pull request.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function assertPullNumber(value) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isSafeInteger(number) || number < 1 || String(value).trim() !== String(number)) {
    throw new Error(`not a pull request number: ${JSON.stringify(value)}`)
  }
  return number
}

/**
 * A commit SHA, or a refusal. Same reasoning as the number: it reaches a path.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function assertCommitSha(value) {
  const sha = String(value ?? '')
  if (!/^[0-9a-f]{7,40}$/.test(sha)) {
    throw new Error(`not a commit sha: ${JSON.stringify(value)}`)
  }
  return sha
}

/** The default reader: a GET, and only a GET. */
async function getJson(/** @type {string} */ path) {
  const response = await fetch(`https://api.github.com/${path}`, {
    method: 'GET',
    headers: { accept: 'application/vnd.github+json' },
  })
  if (!response.ok) {
    throw new Error(`GET ${path} answered ${response.status}`)
  }
  return response.json()
}

/**
 * Everything `normalisePullRequest` needs about one pull request, gathered in
 * four reads.
 *
 * Check runs are fetched for the pull request's OWN head, read back from the
 * pull request itself rather than passed in. Asking for a head someone else
 * supplied is how evidence ends up belonging to a different commit than the one
 * it is about to be used for — the fail-open `decideCanaryMerge` already exists
 * to catch, and there is no reason to create it again one layer earlier.
 *
 * @param {{ number: unknown, repository?: string | undefined,
 *           read?: ((path: string) => Promise<any>) | undefined }} input
 */
export async function observePullRequest({ number, repository, read = getJson }) {
  const pull = assertPullNumber(number)
  const target = repository ?? pinnedRepository()

  const observed = await read(`repos/${target}/pulls/${pull}`)
  const head = assertCommitSha(observed?.head?.sha)

  const [checks, status, reviews] = await Promise.all([
    read(`repos/${target}/commits/${head}/check-runs?per_page=100`),
    read(`repos/${target}/commits/${head}/status`),
    read(`repos/${target}/pulls/${pull}/reviews?per_page=100`),
  ])

  return {
    ...observed,
    checkRuns: checks?.check_runs ?? [],
    statuses: status?.statuses ?? [],
    reviews: reviews ?? [],
  }
}

/**
 * The read-only handler that releases a parked task, or leaves it parked.
 *
 * It returns the observation and says which head it belongs to. It does not
 * decide anything: `pr.triage` in `cli.mjs` already turns an observation into a
 * verdict, and keeping the fetch and the verdict apart is the whole point of
 * the split described at the top of this file.
 *
 * @param {{ repository?: string | undefined,
 *           read?: ((path: string) => Promise<any>) | undefined,
 *           writeObservation: (path: string, contents: string) => void }} options
 */
export function observeHandlers({ repository, read, writeObservation }) {
  return {
    'ci.observe': async (/** @type {any} */ { task, at }) => {
      if (!task?.observationFile) {
        return {
          ok: false,
          failureClass: 'UNKNOWN',
          evidence: 'task.observationFile is required: an observation nobody can read is not evidence',
        }
      }
      try {
        const observation = await observePullRequest({
          number: task.pullNumber,
          repository,
          read,
        })
        writeObservation(task.observationFile, `${JSON.stringify(observation, null, 2)}\n`)
        const head = observation.head?.sha
        return {
          ok: true,
          evidence: `observed #${observation.number} at ${head}`,
          checkpoint: {
            at,
            pr: observation.number,
            sha: head,
            completed: 'pull request observed',
            observationFile: task.observationFile,
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Reading GitHub is the one thing this does, so a failure here is about
        // reaching GitHub rather than about the pull request. The shared
        // classifier already knows the difference between a 403, a 429 and a
        // 503, and the loop needs that difference to decide whether waiting
        // helps.
        const { classifyFailure } = await import('./policy.mjs')
        return { ok: false, failureClass: classifyFailure({ name: 'ci.observe', output: message }), evidence: message }
      }
    },
  }
}
