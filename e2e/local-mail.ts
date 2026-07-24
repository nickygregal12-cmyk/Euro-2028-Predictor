const LOCAL_MAIL_PORT = '54324'

type MailpitAddress = {
  Address?: string
  Email?: string
}

type MailpitMessageSummary = {
  ID: string
  Subject?: string
  To?: MailpitAddress[]
}

type MailpitMessagesResponse = {
  messages?: MailpitMessageSummary[]
}

type MailpitMessage = {
  ID: string
  Subject?: string
  To?: MailpitAddress[]
  Text?: string
  HTML?: string
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

function addressedTo(message: { To?: MailpitAddress[] }, email: string): boolean {
  const expected = email.toLowerCase()
  return (message.To ?? []).some((recipient) => {
    const storedAddress = recipient.Address ?? recipient.Email
    return storedAddress?.toLowerCase() === expected
  })
}

async function listMessages(email: string): Promise<MailpitMessageSummary[]> {
  const response = await fetch(`${localMailOrigin()}/api/v1/messages?limit=100`)
  if (!response.ok) {
    throw new Error(`Local Mailpit list failed with HTTP ${response.status}.`)
  }
  const payload = (await response.json()) as MailpitMessagesResponse
  return (payload.messages ?? []).filter((message) => addressedTo(message, email))
}

async function readMessage(id: string): Promise<MailpitMessage> {
  const response = await fetch(
    `${localMailOrigin()}/api/v1/message/${encodeURIComponent(id)}`,
  )
  if (!response.ok) {
    throw new Error(`Local Mailpit read failed with HTTP ${response.status}.`)
  }
  return (await response.json()) as MailpitMessage
}

function linksFromMessage(message: MailpitMessage): string[] {
  const source = [message.HTML, message.Text]
    .filter((part): part is string => Boolean(part))
    .join('\n')
    .replaceAll('&amp;', '&')

  return source.match(/https?:\/\/[^\s"'<>]+/g) ?? []
}

export async function clearLocalMailbox(email: string): Promise<void> {
  const IDs = (await listMessages(email)).map((message) => message.ID)
  if (IDs.length === 0) return

  const response = await fetch(`${localMailOrigin()}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ IDs }),
  })
  if (!response.ok) {
    throw new Error(`Local Mailpit delete failed with HTTP ${response.status}.`)
  }
}

export async function waitForAuthLink(
  email: string,
  type: 'signup' | 'recovery',
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const messages = await listMessages(email)
    for (const summary of messages) {
      const message = await readMessage(summary.ID)
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
