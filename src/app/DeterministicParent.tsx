import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../design-system'

export function DeterministicParent({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <>
      <div style={{ padding: 'var(--sp-3) var(--sp-4) 0' }}>
        <Button variant="secondary" onClick={() => navigate(href)}>
          {label}
        </Button>
      </div>
      {children}
    </>
  )
}
