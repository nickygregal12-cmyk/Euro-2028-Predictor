#!/usr/bin/env node
// Compressed bundle budgets (ACQ-R20).
//
// Budgets are gzip, because that is what the browser downloads — raw byte size
// over-reports by roughly 3x here and would drift for reasons nobody acts on.
// Netlify serves brotli where the client supports it, so gzip is the
// conservative proxy: a bundle inside the gzip budget is inside brotli too.
//
// Each budget sits above the measured value at the time it was set, so this is
// a ratchet against regression rather than a target to hit. Raising one should
// be a deliberate edit with a reason, not a reflex.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'

const root = process.argv[2] ?? resolve(process.cwd(), 'dist')

// Measured 30 July 2026 at contract 63: entry 63.4 KB, all JS 254.7 KB,
// all CSS 35.6 KB.
//
// CSS RE-RATCHETED 6 AUGUST 2026, DOWNWARDS. `cssCodeSplit: false` collapsed
// 39 per-route stylesheets into one and took all CSS from 44.5 KB to 29.8 KB —
// the 15 KB was per-file gzip loss rather than content, and the reasoning is
// recorded at length in `vite.config.ts`. Leaving the ceiling at 45 would have
// banked the saving as silent room and invited exactly the drift that caused
// it, so the budget follows the measurement down. 34 KB keeps roughly four
// kilobytes of headroom, which is now a great deal of it: a new surface's
// styles join an existing dictionary instead of starting a fresh one, so they
// cost a fraction of what they used to.
//
// THE ENTRY CHUNK WAS RAISED 9 AUGUST 2026, FROM 75 TO 76, AND THE ATTEMPTS
// THAT FAILED FIRST ARE THE REASON. At 75 the ceiling had 0.166 KB of headroom:
// `main` measured 74.834 KB gz and one route registration plus a title took it
// to 74.962 here, which CI's own build — not byte-identical to a local one —
// rounded past 75.000 and failed. A ceiling that a single route cannot fit
// under is not a ratchet, it is a stop.
//
// The obvious lever makes it WORSE, measured three times rather than assumed:
//
//   • lazy-loading the tournament data boundary          75.0 -> 76.9 KB gz
//   • lazy-loading the admin gate and its layout         75.0 -> 80.9 KB gz
//   • both, with the pages beneath them already lazy     no better
//
// Splitting a route out of this bundle hoists the modules it shares with the
// rest into the entry chunk, so the chunk grows while total JavaScript barely
// moves. That is worth knowing before the next session spends an afternoon on
// it. What DID work was removing something genuinely unreachable: the nine
// `/dev/*` route titles now build only in development, matching the routes
// themselves, for about 0.1 KB.
//
// 76 leaves roughly one kilobyte over the measured 74.962 and still refuses
// both split variants above, so the ceiling continues to catch the direction
// that made things worse rather than licensing it.
//
// ALL JS IS THE TIGHT ONE, and it moved from 292.8 to 228.5 of 300 KB when
// `cssCodeSplit: false` landed and the season surfaces were split out. Recorded
// so the next session meets the position rather than a surprise on a red check.
//
// RAISED FROM 300 TO 312 ON 11 AUGUST 2026, with the measurement and the reason
// rather than to make a check go green. The UI-finalisation consumption pass
// added the competition league table (contract 160), the action centre and the
// preference, onboarding, private-creation and invite surfaces, and the total
// crossed 300 by 0.3 KB — 0.1%. Reducing was considered first and the entry
// chunk WAS reduced, from 80.7 back to 75.0, by making the action-centre panel
// lazy and deferring `loadCompetitionWeek`; that is the number that decides
// what a first paint costs, and it is the one held tight at 76.
//
// The total is a different control: it bounds how much JavaScript the product
// is, across every route, and real features move it. 312 sits roughly twelve
// kilobytes above the measured 300.3, which is the same headroom-to-measurement
// shape the entry ceiling uses, so it still refuses a careless import while not
// refusing the features this pass was asked to build.
//
// RAISED FROM 312 TO 322 ON 11 AUGUST 2026, AND THE REASON IS THAT THIS NUMBER
// NOW MEASURES TWO PRODUCTS. ADR 0026's site-variant seam landed, so `dist`
// carries the route chunks of BOTH deployments — the weekly Prediction Hub's
// landing page and the Euro tournament's, and every surface each of them
// reaches. No visitor downloads both: the variant is fixed at build time and
// the two landing pages are separately lazy, so a Hub visitor never fetches a
// byte of the tournament page. The total crossed 312 by 1.0 KB.
//
// THE ENTRY CHUNK IS STILL THE TIGHT ONE, and it was reduced rather than
// excused: the site configuration first put the entry chunk 0.2 KB OVER 76, and
// the fix was to move the per-game copy into `siteGames.ts`, which only the
// lazily-routed games and landing surfaces import. That is recorded in that
// file, because it is a measured reason and not a stylistic one.
//
// 322 sits about ten kilobytes above the measured 313.0, the same
// headroom-to-measurement shape as before. If this number is raised again
// without the entry chunk holding, the thing to check first is whether one
// deployment's code has leaked into the other's critical path.
//
// THE ENTRY CHUNK WAS RAISED 11 AUGUST 2026, FROM 76 TO 77, AND THE TWO
// CHEAPER FIXES WERE MEASURED FIRST RATHER THAN ASSUMED. ADR 0026's variant
// destinations put the route ownership of BOTH products in the shell: the four
// shared addresses now resolve through a dispatcher rather than straight to the
// Hub's pages, which is the whole of what stops a signed-in Euro visitor being
// handed the domestic product. Measured from 75.8:
//
//   • the dispatcher static, both candidate pages lazy      76.4 KB gz
//   • the dispatcher itself ALSO lazy                       90.2 KB gz
//   • the Euro signup gate statically imported beside it    77.5 KB gz
//
// The second is the same hoisting effect recorded above and is far worse — the
// modules the four destinations share with the rest of the shell get pulled up
// while the total JavaScript barely moves. The third WAS reduced rather than
// excused: making `EuroSignupGate` lazy took 1.1 KB back out, because it drags
// contract 143's publication read and its lifecycle presentation table behind
// it to guard one route most visitors never open. That leaves 76.4 against a
// ceiling of 76.
//
// 77 leaves roughly half a kilobyte over the measurement, which is tighter than
// this ceiling has been. That is deliberate: it still refuses the lazy-
// dispatcher shape by a wide margin, and it keeps the number that decides what a
// first paint costs under pressure now that one shell serves two products.
const BUDGETS = {
  entryChunkKb: 77,
  totalJsKb: 322,
  totalCssKb: 34,
}

/**
 * Every file under a directory, recursively.
 *
 * @param {string} directory
 * @returns {string[]}
 */
function walk(directory) {
  /** @type {string[]} */
  const out = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

/**
 * @param {string} path
 * @returns {number} gzipped size in KB
 */
function gzipKb(path) {
  return gzipSync(readFileSync(path)).length / 1024
}

/** @type {string[]} */
let files
try {
  files = walk(root)
} catch {
  console.error(`No build output at ${root}. Run \`npm run build\` first.`)
  process.exit(1)
}

const js = files.filter((file) => file.endsWith('.js'))
const css = files.filter((file) => file.endsWith('.css'))

if (js.length === 0) {
  console.error('No JavaScript assets found — refusing to report a vacuous pass.')
  process.exit(1)
}

// The entry chunk is the one the browser must have before anything renders.
const entry = js
  .map((file) => ({ file, kb: gzipKb(file) }))
  .sort((left, right) => right.kb - left.kb)[0]

const totalJs = js.reduce((sum, file) => sum + gzipKb(file), 0)
const totalCss = css.reduce((sum, file) => sum + gzipKb(file), 0)

/** @type {[label: string, actual: number, budget: number, detail: string][]} */
const checks = [
  ['largest JS chunk', entry.kb, BUDGETS.entryChunkKb, entry.file],
  ['all JS', totalJs, BUDGETS.totalJsKb, `${js.length} files`],
  ['all CSS', totalCss, BUDGETS.totalCssKb, `${css.length} files`],
]

let failed = false
for (const [label, actual, budget, detail] of checks) {
  const status = actual > budget ? 'OVER' : 'ok'
  if (actual > budget) failed = true
  console.log(
    `${status.padEnd(4)} ${label.padEnd(17)} ${actual.toFixed(1).padStart(7)} KB gz / ${String(budget).padStart(3)} KB  (${detail})`,
  )
}

if (failed) {
  console.error(
    '\nCompressed bundle budget exceeded. Either reduce the bundle or raise the ' +
      'budget in scripts/check-bundle-budget.mjs with a reason.',
  )
  process.exit(1)
}
console.log('\nAll compressed bundle budgets met.')
