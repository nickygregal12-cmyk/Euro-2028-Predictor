import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { fetchAdminAccessSnapshot, snapshotHasAnyAdminAccess } from '../../services/supabase/adminAccess'
import styles from './AdminUtilityEntry.module.css'

/**
 * PRIVILEGED DISCOVERY ONLY. This is not an authorization gate.
 *
 * The button is absent until Auth re-resolves trusted app_metadata and confirms
 * at least one administrative capability. A normal player, a failed read and a
 * stale/unknown session all render exactly nothing. Pressing the button still
 * enters `/admin`, whose RequireAdmin boundary re-checks access before any
 * workspace or RPC can be reached.
 *
 * Desktop: a quiet utility beside the rail/account zone, never a fifth primary
 * destination. Compact widths: only the Account route gets the entry, so the
 * four-slot competition navigation stays untouched.
 */
export function AdminUtilityEntry() {
  const [visible, setVisible] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    fetchAdminAccessSnapshot()
      .then((access) => {
        if (active) setVisible(access !== null && snapshotHasAnyAdminAccess(access))
      })
      .catch(() => {
        if (active) setVisible(false)
      })
    return () => { active = false }
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      className={styles.entry}
      data-account-route={location.pathname === '/account' ? 'true' : 'false'}
      onClick={() => navigate('/admin')}
    >
      <ShieldCheck size={16} aria-hidden="true" />
      <span>Control Room</span>
    </button>
  )
}
