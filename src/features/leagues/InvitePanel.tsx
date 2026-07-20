import { useState } from 'react'
import { Button } from '../../design-system'
import { CopyIcon, ShareIcon, CheckIcon } from '../../design-system/icons'
import { copyText, inviteUrl, shareInvite } from './share'
import s from './InvitePanel.module.css'

export type InvitePanelProps = {
  leagueName: string
  code: string
  // 'full' — the post-create share moment: invite link + code, Share + Copy.
  // 'chip' — the detail header: a compact tap-to-copy code chip + share icon.
  mode?: 'full' | 'chip'
}

/**
 * The invite affordance: share link + code with a native share sheet where
 * available and tap-to-copy everywhere (design-system §6). Copying gives inline
 * "Copied" feedback that resets after a moment.
 */
export function InvitePanel({ leagueName, code, mode = 'full' }: InvitePanelProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const url = inviteUrl(code)

  async function copy(what: 'code' | 'link') {
    const ok = await copyText(what === 'code' ? code : url)
    if (ok) {
      setCopied(what)
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1800)
    }
  }

  async function share() {
    const result = await shareInvite(leagueName, code)
    if (result === 'unsupported') void copy('link')
  }

  if (mode === 'chip') {
    return (
      <div className={s.chipRow}>
        <button
          type="button"
          className={s.codeChip}
          onClick={() => copy('code')}
          aria-label={`Copy invite code ${code}`}
        >
          <span className={s.codeLabel}>Invite code</span>
          <span className={s.code}>{code}</span>
          {copied === 'code' ? (
            <CheckIcon size={14} className={s.copiedIcon} />
          ) : (
            <CopyIcon size={14} className={s.copyIcon} />
          )}
        </button>
        <button type="button" className={s.shareIconBtn} onClick={share} aria-label="Share invite">
          <ShareIcon size={18} />
        </button>
        <span className={s.srLive} aria-live="polite">
          {copied === 'code' ? 'Code copied' : ''}
        </span>
      </div>
    )
  }

  return (
    <div className={s.full}>
      <button
        type="button"
        className={s.linkChip}
        onClick={() => copy('link')}
        aria-label="Copy invite link"
      >
        <span className={s.link}>{url}</span>
        {copied === 'link' ? (
          <CheckIcon size={16} className={s.copiedIcon} />
        ) : (
          <CopyIcon size={16} className={s.copyIcon} />
        )}
      </button>

      <div className={s.codeBlock}>
        <span className={s.codeLabel}>Or share the code</span>
        <button
          type="button"
          className={s.codeChip}
          onClick={() => copy('code')}
          aria-label={`Copy invite code ${code}`}
        >
          <span className={s.code}>{code}</span>
          {copied === 'code' ? (
            <CheckIcon size={14} className={s.copiedIcon} />
          ) : (
            <CopyIcon size={14} className={s.copyIcon} />
          )}
        </button>
      </div>

      <Button fullWidth onClick={share}>
        <span className={s.shareBtnInner}>
          <ShareIcon size={16} /> Share invite
        </span>
      </Button>
      <span className={s.srLive} aria-live="polite">
        {copied ? `${copied === 'code' ? 'Code' : 'Link'} copied` : ''}
      </span>
    </div>
  )
}
