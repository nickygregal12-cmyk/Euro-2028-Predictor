import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { AuthSplash } from '../auth/AuthSplash'
import { hasTournamentAdminAccess } from '../../services/supabase/adminAccess'

export function RequireAdmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    hasTournamentAdminAccess('results')
      .then((value) => {
        if (active) setAllowed(value)
      })
      .catch(() => {
        if (active) setAllowed(false)
      })

    return () => {
      active = false
    }
  }, [])

  if (allowed === null) return <AuthSplash />
  if (!allowed) return <Navigate to="/" replace />
  return <Outlet />
}
