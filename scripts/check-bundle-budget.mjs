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
// ALL JS IS THE TIGHT ONE NOW, at 292.8 of 300 KB. Nothing here addresses it;
// it is recorded so the next session meets it as a known position rather than
// as a surprise on a red check.
const BUDGETS = {
  entryChunkKb: 75,
  totalJsKb: 300,
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
