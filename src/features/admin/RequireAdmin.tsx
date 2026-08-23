import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { AuthSplash } from '../auth/AuthSplash'
import {
  fetchAdminAccessSnapshot,
  snapshotAllowsCapability,
  snapshotHasAnyAdminAccess,
  type AdminAccessSnapshot,
} from '../../services/supabase/adminAccess'
import type { AdminCapability } from '../../services/supabase/adminCapabilities'
import { AdminAccessProvider } from './AdminAccessContext'
import { AdminLayout } from './AdminLayout'

type RequireAdminProps = {
  readonly capability?: AdminCapability
  readonly anyCapability?: boolean
}

export function RequireAdmin({ capability, anyCapability = false }: RequireAdminProps = {}) {
  const [access, setAccess] = useState<AdminAccessSnapshot | null | undefined>(undefined)
  const location = useLocation()

  useEffect(() => {
    let active = true
    fetchAdminAccessSnapshot()
      .then((value) => {
        if (active) setAccess(value)
      })
      .catch(() => {
        if (active) setAccess(null)
      })
    return () => { active = false }
  }, [])

  if (access === undefined) return <AuthSplash />
  if (access === null) return <Navigate to="/" replace />

  const allowed = capability !== undefined && !anyCapability
    ? snapshotAllowsCapability(access, capability)
    : snapshotHasAnyAdminAccess(access)

  if (!allowed) return <Navigate to="/" replace />

  const rootControlRoom = capability === undefined
    && (location.pathname === '/admin' || location.pathname === '/admin/')
  const workspace = new URLSearchParams(location.search).get('workspace')

  return (
    <AdminAccessProvider value={access}>
      {rootControlRoom ? (
        // The historical child route still redirects bare `/admin` to Results.
        // The trusted gate owns the Control Room root instead: no workspace is
        // Overview, while a named workspace is resolved by AdminLayout. This
        // keeps Users/Leagues/Audit independent of the Results capability.
        <AdminLayout forceOverview={workspace === null} />
      ) : (
        <Outlet />
      )}
    </AdminAccessProvider>
  )
}
