import { createContext, useContext } from 'react'
import type { AdminAccessSnapshot } from '../../services/supabase/adminAccess'

const AdminAccessContext = createContext<AdminAccessSnapshot | null>(null)

export const AdminAccessProvider = AdminAccessContext.Provider

export function useAdminAccess(): AdminAccessSnapshot {
  const value = useContext(AdminAccessContext)
  if (value === null) {
    throw new Error('Admin access context is available only inside RequireAdmin')
  }
  return value
}
