import { createContext, useContext } from 'react'

// The context and its reader, deliberately split from the provider that fills
// it. A surface that wants to be live imports ONLY this file, so depending on
// live updates does not drag the Supabase client into its import graph -- and a
// test of that surface does not have to mock a realtime channel it never uses.
//
// The provider in `LiveResultsProvider.tsx` is the only thing that imports both
// this and the transport.

export const LiveResultsContext = createContext<number>(0)

/**
 * The number that advances when the server says results moved. It never
 * decreases, so it is safe to use directly as an effect dependency.
 *
 * Returns 0 outside a provider rather than throwing, and 0 when live updates
 * are switched off. A surface rendered in isolation -- a preview, a focused
 * test -- keeps its ordinary fetch-on-mount behaviour instead of failing
 * because a reliability feature is absent.
 */
export function useLiveResultsVersion(): number {
  return useContext(LiveResultsContext)
}
