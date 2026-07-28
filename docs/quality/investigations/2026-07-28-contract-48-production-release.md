# Contract 48 production release

**Date:** 28 July 2026  
**Approved source:** PR #145, merged as `1da5fb0d3011d02184b14391b6d240fefe4882e6`

## Release boundary

This release aligns the production application and production Supabase project from contract 44 to contract 48 only.

Included canonical migrations:

1. `20260727214500_paginated_private_league_standings.sql`
2. `20260727221000_private_league_summary_activity.sql`
3. `20260728113000_other_player_profiles.sql`
4. `20260728122500_h2h_rank_history.sql`

The unrelated development-only `bonus_games_platform` and `bonus_games_hub` migration history is explicitly excluded and remains quarantined for the next-stage reconciliation.

## Pre-publication evidence

- PR #145 exact-head CI passed build, lint, all isolated Vitest files and the production dependency audit.
- A clean 48-migration Database parity run passed database lint, pgTAP and TypeScript/PostgreSQL parity.
- Authenticated desktop and phone Browser E2E passed, including signup and password-recovery journeys.
- Production Supabase records the four new migrations with their canonical repository versions.
- Production security-definer functions use empty search paths and exact execution allowlists.
- Anonymous and authenticated direct table access to `rank_history` is revoked.
- Production baseline data remains unchanged at one Auth user, one profile, one entry, one league, one membership and zero score events.
- Netlify production points to production Supabase and declares contract 48.

## Publication

Merging this release record triggers the normal Git-based production deployment. The release is not complete until the resulting Netlify production deploy is ready, reports the exact main commit and passes production HTTP/browser smoke.
