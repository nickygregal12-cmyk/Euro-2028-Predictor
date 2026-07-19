/// <reference types="vite/client" />

// Typed access to the Supabase env vars (set in .env.local, never committed).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // Dev auto-login shim (dev builds only; see docs/auth-plan.md §1).
  readonly VITE_DEV_AUTOLOGIN?: string
  readonly VITE_DEV_USER_EMAIL?: string
  readonly VITE_DEV_USER_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
