import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * THE `kind: 'account'` INTENT MUST NOT LEAVE vNEXT.
 *
 * `VNextShell` emits this intent from two places — the desktop rail and the
 * mobile top bar — and in both it is a button showing THE SIGNED-IN PLAYER'S
 * OWN NAME. Until Stage 13 nothing in the lane answered it, and every harness
 * routed it to the legacy `/account`: pressing your own name inside a vNext
 * surface dropped you into the production visual system.
 *
 * That is the defect Stage 13's authority calls its anchor, and it is exactly
 * the sort that comes back — a new harness copied from an old one reintroduces
 * it in one line, and nothing else in the suite would notice. So it is pinned
 * structurally rather than per harness.
 *
 * WHY A SOURCE SCAN RATHER THAN A RENDER. Each harness owns a `useNavigate`
 * closure over a real router; rendering eleven of them to press one button
 * would be eleven auth providers and eleven networks for one assertion about a
 * destination. The thing being asserted is a routing decision written in the
 * source, so the source is what is read.
 */

const DEV = join(process.cwd(), 'src', 'dev')

const harnesses = readdirSync(DEV)
  .filter((name) => name.startsWith('VNext') && name.endsWith('Preview.tsx'))
  .map((name) => ({ name, source: readFileSync(join(DEV, name), 'utf8') }))

/**
 * A harness ANSWERS the intent if it names it at all, in any syntax. Keying on
 * the literal `case 'account':` let an `if (intent.kind === 'account')` harness
 * fall out of the checked set entirely and still satisfy the floor below — the
 * scan would have been silent about exactly the file that reintroduced the
 * defect.
 */
const answering = harnesses.filter((file) => /['"]account['"]/.test(file.source))

describe('every vNext harness that answers the account intent keeps it inside vNext', () => {
  it('finds harnesses to check at all, so the scan cannot pass vacuously', () => {
    expect(harnesses.length).toBeGreaterThanOrEqual(11)
    expect(answering.length).toBeGreaterThanOrEqual(11)
  })

  it.each(answering.map((file) => file.name))('%s does not route to legacy /account', (name) => {
    const file = answering.find((entry) => entry.name === name)
    expect(file?.source).not.toMatch(/navigate\(\s*['"]\/account['"]\s*\)/)
  })

  it.each(answering.map((file) => file.name))(
    '%s sends it to the vNext account surface, or is that surface',
    (name) => {
      const file = answering.find((entry) => entry.name === name)
      const source = file?.source ?? ''
      const routes = source.includes("navigate('/dev/vnext-account')")
      // The account harness itself answers by staying put rather than by
      // navigating to where it already is.
      const isAccount = name === 'VNextAccountPreview.tsx'
      expect(routes || isAccount).toBe(true)
    },
  )
})
