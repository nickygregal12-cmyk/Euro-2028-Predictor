import { NavLink, Outlet } from 'react-router'
import a from './admin.module.css'

export function AdminLayout() {
  return (
    <div className={a.controlRoom}>
      <nav className={a.adminNav} aria-label="Admin control room">
        <NavLink
          to="/admin/results"
          className={({ isActive }) =>
            isActive ? a.adminNavActive : a.adminNavLink
          }
        >
          Results
        </NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
