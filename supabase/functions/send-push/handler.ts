interface NotificationRecord {
  id: string
  user_id: string
  title: string
  body: string
  metadata: Record<string, unknown> | null
}

interface PushDependencies {
  webhookSecret: string | undefined
  getNotification: (id: string) => Promise<{ data: NotificationRecord | null; error: unknown }>
  getPushToken: (userId: string) => Promise<{ data: { push_token: string | null } | null; error: unknown }>
  send: (message: Record<string, unknown>) => Promise<Response>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const json = (status: number, value: Record<string, unknown>) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
})

async function secretsMatch(expected: string, supplied: string | null): Promise<boolean> {
  if (!supplied) return false
  const encode = new TextEncoder()
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encode.encode(expected)),
    crypto.subtle.digest('SHA-256', encode.encode(supplied)),
  ])
  const left = new Uint8Array(expectedHash)
  const right = new Uint8Array(suppliedHash)
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

/** Database webhooks authenticate separately from an end user's Supabase JWT. */
export function createPushHandler(deps: PushDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
    if (!deps.webhookSecret) return json(503, { error: 'Push webhook is not configured' })
    if (!await secretsMatch(deps.webhookSecret, req.headers.get('x-webhook-secret'))) {
      return json(401, { error: 'Unauthorized webhook' })
    }

    let payload: unknown
    try { payload = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json(400, { error: 'Invalid notification webhook' })
    }
    const event = payload as Record<string, unknown>
    const record = event.record as Record<string, unknown> | undefined
    if (event.type !== 'INSERT' || event.table !== 'notifications' || event.schema !== 'public'
      || !record || typeof record.id !== 'string' || !UUID.test(record.id)) {
      return json(400, { error: 'Invalid notification webhook' })
    }

    try {
      // Treat the webhook body only as a pointer. User, text and routing metadata
      // always come from the committed database row, never the request body.
      const { data: notification, error: notificationError } = await deps.getNotification(record.id)
      if (notificationError) return json(500, { error: 'Could not load notification' })
      if (!notification) return json(404, { error: 'Notification not found' })
      const { data: profile, error: profileError } = await deps.getPushToken(notification.user_id)
      if (profileError) return json(500, { error: 'Could not load push registration' })
      if (!profile?.push_token) return json(200, { status: 'skipped', reason: 'no_push_token' })

      const response = await deps.send({
        to: profile.push_token,
        title: notification.title,
        body: notification.body,
        data: notification.metadata ?? {},
        sound: 'default',
        channelId: 'default',
      })
      if (!response.ok) return json(502, { error: 'Push service request failed' })
      const result = await response.json()
      if (result?.data?.status !== 'ok') return json(502, { error: 'Push service rejected notification' })
      // A successful ticket means Expo accepted the request, not device delivery.
      return json(202, { status: 'queued', ticketId: result.data.id })
    } catch {
      return json(500, { error: 'Push delivery attempt failed' })
    }
  }
}
