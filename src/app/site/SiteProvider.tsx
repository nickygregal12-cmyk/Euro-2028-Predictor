import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { currentSiteConfiguration } from './currentSite.js'
import { type SiteConfiguration } from './siteConfiguration.js'

/**
 * Hands the running build's `SiteConfiguration` to the tree.
 *
 * WHY A CONTEXT AND NOT A MODULE-LEVEL CONSTANT. A constant read at import time
 * is the shape that makes two-product builds untestable: the only way to render
 * the other site is to mutate `import.meta.env` before the module graph loads,
 * which no test can do reliably and which leaks between test files when it
 * works. With a provider, a test renders the Euro navigation and the Hub
 * navigation in the same process by passing a different value, and the assertion
 * is about the components rather than about module loading order.
 *
 * IT HAS NO DEFAULT PROVIDER-LESS FALLBACK OF ITS OWN INVENTION. Outside a
 * provider, `useSite()` returns the configuration the environment selects —
 * which fails closed to the Hub. A component that renders outside the provider
 * therefore gets the weekly platform, never a tournament nobody published.
 */

const SiteContext = createContext<SiteConfiguration | null>(null)

export type SiteProviderProps = {
  /** Injectable so both products can be rendered in one test process. */
  readonly configuration?: SiteConfiguration
  readonly children: ReactNode
}

export function SiteProvider({ configuration, children }: SiteProviderProps) {
  const value = useMemo(
    () => configuration ?? currentSiteConfiguration(),
    [configuration],
  )
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteConfiguration {
  const value = useContext(SiteContext)
  // Falling back rather than throwing is deliberate: a missing provider must
  // degrade to the safe product, not to a blank screen. The fallback is the
  // same fail-closed resolution the provider itself would perform.
  return value ?? currentSiteConfiguration()
}
