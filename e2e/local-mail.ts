const LOCAL_MAIL_PORT = '54324'

type MailboxMessage = {
  id: string
  subject?: string
}

type MailboxResponse = MailboxMessage[] | { messages?: MailboxMessage[] }

type MessageResponse = {
  subject?: string
  body?: {
    text?: string
    html?: string
  }
  text?: string
  html?: string
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Browser E2E requires ${name}.`)
  return value
}

function localMailOrigin(): string {
  const value = required('E2E_MAIL_URL')
  const parsed = new URL(value)
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.port !== LOCAL_MAIL_PORT
  ) {
    throw new Error(`Browser E2E refuses non-standard local mail URL ${parsed.origin}.`)
  }
  return parsed.origin
}

function mailboxName(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) throw new Error(`Invalid local E2E email address: ${email}`)
  return email.slice(0, at)
}

async function listMailbox(email: string): Promise<MailboxMessage[]> {
  const response = await fetch(
    `${localMailOrigin()}/api/v1/mailbox/${encodeURIComponent(mailboxName(email))}`,
  )
  if (!response.ok) {
    throw new Error(`Local mail list failed with HTTP ${response.status}.`)
  }
  const payload = (await response.json()) as MailboxResponse
  return Array.isArray(payload) ? payload : payload.messages ?? []
}

async function readMessage(email: string, id: string): Promise<MessageResponse> {
  const response = await fetch(
    `${localMailOrigin()}/api/v1/mailbox/${encodeURIComponent(mailboxName(email))}/${encodeURIComponent(id)}`,
  )
  if (!response.ok) {
    throw new Error(`Local mail read failed with HTTP ${response.status}.`)
  }
  return (await response.json()) as MessageResponse
}

function linksFromMessage(message: MessageResponse): string[] {
  const source = [
    message.body?.html,
    message.body?.text,
    message.html,
    message.text,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n')
    .replaceAll('&amp;', '&')

  return source.match(/https?:\/\/[^\s"'<>]+/g) ?? []
}

export async function clearLocalMailbox(email: string): Promise<void> {
  for (const message of await listMailbox(email)) {
    const response = await fetch(
      `${localMailOrigin()}/api/v1/mailbox/${encodeURIComponent(mailboxName(email))}/${encodeURIComponent(message.id)}`,
      { method: 'DELETE' },
    )
    if (!response.ok && response.status !== 404) {
      throw new Error(`Local mail delete failed with HTTP ${response.status}.`)
    }
  }
}

export async function waitForAuthLink(
  email: string,
  type: 'signup' | 'recovery',
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const messages = await listMailbox(email)
    for (const summary of [...messages].reverse()) {
      const message = await readMessage(email, summary.id)
      const link = linksFromMessage(message).find((candidate) => {
        try {
          const parsed = new URL(candidate)
          return parsed.pathname.includes('/auth/v1/verify') && parsed.searchParams.get('type') === type
        } catch {
          return false
        }
      })
      if (link) return link
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for local ${type} auth email for ${email}.`)
}
