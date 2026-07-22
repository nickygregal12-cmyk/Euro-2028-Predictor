import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Theme is a persisted user setting (design-system §1). Dark is the default;
// the choice is stored locally and applied as data-theme on <html>, which is
// what tokens.css keys off.

export type Theme = 'dark' | 'light'
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
  theme: Theme
  toggle: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    applyThemeColor(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* storage unavailable (private mode) — theme still applies for the session */
    }
  }, [theme])

  const value: ThemeContextValue = {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
