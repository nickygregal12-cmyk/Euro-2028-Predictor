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
