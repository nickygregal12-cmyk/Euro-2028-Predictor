import type { ReactNode } from 'react'
import { useSite } from '../../app/site/SiteProvider'
import { siteBrandCopy } from '../../app/site/sitePublicMetadata'
import s from './auth.module.css'

/**
 * The shared frame for the log in / sign up / reset screens: the product's name
 * above a single centred card. Presentational only — no session logic
 * (docs/auth-plan.md §3).
 *
 * THE NAME AND TAGLINE ARE THE DEPLOYMENT'S, NOT A CONSTANT. Both were
 * hard-coded to the weekly platform, so every auth screen on the Euro
 * deployment introduced itself as "Football Prediction Hub. Predict every match.
 * Beat your friends." — the other product's name and the other product's
 * promise, on the first screen a visitor to the tournament's own domain ever
 * sees, and the screen where they decide whether to create an account. It is the
 * same defect as the browser tab that PR #702 fixed, in a more visible place.
 *
 * The tagline comes from `sitePublicMetadata` rather than from the runtime
 * configuration for the reason that file records: nothing reads the descriptive
 * copy before a route renders, and carrying it in the configuration puts it in
 * the entry chunk every visitor downloads. These screens are lazily routed, so
 * they pay for it only when one of them is on screen.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
  const site = useSite()
  const brand = siteBrandCopy(site.variant)

  return (
    <div className={s.screen}>
      <div className={s.inner}>
        <div className={s.brand}>
          <h1 className={s.title}>{site.brand.productName}</h1>
          <p className={s.tagline}>{brand.tagline}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
