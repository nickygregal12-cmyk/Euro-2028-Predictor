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
  // Optional public support address shown only as a mailto link on Account.
  readonly VITE_SUPPORT_EMAIL?: string
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
