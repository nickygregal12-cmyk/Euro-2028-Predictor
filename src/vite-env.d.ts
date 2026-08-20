/// <reference types="vite/client" />

// Typed access to the Supabase env vars (set in .env.local, never committed).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // Dev auto-login shim (dev builds only; see docs/auth-plan.md §1).
  readonly VITE_DEV_AUTOLOGIN?: string
  readonly VITE_DEV_USER_EMAIL?: string
  readonly VITE_DEV_USER_PASSWORD?: string
  // Optional privacy-restricted Sentry React SDK configuration.
  readonly VITE_SENTRY_ENABLED?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_VERIFICATION_EVENT?: string
  // Optional public address used to build the Account → Contact admin mail link.
  readonly VITE_SUPPORT_EMAIL?: string
  // Cloudflare Turnstile on the auth forms; both are PUBLIC values and both are
  // optional, so auth renders unchanged when they are unset.
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_TURNSTILE_DEV_TOKEN?: string
  // Route-level UI migration flag (src/app/routeFlags.ts). Fails closed: only
  // the exact string "true" selects the next-generation journey, so an unset or
  // misspelled value leaves the legacy route serving players.
  readonly VITE_UI_SEASON_MATCH_PREDICTOR?: string
  // Serves the public landing page at `/` to signed-out visitors instead of
  // redirecting them to `/auth/login`.
  readonly VITE_UI_PUBLIC_LANDING?: string
  // The official club badge kill switch (src/app/clubBadgePolicy.ts). Only the
  // exact string "true" turns badges on; ADR 0017 ships the product badge-free
  // and every configured provider disclaims the rights to the images it serves,
  // so the default is off and turning it on needs a recorded rights decision
  // and a CSP that admits the provider host.
  readonly VITE_UI_OFFICIAL_BADGES?: string
  // Comma-separated approved badge providers: "football-data", "sportmonks",
  // "api-sports". Unrecognised entries are ignored rather than throwing, and an
  // empty list approves nobody.
  readonly VITE_UI_OFFICIAL_BADGE_SOURCES?: string
  // Comma-separated season ids allowed to show badges. Unset means every
  // competition once the two switches above allow it; a list is narrower,
  // because a licence obtained for one competition is a licence for that one.
  readonly VITE_UI_OFFICIAL_BADGE_COMPETITIONS?: string


  /** Stage 14 Football Hub cutover: vNext Matches and Match Centre. */
  readonly VITE_UI_FOOTBALL_HUB_MATCHES?: string
  /** Stage 14: vNext Home at `/` and `/competitions/:c/:s`. */
  readonly VITE_UI_FOOTBALL_HUB_HOME?: string
  /** Stage 14: the vNext Games catalogue. */
  readonly VITE_UI_FOOTBALL_HUB_GAMES?: string
  /** Stage 14: vNext Leagues, season table and private tables. */
  readonly VITE_UI_FOOTBALL_HUB_LEAGUES?: string
  /** Stage 14: the vNext player profile, addressed by the season reference. */
  readonly VITE_UI_FOOTBALL_HUB_PLAYER_PROFILE?: string
  /** Stage 14: vNext Discovery at `/competitions`. */
  readonly VITE_UI_FOOTBALL_HUB_DISCOVERY?: string
  /** Stage 14: the vNext Account surface at `/account`. */
  readonly VITE_UI_FOOTBALL_HUB_ACCOUNT?: string
  /** Stage 14: vNext Last Man Standing. */
  readonly VITE_UI_FOOTBALL_HUB_LMS?: string
  /** Stage 14: the vNext Predictor Championship. */
  readonly VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP?: string
  // ADR 0026's two deployments (src/app/site/). "hub" | "euro"; anything else,
  // including unset, resolves to "hub" — Euro 2028 must never appear because a
  // variable was mistyped (`EURO-001`).
  readonly VITE_SITE_VARIANT?: string
  // This deployment's own absolute origin. Drives the canonical URL, Open Graph
  // URLs, the generated sitemap and robots.txt. Unset emits none of them rather
  // than falling back to the other site's domain.
  readonly VITE_PUBLIC_SITE_ORIGIN?: string
  // The other deployment's absolute origin, so each site can link to its
  // sibling. Unset omits the link.
  readonly VITE_SIBLING_SITE_ORIGIN?: string
  // Optional public PostHog project configuration; blank keeps analytics off.
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __EURO28_RELEASE__: {
  readonly environment: string
  readonly commit: string
  readonly deployId: string
  readonly applicationContract: number
  readonly hostedContract: number | null
  readonly supabaseProjectRef: string | null
}
