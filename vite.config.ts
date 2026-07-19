/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Build-time fail-closed check (docs/auth-plan.md §1): a production build must
  // never carry the dev auto-login flag. This refuses the build outright and
  // complements the runtime guard in src/services/supabase/autoLoginPolicy.ts.
  if (command === 'build' && env.VITE_DEV_AUTOLOGIN === 'true') {
    throw new Error(
      'Refusing to build: VITE_DEV_AUTOLOGIN=true. The dev auto-login shim ' +
        'must never ship in a production build (see docs/auth-plan.md).',
    )
  }

  return {
    plugins: [react()],
    // Honour a PORT assigned by the environment (e.g. the preview harness) so
    // the dev server binds where callers expect it; falls back to Vite's default
    // for a plain `npm run dev`.
    server: process.env.PORT
      ? { port: Number(process.env.PORT), strictPort: true }
      : undefined,
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
    },
  }
})
