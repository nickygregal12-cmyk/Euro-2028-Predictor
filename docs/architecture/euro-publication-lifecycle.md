# Euro 2028 publication lifecycle

**Status:** Contract 134 candidate — repository only, not hosted  
**Authority:** ADR 0026 `EURO-001`–`EURO-004`

## Contract 134 boundary

Contract 134 establishes the server-owned state required by ADR 0026 before any Euro 2028 route or catalogue is allowed to decide visibility.

The persisted lifecycle is ordered and intentionally cannot skip stages:

`hidden -> prelaunch -> registration-open -> live -> completed -> archived`

The migration creates:

- one private singleton row in `predictor_internal.euro_publication_control`;
- append-only transition history in `predictor_internal.euro_publication_transitions`;
- `predictor_internal.set_euro_publication_state(text,text,uuid)` as the owner-only transition authority;
- an initial `hidden` row plus matching bootstrap transition.

Direct table access and function execution are revoked from `anon`, `authenticated` and `service_role`. The browser therefore cannot publish Euro 2028 and cannot invent a second publication-state authority.

## Deliberate non-scope

Contract 134 does **not** expose a browser RPC and does **not** change Hub catalogue, routes, metadata, sitemap or Open Graph output. Those are EURO-003/EURO-004 enforcement consumers and must follow the server-owned state rather than precede it.

Contract 134 also does not create the second Netlify site, change Auth redirects, implement the 18+ gate, alter tournament scoring, enrol a user in Euro, or deploy anything to a hosted Supabase environment.

## Transition rule

A state change may advance only one stage at a time. `archived` is terminal. A repeated request for the current state is a no-op and does not create duplicate history. Every real transition requires a non-empty reason and appends a separate immutable record.

The actor is recorded as a UUID supplied by the future reviewed admin/server boundary. Contract 134 does not grant `service_role` the ability to call the transition function directly; that grant decision remains explicit rather than inherited from deployment convenience.

## Acceptance evidence

`supabase/tests/190_euro_publication_lifecycle.sql` proves:

- default state is `hidden`;
- bootstrap history exists exactly once;
- browser and service roles cannot read either internal table;
- browser and service roles cannot execute the transition authority;
- lifecycle stages cannot be skipped;
- one legal transition updates the singleton and appends one history row;
- transition history cannot be rewritten.

Hosted rollout is separately gated and is not claimed by this document.
