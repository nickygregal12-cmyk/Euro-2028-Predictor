import { useEffect, useState, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { VNextReducedMotionContext } from './motion'
import { VNextFeedbackContext } from './feedbackContext'
import type { FeedbackPreference } from './feedback'
import './tokens.css'
import styles from './VNextRoot.module.css'

export type VNextMotionSetting = 'system' | 'reduced' | 'full'

/**
 * `system` follows the device. The other two are a deliberate choice, and the
 * product persists one — see the prop docs below.
 */
export type VNextThemeSetting = 'system' | 'dark' | 'light'

export type VNextRootProps = {
  children: ReactNode
  /**
   * `system` is the production behaviour and the default. The other two exist
   * so a reviewer can compare both motion paths side by side in the workshop
   * without changing an operating-system setting.
   */
  motion?: VNextMotionSetting
  /**
   * WHICH THEME, AND WHY IT IS NOT JUST DARK.
   *
   * vNext is dark by default and the product is designed for it. But the live
   * application has persisted a user theme choice since long before this lane
   * existed, and Stage 14 makes vNext that application — so shipping dark-only
   * would take a setting away from every player who had chosen light. That is
   * `DEC-016`, and this prop is its answer.
   *
   * `system` is the default and follows `prefers-color-scheme`, so a player who
   * has never chosen gets what their device says. `dark` and `light` are a
   * choice, and a choice outranks the device — which is the same precedence the
   * production `ThemeProvider` uses.
   */
  theme?: VNextThemeSetting
  /**
   * WHETHER THE PLAYER WANTS TO BE BUZZED.
   *
   * `system` is the default and means "not chosen", which resolves to on — see
   * `feedback.ts`. It is provided here rather than passed to each surface
   * because a preference threaded through twenty components is one that gets
   * dropped on the way to one of them, and a dropped preference is
   * indistinguishable from a setting that does not work.
   *
   * IT IS NOT `motion`. A vestibular preference and a preference about being
   * vibrated are different preferences held by different people for different
   * reasons, and no product authority here says otherwise.
   */
  haptics?: FeedbackPreference
  /** Fills its container instead of the viewport. Used inside device frames. */
  fill?: boolean
}

/**
 * The boundary of the vNext lane.
 *
 * Everything vNext renders sits inside this element, and every vNext token is
 * declared on its `data-vnext` attribute. That is what keeps the two frontends
 * apart: no vNext value is defined at `:root`, so the live product cannot
 * inherit one, and vNext is free to look nothing like it.
 */
export function VNextRoot({
  children,
  motion = 'system',
  theme = 'system',
  haptics = 'system',
  fill = false,
}: VNextRootProps) {
  const override = motion === 'system' ? null : motion === 'reduced'
  const systemPrefersLight = useSystemPrefersLight()

  // RESOLVED HERE, NOT IN CSS. A `prefers-color-scheme` media query in
  // `tokens.css` would apply the light ramp to a player who chose dark on a
  // light device, because a media query cannot see a choice. Resolving it here
  // means the attribute always states the theme the player is actually in, and
  // the stylesheet has one rule to answer instead of two that can disagree.
  const resolved = theme === 'system' ? (systemPrefersLight ? 'light' : 'dark') : theme

  return (
    <VNextReducedMotionContext.Provider value={override}>
      <VNextFeedbackContext.Provider value={haptics}>
      {/* MotionConfig covers Framer's own defaults; the context above covers the
          variants this codebase writes by hand. Both are needed: one without the
          other leaves half the motion unreduced. */}
      <MotionConfig reducedMotion={reducedMotionSetting(motion)}>
        <div
          data-vnext=""
          data-vnext-motion={motion === 'system' ? undefined : motion}
          // Dark is the default ramp, so it needs no attribute; only light
          // switches anything on. The attribute is always present for light
          // even when it came from the device, because a stylesheet cannot ask
          // why.
          data-vnext-theme={resolved === 'light' ? 'light' : undefined}
          className={`${styles.root} ${fill ? styles.fill : ''}`}
        >
          {children}
        </div>
      </MotionConfig>
      </VNextFeedbackContext.Provider>
    </VNextReducedMotionContext.Provider>
  )
}

/**
 * Whether the device asks for light.
 *
 * `matchMedia` is absent in jsdom for some setups and in any non-browser
 * render, so its absence resolves to the product default — dark — rather than
 * throwing. Subscribed rather than read once: a player who changes their system
 * theme while the tab is open should see it, which is the behaviour the
 * production provider already has.
 */
function useSystemPrefersLight(): boolean {
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

function reducedMotionSetting(
  motion: VNextMotionSetting,
): 'user' | 'always' | 'never' {
  if (motion === 'reduced') return 'always'
  if (motion === 'full') return 'never'
  return 'user'
}
