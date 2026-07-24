import { useEffect, useId, useRef, useState } from 'react'
import { MoreIcon } from '../../design-system/icons'
import d from './detail.module.css'

export type LeagueOptionsDisclosureProps = {
  isOwner: boolean
  onTransferOwnership: () => void
  onDeleteLeague: () => void
  onLeaveLeague: () => void
}

/**
 * A small action disclosure, not an ARIA menu. The revealed controls remain
 * ordinary buttons with their native keyboard behavior.
 */
export function LeagueOptionsDisclosure({
  isOwner,
  onTransferOwnership,
  onDeleteLeague,
  onLeaveLeague,
}: LeagueOptionsDisclosureProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function closeAndRestoreFocus() {
      setOpen(false)
      triggerRef.current?.focus()
    }

    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeAndRestoreFocus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function runAction(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div className={d.overflowWrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={d.overflowBtn}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="League options"
        onClick={() => setOpen((current) => !current)}
      >
        <MoreIcon size={20} />
      </button>

      {open ? (
        <div id={panelId} className={d.menu} aria-label="League actions">
          {isOwner ? (
            <>
              <button
                type="button"
                className={d.menuItem}
                onClick={() => runAction(onTransferOwnership)}
              >
                Transfer ownership
              </button>
              <button
                type="button"
                className={`${d.menuItem} ${d.menuItemDanger}`}
                onClick={() => runAction(onDeleteLeague)}
              >
                Delete league
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`${d.menuItem} ${d.menuItemDanger}`}
              onClick={() => runAction(onLeaveLeague)}
            >
              Leave league
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
