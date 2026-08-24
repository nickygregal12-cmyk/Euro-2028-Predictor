// Live-updates configuration. NO IMPORTS ON PURPOSE.
//
// The flag has to be readable without dragging in the Supabase client, for the
// same reason `googleAuthConfig.ts` stands alone: a capability flag is consulted
// by tests and by code paths that must not construct a client just to discover
// the feature is switched off.

/**
 * Hosted capability flag, fail-closed. ADR 0008 keeps live updates "guarded
 * until hosted operational evidence exists", so anything other than the exact
 * string opens no channel and the product behaves exactly as it does today.
 *
 * Fail-closed matters more here than for a cosmetic flag: switching this on
 * against a database without contract 218 gives a socket subscribed to a table
 * that is not published, which fails silently rather than loudly.
 */
export const liveUpdatesEnabled = import.meta.env.VITE_LIVE_UPDATES_ENABLED === 'true'

/**
 * A confirmed result rewrites several rows, and a correction rewrites them
 * again moments later. Advancing the version on a trailing edge turns a burst
 * into one refetch instead of one per row.
 */
export const COALESCE_MS = 400
