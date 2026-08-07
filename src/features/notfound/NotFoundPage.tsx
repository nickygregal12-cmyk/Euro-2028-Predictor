import { useLocation, useNavigate } from 'react-router'
import { logicalWeeklyParent, weeklyRoutes } from '../../app/weeklyRoutes'
import { Button } from '../../design-system'
import styles from './NotFound.module.css'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const parent = logicalWeeklyParent(pathname)

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>404</p>
        <h1 className={styles.title}>This page has gone walkabout</h1>
        <p className={styles.body}>
          That link doesn&rsquo;t lead anywhere in the weekly predictor. It may be old, mistyped,
          or something we&rsquo;ve moved. Your predictions are unaffected.
        </p>
        <div className={styles.action}>
          {parent && parent.href !== weeklyRoutes.hub ? (
            <Button variant="secondary" fullWidth onClick={() => navigate(parent.href)}>
              {parent.label}
            </Button>
          ) : null}
          <Button variant="primary" fullWidth onClick={() => navigate(weeklyRoutes.hub)}>
            Back to Hub
          </Button>
        </div>
      </div>
    </div>
  )
}
