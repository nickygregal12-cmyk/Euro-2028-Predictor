import { useCallback, useState } from 'react'

/**
 * Whether the desktop rail is collapsed to its icon width, remembered between
 * visits.
 *
 * THE DESIGN AUTHORITY REQUIRES THE CHOICE TO PERSIST — 240px expanded, 64px
 * collapsed, "the user's choice is persisted" — and a rail that reopened on
 * every navigation would be worse than one that never collapsed.
 *
 * `localStorage` rather than the account, deliberately. This is a property of
 * the screen the player is sitting at, not of the player: a phone-sized browser
 * never sees the rail at all, and a preference synced from a laptop to a
 * borrowed desktop is noise. It also must not be a network read — the frame
 * renders before any account data does.
 *
 * IT FAILS TO "EXPANDED". Storage throws in a private-mode browser and returns
 * junk if something else wrote the key; both land on the state that shows the
 * player where they can go.
 */

const KEY = 'predictor.ui.rail-collapsed'

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

function write(collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(KEY, collapsed ? 'true' : 'false')
  } catch {
    /* A preference that cannot be stored is still honoured for this session. */
  }
}

export function useRailCollapsed(): { collapsed: boolean; toggle: () => void } {
  // Read once at mount rather than on every render: the value cannot change
  // except through the toggle below, and reading storage during render would
  // make the component impure.
  const [collapsed, setCollapsed] = useState(read)

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      write(next)
      return next
    })
  }, [])

  return { collapsed, toggle }
}
