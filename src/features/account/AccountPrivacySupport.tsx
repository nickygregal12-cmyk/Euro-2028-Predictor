import { Alert } from '../../design-system'
import { useSite } from '../../app/site/SiteProvider'
import { buildAdminSupportHref } from './accountSupport'
import s from '../shared.module.css'
import a from './account.module.css'

export type AccountPrivacySupportProps = {
  supportEmail?: string | null | undefined
  accountEmail?: string | null
}

export function AccountPrivacySupport({
  supportEmail,
  accountEmail,
}: AccountPrivacySupportProps) {
  const site = useSite()
  const supportHref = buildAdminSupportHref(
    supportEmail,
    accountEmail,
    site.brand.productName,
  )

  return (
    <section className={s.card} aria-labelledby="account-privacy-title">
      <span className={s.eyebrow}>Privacy and support</span>
      <h2 className={a.sectionTitle} id="account-privacy-title">
        What other players can see
      </h2>
      <ul className={a.privacyList}>
        <li>Before entries lock, only you can see your predictions.</li>
        <li>
          After lock, signed-in players can inspect frozen entries, profiles and points
          breakdowns so leaderboard scoring is transparent.
        </li>
        <li>Your email address and private account settings are never shown on profiles.</li>
      </ul>

      {supportHref ? (
        <a className={a.supportLink} href={supportHref}>
          Contact admin
        </a>
      ) : (
        <Alert variant="info" title="Administrator contact unavailable">
          A support address has not been configured for this deployment yet.
        </Alert>
      )}
    </section>
  )
}
