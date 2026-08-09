# Euro 2028 publication lifecycle

**Status:** Contract 134 candidate — repository only, not hosted  
**Authority:** ADR 0026 `EURO-001`–`EURO-004`

## Contract 134 boundary

Contract 134 establishes the server-owned state required by ADR 0026 before Euro 2028 visibility may be decided by weekly-platform surfaces.

The persisted lifecycle is ordered:

`hidden -> prelaunch -> registration-open -> live -> completed -> archived`

The contract provides:

- one private singleton publication-state authority in `predictor_internal`;
- append-only transition history with actor, reason and timestamp;
- `public.euro_publication_state()` as the bounded state/time read for future site and route guards;
- `public.admin_transition_euro_publication_state(text,text,text)` as the authenticated entry point, with a stricter signed-in `super_admin` owner check inside;
- adjacent forward transitions only, optimistic expected-state checking and a mandatory reason;
- default state `hidden`, so absence of an owner publication action fails closed.

Direct table access remains revoked from `anon`, `authenticated` and `service_role`. The public read exposes only publication state and change time. Mutation is not granted to `anon` or `service_role`. The service role is explicitly allowed to execute the bounded read because future server-side site/route guards need the same publication truth without receiving any mutation authority.

## Deliberate non-scope

Contract 134 does **not** change Hub catalogue entries, navigation, routes, metadata, sitemap or Open Graph output. Those are EURO-003/EURO-004 enforcement consumers and must follow this state rather than create another visibility authority.

It also does not create the future Euro-specific Netlify site, change Auth redirects, implement the 18+ gate, alter tournament scoring, enrol users, call providers or perform a hosted Supabase migration.

## Acceptance evidence

`supabase/tests/186_euro_publication_state.sql` covers default-hidden behaviour, RLS/grants, owner authorisation, invalid/skipped/stale transitions, the complete forward lifecycle and immutable history. `supabase/tests/080_function_privileges.sql` keeps both RPC signatures inside the explicit role allowlists, including the bounded service-role read while excluding the owner-only transition RPC.

Hosted rollout remains separately gated and is not claimed by this document.
