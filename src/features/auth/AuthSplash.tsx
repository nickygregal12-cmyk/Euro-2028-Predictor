import { AuthScreen } from './AuthScreen'

// Shown while the session is still resolving on first load, so the app never
// flashes the logged-out auth screens before restoring an existing session
// (docs/auth-plan.md §3). Just the brand chrome — no form, no spinner jump.
export function AuthSplash() {
  return <AuthScreen>{null}</AuthScreen>
}
