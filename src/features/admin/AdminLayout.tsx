import { NavLink, Outlet } from 'react-router'
import { useSite } from '../../app/site/SiteProvider'
import a from './admin.module.css'

export function AdminLayout() {
  const site = useSite()
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
        <NavLink
          to="/admin/season"
          className={({ isActive }) =>
            isActive ? a.adminNavActive : a.adminNavLink
          }
        >
          Competitions
        </NavLink>
        {site.servesDomesticCompetitions ? (
          <NavLink
            to="/admin/ai"
            className={({ isActive }) =>
              isActive ? a.adminNavActive : a.adminNavLink
            }
          >
            AI Lab
          </NavLink>
        ) : null}
        <NavLink
          to="/admin/euro"
          className={({ isActive }) =>
            isActive ? a.adminNavActive : a.adminNavLink
          }
        >
          Euro publication
        </NavLink>
        <NavLink
          to="/admin/users"
          className={({ isActive }) =>
            isActive ? a.adminNavActive : a.adminNavLink
          }
        >
          Users
        </NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
