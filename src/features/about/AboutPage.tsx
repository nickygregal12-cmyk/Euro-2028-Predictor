import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { VNextAppRoot } from '../../app/vnext/VNextAppRoot'
import { VNextAboutScreen } from '../../vnext/integration/about/VNextAboutScreen'
import { useAuth } from '../auth/AuthProvider'
import type { ShellIntent } from '../../vnext/models/shell'

/**
 * `/about` — the product route for About & Disclaimer.
 *
 * ============================ WHY THIS ONE IS A REAL ROUTE ==============
 *
 * Every other vNext surface is behind `/dev/vnext-*` and is reachable only from
 * a harness, because Stage 14 owns the route migration and has not performed
 * it. **This one is different and the difference is the point.**
 *
 * ADR 0017 asks for *"an unambiguous non-affiliation statement in the footer
 * and terms"* and the product has published neither. That obligation is not
 * waiting on a cutover — it is owed by the product as it stands today, signed
 * in and signed out — so the page is routed now rather than at the same moment
 * the whole application changes shape.
 *
 * IT REPOINTS NOTHING. `/about` did not exist before this; no legacy journey
 * loses an address, no redirect is added and no existing route changes what it
 * serves. It is an addition, which is the one route change a pre-cutover stage
 * can make without touching the migration matrix's own decisions.
 *
 * ============================ IT IS PUBLIC ==============================
 *
 * Outside `RequireAuth`, because a visitor deciding whether to sign up is
 * exactly the reader a non-affiliation statement is for, and because the public
 * landing page's footer links straight here. `useAuth` is read only for the
 * name the chrome shows; nothing on the page is about a player and nothing on
 * it changes when there is not one.
 *
 * ============================ THE SHELL'S INTENTS GO SOMEWHERE ==========
 *
 * A shell whose controls do nothing is a shell of inert controls, which this
 * lane forbids — so every intent is answered with a real navigation. A
 * signed-out visitor is sent to sign in rather than to a destination they
 * cannot see, which is the honest answer to "take me to Matches" from a page
 * that has no competition.
 */
export function AboutPage() {
  const navigate = useNavigate()
  const { userId, displayName } = useAuth()

  const onShellIntent = useCallback(
    (intent: ShellIntent) => {
      if (intent.kind === 'about') return
      if (!userId) {
        void navigate('/auth/login')
        return
      }
      // The signed-in chrome's own destinations. `/account` and `/competitions`
      // are the two this page can answer precisely; anything competition-scoped
      // needs a competition, and the Hub is where one is chosen.
      if (intent.kind === 'account') {
        void navigate('/account')
        return
      }
      if (intent.kind === 'discover') {
        void navigate('/competitions')
        return
      }
      void navigate('/')
    },
    [navigate, userId],
  )

  return (
    <VNextAppRoot>
      <VNextAboutScreen playerName={displayName} onShellIntent={onShellIntent} />
    </VNextAppRoot>
  )
}
