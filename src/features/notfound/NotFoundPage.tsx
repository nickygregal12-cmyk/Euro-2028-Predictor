import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system'
import styles from './NotFound.module.css'

/**
 * Recovery view for unknown routes (replaces the old silent redirect-to-home).
 * Standalone — renders whether or not a session exists — with the app voice and
 * a clear way back. "Back to home" routes to `/`; the route gates take a
 * signed-out visitor on to log in from there, so it's never a dead end.
 */
export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>404</p>
        <h1 className={styles.title}>This page has gone walkabout</h1>
        <p className={styles.body}>
          That link doesn&rsquo;t lead anywhere in the predictor — it may be old, mistyped, or
          something we&rsquo;ve moved. No harm done; your predictions are safe.
        </p>
        <div className={styles.action}>
          <Button variant="primary" fullWidth onClick={() => navigate('/')}>
            Back to home
          </Button>
        </div>
      </div>
    </div>
  )
}
