# Production public landing flag enabled — 10 August 2026

This is a dated deployment/configuration record, not a product or architecture authority.

- Netlify project: `euro28predictor`
- Context: `production`
- Build-time flag: `VITE_UI_PUBLIC_LANDING=true`
- Effect on the application bundle: a signed-out request to `/` serves the public landing page rather than the legacy redirect to `/auth/login`.
- Netlify site-password protection remains enabled across all deploy contexts; this change does not make the site publicly accessible without that perimeter.
- No Supabase, scoring, settlement, reveal, provider, credential, or database-contract setting changed.

The environment-variable change requires a new Vite production build because `VITE_*` values are compiled at build time. This record was committed to `main` to trigger the normal Git-connected Netlify production build from repository source.
