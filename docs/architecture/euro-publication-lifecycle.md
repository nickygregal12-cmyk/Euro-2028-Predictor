# Euro 2028 publication lifecycle

**Status:** Contract 143 hosted in Development; EURO-004 player-route guard candidate  
**Authority:** ADR 0026 `EURO-001`–`EURO-004`

## Contract 143 boundary

Contract 143 establishes the server-owned state required by ADR 0026 before Euro 2028 visibility may be decided by weekly-platform surfaces.

The persisted lifecycle is ordered:

`hidden -> prelaunch -> registration-open -> live -> completed -> archived`

The contract provides:

- one private singleton publication-state authority in `predictor_internal`;
- append-only transition history with actor, reason and timestamp;
- `public.euro_publication_state()` as the bounded state/time read for site and route guards;
- `public.admin_transition_euro_publication_state(text,text,text)` as the authenticated entry point, with a stricter signed-in `super_admin` owner check inside;
- adjacent forward transitions only, optimistic expected-state checking and a mandatory reason;
- default state `hidden`, so absence of an owner publication action fails closed.

Direct table access remains revoked from `anon`, `authenticated` and `service_role`. The public read exposes only publication state and change time. Mutation is not granted to `anon` or `service_role`. The service role is explicitly allowed to execute the bounded read because server-side site/route guards need the same publication truth without receiving any mutation authority.

## Hosted position

The guarded Development Fast Lane has applied Contract 143 as part of the repository-to-144 rollout. Development is verified at Contract 144 and the Euro publication singleton remains `hidden` with no transition history. Production remains Contract 132, so Contract 143 is not hosted there and no Euro publication action has occurred.

Hosted contract truth remains owned by `config/development-hosted-contract.json`, `config/production-hosted-contract.json` and `docs/quality/current-status.md`; this design record does not replace those moving authorities.

## EURO-004 consumption boundary

The player-facing Euro-only route boundary in `src/app/TournamentJourney.tsx` consumes `public.euro_publication_state()` before either tournament provider mounts. While the state is `hidden`, or if publication truth cannot be read safely, a guessable Euro player route is refused and returns to the weekly Hub. Once an owner advances the state beyond `hidden`, the route may mount normally.

The existing authorised `/admin/results` preparation path is deliberately exempt from that player-facing guard. A hidden tournament still needs an administrator to prepare and verify its results workspace before publication; that path remains independently protected by `RequireAdmin` and gains no publication authority from the exemption.

This is deliberately a consumer of Contract 143, not a second state machine. No catalogue constant, environment flag or client preference decides whether Euro is published.

## Remaining non-scope

This boundary does not create the future Euro-specific Netlify site, change Auth redirects, implement the 18+ gate, alter tournament scoring, enrol users, call providers or perform a hosted Supabase migration.

`EURO-003` still owns absence across every non-route public surface, and `SITE-002`–`SITE-007` still own the future two-site release architecture. Production remains unable to run this guard until its separately controlled database promotion includes Contract 143 and a later application release is authorised.

## Acceptance evidence

`supabase/tests/188_euro_publication_state.sql` covers default-hidden behaviour, RLS/grants, owner authorisation, invalid/skipped/stale transitions, the complete forward lifecycle and immutable history. `supabase/tests/080_function_privileges.sql` keeps both RPC signatures inside the explicit role allowlists, including the bounded service-role read while excluding the owner-only transition RPC.

`tests/app/TournamentJourney.test.tsx` proves the application consumer refuses a hidden player route, fails closed when the state read fails, permits a player route after publication advances and keeps the separately authorised admin-preparation route usable while hidden.
