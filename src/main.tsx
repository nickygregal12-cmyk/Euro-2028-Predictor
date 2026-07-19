import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'flag-icons/css/flag-icons.min.css'
import './styles/tokens.css'
import './index.css'
import App from './App.tsx'
import { initDevAuth } from './services/supabase/devAutoLogin'

// Dev auto-login runs before the first render (docs/auth-plan.md §1). In a
// production build this is a no-op — UNLESS the autologin flag is still set, in
// which case initDevAuth throws and we deliberately refuse to render the app
// (fail-closed). In dev it silently signs in as the seeded dev user.
initDevAuth()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((err) => {
    console.error(err)
    const root = document.getElementById('root')
    if (root) {
      root.textContent =
        'Application failed to start due to an invalid configuration.'
    }
  })
