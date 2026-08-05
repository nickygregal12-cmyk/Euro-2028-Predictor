#!/usr/bin/env node
/**
 * Run the Lighthouse audit against a build that actually renders.
 *
 * THE PROBLEM THIS SOLVES. The application throws `Missing Supabase
 * configuration` at module load when `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` are absent, and those values are inlined by Vite at
 * BUILD time — they cannot be supplied to an existing `dist`. So on a clean
 * checkout, with no `.env.local`, the documented `npm run check:lighthouse`
 * built a bundle that rendered nothing and the audit died with a bare
 * `NO_FCP` runtime error. The command in the quality documentation did not run.
 *
 * This supplies placeholder configuration when, and only when, the caller has
 * supplied none, then builds and audits. A developer with real `.env.local`
 * values, or a workflow that provides them, keeps what they set: Vite gives
 * shell variables precedence over `.env` files, so overriding unconditionally
 * would silently audit a different configuration than the one being worked on.
 *
 * The placeholders are deliberately unusable. The audited routes are the
 * signed-out auth screens, which render their form before they talk to
 * anything, so a reachable project is neither needed nor wanted — an audit
 * should not depend on a network service being up, and must never be pointed
 * at a real one by default.
 *
 * WHY THERE IS NO BLANK-PAGE ASSERTION HERE. There was one, and it was
 * removed: it guarded a failure that cannot happen. Lighthouse refuses to
 * score a page that painted nothing — it aborts the run with `NO_FCP` ("The
 * page did not paint any content") and `lhci autorun` exits non-zero — so a
 * blank build fails loudly rather than returning flattering numbers. Measured,
 * not assumed: a build with the variables removed exits 1 and writes no
 * report, while a rendered auth screen reports 28 DOM elements and scores
 * normally. A second guard on top of that would be ceremony.
 */

import { execFileSync } from 'node:child_process'

const root = process.cwd()

/**
 * Placeholder values, used only when the caller has supplied nothing.
 *
 * `.invalid` is reserved by RFC 2606 and can never resolve, which is the point:
 * if a change ever makes an audited route depend on the network, it fails here
 * rather than quietly measuring somebody's live project.
 */
const PLACEHOLDER = {
  VITE_SUPABASE_URL: 'https://lighthouse-placeholder.supabase.invalid',
  VITE_SUPABASE_ANON_KEY: 'lighthouse-placeholder-not-a-real-key',
}

function environmentForAudit() {
  const environment = { ...process.env }
  const supplied = []
  for (const [name, value] of Object.entries(PLACEHOLDER)) {
    if (environment[name]) continue
    environment[name] = value
    supplied.push(name)
  }

  if (supplied.length === 0) {
    console.log('Auditing with the Supabase configuration already in the environment.')
  } else {
    console.log(`Supplying placeholder ${supplied.join(' and ')} so the build renders.`)
  }

  return environment
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @param {NodeJS.ProcessEnv} environment
 */
function run(command, args, environment) {
  execFileSync(command, args, { stdio: 'inherit', env: environment, cwd: root })
}

const environment = environmentForAudit()

run('npm', ['run', 'build'], environment)
run('npx', ['lhci', 'autorun'], environment)
