import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { VNextAppRoot } from '../../app/vnext/VNextAppRoot'
import { VNextPublicDocumentScreen } from '../../vnext/integration/publicDocument/VNextPublicDocumentScreen'
import { privacyModel, termsModel } from '../../vnext/fixtures/legal/content'
import type { ShellIntent } from '../../vnext/models/shell'
import { useAuth } from '../auth/AuthProvider'

type DocumentKind = 'privacy' | 'terms'

function LegalPage({ kind }: { readonly kind: DocumentKind }) {
  const navigate = useNavigate()
  const { userId, displayName } = useAuth()
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || null
  const model = useMemo(
    () => (kind === 'privacy' ? privacyModel({ supportEmail }) : termsModel({ supportEmail })),
    [kind, supportEmail],
  )

  const onShellIntent = useCallback(
    (intent: ShellIntent) => {
      if (intent.kind === 'about') {
        void navigate('/about')
        return
      }
      if (!userId) {
        void navigate('/auth/login')
        return
      }
      if (intent.kind === 'account') {
        void navigate('/account')
        return
      }
      if (intent.kind === 'discover') {
        void navigate('/competitions')
        return
      }
      void navigate('/')
    },
    [navigate, userId],
  )

  return (
    <VNextAppRoot>
      <VNextPublicDocumentScreen
        model={model}
        playerName={displayName}
        onShellIntent={onShellIntent}
      />
    </VNextAppRoot>
  )
}

/** Public privacy notice — identical policy content signed in and signed out. */
export function PrivacyPage() {
  return <LegalPage kind="privacy" />
}

/** Public current-service terms — identical policy content signed in and signed out. */
export function TermsPage() {
  return <LegalPage kind="terms" />
}
