import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { FeedbackPreference } from '../../vnext/foundations/feedback'

/**
 * WHETHER THIS DEVICE BUZZES, AND WHERE THAT ANSWER IS KEPT.
 *
 * ============================ WHY IT IS LOCAL AND NOT AN ACCOUNT SETTING ==
 *
 * Vibration is a property of the thing in your hand. The same account is used
 * on a phone with a motor, a laptop with none and a tablet somebody else also
 * uses, and an account-level preference would answer for all three from
 * whichever one it was last set on. `ThemeProvider` stores appearance on the
 * same reasoning and the vNext Account surface heads that section "This
 * device", which is where this control belongs and what it says.
 *
 * It also means no migration and no contract: a preference that needs a hosted
 * rollout before a player can turn a vibration off would be the wrong shape for
 * the thing it controls.
 *
 * ============================ IT IS THREE ANSWERS, NOT A SWITCH ==========
 *
 * `system` means "not chosen" and resolves to on — see `feedback.ts` for why
 * that is a decision rather than a default nobody made. `on` and `off` are
 * choices. A switch could hold only two and the one it would drop is the one
 * almost everybody has.
 *
 * ============================ AND IT NEVER BREAKS A COMMAND ==============
 *
 * Storage can be unavailable — private mode, a locked-down browser — and that
 * cannot be allowed to matter. The choice still applies for the session, which
 * is the same failure this application already accepts for the theme.
 */

const STORAGE_KEY = 'vnext-haptics'

type HapticsContextValue = {
  readonly preference: FeedbackPreference
  readonly setPreference: (preference: FeedbackPreference) => void
}

const HapticsContext = createContext<HapticsContextValue | null>(null)

function readStored(): FeedbackPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'on' || stored === 'off' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function HapticsProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<FeedbackPreference>(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      /* storage unavailable — the choice still applies for this session */
    }
  }, [preference])

  return (
    <HapticsContext.Provider value={{ preference, setPreference }}>
      {children}
    </HapticsContext.Provider>
  )
}

/**
 * FAILS TO `system` OUTSIDE A PROVIDER RATHER THAN THROWING.
 *
 * A missing provider must not be able to take a page down, and the honest
 * fallback is what a player who has never chosen already has. `useTheme` throws
 * because a theme is load-bearing for what is on the screen; a haptic is not
 * load-bearing for anything, which is the whole design.
 */
export function useHapticsPreference(): HapticsContextValue {
  return useContext(HapticsContext) ?? { preference: 'system', setPreference: () => {} }
}
