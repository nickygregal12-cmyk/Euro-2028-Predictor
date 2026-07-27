import { supabase } from './client'
import { mapPublicCapacityRow, type PublicCapacity } from './publicCapacityModel'

/**
 * Reads aggregate-only operating capacity. The RPC is intentionally available
 * before authentication so the signup page can show a truthful full state, but
 * the database triggers remain the authority if this preflight races or fails.
 */
export async function fetchPublicCapacity(): Promise<PublicCapacity> {
  const { data, error } = await supabase.rpc('get_public_capacity')
  if (error) throw error

  const row = (data ?? [])[0]
  if (!row) throw new Error('Public capacity returned no row.')
  return mapPublicCapacityRow(row)
}
