/**
 * Where the worker is served from, in one line both sides can import.
 *
 * SEPARATE FROM `buildServiceWorker.ts` FOR A REASON THE BUNDLE CARES ABOUT.
 * That module reads the filesystem and imports Vite, so it belongs to the
 * build; the browser needs only this string, and importing the builder to get
 * it would pull Node built-ins into the application graph.
 *
 * The path is the root, and it has to be: a worker's default scope is the
 * directory it is served from, so `/assets/sw.js` would control `/assets/**`
 * and nothing a player ever navigates to.
 */
export const SERVICE_WORKER_PATH = '/sw.js'
