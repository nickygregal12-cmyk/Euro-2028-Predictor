/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_DEV_AUTOLOGIN?: string
  readonly VITE_DEV_USER_EMAIL?: string
  readonly VITE_DEV_USER_PASSWORD?: string
  readonly VITE_SENTRY_ENABLED?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_VERIFICATION_EVENT?: string
  readonly VITE_SUPPORT_EMAIL?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_TURNSTILE_DEV_TOKEN?: string
  /** Hosted capability flag. The CTA stays absent until Supabase Google + redirect config is proven. */
  readonly VITE_GOOGLE_AUTH_ENABLED?: string
  readonly VITE_UI_SEASON_MATCH_PREDICTOR?: string
  readonly VITE_UI_PUBLIC_LANDING?: string
  readonly VITE_UI_OFFICIAL_BADGES?: string
  readonly VITE_UI_OFFICIAL_BADGE_SOURCES?: string
  readonly VITE_UI_OFFICIAL_BADGE_COMPETITIONS?: string
  readonly VITE_UI_FOOTBALL_HUB_MATCHES?: string
  readonly VITE_UI_FOOTBALL_HUB_HOME?: string
  readonly VITE_UI_FOOTBALL_HUB_GAMES?: string
  /**
   * Hosted capability flag for ADR 0008 live updates. The realtime channel stays
   * closed until a deployment proves the publication and socket work there.
   */
  readonly VITE_LIVE_UPDATES_ENABLED?: string
  /** Public half of the deployment VAPID key pair. Empty means push is unavailable. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_UI_FOOTBALL_HUB_LEAGUES?: string
  readonly VITE_UI_FOOTBALL_HUB_PLAYER_PROFILE?: string
  readonly VITE_UI_FOOTBALL_HUB_DISCOVERY?: string
  readonly VITE_UI_FOOTBALL_HUB_ACCOUNT?: string
  readonly VITE_UI_FOOTBALL_HUB_LMS?: string
  readonly VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP?: string
  readonly VITE_UI_FOOTBALL_HUB_PREDICTOR?: string
  readonly VITE_UI_FOOTBALL_HUB_ONBOARDING?: string
  readonly VITE_UI_FOOTBALL_HUB_INVITE?: string
  readonly VITE_UI_FOOTBALL_HUB_CREATE?: string
  readonly VITE_UI_FOOTBALL_HUB_WRAPPED?: string
  readonly VITE_SITE_VARIANT?: string
  readonly VITE_PUBLIC_SITE_ORIGIN?: string
  readonly VITE_SIBLING_SITE_ORIGIN?: string
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
