import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Theme is a persisted user setting (design-system §1). Dark is the default;
// the choice is stored locally and applied as data-theme on <html>, which is
// what tokens.css keys off.

export type Theme = 'dark' | 'light'

/**
 * WHAT THE PLAYER ASKED FOR, WHICH IS NOT THE SAME AS WHAT THEY GET.
 *
 * `system` is a real third answer rather than the absence of one: it means
 * "follow my device". vNext's Account surface has offered all three since Stage
 * 13 — `VNextAccount`'s own note says a toggle "can only hold two, and the one
 * it drops is 'follow my device', which is what most people actually want" —
 * and this provider could only hold two, so the control was drawn against a
 * preference that could not express it.
 *
 * DARK IS STILL THE DEFAULT, WHICH `DEC-016` REQUIRES. An account that has
 * never chosen resolves to `dark`, exactly as before, so nobody's product
 * changes appearance because this type widened. `system` applies only to a
 * player who picked it.
 */
export type ThemeChoice = 'system' | Theme

const STORAGE_KEY = 'euro28-theme'

// Browser-chrome colour per theme. These hexes MUST match --bg in
// src/styles/tokens.css and the static theme-color metas in index.html — keep
// all three in sync (a token change here without the others silently desyncs
// the mobile status bar from the app background).
const THEME_COLOR: Record<Theme, string> = {
  dark: '#0A1128',
  light: '#F7F5F0',
}

// An in-app theme choice must beat the OS prefers-color-scheme media query that
// scopes the two static metas. Setting BOTH metas to the resolved colour means
// whichever one the OS matches yields the app-chosen colour.
function applyThemeColor(theme: Theme) {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  metas.forEach((meta) => {
    meta.setAttribute('content', THEME_COLOR[theme])
  })
}

type ThemeContextValue = {
  /** The theme in force. Always concrete: `system` is resolved before this. */
  theme: Theme
  /** What the player asked for, which a preferences control has to draw. */
  choice: ThemeChoice
  toggle: () => void
  setTheme: (theme: Theme) => void
  setChoice: (choice: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * EVERY VALUE THIS KEY HAS EVER HELD STILL MEANS WHAT IT MEANT.
 *
 * `'light'` and `'dark'` are what the binary provider wrote, and they still
 * resolve to themselves. `'system'` is the new one. ANYTHING ELSE, INCLUDING
 * ABSENT, IS `'dark'` — which is the behaviour every account that has never
 * opened this control already had, and is why widening the type moves nobody.
 */
function readStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'system') return stored
    return 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * Whether the device asks for light.
 *
 * Subscribed rather than read once: a player who chose "match my device" and
 * then changes their system theme should see it happen, not on the next reload.
 * `matchMedia` is absent in some non-browser renders, so its absence resolves
 * to the product default rather than throwing.
 */
function useDevicePrefersLight(): boolean {
  const [light, setLight] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: light)')
    setLight(query.matches)
    const onChange = (event: MediaQueryListEvent) => setLight(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return light
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice)
  const devicePrefersLight = useDevicePrefersLight()

  const theme: Theme = choice === 'system' ? (devicePrefersLight ? 'light' : 'dark') : choice

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    applyThemeColor(theme)
  }, [theme])

  // THE CHOICE IS STORED, NOT THE RESOLUTION. Writing the resolved theme would
  // turn "match my device" into whatever the device happened to say the first
  // time, permanently.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      /* storage unavailable (private mode) — the choice still applies for the session */
    }
  }, [choice])

  const value: ThemeContextValue = {
    theme,
    choice,
    setTheme: setChoiceState,
    setChoice: setChoiceState,
    // The app bar's control is a two-position switch and stays one. It acts on
    // the theme IN FORCE, so a player following their device who presses it
    // gets the opposite of what they are looking at, which is what the control
    // says it does.
    toggle: () => setChoiceState(theme === 'dark' ? 'light' : 'dark'),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

/**
 * THE CHOICE, OR THE PRODUCT DEFAULT, AND NEVER A THROW.
 *
 * `useTheme` throws because a component that asks to CHANGE the theme without a
 * provider is a wiring mistake worth failing loudly. Merely READING it is not:
 * `VNextAppRoot` reads it to decide which ramp a page paints in, and a missing
 * provider must degrade to dark — the documented default — rather than take the
 * page down with it. A story, a component gallery and an isolated render all
 * legitimately have no provider, and none of them is broken.
 */
export function useThemeChoice(): ThemeChoice {
  return useContext(ThemeContext)?.choice ?? 'dark'
}
